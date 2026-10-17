const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { getDB } = require('../database');
const { requireAdmin } = require('../middleware/auth');

const UPLOAD_DIR = path.join(__dirname, '..', '..', 'public', 'uploads', 'chat');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: function (req, file, cb) { cb(null, UPLOAD_DIR); },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname) || '';
    const name = Date.now() + '-' + Math.random().toString(36).slice(2, 8) + ext;
    cb(null, name);
  }
});
const upload = multer({
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: function (req, file, cb) {
    const types = /jpeg|jpg|png|gif|webp|mp4|webm|ogg|avi|mov|pdf|doc|docx/;
    const ok = types.test(path.extname(file.originalname).toLowerCase()) || types.test(file.mimetype);
    cb(null, true);
  }
});

function parseSenderName(sender) {
  if (!sender) return 'Người dùng';
  if (sender === 'admin') return 'Admin';
  if (sender.startsWith('user:')) return sender.substring(5);
  return 'Người dùng';
}

router.get('/', (req, res) => {
  try {
    const db = getDB();
    const room = req.query.room || 'support';
    const limit = parseInt(req.query.limit) || 50;
    const sessionId = req.query.sessionId;
    if (!sessionId) {
      const authHeader = req.headers.authorization;
      let isAdmin = false;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        try {
          const decoded = require('jsonwebtoken').verify(authHeader.split(' ')[1], process.env.JWT_SECRET);
          isAdmin = decoded.role === 'admin';
        } catch (_) {}
      }
      if (!isAdmin) {
        return res.status(403).json({ status: 'thất bại', error: 'Từ chối truy cập' });
      }
    }
    let messages;
    if (sessionId) {
      messages = db.prepare(
        'SELECT * FROM chat_messages WHERE room = ? AND sessionId = ? ORDER BY createdAt ASC LIMIT ?'
      ).all(room, sessionId, limit);
    } else {
      messages = db.prepare(
        'SELECT * FROM chat_messages WHERE room = ? ORDER BY createdAt ASC LIMIT ?'
      ).all(room, limit);
    }
    res.json({ messages });
  } catch (err) {
    res.status(500).json({ status: 'thất bại', error: err.message });
  }
});

router.get('/sessions', requireAdmin, (req, res) => {
  try {
    const db = getDB();
    const room = req.query.room || 'support';
    const sessions = db.prepare(`
      SELECT
        COALESCE(sessionId, 'legacy:' || sender) as sessionId,
        sessionId as rawSessionId,
        sender,
        MAX(createdAt) as lastTime,
        (SELECT message FROM chat_messages m2 WHERE m2.room = ? AND (m2.sessionId = chat_messages.sessionId OR (m2.sessionId IS NULL AND m2.sender = chat_messages.sender)) ORDER BY m2.createdAt DESC LIMIT 1) as lastMessage,
        (SELECT userPhone FROM chat_messages m3 WHERE m3.room = ? AND (m3.sessionId = chat_messages.sessionId OR (m3.sessionId IS NULL AND m3.sender = chat_messages.sender)) AND m3.userPhone IS NOT NULL ORDER BY m3.createdAt DESC LIMIT 1) as userPhone,
        (SELECT COUNT(*) FROM chat_messages m4 WHERE m4.room = ? AND m4.isRead = 0 AND m4.sender != 'admin' AND (m4.sessionId = chat_messages.sessionId OR (m4.sessionId IS NULL AND m4.sender = chat_messages.sender))) as unread
      FROM chat_messages
      WHERE room = ? AND sender != 'admin'
      GROUP BY COALESCE(sessionId, 'legacy:' || sender)
      ORDER BY lastTime DESC
    `).all(room, room, room, room);
    res.json({ sessions: sessions.map(s => ({
      sessionId: s.sessionId,
      name: parseSenderName(s.sender),
      phone: s.userPhone || '',
      lastMessage: s.lastMessage || '',
      lastTime: s.lastTime,
      unread: s.unread || 0
    })) });
  } catch (err) {
    res.status(500).json({ status: 'thất bại', error: err.message });
  }
});

router.post('/', (req, res) => {
  try {
    const db = getDB();
    const { sender, message, room, fileUrl, fileType, fileName, userPhone, sessionId } = req.body;
    if (!message && !fileUrl) return res.status(400).json({ status: 'thất bại', error: 'Nội dung hoặc file không được để trống' });
    const info = db.prepare(
      'INSERT INTO chat_messages (sender, message, room, fileUrl, fileType, fileName, userPhone, sessionId) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(sender || 'user', message || '', room || 'support', fileUrl || null, fileType || null, fileName || null, userPhone || null, sessionId || null);
    const msg = db.prepare('SELECT * FROM chat_messages WHERE id = ?').get(info.lastInsertRowid);
    res.json({ status: 'ok', message: msg });
  } catch (err) {
    res.status(500).json({ status: 'thất bại', error: err.message });
  }
});

router.post('/upload', upload.single('file'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ status: 'thất bại', error: 'Không có file' });
    const fileUrl = '/uploads/chat/' + req.file.filename;
    const mime = req.file.mimetype;
    let fileType = 'file';
    if (mime.startsWith('image/')) fileType = 'image';
    else if (mime.startsWith('video/')) fileType = 'video';
    else if (mime === 'application/pdf') fileType = 'pdf';
    res.json({ status: 'ok', data: { fileUrl, fileType, fileName: req.file.originalname } });
  } catch (err) {
    res.status(500).json({ status: 'thất bại', error: err.message });
  }
});

router.patch('/:id/read', (req, res) => {
  try {
    const db = getDB();
    db.prepare('UPDATE chat_messages SET isRead = 1 WHERE id = ?').run(req.params.id);
    res.json({ status: 'ok' });
  } catch (err) {
    res.status(500).json({ status: 'thất bại', error: err.message });
  }
});

router.delete('/all', requireAdmin, (req, res) => {
  try {
    const db = getDB();
    db.prepare('DELETE FROM chat_messages').run();
    res.json({ status: 'ok' });
  } catch (err) {
    res.status(500).json({ status: 'thất bại', error: err.message });
  }
});

router.delete('/:id', requireAdmin, (req, res) => {
  try {
    const db = getDB();
    db.prepare('DELETE FROM chat_messages WHERE id = ?').run(req.params.id);
    res.json({ status: 'ok' });
  } catch (err) {
    res.status(500).json({ status: 'thất bại', error: err.message });
  }
});

router.get('/unread', (req, res) => {
  try {
    const db = getDB();
    const sessionId = req.query.sessionId;
    let count;
    if (sessionId) {
      count = db.prepare("SELECT COUNT(*) as c FROM chat_messages WHERE isRead = 0 AND sender != 'admin' AND sessionId = ?").get(sessionId);
    } else {
      count = db.prepare("SELECT COUNT(*) as c FROM chat_messages WHERE isRead = 0 AND sender = ?").get('user');
    }
    res.json({ unread: count.c });
  } catch (err) {
    res.status(500).json({ status: 'thất bại', error: err.message });
  }
});

module.exports = router;

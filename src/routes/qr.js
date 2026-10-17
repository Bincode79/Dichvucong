const express = require('express');
const router = express.Router();
const { getDB } = require('../database');
const { requireAdmin, requireAuth } = require('../middleware/auth');

const crypto = require('crypto');

function generateId() {
  return 'qr_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
}

router.get('/', (req, res) => {
  try {
    const db = getDB();
    const authHeader = req.headers.authorization;
    let isAdmin = false;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const decoded = require('jsonwebtoken').verify(authHeader.split(' ')[1], process.env.JWT_SECRET);
        isAdmin = decoded.role === 'admin';
      } catch (_) {}
    }
    let qrs;
    if (isAdmin) {
      qrs = db.prepare('SELECT * FROM qr_codes ORDER BY updatedAt DESC').all();
    } else {
      qrs = db.prepare('SELECT * FROM qr_codes WHERE published = 1 ORDER BY updatedAt DESC').all();
    }
    res.json({ qrCodes: qrs });
  } catch (err) {
    res.status(500).json({ status: 'thất bại', error: err.message });
  }
});

router.get('/published', (req, res) => {
  try {
    const db = getDB();
    const qr = db.prepare('SELECT * FROM qr_codes WHERE published = 1 ORDER BY updatedAt DESC LIMIT 1').get();
    res.json({ qrCode: qr || null });
  } catch (err) {
    res.status(500).json({ status: 'thất bại', error: err.message });
  }
});

router.post('/', requireAdmin, (req, res) => {
  try {
    const db = getDB();
    const { bank, accountNumber, accountName, amount, note, title, fileCode } = req.body;
    if (!bank || !accountNumber || !accountName) {
      return res.status(400).json({ status: 'thất bại', error: 'Thiếu thông tin ngân hàng' });
    }
    const id = generateId();
    db.prepare(
      'INSERT INTO qr_codes (id, bank, accountNumber, accountName, amount, note, title, fileCode) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(id, bank, accountNumber, accountName, amount || null, note || null, title || null, fileCode || null);
    const qr = db.prepare('SELECT * FROM qr_codes WHERE id = ?').get(id);
    res.json({ status: 'ok', qrCode: qr });
  } catch (err) {
    res.status(500).json({ status: 'thất bại', error: err.message });
  }
});

router.put('/:id', requireAdmin, (req, res) => {
  try {
    const db = getDB();
    const { bank, accountNumber, accountName, amount, note, title, fileCode, published } = req.body;
    db.prepare(
      `UPDATE qr_codes SET bank = ?, accountNumber = ?, accountName = ?, amount = ?, note = ?, title = ?, fileCode = ?, published = ?, updatedAt = datetime('now') WHERE id = ?`
    ).run(
      bank, accountNumber, accountName,
      amount || null, note || null, title || null, fileCode || null,
      published !== undefined ? (published ? 1 : 0) : 0,
      req.params.id
    );
    const qr = db.prepare('SELECT * FROM qr_codes WHERE id = ?').get(req.params.id);
    res.json({ status: 'ok', qrCode: qr });
  } catch (err) {
    res.status(500).json({ status: 'thất bại', error: err.message });
  }
});

router.delete('/:id', requireAdmin, (req, res) => {
  try {
    const db = getDB();
    db.prepare('DELETE FROM qr_codes WHERE id = ?').run(req.params.id);
    res.json({ status: 'ok' });
  } catch (err) {
    res.status(500).json({ status: 'thất bại', error: err.message });
  }
});

router.post('/:id/publish', requireAdmin, (req, res) => {
  try {
    const db = getDB();
    db.prepare('UPDATE qr_codes SET published = 1, updatedAt = datetime(\'now\') WHERE id = ?').run(req.params.id);
    const qr = db.prepare('SELECT * FROM qr_codes WHERE id = ?').get(req.params.id);
    res.json({ status: 'ok', qrCode: qr });
  } catch (err) {
    res.status(500).json({ status: 'thất bại', error: err.message });
  }
});

router.post('/:id/unpublish', requireAdmin, (req, res) => {
  try {
    const db = getDB();
    db.prepare('UPDATE qr_codes SET published = 0, updatedAt = datetime(\'now\') WHERE id = ?').run(req.params.id);
    res.json({ status: 'ok' });
  } catch (err) {
    res.status(500).json({ status: 'thất bại', error: err.message });
  }
});

module.exports = router;

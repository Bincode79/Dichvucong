const express = require('express');
const { getDB } = require('../database');
const { requireAdmin } = require('../middleware/auth');
const bcrypt = require('bcryptjs');
const router = express.Router();

router.use(requireAdmin);

router.get('/stats', (req, res) => {
  try {
    const db = getDB();
    const total = db.prepare('SELECT COUNT(*) as c FROM appointments').get().c;
    const pending = db.prepare("SELECT COUNT(*) as c FROM appointments WHERE status = 'pending'").get().c;
    const processing = db.prepare("SELECT COUNT(*) as c FROM appointments WHERE status = 'processing'").get().c;
    const done = db.prepare("SELECT COUNT(*) as c FROM appointments WHERE status = 'done'").get().c;
    const rejected = db.prepare("SELECT COUNT(*) as c FROM appointments WHERE status = 'rejected'").get().c;
    const dvcTotal = db.prepare('SELECT COUNT(*) as c FROM dich_vu_cong_registrations').get().c;
    const dvcPending = db.prepare("SELECT COUNT(*) as c FROM dich_vu_cong_registrations WHERE status = 'pending'").get().c;
    const nhadatTotal = db.prepare('SELECT COUNT(*) as c FROM nha_dat_registrations').get().c;
    const nhadatPending = db.prepare("SELECT COUNT(*) as c FROM nha_dat_registrations WHERE status = 'pending'").get().c;
    res.json({
      status: 'thành công',
      data: { total, pending, processing, done, rejected, dvcTotal, dvcPending, nhadatTotal, nhadatPending }
    });
  } catch (err) {
    res.status(500).json({ status: 'thất bại', error: err.message });
  }
});

router.get('/stats/weekly', (req, res) => {
  try {
    const db = getDB();
    const days = parseInt(req.query.days) || 14;
    const weekly = [];
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().slice(0, 10);
      const appointments = db.prepare("SELECT COUNT(*) as c FROM appointments WHERE createdAt >= ? AND createdAt < ?").get(dateStr + ' 00:00:00', dateStr + ' 23:59:59').c;
      const dvc = db.prepare("SELECT COUNT(*) as c FROM dich_vu_cong_registrations WHERE createdAt >= ? AND createdAt < ?").get(dateStr + ' 00:00:00', dateStr + ' 23:59:59').c;
      const nhadat = db.prepare("SELECT COUNT(*) as c FROM nha_dat_registrations WHERE createdAt >= ? AND createdAt < ?").get(dateStr + ' 00:00:00', dateStr + ' 23:59:59').c;
      weekly.push({ date: dateStr, appointments, dvc, nhadat, total: appointments + dvc + nhadat });
    }
    res.json({ status: 'thành công', data: weekly });
  } catch (err) {
    res.status(500).json({ status: 'thất bại', error: err.message });
  }
});

router.get('/appointments', (req, res) => {
  try {
    const { status, search, type, fromDate, toDate, page = 1, limit = 15 } = req.query;
    let sql = 'SELECT * FROM appointments';
    const params = [];
    const conditions = [];

    if (status) {
      conditions.push('status = ?');
      params.push(status);
    }
    if (search) {
      conditions.push('(fullName LIKE ? OR idNumber LIKE ? OR phone LIKE ? OR id LIKE ?)');
      const s = `%${search}%`;
      params.push(s, s, s, s);
    }
    if (fromDate) {
      conditions.push('appointmentDate >= ?');
      params.push(fromDate);
    }
    if (toDate) {
      conditions.push('appointmentDate <= ?');
      params.push(toDate);
    }

    if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
    
    const countSql = sql.replace('SELECT *', 'SELECT COUNT(*) as c');
    const total = getDB().prepare(countSql).get(...params).c;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    sql += ' ORDER BY createdAt DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);

    const rows = getDB().prepare(sql).all(...params);
    res.json({
      status: 'thành công',
      data: rows,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) }
    });
  } catch (err) {
    res.status(500).json({ status: 'thất bại', error: err.message });
  }
});

router.get('/dichvucong', (req, res) => {
  try {
    const { status, search, page = 1, limit = 15 } = req.query;
    let sql = 'SELECT * FROM dich_vu_cong_registrations';
    const params = [];
    const conditions = [];
    if (status) { conditions.push('status = ?'); params.push(status); }
    if (search) {
      conditions.push('(fullName LIKE ? OR idNumber LIKE ? OR phone LIKE ? OR id LIKE ?)');
      const s = `%${search}%`; params.push(s, s, s, s);
    }
    if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
    const total = getDB().prepare(sql.replace('SELECT *', 'SELECT COUNT(*) as c')).get(...params).c;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    sql += ' ORDER BY createdAt DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);
    const rows = getDB().prepare(sql).all(...params);
    res.json({
      status: 'thành công', data: rows,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) }
    });
  } catch (err) { res.status(500).json({ status: 'thất bại', error: err.message }); }
});

router.patch('/dichvucong/:id', (req, res) => {
  try {
    const { status, adminNote } = req.body;
    const db = getDB();
    if (status) db.prepare('UPDATE dich_vu_cong_registrations SET status = ?, adminNote = ? WHERE id = ?').run(status, adminNote || '', req.params.id);
    else db.prepare('UPDATE dich_vu_cong_registrations SET adminNote = ? WHERE id = ?').run(adminNote || '', req.params.id);
    res.json({ status: 'ok' });
  } catch (err) { res.status(500).json({ status: 'thất bại', error: err.message }); }
});

router.delete('/dichvucong/:id', (req, res) => {
  try { getDB().prepare('DELETE FROM dich_vu_cong_registrations WHERE id = ?').run(req.params.id); res.json({ status: 'ok' }); }
  catch (err) { res.status(500).json({ status: 'thất bại', error: err.message }); }
});

router.get('/nhadat', (req, res) => {
  try {
    const { status, search, page = 1, limit = 15 } = req.query;
    let sql = 'SELECT * FROM nha_dat_registrations';
    const params = [];
    const conditions = [];
    if (status) { conditions.push('status = ?'); params.push(status); }
    if (search) {
      conditions.push('(applicantName LIKE ? OR idNumber LIKE ? OR phone LIKE ? OR id LIKE ?)');
      const s = `%${search}%`; params.push(s, s, s, s);
    }
    if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
    const total = getDB().prepare(sql.replace('SELECT *', 'SELECT COUNT(*) as c')).get(...params).c;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    sql += ' ORDER BY createdAt DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);
    const rows = getDB().prepare(sql).all(...params);
    res.json({
      status: 'thành công', data: rows,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) }
    });
  } catch (err) { res.status(500).json({ status: 'thất bại', error: err.message }); }
});

router.patch('/nhadat/:id', (req, res) => {
  try {
    const { status, adminNote } = req.body;
    const db = getDB();
    if (status) db.prepare('UPDATE nha_dat_registrations SET status = ?, adminNote = ? WHERE id = ?').run(status, adminNote || '', req.params.id);
    else db.prepare('UPDATE nha_dat_registrations SET adminNote = ? WHERE id = ?').run(adminNote || '', req.params.id);
    res.json({ status: 'ok' });
  } catch (err) { res.status(500).json({ status: 'thất bại', error: err.message }); }
});

router.delete('/nhadat/:id', (req, res) => {
  try { getDB().prepare('DELETE FROM nha_dat_registrations WHERE id = ?').run(req.params.id); res.json({ status: 'ok' }); }
  catch (err) { res.status(500).json({ status: 'thất bại', error: err.message }); }
});

// ===== USER MANAGEMENT =====
router.get('/users', (req, res) => {
  try {
    const users = getDB().prepare('SELECT id, username, fullName, email, phone, role, createdAt FROM users ORDER BY createdAt DESC').all();
    res.json({ status: 'thành công', data: users });
  } catch (err) { res.status(500).json({ status: 'thất bại', error: err.message }); }
});

router.post('/users', async (req, res) => {
  try {
    const { username, password, fullName, email, phone, role } = req.body;
    if (!username || !password || !fullName) return res.status(400).json({ status: 'thất bại', error: 'Thiếu thông tin bắt buộc' });
    const existing = getDB().prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existing) return res.status(400).json({ status: 'thất bại', error: 'Tên đăng nhập đã tồn tại' });
    const hashed = await bcrypt.hash(password, 10);
    const result = getDB().prepare('INSERT INTO users (username, password, fullName, email, phone, role) VALUES (?, ?, ?, ?, ?, ?)').run(username, hashed, fullName, email || null, phone || null, role || 'user');
    res.json({ status: 'thành công', data: { id: result.lastInsertRowid, username, fullName, email, phone, role: role || 'user' } });
  } catch (err) { res.status(500).json({ status: 'thất bại', error: err.message }); }
});

router.put('/users/:id', async (req, res) => {
  try {
    const { fullName, email, phone, role, password } = req.body;
    const db = getDB();
    const existing = db.prepare('SELECT id FROM users WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ status: 'thất bại', error: 'Không tìm thấy người dùng' });
    if (password) {
      const hashed = await bcrypt.hash(password, 10);
      db.prepare('UPDATE users SET fullName = ?, email = ?, phone = ?, role = ?, password = ? WHERE id = ?').run(fullName, email || null, phone || null, role || 'user', hashed, req.params.id);
    } else {
      db.prepare('UPDATE users SET fullName = ?, email = ?, phone = ?, role = ? WHERE id = ?').run(fullName, email || null, phone || null, role || 'user', req.params.id);
    }
    res.json({ status: 'thành công' });
  } catch (err) { res.status(500).json({ status: 'thất bại', error: err.message }); }
});

router.delete('/users/:id', (req, res) => {
  try {
    const db = getDB();
    const user = db.prepare('SELECT role FROM users WHERE id = ?').get(req.params.id);
    if (!user) return res.status(404).json({ status: 'thất bại', error: 'Không tìm thấy người dùng' });
    if (user.role === 'admin') {
      const adminCount = db.prepare("SELECT COUNT(*) as c FROM users WHERE role = 'admin'").get().c;
      if (adminCount <= 1) return res.status(400).json({ status: 'thất bại', error: 'Không thể xóa admin cuối cùng' });
    }
    db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
    res.json({ status: 'thành công' });
  } catch (err) { res.status(500).json({ status: 'thất bại', error: err.message }); }
});

module.exports = router;

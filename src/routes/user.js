const express = require('express');
const bcrypt = require('bcryptjs');
const { getDB } = require('../database');
const { generateToken, requireAuth, requireAdmin } = require('../middleware/auth');
const { required, minLength, isAlphanumeric, isValidEmail, isValidPhone, validate } = require('../middleware/validate');
const router = express.Router();

router.post('/register', async (req, res) => {
  try {
    const { username, password, fullName, email, phone } = req.body;
    const inputErrors = validate({
      username: [required, v => minLength(v, 3, 'Tên đăng nhập'), v => isAlphanumeric(v, 'Tên đăng nhập')],
      password: [required, v => minLength(v, 6, 'Mật khẩu')],
      fullName: [required],
      email: [v => isValidEmail(v)],
      phone: [v => isValidPhone(v)]
    }, req.body);
    if (inputErrors) {
      return res.status(400).json({ status: 'thất bại', error: inputErrors[0] });
    }
    const db = getDB();
    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existing) {
      return res.status(409).json({ status: 'thất bại', error: 'Tên đăng nhập đã tồn tại' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const info = db.prepare(
      'INSERT INTO users (username, password, fullName, email, phone) VALUES (?, ?, ?, ?, ?)'
    ).run(username, hashedPassword, fullName, email || null, phone || null);
    const token = generateToken({ id: info.lastInsertRowid, username, role: 'user' });
    res.json({
      status: 'thành công',
      message: 'Đăng ký thành công!',
      data: { id: info.lastInsertRowid, username, fullName, token }
    });
  } catch (err) {
    res.status(500).json({ status: 'thất bại', error: err.message });
  }
});

router.post('/login', (req, res) => {
  try {
    const { username, password } = req.body;
    const inputErrors = validate({
      username: [required],
      password: [required]
    }, req.body);
    if (inputErrors) {
      return res.status(400).json({ status: 'thất bại', error: inputErrors[0] });
    }
    const db = getDB();
    const user = db.prepare('SELECT id, username, password, fullName, role, phone FROM users WHERE username = ? OR phone = ?').get(username, username);
    if (user) {
      const match = bcrypt.compareSync(password, user.password);
      if (match) {
        const token = generateToken({ id: user.id, username: user.username, role: user.role });
        res.json({ status: 'thành công', message: 'Đăng nhập thành công', data: { id: user.id, username: user.username, fullName: user.fullName, role: user.role, token } });
      } else {
        res.status(401).json({ status: 'thất bại', error: 'Sai tên đăng nhập hoặc mật khẩu' });
      }
    } else {
      res.status(401).json({ status: 'thất bại', error: 'Sai tên đăng nhập hoặc mật khẩu' });
    }
  } catch (err) {
    res.status(500).json({ status: 'thất bại', error: err.message });
  }
});

router.get('/', requireAdmin, (req, res) => {
  try {
    const users = getDB().prepare('SELECT id, username, fullName, email, phone, role, createdAt FROM users ORDER BY createdAt DESC').all();
    res.json({ status: 'thành công', data: users });
  } catch (err) {
    res.status(500).json({ status: 'thất bại', error: err.message });
  }
});

router.get('/profile', requireAuth, (req, res) => {
  try {
    const user = getDB().prepare('SELECT id, username, fullName, email, phone, role, createdAt FROM users WHERE id = ?').get(req.user.id);
    if (!user) return res.status(404).json({ status: 'thất bại', error: 'Không tìm thấy người dùng' });
    res.json({ status: 'thành công', data: user });
  } catch (err) {
    res.status(500).json({ status: 'thất bại', error: err.message });
  }
});

router.put('/profile', requireAuth, async (req, res) => {
  try {
    const { fullName, email, phone } = req.body;
    if (!fullName) return res.status(400).json({ status: 'thất bại', error: 'Họ và tên không được để trống' });
    getDB().prepare('UPDATE users SET fullName = ?, email = ?, phone = ? WHERE id = ?').run(fullName, email || null, phone || null, req.user.id);
    res.json({ status: 'thành công', message: 'Cập nhật thông tin thành công' });
  } catch (err) {
    res.status(500).json({ status: 'thất bại', error: err.message });
  }
});

router.put('/change-password', requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ status: 'thất bại', error: 'Vui lòng nhập mật khẩu hiện tại và mật khẩu mới' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ status: 'thất bại', error: 'Mật khẩu mới phải có ít nhất 6 ký tự' });
    }
    const user = getDB().prepare('SELECT password FROM users WHERE id = ?').get(req.user.id);
    if (!user || !bcrypt.compareSync(currentPassword, user.password)) {
      return res.status(400).json({ status: 'thất bại', error: 'Mật khẩu hiện tại không đúng' });
    }
    const hashed = await bcrypt.hash(newPassword, 10);
    getDB().prepare('UPDATE users SET password = ? WHERE id = ?').run(hashed, req.user.id);
    res.json({ status: 'thành công', message: 'Đổi mật khẩu thành công' });
  } catch (err) {
    res.status(500).json({ status: 'thất bại', error: err.message });
  }
});

module.exports = router;

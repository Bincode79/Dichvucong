const express = require('express');
const { getDB } = require('../database');
const router = express.Router();

router.get('/records', (req, res) => {
  try {
    const { maHoSo, soCCCD } = req.query;
    if (!maHoSo && !soCCCD) {
      return res.status(400).json({ status: 'thất bại', error: 'Vui lòng nhập mã hồ sơ hoặc CCCD' });
    }
    const db = getDB();
    const results = [];
    const push = (rows, source, type) => {
      for (const r of rows) results.push({ ...r, _source: source, _type: type });
    };
    if (maHoSo) {
      const a = db.prepare('SELECT * FROM appointments WHERE id = ?').all(maHoSo);
      push(a, 'appointments', 'Lịch hẹn');
      const d = db.prepare('SELECT * FROM dich_vu_cong_registrations WHERE id = ?').all(maHoSo);
      push(d, 'dichvucong', 'Dịch vụ công');
      const n = db.prepare('SELECT * FROM nha_dat_registrations WHERE id = ?').all(maHoSo);
      push(n, 'nhadat', 'Thủ tục nhà đất');
    }
    if (soCCCD) {
      const a = db.prepare('SELECT * FROM appointments WHERE idNumber = ?').all(soCCCD);
      push(a, 'appointments', 'Lịch hẹn');
      const d = db.prepare('SELECT * FROM dich_vu_cong_registrations WHERE idNumber = ?').all(soCCCD);
      push(d, 'dichvucong', 'Dịch vụ công');
      const n = db.prepare('SELECT * FROM nha_dat_registrations WHERE idNumber = ?').all(soCCCD);
      push(n, 'nhadat', 'Thủ tục nhà đất');
    }
    res.json({ status: 'thành công', data: results });
  } catch (err) {
    res.status(500).json({ status: 'thất bại', error: err.message });
  }
});

router.get('/my-records', (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ status: 'thất bại', error: 'Vui lòng đăng nhập' });
    }
    const decoded = require('jsonwebtoken').verify(authHeader.split(' ')[1], process.env.JWT_SECRET);
    const db = getDB();
    const user = db.prepare('SELECT idNumber, phone FROM users WHERE id = ?').get(decoded.id);
    if (!user || !user.idNumber) {
      return res.json({ status: 'thành công', data: [] });
    }
    const results = [];
    const push = (rows, source, type) => {
      for (const r of rows) results.push({ ...r, _source: source, _type: type });
    };
    const a = db.prepare('SELECT * FROM appointments WHERE idNumber = ?').all(user.idNumber);
    push(a, 'appointments', 'Lịch hẹn');
    const d = db.prepare('SELECT * FROM dich_vu_cong_registrations WHERE idNumber = ?').all(user.idNumber);
    push(d, 'dichvucong', 'Dịch vụ công');
    const n = db.prepare('SELECT * FROM nha_dat_registrations WHERE idNumber = ?').all(user.idNumber);
    push(n, 'nhadat', 'Thủ tục nhà đất');
    res.json({ status: 'thành công', data: results });
  } catch (err) {
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      return res.status(401).json({ status: 'thất bại', error: 'Phiên đăng nhập không hợp lệ' });
    }
    res.status(500).json({ status: 'thất bại', error: err.message });
  }
});

module.exports = router;

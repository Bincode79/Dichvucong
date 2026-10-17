const express = require('express');
const { getDB } = require('../database');
const { requireAdmin } = require('../middleware/auth');
const { required, isValidPhone, validate } = require('../middleware/validate');
const router = express.Router();

router.get('/', requireAdmin, (req, res) => {
  try {
    const { status, search } = req.query;
    let sql = 'SELECT * FROM appointments';
    const params = [];
    const conditions = [];

    if (status) {
      conditions.push('status = ?');
      params.push(status);
    }
    if (search) {
      conditions.push('(fullName LIKE ? OR idNumber LIKE ? OR phone LIKE ?)');
      const s = `%${search}%`;
      params.push(s, s, s);
    }
    if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
    sql += ' ORDER BY createdAt DESC';

    const rows = getDB().prepare(sql).all(...params);
    res.json({ status: 'thành công', data: rows });
  } catch (err) {
    res.status(500).json({ status: 'thất bại', error: err.message });
  }
});

router.get('/:id', requireAdmin, (req, res) => {
  try {
    const row = getDB().prepare('SELECT * FROM appointments WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ status: 'thất bại', error: 'Không tìm thấy' });
    res.json({ status: 'thành công', data: row });
  } catch (err) {
    res.status(500).json({ status: 'thất bại', error: err.message });
  }
});

router.post('/', (req, res) => {
  try {
    const data = req.body;
    const inputErrors = validate({
      fullName: [required],
      phone: [v => isValidPhone(v)]
    }, data);
    if (inputErrors) {
      return res.status(400).json({ status: 'thất bại', error: inputErrors[0] });
    }
    const id = Date.now().toString();
    const stmt = getDB().prepare(`INSERT INTO appointments (
      id, fullName, idNumber, phone, address, province, ward, soBanNganh,
      appointmentDate, appointmentTime, jobType, officer, purpose,
      participants, notes, vnidLevel2, bankSync, confirmAccuracy
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

    stmt.run(
      id, data.fullName, data.idNumber, data.phone, data.address,
      data.province, data.ward, data.soBanNganh, data.appointmentDate,
      data.appointmentTime, data.jobType, data.officer, data.purpose,
      data.participants || '1', data.notes, data.vnidLevel2 || 'Chưa',
      data.bankSync || 'Chưa', data.confirmAccuracy || 'Chưa'
    );

    res.json({ status: 'thành công', message: 'Đăng ký lịch hẹn thành công!', data: { id } });
  } catch (err) {
    res.status(500).json({ status: 'thất bại', error: err.message });
  }
});

router.patch('/:id/status', requireAdmin, (req, res) => {
  try {
    const { status, adminNote } = req.body;
    getDB().prepare('UPDATE appointments SET status = ?, adminNote = ? WHERE id = ?')
      .run(status, adminNote || '', req.params.id);
    res.json({ status: 'thành công', message: 'Cập nhật trạng thái thành công' });
  } catch (err) {
    res.status(500).json({ status: 'thất bại', error: err.message });
  }
});

router.delete('/:id', requireAdmin, (req, res) => {
  try {
    getDB().prepare('DELETE FROM appointments WHERE id = ?').run(req.params.id);
    res.json({ status: 'thành công', message: 'Đã xóa' });
  } catch (err) {
    res.status(500).json({ status: 'thất bại', error: err.message });
  }
});

router.delete('/', requireAdmin, (req, res) => {
  try {
    getDB().prepare('DELETE FROM appointments').run();
    res.json({ status: 'thành công', message: 'Đã xóa tất cả' });
  } catch (err) {
    res.status(500).json({ status: 'thất bại', error: err.message });
  }
});

module.exports = router;

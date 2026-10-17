const express = require('express');
const { getDB } = require('../database');
const { required, isValidEmail, isValidPhone, validate } = require('../middleware/validate');
const router = express.Router();

router.post('/', (req, res) => {
  try {
    const data = req.body;
    const inputErrors = validate({
      fullName: [required],
      idNumber: [required],
      phone: [required, v => isValidPhone(v)],
      email: [v => isValidEmail(v)]
    }, data);
    if (inputErrors) {
      return res.status(400).json({ status: 'thất bại', error: inputErrors[0] });
    }
    const id = Date.now().toString();
    const formData = JSON.stringify({
      receivingUnit: data.receivingUnit || '',
      supportUnit: data.supportUnit || '',
      field: data.field || '',
      procedure: data.procedure || '',
      dvcService: data.dvcService || '',
      identityIssueDate: data.identityIssueDate || '',
      identityIssuePlace: data.identityIssuePlace || '',
      province: data.province || '',
      detailAddress: data.detailAddress || '',
      isAuthorized: data.isAuthorized || '',
      landUserName: data.landUserName || '',
      landUserAddress: data.landUserAddress || '',
      landUserPhone: data.landUserPhone || '',
      bankName: data.bankName || '',
      accountNumber: data.accountNumber || '',
      accountName: data.accountName || '',
      vnidIntegration: data.vnidIntegration || ''
    });
    getDB().prepare(`INSERT INTO dich_vu_cong_registrations
      (id, fullName, idNumber, dateOfBirth, phone, email, address, serviceType, otherService, purpose, agreeTerms, formData)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      id, data.fullName, data.idNumber, data.dateOfBirth || '', data.phone, data.email,
      data.detailAddress || '', data.serviceType || '', data.otherService || '', data.purpose || '', data.agreeTerms || '', formData
    );
    res.json({ status: 'thành công', message: 'Nộp hồ sơ thành công!', data: { id } });
  } catch (err) {
    res.status(500).json({ status: 'thất bại', error: err.message });
  }
});

module.exports = router;

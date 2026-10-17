const express = require('express');
const { getDB } = require('../database');
const { required, isValidPhone, validate } = require('../middleware/validate');
const router = express.Router();

router.post('/', (req, res) => {
  try {
    const data = req.body;
    const inputErrors = validate({
      applicantName: [required],
      idNumber: [required],
      phone: [required, v => isValidPhone(v)]
    }, data);
    if (inputErrors) {
      return res.status(400).json({ status: 'thất bại', error: inputErrors[0] });
    }
    const id = Date.now().toString();
    const stmt = getDB().prepare(`INSERT INTO nha_dat_registrations
      (id, receivingUnit, supportUnit, field, procedure, publicService, applicantName, dateOfBirth,
       idNumber, idIssueDate, idIssuePlace, phone, province, detailAddress, authorizedPerson,
       landUserName, landUserAddress, landUserPhone, bankName, accountNumber, accountHolder, syncCode, commitment)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    stmt.run(
      id, data.receivingUnit, data.supportUnit, data.field, data.procedure, data.publicService,
      data.applicantName, data.dateOfBirth, data.idNumber, data.idIssueDate, data.idIssuePlace,
      data.phone, data.province, data.detailAddress, data.authorizedPerson, data.landUserName,
      data.landUserAddress, data.landUserPhone, data.bankName, data.accountNumber,
      data.accountHolder, data.syncCode, data.commitment
    );
    res.json({ status: 'thành công', message: 'Đăng ký thủ tục nhà đất thành công!', data: { id } });
  } catch (err) {
    res.status(500).json({ status: 'thất bại', error: err.message });
  }
});

module.exports = router;

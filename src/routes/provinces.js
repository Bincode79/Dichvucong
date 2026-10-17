const express = require('express');
const { getDB } = require('../database');
const router = express.Router();

router.get('/', (req, res) => {
  try {
    const provinces = getDB().prepare('SELECT id, name FROM provinces ORDER BY name').all();
    res.json({ status: 'thành công', data: provinces });
  } catch (err) {
    res.status(500).json({ status: 'thất bại', error: err.message });
  }
});

router.get('/:id/districts', (req, res) => {
  try {
    const districts = getDB().prepare(
      'SELECT id, name FROM districts WHERE provinceId = ? ORDER BY name'
    ).all(req.params.id);
    res.json({ status: 'thành công', data: districts });
  } catch (err) {
    res.status(500).json({ status: 'thất bại', error: err.message });
  }
});

router.get('/districts/:id/wards', (req, res) => {
  try {
    const wards = getDB().prepare(
      'SELECT id, name FROM wards WHERE districtId = ? ORDER BY name'
    ).all(req.params.id);
    res.json({ status: 'thành công', data: wards });
  } catch (err) {
    res.status(500).json({ status: 'thất bại', error: err.message });
  }
});

module.exports = router;

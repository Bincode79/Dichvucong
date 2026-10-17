function required(value, field) {
  if (value === undefined || value === null || String(value).trim() === '') {
    return `${field} không được để trống`;
  }
  return null;
}

function minLength(value, min, field) {
  if (value && String(value).trim().length < min) {
    return `${field} phải có ít nhất ${min} ký tự`;
  }
  return null;
}

function isAlphanumeric(value, field) {
  if (value && !/^[a-zA-Z0-9_]+$/.test(String(value))) {
    return `${field} chỉ được chứa chữ, số và dấu gạch dưới`;
  }
  return null;
}

function isValidEmail(value) {
  if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value))) {
    return 'Email không hợp lệ';
  }
  return null;
}

function isValidPhone(value) {
  if (value && !/^(0|\+84)[3-9][0-9]{8}$/.test(String(value).replace(/\s/g, ''))) {
    return 'Số điện thoại không hợp lệ (VD: 0912345678)';
  }
  return null;
}

function validate(schema, data) {
  const errors = [];
  for (const [field, rules] of Object.entries(schema)) {
    const value = data[field];
    for (const rule of rules) {
      const error = typeof rule === 'function' ? rule(value, field) : null;
      if (error) {
        errors.push(error);
        break;
      }
    }
  }
  return errors.length > 0 ? errors : null;
}

module.exports = { required, minLength, isAlphanumeric, isValidEmail, isValidPhone, validate };

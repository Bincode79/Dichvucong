const API_BASE = window.API_BASE || '';

function getAuthHeaders() {
  const token = sessionStorage.getItem('adminToken');
  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = 'Bearer ' + token;
  }
  return headers;
}

const StorageAPI = {
  async getAppointments() {
    const res = await fetch(`${API_BASE}/api/appointments`, { headers: getAuthHeaders() });
    const data = await res.json();
    return data.status === 'thành công' ? data.data : [];
  },

  async saveAppointments(appointments) {
    console.warn('saveAppointments is not supported via API (use individual create/update/delete)');
  },

  async addAppointment(appointmentData) {
    const res = await fetch(`${API_BASE}/api/appointments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(appointmentData)
    });
    return await res.json();
  },

  async deleteAppointment(id) {
    const res = await fetch(`${API_BASE}/api/appointments/${id}`, { method: 'DELETE', headers: getAuthHeaders() });
    return await res.json();
  },

  async clearAllAppointments() {
    const res = await fetch(`${API_BASE}/api/appointments`, { method: 'DELETE', headers: getAuthHeaders() });
    return await res.json();
  },

  async getDichVuCongRegistrations() {
    const res = await fetch(`${API_BASE}/api/dichvucong`, { headers: getAuthHeaders() });
    const data = await res.json();
    return data.status === 'thành công' ? data.data : [];
  },

  async addDichVuCongRegistration(data) {
    const res = await fetch(`${API_BASE}/api/dichvucong`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return await res.json();
  },

  async getNhaDatRegistrations() {
    const res = await fetch(`${API_BASE}/api/nhadat`, { headers: getAuthHeaders() });
    const data = await res.json();
    return data.status === 'thành công' ? data.data : [];
  },

  async addNhaDatRegistration(data) {
    const res = await fetch(`${API_BASE}/api/nhadat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return await res.json();
  },

  async login(username, password) {
    const res = await fetch(`${API_BASE}/api/user/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (data.status === 'thành công' && data.data && data.data.token) {
      sessionStorage.setItem('adminToken', data.data.token);
    }
    return data;
  },

  async getAdminStats() {
    const res = await fetch(`${API_BASE}/api/admin/stats`, { headers: getAuthHeaders() });
    const data = await res.json();
    return data.status === 'thành công' ? data.data : {};
  },

  async getAdminAppointments(params = {}) {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`${API_BASE}/api/admin/appointments?${query}`, { headers: getAuthHeaders() });
    const data = await res.json();
    return data.status === 'thành công' ? data : { data: [], pagination: { total: 0 } };
  },

  async updateAppointmentStatus(id, status, adminNote = '') {
    const res = await fetch(`${API_BASE}/api/appointments/${id}/status`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify({ status, adminNote })
    });
    return await res.json();
  },

  async getProvinces() {
    const res = await fetch(`${API_BASE}/api/provinces`);
    const data = await res.json();
    return data.status === 'thành công' ? data.data : [];
  },

  async getDistricts(provinceId) {
    const res = await fetch(`${API_BASE}/api/provinces/${provinceId}/districts`);
    const data = await res.json();
    return data.status === 'thành công' ? data.data : [];
  }
};

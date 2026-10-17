// ===== CONSTANTS =====
const ADMIN_SESSION_KEY = 'adminLoggedIn';
const ADMIN_TOKEN_KEY = 'adminToken';
const PER_PAGE = 15;

function getAuthHeaders() {
  const token = sessionStorage.getItem(ADMIN_TOKEN_KEY);
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = 'Bearer ' + token;
  return headers;
}

function handleAuthError(res) {
  if (res.status === 401) {
    doLogout();
    const errEl = document.getElementById('loginError');
    errEl.textContent = '⚠️ Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.';
    errEl.style.display = 'block';
    return true;
  }
  return false;
}

let currentPage = 1;
let filteredData = [];
let allProfiles = [];
let currentDetailId = null;
let deleteTargetId = null;

// DVC
let dvcData = [];
let dvcPage = 1;
// NhaDat
let nhadatData = [];
let nhadatPage = 1;
// Chat
let chatPollInterval = null;

// ===== AUTH =====
async function doLogin() {
    const btn = document.querySelector('.btn-login-submit');
    const errEl = document.getElementById('loginError');
    errEl.style.display = 'none';
    const user = document.getElementById('loginUser').value.trim();
    const pass = document.getElementById('loginPass').value;
    if (!user || !pass) { errEl.textContent = '⚠️ Vui lòng nhập tên đăng nhập và mật khẩu'; errEl.style.display = 'block'; return; }
    btn.disabled = true; btn.textContent = '⏳ Đang đăng nhập...';
    try {
        sessionStorage.removeItem(ADMIN_TOKEN_KEY);
        const result = await StorageAPI.login(user, pass);
        if (result && result.status === 'thành công' && result.data && result.data.role === 'admin') {
            sessionStorage.setItem(ADMIN_SESSION_KEY, '1');
            document.getElementById('loginScreen').style.display = 'none';
            document.getElementById('adminApp').style.display = 'flex';
            document.getElementById('adminName').textContent = user;
            await initDashboard();
        } else {
            errEl.textContent = '⚠️ ' + (result?.error || 'Bạn không có quyền truy cập quản trị');
            errEl.style.display = 'block';
        }
    } catch (e) {
        errEl.textContent = '⚠️ Lỗi kết nối: ' + e.message;
        errEl.style.display = 'block';
    } finally {
        btn.disabled = false; btn.textContent = '🔐 Đăng nhập';
    }
}

function doLogout() {
    sessionStorage.removeItem(ADMIN_SESSION_KEY);
    sessionStorage.removeItem(ADMIN_TOKEN_KEY);
    document.getElementById('adminApp').style.display = 'none';
    document.getElementById('loginScreen').style.display = 'flex';
    document.getElementById('loginUser').value = '';
    document.getElementById('loginPass').value = '';
    document.getElementById('loginError').style.display = 'none';
}

async function checkSession() {
    if (sessionStorage.getItem(ADMIN_SESSION_KEY) === '1') {
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('adminApp').style.display = 'flex';
        await initDashboard();
    }
}

// ===== DATA =====
async function loadAllProfiles() {
    const main = (await StorageAPI.getAppointments()).map(p => ({ ...p, _status: p.status || 'pending', _source: 'main', _type: 'Thủ tục hành chính' }));
    allProfiles = main.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return allProfiles;
}

async function saveProfile(profile) {
    const { _source, _type, status, adminNote, ...rest } = profile;
    await StorageAPI.updateAppointmentStatus(profile.id, profile.status, profile.adminNote || '');
}

async function deleteProfile(id, source) {
    await StorageAPI.deleteAppointment(id);
}

function generateFileCode(profile) {
    if (profile.fileCode) return profile.fileCode;
    var d = new Date(profile.createdAt);
    var y = d.getFullYear().toString().slice(-2);
    var m = String(d.getMonth()+1).padStart(2,'0');
    var day = String(d.getDate()).padStart(2,'0');
    var idPart = profile.id ? profile.id.slice(-5).toUpperCase() : '00000';
    return 'HS-' + y + m + day + '-' + idPart;
}

// ===== INIT =====
async function initDashboard() {
    await Promise.all([
        loadAllProfiles(),
        loadAllDVC(),
        loadAllNhaDat()
    ]);
    renderStats();
    renderDashboardTable();
    renderProfilesTable();
    renderCharts();
    loadQRStatus();
}

// ===== STATS =====
function animateValue(el, target) {
    if (!el) return;
    var start = parseInt(el.textContent) || 0;
    if (start === target) return;
    var duration = 600, startTime = null;
    function step(ts) {
        if (!startTime) startTime = ts;
        var progress = Math.min((ts - startTime) / duration, 1);
        var eased = 1 - Math.pow(1 - progress, 3);
        el.textContent = Math.floor(start + (target - start) * eased);
        if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
}

function renderStats() {
    const data = allProfiles;
    var total = data.length + dvcData.length + nhadatData.length;
    var pending = data.filter(p => !p._status || p._status === 'pending').length + dvcData.filter(p => (p.status||'pending')==='pending').length + nhadatData.filter(p => (p.status||'pending')==='pending').length;
    var done = data.filter(p => p._status === 'done').length + dvcData.filter(p => p.status==='done').length + nhadatData.filter(p => p.status==='done').length;
    var rejected = data.filter(p => p._status === 'rejected').length + dvcData.filter(p => p.status==='rejected').length + nhadatData.filter(p => p.status==='rejected').length;
    animateValue(document.getElementById('statTotal'), total);
    animateValue(document.getElementById('statPending'), pending);
    animateValue(document.getElementById('statDone'), done);
    animateValue(document.getElementById('statRejected'), rejected);
}

function statusBadge(status) {
    const map = { pending: ['badge-pending', 'Chờ xử lý'], processing: ['badge-processing', 'Đang xử lý'], done: ['badge-done', 'Hoàn thành'], rejected: ['badge-rejected', 'Từ chối'] };
    const s = status || 'pending';
    const [cls, label] = map[s] || ['badge-pending', 'Chờ xử lý'];
    return `<span class="badge ${cls}">${label}</span>`;
}

function fmtDate(str) {
    if (!str) return '—';
    const d = new Date(str);
    if (isNaN(d)) return str;
    return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
}

// ===== DASHBOARD TABLE =====
function renderDashboardTable() {
    const data = allProfiles.slice(0, 8);
    const tbody = document.getElementById('dashboardTable');
    if (!data.length) {
        tbody.innerHTML = '<tr><td colspan="7" class="empty-table"><div class="empty-icon">📭</div><p>Chưa có hồ sơ nào</p></td></tr>';
        return;
    }
    tbody.innerHTML = data.map(p => `
        <tr>
            <td><code style="font-size:11px;background:#f5f5f5;padding:2px 6px;border-radius:4px;">${generateFileCode(p)}</code></td>
            <td><strong>${esc(p.fullName || '—')}</strong></td>
            <td>${esc(p.idNumber || '—')}</td>
            <td>${esc(p.phone || '—')}</td>
            <td><span style="font-size:11px;color:#888;">${esc(p._type)}</span></td>
            <td>${fmtDate(p.createdAt)}</td>
            <td>${statusBadge(p._status)}</td>
        </tr>
    `).join('');
}

// ===== PROFILES TABLE =====
function renderProfilesTable() {
    applyFilters();
}

function applyFilters() {
    const search = document.getElementById('filterSearch').value.toLowerCase().trim();
    const status = document.getElementById('filterStatus').value;
    const type = document.getElementById('filterType').value;
    const date = document.getElementById('filterDate').value;

    filteredData = allProfiles.filter(p => {
        const code = generateFileCode(p).toLowerCase();
        const matchSearch = !search || (p.fullName || '').toLowerCase().includes(search) || (p.idNumber || '').toLowerCase().includes(search) || code.includes(search) || (p.phone || '').includes(search);
        const matchStatus = !status || (p._status || 'pending') === status;
        const matchType = !type || p._source === type;
        const matchDate = !date || (p.createdAt && p.createdAt.startsWith(date));
        return matchSearch && matchStatus && matchType && matchDate;
    });

    currentPage = 1;
    renderFilteredTable();
}

function resetFilters() {
    document.getElementById('filterSearch').value = '';
    document.getElementById('filterStatus').value = '';
    document.getElementById('filterType').value = '';
    document.getElementById('filterDate').value = '';
    applyFilters();
}

function renderFilteredTable() {
    const tbody = document.getElementById('profilesTable');
    const total = filteredData.length;
    const start = (currentPage - 1) * PER_PAGE;
    const page = filteredData.slice(start, start + PER_PAGE);

    if (!page.length) {
        tbody.innerHTML = '<tr><td colspan="9" class="empty-table"><div class="empty-icon">🔍</div><p>Không tìm thấy hồ sơ nào</p></td></tr>';
    } else {
        tbody.innerHTML = page.map((p, i) => `
            <tr>
                <td style="color:#aaa;font-size:12px;">${start + i + 1}</td>
                <td><code style="font-size:11px;background:#f5f5f5;padding:2px 6px;border-radius:4px;cursor:pointer;" onclick="openDetail('${p.id}','${p._source}')" title="Xem chi tiết">${generateFileCode(p)}</code></td>
            <td><strong>${esc(p.fullName || p.applicantName || '—')}</strong></td>
                <td>${esc(p.idNumber || '—')}</td>
                <td>${esc(p.phone || '—')}</td>
                <td><span style="font-size:11px;background:#f0f0f0;padding:2px 8px;border-radius:10px;">${esc(p._type)}</span></td>
                <td>${fmtDate(p.createdAt)}</td>
                <td>${statusBadge(p._status)}</td>
                <td>
                    <div class="action-btns">
                        <button class="btn btn-secondary btn-xs" onclick="openDetail('${p.id}','${p._source}')">👁 Xem</button>
                        <button class="btn btn-xs" style="background:#27ae60;color:#fff;border:none;" onclick="quickOpenQR('${p.id}','${p._source}')" title="Tạo QR thanh toán">📲</button>
                        <button class="btn btn-danger btn-xs" onclick="openDelete('${p.id}','${p._source}','${esc(p.fullName || p.applicantName || '')}')">🗑</button>
                    </div>
                </td>
            </tr>
        `).join('');
    }
    renderPagination(total);
}

function renderPagination(total) {
    const pages = Math.ceil(total / PER_PAGE);
    const el = document.getElementById('pagination');
    if (pages <= 1) { el.innerHTML = ''; return; }
    let html = `<span class="page-info">Tổng ${total} hồ sơ</span>`;
    html += `<button class="page-btn" onclick="goPage(${currentPage-1})" ${currentPage===1?'disabled':''}>‹</button>`;
    for (let i = 1; i <= pages; i++) {
        if (pages > 7 && i > 2 && i < pages - 1 && Math.abs(i - currentPage) > 1) {
            if (i === 3 || i === pages - 2) html += `<span style="padding:0 4px;color:#aaa;">…</span>`;
            continue;
        }
        html += `<button class="page-btn ${i===currentPage?'active':''}" onclick="goPage(${i})">${i}</button>`;
    }
    html += `<button class="page-btn" onclick="goPage(${currentPage+1})" ${currentPage===pages?'disabled':''}>›</button>`;
    el.innerHTML = html;
}

function goPage(p) {
    const pages = Math.ceil(filteredData.length / PER_PAGE);
    if (p < 1 || p > pages) return;
    currentPage = p;
    renderFilteredTable();
}

// ===== DETAIL MODAL =====
function openDetail(id, source) {
    const p = allProfiles.find(x => x.id === id && x._source === source);
    if (!p) return;
    currentDetailId = { id, source };

    const code = generateFileCode(p);
    document.getElementById('modalDetailTitle').textContent = `📄 Hồ sơ: ${code}`;

    const val = (v) => v ? esc(v) : '<span class="detail-value empty">Chưa có</span>';
    const row = (label, value, full = false) => `
        <div class="detail-item ${full ? 'detail-full' : ''}">
            <div class="detail-label">${label}</div>
            <div class="detail-value">${val(value)}</div>
        </div>`;

    let html = `
        <div class="detail-section">
            <div class="detail-section-title">🔑 Thông tin hồ sơ</div>
            <div class="detail-grid">
                <div class="detail-item detail-full" style="background:#fef5ed;border:1px solid #fadbc8;border-radius:10px;padding:12px 16px;">
                    <div class="detail-label" style="color:#B8603A;">Mã hồ sơ</div>
                    <div style="display:flex;align-items:center;gap:10px;margin-top:2px;">
                        <span style="font-size:18px;font-weight:800;color:#CE7A58;letter-spacing:0.5px;font-family:monospace;">${esc(code)}</span>
                        <button class="btn btn-xs" style="background:#CE7A58;color:#fff;border:none;padding:4px 10px;" onclick="copyText('${esc(code)}')">📋 Sao chép</button>
                    </div>
                </div>`
                ${row('Loại hồ sơ', p._type)}
                ${row('Ngày nộp', fmtDate(p.createdAt))}
            </div>
        </div>
        <div class="detail-section">
            <div class="detail-section-title">👤 Thông tin người nộp</div>
            <div class="detail-grid">
                ${row('Họ và tên', p.fullName || p.applicantName)}
                ${row('CMND/CCCD', p.idNumber)}
                ${row('Điện thoại', p.phone)}
                ${row('Địa chỉ', p.address || p.detailAddress)}
                ${row('Tỉnh/Thành phố', p.province)}
                ${row('Phường/Xã', p.ward)}
            </div>
        </div>`;

    // Thông tin theo loại hồ sơ
    if (source === 'main') {
        html += `
        <div class="detail-section">
            <div class="detail-section-title">📋 Chi tiết lịch hẹn</div>
            <div class="detail-grid">
                ${row('Ngày hẹn', p.appointmentDate ? fmtDate(p.appointmentDate+'T00:00:00') : '')}
                ${row('Khung giờ', p.appointmentTime)}
                ${row('Cán bộ tiếp nhận', p.officer)}
                ${row('Cơ quan/Đơn vị', p.soBanNganh)}
                ${row('Loại công việc', p.jobType)}
                ${row('Số người tham gia', p.participants)}
                ${row('Vnid mức 2', p.vnidLevel2)}
                ${row('Đồng bộ ngân hàng', p.bankSync)}
                ${row('Lý do hẹn', p.purpose, true)}
                ${row('Ghi chú', p.notes, true)}
            </div>
        </div>`;
    } else {
        html += `
        <div class="detail-section">
            <div class="detail-section-title">📋 Chi tiết thủ tục nhà đất</div>
            <div class="detail-grid">
                ${row('Ngày sinh', p.dateOfBirth ? fmtDate(p.dateOfBirth+'T00:00:00') : '')}
                ${row('Ngày cấp CCCD', p.idIssueDate ? fmtDate(p.idIssueDate+'T00:00:00') : '')}
                ${row('Nơi cấp CCCD', p.idIssuePlace)}
                ${row('Địa chỉ chi tiết', p.detailAddress)}
                ${row('Đơn vị tiếp nhận', p.receivingUnit)}
                ${row('Lĩnh vực', p.field)}
                ${row('Thủ tục', p.procedure)}
                ${row('Đơn vị hỗ trợ', p.supportUnit)}
                ${row('Dịch vụ công', p.publicService)}
                ${row('Người được ủy quyền', p.authorizedPerson)}
            </div>
        </div>
        <div class="detail-section">
            <div class="detail-section-title">👤 Người sử dụng đất</div>
            <div class="detail-grid">
                ${row('Họ và tên', p.landUserName)}
                ${row('Địa chỉ', p.landUserAddress, true)}
                ${row('Điện thoại', p.landUserPhone)}
            </div>
        </div>`;
    }

    if (p.bankName || p.accountNumber) {
        html += `
        <div class="detail-section">
            <div class="detail-section-title">🏦 Thông tin ngân hàng</div>
            <div class="detail-grid">
                ${row('Ngân hàng', p.bankName)}
                ${row('Số tài khoản', p.accountNumber)}
                ${row('Chủ tài khoản', p.accountHolder)}
            </div>
        </div>`;
    }

    html += `
        <div class="detail-section">
            <div class="detail-section-title">⚙️ Quản lý hồ sơ (Admin)</div>
            <div class="detail-grid">
                <div class="detail-item">
                    <div class="detail-label">Trạng thái xử lý</div>
                    <select class="status-select" id="editStatus">
                        <option value="pending" ${(p._status||'pending')==='pending'?'selected':''}>⏳ Chờ xử lý</option>
                        <option value="processing" ${p._status==='processing'?'selected':''}>🔄 Đang xử lý</option>
                        <option value="done" ${p._status==='done'?'selected':''}>✅ Hoàn thành</option>
                        <option value="rejected" ${p._status==='rejected'?'selected':''}>❌ Từ chối</option>
                    </select>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Ghi chú của Admin</div>
                    <textarea class="admin-note-input" id="editNote" placeholder="Nhập ghi chú xử lý hồ sơ...">${p.adminNote || ''}</textarea>
                </div>
            </div>
        </div>`;

    // === Inline QR section ===
    const qrUrl = buildProfileQRUrl(p);
    if (qrUrl) {
        html += `
        <div class="detail-section" style="border-top:2px solid #e8f5e9;">
            <div class="detail-section-title" style="color:#27ae60;">📲 Mã QR thanh toán hồ sơ</div>
            <div style="display:flex;gap:24px;align-items:flex-start;flex-wrap:wrap;padding:4px 0 8px;">
                <div style="text-align:center;flex-shrink:0;">
                    <img src="${qrUrl}" alt="QR Code" style="width:168px;height:168px;object-fit:contain;border-radius:12px;border:2px solid #27ae60;box-shadow:0 4px 16px rgba(39,174,96,0.18);">
                    <p style="font-size:11px;color:#888;margin:6px 0 0;">Quét để thanh toán phí hồ sơ</p>
                </div>
                <div style="flex:1;min-width:180px;">
                    <div style="font-size:13px;line-height:2.1;color:#444;background:#f8fffe;border:1px solid #d4edda;border-radius:8px;padding:10px 14px;margin-bottom:14px;">
                        <div><b>Mã hồ sơ:</b> <code style="background:#eee;padding:1px 6px;border-radius:4px;">${code}</code></div>
                        <div><b>Ngân hàng:</b> ${esc(p.bankName || '')}</div>
                        <div><b>Số tài khoản:</b> ${esc(p.accountNumber || '')}</div>
                        <div><b>Chủ tài khoản:</b> ${esc(p.accountHolder || '')}</div>
                    </div>
                    <div style="display:flex;gap:8px;flex-wrap:wrap;">
                        <button class="btn btn-success btn-sm" onclick="publishProfileQR('${p.id}','${p._source}')">📢 Đăng QR lên trang chủ</button>
                        <button class="btn btn-secondary btn-sm" onclick="openQRFromProfile()">✏️ Chỉnh sửa QR</button>
                    </div>
                </div>
            </div>
        </div>`;
    } else if (p._source === 'main') {
        html += `
        <div class="detail-section" style="border-top:2px solid #ffeeba;">
            <div class="detail-section-title" style="color:#856404;">📲 Mã QR thanh toán hồ sơ</div>
            <div style="background:#fff8e1;border:1px solid #ffeeba;border-radius:8px;padding:14px 16px;font-size:13px;color:#856404;">
                ⚠️ Hồ sơ này chưa có thông tin ngân hàng. Người nộp hồ sơ cần cung cấp số tài khoản để tạo QR thanh toán.
            </div>
        </div>`;
    }

    document.getElementById('modalDetailBody').innerHTML = html;
    openModal('modalDetail');
}

async function saveProfileDetail() {
    if (!currentDetailId) return;
    const { id, source } = currentDetailId;
    const status = document.getElementById('editStatus').value;
    const note = document.getElementById('editNote').value;
    if (source === 'dvc') {
        await saveDVCStatus(id, status, note);
        await loadAllDVC(); renderDVCTable();
    } else if (source === 'nhadat') {
        await saveNhaDatStatus(id, status, note);
        await loadAllNhaDat(); renderNhaDatTable();
    } else {
        const p = allProfiles.find(x => x.id === id && x._source === source);
        if (!p) return;
        p._status = status;
        p.adminNote = note;
        await saveProfile(p);
        await loadAllProfiles();
        renderFilteredTable();
        renderDashboardTable();
    }
    renderStats();
    closeModal('modalDetail');
    toast('✅ Đã lưu thông tin hồ sơ!', 'success');
}

function openQRFromProfile() {
    if (!currentDetailId) return;
    const { id, source } = currentDetailId;
    const p = allProfiles.find(x => x.id === id && x._source === source);
    if (!p) return;
    closeModal('modalDetail');
    showTab('qrmanager', document.querySelector('.sidebar-nav a:nth-child(3)'));
    const code = generateFileCode(p);
    if (p.bankName) {
        const bid = BANK_MAP[p.bankName] || '';
        if (bid) document.getElementById('qrBank').value = bid;
        if (p.accountNumber) document.getElementById('qrAccount').value = p.accountNumber;
        if (p.accountHolder) document.getElementById('qrAccountName').value = p.accountHolder;
    }
    document.getElementById('qrFileCode').value = code;
    document.getElementById('qrNote').value = `Phi dich vu ho so ${code}`;
    document.getElementById('qrTitle').value = `Thanh toán phí hồ sơ: ${p.fullName || p.applicantName || ''}`;
    // Tự động xem trước QR ngay sau khi điền form
    if (p.bankName && p.accountNumber && p.accountHolder) {
        setTimeout(previewQR, 100);
    }
}

// Mở QR tab nhanh từ nút trên bảng (không cần mở detail trước)
function quickOpenQR(id, source) {
    const p = allProfiles.find(x => x.id === id && x._source === source);
    if (!p) return;
    currentDetailId = { id, source };
    openQRFromProfile();
}

// ===== DELETE =====
function openDelete(id, source, name) {
    deleteTargetId = { id, source };
    document.getElementById('deleteProfileName').textContent = name;
    openModal('modalDelete');
}

async function confirmDelete() {
    if (!deleteTargetId) return;
    await deleteProfile(deleteTargetId.id, deleteTargetId.source);
    await loadAllProfiles();
    renderStats();
    renderDashboardTable();
    applyFilters();
    closeModal('modalDelete');
    deleteTargetId = null;
    toast('🗑 Đã xóa hồ sơ!', 'success');
}

async function clearAllProfiles() {
    if (!confirm('Bạn có chắc chắn muốn xóa TẤT CẢ hồ sơ? Hành động này không thể hoàn tác!')) return;
    await StorageAPI.clearAllAppointments();
    await loadAllProfiles();
    renderStats();
    renderDashboardTable();
    applyFilters();
    toast('🗑 Đã xóa tất cả hồ sơ!', 'error');
}

// ===== DVC REGISTRATIONS =====
async function loadAllDVC() {
    try {
        const res = await fetch('/api/admin/dichvucong?limit=999', { headers: getAuthHeaders() });
        const json = await res.json();
        dvcData = (json.data || []).map(p => ({ ...p, _status: p.status || 'pending' }));
        return dvcData;
    } catch (e) { dvcData = []; return []; }
}

function getFormData(p) {
    try { return p.formData ? JSON.parse(p.formData) : {}; } catch(e) { return {}; }
}
function dvcServiceLabel(p) {
    const svc = p.serviceType || getFormData(p).dvcService || '—';
    const labels = {'1':'Cấp đổi GCN','2':'Đăng ký QSDĐ','3':'Chuyển nhượng','4':'Thừa kế','5':'Tách thửa','6':'Hợp thửa'};
    return labels[svc] || svc;
}
function renderDVCTable() {
    const search = (document.getElementById('filterDVCSearch')?.value || '').toLowerCase();
    const status = document.getElementById('filterDVCStatus')?.value || '';
    let data = dvcData.filter(p => {
        const matchSearch = !search || (p.fullName||'').toLowerCase().includes(search) || (p.idNumber||'').includes(search) || (p.phone||'').includes(search) || (p.id||'').toLowerCase().includes(search);
        const matchStatus = !status || p.status === status;
        return matchSearch && matchStatus;
    });
    const total = data.length;
    const start = (dvcPage - 1) * PER_PAGE;
    const page = data.slice(start, start + PER_PAGE);
    const tbody = document.getElementById('dVCTable');
    if (!page.length) {
        tbody.innerHTML = '<tr><td colspan="9" class="empty-table"><div class="empty-icon">📭</div><p>Không tìm thấy hồ sơ</p></td></tr>';
    } else {
        tbody.innerHTML = page.map((p, i) => `
            <tr>
                <td style="color:#aaa;font-size:12px;">${start + i + 1}</td>
                <td><code style="font-size:11px;background:#f5f5f5;padding:2px 6px;border-radius:4px;">${esc(p.id || '—')}</code></td>
                <td><strong>${esc(p.fullName || '—')}</strong></td>
                <td>${esc(p.idNumber || '—')}</td>
                <td>${esc(p.phone || '—')}</td>
                <td><span style="font-size:11px;background:#e8f5e9;padding:2px 8px;border-radius:10px;">${esc(dvcServiceLabel(p))}</span></td>
                <td>${fmtDate(p.createdAt)}</td>
                <td>${statusBadge(p.status)}</td>
                <td>
                    <div class="action-btns">
                        <button class="btn btn-secondary btn-xs" onclick="openDVCDetail('${p.id}')">👁 Xem</button>
                        <button class="btn btn-danger btn-xs" onclick="deleteDVC('${p.id}')">🗑</button>
                    </div>
                </td>
            </tr>
        `).join('');
    }
    const pages = Math.ceil(total / PER_PAGE);
    const pel = document.getElementById('dvcPagination');
    if (pages <= 1) { pel.innerHTML = ''; return; }
    let html = `<span class="page-info">Tổng ${total} hồ sơ</span>`;
    html += `<button class="page-btn" onclick="dvcPage=${Math.max(1,dvcPage-1)};renderDVCTable()" ${dvcPage===1?'disabled':''}>‹</button>`;
    for (let i = 1; i <= pages; i++) {
        html += `<button class="page-btn ${i===dvcPage?'active':''}" onclick="dvcPage=${i};renderDVCTable()">${i}</button>`;
    }
    html += `<button class="page-btn" onclick="dvcPage=${Math.min(pages,dvcPage+1)};renderDVCTable()" ${dvcPage===pages?'disabled':''}>›</button>`;
    pel.innerHTML = html;
}

function openDVCDetail(id) {
    const p = dvcData.find(x => x.id === id);
    if (!p) return;
    currentDetailId = { id, source: 'dvc' };
    document.getElementById('modalDetailTitle').textContent = `📄 Hồ sơ DVC: ${p.id}`;
    const val = (v) => v ? esc(v) : '<span class="detail-value empty">Chưa có</span>';
    const row = (label, value, full = false) => `<div class="detail-item ${full?'detail-full':''}"><div class="detail-label">${label}</div><div class="detail-value">${val(value)}</div></div>`;
    const fd = getFormData(p);
    let html = `
        <div class="detail-section"><div class="detail-section-title">🔑 Thông tin hồ sơ</div><div class="detail-grid">
            ${row('Mã hồ sơ', p.id)}
            ${row('Ngày nộp', fmtDate(p.createdAt))}
        </div></div>
        <div class="detail-section"><div class="detail-section-title">👤 Thông tin người nộp</div><div class="detail-grid">
            ${row('Họ và tên', p.fullName)}
            ${row('Ngày sinh', p.dateOfBirth ? fmtDate(p.dateOfBirth+'T00:00:00') : '')}
            ${row('CMND/CCCD', p.idNumber)}
            ${row('Ngày cấp', fd.identityIssueDate || '')}
            ${row('Nơi cấp', fd.identityIssuePlace || '')}
            ${row('Điện thoại', p.phone)}
            ${row('Email', p.email)}
            ${row('Tỉnh/TP', fd.province || '')}
            ${row('Địa chỉ chi tiết', p.address || fd.detailAddress || '')}
            ${row('Ủy quyền', fd.isAuthorized || '')}
        </div></div>
        <div class="detail-section"><div class="detail-section-title">📋 Thông tin chung</div><div class="detail-grid">
            ${row('Đơn vị tiếp nhận', fd.receivingUnit || '')}
            ${row('Đơn vị hỗ trợ', fd.supportUnit || '')}
            ${row('Lĩnh vực', fd.field || '')}
            ${row('Thủ tục', fd.procedure || '')}
            ${row('Dịch vụ công', fd.dvcService || '')}
        </div></div>
        <div class="detail-section"><div class="detail-section-title">👤 Người sử dụng đất</div><div class="detail-grid">
            ${row('Tên', fd.landUserName || '')}
            ${row('Địa chỉ', fd.landUserAddress || '')}
            ${row('Điện thoại', fd.landUserPhone || '')}
        </div></div>
        <div class="detail-section"><div class="detail-section-title">🏦 Ngân hàng khai báo thuế</div><div class="detail-grid">
            ${row('Ngân hàng', fd.bankName || '')}
            ${row('Số tài khoản', fd.accountNumber || '')}
            ${row('Chủ tài khoản', fd.accountName || '')}
        </div></div>
        <div class="detail-section"><div class="detail-section-title">⚙️ Quản lý hồ sơ</div><div class="detail-grid">
            <div class="detail-item"><div class="detail-label">Trạng thái</div><select class="status-select" id="editStatus">
                <option value="pending" ${(p.status||'pending')==='pending'?'selected':''}>⏳ Chờ xử lý</option>
                <option value="processing" ${p.status==='processing'?'selected':''}>🔄 Đang xử lý</option>
                <option value="done" ${p.status==='done'?'selected':''}>✅ Hoàn thành</option>
                <option value="rejected" ${p.status==='rejected'?'selected':''}>❌ Từ chối</option>
            </select></div>
            <div class="detail-item"><div class="detail-label">Ghi chú Admin</div>
                <textarea class="admin-note-input" id="editNote" placeholder="Nhập ghi chú...">${p.adminNote || ''}</textarea>
            </div>
        </div></div>`;
    document.getElementById('modalDetailBody').innerHTML = html;
    openModal('modalDetail');
}

async function saveDVCStatus(id, status, note) {
    await fetch('/api/admin/dichvucong/' + id, { method: 'PATCH', headers: getAuthHeaders(), body: JSON.stringify({ status, adminNote: note }) });
}

async function deleteDVC(id) {
    if (!confirm('Xóa hồ sơ DVC này?')) return;
    await fetch('/api/admin/dichvucong/' + id, { method: 'DELETE', headers: getAuthHeaders() });
    await loadAllDVC(); renderDVCTable();
    toast('🗑 Đã xóa hồ sơ DVC!', 'success');
}

// ===== NHA DAT REGISTRATIONS =====
async function loadAllNhaDat() {
    try {
        const res = await fetch('/api/admin/nhadat?limit=999', { headers: getAuthHeaders() });
        const json = await res.json();
        nhadatData = (json.data || []).map(p => ({ ...p, _status: p.status || 'pending' }));
        return nhadatData;
    } catch (e) { nhadatData = []; return []; }
}

function renderNhaDatTable() {
    const search = (document.getElementById('filterNhaDatSearch')?.value || '').toLowerCase();
    const status = document.getElementById('filterNhaDatStatus')?.value || '';
    let data = nhadatData.filter(p => {
        const matchSearch = !search || (p.applicantName||'').toLowerCase().includes(search) || (p.idNumber||'').includes(search) || (p.phone||'').includes(search) || (p.id||'').toLowerCase().includes(search);
        const matchStatus = !status || p.status === status;
        return matchSearch && matchStatus;
    });
    const total = data.length;
    const start = (nhadatPage - 1) * PER_PAGE;
    const page = data.slice(start, start + PER_PAGE);
    const tbody = document.getElementById('nhaDatTable');
    if (!page.length) {
        tbody.innerHTML = '<tr><td colspan="9" class="empty-table"><div class="empty-icon">📭</div><p>Không tìm thấy hồ sơ</p></td></tr>';
    } else {
        tbody.innerHTML = page.map((p, i) => `
            <tr>
                <td style="color:#aaa;font-size:12px;">${start + i + 1}</td>
                <td><code style="font-size:11px;background:#f5f5f5;padding:2px 6px;border-radius:4px;">${esc(p.id || '—')}</code></td>
                <td><strong>${esc(p.applicantName || '—')}</strong></td>
                <td>${esc(p.idNumber || '—')}</td>
                <td>${esc(p.phone || '—')}</td>
                <td><span style="font-size:11px;background:#fff3cd;padding:2px 8px;border-radius:10px;">${esc(p.field || '—')}</span></td>
                <td>${fmtDate(p.createdAt)}</td>
                <td>${statusBadge(p.status)}</td>
                <td>
                    <div class="action-btns">
                        <button class="btn btn-secondary btn-xs" onclick="openNhaDatDetail('${p.id}')">👁 Xem</button>
                        <button class="btn btn-danger btn-xs" onclick="deleteNhaDat('${p.id}')">🗑</button>
                    </div>
                </td>
            </tr>
        `).join('');
    }
    const pages = Math.ceil(total / PER_PAGE);
    const pel = document.getElementById('nhadatPagination');
    if (pages <= 1) { pel.innerHTML = ''; return; }
    let html = `<span class="page-info">Tổng ${total} hồ sơ</span>`;
    html += `<button class="page-btn" onclick="nhadatPage=${Math.max(1,nhadatPage-1)};renderNhaDatTable()" ${nhadatPage===1?'disabled':''}>‹</button>`;
    for (let i = 1; i <= pages; i++) {
        html += `<button class="page-btn ${i===nhadatPage?'active':''}" onclick="nhadatPage=${i};renderNhaDatTable()">${i}</button>`;
    }
    html += `<button class="page-btn" onclick="nhadatPage=${Math.min(pages,nhadatPage+1)};renderNhaDatTable()" ${nhadatPage===pages?'disabled':''}>›</button>`;
    pel.innerHTML = html;
}

function openNhaDatDetail(id) {
    const p = nhadatData.find(x => x.id === id);
    if (!p) return;
    currentDetailId = { id, source: 'nhadat' };
    document.getElementById('modalDetailTitle').textContent = `📄 Hồ sơ Nhà đất: ${p.id}`;
    const val = (v) => v ? esc(v) : '<span class="detail-value empty">Chưa có</span>';
    const row = (label, value, full = false) => `<div class="detail-item ${full?'detail-full':''}"><div class="detail-label">${label}</div><div class="detail-value">${val(value)}</div></div>`;
    let html = `
        <div class="detail-section"><div class="detail-section-title">🔑 Thông tin hồ sơ</div><div class="detail-grid">
            ${row('Mã hồ sơ', p.id)} ${row('Ngày nộp', fmtDate(p.createdAt))}
        </div></div>
        <div class="detail-section"><div class="detail-section-title">👤 Người nộp</div><div class="detail-grid">
            ${row('Họ và tên', p.applicantName)} ${row('Ngày sinh', p.dateOfBirth ? fmtDate(p.dateOfBirth+'T00:00:00') : '')}
            ${row('CCCD', p.idNumber)} ${row('Ngày cấp', p.idIssueDate ? fmtDate(p.idIssueDate+'T00:00:00') : '')}
            ${row('Nơi cấp', p.idIssuePlace)} ${row('Điện thoại', p.phone)}
            ${row('Tỉnh', p.province)} ${row('Địa chỉ', p.detailAddress)}
        </div></div>
        <div class="detail-section"><div class="detail-section-title">📋 Chi tiết</div><div class="detail-grid">
            ${row('Đơn vị tiếp nhận', p.receivingUnit)} ${row('Đơn vị hỗ trợ', p.supportUnit)}
            ${row('Lĩnh vực', p.field)} ${row('Thủ tục', p.procedure)}
            ${row('Dịch vụ công', p.publicService)} ${row('Người ủy quyền', p.authorizedPerson)}
        </div></div>
        <div class="detail-section"><div class="detail-section-title">👤 Người SD đất</div><div class="detail-grid">
            ${row('Họ tên', p.landUserName)} ${row('Địa chỉ', p.landUserAddress, true)}
            ${row('Điện thoại', p.landUserPhone)}
        </div></div>
        <div class="detail-section"><div class="detail-section-title">🏦 Ngân hàng</div><div class="detail-grid">
            ${row('Ngân hàng', p.bankName)} ${row('Số TK', p.accountNumber)} ${row('Chủ TK', p.accountHolder)}
        </div></div>
        <div class="detail-section"><div class="detail-section-title">⚙️ Quản lý</div><div class="detail-grid">
            <div class="detail-item"><div class="detail-label">Trạng thái</div><select class="status-select" id="editStatus">
                <option value="pending" ${(p.status||'pending')==='pending'?'selected':''}>⏳ Chờ xử lý</option>
                <option value="processing" ${p.status==='processing'?'selected':''}>🔄 Đang xử lý</option>
                <option value="done" ${p.status==='done'?'selected':''}>✅ Hoàn thành</option>
                <option value="rejected" ${p.status==='rejected'?'selected':''}>❌ Từ chối</option>
            </select></div>
            <div class="detail-item"><div class="detail-label">Ghi chú</div>
                <textarea class="admin-note-input" id="editNote" placeholder="Nhập ghi chú...">${p.adminNote || ''}</textarea>
            </div>
        </div></div>`;
    document.getElementById('modalDetailBody').innerHTML = html;
    openModal('modalDetail');
}

async function saveNhaDatStatus(id, status, note) {
    await fetch('/api/admin/nhadat/' + id, { method: 'PATCH', headers: getAuthHeaders(), body: JSON.stringify({ status, adminNote: note }) });
}

async function deleteNhaDat(id) {
    if (!confirm('Xóa hồ sơ nhà đất này?')) return;
    await fetch('/api/admin/nhadat/' + id, { method: 'DELETE', headers: getAuthHeaders() });
    await loadAllNhaDat(); renderNhaDatTable();
    toast('🗑 Đã xóa hồ sơ nhà đất!', 'success');
}

// ===== CHAT NOTIFICATIONS =====
var lastChatCount = 0;
var chatSoundEnabled = true;
var originalTitle = document.title;

function playChatSound() {
  if (!chatSoundEnabled) return;
  try {
    var actx = new (window.AudioContext || window.webkitAudioContext)();
    var osc = actx.createOscillator();
    var gain = actx.createGain();
    osc.connect(gain);
    gain.connect(actx.destination);
    osc.frequency.value = 880;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.3, actx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, actx.currentTime + 0.3);
    osc.start(actx.currentTime);
    osc.stop(actx.currentTime + 0.3);

    var osc2 = actx.createOscillator();
    var gain2 = actx.createGain();
    osc2.connect(gain2);
    gain2.connect(actx.destination);
    osc2.frequency.value = 1100;
    osc2.type = 'sine';
    gain2.gain.setValueAtTime(0.2, actx.currentTime + 0.15);
    gain2.gain.exponentialRampToValueAtTime(0.01, actx.currentTime + 0.45);
    osc2.start(actx.currentTime + 0.15);
    osc2.stop(actx.currentTime + 0.45);
  } catch(e) {}
}

function showBrowserNotification(title, body) {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'granted') {
    try {
      var n = new Notification(title, { body: body, icon: '/p/home/img/header/quoc_huy.png', tag: 'chat' });
      setTimeout(function() { n.close(); }, 5000);
    } catch(e) {}
  } else if (Notification.permission !== 'denied') {
    Notification.requestPermission();
  }
}

function flashTitle(count) {
  if (count > 0 && !document.hasFocus()) {
    var interval = setInterval(function() {
      document.title = document.hasFocus() ? originalTitle : '(' + count + ') Tin nhắn mới - ' + originalTitle;
    }, 2000);
    document.addEventListener('visibilitychange', function handler() {
      if (document.hasFocus()) {
        document.title = originalTitle;
        clearInterval(interval);
        document.removeEventListener('visibilitychange', handler);
      }
    }, { once: true });
  }
}

function toggleChatSound() {
    chatSoundEnabled = !chatSoundEnabled;
    var btn = document.getElementById('chatSoundBtn');
    if (btn) btn.innerHTML = chatSoundEnabled ? '<i class="fa fa-bell"></i> \u00C2m thanh' : '<i class="fa fa-bell-slash"></i> T\u1EAFt \u00E2m thanh';
    localStorage.setItem('chatSoundEnabled', chatSoundEnabled ? '1' : '0');
}

(function initChatSound() {
    chatSoundEnabled = localStorage.getItem('chatSoundEnabled') !== '0';
    var btn = document.getElementById('chatSoundBtn');
    if (btn) btn.innerHTML = chatSoundEnabled ? '<i class="fa fa-bell"></i> \u00C2m thanh' : '<i class="fa fa-bell-slash"></i> T\u1EAFt \u00E2m thanh';
})();

// ===== CHAT SUPPORT =====
function timeAgo(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const now = new Date();
    const diff = Math.floor((now - d) / 1000);
    if (diff < 60) return 'Vừa xong';
    if (diff < 3600) return Math.floor(diff / 60) + ' phút trước';
    if (diff < 86400) return Math.floor(diff / 3600) + ' giờ trước';
    return fmtDate(dateStr);
}

function chatAvatar(name, isAdmin) {
    const c = isAdmin ? '#1a252f' : '#CE7A58';
    const initial = (name || (isAdmin ? 'A' : 'N')).charAt(0).toUpperCase();
    return `<div class="chat-msg-avatar" style="background:${c}">${initial}</div>`;
}

function parseUserSender(sender) {
    if (!sender) return { isAdmin: false, name: 'Người dùng', phone: '' };
    if (sender === 'admin') return { isAdmin: true, name: 'Admin', phone: '' };
    if (sender.startsWith('user:')) return { isAdmin: false, name: sender.substring(5), phone: '' };
    return { isAdmin: false, name: 'Người dùng', phone: '' };
}

function updateChatSidebarBadge(count) {
    var chatNav = document.querySelector('.sidebar-nav a[onclick*="chat"]');
    if (!chatNav) return;
    var existing = chatNav.querySelector('.sidebar-chat-badge');
    if (existing) existing.remove();
    if (count > 0) {
        var badge = document.createElement('span');
        badge.className = 'sidebar-chat-badge';
        badge.textContent = count > 99 ? '99+' : count;
        chatNav.appendChild(badge);
    }
}

var _selectedSessionId = null;
var _allSessions = [];

async function loadSessions() {
    try {
        var res = await fetch('/api/chat/sessions', { headers: getAuthHeaders() });
        var json = await res.json();
        _allSessions = json.sessions || [];
        renderSessionList(_allSessions);
        updateChatSidebarBadge(_allSessions.reduce(function(sum, s) { return sum + s.unread; }, 0));
    } catch(e) {}
}

function renderSessionList(sessions) {
    var container = document.getElementById('chatSessionItems');
    if (!container) return;
    if (sessions.length === 0) {
        container.innerHTML = '<div style="padding:20px;text-align:center;color:#999;font-size:13px;">Ch\u01B0a c\u00F3 h\u1ED9i tho\u1EA1i n\u00E0o</div>';
        return;
    }
    container.innerHTML = sessions.map(function(s) {
        var active = s.sessionId === _selectedSessionId ? ' active' : '';
        var avatarLetter = (s.name || 'N').charAt(0).toUpperCase();
        var unreadHtml = s.unread > 0 ? '<span class="chat-session-unread">' + (s.unread > 99 ? '99+' : s.unread) + '</span>' : '';
        var phoneHtml = s.phone ? '<span class="chat-session-phone"><i class="fa fa-phone"></i> ' + esc(s.phone) + '</span>' : '';
        var timeHtml = s.lastTime ? '<span class="chat-session-time">' + timeAgo(s.lastTime) + '</span>' : '';
        var lastMsg = s.lastMessage || 'Ch\u01B0a c\u00F3 tin nh\u1EAFn';
        return '<div class="chat-session-item' + active + '" onclick="selectSession(\'' + esc(s.sessionId) + '\')">' +
            '<div class="chat-session-avatar">' + avatarLetter + '</div>' +
            '<div class="chat-session-info">' +
            '<div class="chat-session-name">' + esc(s.name) + ' ' + phoneHtml + '</div>' +
            '<div class="chat-session-preview">' + esc(lastMsg.length > 50 ? lastMsg.slice(0, 50) + '...' : lastMsg) + '</div>' +
            '</div>' +
            timeHtml +
            unreadHtml +
            '</div>';
    }).join('');
}

function filterSessions(query) {
    var q = query.toLowerCase().trim();
    if (!q) { renderSessionList(_allSessions); return; }
    var filtered = _allSessions.filter(function(s) {
        return (s.name && s.name.toLowerCase().includes(q)) ||
               (s.phone && s.phone.includes(q)) ||
               (s.lastMessage && s.lastMessage.toLowerCase().includes(q));
    });
    renderSessionList(filtered);
}

function selectSession(sessionId) {
    _selectedSessionId = sessionId;
    var container = document.getElementById('chatMessages');
    var inputArea = document.getElementById('chatInputArea');
    var headerTitle = document.getElementById('chatHeaderTitle');
    if (container) container.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#999;font-size:14px;"><i class="fa fa-spinner fa-spin"></i> \u0110ang t\u1EA3i...</div>';
    renderSessionList(_allSessions);
    var session = _allSessions.find(function(s) { return s.sessionId === sessionId; });
    if (session) {
        var phoneHtml = session.phone ? ' <span style="font-size:13px;font-weight:400;color:rgba(255,255,255,0.8);"><i class="fa fa-phone"></i> ' + esc(session.phone) + '</span>' : '';
        if (headerTitle) headerTitle.innerHTML = '<i class="fa fa-comments"></i> <strong>' + esc(session.name) + '</strong>' + phoneHtml;
    }
    if (inputArea) inputArea.style.display = 'flex';
    fetchMessagesForSession(sessionId);
}

async function fetchMessagesForSession(sessionId) {
    try {
        var res = await fetch('/api/chat/?sessionId=' + encodeURIComponent(sessionId), { headers: getAuthHeaders() });
        var json = await res.json();
        var msgs = json.messages || [];
        var container = document.getElementById('chatMessages');
        if (!container) return;
        if (msgs.length === 0) {
            container.innerHTML = '<div class="chat-empty">Ch\u01B0a c\u00F3 tin nh\u1EAFn trong h\u1ED9i tho\u1EA1i n\u00E0y</div>';
            return;
        }
        container.innerHTML = msgs.map(function(m) {
            var info = parseUserSender(m.sender);
            var isAdmin = info.isAdmin;
            var name = info.name;
            var phoneTxt = m.userPhone ? ' &middot; <i class="fa fa-phone"></i> ' + esc(m.userPhone) : '';
            var fileHtml = '';
            if (m.fileUrl) {
                var fpath = m.fileUrl;
                if (m.fileType === 'image') {
                    fileHtml = '<div class="chat-msg-file"><img src="' + fpath + '" alt="' + esc(m.fileName || '') + '" loading="lazy" onclick="window.open(this.src)"></div>';
                } else if (m.fileType === 'video') {
                    fileHtml = '<div class="chat-msg-file"><video controls preload="metadata"><source src="' + fpath + '" type="video/mp4">' + esc(m.fileName || '') + '</video></div>';
                } else {
                    var icon = m.fileType === 'pdf' ? '<i class="fa fa-file-pdf-o"></i>' : '<i class="fa fa-paperclip"></i>';
                    fileHtml = '<div class="chat-msg-file"><a href="' + fpath + '" target="_blank" download>' + icon + ' ' + esc(m.fileName || 'T\u1EA3i file') + '</a></div>';
                }
            }
            var msgTxt = m.message ? '<div class="chat-msg-text">' + esc(m.message) + '</div>' : '';
            return '<div class="chat-msg ' + (isAdmin ? 'chat-admin' : 'chat-user') + '">' +
                chatAvatar(name, isAdmin) +
                '<div class="chat-msg-body">' +
                '<div class="chat-msg-sender">' + esc(name) + phoneTxt + '</div>' +
                '<div class="chat-msg-content">' + msgTxt + fileHtml + '</div>' +
                '<div class="chat-msg-time">' + timeAgo(m.createdAt) + '</div>' +
                '</div></div>';
        }).join('');
        container.scrollTop = container.scrollHeight;

        msgs.filter(function(m) { return !m.isRead && m.sender !== 'admin'; }).forEach(function(m) {
            fetch('/api/chat/' + m.id + '/read', { method: 'PATCH', headers: getAuthHeaders() });
        });
    } catch(e) {}
}

async function refreshChat() {
    try {
        await loadSessions();
        if (_selectedSessionId) {
            var sessionStillExists = _allSessions.some(function(s) { return s.sessionId === _selectedSessionId; });
            if (sessionStillExists) {
                await fetchMessagesForSession(_selectedSessionId);
            } else {
                _selectedSessionId = null;
                var container = document.getElementById('chatMessages');
                var inputArea = document.getElementById('chatInputArea');
                var headerTitle = document.getElementById('chatHeaderTitle');
                if (container) container.innerHTML = '<div class="chat-empty">Ch\u1ECDn m\u1ED9t h\u1ED9i tho\u1EA1i b\u00EAn tr\u00E1i \u0111\u1EC3 b\u1EAFt \u0111\u1EA7u</div>';
                if (inputArea) inputArea.style.display = 'none';
                if (headerTitle) headerTitle.innerHTML = '<i class="fa fa-comments"></i> <strong>Ch\u1ECDn h\u1ED9i tho\u1EA1i</strong>';
            }
        }
        var tabChat = document.getElementById('tab-chat');
        var isChatOpen = tabChat && tabChat.style.display !== 'none';
        if (isChatOpen && _allSessions.length > 0) {
            var hasNewUnread = _allSessions.some(function(s) { return s.unread > 0; });
            if (hasNewUnread) {
                // Just flash title, no sound to avoid spam
            }
        }
    } catch(e) {}
}

var pendingChatFile = null;

async function sendChatReply() {
    var input = document.getElementById('chatInput');
    var msg = input.value.trim();
    if (!msg && !pendingChatFile) return;
    if (!_selectedSessionId) { toast('Vui l\u00F2ng ch\u1ECDn h\u1ED9i tho\u1EA1i!', 'error'); return; }
    var body = { sender: 'admin', message: msg || '', sessionId: _selectedSessionId };
    if (pendingChatFile) {
        body.fileUrl = pendingChatFile.fileUrl;
        body.fileType = pendingChatFile.fileType;
        body.fileName = pendingChatFile.fileName;
    }
    try {
        await fetch('/api/chat/', {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(body)
        });
        input.value = '';
        clearChatFile();
        await refreshChat();
    } catch(e) { toast('L\u1ED7i g\u1EEDi tin nh\u1EAFn!', 'error'); }
}

async function sendChatFile(input) {
    var file = input.files[0];
    if (!file) return;
    var maxSize = 50 * 1024 * 1024;
    if (file.size > maxSize) { toast('File qu\u00E1 l\u1EDBn! T\u1ED1i \u0111a 50MB.', 'error'); input.value = ''; return; }
    var formData = new FormData();
    formData.append('file', file);
    try {
        var res = await fetch('/api/chat/upload', { method: 'POST', headers: getAuthHeaders(), body: formData });
        var json = await res.json();
        if (json.status === 'ok') {
            pendingChatFile = json.data;
            var preview = document.getElementById('chatFilePreview');
            var nameSpan = document.getElementById('chatFilePreviewName');
            if (preview && nameSpan) {
                nameSpan.innerHTML = '<i class="fa fa-paperclip"></i> ' + esc(file.name);
                preview.style.display = 'flex';
            }
            input.value = '';
        } else {
            toast('L\u1ED7i upload!', 'error');
        }
    } catch(e) { toast('L\u1ED7i upload file!', 'error'); }
}

function clearChatFile() {
    pendingChatFile = null;
    var preview = document.getElementById('chatFilePreview');
    if (preview) preview.style.display = 'none';
    var fileInput = document.getElementById('chatFileInput');
    if (fileInput) fileInput.value = '';
}

// Drag-drop for chat
function initChatDragDrop() {
    var area = document.getElementById('chatContainer');
    if (!area) return;
    area.addEventListener('dragover', function(e) { e.preventDefault(); area.style.borderColor = '#CE7A58'; });
    area.addEventListener('dragleave', function(e) { e.preventDefault(); area.style.borderColor = '#e0e0e0'; });
    area.addEventListener('drop', function(e) {
        e.preventDefault();
        area.style.borderColor = '#e0e0e0';
        var files = e.dataTransfer.files;
        if (files.length) {
            var fileInput = document.getElementById('chatFileInput');
            if (fileInput) {
                fileInput.files = files;
                sendChatFile(fileInput);
            }
        }
    });
}

// Paste image from clipboard
function initChatPaste() {
    var input = document.getElementById('chatInput');
    if (!input) return;
    input.addEventListener('paste', function(e) {
        var items = e.clipboardData.items;
        for (var i = 0; i < items.length; i++) {
            if (items[i].type && items[i].type.startsWith('image/')) {
                var file = items[i].getAsFile();
                if (file) {
                    var fileInput = document.getElementById('chatFileInput');
                    if (fileInput) {
                        var dt = new DataTransfer();
                        dt.items.add(file);
                        fileInput.files = dt.files;
                        sendChatFile(fileInput);
                    }
                }
                break;
            }
        }
    });
}

initChatDragDrop();
initChatPaste();

async function clearChat() {
    if (!confirm('Xóa tất cả tin nhắn chat?')) return;
    try {
        await fetch('/api/chat/all', { method: 'DELETE', headers: getAuthHeaders() });
        _selectedSessionId = null;
        _allSessions = [];
        var container = document.getElementById('chatMessages');
        var inputArea = document.getElementById('chatInputArea');
        var headerTitle = document.getElementById('chatHeaderTitle');
        if (container) container.innerHTML = '<div class="chat-empty">Ch\u1ECDn m\u1ED9t h\u1ED9i tho\u1EA1i b\u00EAn tr\u00E1i \u0111\u1EC3 b\u1EAFt \u0111\u1EA7u</div>';
        if (inputArea) inputArea.style.display = 'none';
        if (headerTitle) headerTitle.innerHTML = '<i class="fa fa-comments"></i> <strong>Ch\u1ECDn h\u1ED9i tho\u1EA1i</strong>';
        refreshChat();
        toast('\u0110\u00E3 x\u00F3a tin nh\u1EAFn!', 'success');
    } catch(e) { toast('L\u1ED7i x\u00F3a!', 'error'); }
}

// ===== EXPORT DVC / NHADAT =====
function exportDVC() {
    if (!dvcData.length) { toast('⚠️ Không có dữ liệu!', 'error'); return; }
    const headers = ['Mã hồ sơ', 'Họ tên', 'CCCD', 'Điện thoại', 'Email', 'Dịch vụ', 'Mục đích', 'Trạng thái', 'Ghi chú', 'Ngày nộp'];
    const rows = dvcData.map(p => [p.id, p.fullName, p.idNumber, p.phone, p.email, p.serviceType, p.purpose, p.status, p.adminNote, p.createdAt].map(v => `"${String(v||'').replace(/"/g,'""')}"`).join(','));
    const csv = '\uFEFF' + [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `dvc-${new Date().toISOString().slice(0,10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
    toast('⬇ Đã xuất DVC!', 'success');
}

function exportNhaDat() {
    if (!nhadatData.length) { toast('⚠️ Không có dữ liệu!', 'error'); return; }
    const headers = ['Mã hồ sơ', 'Người nộp', 'CCCD', 'Điện thoại', 'Lĩnh vực', 'Thủ tục', 'Địa chỉ', 'Trạng thái', 'Ghi chú', 'Ngày nộp'];
    const rows = nhadatData.map(p => [p.id, p.applicantName, p.idNumber, p.phone, p.field, p.procedure, p.detailAddress, p.status, p.adminNote, p.createdAt].map(v => `"${String(v||'').replace(/"/g,'""')}"`).join(','));
    const csv = '\uFEFF' + [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `nhadat-${new Date().toISOString().slice(0,10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
    toast('⬇ Đã xuất Nhà đất!', 'success');
}

// ===== QR =====
// Map tên ngân hàng → mã VietQR
const BANK_MAP = {
    'Vietcombank':'VCB','BIDV':'BIDV','VietinBank':'ICB','Agribank':'VBAAGRIBANK',
    'Techcombank':'TCB','MBBank':'MB','TPBank':'TPBANK','ACB':'ACB',
    'VPBank':'VPB','Sacombank':'STB','HDBank':'HDB','SHB':'SHB',
    'OCB':'OCB','MSB':'MSB','SeABank':'SEABANK','Eximbank':'EXIMBANK',
    'ABBank':'ABBANK','BacABank':'BACABANK','NamABank':'NAMABANK'
};

// Tạo QR URL từ form admin
function buildQRUrl() {
    const bank = document.getElementById('qrBank').value;
    const account = document.getElementById('qrAccount').value.trim();
    const name = document.getElementById('qrAccountName').value.trim();
    const amount = document.getElementById('qrAmount').value;
    const note = document.getElementById('qrNote').value.trim();
    if (!bank || !account || !name) return null;
    let url = `https://img.vietqr.io/image/${bank}-${account}-compact2.png?accountName=${encodeURIComponent(name)}`;
    if (amount) url += `&amount=${amount}`;
    if (note) url += `&addInfo=${encodeURIComponent(note)}`;
    return url;
}

// Tạo QR URL trực tiếp từ hồ sơ (inline)
function buildProfileQRUrl(p) {
    const bankId = BANK_MAP[p.bankName] || '';
    const account = (p.accountNumber || '').trim();
    const holder = (p.accountHolder || '').trim();
    if (!bankId || !account || !holder) return null;
    const code = generateFileCode(p);
    let url = `https://img.vietqr.io/image/${bankId}-${account}-compact2.png?accountName=${encodeURIComponent(holder)}`;
    url += `&addInfo=${encodeURIComponent('Phi HS ' + code)}`;
    return url;
}

// Đăng QR của hồ sơ cụ thể lên trang chủ
async function publishProfileQR(id, source) {
    const p = allProfiles.find(x => x.id === id && x._source === source);
    if (!p) return;
    const code = generateFileCode(p);
    const bankId = BANK_MAP[p.bankName] || '';
    if (!bankId || !p.accountNumber || !p.accountHolder) {
        toast('⚠️ Hồ sơ chưa có đủ thông tin ngân hàng để tạo QR!', 'error');
        return;
    }
    try {
        const res = await fetch('/api/qr/', {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({
                bank: bankId, accountNumber: p.accountNumber, accountName: p.accountHolder,
                amount: '', note: 'Phi HS ' + code,
                title: 'Thanh toán phí hồ sơ: ' + (p.fullName || p.applicantName || ''),
                fileCode: code
            })
        });
        const json = await res.json();
        if (json.status === 'ok') {
            await fetch('/api/qr/' + json.qrCode.id + '/publish', { method: 'POST', headers: getAuthHeaders() });
            loadQRStatus();
            toast('✅ Đã đăng QR hồ sơ ' + code + ' lên trang chủ!', 'success');
        }
    } catch(e) { toast('⚠️ Lỗi!', 'error'); }
}

function previewQR() {
    const bank = document.getElementById('qrBank').value;
    const account = document.getElementById('qrAccount').value.trim();
    const name = document.getElementById('qrAccountName').value.trim();
    if (!bank || !account || !name) { toast('⚠️ Vui lòng chọn ngân hàng, số tài khoản và tên chủ tài khoản!', 'error'); return; }
    const url = buildQRUrl();
    const previewBox = document.getElementById('qrPreviewBox');
    const img = document.getElementById('qrPreviewImg');
    const info = document.getElementById('qrPreviewInfo');
    previewBox.classList.remove('hidden');
    img.src = url;
    const amount = document.getElementById('qrAmount').value;
    const note = document.getElementById('qrNote').value.trim();
    info.innerHTML = `<strong>Ngân hàng:</strong> ${document.getElementById('qrBank').options[document.getElementById('qrBank').selectedIndex].text}<br><strong>Số TK:</strong> ${account}<br><strong>Chủ TK:</strong> ${name}${amount ? `<br><strong>Số tiền:</strong> ${parseInt(amount).toLocaleString('vi-VN')} VNĐ` : ''}${note ? `<br><strong>Nội dung:</strong> ${note}` : ''}`;
}

async function publishQR() {
    const bank = document.getElementById('qrBank').value;
    const account = document.getElementById('qrAccount').value.trim();
    const name = document.getElementById('qrAccountName').value.trim();
    if (!bank || !account || !name) { toast('⚠️ Vui lòng điền đủ thông tin QR!', 'error'); return; }
    const url = buildQRUrl();
    try {
        const res = await fetch('/api/qr/', {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({
                bank, accountNumber: account, accountName: name,
                amount: document.getElementById('qrAmount').value || null,
                note: document.getElementById('qrNote').value.trim() || null,
                title: document.getElementById('qrTitle').value.trim() || 'Thanh toán phí dịch vụ',
                fileCode: document.getElementById('qrFileCode').value.trim() || null
            })
        });
        const json = await res.json();
        if (json.status === 'ok') {
            await fetch('/api/qr/' + json.qrCode.id + '/publish', { method: 'POST', headers: getAuthHeaders() });
            loadQRStatus();
            toast('✅ Đã đăng QR lên trang chủ!', 'success');
        } else {
            toast('⚠️ Lỗi: ' + (json.error || ''), 'error');
        }
    } catch(e) { toast('⚠️ Lỗi kết nối!', 'error'); }
}

async function removeQR() {
    if (!confirm('Bạn có chắc muốn gỡ QR khỏi trang chủ?')) return;
    try {
        const res = await fetch('/api/qr/published');
        const json = await res.json();
        if (json.qrCode) {
            await fetch('/api/qr/' + json.qrCode.id + '/unpublish', { method: 'POST', headers: getAuthHeaders() });
        }
        loadQRStatus();
        toast('🗑 Đã gỡ QR khỏi trang chủ!', 'success');
    } catch(e) { toast('⚠️ Lỗi kết nối!', 'error'); }
}

async function loadQRStatus() {
    const el = document.getElementById('currentQRStatus');
    try {
        const res = await fetch('/api/qr/published');
        const json = await res.json();
        const config = json.qrCode;
        if (!config) {
            el.innerHTML = '<div style="text-align:center;padding:32px 20px;color:#aaa;"><div style="font-size:48px;margin-bottom:12px;">📭</div><p>Chưa có QR nào đang hiển thị trên trang chủ</p></div>';
            return;
        }
        const qrUrl = `https://img.vietqr.io/image/${config.bank}-${config.accountNumber}-compact2.png?accountName=${encodeURIComponent(config.accountName)}${config.amount ? '&amount='+config.amount : ''}${config.note ? '&addInfo='+encodeURIComponent(config.note) : ''}`;
        el.innerHTML = `
            <div style="text-align:center;margin-bottom:16px;">
                <img src="${qrUrl}" alt="QR" style="width:180px;border-radius:10px;border:3px solid #27ae60;box-shadow:0 4px 16px rgba(0,0,0,0.1);">
            </div>
            <div style="background:#d4edda;border:1px solid #c3e6cb;border-radius:8px;padding:12px 16px;margin-bottom:14px;">
                <div style="font-size:13px;font-weight:700;color:#155724;margin-bottom:6px;">✅ QR đang hiển thị trên trang chủ</div>
            </div>
            <div style="font-size:13px;line-height:2;color:#555;">
                <div><b>Tiêu đề:</b> ${esc(config.title)}</div>
                <div><b>Ngân hàng:</b> ${esc(config.bank)}</div>
                <div><b>Số TK:</b> ${esc(config.accountNumber)}</div>
                <div><b>Chủ TK:</b> ${esc(config.accountName)}</div>
                ${config.amount ? `<div><b>Số tiền:</b> ${parseInt(config.amount).toLocaleString('vi-VN')} VNĐ</div>` : ''}
                ${config.note ? `<div><b>Nội dung:</b> ${esc(config.note)}</div>` : ''}
                ${config.fileCode ? `<div><b>Mã hồ sơ:</b> ${esc(config.fileCode)}</div>` : ''}
                <div><b>Đăng lúc:</b> ${fmtDate(config.createdAt)}</div>
            </div>
            <div style="margin-top:14px;">
                <button class="btn btn-danger btn-sm" onclick="removeQR()">🗑 Gỡ QR khỏi trang chủ</button>
            </div>`;
    } catch(e) {
        el.innerHTML = '<div style="text-align:center;padding:32px 20px;color:#aaa;"><div style="font-size:48px;margin-bottom:12px;">📭</div><p>Lỗi tải QR</p></div>';
    }
}

// ===== EXPORT =====
function exportData() {
    const data = filteredData.length ? filteredData : allProfiles;
    if (!data.length) { toast('⚠️ Không có dữ liệu để xuất!', 'error'); return; }
    const headers = ['Mã hồ sơ', 'Loại', 'Họ tên', 'CCCD/CMND', 'Điện thoại', 'Địa chỉ', 'Ngân hàng', 'Số TK', 'Chủ TK', 'Lĩnh vực', 'Trạng thái', 'Ghi chú', 'Ngày nộp'];
    const rows = data.map(p => [
        generateFileCode(p), p._type, p.fullName || p.applicantName || '',
        p.idNumber || '', p.phone || '', p.address || p.detailAddress || '',
        p.bankName || '', p.accountNumber || '', p.accountHolder || '',
        p.jobType || p.field || '',
        p._status || 'pending', p.adminNote || '', fmtDate(p.createdAt)
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));
    const csv = '\uFEFF' + [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `ho-so-${new Date().toISOString().slice(0,10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
    toast('⬇ Đã xuất dữ liệu CSV!', 'success');
}

// ===== CHARTS =====
function renderCharts() {
  setTimeout(function() { renderStatusChart(); renderTrendChart(); }, 100);
}

function renderStatusChart() {
  var canvas = document.getElementById('statusChart');
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  var dpr = window.devicePixelRatio || 1;
  var rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);
  var w = rect.width, h = rect.height;

  var data = [
    { label: 'Tổng số', value: allProfiles.length + dvcData.length + nhadatData.length, color: '#1976D2' },
    { label: 'Chờ xử lý', value: allProfiles.filter(function(p){return (p._status||'pending')==='pending'}).length + dvcData.filter(function(p){return (p.status||'pending')==='pending'}).length + nhadatData.filter(function(p){return (p.status||'pending')==='pending'}).length, color: '#FFA726' },
    { label: 'Đang xử lý', value: allProfiles.filter(function(p){return p._status==='processing'}).length + dvcData.filter(function(p){return p.status==='processing'}).length + nhadatData.filter(function(p){return p.status==='processing'}).length, color: '#FFC251' },
    { label: 'Hoàn thành', value: allProfiles.filter(function(p){return p._status==='done'}).length + dvcData.filter(function(p){return p.status==='done'}).length + nhadatData.filter(function(p){return p.status==='done'}).length, color: '#66BB6A' },
    { label: 'Từ chối', value: allProfiles.filter(function(p){return p._status==='rejected'}).length + dvcData.filter(function(p){return p.status==='rejected'}).length + nhadatData.filter(function(p){return p.status==='rejected'}).length, color: '#EF5350' }
  ];

  ctx.clearRect(0, 0, w, h);
  var maxVal = Math.max.apply(null, data.map(function(d){return d.value})) || 1;
  var padding = { top: 20, bottom: 36, left: 10, right: 10 };
  var chartW = w - padding.left - padding.right;
  var chartH = h - padding.top - padding.bottom;
  var barW = Math.min(chartW / data.length * 0.6, 48);
  var gap = (chartW - barW * data.length) / (data.length + 1);

  data.forEach(function(d, i) {
    var x = padding.left + gap + i * (barW + gap);
    var barH = (d.value / maxVal) * chartH;
    var y = padding.top + chartH - barH;

    var grad = ctx.createLinearGradient(x, y, x, padding.top + chartH);
    grad.addColorStop(0, d.color);
    grad.addColorStop(1, d.color + '66');
    ctx.beginPath();
    ctx.moveTo(x, y + 4);
    ctx.arcTo(x, y, x + 4, y, 4);
    ctx.lineTo(x + barW - 4, y);
    ctx.arcTo(x + barW, y, x + barW, y + 4, 4);
    ctx.lineTo(x + barW, padding.top + chartH);
    ctx.lineTo(x, padding.top + chartH);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.shadowColor = d.color + '44';
    ctx.shadowBlur = 4;
    ctx.fillStyle = '#1E2F41';
    ctx.font = 'bold 13px Nunito, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(d.value, x + barW / 2, y - 6);
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#888';
    ctx.font = '11px Nunito, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(d.label, x + barW / 2, padding.top + chartH + 16);
  });
}

async function renderTrendChart() {
  var canvas = document.getElementById('trendChart');
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  var dpr = window.devicePixelRatio || 1;
  var rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);
  var w = rect.width, h = rect.height;

  var weeklyData = [];
  try {
    var res = await fetch('/api/admin/stats/weekly?days=14', { headers: getAuthHeaders() });
    var json = await res.json();
    weeklyData = json.data || [];
  } catch(e) { weeklyData = []; }

  if (!weeklyData.length) {
    ctx.fillStyle = '#aaa';
    ctx.font = '14px Nunito, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Chưa có dữ liệu', w / 2, h / 2);
    return;
  }

  var padding = { top: 20, bottom: 40, left: 36, right: 16 };
  var chartW = w - padding.left - padding.right;
  var chartH = h - padding.top - padding.bottom;
  var values = weeklyData.map(function(d){return d.total});
  var maxVal = Math.max.apply(null, values) || 1;

  ctx.strokeStyle = '#f0f0f0';
  ctx.lineWidth = 1;
  for (var i = 0; i <= 4; i++) {
    var gy = padding.top + (chartH / 4) * i;
    ctx.beginPath();
    ctx.moveTo(padding.left, gy);
    ctx.lineTo(w - padding.right, gy);
    ctx.stroke();
    ctx.fillStyle = '#bbb';
    ctx.font = '10px Nunito, Arial, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(Math.round(maxVal - (maxVal / 4) * i), padding.left - 6, gy + 3);
  }

  var stepX = chartW / Math.max(values.length - 1, 1);
  ctx.beginPath();
  ctx.strokeStyle = '#CE7A58';
  ctx.lineWidth = 2.5;
  ctx.lineJoin = 'round';
  ctx.shadowColor = '#CE7A5844';
  ctx.shadowBlur = 6;
  values.forEach(function(v, i) {
    var px = padding.left + i * stepX;
    var py = padding.top + chartH - (v / maxVal) * chartH;
    i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
  });
  ctx.stroke();
  ctx.shadowBlur = 0;

  ctx.lineTo(padding.left + (values.length - 1) * stepX, padding.top + chartH);
  ctx.lineTo(padding.left, padding.top + chartH);
  var grad = ctx.createLinearGradient(0, padding.top, 0, padding.top + chartH);
  grad.addColorStop(0, '#CE7A5833');
  grad.addColorStop(1, '#CE7A5803');
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.closePath();
  ctx.fill();

  values.forEach(function(v, i) {
    var px = padding.left + i * stepX;
    var py = padding.top + chartH - (v / maxVal) * chartH;
    ctx.beginPath();
    ctx.arc(px, py, 4.5, 0, Math.PI * 2);
    ctx.fillStyle = '#CE7A58';
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();
  });

  weeklyData.forEach(function(d, i) {
    if (i % 2 === 0 || i === values.length - 1) {
      var px = padding.left + i * stepX;
      ctx.fillStyle = '#888';
      ctx.font = '9px Nunito, Arial, sans-serif';
      ctx.textAlign = 'center';
      var parts = d.date.split('-');
      ctx.fillText(parts[2] + '/' + parts[1], px, padding.top + chartH + 16);
    }
  });
}

// ===== USER MANAGEMENT =====
var allUsers = [];

async function loadUsers() {
  try {
    var res = await fetch('/api/admin/users', { headers: getAuthHeaders() });
    var json = await res.json();
    allUsers = json.data || [];
  } catch (e) { allUsers = []; }
}

function renderUsersTable() {
  var tbody = document.getElementById('usersTable');
  if (!tbody) return;
  if (!allUsers.length) {
    tbody.innerHTML = '<tr><td colspan="8" class="empty-table"><div class="empty-icon">👥</div><p>Chưa có người dùng</p></td></tr>';
    return;
  }
  tbody.innerHTML = allUsers.map(function(u, i) {
    return '<tr>' +
      '<td style="color:#aaa;font-size:12px;">' + (i + 1) + '</td>' +
      '<td><strong>' + esc(u.username) + '</strong></td>' +
      '<td>' + esc(u.fullName) + '</td>' +
      '<td>' + esc(u.email || '—') + '</td>' +
      '<td>' + esc(u.phone || '—') + '</td>' +
      '<td><span class="badge ' + (u.role === 'admin' ? 'badge-processing' : 'badge-pending') + '">' + (u.role === 'admin' ? 'Quản trị' : 'Người dùng') + '</span></td>' +
      '<td>' + fmtDate(u.createdAt) + '</td>' +
      '<td><div class="action-btns">' +
        '<button class="btn btn-secondary btn-xs" onclick="editUser(\'' + u.id + '\')">✏️</button>' +
        '<button class="btn btn-danger btn-xs" onclick="deleteUser(\'' + u.id + '\',\'' + esc(u.username) + '\')">🗑</button>' +
      '</div></td></tr>';
  }).join('');
}

function openUserModal() {
  document.getElementById('editUserId').value = '';
  document.getElementById('userUsername').value = '';
  document.getElementById('userUsername').disabled = false;
  document.getElementById('userFullName').value = '';
  document.getElementById('userPassword').value = '';
  document.getElementById('userEmail').value = '';
  document.getElementById('userPhone').value = '';
  document.getElementById('userRole').value = 'user';
  document.getElementById('userModalTitle').textContent = '👤 Thêm người dùng';
  document.getElementById('pwdRequired').style.display = 'inline';
  openModal('modalUser');
}

function editUser(id) {
  var u = allUsers.find(function(x){return x.id == id});
  if (!u) return;
  document.getElementById('editUserId').value = u.id;
  document.getElementById('userUsername').value = u.username;
  document.getElementById('userUsername').disabled = true;
  document.getElementById('userFullName').value = u.fullName;
  document.getElementById('userPassword').value = '';
  document.getElementById('userEmail').value = u.email || '';
  document.getElementById('userPhone').value = u.phone || '';
  document.getElementById('userRole').value = u.role;
  document.getElementById('userModalTitle').textContent = '✏️ Sửa người dùng';
  document.getElementById('pwdRequired').style.display = 'none';
  openModal('modalUser');
}

async function saveUser() {
  var id = document.getElementById('editUserId').value;
  var username = document.getElementById('userUsername').value.trim();
  var fullName = document.getElementById('userFullName').value.trim();
  var password = document.getElementById('userPassword').value;
  var email = document.getElementById('userEmail').value.trim();
  var phone = document.getElementById('userPhone').value.trim();
  var role = document.getElementById('userRole').value;

  if (!fullName) { toast('⚠️ Vui lòng nhập họ và tên!', 'error'); return; }
  if (!id && !username) { toast('⚠️ Vui lòng nhập tên đăng nhập!', 'error'); return; }
  if (!id && !password) { toast('⚠️ Vui lòng nhập mật khẩu!', 'error'); return; }

  try {
    if (id) {
      var body = { fullName: fullName, email: email, phone: phone, role: role };
      if (password) body.password = password;
      var res = await fetch('/api/admin/users/' + id, { method: 'PUT', headers: getAuthHeaders(), body: JSON.stringify(body) });
      var json = await res.json();
      if (json.status !== 'thành công') { toast('⚠️ ' + (json.error || 'Lỗi!'), 'error'); return; }
      toast('✅ Đã cập nhật người dùng!', 'success');
    } else {
      var res = await fetch('/api/admin/users', { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify({ username: username, password: password, fullName: fullName, email: email, phone: phone, role: role }) });
      var json = await res.json();
      if (json.status !== 'thành công') { toast('⚠️ ' + (json.error || 'Lỗi!'), 'error'); return; }
      toast('✅ Đã thêm người dùng!', 'success');
    }
    closeModal('modalUser');
    document.getElementById('userUsername').disabled = false;
    await loadUsers();
    renderUsersTable();
  } catch (e) { toast('⚠️ Lỗi kết nối!', 'error'); }
}

async function deleteUser(id, username) {
  if (!confirm('Bạn có chắc muốn xóa người dùng "' + username + '"?')) return;
  try {
    var res = await fetch('/api/admin/users/' + id, { method: 'DELETE', headers: getAuthHeaders() });
    var json = await res.json();
    if (json.status !== 'thành công') { toast('⚠️ ' + (json.error || 'Lỗi!'), 'error'); return; }
    await loadUsers();
    renderUsersTable();
    toast('🗑 Đã xóa người dùng!', 'success');
  } catch (e) { toast('⚠️ Lỗi kết nối!', 'error'); }
}

// ===== SIDEBAR TOGGLE (Mobile) =====
function toggleSidebar() {
    var sidebar = document.querySelector('.sidebar');
    var overlay = document.getElementById('sidebarOverlay');
    sidebar.classList.toggle('open');
    overlay.classList.toggle('show');
    document.body.style.overflow = sidebar.classList.contains('open') ? 'hidden' : '';
}
function closeSidebar() {
    document.querySelector('.sidebar').classList.remove('open');
    document.getElementById('sidebarOverlay').classList.remove('show');
    document.body.style.overflow = '';
}

// ===== TABS =====
async function showTab(name, linkEl) {
    closeSidebar();
    var tabs = ['dashboard', 'profiles', 'qrmanager', 'dvc', 'nhadat', 'users', 'chat'];
    tabs.forEach(function(t) { var el = document.getElementById('tab-' + t); if (el) { el.style.opacity = '0'; setTimeout(function() { el.style.display = 'none'; }, 150); } });
    var tab = document.getElementById('tab-' + name);
    if (tab) { setTimeout(function() { tab.style.display = 'block'; setTimeout(function() { tab.style.opacity = '1'; }, 20); }, 160); }
    document.querySelectorAll('.sidebar-nav a').forEach(function(a) { a.classList.remove('active'); });
    if (linkEl) linkEl.classList.add('active');
    var titles = {
        dashboard: 'Tổng quan hệ thống', profiles: 'Danh sách hồ sơ',
        qrmanager: 'Quản lý QR thanh toán', dvc: 'Dịch vụ công trực tuyến',
        nhadat: 'Thủ tục nhà đất', users: 'Quản lý người dùng',
        chat: 'Hỗ trợ trực tuyến'
    };
    document.getElementById('pageTitle').textContent = titles[name] || '';
    if (name === 'dashboard') { renderCharts(); }
    if (name === 'profiles') { await loadAllProfiles(); renderProfilesTable(); }
    if (name === 'qrmanager') loadQRStatus();
    if (name === 'dvc') { await loadAllDVC(); renderDVCTable(); }
    if (name === 'nhadat') { await loadAllNhaDat(); renderNhaDatTable(); }
    if (name === 'users') { await loadUsers(); renderUsersTable(); }
    if (name === 'chat') { refreshChat(); loadSessions(); startChatPolling(); }
}

function startChatPolling() {
    if (chatPollInterval) clearInterval(chatPollInterval);
    lastChatCount = 0;
    chatPollInterval = setInterval(refreshChat, 3000);
}

function stopChatPolling() {
    if (chatPollInterval) { clearInterval(chatPollInterval); chatPollInterval = null; }
}

// ===== MODAL =====
function openModal(id) { document.getElementById(id).classList.add('open'); document.body.style.overflow = 'hidden'; }
function closeModal(id) { document.getElementById(id).classList.remove('open'); document.body.style.overflow = ''; }

// ===== TOAST =====
function toast(msg, type = '') {
    const el = document.getElementById('adminToast');
    el.textContent = msg; el.className = 'admin-toast show ' + type;
    setTimeout(() => { el.classList.remove('show'); }, 3000);
}

// ===== UTILS =====
function esc(str) { return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function copyText(text) {
    if (navigator.clipboard) { navigator.clipboard.writeText(text).then(function(){ toast('Đã sao chép: ' + text, 'success'); }).catch(function(){}); }
    else { toast('Sao chép: ' + text, ''); }
}

// ===== INIT =====
try {
    document.getElementById('loginPass').addEventListener('keydown', function(e) { if (e.key === 'Enter') doLogin(); });
} catch(e) { console.error('Login init error:', e); }

try {
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            document.getElementById('modalDetail').classList.remove('open');
            document.getElementById('modalDelete').classList.remove('open');
            document.body.style.overflow = '';
        }
    });
} catch(e) { console.error('Keydown init error:', e); }

try {
    document.querySelectorAll('.modal-overlay').forEach(function(m) {
        m.addEventListener('click', function(e) { if (e.target === this) { this.classList.remove('open'); document.body.style.overflow = ''; } });
    });
} catch(e) { console.error('Modal init error:', e); }

// ===== BOOT =====
try { checkSession(); } catch(e) { console.error('Admin boot error:', e); }

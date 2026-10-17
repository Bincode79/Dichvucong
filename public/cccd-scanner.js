var _cccdData = null;
var _scanTimer = null;
var _resCdTimer = null;
var _scanElapsed = 0;
var _resSecsLeft = 8;

var _HO_NAM = ['Nguyễn','Trần','Lê','Phạm','Hoàng','Phan','Vũ','Đặng','Bùi','Đỗ','Hồ','Ngô','Dương','Lý'];
var _TEN_NAM = ['Văn An','Hữu Bình','Đức Cường','Minh Dũng','Quốc Hùng','Trung Khoa','Xuân Long','Công Mạnh','Tuấn Nam','Bá Phúc','Chí Thanh','Tiến Đạt','Quang Vinh','Hải Phong'];
var _HO_NU = ['Nguyễn','Trần','Lê','Phạm','Hoàng','Phan','Bùi','Đỗ'];
var _TEN_NU = ['Thị Anh','Ngọc Chi','Kim Dung','Thu Hằng','Bích Hoa','Lan Huệ','Mai Linh','Hồng Nga','Phương Nhung','Thị Oanh','Thanh Tuyền','Khánh Linh','Minh Châu','Diệu Linh'];
var _TINH = ['Hà Nội','TP. Hồ Chí Minh','Đà Nẵng','Hải Phòng','Cần Thơ','Nghệ An','Thanh Hóa','Bình Dương','Đồng Nai','Khánh Hòa','Quảng Nam','Thừa Thiên Huế','Lâm Đồng','Kiên Giang','An Giang','Bắc Ninh','Vĩnh Phúc','Hưng Yên'];
var _DUONG = ['Đường Láng','Nguyễn Trãi','Lê Lợi','Trần Hưng Đạo','Hoàng Hoa Thám','Đinh Tiên Hoàng','Nguyễn Huệ','Hai Bà Trưng','Nguyễn Văn Cừ','Tôn Đức Thắng','Cách Mạng Tháng 8','Phan Đình Phùng','Lý Thường Kiệt','Trường Chinh','Giải Phóng'];
var _PHUONG = ['Phường 1','Phường 3','Phường 5','Phường Bến Nghé','Phường Đông Khê','Phường Lê Lợi','Phường Hàng Bạc','Phường Tràng Tiền','Phường Hải Châu 1','Phường Cầu Ông Lãnh','Phường Bến Thành'];
var _QUAN = ['Quận 1','Quận 3','Quận Hoàn Kiếm','Quận Hai Bà Trưng','Quận Đống Đa','Quận Bình Thạnh','Quận Tân Bình','Quận Hải Châu','Quận Sơn Trà','Quận Ngô Quyền'];

var _STATUS_MSGS = [
  'Đang tìm chip NFC...',
  'Phát hiện tín hiệu chip NFC...',
  'Chip CCCD được phát hiện!',
  'Đang kết nối chip CCCD...',
  'Kết nối chip thành công!',
  'Đang đọc dữ liệu CCCD...',
  'Đang xác thực chữ ký số...',
  'Xác thực hoàn tất!',
  'Đang đọc dữ liệu sinh trắc học...',
  'Hoàn tất — mã hóa dữ liệu...'
];

function _rnd(a) { return a[Math.floor(Math.random() * a.length)]; }
function _rndInt(a,b) { return Math.floor(Math.random()*(b-a+1))+a; }
function _pad(n) { return String(n).padStart(2,'0'); }

function _genCCCD() {
  var pre = ['001','002','004','048','079','260','274','292'];
  return _rnd(pre) + _rndInt(0,1) + _rndInt(0,9) + String(_rndInt(100000,999999));
}

function _genData() {
  var male = Math.random() > 0.45;
  var name = male ? (_rnd(_HO_NAM)+' '+_rnd(_TEN_NAM)) : (_rnd(_HO_NU)+' '+_rnd(_TEN_NU));
  var doy = _rndInt(1960,2005), dom = _rndInt(1,12), dod = _rndInt(1,28);
  var dob = _pad(dod)+'/'+_pad(dom)+'/'+doy;
  var iy = _rndInt(Math.max(doy+14,2021),2024);
  var im = _rndInt(1,12), iday = _rndInt(1,28);
  var idate = _pad(iday)+'/'+_pad(im)+'/'+iy;
  var tinh = _rnd(_TINH);
  var addr = _rndInt(1,350)+' '+_rnd(_DUONG)+', '+_rnd(_PHUONG)+', '+_rnd(_QUAN)+', '+tinh;
  var gender = male ? 'Nam' : 'Nữ';
  var genCCCD = _genCCCD();
  var formattedCCCD = genCCCD.slice(0,3)+' '+genCCCD.slice(3,6)+' '+genCCCD.slice(6);
  return {
    id: genCCCD,
    idFormatted: formattedCCCD,
    name: name.toUpperCase(),
    dob: dob,
    gender: gender,
    nation: 'Việt Nam',
    hometown: tinh,
    address: addr,
    issueDate: idate,
    expiry: doy <= 1993 ? 'Không thời hạn' : _pad(iday)+'/'+_pad(im)+'/'+(iy+25),
    issueBy: 'Cục Cảnh sát quản lý hành chính về trật tự xã hội'
  };
}

function _el(id) { return document.getElementById(id); }
function _show(id, flex) { var e=_el(id); if(e) e.style.display = flex ? 'flex' : 'block'; }
function _hide(id) { var e=_el(id); if(e) e.style.display='none'; }

function openCCCDScanner(e) {
  if (e) e.preventDefault();
  var m = _el('cccdModal');
  if (!m) return;
  m.classList.add('open');
  document.body.style.overflow = 'hidden';
  _resetAll();
  _show('cccdPhaseMain', true);
  _hide('cccdPhaseResult');
}

function closeCCCDScanner() {
  _clearTimers();
  var m = _el('cccdModal');
  if (m) m.classList.remove('open');
  document.body.style.overflow = '';
}

function _clearTimers() {
  if (_scanTimer) { clearInterval(_scanTimer); _scanTimer = null; }
  if (_resCdTimer) { clearInterval(_resCdTimer); _resCdTimer = null; }
}

function _resetAll() {
  _clearTimers();
  _cccdData = null;
  _scanElapsed = 0;
  _resSecsLeft = 8;

  var g = _el('cccdGuideMain');
  if (g) { g.textContent = 'Đưa thẻ CCCD vào gần thiết bị để bắt đầu'; g.className = 'cccd-nfc-guide'; }

  var st = _el('cccdScanStatus');
  if (st) { st.textContent = ''; st.className = 'cccd-nfc-status'; }

  var btn = _el('cccdBtnStart');
  if (btn) { btn.style.display = 'flex'; btn.disabled = false; }

  var ill = _el('cccdIllust');
  if (ill) ill.classList.remove('hide');

  var circ = _el('cccdNfcCircle');
  if (circ) circ.className = 'cccd-nfc-circle';

  for (var i=1; i<=3; i++) {
    var pr = _el('cccdPulse'+i);
    if (pr) pr.classList.remove('anim');
  }

  var prog = _el('cccdNfcProgress');
  if (prog) prog.style.display = 'none';
  var fill = _el('cccdProgressFill');
  if (fill) fill.style.width = '0%';
  var pt = _el('cccdProgressText');
  if (pt) pt.textContent = '0%';
}

function _updateProgress(pct) {
  var fill = _el('cccdProgressFill');
  if (fill) fill.style.width = pct + '%';
  var pt = _el('cccdProgressText');
  if (pt) pt.textContent = pct + '%';
}

function cccdStartScan() {
  var TOTAL = 18;

  var btn = _el('cccdBtnStart');
  if (btn) btn.style.display = 'none';

  var ill = _el('cccdIllust');
  if (ill) ill.classList.add('hide');

  var circ = _el('cccdNfcCircle');
  if (circ) circ.className = 'cccd-nfc-circle active';

  for (var i=1; i<=3; i++) {
    var pr = _el('cccdPulse'+i);
    if (pr) pr.classList.add('anim');
  }

  var prog = _el('cccdNfcProgress');
  if (prog) prog.style.display = 'flex';

  // Map elapsed second → { msgIndex, guideClass }
  var msgMap = [
    { at: 1,  idx: 0 },
    { at: 3,  idx: 1 },
    { at: 5,  idx: 2 },
    { at: 7,  idx: 3 },
    { at: 9,  idx: 4 },
    { at: 11, idx: 5 },
    { at: 13, idx: 6 },
    { at: 15, idx: 7 },
    { at: 16, idx: 8 },
    { at: 17, idx: 9 },
  ];

  _scanTimer = setInterval(function() {
    _scanElapsed++;

    var pct = Math.round((_scanElapsed / TOTAL) * 100);
    _updateProgress(Math.min(pct, 100));

    var ev = null;
    for (var i=0; i<msgMap.length; i++) {
      if (_scanElapsed === msgMap[i].at) { ev = msgMap[i]; break; }
    }

    if (ev) {
      var g = _el('cccdGuideMain');
      if (g && _STATUS_MSGS[ev.idx]) {
        g.textContent = _STATUS_MSGS[ev.idx];
        g.className = 'cccd-nfc-guide highlight';
        setTimeout(function() { if (g && _scanTimer) g.className = 'cccd-nfc-guide'; }, 800);
      }

      var st = _el('cccdScanStatus');
      if (st && _STATUS_MSGS[ev.idx]) {
        st.textContent = _STATUS_MSGS[ev.idx];
        st.className = 'cccd-nfc-status active';
      }
    }

    // Chip detected at second 5
    if (_scanElapsed === 5) {
      var banner = _el('cccdChipBanner');
      if (banner) banner.classList.add('show');
    }

    if (_scanElapsed >= TOTAL) {
      clearInterval(_scanTimer); _scanTimer = null;
      _onScanDone();
    }
  }, 1000);
}

function _onScanDone() {
  _cccdData = _genData();

  setTimeout(function() {
    closeCCCDScanner();
  }, 500);
}

function _startResultCountdown() {
  _resSecsLeft = 8;
  var cd = _el('cccdResultCountdown');
  if (cd) cd.textContent = _resSecsLeft + 's';

  _resCdTimer = setInterval(function() {
    _resSecsLeft--;
    if (cd) cd.textContent = _resSecsLeft + 's';
    if (_resSecsLeft <= 0) {
      clearInterval(_resCdTimer); _resCdTimer = null;
      var overlay = _el('cccdModal');
      if (overlay) overlay.classList.add('cccd-fade-out');
      setTimeout(_returnHome, 700);
    }
  }, 1000);
}

function _buildResult(d) {
  var body = _el('cccdResultBody');
  if (!body) return;
  var fields = [
    { label: 'Họ và tên', val: d.name, mono: false },
    { label: 'Số CCCD', val: d.idFormatted, mono: true },
    { label: 'Ngày sinh', val: d.dob, mono: false },
    { label: 'Giới tính', val: d.gender, mono: false },
    { label: 'Quốc tịch', val: d.nation, mono: false },
    { label: 'Quê quán', val: d.hometown, mono: false },
    { label: 'Địa chỉ TT', val: d.address, mono: false },
    { label: 'Ngày cấp', val: d.issueDate, mono: false },
    { label: 'Có giá trị đến', val: d.expiry, mono: false },
  ];
  body.innerHTML = fields.map(function(f) {
    return '<div class="cccd-rf">'
      + '<span class="cccd-rf-label">'+f.label+'</span>'
      + '<span class="cccd-rf-val'+(f.mono?' mono':'')+'">'+f.val+'</span>'
      + '</div>';
  }).join('');
}

function _returnHome() {
  closeCCCDScanner();
  var m = _el('cccdModal');
  if (m) m.classList.remove('cccd-fade-out');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

document.addEventListener('DOMContentLoaded', function() {
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') closeCCCDScanner();
  });
});

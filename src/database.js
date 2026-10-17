const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const DB_PATH = path.join(__dirname, '..', 'data', 'dichvucong.db');

let db;

function getDB() {
  if (!db) {
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initSchema();
    seedData();
  }
  return db;
}

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS appointments (
      id TEXT PRIMARY KEY,
      fullName TEXT NOT NULL,
      idNumber TEXT,
      phone TEXT,
      address TEXT,
      province TEXT,
      ward TEXT,
      soBanNganh TEXT,
      appointmentDate TEXT,
      appointmentTime TEXT,
      jobType TEXT,
      officer TEXT,
      purpose TEXT,
      participants TEXT DEFAULT '1',
      notes TEXT,
      vnidLevel2 TEXT DEFAULT 'Chưa',
      bankSync TEXT DEFAULT 'Chưa',
      confirmAccuracy TEXT DEFAULT 'Chưa',
      status TEXT DEFAULT 'pending',
      adminNote TEXT,
      createdAt TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS dich_vu_cong_registrations (
      id TEXT PRIMARY KEY,
      fullName TEXT,
      idNumber TEXT,
      dateOfBirth TEXT,
      phone TEXT,
      email TEXT,
      address TEXT,
      serviceType TEXT,
      otherService TEXT,
      purpose TEXT,
      agreeTerms TEXT,
      formData TEXT,
      status TEXT DEFAULT 'pending',
      adminNote TEXT,
      createdAt TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS nha_dat_registrations (
      id TEXT PRIMARY KEY,
      receivingUnit TEXT,
      supportUnit TEXT,
      field TEXT,
      procedure TEXT,
      publicService TEXT,
      applicantName TEXT,
      dateOfBirth TEXT,
      idNumber TEXT,
      idIssueDate TEXT,
      idIssuePlace TEXT,
      phone TEXT,
      province TEXT,
      detailAddress TEXT,
      authorizedPerson TEXT,
      landUserName TEXT,
      landUserAddress TEXT,
      landUserPhone TEXT,
      bankName TEXT,
      accountNumber TEXT,
      accountHolder TEXT,
      syncCode TEXT,
      commitment TEXT,
      status TEXT DEFAULT 'pending',
      adminNote TEXT,
      createdAt TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS provinces (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sender TEXT NOT NULL DEFAULT 'user',
      message TEXT NOT NULL,
      room TEXT DEFAULT 'support',
      isRead INTEGER DEFAULT 0,
      createdAt TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS qr_codes (
      id TEXT PRIMARY KEY,
      bank TEXT NOT NULL,
      accountNumber TEXT NOT NULL,
      accountName TEXT NOT NULL,
      amount TEXT,
      note TEXT,
      title TEXT,
      fileCode TEXT,
      published INTEGER DEFAULT 0,
      createdAt TEXT DEFAULT (datetime('now')),
      updatedAt TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS districts (
      id TEXT NOT NULL,
      name TEXT NOT NULL,
      provinceId TEXT NOT NULL,
      PRIMARY KEY (id, provinceId),
      FOREIGN KEY (provinceId) REFERENCES provinces(id)
    );

    CREATE TABLE IF NOT EXISTS wards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      districtId TEXT NOT NULL,
      FOREIGN KEY (districtId) REFERENCES districts(id)
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      fullName TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      role TEXT DEFAULT 'user',
      createdAt TEXT DEFAULT (datetime('now'))
    );
  `);
}

function migrateSchema() {
  const cols = db.prepare("PRAGMA table_info('dich_vu_cong_registrations')").all().map(r => r.name);
  if (!cols.includes('dateOfBirth')) {
    db.exec("ALTER TABLE dich_vu_cong_registrations ADD COLUMN dateOfBirth TEXT");
  }
  if (!cols.includes('formData')) {
    db.exec("ALTER TABLE dich_vu_cong_registrations ADD COLUMN formData TEXT");
  }
  const chatCols = db.prepare("PRAGMA table_info('chat_messages')").all().map(r => r.name);
  if (!chatCols.includes('sessionId')) {
    db.exec("ALTER TABLE chat_messages ADD COLUMN sessionId TEXT");
  }
  if (!chatCols.includes('userPhone')) {
    db.exec("ALTER TABLE chat_messages ADD COLUMN userPhone TEXT");
  }
  if (!chatCols.includes('fileUrl')) {
    db.exec("ALTER TABLE chat_messages ADD COLUMN fileUrl TEXT");
  }
  if (!chatCols.includes('fileType')) {
    db.exec("ALTER TABLE chat_messages ADD COLUMN fileType TEXT");
  }
  if (!chatCols.includes('fileName')) {
    db.exec("ALTER TABLE chat_messages ADD COLUMN fileName TEXT");
  }
  const nhaDatCols = db.prepare("PRAGMA table_info('nha_dat_registrations')").all().map(r => r.name);
  if (!nhaDatCols.includes('district')) {
    db.exec("ALTER TABLE nha_dat_registrations ADD COLUMN district TEXT");
  }
}

function migratePasswords() {
  const users = db.prepare('SELECT id, password FROM users').all();
  for (const user of users) {
    if (user.password && !user.password.startsWith('$2')) {
      const hashed = bcrypt.hashSync(user.password, 10);
      db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashed, user.id);
    }
  }
}

function seedData() {
  migrateSchema();
  const adminExists = db.prepare('SELECT id FROM users WHERE role = ?').get('admin');
  if (!adminExists) {
    const hashed = bcrypt.hashSync('admin@2024', 10);
    db.prepare('INSERT OR IGNORE INTO users (username, password, fullName, role) VALUES (?, ?, ?, ?)').run('admin', hashed, 'Quản trị viên', 'admin');
  }
  migratePasswords();

  const provinces = {
    'an-giang': 'An Giang',
    'ba-ria-vung-tau': 'Bà Rịa - Vũng Tàu',
    'bac-giang': 'Bắc Giang',
    'bac-kan': 'Bắc Kạn',
    'bac-lieu': 'Bạc Liêu',
    'bac-ninh': 'Bắc Ninh',
    'ben-tre': 'Bến Tre',
    'binh-dinh': 'Bình Định',
    'binh-duong': 'Bình Dương',
    'binh-phuoc': 'Bình Phước',
    'binh-thuan': 'Bình Thuận',
    'ca-mau': 'Cà Mau',
    'can-tho': 'TP. Cần Thơ',
    'cao-bang': 'Cao Bằng',
    'da-nang': 'TP. Đà Nẵng',
    'dak-lak': 'Đắk Lắk',
    'dak-nong': 'Đắk Nông',
    'dien-bien': 'Điện Biên',
    'dong-nai': 'Đồng Nai',
    'dong-thap': 'Đồng Tháp',
    'gia-lai': 'Gia Lai',
    'ha-giang': 'Hà Giang',
    'ha-nam': 'Hà Nam',
    'ha-noi': 'TP. Hà Nội',
    'ha-tinh': 'Hà Tĩnh',
    'hai-duong': 'Hải Dương',
    'hai-phong': 'TP. Hải Phòng',
    'hau-giang': 'Hậu Giang',
    'hoa-binh': 'Hòa Bình',
    'ho-chi-minh': 'TP. Hồ Chí Minh',
    'hung-yen': 'Hưng Yên',
    'khanh-hoa': 'Khánh Hòa',
    'kien-giang': 'Kiên Giang',
    'kon-tum': 'Kon Tum',
    'lai-chau': 'Lai Châu',
    'lam-dong': 'Lâm Đồng',
    'lang-son': 'Lạng Sơn',
    'lao-cai': 'Lào Cai',
    'long-an': 'Long An',
    'nam-dinh': 'Nam Định',
    'nghe-an': 'Nghệ An',
    'ninh-binh': 'Ninh Bình',
    'ninh-thuan': 'Ninh Thuận',
    'phu-tho': 'Phú Thọ',
    'phu-yen': 'Phú Yên',
    'quang-binh': 'Quảng Bình',
    'quang-nam': 'Quảng Nam',
    'quang-ngai': 'Quảng Ngãi',
    'quang-ninh': 'Quảng Ninh',
    'quang-tri': 'Quảng Trị',
    'soc-trang': 'Sóc Trăng',
    'son-la': 'Sơn La',
    'tay-ninh': 'Tây Ninh',
    'thai-binh': 'Thái Bình',
    'thai-nguyen': 'Thái Nguyên',
    'thanh-hoa': 'Thanh Hóa',
    'thua-thien-hue': 'Thừa Thiên Huế',
    'tien-giang': 'Tiền Giang',
    'tra-vinh': 'Trà Vinh',
    'tuyen-quang': 'Tuyên Quang',
    'vinh-long': 'Vĩnh Long',
    'vinh-phuc': 'Vĩnh Phúc',
    'yen-bai': 'Yên Bái'
  };

  db.exec('DROP TABLE IF EXISTS wards; DROP TABLE IF EXISTS districts');
  db.exec(`CREATE TABLE IF NOT EXISTS districts (
    id TEXT NOT NULL,
    name TEXT NOT NULL,
    provinceId TEXT NOT NULL,
    PRIMARY KEY (id, provinceId),
    FOREIGN KEY (provinceId) REFERENCES provinces(id)
  );
  CREATE TABLE IF NOT EXISTS wards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    districtId TEXT NOT NULL,
    FOREIGN KEY (districtId) REFERENCES districts(id)
  );`);
  db.exec('DELETE FROM provinces');
  const insertProvince = db.prepare('INSERT INTO provinces (id, name) VALUES (?, ?)');
  const transaction = db.transaction(() => {
    for (const [id, name] of Object.entries(provinces)) {
      insertProvince.run(id, name);
    }
  });
  transaction();

  const districtsPath = path.join(__dirname, '..', 'data', 'districts.json');
  if (fs.existsSync(districtsPath)) {
    const allDistricts = JSON.parse(fs.readFileSync(districtsPath, 'utf-8'));
    const insertDistrict = db.prepare('INSERT INTO districts (id, name, provinceId) VALUES (?, ?, ?)');
    const districtTransaction = db.transaction(() => {
      for (const [provinceId, districts] of Object.entries(allDistricts)) {
        for (const d of districts) {
          insertDistrict.run(d.id, d.name, provinceId);
        }
      }
    });
    districtTransaction();
  }
}

module.exports = { getDB };

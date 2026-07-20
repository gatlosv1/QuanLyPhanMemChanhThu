const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { getPool, mssql } = require('../db');
const { initializeApp, getApp, getApps } = require('firebase/app');
const { getFirestore, collection, query, where, limit, getDocs, doc, getDoc } = require('firebase/firestore');
const { validateQRPayload, authenticateRequest, authorizeRole } = require('../security');

function getBootstrapAuthAccounts() {
  try {
    const parsed = JSON.parse(process.env.AUTH_ACCOUNTS_JSON || '[]');
    return Array.isArray(parsed) ? parsed.filter((item) => item && typeof item === 'object') : [];
  } catch (error) {
    return [];
  }
}

function getFirebaseConfig() {
  return {
    apiKey: process.env.FIREBASE_API_KEY || '',
    authDomain: process.env.FIREBASE_AUTH_DOMAIN || '',
    databaseURL: process.env.FIREBASE_DATABASE_URL || '',
    projectId: process.env.FIREBASE_PROJECT_ID || '',
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || '',
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || '',
    appId: process.env.FIREBASE_APP_ID || '',
    measurementId: process.env.FIREBASE_MEASUREMENT_ID || ''
  };
}

function getAuthFirebaseDb() {
  const appName = 'auth-api';
  const app = getApps().some((item) => item.name === appName)
    ? getApp(appName)
    : initializeApp(getFirebaseConfig(), appName);
  return getFirestore(app);
}

function normalizeUsername(value) {
  return String(value || '').trim();
}

function toUsernameLower(username) {
  return normalizeUsername(username).toLowerCase();
}

function toAccountDocId(usernameLower) {
  return String(usernameLower || '').replace(/[^a-z0-9._-]/g, '_');
}

function verifyPasswordPBKDF2(encodedHash, password) {
  if (typeof encodedHash !== 'string' || !encodedHash.startsWith('pbkdf2$')) return false;
  const parts = encodedHash.split('$');
  if (parts.length !== 5) return false;
  const digest = parts[1];
  const iterations = Number.parseInt(parts[2], 10);
  const salt = parts[3];
  const storedHex = parts[4];
  if (!digest || !Number.isFinite(iterations) || iterations < 10000 || !salt || !storedHex) return false;

  const derivedHex = crypto.pbkdf2Sync(String(password || ''), salt, iterations, Buffer.from(storedHex, 'hex').length, digest).toString('hex');
  const storedBuffer = Buffer.from(storedHex, 'hex');
  const derivedBuffer = Buffer.from(derivedHex, 'hex');
  if (storedBuffer.length !== derivedBuffer.length) return false;
  return crypto.timingSafeEqual(storedBuffer, derivedBuffer);
}

function isPasswordMatch(account, password) {
  if (!account || typeof account !== 'object') return false;
  const plainMatch = typeof account.password === 'string' && account.password === password;
  const hashValue = typeof account.passwordHash === 'string' ? account.passwordHash : '';
  const hashMatch = verifyPasswordPBKDF2(hashValue, password);
  return plainMatch || hashMatch;
}

function sanitizeAccountForClient(account) {
  return {
    username: account.username,
    role: account.role,
    page: account.page,
    label: account.label,
    permissions: account.permissions && typeof account.permissions === 'object' ? account.permissions : {}
  };
}

async function findFirebaseAccountByUsername(username) {
  const usernameLower = toUsernameLower(username);
  if (!usernameLower) return null;

  const db = getAuthFirebaseDb();
  const ref = doc(db, 'accounts', toAccountDocId(usernameLower));
  const byDocId = await getDoc(ref);
  if (byDocId.exists()) {
    return { id: byDocId.id, ...byDocId.data() };
  }

  const byLower = await getDocs(query(
    collection(db, 'accounts'),
    where('usernameLower', '==', usernameLower),
    limit(1)
  ));
  if (!byLower.empty) {
    const item = byLower.docs[0];
    return { id: item.id, ...item.data() };
  }

  const byUsername = await getDocs(query(
    collection(db, 'accounts'),
    where('username', '==', username),
    limit(1)
  ));
  if (!byUsername.empty) {
    const item = byUsername.docs[0];
    return { id: item.id, ...item.data() };
  }

  return null;
}

router.get('/config', (req, res) => {
  res.json({
    apiKey: process.env.FIREBASE_API_KEY || '',
    authDomain: process.env.FIREBASE_AUTH_DOMAIN || '',
    databaseURL: process.env.FIREBASE_DATABASE_URL || '',
    projectId: process.env.FIREBASE_PROJECT_ID || '',
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || '',
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || '',
    appId: process.env.FIREBASE_APP_ID || '',
    measurementId: process.env.FIREBASE_MEASUREMENT_ID || ''
  });
});

router.post('/auth/login', async (req, res) => {
  const username = normalizeUsername(req.body?.username);
  const password = String(req.body?.password || '');

  if (!username || !password) {
    return res.status(400).json({ ok: false, message: 'Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu.' });
  }

  if (username.length < 2 || username.length > 64 || password.length > 128 || /[<>]/.test(username) || /[<>]/.test(password)) {
    return res.status(400).json({ ok: false, message: 'Dữ liệu đăng nhập không hợp lệ.' });
  }

  let account = null;
  try {
    account = await findFirebaseAccountByUsername(username);
  } catch (error) {
    account = null;
  }

  if (!account) {
    const usernameLower = toUsernameLower(username);
    account = getBootstrapAuthAccounts().find((item) => toUsernameLower(item.username) === usernameLower) || null;
  }

  if (!account || !isPasswordMatch(account, password)) {
    return res.status(401).json({ ok: false, message: 'Tên đăng nhập hoặc mật khẩu không đúng.' });
  }

  return res.json({ ok: true, account: sanitizeAccountForClient(account) });
});

// Lưu QR code được tạo vào database
router.post('/qr/save', authenticateRequest, authorizeRole(['admin', 'editor']), validateQRPayload, async (req, res) => {
  try {
    const { ttxe, ncc, noi, hang, mui, vitri1, vitri2, ngay, ma_lo } = req.body;

    if (!ma_lo || !ttxe) {
      return res.status(400).json({ error: 'Thiếu dữ liệu bắt buộc' });
    }

    const pool = await getPool();
    const request = pool.request();

    request.input('ttxe_code', mssql.Char(2), ttxe);
    request.input('nha_cung_cap_code', mssql.Char(3), ncc);
    request.input('noi_san_xuat_code', mssql.Char(2), noi);
    request.input('hang_code', mssql.Char(1), hang);
    request.input('loai_sau_rieng_code', mssql.Char(2), mui);
    request.input('vi_tri_u1', mssql.NVarChar(50), vitri1 || null);
    request.input('vi_tri_u2', mssql.NVarChar(50), vitri2 || null);
    request.input('ngay_nhap', mssql.DateTime2, new Date(ngay));
    request.input('ma_lo', mssql.NVarChar(100), ma_lo);

    await request.query(`
      INSERT INTO [dbo].[lo_san_xuat] (
        [ttxe_code], 
        [nha_cung_cap_code], 
        [noi_san_xuat_code], 
        [hang_code], 
        [loai_sau_rieng_code], 
        [vi_tri_u1], 
        [vi_tri_u2], 
        [ngay_nhap], 
        [ma_lo]
      ) VALUES (
        @ttxe_code, 
        @nha_cung_cap_code, 
        @noi_san_xuat_code, 
        @hang_code, 
        @loai_sau_rieng_code, 
        @vi_tri_u1, 
        @vi_tri_u2, 
        @ngay_nhap, 
        @ma_lo
      )
    `);

    res.json({ success: true, message: 'QR code đã được lưu', ma_lo });
  } catch (err) {
    console.error('Lỗi khi lưu QR:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Lấy danh sách QR code đã tạo
router.get('/qr/list', authenticateRequest, authorizeRole(['admin', 'viewer', 'editor']), async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT 
        [id], 
        [ttxe_code], 
        [nha_cung_cap_code], 
        [noi_san_xuat_code], 
        [hang_code], 
        [loai_sau_rieng_code], 
        [vi_tri_u1], 
        [vi_tri_u2], 
        [ngay_nhap], 
        [ma_lo],
        [created_at]
      FROM [dbo].[lo_san_xuat] 
      ORDER BY [created_at] DESC
    `);
    res.json(result.recordset);
  } catch (err) {
    console.error('Lỗi khi lấy danh sách QR:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const crypto = require('crypto');
const { initializeApp, getApp, getApps } = require('firebase/app');
const { getFirestore, doc, getDoc, setDoc, deleteField } = require('firebase/firestore');

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

function parseBootstrapAccounts() {
  try {
    const raw = JSON.parse(process.env.AUTH_ACCOUNTS_JSON || '[]');
    return Array.isArray(raw) ? raw.filter((item) => item && typeof item === 'object') : [];
  } catch (error) {
    return [];
  }
}

function toUsernameLower(username) {
  return String(username || '').trim().toLowerCase();
}

function toAccountDocId(usernameLower) {
  return usernameLower.replace(/[^a-z0-9._-]/g, '_');
}

function isPBKDF2Hash(value) {
  return typeof value === 'string' && value.startsWith('pbkdf2$');
}

function hashPasswordPBKDF2(password) {
  const iterations = 120000;
  const keyLength = 32;
  const digest = 'sha256';
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.pbkdf2Sync(String(password || ''), salt, iterations, keyLength, digest).toString('hex');
  return `pbkdf2$${digest}$${iterations}$${salt}$${derived}`;
}

function toPasswordHash(account) {
  if (isPBKDF2Hash(account.passwordHash)) {
    return account.passwordHash;
  }
  if (typeof account.password !== 'string' || !account.password) {
    return '';
  }
  return hashPasswordPBKDF2(account.password);
}

function getOrCreateFirebaseApp() {
  const appName = 'bootstrap-sync';
  if (getApps().some((app) => app.name === appName)) {
    return getApp(appName);
  }
  return initializeApp(getFirebaseConfig(), appName);
}

async function syncBootstrapAccountsToFirebase() {
  const accounts = parseBootstrapAccounts();
  if (!accounts.length) {
    return { total: 0, synced: 0, skipped: 0 };
  }

  const app = getOrCreateFirebaseApp();
  const db = getFirestore(app);

  let synced = 0;
  let skipped = 0;

  for (const rawAccount of accounts) {
    const username = String(rawAccount.username || '').trim();
    const usernameLower = toUsernameLower(username);
    if (!usernameLower) {
      skipped += 1;
      continue;
    }

    const docId = toAccountDocId(usernameLower);
    const ref = doc(db, 'accounts', docId);
    const existing = await getDoc(ref);
    const now = new Date().toISOString();
    const payload = {
      username,
      usernameLower,
      role: rawAccount.role || 'viewer',
      page: rawAccount.page || 'viewer.html',
      label: rawAccount.label || rawAccount.page || 'viewer.html',
      permissions: rawAccount.permissions && typeof rawAccount.permissions === 'object'
        ? rawAccount.permissions
        : undefined,
      password: deleteField(),
      passwordHash: toPasswordHash(rawAccount),
      updatedAt: now,
      updatedBy: 'env-bootstrap'
    };

    if (!existing.exists()) {
      payload.createdAt = now;
      payload.createdBy = 'env-bootstrap';
    }

    Object.keys(payload).forEach((key) => payload[key] === undefined && delete payload[key]);
    await setDoc(ref, payload, { merge: true });
    synced += 1;
  }

  return {
    total: accounts.length,
    synced,
    skipped
  };
}

module.exports = {
  syncBootstrapAccountsToFirebase
};

if (require.main === module) {
  syncBootstrapAccountsToFirebase()
    .then(() => {
      console.log('[bootstrap-sync] completed');
      process.exit(0);
    })
    .catch(() => {
      console.error('[bootstrap-sync] failed');
      process.exit(1);
    });
}

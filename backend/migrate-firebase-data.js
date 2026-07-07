require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { initializeApp } = require('firebase/app');
const { getDatabase, ref, get, set } = require('firebase/database');
const {
  getFirestore,
  collection,
  getDocs,
  writeBatch,
  doc,
  setDoc
} = require('firebase/firestore');

function parseCsv(value, fallback = []) {
  if (typeof value !== 'string') return fallback;
  if (!value.trim()) return fallback;
  if (value.trim().toLowerCase() === 'none') return [];
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildConfig(prefix, fallback = {}) {
  return {
    apiKey: process.env[`${prefix}_API_KEY`] || fallback.apiKey || '',
    authDomain: process.env[`${prefix}_AUTH_DOMAIN`] || fallback.authDomain || '',
    databaseURL: process.env[`${prefix}_DATABASE_URL`] || fallback.databaseURL || '',
    projectId: process.env[`${prefix}_PROJECT_ID`] || fallback.projectId || '',
    storageBucket: process.env[`${prefix}_STORAGE_BUCKET`] || fallback.storageBucket || '',
    messagingSenderId: process.env[`${prefix}_MESSAGING_SENDER_ID`] || fallback.messagingSenderId || '',
    appId: process.env[`${prefix}_APP_ID`] || fallback.appId || '',
    measurementId: process.env[`${prefix}_MEASUREMENT_ID`] || fallback.measurementId || ''
  };
}

function assertConfig(config, label) {
  const required = ['apiKey', 'authDomain', 'projectId', 'appId'];
  const missing = required.filter((key) => !config[key]);
  if (missing.length) {
    throw new Error(`${label} config thiếu biến: ${missing.join(', ')}`);
  }
}

async function copyRealtimeDbNode(sourceDb, targetDb, nodePath) {
  const nodeRef = ref(sourceDb, nodePath);
  const timeoutMs = Number.parseInt(process.env.MIGRATE_RTD_TIMEOUT_MS || '12000', 10);
  const snapshot = await Promise.race([
    get(nodeRef),
    new Promise((_, reject) => setTimeout(() => reject(new Error(`RTDB timeout (${timeoutMs}ms)`)), timeoutMs))
  ]);
  if (!snapshot.exists()) {
    console.log(`[RTDB] Bỏ qua ${nodePath}: không có dữ liệu.`);
    return 0;
  }

  const value = snapshot.val();
  await set(ref(targetDb, nodePath), value);

  let estimatedCount = 1;
  if (value && typeof value === 'object') {
    estimatedCount = Object.keys(value).length;
  }
  console.log(`[RTDB] Đã copy ${nodePath}: ~${estimatedCount} bản ghi.`);
  return estimatedCount;
}

async function copyFirestoreCollection(sourceFs, targetFs, collectionName) {
  const snapshot = await getDocs(collection(sourceFs, collectionName));
  if (snapshot.empty) {
    console.log(`[Firestore] Bỏ qua ${collectionName}: không có dữ liệu.`);
    return 0;
  }

  let batch = writeBatch(targetFs);
  let opCount = 0;
  let total = 0;

  for (const item of snapshot.docs) {
    const targetRef = doc(targetFs, collectionName, item.id);
    batch.set(targetRef, item.data(), { merge: true });
    opCount += 1;
    total += 1;

    if (opCount >= 400) {
      await batch.commit();
      batch = writeBatch(targetFs);
      opCount = 0;
    }
  }

  if (opCount > 0) {
    await batch.commit();
  }

  console.log(`[Firestore] Đã copy ${collectionName}: ${total} document(s).`);
  return total;
}

async function migrate() {
  const oldConfig = buildConfig('OLD_FIREBASE', {
    apiKey: process.env.FIREBASE_API_KEY || 'AIzaSyAiuq6ZQGVTnPfaWy6rEa8AAV1lse-ZuaU',
    authDomain: process.env.FIREBASE_AUTH_DOMAIN || 'quanlyindulieu.firebaseapp.com',
    databaseURL: process.env.FIREBASE_DATABASE_URL || 'https://quanlyindulieu-default-rtdb.firebaseio.com',
    projectId: process.env.FIREBASE_PROJECT_ID || 'quanlyindulieu',
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || 'quanlyindulieu.firebasestorage.app',
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || '612738369968',
    appId: process.env.FIREBASE_APP_ID || '1:612738369968:web:21a4cda57ef52f4a22ae75',
    measurementId: process.env.FIREBASE_MEASUREMENT_ID || 'G-1PDWV4R6CP'
  });

  const newConfig = buildConfig('NEW_FIREBASE', {
    apiKey: 'AIzaSyAG-0znzoNCqe_ergYn4NyMdeqACSWiiUE',
    authDomain: 'quanlychanhthu.firebaseapp.com',
    databaseURL: 'https://quanlychanhthu-default-rtdb.firebaseio.com',
    projectId: 'quanlychanhthu',
    storageBucket: 'quanlychanhthu.firebasestorage.app',
    messagingSenderId: '629444573072',
    appId: '1:629444573072:web:ba178b2510d761fc876515',
    measurementId: 'G-SKGDHF0CTT'
  });

  assertConfig(oldConfig, 'OLD_FIREBASE');
  assertConfig(newConfig, 'NEW_FIREBASE');

  const firestoreCollections = parseCsv(
    process.env.MIGRATE_FIRESTORE_COLLECTIONS,
    [
      'accounts',
      'thanhpham',
      'productCounters',
      'printHistory',
      'scanReports',
      'scanLotDetails',
      'viewerQrTokens'
    ]
  );

  const realtimeNodes = parseCsv(process.env.MIGRATE_RTD_NODES, ['qrHistory']);

  console.log('=== FIREBASE MIGRATION START ===');
  console.log(`Source project: ${oldConfig.projectId}`);
  console.log(`Target project: ${newConfig.projectId}`);

  const oldApp = initializeApp(oldConfig, 'migration-old');
  const newApp = initializeApp(newConfig, 'migration-new');

  const oldRtdb = getDatabase(oldApp);
  const newRtdb = getDatabase(newApp);

  const oldFs = getFirestore(oldApp);
  const newFs = getFirestore(newApp);

  let rtdCount = 0;
  for (const nodePath of realtimeNodes) {
    try {
      rtdCount += await copyRealtimeDbNode(oldRtdb, newRtdb, nodePath);
    } catch (error) {
      console.warn(`[RTDB] Bỏ qua ${nodePath}: ${error.message || error}`);
    }
  }

  let fsCount = 0;
  for (const col of firestoreCollections) {
    fsCount += await copyFirestoreCollection(oldFs, newFs, col);
  }

  console.log('=== FIREBASE MIGRATION DONE ===');
  console.log(`Tổng RTDB đã copy (ước lượng): ${rtdCount}`);
  console.log(`Tổng Firestore document đã copy: ${fsCount}`);
}

migrate().catch((error) => {
  console.error('Migration failed:', error.message || error);
  process.exit(1);
});

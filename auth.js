let authAccountsCache = [];

const fallbackAuthAccounts = [
  { username: 'KhuSX', password: '200695', role: 'admin', page: 'index.html', label: 'Admin' },
  { username: 'viewer', password: 'viewer123', role: 'viewer', page: 'viewer.html', label: 'Viewer' },
  { username: 'qr', password: 'qr123', role: 'qr', page: 'TaoQR.html', label: 'QR' }
];

function getCurrentPageName() {
  return window.location.pathname.split('/').pop() || 'index.html';
}

function getCurrentSession() {
  try {
    return JSON.parse(localStorage.getItem('appSession'));
  } catch (error) {
    return null;
  }
}

function saveSession(session) {
  localStorage.setItem('appSession', JSON.stringify(session));
}

function clearSession() {
  localStorage.removeItem('appSession');
}

function getApiBaseUrl() {
  const currentOrigin = window.location.origin;
  if (currentOrigin && currentOrigin !== 'null' && currentOrigin !== 'file://') {
    return currentOrigin;
  }
  return 'http://localhost:3001';
}

function buildApiUrl(path) {
  if (!path) return path;
  if (/^https?:\/\//i.test(path)) return path;
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${getApiBaseUrl()}${normalizedPath}`;
}

async function fetchJson(url, fallback = null) {
  try {
    const response = await fetch(buildApiUrl(url), { cache: 'no-store' });
    if (!response.ok) throw new Error('Request failed');
    return await response.json();
  } catch (error) {
    return fallback;
  }
}

async function getRuntimeConfig() {
  const config = await fetchJson('/api/config', {});
  return config || {};
}

async function getFirebaseAccounts() {
  if (typeof firebase === 'undefined' || !firebase.apps) {
    return [];
  }

  try {
    const config = await getRuntimeConfig();
    const appName = 'auth-firebase';
    if (!firebase.apps.find(app => app.name === appName)) {
      firebase.initializeApp(config || {}, appName);
    }
    const db = firebase.app(appName).firestore();
    const snapshot = await db.collection('accounts').get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    return [];
  }
}

async function getAuthAccounts(forceRefresh = false) {
  if (!forceRefresh && authAccountsCache.length) {
    return authAccountsCache;
  }

  const backendAccounts = await fetchJson('/api/auth/accounts', []);
  const firebaseAccounts = await getFirebaseAccounts();
  const merged = [
    ...(Array.isArray(backendAccounts) ? backendAccounts : []),
    ...(Array.isArray(firebaseAccounts) ? firebaseAccounts : []),
    ...fallbackAuthAccounts
  ];
  const unique = merged.filter((account, index, array) => index === array.findIndex(item => item.username === account.username));
  authAccountsCache = unique;
  return authAccountsCache;
}

async function refreshAuthAccounts() {
  authAccountsCache = [];
  return getAuthAccounts(true);
}

async function loginUser(username, password) {
  const accounts = await getAuthAccounts(true);
  const account = accounts.find(item => item.username === username);
  if (!account || account.password !== password) {
    return { ok: false, message: 'Tên đăng nhập hoặc mật khẩu không đúng.' };
  }

  const session = {
    username: account.username,
    role: account.role,
    page: account.role === 'admin' ? 'quan-ly.html' : (account.page || 'dang-nhap.html'),
    label: account.label
  };
  saveSession(session);
  return { ok: true, account: session };
}

function getCurrentUser() {
  return getCurrentSession();
}

function requirePageAccess(currentPageName = getCurrentPageName()) {
  const session = getCurrentSession();
  if (!session) {
    window.location.href = `dang-nhap.html?redirect=${encodeURIComponent(currentPageName)}`;
    return false;
  }

  const allowedPage = session.page || 'dang-nhap.html';
  if (allowedPage !== currentPageName) {
    window.location.href = allowedPage;
    return false;
  }

  return true;
}

function logoutUser() {
  clearSession();
  window.location.href = 'dang-nhap.html';
}

window.AUTH_ACCOUNTS = authAccountsCache;
window.getCurrentUser = getCurrentUser;
window.getRuntimeConfig = getRuntimeConfig;
window.getAuthAccounts = getAuthAccounts;
window.refreshAuthAccounts = refreshAuthAccounts;
window.loginUser = loginUser;
window.requirePageAccess = requirePageAccess;
window.logoutUser = logoutUser;

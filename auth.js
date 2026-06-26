let authAccountsCache = [];

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

async function fetchJson(url, fallback = null) {
  try {
    const response = await fetch(url, { cache: 'no-store' });
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

async function getAuthAccounts() {
  if (authAccountsCache.length) {
    return authAccountsCache;
  }

  const backendAccounts = await fetchJson('/api/auth/accounts', []);
  const firebaseAccounts = await getFirebaseAccounts();
  const merged = [
    ...(Array.isArray(backendAccounts) ? backendAccounts : []),
    ...(Array.isArray(firebaseAccounts) ? firebaseAccounts : [])
  ];
  const unique = merged.filter((account, index, array) => index === array.findIndex(item => item.username === account.username));
  authAccountsCache = unique;
  return authAccountsCache;
}

async function refreshAuthAccounts() {
  authAccountsCache = [];
  return getAuthAccounts();
}

async function loginUser(username, password) {
  const accounts = await getAuthAccounts();
  const account = accounts.find(item => item.username === username);
  if (!account || account.password !== password) {
    return { ok: false, message: 'Tên đăng nhập hoặc mật khẩu không đúng.' };
  }

  const session = {
    username: account.username,
    role: account.role,
    page: account.page,
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

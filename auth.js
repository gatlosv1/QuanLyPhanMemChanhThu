let authAccountsCache = [];

const pagePermissionTemplates = {
  'index.html': {
    'index.view': true,
    'index.edit': true,
    'index.import': false,
    'index.print': true,
    'index.reprint': true,
    'index.exportReport': true,
    'index.deleteHistory': false,
    'index.resetStt': false
  },
  'TaoQR.html': {
    'qr.create': true,
    'qr.scan': true,
    'qr.history.view': true,
    'qr.history.import': false,
    'qr.history.export': false,
    'qr.history.delete': false
  },
  'viewer.html': {
    'viewer.view': true,
    'viewer.scan': true
  },
  'quan-ly.html': {
    'manager.view': true,
    'manager.createAccount': true,
    'manager.manageAccounts': true
  }
};

function buildDefaultPermissions(page, role) {
  if (role === 'admin') {
    return { '*': true };
  }
  const template = pagePermissionTemplates[page] || {};
  return { ...template };
}

function normalizePermissions(account) {
  if (!account || typeof account !== 'object') return {};
  if (account.role === 'admin') return { '*': true };

  const defaults = buildDefaultPermissions(account.page, account.role);
  const raw = account.permissions && typeof account.permissions === 'object' ? account.permissions : {};
  return { ...defaults, ...raw };
}

function hasPermission(permissionKey) {
  const session = getCurrentSession();
  if (!session) return false;
  if (session.role === 'admin') return true;

  const permissions = session.permissions && typeof session.permissions === 'object' ? session.permissions : {};
  if (permissions['*']) return true;
  return !!permissions[permissionKey];
}

function getCurrentPageName() {
  return window.location.pathname.split('/').pop() || 'index.html';
}

function getCurrentSession() {
  try {
    return JSON.parse(sessionStorage.getItem('appSession'));
  } catch (error) {
    return null;
  }
}

function saveSession(session) {
  sessionStorage.setItem('appSession', JSON.stringify(session));
}

function clearSession() {
  sessionStorage.removeItem('appSession');
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

async function sha256(text) {
  if (typeof crypto === 'undefined' || !crypto.subtle) return '';
  const input = new TextEncoder().encode(String(text || ''));
  const digest = await crypto.subtle.digest('SHA-256', input);
  return Array.from(new Uint8Array(digest)).map(byte => byte.toString(16).padStart(2, '0')).join('');
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

function getPublicFirebaseConfig() {
  const config = window.FIREBASE_CONFIG;
  return config && typeof config === 'object' ? config : {};
}

async function getRuntimeConfig() {
  const config = await fetchJson('/api/config', {});
  return {
    ...getPublicFirebaseConfig(),
    ...(config || {})
  };
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

  const firebaseAccounts = await getFirebaseAccounts();
  const merged = Array.isArray(firebaseAccounts) ? firebaseAccounts : [];

  const dedupedByUsername = new Map();
  merged.forEach((account) => {
    if (!account || !account.username) return;
    dedupedByUsername.set(account.username, account);
  });

  authAccountsCache = Array.from(dedupedByUsername.values()).map((account) => ({
    ...account,
    permissions: normalizePermissions(account)
  }));
  return authAccountsCache;
}

async function refreshAuthAccounts() {
  authAccountsCache = [];
  return getAuthAccounts(true);
}

async function loginUser(username, password) {
  const accounts = await getAuthAccounts(true);
  const account = accounts.find(item => item.username === username);
  if (!account) {
    return { ok: false, message: 'Tên đăng nhập hoặc mật khẩu không đúng.' };
  }

  const candidateHash = await sha256(password);
  const isLegacyPlaintext = typeof account.password === 'string' && account.password === password;
  const isHashMatch = typeof account.passwordHash === 'string' && account.passwordHash === candidateHash;

  if (!isLegacyPlaintext && !isHashMatch) {
    return { ok: false, message: 'Tên đăng nhập hoặc mật khẩu không đúng.' };
  }

  const session = {
    username: account.username,
    role: account.role,
    page: account.role === 'admin' ? 'quan-ly.html' : (account.page || 'dang-nhap.html'),
    label: account.label,
    permissions: normalizePermissions(account)
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
  const isAdmin = session.role === 'admin';
  const isAllowedPage = currentPageName === allowedPage || currentPageName === 'dang-nhap.html';

  if (!isAdmin && !isAllowedPage) {
    window.location.href = allowedPage;
    return false;
  }

  return true;
}

function isSafeRelativePage(targetPage) {
  if (!targetPage || typeof targetPage !== 'string') return false;
  if (targetPage.startsWith('http://') || targetPage.startsWith('https://')) return false;
  if (targetPage.startsWith('//')) return false;
  if (targetPage.includes('..')) return false;
  return /^[A-Za-z0-9._-]+\.html$/.test(targetPage);
}

function resolvePostLoginPage(requestedPage, accountPage) {
  if (isSafeRelativePage(requestedPage)) return requestedPage;
  if (isSafeRelativePage(accountPage)) return accountPage;
  return 'dang-nhap.html';
}

function goToManagementPage() {
  const session = getCurrentSession();
  if (!session) {
    window.location.href = 'dang-nhap.html?redirect=quan-ly.html';
    return;
  }

  window.location.href = 'quan-ly.html';
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
window.goToManagementPage = goToManagementPage;
window.logoutUser = logoutUser;
window.hasPermission = hasPermission;
window.pagePermissionTemplates = pagePermissionTemplates;
window.resolvePostLoginPage = resolvePostLoginPage;

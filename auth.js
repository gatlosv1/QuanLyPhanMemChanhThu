let authAccountsCache = [];
const LOGIN_RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000;
const LOGIN_RATE_LIMIT_MAX_FAILURES = 5;
const LOGIN_RATE_LIMIT_STORAGE_KEY = 'authLoginRateLimit';
const LOGIN_LAST_USERNAME_KEY = 'authLastLoginUsername';

const pagePermissionTemplates = {
  'index.html': {
    'index.view': true,
    'index.edit': true,
    'index.selectLot': true,
    'index.selectProduct': true,
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
    'manager.manageAccounts': true,
    'manager.viewCredentials': false,
    'manager.changePassword': false,
    'manager.backup': false
  }
};

function buildDefaultPermissions(page, role) {
  if (role === 'admin' || role === 'dev') {
    return { '*': true };
  }
  const template = pagePermissionTemplates[page] || {};
  return { ...template };
}

function normalizePermissions(account) {
  if (!account || typeof account !== 'object') return {};
  if (account.role === 'admin' || account.role === 'dev') return { '*': true };

  const defaults = buildDefaultPermissions(account.page, account.role);
  const raw = account.permissions && typeof account.permissions === 'object' ? account.permissions : {};
  return { ...defaults, ...raw };
}

function getLoginRateLimitKey(username) {
  return String(username || '').trim().toLowerCase();
}

function readLoginRateLimitState() {
  try {
    return JSON.parse(localStorage.getItem(LOGIN_RATE_LIMIT_STORAGE_KEY) || '{}') || {};
  } catch (error) {
    return {};
  }
}

function writeLoginRateLimitState(state) {
  try {
    localStorage.setItem(LOGIN_RATE_LIMIT_STORAGE_KEY, JSON.stringify(state || {}));
  } catch (error) {
    // Ignore storage failures in restricted browser contexts.
  }
}

function pruneLoginAttempts(attempts, now = Date.now()) {
  return (Array.isArray(attempts) ? attempts : []).filter((timestamp) => {
    return Number.isFinite(timestamp) && now - timestamp < LOGIN_RATE_LIMIT_WINDOW_MS;
  });
}

function getLoginRateLimitStatus(username) {
  const key = getLoginRateLimitKey(username);
  if (!key) {
    return { blocked: false, retryAfterMs: 0, remainingAttempts: LOGIN_RATE_LIMIT_MAX_FAILURES };
  }

  const state = readLoginRateLimitState();
  const now = Date.now();
  const attempts = pruneLoginAttempts(state[key], now);
  state[key] = attempts;
  writeLoginRateLimitState(state);

  if (attempts.length >= LOGIN_RATE_LIMIT_MAX_FAILURES) {
    const oldestAttempt = attempts[0];
    const retryAfterMs = Math.max(0, LOGIN_RATE_LIMIT_WINDOW_MS - (now - oldestAttempt));
    return {
      blocked: true,
      retryAfterMs,
      remainingAttempts: 0
    };
  }

  return {
    blocked: false,
    retryAfterMs: 0,
    remainingAttempts: LOGIN_RATE_LIMIT_MAX_FAILURES - attempts.length
  };
}

function recordLoginFailure(username) {
  const key = getLoginRateLimitKey(username);
  if (!key) return getLoginRateLimitStatus(username);

  const state = readLoginRateLimitState();
  const now = Date.now();
  const attempts = pruneLoginAttempts(state[key], now);
  attempts.push(now);
  state[key] = attempts;
  writeLoginRateLimitState(state);
  try {
    localStorage.setItem(LOGIN_LAST_USERNAME_KEY, String(username || '').trim());
  } catch (error) {
    // Ignore storage failures in restricted browser contexts.
  }

  return getLoginRateLimitStatus(username);
}

function clearLoginFailures(username) {
  const key = getLoginRateLimitKey(username);
  if (!key) return;

  const state = readLoginRateLimitState();
  if (Object.prototype.hasOwnProperty.call(state, key)) {
    delete state[key];
    writeLoginRateLimitState(state);
  }

  try {
    const lastUsername = String(localStorage.getItem(LOGIN_LAST_USERNAME_KEY) || '').trim().toLowerCase();
    if (lastUsername === key) {
      localStorage.removeItem(LOGIN_LAST_USERNAME_KEY);
    }
  } catch (error) {
    // Ignore storage failures in restricted browser contexts.
  }
}

function validateLoginInput(username, password) {
  const normalizedUsername = typeof username === 'string' ? username.trim() : '';
  const normalizedPassword = typeof password === 'string' ? password : '';

  if (!normalizedUsername || !normalizedPassword) {
    return { ok: false, message: 'Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu.' };
  }

  if (normalizedUsername.length < 2 || normalizedUsername.length > 64) {
    return { ok: false, message: 'Tên đăng nhập không hợp lệ.' };
  }

  if (normalizedPassword.length > 128) {
    return { ok: false, message: 'Mật khẩu không hợp lệ.' };
  }

  if (/[<>]/.test(normalizedUsername) || /[<>]/.test(normalizedPassword)) {
    return { ok: false, message: 'Dữ liệu đăng nhập không hợp lệ.' };
  }

  return {
    ok: true,
    username: normalizedUsername,
    password: normalizedPassword
  };
}

function getLastLoginUsername() {
  try {
    return String(localStorage.getItem(LOGIN_LAST_USERNAME_KEY) || '').trim();
  } catch (error) {
    return '';
  }
}

function hasPermission(permissionKey) {
  const session = getCurrentSession();
  if (!session) return false;
  if (session.role === 'admin' || session.role === 'dev') return true;

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

async function fetchJson(url, fallback = null, timeoutMs = 3000) {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  let timeoutId = null;

  if (controller) {
    timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  }

  try {
    const response = await fetch(buildApiUrl(url), {
      cache: 'no-store',
      signal: controller ? controller.signal : undefined
    });
    if (!response.ok) throw new Error('Request failed');
    return await response.json();
  } catch (error) {
    return fallback;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

function getPublicFirebaseConfig() {
  const config = window.FIREBASE_CONFIG;
  return config && typeof config === 'object' ? config : {};
}

async function getRuntimeConfig() {
  const config = await fetchJson('/api/config', null, 2500);
  return {
    ...getPublicFirebaseConfig(),
    ...(config && typeof config === 'object' ? config : {})
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
  const validation = validateLoginInput(username, password);
  if (!validation.ok) {
    return { ok: false, message: validation.message };
  }

  const rateLimitStatus = getLoginRateLimitStatus(validation.username);
  if (rateLimitStatus.blocked) {
    const retryAfterSeconds = Math.max(1, Math.ceil(rateLimitStatus.retryAfterMs / 1000));
    return {
      ok: false,
      message: `Bạn đã thử đăng nhập quá nhiều lần. Vui lòng chờ ${retryAfterSeconds} giây rồi thử lại.`
    };
  }

  const accounts = await getAuthAccounts(true);
  if (!accounts.length) {
    return { ok: false, message: 'Chưa có tài khoản đăng nhập hoặc không đọc được dữ liệu tài khoản từ Firebase.' };
  }

  const account = accounts.find(item => item.username === validation.username);
  if (!account) {
    recordLoginFailure(validation.username);
    return { ok: false, message: 'Tên đăng nhập hoặc mật khẩu không đúng.' };
  }

  const candidateHash = await sha256(validation.password);
  const isLegacyPlaintext = typeof account.password === 'string' && account.password === validation.password;
  const isHashMatch = typeof account.passwordHash === 'string' && account.passwordHash === candidateHash;

  if (!isLegacyPlaintext && !isHashMatch) {
    const updatedRateLimit = recordLoginFailure(validation.username);
    if (updatedRateLimit.blocked) {
      const retryAfterSeconds = Math.max(1, Math.ceil(updatedRateLimit.retryAfterMs / 1000));
      return {
        ok: false,
        message: `Bạn đã thử đăng nhập quá nhiều lần. Vui lòng chờ ${retryAfterSeconds} giây rồi thử lại.`
      };
    }
    return { ok: false, message: 'Tên đăng nhập hoặc mật khẩu không đúng.' };
  }

  clearLoginFailures(validation.username);

  const session = {
    username: account.username,
    role: account.role,
    page: (account.role === 'admin' || account.role === 'dev') ? 'quan-ly.html' : (account.page || 'dang-nhap.html'),
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
  const isSuperUser = session.role === 'admin' || session.role === 'dev';
  const isAllowedPage = currentPageName === allowedPage || currentPageName === 'dang-nhap.html';

  if (!isSuperUser && !isAllowedPage) {
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
window.validateLoginInput = validateLoginInput;
window.getLoginRateLimitStatus = getLoginRateLimitStatus;
window.getLastLoginUsername = getLastLoginUsername;
window.requirePageAccess = requirePageAccess;
window.goToManagementPage = goToManagementPage;
window.logoutUser = logoutUser;
window.hasPermission = hasPermission;
window.pagePermissionTemplates = pagePermissionTemplates;
window.resolvePostLoginPage = resolvePostLoginPage;

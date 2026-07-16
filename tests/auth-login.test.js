const fs = require('fs');
const path = require('path');
const vm = require('vm');

class LocalStorageMock {
  constructor() {
    this.store = {};
  }
  getItem(key) {
    return Object.prototype.hasOwnProperty.call(this.store, key) ? this.store[key] : null;
  }
  setItem(key, value) {
    this.store[key] = String(value);
  }
  removeItem(key) {
    delete this.store[key];
  }
}

function createContext(initialPath = '/dang-nhap.html') {
  const localStorage = new LocalStorageMock();
  const sessionStorage = new LocalStorageMock();
  const context = {
    console,
    localStorage,
    sessionStorage,
    TextEncoder,
    URLSearchParams,
    window: {
      location: { pathname: initialPath, origin: 'http://localhost', href: `http://localhost${initialPath}` }
    },
    fetch: async () => ({ ok: false, json: async () => ({}) }),
    setTimeout,
    clearTimeout
  };
  context.global = context;
  context.self = context;
  return { context, localStorage, sessionStorage };
}

(async () => {
  const { context } = createContext();
  context.fetch = async (url, options = {}) => {
    if (String(url).includes('/api/auth/login') && options.method === 'POST') {
      return {
        ok: true,
        json: async () => ({
          ok: true,
          account: {
            username: 'KhuSX',
            role: 'admin',
            page: 'quan-ly.html',
            permissions: { '*': true }
          }
        })
      };
    }
    return { ok: false, json: async () => ({}) };
  };

  const code = fs.readFileSync(path.join(__dirname, '..', 'auth.js'), 'utf8');
  vm.runInContext(code, vm.createContext(context));

  const result = await context.window.loginUser('KhuSX', '200695');
  if (!result.ok) {
    throw new Error(`Expected backend login to succeed, got: ${JSON.stringify(result)}`);
  }

  const adminAccess = context.window.requirePageAccess('index.html');
  if (adminAccess !== true) {
    throw new Error('Expected admin to access other pages');
  }

  console.log('backend login test passed');
})().catch((error) => {
  console.error(error.message);
  process.exit(1);
});

(async () => {
  const { context } = createContext();
  context.fetch = async (url, options = {}) => {
    if (String(url).includes('/api/auth/login') && options.method === 'POST') {
      return {
        ok: true,
        json: async () => ({
          ok: true,
          account: {
            username: 'viewer',
            role: 'viewer',
            page: 'viewer.html',
            permissions: { 'viewer.view': true }
          }
        })
      };
    }
    return { ok: false, json: async () => ({}) };
  };

  const code = fs.readFileSync(path.join(__dirname, '..', 'auth.js'), 'utf8');
  vm.runInContext(code, vm.createContext(context));

  const result = await context.window.loginUser('viewer', '123456');
  if (!result.ok) {
    throw new Error(`Expected backend login to succeed, got: ${JSON.stringify(result)}`);
  }

  const safePage = context.window.resolvePostLoginPage('https://evil.example/phish', result.account.page);
  if (safePage !== 'viewer.html') {
    throw new Error(`Expected unsafe redirect to be blocked, got ${safePage}`);
  }

  console.log('safe redirect test passed');
})().catch((error) => {
  console.error(error.message);
  process.exit(1);
});

(async () => {
  const { context } = createContext();
  context.fetch = async (url, options = {}) => {
    if (String(url).includes('/api/auth/login') && options.method === 'POST') {
      return {
        ok: false,
        json: async () => ({ ok: false, message: 'Tên đăng nhập hoặc mật khẩu không đúng.' })
      };
    }
    return { ok: false, json: async () => ({}) };
  };

  const code = fs.readFileSync(path.join(__dirname, '..', 'auth.js'), 'utf8');
  vm.runInContext(code, vm.createContext(context));

  const validation = context.window.validateLoginInput(' ', 'secret');
  if (validation.ok || validation.message !== 'Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu.') {
    throw new Error(`Expected empty username to fail validation, got: ${JSON.stringify(validation)}`);
  }

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const result = await context.window.loginUser('KhuSX', 'wrong-password');
    if (attempt < 4 && result.message.includes('quá nhiều lần')) {
      throw new Error(`Rate limit triggered too early: ${JSON.stringify(result)}`);
    }
  }

  const blockedResult = await context.window.loginUser('KhuSX', 'wrong-password');
  if (blockedResult.ok || !blockedResult.message.includes('quá nhiều lần')) {
    throw new Error(`Expected login rate limit to block after repeated failures, got: ${JSON.stringify(blockedResult)}`);
  }

  console.log('login validation and rate limit test passed');
})().catch((error) => {
  console.error(error.message);
  process.exit(1);
});

(async () => {
  const { context } = createContext('/viewer.html');
  const code = fs.readFileSync(path.join(__dirname, '..', 'auth.js'), 'utf8');
  vm.runInContext(code, vm.createContext(context));

  context.sessionStorage.setItem('appSession', JSON.stringify({ username: 'viewer', role: 'viewer', page: 'viewer.html' }));

  const allowed = context.window.requirePageAccess('quan-ly.html');
  if (allowed !== false) {
    throw new Error('Expected viewer to be redirected away from management page');
  }

  if (context.window.location.href !== 'viewer.html') {
    throw new Error(`Expected redirect to allowed page, got ${context.window.location.href}`);
  }

  console.log('management page restriction test passed');
})().catch((error) => {
  console.error(error.message);
  process.exit(1);
});

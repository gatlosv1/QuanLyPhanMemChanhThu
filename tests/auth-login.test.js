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
  const context = {
    console,
    localStorage,
    window: {
      location: { pathname: initialPath, origin: 'http://localhost', href: `http://localhost${initialPath}` },
      AUTH_ACCOUNTS: []
    },
    fetch: async () => ({ ok: false, json: async () => ({}) }),
    setTimeout,
    clearTimeout
  };
  context.global = context;
  context.self = context;
  return { context, localStorage };
}

(async () => {
  const { context } = createContext();
  const code = fs.readFileSync(path.join(__dirname, '..', 'auth.js'), 'utf8');
  vm.runInContext(code, vm.createContext(context));

  const result = await context.window.loginUser('KhuSX', '200695');
  if (!result.ok) {
    throw new Error(`Expected login to succeed, got: ${JSON.stringify(result)}`);
  }

  const adminAccess = context.window.requirePageAccess('index.html');
  if (adminAccess !== true) {
    throw new Error('Expected admin to access other pages');
  }

  console.log('auth fallback login test passed');
})().catch((error) => {
  console.error(error.message);
  process.exit(1);
});

(async () => {
  const { context, localStorage } = createContext();
  context.fetch = async () => ({
    ok: true,
    json: async () => ([{ username: 'KhuSX', password: 'wrong-pass', role: 'viewer', page: 'viewer.html' }])
  });

  const code = fs.readFileSync(path.join(__dirname, '..', 'auth.js'), 'utf8');
  vm.runInContext(code, vm.createContext(context));

  const result = await context.window.loginUser('KhuSX', '200695');
  if (!result.ok) {
    throw new Error(`Expected fallback admin account to win over conflicting remote account data, got: ${JSON.stringify(result)}`);
  }

  const session = JSON.parse(localStorage.getItem('appSession'));
  if (session.role !== 'admin') {
    throw new Error('Expected admin role to be preserved for fallback account');
  }

  console.log('auth fallback precedence test passed');
})().catch((error) => {
  console.error(error.message);
  process.exit(1);
});

(async () => {
  const { context } = createContext('/viewer.html');
  const code = fs.readFileSync(path.join(__dirname, '..', 'auth.js'), 'utf8');
  vm.runInContext(code, vm.createContext(context));

  context.localStorage.setItem('appSession', JSON.stringify({ username: 'viewer', role: 'viewer', page: 'viewer.html' }));

  const allowed = context.window.requirePageAccess('quan-ly.html');
  if (allowed !== true) {
    throw new Error('Expected authenticated viewer to access the management page via the back link');
  }

  if (context.window.location.href !== 'http://localhost/viewer.html') {
    throw new Error('Expected no redirect when opening the management page from a back link');
  }

  console.log('management back-link access test passed');
})().catch((error) => {
  console.error(error.message);
  process.exit(1);
});

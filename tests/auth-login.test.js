const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');

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
    crypto: {
      subtle: {
        digest: async (algorithm, data) => {
          if (algorithm !== 'SHA-256') throw new Error('Unsupported algorithm');
          const buffer = Buffer.from(data);
          const hash = crypto.createHash('sha256').update(buffer).digest();
          return hash.buffer.slice(hash.byteOffset, hash.byteOffset + hash.byteLength);
        }
      }
    },
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
  return { context, localStorage, sessionStorage };
}

(async () => {
  const { context } = createContext();
  const hash = crypto.createHash('sha256').update('200695').digest('hex');
  context.fetch = async () => ({
    ok: true,
    json: async () => ({})
  });
  context.firebase = {
    apps: [],
    initializeApp: (_config, name = '[DEFAULT]') => {
      const app = { name, firestore: () => ({ collection: () => ({ get: async () => ({ docs: [{ id: '1', data: () => ({ username: 'KhuSX', passwordHash: hash, role: 'admin', page: 'quan-ly.html' }) }] }) }) }) };
      context.firebase.apps.push(app);
      return app;
    },
    app: (name = '[DEFAULT]') => context.firebase.apps.find((item) => item.name === name)
  };

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
  const { context } = createContext();
  const hash = crypto.createHash('sha256').update('200695').digest('hex');
  context.fetch = async () => ({ ok: true, json: async () => ({}) });
  context.firebase = {
    apps: [],
    initializeApp: (_config, name = '[DEFAULT]') => {
      const app = { name, firestore: () => ({ collection: () => ({ get: async () => ({ docs: [{ id: '1', data: () => ({ username: 'KhuSX', passwordHash: hash, role: 'viewer', page: 'viewer.html' }) }] }) }) }) };
      context.firebase.apps.push(app);
      return app;
    },
    app: (name = '[DEFAULT]') => context.firebase.apps.find((item) => item.name === name)
  };

  const code = fs.readFileSync(path.join(__dirname, '..', 'auth.js'), 'utf8');
  vm.runInContext(code, vm.createContext(context));

  const result = await context.window.loginUser('KhuSX', '200695');
  if (!result.ok) {
    throw new Error(`Expected hash-based login to succeed, got: ${JSON.stringify(result)}`);
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
  context.fetch = async (url) => ({
    ok: true,
    json: async () => {
      if (String(url).includes('/api/auth/accounts')) {
        return [{ username: 'env-admin', password: 'env-secret', role: 'admin', page: 'quan-ly.html' }];
      }
      return {};
    }
  });
  context.firebase = {
    apps: [],
    initializeApp: () => ({ firestore: () => ({ collection: () => ({ get: async () => ({ docs: [] }) }) }) }),
    app: () => ({ firestore: () => ({ collection: () => ({ get: async () => ({ docs: [] }) }) }) })
  };

  const code = fs.readFileSync(path.join(__dirname, '..', 'auth.js'), 'utf8');
  vm.runInContext(code, vm.createContext(context));

  const result = await context.window.loginUser('env-admin', 'env-secret');
  if (!result.ok) {
    throw new Error(`Expected env fallback login to succeed, got: ${JSON.stringify(result)}`);
  }

  console.log('env fallback login test passed');
})().catch((error) => {
  console.error(error.message);
  process.exit(1);
});

(async () => {
  const { context } = createContext();
  context.fetch = async () => ({ ok: true, json: async () => ({}) });
  context.firebase = {
    apps: [],
    initializeApp: (_config, name = '[DEFAULT]') => {
      const app = { name, firestore: () => ({ collection: () => ({ get: async () => ({ docs: [{ id: '1', data: () => ({ username: 'KhuSX', passwordHash: crypto.createHash('sha256').update('200695').digest('hex'), role: 'viewer', page: 'viewer.html' }) }] }) }) }) };
      context.firebase.apps.push(app);
      return app;
    },
    app: (name = '[DEFAULT]') => context.firebase.apps.find((item) => item.name === name)
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

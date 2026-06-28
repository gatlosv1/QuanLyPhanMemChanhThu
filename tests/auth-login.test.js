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

(async () => {
  const context = {
    console,
    localStorage: new LocalStorageMock(),
    window: {
      location: { pathname: '/dang-nhap.html', origin: 'http://localhost', href: 'http://localhost/dang-nhap.html' },
      AUTH_ACCOUNTS: []
    },
    fetch: async () => ({ ok: false, json: async () => ({}) }),
    setTimeout,
    clearTimeout
  };
  context.global = context;
  context.self = context;

  const code = fs.readFileSync(path.join(__dirname, '..', 'auth.js'), 'utf8');
  vm.runInContext(code, vm.createContext(context));

  const result = await context.window.loginUser('KhuSX', '200695');
  if (!result.ok) {
    throw new Error(`Expected login to succeed, got: ${JSON.stringify(result)}`);
  }

  console.log('auth fallback login test passed');
})().catch((error) => {
  console.error(error.message);
  process.exit(1);
});

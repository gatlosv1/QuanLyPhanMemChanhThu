require('dotenv').config();

const express = require('express');
const path = require('path');
const cors = require('cors');
const { connectDB } = require('./db');
const apiRoutes = require('./routes/api');
const { rateLimit } = require('./security');

const app = express();
const PORT = process.env.PORT || 3001;
const rootDir = path.join(__dirname, '..');

function getEnv(name, fallback = '') {
  return process.env[name] || fallback;
}

function getRuntimeSettings() {
  return {
    resetPassword: getEnv('RESET_PASSWORD', ''),
    historyPassword: getEnv('HISTORY_PASSWORD', ''),
    deletePassword: getEnv('DELETE_PASSWORD', '')
  };
}

function getAuthAccounts() {
  const raw = getEnv('AUTH_ACCOUNTS_JSON', getEnv('AUTH_ACCOUNTS', '[]'));
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

// Middleware
app.use(cors());
app.use(express.json());
app.use(rateLimit({ windowMs: 60 * 1000, maxRequests: 60 }));
app.use(express.static(rootDir));

// Runtime config endpoints
app.get('/api/config', (req, res) => {
  res.json(getRuntimeSettings());
});

app.get('/api/auth/accounts', (req, res) => {
  res.json(getAuthAccounts());
});

// API Routes
app.use('/api', apiRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK' });
});

app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) return res.status(404).json({ error: 'Not found' });
  res.sendFile(path.join(rootDir, 'index.html'));
});

// Start server
async function start() {
  try {
    await connectDB();
  } catch (err) {
    console.warn('⚠️ Không thể kết nối SQL Server, vẫn tiếp tục chạy backend cho đăng nhập/auth:', err.message);
  }

  app.listen(PORT, () => {
    console.log(`✓ Server chạy tại http://localhost:${PORT}`);
  });
}

start();

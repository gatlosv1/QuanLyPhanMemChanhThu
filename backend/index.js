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

function getFirebasePublicEnv() {
  return {
    FIREBASE_API_KEY: process.env.FIREBASE_API_KEY || '',
    FIREBASE_AUTH_DOMAIN: process.env.FIREBASE_AUTH_DOMAIN || '',
    FIREBASE_DATABASE_URL: process.env.FIREBASE_DATABASE_URL || '',
    FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID || '',
    FIREBASE_STORAGE_BUCKET: process.env.FIREBASE_STORAGE_BUCKET || '',
    FIREBASE_MESSAGING_SENDER_ID: process.env.FIREBASE_MESSAGING_SENDER_ID || '',
    FIREBASE_APP_ID: process.env.FIREBASE_APP_ID || '',
    FIREBASE_MEASUREMENT_ID: process.env.FIREBASE_MEASUREMENT_ID || ''
  };
}

function getAllowedOrigins() {
  const raw = process.env.CORS_ORIGINS || 'http://localhost:3001,http://127.0.0.1:3001';
  return raw.split(',').map(item => item.trim()).filter(Boolean);
}

// Middleware
const allowedOrigins = new Set(getAllowedOrigins());
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.has(origin)) return callback(null, true);
    return callback(new Error('CORS blocked'));
  }
}));
app.use(express.json());
app.use(rateLimit({ windowMs: 60 * 1000, maxRequests: 60 }));

app.get('/env.js', (req, res) => {
  const envJson = JSON.stringify(getFirebasePublicEnv());
  res.type('application/javascript').send(`window.__ENV__ = ${envJson};`);
});

app.use(express.static(rootDir));

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

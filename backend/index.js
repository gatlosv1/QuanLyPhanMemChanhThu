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

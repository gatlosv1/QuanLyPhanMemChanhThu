const mssql = require('mssql');

const config = {
  server: process.env.DB_SERVER || 'localhost',
  database: process.env.DB_NAME || 'QuanLyTraiCay',
  authentication: {
    type: 'default',
    options: {
      userName: process.env.DB_USER || 'sa',
      password: process.env.DB_PASSWORD || ''
    }
  },
  options: {
    encrypt: true,
    trustServerCertificate: true,
    connectionTimeout: 30000,
    requestTimeout: 30000
  }
};

let pool;

async function connectDB() {
  try {
    pool = new mssql.ConnectionPool(config);
    await pool.connect();
    console.log('✓ Kết nối SQL Server thành công');
    return pool;
  } catch (err) {
    console.error('✗ Lỗi kết nối SQL Server:', err.message);
    throw err;
  }
}

async function getPool() {
  if (!pool) {
    await connectDB();
  }
  return pool;
}

module.exports = { connectDB, getPool, mssql };

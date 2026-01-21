const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

// Detect whether to use DATABASE_URL (prod) or discrete PG_* vars (dev)
const useUrl = !!process.env.DATABASE_URL;
const sslEnabled = String(process.env.DB_SSL || '').trim().toLowerCase() === 'true';

const baseConfig = useUrl
  ? {
      connectionString: process.env.DATABASE_URL,
    }
  : {
      host: process.env.PG_HOST,
      port: Number(process.env.PG_PORT || 5432),
      database: process.env.PG_DATABASE,
      user: process.env.PG_USER,
      password: process.env.PG_PASSWORD,
    };

const pool = new Pool({
  ...baseConfig,
  ssl: sslEnabled ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 20000,
});

// Debug info (safe redaction for logs)
const redact = (s) =>
  s?.replace(/\/\/([^:]+):([^@]+)@/, (_m, u, p) => `//${u}:${'*'.repeat(Math.min(8, p.length))}@`);
console.log('🗄️  Using DATABASE_URL?', useUrl);
if (useUrl) {
  console.log('   → URL:', redact(process.env.DATABASE_URL));
} else {
  console.log('   → Host:', process.env.PG_HOST, '| DB:', process.env.PG_DATABASE, '| User:', process.env.PG_USER);
}
console.log('   → SSL enabled:', sslEnabled);

// Test the connection
const testConnection = async () => {
  try {
    const client = await pool.connect();
    console.log('✅ Database connection successful!');
    client.release();
  } catch (error) {
    console.error('❌ Database connection failed!', error.message);
  }
};

testConnection();

// Query helper
const query = async (text, params) => {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  console.log('executed query', { text, duration, rows: res.rowCount });
  return res;
};

module.exports = { query, pool };

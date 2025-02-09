const { Pool } = require('pg');
require('dotenv').config();

const sslConfig = process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: sslConfig,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});


const testConnection = async () => {
  try {
    const client = await pool.connect();
    console.log("✅ Database connection successful!");
    client.release();
  } catch (error) {
    console.error("❌ Database connection failed!", error);
  }
};


testConnection();

const query = async (text, params) => {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  console.log('executed query', { text, duration, rows: res.rowCount });
  return res;
};

module.exports = { query, pool };

/* ============================================================
   SmartPlan — singleton pool для PostgreSQL
   ============================================================ */
'use strict';

const { Pool } = require('pg');

let _pool = null;

function getPool() {
  if (_pool) return _pool;
  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) throw new Error('DATABASE_URL не задан');
  _pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' || process.env.RENDER
      ? { rejectUnauthorized: false }
      : false,
    max: 10,
    idleTimeoutMillis: 30000
  });
  _pool.on('error', (e) => console.error('PG pool error', e.message));
  return _pool;
}

module.exports = { getPool };
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  // Force the password to be a string, even if it's undefined or a number
  password: String(process.env.DB_PASSWORD || ''), 
  port: process.env.DB_PORT || 5432,
});

module.exports = pool;

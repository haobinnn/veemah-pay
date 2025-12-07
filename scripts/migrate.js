const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Load env vars roughly (since dotenv might not be set up for this script context)
// Use process.env.DATABASE_URL if available.
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("DATABASE_URL is not defined in the environment.");
  process.exit(1);
}

const pool = new Pool({ connectionString });

async function migrate() {
  try {
    const sqlPath = path.join(__dirname, '../db/migrations/005_add_password.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    console.log('Running migration...');
    await pool.query(sql);
    console.log('Migration complete.');
  } catch (e) {
    console.error('Migration failed:', e);
  } finally {
    await pool.end();
  }
}

migrate();

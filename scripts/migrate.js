const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../.env.local') });
require('dotenv').config({ path: path.join(__dirname, '../.env') });
require('dotenv').config({ path: path.join(__dirname, '../.env.example') });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("DATABASE_URL is not defined in the environment.");
  process.exit(1);
}

const pool = new Pool({ connectionString });

async function migrate() {
  try {
    const migrationsDir = path.join(__dirname, '../db/migrations');
    const files = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort((a, b) => a.localeCompare(b));

    for (const file of files) {
      const sqlPath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(sqlPath, 'utf8');
      console.log(`Running migration: ${file}`);
      await pool.query(sql);
    }

    console.log('All migrations complete.');
  } catch (e) {
    console.error('Migration failed:', e);
  } finally {
    await pool.end();
  }
}

migrate();

import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  // Fail fast in dev so it's obvious why API calls fail
  throw new Error('Missing DATABASE_URL environment variable.');
}

export const pool = new Pool({ connectionString });

export type Account = {
  account_number: string;
  name: string;
  balance: number;
  status: 'Active' | 'Locked';
};
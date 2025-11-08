import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export async function GET() {
  try {
    const result = await pool.query(
      'SELECT account_number, name, balance::float AS balance, status FROM accounts ORDER BY account_number'
    );
    return NextResponse.json({ accounts: result.rows });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Server error' }, { status: 500 });
  }
}
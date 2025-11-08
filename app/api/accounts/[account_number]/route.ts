import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export async function GET(_req: NextRequest, { params }: { params: { account_number: string } }) {
  const { account_number } = params;
  try {
    const result = await pool.query(
      'SELECT account_number, name, balance::float AS balance, status FROM accounts WHERE account_number = $1',
      [account_number]
    );
    if (result.rowCount === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ account: result.rows[0] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Server error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { account_number: string } }) {
  const { account_number } = params;
  const body = await req.json();
  const { op, amount, name, status } = body;

  // Admin edit path: update name and/or status
  if (typeof name === 'string' || typeof status === 'string') {
    const session = req.cookies.get('session')?.value;
    if (session !== '0000') {
      return NextResponse.json({ error: 'Admin privileges required.' }, { status: 403 });
    }
    if (status && status !== 'Active' && status !== 'Locked') {
      return NextResponse.json({ error: 'Status must be Active or Locked.' }, { status: 400 });
    }
    try {
      // Detect optional failed_attempts column to avoid errors on older DBs
      const colCheck = await pool.query(
        `SELECT 1 FROM information_schema.columns WHERE table_name = 'accounts' AND column_name = 'failed_attempts'`
      );
      const hasFailedAttempts = Number(colCheck?.rowCount ?? 0) > 0;

      const existing = await pool.query('SELECT account_number FROM accounts WHERE account_number = $1', [account_number]);
      if (existing.rowCount === 0) return NextResponse.json({ error: 'Account not found' }, { status: 404 });
      const updates: string[] = [];
      const paramsArr: any[] = [];
      let idx = 1;
      if (typeof name === 'string') {
        updates.push(`name = $${idx++}`);
        paramsArr.push(name);
      }
      if (typeof status === 'string') {
        updates.push(`status = $${idx++}`);
        paramsArr.push(status);
        // If unlocking, also reset failed_attempts
        if (status === 'Active' && hasFailedAttempts) {
          updates.push(`failed_attempts = 0`);
        }
      }
      paramsArr.push(account_number);
      const sql = `UPDATE accounts SET ${updates.join(', ')} WHERE account_number = $${idx} RETURNING account_number, name, balance::float AS balance, status`;
      const res = await pool.query(sql, paramsArr);
      return NextResponse.json({ account: res.rows[0] });
    } catch (err: any) {
      return NextResponse.json({ error: err.message ?? 'Server error' }, { status: 500 });
    }
  }

  // Deposit/withdraw path
  if (op !== 'deposit' && op !== 'withdraw') {
    return NextResponse.json({ error: 'Invalid op. Use deposit or withdraw.' }, { status: 400 });
  }
  if (typeof amount !== 'number' || amount <= 0) {
    return NextResponse.json({ error: 'Amount must be a positive number.' }, { status: 400 });
  }

  try {
    const current = await pool.query('SELECT status, balance::float AS balance FROM accounts WHERE account_number = $1', [account_number]);
    if (current.rowCount === 0) return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    const { status: currStatus, balance } = current.rows[0];
    if (currStatus === 'Locked') return NextResponse.json({ error: 'Account locked' }, { status: 403 });

    if (op === 'deposit') {
      if (amount < 100) return NextResponse.json({ error: 'Deposit minimum is 100.' }, { status: 400 });
      const res = await pool.query(
        'UPDATE accounts SET balance = balance + $1 WHERE account_number = $2 RETURNING account_number, name, balance::float AS balance, status',
        [amount, account_number]
      );
      return NextResponse.json({ account: res.rows[0] });
    } else {
      if (amount < 100) return NextResponse.json({ error: 'Withdrawal minimum is 100.' }, { status: 400 });
      if (amount > balance) return NextResponse.json({ error: 'Insufficient funds.' }, { status: 400 });
      const res = await pool.query(
        'UPDATE accounts SET balance = balance - $1 WHERE account_number = $2 RETURNING account_number, name, balance::float AS balance, status',
        [amount, account_number]
      );
      return NextResponse.json({ account: res.rows[0] });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Server error' }, { status: 500 });
  }
}
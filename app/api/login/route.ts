import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';

const LOCK_THRESHOLD = 3; // number of failed PIN attempts before lock

export async function POST(req: NextRequest) {
  const { account_number, pin } = await req.json();

  if (!account_number || !pin) {
    return NextResponse.json({ error: 'Account number and PIN are required.' }, { status: 400 });
  }

  try {
    // Detect whether the failed_attempts column exists to avoid crashes on older DBs
    const colCheck = await pool.query(
      `SELECT 1 FROM information_schema.columns WHERE table_name = 'accounts' AND column_name = 'failed_attempts'`
    );
    const hasFailedAttempts = Number(colCheck?.rowCount ?? 0) > 0;

    const result = await pool.query(
      'SELECT account_number, name, balance::float AS balance, status, pin FROM accounts WHERE account_number = $1',
      [account_number]
    );

    if (result.rowCount === 0) {
      return NextResponse.json({ error: 'Invalid account number.' }, { status: 401 });
    }

    const row = result.rows[0];

    if (row.status === 'Locked') {
      return NextResponse.json({ error: 'Account locked. Please contact support.' }, { status: 403 });
    }

    if (row.pin !== pin) {
      if (hasFailedAttempts) {
        // Increment failed attempts; lock account if threshold reached
        const updated = await pool.query(
          `UPDATE accounts
           SET failed_attempts = failed_attempts + 1,
               status = CASE WHEN failed_attempts + 1 >= $2 THEN 'Locked' ELSE status END
           WHERE account_number = $1
           RETURNING failed_attempts, status`,
          [account_number, LOCK_THRESHOLD]
        );
        const u = updated.rows[0];
        if (u.status === 'Locked') {
          return NextResponse.json({ error: 'Account locked after multiple failed attempts.' }, { status: 403 });
        }
      }
      // If column missing, just return invalid PIN without lockout
      return NextResponse.json({ error: 'Invalid PIN.' }, { status: 401 });
    }

    // Successful login: reset failed_attempts if available
    if (hasFailedAttempts) {
      await pool.query(
        'UPDATE accounts SET failed_attempts = 0 WHERE account_number = $1',
        [row.account_number]
      );
    }

    const res = NextResponse.json({
      account: {
        account_number: row.account_number,
        name: row.name,
        balance: row.balance,
        status: row.status,
      },
    });
    // Minimal session cookie storing the account number
    res.cookies.set('session', String(row.account_number), {
      httpOnly: true,
      maxAge: 60 * 60, // 1 hour
      path: '/',
    });
    return res;
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Server error' }, { status: 500 });
  }
}
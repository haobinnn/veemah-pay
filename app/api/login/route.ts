import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import bcrypt from 'bcryptjs';

const LOCK_THRESHOLD = 3; // number of failed PIN attempts before lock

export async function POST(req: NextRequest) {
  const { email, pin, password } = await req.json();

  // "pin" field might come from legacy clients or the web form using the "pin" variable name for password
  // But strictly, we expect `email` + `password` (new) or `email` + `pin` (old)
  const credential = password || pin;

  if (!email || !credential) {
    return NextResponse.json({ error: 'Email and Password/PIN are required.' }, { status: 400 });
  }

  try {
    const colCheck = await pool.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'accounts'`
    );
    const cols: string[] = colCheck.rows.map((r: any) => r.column_name);
    const hasFailedAttempts = cols.includes('failed_attempts');
    const hasEmail = cols.includes('email');
    const hasPassword = cols.includes('password');

    let result;
    // Select password if column exists
    const selectCols = `account_number, name, balance::float AS balance, status, pin${hasEmail ? ', email' : ''}${hasPassword ? ', password' : ''}`;
    
    if (hasEmail && String(email).includes('@')) {
      result = await pool.query(
        `SELECT ${selectCols} FROM accounts WHERE email = $1`,
        [email]
      );
    } else {
      result = await pool.query(
        `SELECT ${selectCols} FROM accounts WHERE account_number = $1`,
        [email] // email variable here acts as identifier (account number or email)
      );
    }

    if (result.rowCount === 0) {
      return NextResponse.json({ error: 'Invalid email or account not found.' }, { status: 401 });
    }

    const row = result.rows[0];

    // Require email verification if email exists and pending record is present
    if (hasEmail && row.email) {
      try {
        const verTable = await pool.query(`SELECT to_regclass('public.email_verification_codes') AS r`);
        if (!verTable.rows?.[0]?.r) {
          return NextResponse.json({ error: 'Database missing email verification table. Run migrations.' }, { status: 500 });
        }
        const ver = await pool.query(
          `SELECT 1 FROM email_verification_codes WHERE email = $1 AND verified_at IS NULL`,
          [row.email]
        );
        if ((ver.rowCount ?? 0) > 0) {
          return NextResponse.json({ error: 'Email not verified. Check your inbox for the verification code.' }, { status: 403 });
        }
      } catch (e) {
        console.error('Email verification check failed:', e);
      }
    }

    if (row.status === 'Locked') {
      return NextResponse.json({ error: 'Account locked. Please contact support.' }, { status: 403 });
    }
    if (row.status === 'Archived') {
      return NextResponse.json({ error: 'Account archived. Access disabled.' }, { status: 403 });
    }

    // AUTHENTICATION LOGIC
    // 1. Try Password (if row has it and user provided it)
    // 2. Fallback to PIN
    let authenticated = false;

    if (hasPassword && row.password && password) {
      // Check password (hashed)
      const match = await bcrypt.compare(password, row.password);
      if (match) {
        authenticated = true;
      } else if (password === row.password) {
          // Fallback for existing plaintext passwords (legacy support)
          authenticated = true;
          // Optionally upgrade to hash here, but let's keep it simple for now
      }
    } else {
      // Fallback: Check PIN (legacy or if user has no password set)
      // Note: If user has a password but tries to login with PIN on web, we might allow it if we want hybrid auth,
      // but "professional" implies checking the correct credential.
      // However, to avoid breaking legacy, we check against PIN if password check didn't pass or wasn't attempted.
      if (row.pin === credential) {
        authenticated = true;
      }
    }

    if (!authenticated) {
      if (hasFailedAttempts) {
        // Increment failed attempts; lock account if threshold reached
        const updated = await pool.query(
          `UPDATE accounts
           SET failed_attempts = failed_attempts + 1,
               status = CASE WHEN failed_attempts + 1 >= $2 THEN 'Locked' ELSE status END
           WHERE account_number = $1
           RETURNING failed_attempts, status`,
          [row.account_number, LOCK_THRESHOLD]
        );
        const u = updated.rows[0];
        if (u.status === 'Locked') {
          return NextResponse.json({ error: 'Account locked after multiple failed attempts.' }, { status: 403 });
        }
      }
      return NextResponse.json({ error: 'Invalid Password or PIN.' }, { status: 401 });
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
        email: hasEmail ? row.email : undefined
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
    console.error('Login error:', err);
    return NextResponse.json({ error: 'Login service unavailable. Please try again.' }, { status: 500 });
  }
}

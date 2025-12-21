import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export async function POST(req: NextRequest) {
  const { email, code } = await req.json();
  if (!email || !email.includes('@') || !code) {
    return NextResponse.json({ error: 'Email and code are required' }, { status: 400 });
  }

  try {
    const verTable = await pool.query(`SELECT to_regclass('public.email_verification_codes') AS r`);
    if (!verTable.rows?.[0]?.r) {
      return NextResponse.json({ error: 'Database missing email_verification_codes table. Run migrations.' }, { status: 500 });
    }
    const pendTable = await pool.query(`SELECT to_regclass('public.pending_signups') AS r`);
    if (!pendTable.rows?.[0]?.r) {
      return NextResponse.json({ error: 'Database missing pending_signups table. Run migrations.' }, { status: 500 });
    }

    const rec = await pool.query(
      `SELECT account_number, expires_at, verified_at FROM email_verification_codes WHERE email = $1 AND code = $2`,
      [email, String(code)]
    );
    if (rec.rowCount === 0) {
      return NextResponse.json({ error: 'Invalid code' }, { status: 400 });
    }
    const row = rec.rows[0];
    if (row.verified_at) {
      return NextResponse.json({ error: 'Already verified' }, { status: 400 });
    }
    if (new Date(row.expires_at).getTime() <= Date.now()) {
      return NextResponse.json({ error: 'Code expired' }, { status: 400 });
    }

    await pool.query(
      `UPDATE email_verification_codes SET verified_at = now() WHERE email = $1`,
      [email]
    );

    const pendingRes = await pool.query(
      `SELECT name, hashed_password, pin, initial_balance::float AS initial_balance, terms_accepted FROM pending_signups WHERE email = $1`,
      [email]
    );
    if (pendingRes.rowCount === 0) {
      // If no pending signup, try existing account (may have been created already)
      const accRes = await pool.query(
        `SELECT account_number, name, balance::float AS balance, status, email FROM accounts WHERE email = $1`,
        [email]
      );
      if (accRes.rowCount === 0) {
        return NextResponse.json({ error: 'Account not found' }, { status: 404 });
      }
      const existing = accRes.rows[0];
      const res = NextResponse.json({ account: existing, verified: true });
      res.cookies.set('session', String(existing.account_number), {
        httpOnly: true,
        maxAge: 60 * 60,
        path: '/',
      });
      return res;
    }

    const pending = pendingRes.rows[0];

    // Determine available columns and account_number length for this environment
    const colCheck = await pool.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'accounts'`
    );
    const cols: string[] = colCheck.rows.map((r: any) => r.column_name);
    const hasEmail = cols.includes('email');
    const hasPassword = cols.includes('password');
    const hasTerms = cols.includes('terms_accepted');

    const lenRes = await pool.query(
      `SELECT character_maximum_length FROM information_schema.columns WHERE table_name = 'accounts' AND column_name = 'account_number'`
    );
    const accLen = Number(lenRes.rows?.[0]?.character_maximum_length ?? 10);
    let acc = '';
    let isUnique = false;
    let attempts = 0;
    while (!isUnique && attempts < 10) {
      const min = accLen >= 2 ? Math.pow(10, accLen - 1) : 0;
      const max = accLen >= 2 ? Math.pow(10, accLen) - 1 : 9;
      acc = String(Math.floor(min + Math.random() * (max - min + 1)));
      const exists = await pool.query('SELECT 1 FROM accounts WHERE account_number = $1', [acc]);
      if (exists.rowCount === 0) isUnique = true;
      attempts++;
    }
    if (!isUnique) {
      return NextResponse.json({ error: 'Failed to allocate account number' }, { status: 500 });
    }

    // Build insert dynamically
    const columns = ['account_number', 'name', 'balance', 'pin', 'status'];
    const values: (string | number | boolean)[] = [acc, pending.name, pending.initial_balance ?? 0, pending.pin];
    const placeholders = ['$1', '$2', '$3', '$4', "'Active'"];
    let pIdx = 5;
    if (hasEmail) {
      columns.push('email');
      values.push(email);
      placeholders.push(`$${pIdx++}`);
    }
    if (hasPassword) {
      columns.push('password');
      values.push(pending.hashed_password);
      placeholders.push(`$${pIdx++}`);
    }
    if (hasTerms) {
      columns.push('terms_accepted');
      values.push(pending.terms_accepted);
      placeholders.push(`$${pIdx++}`);
    }
    const sql = `INSERT INTO accounts (${columns.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING account_number, name, balance::float AS balance, status${hasEmail ? ', email' : ''}`;
    const inserted = await pool.query(sql, values);
    const account = inserted.rows[0];

    // Cleanup pending record
    await pool.query('DELETE FROM pending_signups WHERE email = $1', [email]);

    const res = NextResponse.json({ account, verified: true });
    res.cookies.set('session', String(account.account_number), {
      httpOnly: true,
      maxAge: 60 * 60,
      path: '/',
    });
    return res;
  } catch (err: any) {
    console.error('[VERIFY EMAIL ERROR]', err);
    return NextResponse.json({ error: err.message ?? 'Server error' }, { status: 500 });
  }
}

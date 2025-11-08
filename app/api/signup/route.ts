import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export async function POST(req: NextRequest) {
  const { account_number, name, pin, initial_balance } = await req.json();

  // Basic validation
  const acc = String(account_number ?? '').trim();
  const nm = String(name ?? '').trim();
  const pn = String(pin ?? '').trim();
  const init = initial_balance === undefined || initial_balance === null
    ? 0
    : Number(initial_balance);

  if (!/^[0-9]{5}$/.test(acc)) {
    return NextResponse.json({ error: 'Account number must be 5 digits.' }, { status: 400 });
  }
  if (acc === '0000') {
    return NextResponse.json({ error: 'Reserved account number.' }, { status: 400 });
  }
  if (!nm) {
    return NextResponse.json({ error: 'Name is required.' }, { status: 400 });
  }
  if (!/^[0-9]{4}$/.test(pn)) {
    return NextResponse.json({ error: 'PIN must be 4 digits.' }, { status: 400 });
  }
  if (Number.isNaN(init) || init < 0) {
    return NextResponse.json({ error: 'Initial balance must be a nonnegative number.' }, { status: 400 });
  }

  try {
    const exists = await pool.query('SELECT 1 FROM accounts WHERE account_number = $1', [acc]);
    if (exists.rowCount && exists.rowCount > 0) {
      return NextResponse.json({ error: 'Account number already exists.' }, { status: 409 });
    }

    const inserted = await pool.query(
      `INSERT INTO accounts (account_number, name, balance, pin, status)
       VALUES ($1, $2, $3, $4, 'Active')
       RETURNING account_number, name, balance::float AS balance, status`,
      [acc, nm, init, pn]
    );

    const account = inserted.rows[0];
    const res = NextResponse.json({ account });
    // Log in new user by setting session cookie
    res.cookies.set('session', String(account.account_number), {
      httpOnly: true,
      maxAge: 60 * 60, // 1 hour
      path: '/',
    });
    return res;
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Server error' }, { status: 500 });
  }
}
import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import bcrypt from 'bcryptjs';

export async function POST(req: NextRequest) {
  const { name, pin, initial_balance, email, password, terms_accepted } = await req.json();

  // Basic validation
  const nm = String(name ?? '').trim();
  const pn = String(pin ?? '').trim();
  const em = String(email ?? '').trim();
  const pwd = String(password ?? '').trim();
  const terms = !!terms_accepted;
  const init = initial_balance === undefined || initial_balance === null
    ? 0
    : Number(initial_balance);

  // Removed account_number validation as it is now auto-generated
  
  if (!nm) {
    return NextResponse.json({ error: 'Name is required.' }, { status: 400 });
  }
  if (!em || !em.includes('@')) {
    return NextResponse.json({ error: 'Valid email is required.' }, { status: 400 });
  }
  if (!/^[0-9]{5}$/.test(pn)) {
    return NextResponse.json({ error: 'PIN must be 5 digits.' }, { status: 400 });
  }
  if (pwd.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 });
  }
  if (!terms) {
    return NextResponse.json({ error: 'You must accept the terms.' }, { status: 400 });
  }
  if (Number.isNaN(init) || init < 0) {
    return NextResponse.json({ error: 'Initial balance must be a nonnegative number.' }, { status: 400 });
  }

  try {
    const colCheck = await pool.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'accounts'`
    );
    const cols: string[] = colCheck.rows.map((r: any) => r.column_name);
    const hasEmail = cols.includes('email');
    const hasPassword = cols.includes('password');
    const hasTerms = cols.includes('terms_accepted');
    if (hasEmail) {
      const existsEmail = await pool.query('SELECT 1 FROM accounts WHERE email = $1', [em]);
      if (Number(existsEmail.rowCount ?? 0) > 0) {
        return NextResponse.json({ error: 'Email already registered.' }, { status: 409 });
      }
    }

    const pendTable = await pool.query(`SELECT to_regclass('public.pending_signups') AS r`);
    if (!pendTable.rows?.[0]?.r) {
      return NextResponse.json({ error: 'Database missing pending_signups table. Run migrations.' }, { status: 500 });
    }
    const pendExists = await pool.query('SELECT 1 FROM pending_signups WHERE email = $1', [em]);
    if (Number(pendExists.rowCount ?? 0) > 0) {
      return NextResponse.json({ error: 'Email already registered.' }, { status: 409 });
    }

    // Do NOT create an account row yet. Store pending signup and send verification code.
    const hashed = await bcrypt.hash(pwd, 10);
    await pool.query(
      `INSERT INTO pending_signups (email, name, hashed_password, pin, initial_balance, terms_accepted)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (email) DO UPDATE SET 
         name = EXCLUDED.name,
         hashed_password = EXCLUDED.hashed_password,
         pin = EXCLUDED.pin,
         initial_balance = EXCLUDED.initial_balance,
         terms_accepted = EXCLUDED.terms_accepted,
         created_at = now()`,
      [em, nm, hashed, pn, init, terms]
    );

    const verTable = await pool.query(`SELECT to_regclass('public.email_verification_codes') AS r`);
    if (!verTable.rows?.[0]?.r) {
      return NextResponse.json({ error: 'Database missing email_verification_codes table. Run migrations.' }, { status: 500 });
    }
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    await pool.query(
      `INSERT INTO email_verification_codes (email, account_number, code, expires_at, created_at, verified_at)
       VALUES ($1,'-',$2,$3,now(),NULL)
       ON CONFLICT (email) DO UPDATE SET code = EXCLUDED.code, expires_at = EXCLUDED.expires_at, account_number = '-', verified_at = NULL, created_at = now()`,
      [em, code, expiresAt]
    );

    if (process.env.RESEND_API_KEY) {
      const resendRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM || 'onboarding@resend.dev',
          to: em,
          subject: 'Verify your VeemahPay account',
          html: `<p>Welcome to VeemahPay!</p><p>Your verification code is <strong>${code}</strong>. It expires in 30 minutes.</p>`,
          text: `Welcome to VeemahPay! Your verification code is ${code}. It expires in 30 minutes.`
        })
      });
      if (!resendRes.ok) {
        const errText = await resendRes.text();
        console.error('Resend API Error:', errText);
      }
    } else {
    }

    const showDevCode =
      process.env.NODE_ENV !== 'production' &&
      (process.env.DEV_SHOW_RESET_CODE === '1' || process.env.DEV_SHOW_RESET_CODE === 'true');
    return NextResponse.json({ verification_required: true, dev_code: showDevCode ? code : undefined });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: err.message ?? 'Server error' }, { status: 500 });
  }
}

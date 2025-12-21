import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export async function POST(req: NextRequest) {
  const { email } = await req.json();
  const em = String(email ?? '').trim();
  if (!em || !em.includes('@')) {
    return NextResponse.json({ error: 'Valid email is required' }, { status: 400 });
  }

  try {
    const pendTable = await pool.query(`SELECT to_regclass('public.pending_signups') AS r`);
    if (!pendTable.rows?.[0]?.r) {
      return NextResponse.json({ error: 'Database missing pending_signups table. Run migrations.' }, { status: 500 });
    }
    const pendRes = await pool.query(`SELECT 1 FROM pending_signups WHERE email = $1`, [em]);
    if (pendRes.rowCount === 0) {
      return NextResponse.json({ error: 'No pending signup found for this email' }, { status: 404 });
    }

    const verTable = await pool.query(`SELECT to_regclass('public.email_verification_codes') AS r`);
    if (!verTable.rows?.[0]?.r) {
      return NextResponse.json({ error: 'Database missing email_verification_codes table. Run migrations.' }, { status: 500 });
    }
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    await pool.query(
      `INSERT INTO email_verification_codes (email, account_number, code, expires_at, created_at, verified_at)
       VALUES ($1,$2,$3,$4,now(),NULL)
       ON CONFLICT (email) DO UPDATE SET code = EXCLUDED.code, expires_at = EXCLUDED.expires_at, account_number = EXCLUDED.account_number, verified_at = NULL, created_at = now()`,
      [em, '-', code, expiresAt]
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
          subject: 'Your VeemahPay verification code',
          html: `<p>Your verification code is <strong>${code}</strong>. It expires in 30 minutes.</p>`,
          text: `Your verification code is ${code}. It expires in 30 minutes.`
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
    return NextResponse.json({ sent: true, dev_code: showDevCode ? code : undefined });
  } catch (err: any) {
    console.error('[RESEND EMAIL VERIFICATION ERROR]', err);
    return NextResponse.json({ error: err.message ?? 'Server error' }, { status: 500 });
  }
}

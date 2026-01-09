import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import bcrypt from 'bcryptjs';

const LOCK_THRESHOLD = 3; // number of failed PIN attempts before lock

function getClientIp(req: NextRequest) {
  const xf = req.headers.get('x-forwarded-for');
  if (xf) return xf.split(',')[0]?.trim() || xf.trim();
  return (
    req.headers.get('x-real-ip') ||
    req.headers.get('cf-connecting-ip') ||
    req.headers.get('x-client-ip') ||
    ''
  );
}

function getApproxLocation(req: NextRequest) {
  const city = req.headers.get('x-vercel-ip-city') || '';
  const region = req.headers.get('x-vercel-ip-country-region') || '';
  const country = req.headers.get('x-vercel-ip-country') || req.headers.get('cf-ipcountry') || '';
  const parts = [city, region, country].map((p) => p.trim()).filter(Boolean);
  return parts.join(', ');
}

function normalizeLocationText(raw: string) {
  const v = String(raw || '').trim();
  if (!v) return '';
  if (v.includes('%')) {
    try {
      const decoded = decodeURIComponent(v);
      if (decoded && decoded !== v) return decoded.replace(/\s+/g, ' ').trim();
    } catch {}
  }
  return v.replace(/\s+/g, ' ').trim();
}

function normalizeIp(raw: string) {
  const ip = String(raw || '').trim();
  if (!ip) return '';
  const first = ip.includes(',') ? ip.split(',')[0]!.trim() : ip;
  const noBrackets = first.startsWith('[') && first.includes(']') ? first.slice(1, first.indexOf(']')) : first;
  if (/^\d{1,3}(\.\d{1,3}){3}:\d+$/.test(noBrackets)) return noBrackets.split(':')[0]!;
  return noBrackets;
}

function isPrivateOrLoopbackIp(ip: string) {
  const v = normalizeIp(ip);
  if (!v) return true;
  if (v === '::1' || v === '::' || v === '0.0.0.0') return true;
  if (v.startsWith('127.') || v.startsWith('10.') || v.startsWith('192.168.')) return true;
  if (v.startsWith('172.')) {
    const second = Number(v.split('.')[1] ?? NaN);
    if (Number.isFinite(second) && second >= 16 && second <= 31) return true;
  }
  if (v.startsWith('::ffff:')) return isPrivateOrLoopbackIp(v.slice('::ffff:'.length));
  const lower = v.toLowerCase();
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true;
  if (lower.startsWith('fe80:')) return true;
  return false;
}

async function lookupLocationFromIp(ip: string) {
  const v = normalizeIp(ip);
  if (!v || isPrivateOrLoopbackIp(v)) return '';

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 800);
  try {
    const url = `https://ipwho.is/${encodeURIComponent(v)}?fields=success,city,region,country`;
    const res = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
      cache: 'no-store',
    });
    if (!res.ok) return '';
    const data: any = await res.json().catch(() => null);
    if (!data || data.success !== true) return '';
    const parts = [data.city, data.region, data.country].map((p: any) => String(p || '').trim()).filter(Boolean);
    return normalizeLocationText(parts.join(', '));
  } catch {
    return '';
  } finally {
    clearTimeout(timeout);
  }
}

function isValidClientLocation(v: any): v is { lat: number; lon: number; accuracy?: number } {
  if (!v || typeof v !== 'object') return false;
  const lat = Number((v as any).lat);
  const lon = Number((v as any).lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false;
  if (lat < -90 || lat > 90) return false;
  if (lon < -180 || lon > 180) return false;
  const accuracy = (v as any).accuracy;
  if (accuracy !== undefined && accuracy !== null) {
    const a = Number(accuracy);
    if (!Number.isFinite(a) || a < 0) return false;
  }
  return true;
}

async function reverseGeocodeLocation(lat: number, lon: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 900);
  try {
    const u = new URL('https://nominatim.openstreetmap.org/reverse');
    u.searchParams.set('format', 'jsonv2');
    u.searchParams.set('lat', String(lat));
    u.searchParams.set('lon', String(lon));
    u.searchParams.set('zoom', '10');
    u.searchParams.set('addressdetails', '1');
    const res = await fetch(u.toString(), {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'User-Agent': 'veemahpay',
      },
      signal: controller.signal,
      cache: 'no-store',
    });
    if (!res.ok) return '';
    const data: any = await res.json().catch(() => null);
    const addr = data?.address;
    if (!addr || typeof addr !== 'object') return '';
    const city =
      addr.city ||
      addr.town ||
      addr.village ||
      addr.municipality ||
      addr.hamlet ||
      addr.county ||
      '';
    const region = addr.state || addr.region || addr.province || addr.state_district || '';
    const country = addr.country || (addr.country_code ? String(addr.country_code).toUpperCase() : '');
    const parts = [city, region, country].map((p: any) => String(p || '').trim()).filter(Boolean);
    return normalizeLocationText(parts.join(', '));
  } catch {
    return '';
  } finally {
    clearTimeout(timeout);
  }
}

async function getLoginLocation(req: NextRequest, ip: string, clientLocation?: { lat: number; lon: number; accuracy?: number } | null) {
  if (clientLocation && isValidClientLocation(clientLocation)) {
    const fromDevice = await reverseGeocodeLocation(clientLocation.lat, clientLocation.lon);
    if (fromDevice) return fromDevice;
  }
  const approx = normalizeLocationText(getApproxLocation(req));
  if (approx) return approx;
  return await lookupLocationFromIp(ip);
}

function formatDateForEmail(d: Date) {
  try {
    return new Intl.DateTimeFormat('en-PH', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
      timeZone: 'Asia/Manila',
    }).format(d);
  } catch {
    return d.toISOString();
  }
}

async function sendResendEmail(args: { to: string; subject: string; html: string; text: string }) {
  try {
    if (!process.env.RESEND_API_KEY) {
      console.log('[EMAIL MOCK]', { to: args.to, subject: args.subject });
      return false;
    }
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || 'onboarding@resend.dev',
        to: args.to,
        subject: args.subject,
        html: args.html,
        text: args.text,
      }),
    });
    if (!res.ok) {
      const errText = await res.text();
      console.error('Resend API Error:', errText);
      return false;
    }
    return true;
  } catch (e) {
    console.error('[EMAIL SEND ERROR]', e);
    return false;
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({} as any));
  const identifier = String(
    body?.email ?? body?.account_number ?? body?.accountNumber ?? body?.identifier ?? ''
  ).trim();
  const pin = body?.pin;
  const password = body?.password;
  const clientLocationRaw = body?.client_location;

  // "pin" field might come from legacy clients or the web form using the "pin" variable name for password
  // But strictly, we expect `email` + `password` (new) or `email` + `pin` (old)
  const credential = password || pin;

  if (!identifier || credential === undefined || credential === null || String(credential).length === 0) {
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
    const hasRole = cols.includes('role');

    let result;
    // Select password if column exists
    const selectCols = `account_number, name, balance::float AS balance, status, pin${hasEmail ? ', email' : ''}${hasPassword ? ', password' : ''}${hasRole ? ', role' : ''}`;

    const ident = identifier;
    const isNumericAccountNumber = /^[0-9]+$/.test(ident);

    if (hasEmail && !isNumericAccountNumber && ident.includes('@')) {
      result = await pool.query(
        `SELECT ${selectCols} FROM accounts WHERE LOWER(email) = LOWER($1)`,
        [ident]
      );
    } else {
      result = await pool.query(
        `SELECT ${selectCols} FROM accounts WHERE account_number = $1`,
        [ident]
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
      if (String(row.pin) === String(credential)) {
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

    const isAdminEmail = hasEmail && typeof row.email === 'string' && row.email.toLowerCase().endsWith('@veemahpay.com');
    const isAdminRole = hasRole && ['admin', 'super_admin'].includes(String(row.role || '').toLowerCase());
    const isAdmin = String(row.account_number) === '0000' || isAdminRole || isAdminEmail;

    const loginNow = new Date();
    const loginIp = getClientIp(req);
    const loginUa = req.headers.get('user-agent') || '';
    const loginLocation = await getLoginLocation(req, loginIp, clientLocationRaw);
    const loginWhen = formatDateForEmail(loginNow);

    if (hasEmail && typeof row.email === 'string' && row.email.includes('@')) {
      const locationLine = loginLocation ? `Location: ${loginLocation}` : `Location: Unknown`;
      const ipLine = loginIp ? `IP: ${loginIp}` : `IP: Unknown`;
      const deviceLine = loginUa ? `Device: ${loginUa}` : `Device: Unknown`;

      const subject = 'New login to your VeemahPay account.';
      const text = [
        'New login to your VeemahPay account.',
        '',
        `Date: ${loginWhen}`,
        ipLine,
        locationLine,
        deviceLine,
        '',
        "If this wasn't you, change your password and PIN immediately.",
      ].join('\n');
      const html = [
        `<p>New login to your VeemahPay account.</p>`,
        `<p><strong>Date:</strong> ${loginWhen}</p>`,
        `<p><strong>IP:</strong> ${loginIp || 'Unknown'}</p>`,
        `<p><strong>Location:</strong> ${loginLocation || 'Unknown'}</p>`,
        `<p><strong>Device:</strong> ${loginUa || 'Unknown'}</p>`,
        `<p>If this wasn't you, change your password and PIN immediately.</p>`,
      ].join('');

      try {
        await sendResendEmail({ to: row.email, subject, html, text });
      } catch {}
    }

    try {
      const notifExists = await pool.query(`SELECT to_regclass('public.notifications') AS r`);
      const hasNotif = !!notifExists.rows?.[0]?.r;
      if (hasNotif) {
        const parts = [
          'New login detected.',
          loginIp ? `IP: ${loginIp}.` : null,
          loginLocation ? `Location: ${loginLocation}.` : null,
          loginUa ? `Device: ${loginUa}.` : null,
        ].filter(Boolean);
        const notifBody = parts.join(' ');
        const meta = {
          ip: loginIp || null,
          location: loginLocation || null,
          device: loginUa || null,
          when: loginNow.toISOString(),
        };
        try {
          await pool.query(
            `INSERT INTO public.notifications (type, title, body, status, recipient_account_number, sender_account_number, metadata)
             VALUES ($1, $2, $3, 'UNREAD', $4, NULL, $5::jsonb)`,
            ['SECURITY', 'New login', notifBody, row.account_number, JSON.stringify(meta)]
          );
        } catch {
          await pool.query(
            `INSERT INTO public.notifications (type, title, body, status, recipient_account_number, sender_account_number, metadata)
             VALUES ($1, $2, $3, 'UNREAD', $4, NULL, $5::jsonb)`,
            ['ALERT', 'New login', notifBody, row.account_number, JSON.stringify(meta)]
          );
        }
      }
    } catch {}

    const res = NextResponse.json({
      account: {
        account_number: row.account_number,
        name: row.name,
        balance: row.balance,
        status: row.status,
        email: hasEmail ? row.email : undefined,
        role: hasRole ? row.role : undefined
      },
      isAdmin
    });
    // Minimal session cookie storing the account number
    res.cookies.set('session', String(row.account_number), {
      httpOnly: true,
      maxAge: 60 * 60, // 1 hour
      path: '/',
    });
    // Hint cookie for admin determination
    if (isAdmin) {
      res.cookies.set('session_admin', '1', {
        httpOnly: true,
        maxAge: 60 * 60,
        path: '/',
      });
    } else {
      res.cookies.set('session_admin', '', { httpOnly: true, maxAge: 0, path: '/' });
    }
    return res;
  } catch (err: any) {
    console.error('Login error:', err);
    return NextResponse.json({ error: 'Login service unavailable. Please try again.' }, { status: 500 });
  }
}

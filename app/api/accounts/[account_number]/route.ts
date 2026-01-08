import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';

const JAVA_BACKEND_URL = process.env.JAVA_BACKEND_URL || 'http://localhost:8080';

function maskAccountName(raw: string) {
  const cleaned = String(raw ?? '').trim().replace(/\s+/g, ' ');
  if (!cleaned) return '';

  const parts = cleaned.split(' ').filter(Boolean);
  const first = parts[0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1] : '';

  const firstInitial = first ? first[0] : '';
  const firstStars = Math.max(0, first.length - (first ? 1 : 0));
  const maskedFirst = firstInitial + (firstStars ? '*'.repeat(firstStars) : '');

  if (!last) return maskedFirst;
  const lastInitial = last ? last[0] : '';
  return `${maskedFirst} ${lastInitial}.`;
}

async function getAdminWhereClause() {
  const colRes = await pool.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name = 'accounts'`
  );
  const cols: string[] = colRes.rows.map((r: any) => r.column_name);
  const hasRole = cols.includes('role');
  const hasEmail = cols.includes('email');
  const parts: string[] = [`account_number = '0000'`];
  if (hasRole) {
    parts.push(`LOWER(COALESCE(role,'')) IN ('admin','super_admin')`);
  }
  if (hasEmail) {
    parts.push(`email ILIKE '%@veemahpay.com'`);
  }
  return { adminWhere: parts.join(' OR '), hasRole, hasEmail };
}

async function isAdminSession(session: string) {
  if (String(session) === '0000') return true;
  const { adminWhere } = await getAdminWhereClause();
  const res = await pool.query(`SELECT 1 FROM accounts WHERE account_number = $1 AND (${adminWhere})`, [session]);
  return (res.rowCount ?? 0) > 0;
}

async function isAdminAccount(accountNumber: string) {
  if (String(accountNumber) === '0000') return true;
  const { adminWhere } = await getAdminWhereClause();
  const res = await pool.query(`SELECT 1 FROM accounts WHERE account_number = $1 AND (${adminWhere})`, [accountNumber]);
  return (res.rowCount ?? 0) > 0;
}

export async function GET(_req: NextRequest, { params }: { params: { account_number: string } }) {
  const { account_number } = params;
  try {
    const colRes = await pool.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'accounts'`
    );
    const cols: string[] = colRes.rows.map((r: any) => r.column_name);
    const hasRole = cols.includes('role');
    const result = await pool.query(
      `SELECT account_number, name, balance::float AS balance, status${hasRole ? ', role' : ''} FROM accounts WHERE account_number = $1`,
      [account_number]
    );
    if (result.rowCount === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ account: result.rows[0] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: { account_number: string } }) {
  const { account_number } = params;
  const session = req.cookies.get('session')?.value;
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  await req.json().catch(() => ({}));

  try {
    const upstream = await fetch(`${JAVA_BACKEND_URL}/api/accounts/${encodeURIComponent(account_number)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    const data = await upstream.json().catch(() => null);
    if (!upstream.ok) {
      return NextResponse.json(data ?? { error: 'Upstream error' }, { status: upstream.status });
    }
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Server error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { account_number: string } }) {
  const { account_number } = params;
  const body = await req.json();
  const { op, amount, name, status, role } = body;

  // Admin edit path: update name and/or status
  if (typeof name === 'string' || typeof status === 'string' || typeof role === 'string') {
    const session = req.cookies.get('session')?.value;
    if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const isAdmin = await isAdminSession(session);
    if (!isAdmin) return NextResponse.json({ error: 'Admin privileges required.' }, { status: 403 });
    if (status && status !== 'Active' && status !== 'Locked' && status !== 'Archived') {
      return NextResponse.json({ error: 'Status must be Active, Locked, or Archived.' }, { status: 400 });
    }
    const nextRole = typeof role === 'string' ? role.trim().toLowerCase() : undefined;
    if (typeof nextRole === 'string') {
      const allowed = new Set(['user', 'admin', 'super_admin']);
      if (!allowed.has(nextRole)) {
        return NextResponse.json({ error: 'Role must be user, admin, or super_admin.' }, { status: 400 });
      }
      if (String(account_number) === '0000' && nextRole === 'user') {
        return NextResponse.json({ error: 'Cannot remove admin role from the primary administrator account.' }, { status: 400 });
      }
    }
    try {
      const colCheck = await pool.query(
        `SELECT column_name
         FROM information_schema.columns
         WHERE table_name = 'accounts'
           AND column_name IN ('failed_attempts','role')`
      );
      const colNames: string[] = colCheck.rows.map((r: any) => r.column_name);
      const hasFailedAttempts = colNames.includes('failed_attempts');
      const hasRole = colNames.includes('role');
      if (typeof nextRole === 'string' && !hasRole) {
        return NextResponse.json({ error: 'Role management is not supported by this database.' }, { status: 400 });
      }

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
      if (typeof nextRole === 'string') {
        updates.push(`role = $${idx++}`);
        paramsArr.push(nextRole);
      }
      if (updates.length === 0) {
        return NextResponse.json({ error: 'No updates provided.' }, { status: 400 });
      }
      paramsArr.push(account_number);
      const returning = `account_number, name, balance::float AS balance, status${hasRole ? ', role' : ''}`;
      const sql = `UPDATE accounts SET ${updates.join(', ')} WHERE account_number = $${idx} RETURNING ${returning}`;
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
    const upstream = await fetch(`${JAVA_BACKEND_URL}/api/accounts/${encodeURIComponent(account_number)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ op, amount }),
    });
    const data = await upstream.json().catch(() => null);
    if (!upstream.ok) {
      return NextResponse.json(data ?? { error: 'Upstream error' }, { status: upstream.status });
    }
    return NextResponse.json({ account: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { account_number: string } }) {
  try {
    const { account_number } = params;
    console.log(`[DELETE /api/accounts/[account_number]] Received request for account: ${account_number}`);
    const session = req.cookies.get('session')?.value;
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    const isAdmin = await isAdminSession(session);
    if (!isAdmin) {
      console.log('[DELETE /api/accounts/[account_number]] Admin privileges required.');
      return NextResponse.json({ error: 'Admin privileges required.' }, { status: 403 });
    }
    if (await isAdminAccount(account_number)) {
      return NextResponse.json({ error: 'Cannot delete administrator account.' }, { status: 400 });
    }

    try {
      const result = await pool.query('DELETE FROM accounts WHERE account_number = $1', [account_number]);
      if (result.rowCount === 0) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }
      return new NextResponse(null, { status: 204 });
    } catch (e: any) {
      if (e?.code === '23503') {
        // Foreign key violation: dependent records prevent deletion
        return NextResponse.json(
          { error: 'Delete blocked by existing references (e.g., transactions target_account). Void or remove dependent records first.' },
          { status: 409 }
        );
      }
      throw e;
    }
  } catch (err: any) {
    console.error('[DELETE /api/accounts/[account_number]]', err);
    return NextResponse.json({ error: err.message ?? 'Server error' }, { status: 500 });
  }
}

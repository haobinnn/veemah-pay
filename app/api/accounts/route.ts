import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';

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
  return { adminWhere: parts.join(' OR ') };
}

async function isAdminSession(session: string) {
  if (String(session) === '0000') return true;
  const { adminWhere } = await getAdminWhereClause();
  const res = await pool.query(`SELECT 1 FROM accounts WHERE account_number = $1 AND (${adminWhere})`, [session]);
  return (res.rowCount ?? 0) > 0;
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const search = (url.searchParams.get('q') || url.searchParams.get('search') || '').trim();
    const statusFilter = (url.searchParams.get('status') || '').trim();
    const includeArchived = ['1','true','yes'].includes((url.searchParams.get('include_archived') || '').toLowerCase());

    const colRes = await pool.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'accounts'`
    );
    const cols: string[] = colRes.rows.map((r: any) => r.column_name);
    const hasRole = cols.includes('role');

    const where: string[] = [];
    const params: any[] = [];
    let idx = 1;
    
    if (statusFilter) {
      where.push(`status = $${idx}`);
      params.push(statusFilter);
      idx++;
    } else if (!includeArchived) {
      where.push(`status <> 'Archived'`);
    }

    if (search) {
      where.push(`(account_number LIKE $${idx} OR name ILIKE $${idx})`);
      params.push(`%${search}%`);
      idx++;
    }
    const sql = `SELECT account_number, name, balance::float AS balance, status${hasRole ? ', role' : ''} FROM accounts ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY account_number`;
    const result = await pool.query(sql, params);
    return NextResponse.json({ accounts: result.rows });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = req.cookies.get('session')?.value;
    if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const isAdmin = await isAdminSession(session);
    if (!isAdmin) return NextResponse.json({ error: 'Admin privileges required.' }, { status: 403 });

    const url = new URL(req.url);
    const confirm = (url.searchParams.get('confirm') || '').toLowerCase();
    if (!['yes', 'true', '1'].includes(confirm)) {
      return NextResponse.json({ error: "Confirmation required. Pass ?confirm=yes to purge all non-admin accounts." }, { status: 400 });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { adminWhere } = await getAdminWhereClause();

      // Remove transactions referencing non-admin accounts (source or target)
      await client.query(
        `DELETE FROM transactions
         WHERE (account_number NOT IN (SELECT account_number FROM accounts WHERE ${adminWhere}))
            OR (target_account IS NOT NULL AND target_account NOT IN (SELECT account_number FROM accounts WHERE ${adminWhere}))`
      );

      // Optional: remove users referencing non-admin accounts, if users table exists
      const hasUsers = await client.query(
        `SELECT 1 FROM information_schema.tables WHERE table_name = 'users'`
      );
      if ((hasUsers.rowCount ?? 0) > 0) {
        await client.query(`DELETE FROM users WHERE account_number NOT IN (SELECT account_number FROM accounts WHERE ${adminWhere})`);
      }

      // Finally, remove all non-admin accounts
      await client.query(`DELETE FROM accounts WHERE NOT (${adminWhere})`);

      await client.query('COMMIT');
      return new NextResponse(null, { status: 204 });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Server error' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';

async function notificationsTableExists() {
  const res = await pool.query(`SELECT to_regclass('public.notifications') AS r`);
  return !!res.rows?.[0]?.r;
}

export async function GET(req: NextRequest) {
  const session = req.cookies.get('session')?.value;
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  try {
    const exists = await notificationsTableExists();
    if (!exists) {
      return NextResponse.json({ notifications: [], unreadCount: 0 });
    }

    const url = new URL(req.url);
    const limitRaw = Number(url.searchParams.get('limit') ?? 20);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 100) : 20;
    const cursorRaw = String(url.searchParams.get('cursor') ?? '').trim();
    let cursorCreatedAt: string | null = null;
    let cursorId: number | null = null;
    if (cursorRaw) {
      const parts = cursorRaw.split('|');
      if (parts.length === 2) {
        const createdAt = parts[0] ? new Date(parts[0]) : null;
        const id = Number(parts[1]);
        if (createdAt && Number.isFinite(createdAt.getTime()) && Number.isFinite(id) && id > 0) {
          cursorCreatedAt = createdAt.toISOString();
          cursorId = id;
        }
      }
    }

    const unreadRes = await pool.query(
      `SELECT COUNT(*)::int AS count FROM public.notifications WHERE recipient_account_number = $1 AND status = 'UNREAD'`,
      [session]
    );
    const unreadCount = Number(unreadRes.rows?.[0]?.count ?? 0);

    const params: any[] = [session];
    let whereSql = `recipient_account_number = $1`;
    let idx = 2;
    if (cursorCreatedAt && cursorId) {
      whereSql += ` AND (created_at, id) < ($${idx}::timestamptz, $${idx + 1}::bigint)`;
      params.push(cursorCreatedAt, cursorId);
      idx += 2;
    }
    params.push(limit + 1);
    const listRes = await pool.query(
      `SELECT id, type, title, body, status, created_at, updated_at, read_at, metadata
       FROM public.notifications
       WHERE ${whereSql}
       ORDER BY created_at DESC, id DESC
       LIMIT $${idx}`,
      params
    );

    const rows = Array.isArray(listRes.rows) ? listRes.rows : [];
    const hasMore = rows.length > limit;
    const notifications = hasMore ? rows.slice(0, limit) : rows;
    const last = notifications.length ? notifications[notifications.length - 1] : null;
    const next_cursor =
      hasMore && last?.created_at && last?.id ? `${new Date(last.created_at).toISOString()}|${Number(last.id)}` : null;

    return NextResponse.json({ notifications, unreadCount, next_cursor });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = req.cookies.get('session')?.value;
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  try {
    const exists = await notificationsTableExists();
    if (!exists) {
      return NextResponse.json({ ok: true, unreadCount: 0 });
    }

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action ?? '');
    const markAllRead = body?.markAllRead === true || action === 'mark_all_read';

    if (!markAllRead) {
      return NextResponse.json({ error: 'Unsupported action' }, { status: 400 });
    }

    await pool.query(
      `UPDATE public.notifications
       SET status = 'READ', read_at = NOW(), updated_at = NOW()
       WHERE recipient_account_number = $1 AND status = 'UNREAD'`,
      [session]
    );

    return NextResponse.json({ ok: true, unreadCount: 0 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Server error' }, { status: 500 });
  }
}

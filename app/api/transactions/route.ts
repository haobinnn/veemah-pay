import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';

const JAVA_BACKEND_URL = process.env.JAVA_BACKEND_URL || 'http://localhost:8080';

type TxType = 'deposit'|'withdraw'|'transfer';

async function isAdminSession(session: string) {
  if (String(session) === '0000') return true;
  const colRes = await pool.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name = 'accounts'`
  );
  const cols: string[] = colRes.rows.map((r: any) => r.column_name);
  const hasRole = cols.includes('role');
  const hasEmail = cols.includes('email');
  const selectCols = `account_number${hasRole ? ', role' : ''}${hasEmail ? ', email' : ''}`;
  const res = await pool.query(`SELECT ${selectCols} FROM accounts WHERE account_number = $1`, [session]);
  if ((res.rowCount ?? 0) === 0) return false;
  const row = res.rows[0];
  const isAdminEmail = hasEmail && typeof row.email === 'string' && row.email.toLowerCase().endsWith('@veemahpay.com');
  const isAdminRole = hasRole && ['admin', 'super_admin'].includes(String(row.role || '').toLowerCase());
  return isAdminRole || isAdminEmail || String(row.account_number) === '0000';
}

type Contact = { account_number: string; name?: string | null; email?: string | null };

function formatMoney(amount: number) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return '₱0.00';
  return `₱${n.toFixed(2)}`;
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

function buildReceiptEmail(args: {
  title: string;
  subtitle: string;
  transactionId: number | string;
  status: string;
  type: string;
  amount: number;
  occurredAt: Date;
  fromAccount?: string | null;
  toAccount?: string | null;
  note?: string | null;
  sourceBalanceBefore?: number | null;
  sourceBalanceAfter?: number | null;
  targetBalanceBefore?: number | null;
  targetBalanceAfter?: number | null;
}) {
  const occurred = args.occurredAt.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
  const receiptNo = `VP-${String(args.transactionId).padStart(6, '0')}`;
  const amountStr = formatMoney(args.amount);
  const safeNote = String(args.note ?? '').trim();

  const rows: Array<[string, string]> = [
    ['Receipt #', receiptNo],
    ['Transaction ID', String(args.transactionId)],
    ['Type', String(args.type)],
    ['Status', String(args.status)],
    ['Date', occurred],
    ['Amount', amountStr],
  ];

  if (args.fromAccount) rows.push(['From', String(args.fromAccount)]);
  if (args.toAccount) rows.push(['To', String(args.toAccount)]);
  if (safeNote) rows.push(['Note', safeNote]);

  if (args.sourceBalanceBefore != null) rows.push(['Source balance before', formatMoney(Number(args.sourceBalanceBefore))]);
  if (args.sourceBalanceAfter != null) rows.push(['Source balance after', formatMoney(Number(args.sourceBalanceAfter))]);
  if (args.targetBalanceBefore != null) rows.push(['Target balance before', formatMoney(Number(args.targetBalanceBefore))]);
  if (args.targetBalanceAfter != null) rows.push(['Target balance after', formatMoney(Number(args.targetBalanceAfter))]);

  const htmlRows = rows
    .map(
      ([k, v]) =>
        `<tr>
          <td style="padding:10px 12px;border-bottom:1px solid #e6e8ee;color:#5b667a;font-size:13px;width:40%;">${k}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #e6e8ee;color:#0b1320;font-size:13px;font-weight:600;">${v}</td>
        </tr>`
    )
    .join('');

  const html = `<!doctype html>
  <html>
    <body style="margin:0;background:#f7f8fb;padding:24px;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
      <div style="max-width:680px;margin:0 auto;background:#ffffff;border:1px solid #e5e8ef;border-radius:14px;overflow:hidden;">
        <div style="padding:18px 22px;background:linear-gradient(135deg,#0a6bff,#39b6ff);color:#ffffff;">
          <div style="font-size:16px;font-weight:800;letter-spacing:.2px;">VeemahPay</div>
          <div style="margin-top:6px;font-size:20px;font-weight:800;">${args.title}</div>
          <div style="margin-top:4px;font-size:13px;opacity:.9;">${args.subtitle}</div>
        </div>
        <div style="padding:18px 22px;">
          <table style="width:100%;border-collapse:collapse;border:1px solid #eef1f6;border-radius:12px;overflow:hidden;">
            <tbody>
              ${htmlRows}
            </tbody>
          </table>
          <div style="margin-top:14px;color:#5b667a;font-size:12px;line-height:1.5;">
            If you did not authorize this activity, please contact support immediately.
          </div>
        </div>
        <div style="padding:14px 22px;border-top:1px solid #e5e8ef;color:#5b667a;font-size:12px;">
          This is an automated message. Please do not reply.
        </div>
      </div>
    </body>
  </html>`;

  const text = rows.map(([k, v]) => `${k}: ${v}`).join('\n');
  return { html, text, receiptNo };
}

function escapeHtml(v: any) {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function withPrintShell(html: string, args: { title: string; autoprint: boolean }) {
  const head = `<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(args.title)}</title>
    <style>
      @media print {
        body { padding: 0 !important; background: #fff !important; }
      }
    </style>
    ${args.autoprint ? `<script>window.addEventListener('load', () => { try { window.print(); } catch {} });</script>` : ''}
  </head>`;
  if (html.includes('<html>')) return html.replace('<html>', `<html>${head}`);
  if (html.includes('<html ')) return html.replace(/<html[^>]*>/, (m) => `${m}${head}`);
  return `<!doctype html><html>${head}<body>${html}</body></html>`;
}

function buildStatementHtml(args: {
  accountNumber: string;
  accountName?: string | null;
  periodLabel: string;
  generatedAt: Date;
  transactions: any[];
  contacts: Record<string, Contact>;
}) {
  const title = `Statement · ${args.accountNumber}`;
  const generated = args.generatedAt.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

  let totalIn = 0;
  let totalOut = 0;

  const rows = args.transactions
    .map((tx) => {
      const type = String(tx.type ?? '').toLowerCase();
      const status = String(tx.status ?? '');
      const createdAt = tx.created_at ? new Date(tx.created_at) : null;
      const dateStr = createdAt
        ? createdAt.toLocaleString(undefined, { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' })
        : '-';

      let incoming = 0;
      let outgoing = 0;
      let counterparty = '';

      const src = String(tx.account_number ?? '');
      const trg = String(tx.target_account ?? '');
      if (type === 'deposit' && src === args.accountNumber) {
        incoming = Number(tx.amount ?? 0) || 0;
      } else if (type === 'withdraw' && src === args.accountNumber) {
        outgoing = Number(tx.amount ?? 0) || 0;
      } else if (type === 'transfer') {
        if (trg === args.accountNumber) {
          incoming = Number(tx.amount ?? 0) || 0;
          counterparty = src;
        } else if (src === args.accountNumber) {
          outgoing = Number(tx.amount ?? 0) || 0;
          counterparty = trg;
        }
      }

      totalIn += incoming;
      totalOut += outgoing;

      const cpName = counterparty ? args.contacts[counterparty]?.name : null;
      const cpLabel = counterparty ? `${escapeHtml(counterparty)}${cpName ? ` · ${escapeHtml(cpName)}` : ''}` : '-';
      const note = String(tx.note ?? '').trim();

      return `<tr>
        <td style="padding:10px 12px;border-bottom:1px solid #e6e8ee;color:#0b1320;font-size:13px;">${escapeHtml(tx.id)}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e6e8ee;color:#0b1320;font-size:13px;text-transform:capitalize;">${escapeHtml(type || '-')}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e6e8ee;color:#0b1320;font-size:13px;">${escapeHtml(status || '-')}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e6e8ee;color:#0b1320;font-size:13px;">${escapeHtml(dateStr)}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e6e8ee;color:#0b1320;font-size:13px;">${cpLabel}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e6e8ee;color:#0b1320;font-size:13px;text-align:right;">${incoming ? escapeHtml(formatMoney(incoming)) : ''}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e6e8ee;color:#0b1320;font-size:13px;text-align:right;">${outgoing ? escapeHtml(formatMoney(outgoing)) : ''}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e6e8ee;color:#0b1320;font-size:13px;">${escapeHtml(note)}</td>
      </tr>`;
    })
    .join('');

  const net = totalIn - totalOut;

  const html = `<!doctype html>
  <html>
    <body style="margin:0;background:#f7f8fb;padding:24px;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
      <div style="max-width:900px;margin:0 auto;background:#ffffff;border:1px solid #e5e8ef;border-radius:14px;overflow:hidden;">
        <div style="padding:18px 22px;background:linear-gradient(135deg,#0a6bff,#39b6ff);color:#ffffff;">
          <div style="font-size:16px;font-weight:800;letter-spacing:.2px;">VeemahPay</div>
          <div style="margin-top:6px;font-size:20px;font-weight:800;">Statement</div>
          <div style="margin-top:4px;font-size:13px;opacity:.9;">${escapeHtml(args.periodLabel)} · Generated ${escapeHtml(generated)}</div>
        </div>
        <div style="padding:18px 22px;">
          <div style="display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:14px;">
            <div style="color:#0b1320;font-size:13px;">
              <div style="font-weight:700;">Account</div>
              <div>${escapeHtml(args.accountNumber)}${args.accountName ? ` · ${escapeHtml(args.accountName)}` : ''}</div>
            </div>
            <div style="color:#0b1320;font-size:13px;text-align:right;">
              <div style="font-weight:700;">Totals</div>
              <div>In: ${escapeHtml(formatMoney(totalIn))} · Out: ${escapeHtml(formatMoney(totalOut))} · Net: ${escapeHtml(formatMoney(net))}</div>
            </div>
          </div>
          <table style="width:100%;border-collapse:collapse;border:1px solid #eef1f6;border-radius:12px;overflow:hidden;">
            <thead>
              <tr style="background:#f3f5f9;">
                <th style="text-align:left;padding:10px 12px;border-bottom:1px solid #e6e8ee;color:#5b667a;font-size:12px;">ID</th>
                <th style="text-align:left;padding:10px 12px;border-bottom:1px solid #e6e8ee;color:#5b667a;font-size:12px;">Type</th>
                <th style="text-align:left;padding:10px 12px;border-bottom:1px solid #e6e8ee;color:#5b667a;font-size:12px;">Status</th>
                <th style="text-align:left;padding:10px 12px;border-bottom:1px solid #e6e8ee;color:#5b667a;font-size:12px;">Date</th>
                <th style="text-align:left;padding:10px 12px;border-bottom:1px solid #e6e8ee;color:#5b667a;font-size:12px;">Counterparty</th>
                <th style="text-align:right;padding:10px 12px;border-bottom:1px solid #e6e8ee;color:#5b667a;font-size:12px;">In</th>
                <th style="text-align:right;padding:10px 12px;border-bottom:1px solid #e6e8ee;color:#5b667a;font-size:12px;">Out</th>
                <th style="text-align:left;padding:10px 12px;border-bottom:1px solid #e6e8ee;color:#5b667a;font-size:12px;">Note</th>
              </tr>
            </thead>
            <tbody>
              ${rows || `<tr><td colspan="8" style="padding:12px;color:#5b667a;font-size:13px;">No transactions found for this period.</td></tr>`}
            </tbody>
          </table>
          <div style="margin-top:14px;color:#5b667a;font-size:12px;line-height:1.5;">
            This statement is provided for your records. Use your browser print dialog to save as PDF.
          </div>
        </div>
        <div style="padding:14px 22px;border-top:1px solid #e5e8ef;color:#5b667a;font-size:12px;">
          This is an automated document. Please do not reply.
        </div>
      </div>
    </body>
  </html>`;

  return { html, title };
}

async function getContacts(client: any, accountNumbers: string[]): Promise<Record<string, Contact>> {
  const out: Record<string, Contact> = {};
  const uniq = Array.from(new Set(accountNumbers.filter(Boolean)));
  if (uniq.length === 0) return out;

  const colsRes = await client.query(
    `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'accounts'`
  );
  const cols: string[] = colsRes.rows.map((r: any) => r.column_name);
  const hasEmail = cols.includes('email');
  const hasName = cols.includes('name');

  const select = [
    'account_number',
    hasName ? 'name' : 'NULL::text AS name',
    hasEmail ? 'email' : 'NULL::text AS email',
  ].join(', ');

  const res = await client.query(`SELECT ${select} FROM accounts WHERE account_number = ANY($1::text[])`, [uniq]);
  for (const row of res.rows as Contact[]) out[row.account_number] = row;
  return out;
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const account = url.searchParams.get('account');
    const type = url.searchParams.get('type');
    const status = url.searchParams.get('status');
    const month = url.searchParams.get('month');
    const idParam = url.searchParams.get('id');
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');
    const q = url.searchParams.get('q');
    const minAmountParam = url.searchParams.get('min_amount');
    const maxAmountParam = url.searchParams.get('max_amount');
    const direction = url.searchParams.get('direction');
    const format = String(url.searchParams.get('format') ?? '').toLowerCase();
    const autoprint = url.searchParams.get('autoprint') === '1';
    const rawLimit = Number(url.searchParams.get('limit') ?? 100);
    const limitCap = format === 'csv' ? 5000 : format === 'statement' ? 20000 : 500;
    const limit = Math.min(rawLimit || 100, limitCap);
    const cursorParam = url.searchParams.get('cursor');
    const cursorIdParam = url.searchParams.get('cursor_id');
    const cursorTsParam = url.searchParams.get('cursor_created_at');

    const session = req.cookies.get('session')?.value;
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    const isAdmin = await isAdminSession(session);
    if (account) {
      if (!isAdmin && String(account) !== String(session)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    } else if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Introspect available columns to gracefully support older schemas
    const colsRes = await pool.query(
      `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'transactions'`
    );
    const cols: string[] = colsRes.rows.map((r: any) => r.column_name);
    if (cols.length === 0) {
      // No transactions table; return empty list instead of 500
      return NextResponse.json({ transactions: [] });
    }
    const has = (c: string) => cols.includes(c);

    const selectFields: string[] = [];
    selectFields.push('id');
    selectFields.push(has('type') ? 'type' : `('unknown')::text AS type`);
    selectFields.push(has('status') ? 'status' : `('Completed')::text AS status`);
    selectFields.push('account_number');
    selectFields.push(has('target_account') ? 'target_account' : 'NULL::text AS target_account');
    selectFields.push('amount::float AS amount');
    selectFields.push(has('fee') ? 'fee::float AS fee' : '0::float AS fee');
    selectFields.push(has('note') ? 'note' : 'NULL AS note');
    selectFields.push(has('created_by') ? 'created_by' : `('-')::text AS created_by`);
    selectFields.push(has('created_at') ? 'created_at' : 'now() AS created_at');
    selectFields.push(has('completed_at') ? 'completed_at' : 'NULL AS completed_at');
    selectFields.push(has('voided_at') ? 'voided_at' : 'NULL AS voided_at');
    selectFields.push(has('source_balance_before') ? 'source_balance_before::float AS source_balance_before' : 'NULL::float AS source_balance_before');
    selectFields.push(has('source_balance_after') ? 'source_balance_after::float AS source_balance_after' : 'NULL::float AS source_balance_after');
    selectFields.push(has('target_balance_before') ? 'target_balance_before::float AS target_balance_before' : 'NULL::float AS target_balance_before');
    selectFields.push(has('target_balance_after') ? 'target_balance_after::float AS target_balance_after' : 'NULL::float AS target_balance_after');

    if (format === 'receipt') {
      const id = Number(idParam);
      if (!Number.isFinite(id) || id <= 0) {
        return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
      }

      const whereReceipt: string[] = [`id = $1`];
      const paramsReceipt: any[] = [id];
      let idxR = 2;
      if (!isAdmin || account) {
        if (!account) {
          return NextResponse.json({ error: 'Account is required' }, { status: 400 });
        }
        if (has('target_account')) {
          whereReceipt.push(`(account_number = $${idxR} OR target_account = $${idxR})`);
        } else {
          whereReceipt.push(`account_number = $${idxR}`);
        }
        paramsReceipt.push(account);
        idxR++;
      }
      const sqlReceipt = `SELECT ${selectFields.join(', ')} FROM transactions WHERE ${whereReceipt.join(' AND ')} LIMIT 1`;
      const receiptRes = await pool.query(sqlReceipt, paramsReceipt);
      if (receiptRes.rowCount === 0) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }
      const tx = receiptRes.rows[0];
      const occurredAt = tx.created_at ? new Date(tx.created_at) : new Date();
      const email = buildReceiptEmail({
        title: 'Transaction Receipt',
        subtitle: 'Use your browser print dialog to save as PDF.',
        transactionId: tx.id,
        status: String(tx.status ?? ''),
        type: String(tx.type ?? ''),
        amount: Number(tx.amount ?? 0) || 0,
        occurredAt,
        fromAccount: tx.account_number ? String(tx.account_number) : null,
        toAccount: tx.target_account ? String(tx.target_account) : null,
        note: tx.note ? String(tx.note) : null,
        sourceBalanceBefore: tx.source_balance_before ?? null,
        sourceBalanceAfter: tx.source_balance_after ?? null,
        targetBalanceBefore: tx.target_balance_before ?? null,
        targetBalanceAfter: tx.target_balance_after ?? null,
      });
      const printable = withPrintShell(email.html, { title: `Receipt ${email.receiptNo}`, autoprint });
      return new NextResponse(printable, {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-store',
        },
      });
    }

    const where: string[] = [];
    const params: any[] = [];
    let idx = 1;
    if (account) {
      if (has('target_account')) {
        where.push(`(account_number = $${idx} OR target_account = $${idx})`);
      } else {
        where.push(`account_number = $${idx}`);
      }
      params.push(account);
      idx++;
    }
    if (direction && account && has('target_account') && has('type')) {
      const d = String(direction).toLowerCase();
      if (d === 'in') {
        where.push(`((type = 'deposit' AND account_number = $${idx}) OR (type = 'transfer' AND target_account = $${idx}))`);
        params.push(account);
        idx++;
      } else if (d === 'out') {
        where.push(`((type = 'withdraw' AND account_number = $${idx}) OR (type = 'transfer' AND account_number = $${idx} AND (target_account IS NULL OR target_account <> $${idx})))`);
        params.push(account);
        idx++;
      }
    }
    if (type && has('type')) {
      where.push(`type = $${idx}`);
      params.push(type);
      idx++;
    }
    if (status && has('status')) {
      where.push(`status = $${idx}`);
      params.push(status);
      idx++;
    }
    if (month && has('created_at')) {
      const m = String(month).trim();
      const match = /^(\d{4})-(\d{2})$/.exec(m);
      if (!match) {
        return NextResponse.json({ error: 'Invalid month format (YYYY-MM)' }, { status: 400 });
      }
      const year = Number(match[1]);
      const mon = Number(match[2]);
      if (!Number.isFinite(year) || !Number.isFinite(mon) || mon < 1 || mon > 12) {
        return NextResponse.json({ error: 'Invalid month' }, { status: 400 });
      }
      const start = new Date(Date.UTC(year, mon - 1, 1, 0, 0, 0, 0));
      const end = new Date(Date.UTC(year, mon, 1, 0, 0, 0, 0));
      where.push(`created_at >= $${idx}`);
      params.push(start);
      idx++;
      where.push(`created_at < $${idx}`);
      params.push(end);
      idx++;
    }
    if (from && has('created_at')) {
      where.push(`created_at >= $${idx}`);
      params.push(new Date(from));
      idx++;
    }
    if (to && has('created_at')) {
      where.push(`created_at <= $${idx}`);
      params.push(new Date(to));
      idx++;
    }
    const minAmount = minAmountParam != null && minAmountParam !== '' ? Number(minAmountParam) : null;
    const maxAmount = maxAmountParam != null && maxAmountParam !== '' ? Number(maxAmountParam) : null;
    if (minAmount != null && Number.isFinite(minAmount) && has('amount')) {
      where.push(`amount >= $${idx}`);
      params.push(minAmount);
      idx++;
    }
    if (maxAmount != null && Number.isFinite(maxAmount) && has('amount')) {
      where.push(`amount <= $${idx}`);
      params.push(maxAmount);
      idx++;
    }

    if (q) {
      const qq = String(q).trim();
      if (qq) {
        const ors: string[] = [];
        const like = `%${qq}%`;
        const qNum = Number(qq);
        if (Number.isFinite(qNum)) {
          ors.push(`id = $${idx}`);
          params.push(qNum);
          idx++;
          if (has('amount')) {
            ors.push(`amount::float = $${idx}`);
            params.push(qNum);
            idx++;
          }
        }
        ors.push(`account_number ILIKE $${idx}`);
        params.push(like);
        idx++;
        if (has('target_account')) {
          ors.push(`target_account ILIKE $${idx}`);
          params.push(like);
          idx++;
        }
        if (has('created_by')) {
          ors.push(`created_by ILIKE $${idx}`);
          params.push(like);
          idx++;
        }
        if (has('note')) {
          ors.push(`note ILIKE $${idx}`);
          params.push(like);
          idx++;
        }
        if (ors.length) where.push(`(${ors.join(' OR ')})`);
      }
    }

    const hasCreatedAt = has('created_at');

    let cursorId: number | null = null;
    let cursorTs: Date | null = null;
    if (cursorParam) {
      try {
        const raw = Buffer.from(cursorParam, 'base64').toString('utf8');
        const obj = JSON.parse(raw);
        if (obj && typeof obj.id !== 'undefined') cursorId = Number(obj.id);
        if (obj && obj.created_at) cursorTs = new Date(obj.created_at);
      } catch {}
    }
    if (!cursorId && cursorIdParam) cursorId = Number(cursorIdParam);
    if (!cursorTs && cursorTsParam) cursorTs = new Date(cursorTsParam);

    if (hasCreatedAt && (cursorTs || cursorId)) {
      if (cursorTs && cursorId) {
        where.push(`(created_at < $${idx} OR (created_at = $${idx} AND id < $${idx + 1}))`);
        params.push(cursorTs);
        params.push(cursorId);
        idx += 2;
      } else if (cursorTs) {
        where.push(`created_at < $${idx}`);
        params.push(cursorTs);
        idx += 1;
      } else if (cursorId) {
        where.push(`id < $${idx}`);
        params.push(cursorId);
        idx += 1;
      }
    } else if (!hasCreatedAt && cursorId) {
      where.push(`id < $${idx}`);
      params.push(cursorId);
      idx += 1;
    }

    const order = hasCreatedAt ? 'created_at DESC, id DESC' : 'id DESC';
    const sql = `SELECT ${selectFields.join(', ')} FROM transactions ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY ${order} LIMIT ${limit}`;
    const res = await pool.query(sql, params);

    if (format === 'statement') {
      if (!account) {
        return NextResponse.json({ error: 'Account is required' }, { status: 400 });
      }
      const accNum = String(account);
      const counterpartyNumbers: string[] = [];
      for (const row of res.rows) {
        const t = String(row.type ?? '').toLowerCase();
        if (t === 'transfer') {
          if (String(row.account_number ?? '') === accNum && row.target_account) counterpartyNumbers.push(String(row.target_account));
          if (String(row.target_account ?? '') === accNum && row.account_number) counterpartyNumbers.push(String(row.account_number));
        }
      }
      const contacts = await getContacts(pool, [accNum, ...counterpartyNumbers]);
      const periodLabel = month ? `Month ${String(month)}` : from || to ? `Period ${from ? String(from) : ''}${from && to ? ' – ' : ''}${to ? String(to) : ''}` : 'All time';
      const doc = buildStatementHtml({
        accountNumber: accNum,
        accountName: contacts[accNum]?.name ?? null,
        periodLabel,
        generatedAt: new Date(),
        transactions: res.rows,
        contacts,
      });
      const printable = withPrintShell(doc.html, { title: doc.title, autoprint });
      return new NextResponse(printable, {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-store',
        },
      });
    }

    if (format === 'csv') {
      const csvEscape = (v: any) => {
        const s = String(v ?? '');
        if (s.includes('"') || s.includes(',') || s.includes('\n') || s.includes('\r')) return `"${s.replace(/"/g, '""')}"`;
        return s;
      };
      const header = [
        'id',
        'type',
        'status',
        'amount',
        'fee',
        'direction',
        'counterparty',
        'account_number',
        'target_account',
        'note',
        'created_at',
        'completed_at',
        'voided_at',
        'created_by',
        'source_balance_before',
        'source_balance_after',
        'target_balance_before',
        'target_balance_after',
      ];
      const lines: string[] = [];
      lines.push(header.join(','));
      for (const row of res.rows) {
        let dir = '';
        let counterparty = '';
        if (account) {
          const acc = String(account);
          const src = String(row.account_number ?? '');
          const trg = String(row.target_account ?? '');
          const t = String(row.type ?? '').toLowerCase();
          if (t === 'deposit' && src === acc) {
            dir = 'IN';
          } else if (t === 'withdraw' && src === acc) {
            dir = 'OUT';
          } else if (t === 'transfer') {
            if (trg === acc) {
              dir = 'IN';
              counterparty = src;
            } else if (src === acc) {
              dir = 'OUT';
              counterparty = trg;
            }
          }
        }

        const values = [
          row.id,
          row.type,
          row.status,
          row.amount,
          row.fee,
          dir,
          counterparty,
          row.account_number,
          row.target_account,
          row.note,
          row.created_at ? new Date(row.created_at).toISOString() : '',
          row.completed_at ? new Date(row.completed_at).toISOString() : '',
          row.voided_at ? new Date(row.voided_at).toISOString() : '',
          row.created_by,
          row.source_balance_before,
          row.source_balance_after,
          row.target_balance_before,
          row.target_balance_after,
        ];
        lines.push(values.map(csvEscape).join(','));
      }

      const fileBase = account ? `veemahpay-transactions-${account}` : 'veemahpay-transactions';
      const csv = lines.join('\n');
      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${fileBase}.csv"`,
          'Cache-Control': 'no-store',
        },
      });
    }

    let next_cursor: string | null = null;
    if (res.rows.length === limit) {
      const last = res.rows[res.rows.length - 1];
      if (hasCreatedAt) {
        next_cursor = Buffer.from(JSON.stringify({ id: last.id, created_at: last.created_at })).toString('base64');
      } else {
        next_cursor = String(last.id);
      }
    }
    return NextResponse.json({ transactions: res.rows, next_cursor });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Server error' }, { status: 500 });
  }
}

  export async function POST(req: NextRequest) {
    const session = req.cookies.get('session')?.value;
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    let client: any;

    try {
      const body = await req.json();
      const { type, source_account, target_account, amount, note, pending, pin } = body;
    const t: TxType = type;
    const amt = Number(amount);

    if (!['deposit','withdraw','transfer'].includes(String(t))) {
      return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
    }
    if (Number.isNaN(amt) || amt <= 0) {
      return NextResponse.json({ error: 'Amount must be positive' }, { status: 400 });
    }
    if (!source_account || (t === 'transfer' && !target_account)) {
      return NextResponse.json({ error: 'Missing account(s)' }, { status: 400 });
    }
    if ((t === 'withdraw' || t === 'transfer') && !pin) {
        return NextResponse.json({ error: 'PIN is required for this transaction.' }, { status: 400 });
    }

    // Authorization: customers can only act on their own source account; admin can act on any.
    const isAdmin = await isAdminSession(session);
    if (!isAdmin && session !== source_account) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const upstream = await fetch(`${JAVA_BACKEND_URL}/api/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: t,
        source_account,
        target_account,
        amount: amt,
        note,
        pending,
        pin,
      }),
    });
    const data = await upstream.json().catch(() => null);
    if (!upstream.ok) {
      return NextResponse.json(data ?? { error: 'Transaction failed' }, { status: upstream.status });
    }
    return NextResponse.json(data ?? { ok: true });

    // 1. Acquire locks in deterministic order to prevent deadlocks and race conditions
    const accountsToLock = [source_account];
    if (t === 'transfer' && target_account) {
      accountsToLock.push(target_account);
    }
    // Sort account numbers to ensure consistent locking order (Deadlock Prevention)
    accountsToLock.sort();

    for (const acc of accountsToLock) {
      try {
        // Use FOR UPDATE NOWAIT to fail fast if row is locked elsewhere
        await client.query('SELECT 1 FROM accounts WHERE account_number = $1 FOR UPDATE NOWAIT', [acc]);
      } catch (e: any) {
        if (String(e?.code) === '55P03') {
          throw new Error('Account is busy. Please try again.');
        }
        throw e;
      }
    }

    // 2. Load source (and target if needed) - now safe because rows are locked
    const srcRes = await client.query(
      `SELECT account_number, status, balance::float AS balance, pin FROM accounts WHERE account_number = $1`,
      [source_account]
    );
    if (srcRes.rowCount === 0) throw new Error('Source account not found');
    const src = srcRes.rows[0];
    if (src.status !== 'Active') throw new Error('Source account unavailable');
    
    // Validate PIN for sensitive transactions
    if ((t === 'withdraw' || t === 'transfer') && !isAdmin) {
        if (src.pin !== pin) {
            throw new Error('Invalid PIN.');
        }
    }

    let trg: any = null;
    if (t === 'transfer') {
      const trgRes = await client.query(
        `SELECT account_number, status, balance::float AS balance FROM accounts WHERE account_number = $1`,
        [target_account]
      );
      if (trgRes.rowCount === 0) throw new Error('Target account not found');
      trg = trgRes.rows[0];
      if (trg.status !== 'Active') throw new Error('Target account unavailable');
    }

    const status = pending ? 'Pending' : 'Completed';
    const srcBefore = src.balance;
    const trgBefore = trg ? trg.balance : null;
    let srcAfter = srcBefore;
    let trgAfter = trgBefore;

    // If immediate, apply effects
    if (!pending) {
      if (t === 'deposit') {
        srcAfter = src.balance + amt;
        await client.query(`UPDATE accounts SET balance = balance + $1 WHERE account_number = $2`, [amt, source_account]);
      } else if (t === 'withdraw') {
        if (amt > src.balance) throw new Error('Insufficient funds');
        srcAfter = src.balance - amt;
        await client.query(`UPDATE accounts SET balance = balance - $1 WHERE account_number = $2`, [amt, source_account]);
      } else {
        if (amt > src.balance) throw new Error('Insufficient funds');
        srcAfter = src.balance - amt;
        trgAfter = trg.balance + amt;
        await client.query(`UPDATE accounts SET balance = balance - $1 WHERE account_number = $2`, [amt, source_account]);
        await client.query(`UPDATE accounts SET balance = balance + $1 WHERE account_number = $2`, [amt, target_account]);
      }
    }

    // Introspect available transaction columns for schema-resilient insert
    const colsRes = await client.query(
      `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'transactions'`
    );
    const cols: string[] = colsRes.rows.map((r: any) => r.column_name);
    const has = (c: string) => cols.includes(c);

    // If transactions table is missing or lacks required key, skip ledger insert gracefully
    let inserted: any = { rows: [] };
    if (cols.length > 0 && has('account_number')) {
      const insertCols: string[] = [];
      const valuesSql: string[] = [];
      const params: any[] = [];
      let idx = 1;

      // Always include account_number
      insertCols.push('account_number');
      valuesSql.push(`$${idx}`);
      params.push(source_account);
      idx++;

      if (has('target_account')) { insertCols.push('target_account'); valuesSql.push(`$${idx}`); params.push(target_account ?? null); idx++; }
      if (has('type'))          { insertCols.push('type');          valuesSql.push(`$${idx}`); params.push(t); idx++; }
      if (has('status'))        { insertCols.push('status');        valuesSql.push(`$${idx}`); params.push(status); idx++; }
      if (has('amount'))        { insertCols.push('amount');        valuesSql.push(`$${idx}`); params.push(amt); idx++; }
      if (has('fee'))           { insertCols.push('fee');           valuesSql.push(`$${idx}`); params.push(0); idx++; }
      if (has('note'))          { insertCols.push('note');          valuesSql.push(`$${idx}`); params.push(note ?? null); idx++; }
      if (has('created_by'))    { insertCols.push('created_by');    valuesSql.push(`$${idx}`); params.push(session ?? '0000'); idx++; }
      // Rely on default NOW() if created_at exists; otherwise skip
      if (has('created_at'))    { insertCols.push('created_at');    valuesSql.push('now()'); }
      if (has('completed_at'))  { insertCols.push('completed_at');  valuesSql.push(pending ? 'NULL' : 'now()'); }
      if (has('voided_at'))     { insertCols.push('voided_at');     valuesSql.push('NULL'); }
      if (has('source_balance_before')) { insertCols.push('source_balance_before'); valuesSql.push(`$${idx}`); params.push(srcBefore); idx++; }
      if (has('source_balance_after'))  { insertCols.push('source_balance_after');  valuesSql.push(`$${idx}`); params.push(srcAfter); idx++; }
      if (has('target_balance_before')) { insertCols.push('target_balance_before'); valuesSql.push(`$${idx}`); params.push(trgBefore); idx++; }
      if (has('target_balance_after'))  { insertCols.push('target_balance_after');  valuesSql.push(`$${idx}`); params.push(trgAfter ?? null); idx++; }

      const returning: string[] = [];
      returning.push('id');
      returning.push(has('type') ? 'type' : `('unknown')::text AS type`);
      returning.push(has('status') ? 'status' : `('Completed')::text AS status`);
      returning.push('account_number');
      returning.push(has('target_account') ? 'target_account' : 'NULL::text AS target_account');
      returning.push(has('amount') ? 'amount::float AS amount' : `${amt}::float AS amount`);
      returning.push(has('note') ? 'note' : 'NULL AS note');
      returning.push(has('created_by') ? 'created_by' : `(${session ? `'${session}'` : `'0000'`})::text AS created_by`);
      returning.push(has('created_at') ? 'created_at' : 'now() AS created_at');
      returning.push(has('completed_at') ? 'completed_at' : (pending ? 'NULL AS completed_at' : 'now() AS completed_at'));
      returning.push(has('source_balance_before') ? 'source_balance_before::float' : `${srcBefore}::float AS source_balance_before`);
      returning.push(has('source_balance_after') ? 'source_balance_after::float' : `${srcAfter}::float AS source_balance_after`);
      returning.push(has('target_balance_before') ? 'target_balance_before::float' : `${trgBefore ?? 'NULL'}::float AS target_balance_before`);
      returning.push(has('target_balance_after') ? 'target_balance_after::float' : `${trgAfter ?? 'NULL'}::float AS target_balance_after`);

      const sql = `INSERT INTO transactions (${insertCols.join(', ')}) VALUES (${valuesSql.join(', ')}) RETURNING ${returning.join(', ')}`;
      inserted = await client.query(sql, params);
    }

    const tx = inserted.rows[0];
    // Audit (if table exists)
    const auditExists = await client.query(`SELECT to_regclass('public.transaction_audit') AS r`);
    if (auditExists.rows?.[0]?.r) {
      await client.query(
        `INSERT INTO transaction_audit (transaction_id, action, performed_by, details) VALUES ($1,'create',$2,$3::jsonb)`,
        [tx.id, session, JSON.stringify({ pending: !!pending })]
      );
      if (!pending) {
        await client.query(
          `INSERT INTO transaction_audit (transaction_id, action, performed_by) VALUES ($1,'complete',$2)`,
          [tx.id, session]
        );
      }
    }

    await client.query('COMMIT');

    try {
      const notifExists = await client.query(`SELECT to_regclass('public.notifications') AS r`);
      const hasNotif = !!notifExists.rows?.[0]?.r;
      if (hasNotif) {
        const baseMeta = {
          transaction_id: tx?.id ?? null,
          type: tx?.type ?? t,
          status: tx?.status ?? status,
          amount: amt,
          note: note ?? null,
        };
        await client.query(
          `INSERT INTO public.notifications (type, title, body, status, recipient_account_number, sender_account_number, metadata)
           VALUES ('TRANSACTION', 'Transaction Update', $1, 'UNREAD', $2, $3, $4::jsonb)`,
          [
            `Your ${String(t).toLowerCase()} has been ${pending ? 'created' : 'completed'}.`,
            source_account,
            session ?? null,
            JSON.stringify({ ...baseMeta, role: 'source' }),
          ]
        );
        if (t === 'transfer' && target_account && target_account !== source_account) {
          await client.query(
            `INSERT INTO public.notifications (type, title, body, status, recipient_account_number, sender_account_number, metadata)
             VALUES ('TRANSACTION', 'Transfer Received', $1, 'UNREAD', $2, $3, $4::jsonb)`,
            [
              'You received a transfer.',
              target_account,
              session ?? null,
              JSON.stringify({ ...baseMeta, role: 'target' }),
            ]
          );
        }
      }
    } catch (e) {
      console.error('Notification insert error:', e);
    }

    try {
      if (status === 'Completed' && tx?.id) {
        const contacts = await getContacts(pool, [source_account, target_account].filter(Boolean) as string[]);
        const occurredAt = new Date(tx.completed_at ?? tx.created_at ?? Date.now());

        const base = {
          transactionId: tx.id,
          status: tx.status,
          type: tx.type,
          amount: Number(tx.amount),
          occurredAt,
          fromAccount: tx.account_number ?? source_account,
          toAccount: tx.target_account ?? target_account ?? null,
          note: tx.note ?? null,
          sourceBalanceBefore: tx.source_balance_before ?? srcBefore ?? null,
          sourceBalanceAfter: tx.source_balance_after ?? srcAfter ?? null,
          targetBalanceBefore: tx.target_balance_before ?? trgBefore ?? null,
          targetBalanceAfter: tx.target_balance_after ?? trgAfter ?? null,
        };

        if (String(tx.type).toLowerCase() === 'transfer') {
          const sender = contacts[source_account];
          const recipient = target_account ? contacts[target_account] : undefined;

          const senderEmail = sender?.email;
          if (typeof senderEmail === 'string') {
            const to = senderEmail;
            if (to) {
              const built = buildReceiptEmail({
                ...base,
                title: 'Transfer Receipt',
                subtitle: 'Your transfer has been completed.',
              });
              await sendResendEmail({
                to: String(to),
                subject: `VeemahPay Receipt ${built.receiptNo} · Transfer Completed`,
                html: built.html,
                text: built.text,
              });
            }
          }

          const recipientEmail = recipient?.email;
          if (typeof recipientEmail === 'string') {
            const to = recipientEmail;
            if (to) {
              const built = buildReceiptEmail({
                ...base,
                title: 'Transfer Received',
                subtitle: 'You received a transfer.',
              });
              await sendResendEmail({
                to: String(to),
                subject: `VeemahPay Receipt ${built.receiptNo} · Transfer Received`,
                html: built.html,
                text: built.text,
              });
            }
          }
        } else {
          const owner = contacts[source_account];
          const ownerEmail = owner?.email;
          if (typeof ownerEmail === 'string') {
            const to = ownerEmail;
            if (to) {
              const prettyType = String(tx.type).toLowerCase() === 'deposit' ? 'Deposit' : 'Withdrawal';
              const built = buildReceiptEmail({
                ...base,
                title: `${prettyType} Receipt`,
                subtitle: `Your ${prettyType.toLowerCase()} has been completed.`,
                toAccount: null,
              });
              await sendResendEmail({
                to: String(to),
                subject: `VeemahPay Receipt ${built.receiptNo} · ${prettyType} Completed`,
                html: built.html,
                text: built.text,
              });
            }
          }
        }
      }
    } catch (e) {
      console.error('Receipt email error:', e);
    }

    return NextResponse.json({ transaction: tx });
  } catch (err: any) {
    if (client) await client.query('ROLLBACK');
    console.error('Transaction Error:', err);
    return NextResponse.json({ error: err.message ?? 'Server error' }, { status: 400 });
  } finally {
    if (client) client.release();
  }
}

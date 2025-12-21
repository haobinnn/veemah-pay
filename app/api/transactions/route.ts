import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';

type TxType = 'deposit' | 'withdraw' | 'transfer';

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
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');
    const q = url.searchParams.get('q');
    const limit = Math.min(Number(url.searchParams.get('limit') ?? 100), 500);
    const cursorParam = url.searchParams.get('cursor');
    const cursorIdParam = url.searchParams.get('cursor_id');
    const cursorTsParam = url.searchParams.get('cursor_created_at');

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
    if (q && has('note')) {
      where.push(`(note ILIKE $${idx})`);
      params.push(`%${q}%`);
      idx++;
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
    let client;
    try {
      const body = await req.json();
      const { type, source_account, target_account, amount, note, pending, pin } = body;
    const session = req.cookies.get('session')?.value;
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
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    const isAdmin = session === '0000';
    if (!isAdmin && session !== source_account) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    client = await pool.connect();
    await client.query('BEGIN');
    await client.query(`SET LOCAL lock_timeout = '3s'`);

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

          if (sender?.email) {
            const built = buildReceiptEmail({
              ...base,
              title: 'Transfer Receipt',
              subtitle: 'Your transfer has been completed.',
            });
            await sendResendEmail({
              to: sender.email,
              subject: `VeemahPay Receipt ${built.receiptNo} · Transfer Completed`,
              html: built.html,
              text: built.text,
            });
          }

          if (recipient?.email) {
            const built = buildReceiptEmail({
              ...base,
              title: 'Transfer Received',
              subtitle: 'You received a transfer.',
            });
            await sendResendEmail({
              to: recipient.email,
              subject: `VeemahPay Receipt ${built.receiptNo} · Transfer Received`,
              html: built.html,
              text: built.text,
            });
          }
        } else {
          const owner = contacts[source_account];
          if (owner?.email) {
            const prettyType = String(tx.type).toLowerCase() === 'deposit' ? 'Deposit' : 'Withdrawal';
            const built = buildReceiptEmail({
              ...base,
              title: `${prettyType} Receipt`,
              subtitle: `Your ${prettyType.toLowerCase()} has been completed.`,
              toAccount: null,
            });
            await sendResendEmail({
              to: owner.email,
              subject: `VeemahPay Receipt ${built.receiptNo} · ${prettyType} Completed`,
              html: built.html,
              text: built.text,
            });
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

import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';

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

function buildEmail(args: {
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
  reason?: string | null;
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
  const safeReason = String(args.reason ?? '').trim();

  const rows: Array<[string, string]> = [
    ['Reference', receiptNo],
    ['Transaction ID', String(args.transactionId)],
    ['Type', String(args.type)],
    ['Status', String(args.status)],
    ['Date', occurred],
    ['Amount', amountStr],
  ];

  if (args.fromAccount) rows.push(['From', String(args.fromAccount)]);
  if (args.toAccount) rows.push(['To', String(args.toAccount)]);
  if (safeNote) rows.push(['Note', safeNote]);
  if (safeReason) rows.push(['Reason', safeReason]);

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

async function getContacts(accountNumbers: string[]): Promise<Record<string, Contact>> {
  const out: Record<string, Contact> = {};
  const uniq = Array.from(new Set(accountNumbers.filter(Boolean)));
  if (uniq.length === 0) return out;

  const colsRes = await pool.query(
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

  const res = await pool.query(`SELECT ${select} FROM accounts WHERE account_number = ANY($1::text[])`, [uniq]);
  for (const row of res.rows as Contact[]) out[row.account_number] = row;
  return out;
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    const colsRes = await pool.query(
      `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'transactions'`
    );
    const cols: string[] = colsRes.rows.map((r: any) => r.column_name);
    if (cols.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });
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

    const sql = `SELECT ${selectFields.join(', ')} FROM transactions WHERE id = $1`;
    const res = await pool.query(sql, [id]);
    if (res.rowCount === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ transaction: res.rows[0] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Server error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params;
  const body = await req.json();
  const session = req.cookies.get('session')?.value;
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const isAdmin = session === '0000';

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const curRes = await client.query('SELECT * FROM transactions WHERE id = $1 FOR UPDATE', [id]);
    if (curRes.rowCount === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    const tx = curRes.rows[0];
    const prevStatus = String(tx.status);

    // Customers may only edit their own pending note
    if (!isAdmin && !(tx.status === 'Pending' && tx.account_number === session)) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Update note on pending
    if (typeof body.note === 'string') {
      if (tx.status !== 'Pending') throw new Error('Only pending transactions can be updated');
      await client.query('UPDATE transactions SET note = $1 WHERE id = $2', [body.note, id]);
      await client.query(
        `INSERT INTO transaction_audit (transaction_id, action, performed_by, details)
         VALUES ($1,'update',$2,$3::jsonb)`,
        [id, session, JSON.stringify({ note: body.note })]
      );
    }

    // Complete pending
    if (body.action === 'complete') {
      if (!isAdmin) throw new Error('Admin required to complete');
      if (tx.status !== 'Pending') throw new Error('Only pending transactions can be completed');

      // Reload account balances
      const srcRes = await client.query('SELECT account_number, status, balance::float AS balance FROM accounts WHERE account_number = $1', [tx.account_number]);
      if (srcRes.rowCount === 0) throw new Error('Source account not found');
      const src = srcRes.rows[0];
      if (src.status !== 'Active') throw new Error('Source account unavailable');
      let trg: any = null;
      if (tx.type === 'transfer') {
        const tr = await client.query('SELECT account_number, status, balance::float AS balance FROM accounts WHERE account_number = $1', [tx.target_account]);
        if (tr.rowCount === 0) throw new Error('Target account not found');
        trg = tr.rows[0];
        if (trg.status !== 'Active') throw new Error('Target account unavailable');
      }

      let srcAfter = src.balance;
      let trgAfter = trg ? trg.balance : null;
      const amt = Number(tx.amount);
      if (tx.type === 'deposit') {
        srcAfter = src.balance + amt;
        await client.query('UPDATE accounts SET balance = balance + $1 WHERE account_number = $2', [amt, tx.account_number]);
      } else if (tx.type === 'withdraw') {
        if (amt > src.balance) throw new Error('Insufficient funds');
        srcAfter = src.balance - amt;
        await client.query('UPDATE accounts SET balance = balance - $1 WHERE account_number = $2', [amt, tx.account_number]);
      } else {
        if (amt > src.balance) throw new Error('Insufficient funds');
        srcAfter = src.balance - amt;
        trgAfter = trg.balance + amt;
        await client.query('UPDATE accounts SET balance = balance - $1 WHERE account_number = $2', [amt, tx.account_number]);
        await client.query('UPDATE accounts SET balance = balance + $1 WHERE account_number = $2', [amt, tx.target_account]);
      }

      await client.query(
        `UPDATE transactions SET status = 'Completed', completed_at = now(),
         source_balance_before = $1, source_balance_after = $2,
         target_balance_before = $3, target_balance_after = $4
         WHERE id = $5`,
        [src.balance, srcAfter, trg ? trg.balance : null, trgAfter, id]
      );
      await client.query('INSERT INTO transaction_audit (transaction_id, action, performed_by) VALUES ($1,\'complete\',$2)', [id, session]);
    }

    // Void: if completed, rollback; if pending, mark void
    let voidReason: string | null = null;
    if (body.action === 'void') {
      if (!isAdmin) throw new Error('Admin required to void');
      const reason = String(body.reason ?? '');
      voidReason = reason;
      if (tx.status === 'Completed') {
        const amt = Number(tx.amount);
        if (tx.type === 'deposit') {
          await client.query('UPDATE accounts SET balance = balance - $1 WHERE account_number = $2', [amt, tx.account_number]);
        } else if (tx.type === 'withdraw') {
          await client.query('UPDATE accounts SET balance = balance + $1 WHERE account_number = $2', [amt, tx.account_number]);
        } else {
          await client.query('UPDATE accounts SET balance = balance + $1 WHERE account_number = $2', [amt, tx.account_number]);
          await client.query('UPDATE accounts SET balance = balance - $1 WHERE account_number = $2', [amt, tx.target_account]);
        }
      }
      await client.query('UPDATE transactions SET status = \"Voided\", voided_at = now() WHERE id = $1', [id]);
      await client.query(
        `INSERT INTO transaction_audit (transaction_id, action, performed_by, reason)
         VALUES ($1,'void',$2,$3)`,
        [id, session, reason]
      );
      if (tx.status === 'Completed') {
        await client.query('INSERT INTO transaction_audit (transaction_id, action, performed_by) VALUES ($1,\'rollback\',$2)', [id, session]);
      }
    }

    await client.query('COMMIT');
    const out = await pool.query('SELECT * FROM transactions WHERE id = $1', [id]);
    const outTx = out.rows[0];

    try {
      const action = String(body.action ?? '');
      const contacts = await getContacts(
        [String(outTx.account_number ?? ''), String(outTx.target_account ?? '')].filter(Boolean)
      );
      const source = contacts[String(outTx.account_number ?? '')];
      const target = outTx.target_account ? contacts[String(outTx.target_account)] : undefined;

      if (action === 'complete' && prevStatus === 'Pending' && String(outTx.status) === 'Completed') {
        const occurredAt = new Date(outTx.completed_at ?? outTx.created_at ?? Date.now());
        const base = {
          transactionId: outTx.id,
          status: outTx.status,
          type: outTx.type,
          amount: Number(outTx.amount),
          occurredAt,
          fromAccount: outTx.account_number,
          toAccount: outTx.target_account ?? null,
          note: outTx.note ?? null,
          sourceBalanceBefore: outTx.source_balance_before ?? null,
          sourceBalanceAfter: outTx.source_balance_after ?? null,
          targetBalanceBefore: outTx.target_balance_before ?? null,
          targetBalanceAfter: outTx.target_balance_after ?? null,
        };

        if (String(outTx.type).toLowerCase() === 'transfer') {
          if (source?.email) {
            const built = buildEmail({ ...base, title: 'Transfer Receipt', subtitle: 'Your transfer has been completed.' });
            await sendResendEmail({
              to: source.email,
              subject: `VeemahPay Receipt ${built.receiptNo} · Transfer Completed`,
              html: built.html,
              text: built.text,
            });
          }
          if (target?.email) {
            const built = buildEmail({ ...base, title: 'Transfer Received', subtitle: 'You received a transfer.' });
            await sendResendEmail({
              to: target.email,
              subject: `VeemahPay Receipt ${built.receiptNo} · Transfer Received`,
              html: built.html,
              text: built.text,
            });
          }
        } else {
          const prettyType = String(outTx.type).toLowerCase() === 'deposit' ? 'Deposit' : 'Withdrawal';
          if (source?.email) {
            const built = buildEmail({
              ...base,
              title: `${prettyType} Receipt`,
              subtitle: `Your ${prettyType.toLowerCase()} has been completed.`,
              toAccount: null,
            });
            await sendResendEmail({
              to: source.email,
              subject: `VeemahPay Receipt ${built.receiptNo} · ${prettyType} Completed`,
              html: built.html,
              text: built.text,
            });
          }
        }
      }

      if (action === 'void' && String(outTx.status) === 'Voided') {
        const occurredAt = new Date(outTx.voided_at ?? outTx.completed_at ?? outTx.created_at ?? Date.now());
        const base = {
          transactionId: outTx.id,
          status: outTx.status,
          type: outTx.type,
          amount: Number(outTx.amount),
          occurredAt,
          fromAccount: outTx.account_number,
          toAccount: outTx.target_account ?? null,
          note: outTx.note ?? null,
          reason: voidReason,
          sourceBalanceBefore: outTx.source_balance_before ?? null,
          sourceBalanceAfter: outTx.source_balance_after ?? null,
          targetBalanceBefore: outTx.target_balance_before ?? null,
          targetBalanceAfter: outTx.target_balance_after ?? null,
        };

        if (source?.email) {
          const built = buildEmail({ ...base, title: 'Transaction Alert', subtitle: 'A transaction on your account was voided.' });
          await sendResendEmail({
            to: source.email,
            subject: `VeemahPay Alert ${built.receiptNo} · Transaction Voided`,
            html: built.html,
            text: built.text,
          });
        }
        if (String(outTx.type).toLowerCase() === 'transfer' && target?.email) {
          const built = buildEmail({ ...base, title: 'Transaction Alert', subtitle: 'A transfer involving your account was voided.' });
          await sendResendEmail({
            to: target.email,
            subject: `VeemahPay Alert ${built.receiptNo} · Transfer Voided`,
            html: built.html,
            text: built.text,
          });
        }
      }
    } catch (e) {
      console.error('Transaction email error:', e);
    }

    return NextResponse.json({ transaction: out.rows[0] });
  } catch (err: any) {
    await client.query('ROLLBACK');
    return NextResponse.json({ error: err.message ?? 'Server error' }, { status: 400 });
  } finally {
    client.release();
  }
}

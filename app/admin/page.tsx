"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Header } from '@/components/nav/Header';
import { Breadcrumbs } from '@/components/nav/Breadcrumbs';

type Account = { account_number: string; name: string; balance: number; status: "Active" | "Locked" | "Archived"; role?: string | null };
type Transaction = { id: number; type: string; status: string; amount: number; target_account?: string | null; note?: string | null };

import { useLanguage } from '@/components/ui/LanguageProvider';
import { fetchTransactions as fetchTransactionsJava, createTransaction } from '@/lib/java-api';

export default function AdminPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [me, setMe] = useState<Account | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [hasRole, setHasRole] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Account | null>(null);
  const [editName, setEditName] = useState("");
  const [editStatus, setEditStatus] = useState<Account["status"]>("Active");
  const [editRole, setEditRole] = useState("user");
  const [depAmount, setDepAmount] = useState("");
  const [wdAmount, setWdAmount] = useState("");
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  const fetchMe = async () => {
    const res = await fetch("/api/me");
    const data = await res.json();
    if (!data.authenticated) { router.replace("/login"); return; }
    setMe(data.account);
    const admin = !!data?.isAdmin || String(data?.account?.account_number ?? "") === "0000";
    setIsAdmin(admin);
    if (!admin) { router.replace("/login"); return; }
  };

  const fetchAccounts = async () => {
    const qs = search.trim() ? `?q=${encodeURIComponent(search.trim())}` : "";
    const res = await fetch(`/api/accounts${qs}`);
    const data = await res.json();
    const nextAccounts: Account[] = Array.isArray(data.accounts) ? data.accounts : [];
    setAccounts(nextAccounts);
    setHasRole(nextAccounts.some((a: any) => typeof a?.role !== "undefined"));
  };

  const fetchTransactions = async (acc: string) => {
    try {
      const data = await fetchTransactionsJava({ account: acc, limit: 50 });
      setTransactions(data.transactions || []);
    } catch (e: any) {
      console.error('Failed to fetch transactions:', e);
      setTransactions([]);
    }
  };

  useEffect(() => { fetchMe(); }, []);
  useEffect(() => { if (me && isAdmin) fetchAccounts(); }, [me, isAdmin]);
  useEffect(() => {
    if (!selected) return;
    setEditName(selected.name);
    setEditStatus(selected.status);
    if (hasRole) {
      const r = typeof selected.role === "string" && selected.role.trim() ? selected.role.trim().toLowerCase() : "user";
      setEditRole(r);
    }
    fetchTransactions(selected.account_number);
  }, [selected, hasRole]);

  const updateInfo = async (statusOverride?: string) => {
    if (!selected) return;
    setPending(true);
    setError(null);
    try {
      const body: any = { name: editName, status: statusOverride || editStatus };
      if (hasRole) body.role = editRole;
      const res = await fetch(`/api/accounts/${selected.account_number}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Update failed"); return; }
      await fetchAccounts();
      setSelected(data.account);
      if (statusOverride) setEditStatus(data.account.status);
    } finally { setPending(false); }
  };

  const unlockAccount = () => updateInfo('Active');

  const doOp = async (type: "deposit" | "withdraw") => {
    if (!selected) return;
    const amt = Number(type === "deposit" ? depAmount : wdAmount);
    if (!amt || amt <= 0) { setError("Enter a valid amount"); return; }
    setPending(true);
    setError(null);
    try {
      const transactionData = {
        type: type,
        source_account: selected.account_number,
        amount: amt,
        note: `Admin ${type} operation`
      };

      const result = await createTransaction(transactionData);
      if (!result.success) {
        setError(result.message || "Operation failed");
        return;
      }
      
      await fetchAccounts();
      await fetchTransactions(selected.account_number);
      setDepAmount("");
      setWdAmount("");
    } catch (e: any) {
      setError(e.message || "Operation failed");
    } finally { 
      setPending(false); 
    }
  };

  const completeTx = async (id: number) => {
    const res = await fetch(`/api/transactions/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "complete" }) });
    const data = await res.json();
    if (!res.ok) { setError(data.error || "Failed to complete"); return; }
    if (selected) fetchTransactions(selected.account_number);
  };

  const voidTx = async (id: number) => {
    const res = await fetch(`/api/transactions/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "void", reason: "" }) });
    const data = await res.json();
    if (!res.ok) { setError(data.error || "Failed to void"); return; }
    if (selected) fetchTransactions(selected.account_number);
  };

  const rollbackTx = async (id: number) => {
    const res = await fetch(`/api/transactions/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "rollback", reason: "" }) });
    const data = await res.json();
    if (!res.ok) { setError(data.error || "Failed to rollback"); return; }
    if (selected) fetchTransactions(selected.account_number);
  };

  return (
    <main>
      <Header />
      <div className="inner container" style={{ paddingTop: 8 }}>
        <Breadcrumbs />
      </div>
      <section className="quick-actions">
        <div className="inner container" style={{ display: "grid", gap: 16 }}>
          {error && <div style={{ color: "#b00020" }}>{error}</div>}
          <div className="toolbar">
            <input placeholder={t('admin.search_placeholder')} value={search} onChange={e => setSearch(e.target.value)} />
            <button className="btn" onClick={fetchAccounts}>{t('admin.search')}</button>
            <button className="btn" onClick={fetchAccounts}>{t('admin.refresh')}</button>
            <button className="btn" onClick={() => router.push('/admin/archived')}>Archived Accounts</button>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table className="table zebra">
              <thead>
                <tr>
                  <th>{t('admin.account_num')}</th>
                  <th>{t('admin.name')}</th>
                  {hasRole && <th>{t('admin.role')}</th>}
                  <th>{t('admin.status')}</th>
                  <th>{t('admin.balance')}</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map(a => (
                  <tr key={a.account_number} className={selected?.account_number === a.account_number ? "selected" : ""} onClick={() => setSelected(a)}>
                    <td>{a.account_number}</td>
                    <td>{a.name}</td>
                    {hasRole && <td>{typeof a.role === "string" ? a.role.charAt(0).toUpperCase() + a.role.slice(1) : ""}</td>}
                    <td>{a.status}</td>
                    <td className="num">₱{Number(a.balance).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {selected && (
            <div className="actions-grid">
              <div className="card">
                <h3>{t('admin.edit_info')}</h3>
                <input placeholder={t('admin.name')} value={editName} onChange={e => setEditName(e.target.value)} />
                {hasRole && (
                  <select value={editRole} onChange={e => setEditRole(e.target.value)}>
                    <option value="user">{t('admin.role_user')}</option>
                    <option value="admin">{t('admin.role_admin')}</option>
                  </select>
                )}
                <select value={editStatus} onChange={e => setEditStatus(e.target.value as Account["status"]) }>
                  <option>Active</option>
                  <option>Locked</option>
                  <option>Archived</option>
                </select>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn primary" onClick={() => updateInfo()} disabled={pending}>{t('admin.save')}</button>
                  {selected.status === 'Locked' && (
                    <button className="btn" onClick={unlockAccount} disabled={pending} style={{ borderColor: 'var(--success)', color: 'var(--success)' }}>
                      {t('admin.unlock_account')}
                    </button>
                  )}
                </div>
              </div>
              <div className="card">
                <h3>{t('admin.deposit')}</h3>
                <input placeholder={t('admin.amount')} value={depAmount} onChange={e => setDepAmount(e.target.value)} />
                <button className="btn primary" onClick={() => doOp("deposit")} disabled={pending}>{t('admin.deposit')}</button>
              </div>
              <div className="card">
                <h3>{t('admin.withdraw')}</h3>
                <input placeholder={t('admin.amount')} value={wdAmount} onChange={e => setWdAmount(e.target.value)} />
                <button className="btn" onClick={() => doOp("withdraw")} disabled={pending}>{t('admin.withdraw')}</button>
              </div>
            </div>
          )}
          {selected && (
            <div className="card">
              <h3>{t('admin.transactions')}</h3>
              <div style={{ overflowX: "auto" }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>{t('admin.id')}</th>
                      <th>{t('admin.type')}</th>
                      <th>{t('admin.status')}</th>
                      <th>{t('admin.amount')}</th>
                      <th>{t('admin.target')}</th>
                      <th>{t('admin.actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map(tx => (
                      <tr key={tx.id}>
                        <td>{tx.id}</td>
                        <td>{tx.type}</td>
                        <td>{tx.status}</td>
                        <td className="num">₱{Number(tx.amount).toFixed(2)}</td>
                        <td>{tx.target_account || ""}</td>
                        <td>
                          {tx.status === "Pending" && (
                            <>
                              <button className="btn" onClick={() => completeTx(tx.id)}>{t('admin.complete')}</button>
                              <button className="btn" onClick={() => voidTx(tx.id)}>{t('admin.void')}</button>
                              <button className="btn" onClick={() => rollbackTx(tx.id)}>{t('admin.rollback')}</button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

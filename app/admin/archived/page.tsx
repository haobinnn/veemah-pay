"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Header } from '@/components/nav/Header';
import { Breadcrumbs } from '@/components/nav/Breadcrumbs';
import { useLanguage } from '@/components/ui/LanguageProvider';

type Account = { account_number: string; name: string; balance: number; status: "Archived"; role?: string | null };

export default function ArchivedAccountsPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [me, setMe] = useState<any | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [search, setSearch] = useState("");
  const [hasRole, setHasRole] = useState(false);

  const fetchMe = async () => {
    const res = await fetch("/api/me");
    const data = await res.json();
    if (!data.authenticated) { router.replace("/login"); return; }
    setMe(data.account);
    const admin = !!data?.isAdmin || String(data?.account?.account_number ?? "") === "0000";
    setIsAdmin(admin);
    if (!admin) { router.replace("/login"); return; }
  };

  const fetchArchivedAccounts = async () => {
    const qs = search.trim() ? `&q=${encodeURIComponent(search.trim())}` : "";
    // Fetch accounts with status=Archived
    const res = await fetch(`/api/accounts?status=Archived${qs}`);
    const data = await res.json();
    const nextAccounts: Account[] = Array.isArray(data.accounts) ? data.accounts : [];
    setAccounts(nextAccounts);
    setHasRole(nextAccounts.some((a: any) => typeof a?.role !== "undefined"));
  };

  const restoreAccount = async (accountNumber: string) => {
    if (!confirm(`Are you sure you want to restore account ${accountNumber}?`)) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/accounts/${accountNumber}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Active" })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to restore account");
        return;
      }
      await fetchArchivedAccounts();
    } catch (e: any) {
      setError(e.message || "Operation failed");
    } finally {
      setPending(false);
    }
  };

  useEffect(() => { fetchMe(); }, []);
  useEffect(() => { if (me && isAdmin) fetchArchivedAccounts(); }, [me, isAdmin]);

  return (
    <main>
      <Header />
      <div className="inner container" style={{ paddingTop: 8 }}>
        <Breadcrumbs />
      </div>
      <section className="quick-actions">
        <div className="inner container" style={{ display: "grid", gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2>Archived Accounts</h2>
            <button className="btn" onClick={() => router.push('/admin')}>Back to Admin</button>
          </div>
          
          {error && <div style={{ color: "#b00020" }}>{error}</div>}
          
          <div className="toolbar">
            <input placeholder={t('admin.search_placeholder')} value={search} onChange={e => setSearch(e.target.value)} />
            <button className="btn" onClick={fetchArchivedAccounts}>{t('admin.search')}</button>
            <button className="btn" onClick={fetchArchivedAccounts}>{t('admin.refresh')}</button>
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
                  <th>{t('admin.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {accounts.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '24px', color: 'var(--muted)' }}>
                      No archived accounts found
                    </td>
                  </tr>
                ) : (
                  accounts.map(a => (
                    <tr key={a.account_number}>
                      <td>{a.account_number}</td>
                      <td>{a.name}</td>
                      {hasRole && <td>{typeof a.role === "string" ? a.role.charAt(0).toUpperCase() + a.role.slice(1) : ""}</td>}
                      <td>{a.status}</td>
                      <td className="num">₱{Number(a.balance).toFixed(2)}</td>
                      <td>
                        <button 
                          className="btn" 
                          onClick={() => restoreAccount(a.account_number)}
                          disabled={pending}
                          style={{ borderColor: 'var(--success)', color: 'var(--success)' }}
                        >
                          Restore
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </main>
  );
}

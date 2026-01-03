"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Header } from '@/components/nav/Header';
import { SpendingGraph } from '@/components/dashboard/SpendingGraph';
import { useLanguage } from '@/components/ui/LanguageProvider';
import { QRModal } from '@/components/ui/QRModal';
import { MoneyDisplay, PositiveMoney } from '@/components/ui/MoneyDisplay';

type Account = { account_number: string; name: string; balance: number; status: string };
type Transaction = { id: number; type: string; status: string; amount: number; target_account?: string | null; note?: string | null; created_at?: string };


export default function UserPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [me, setMe] = useState<Account | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [depAmount, setDepAmount] = useState("");
  const [wdAmount, setWdAmount] = useState("");
  const [wdPin, setWdPin] = useState("");
  const [txAmount, setTxAmount] = useState("");
  const [txTarget, setTxTarget] = useState("");
  const [txPin, setTxPin] = useState("");
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [qrMode, setQrMode] = useState<"display" | "scan">("display");
  const [refreshing, setRefreshing] = useState(false);

  const readJson = async (res: Response) => {
    try {
      const text = await res.text();
      return text ? JSON.parse(text) : null;
    } catch {
      return null;
    }
  };

  const fetchMe = async () => {
    try {
      const res = await fetch("/api/me");
      const data: any = await readJson(res);
      if (!res.ok) {
        setError(data?.error || t('user.operation_failed'));
        return;
      }
      if (data?.authenticated) {
        if (data.account?.account_number === "0000") { router.replace("/admin"); return; }
        setMe(data.account);
        return;
      }
      router.replace("/login");
    } catch (e: any) {
      setError(e?.message || t('user.operation_failed'));
    }
  };

  const fetchTransactions = async (acc: string) => {
    try {
      setRefreshing(true);
      const res = await fetch(`/api/transactions?account=${encodeURIComponent(acc)}&limit=50`);
      const data: any = await readJson(res);
      const txs = Array.isArray(data?.transactions) ? data.transactions : [];
      setTransactions(txs);
      if (!res.ok) {
        setError(data?.error || t('user.operation_failed'));
      }
    } catch (e: any) {
      setTransactions([]);
      setError(e?.message || t('user.operation_failed'));
    } finally {
      setRefreshing(false);
    }
  };

  const refreshData = async () => {
    if (!me) return;
    setRefreshing(true);
    try {
      await fetchMe();
      await fetchTransactions(me.account_number);
    } catch (e: any) {
      setError(e?.message || t('user.operation_failed'));
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchMe().then(() => {
      // Need to re-fetch me to get the account number if it wasn't set yet, 
      // but simpler is to let the second useEffect handle it.
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (me) fetchTransactions(me.account_number);
  }, [me]);

  const doOp = async (type: "deposit" | "withdraw") => {
    if (!me) return;
    if (pending) return;
    const amt = Number(type === "deposit" ? depAmount : wdAmount);
    if (!amt || amt <= 0) { setError(t('user.enter_valid_amount')); return; }
    
    // Require PIN for withdraw
    if (type === "withdraw" && !wdPin) { setError(t('user.enter_pin')); return; }

    setPending(true);
    setError(null);
    try {
      let opOk = false;
      try {
        const body: any = { type, source_account: me.account_number, amount: amt };
        if (type === "withdraw") body.pin = wdPin;

        const res = await fetch("/api/transactions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body)
        });
        const data: any = await readJson(res);
        if (!res.ok) {
          if (res.status >= 500 || String(data?.error || "").toLowerCase().includes("transaction")) {
            const fallback = await fetch(`/api/accounts/${me.account_number}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ op: type, amount: amt }),
            });
            const fdata: any = await readJson(fallback);
            if (!fallback.ok) {
              setError(fdata?.error || t('user.operation_failed'));
              return;
            }
            opOk = true;
          } else {
            setError(data?.error || t('user.operation_failed'));
            return;
          }
        } else {
          opOk = true;
        }
      } catch (e: any) {
        try {
          const fallback = await fetch(`/api/accounts/${me.account_number}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ op: type, amount: amt }),
          });
          const fdata: any = await readJson(fallback);
          if (!fallback.ok) {
            setError(fdata?.error || (e?.message || t('user.operation_failed')));
            return;
          }
          opOk = true;
        } catch (err: any) {
          setError(err?.message || (e?.message || t('user.operation_failed')));
          return;
        }
      }

      if (!opOk) return;

      // Auto-refresh data after successful operation
      try {
        await refreshData();
      } catch (e: any) {
        setError(e?.message || t('user.operation_failed'));
      }
      setDepAmount("");
      setWdAmount("");
      setWdPin("");
    } finally {
      setPending(false);
    }
  };

  const doTransfer = async () => {
    if (!me) return;
    if (pending) return;
    const amt = Number(txAmount);
    if (!amt || amt <= 0 || !txTarget) { setError(t('user.enter_target_amount')); return; }
    if (!txPin) { setError(t('user.enter_pin')); return; }

    setPending(true);
    setError(null);
    try {
      let opOk = false;
      try {
        const res = await fetch("/api/transactions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "transfer", source_account: me.account_number, target_account: txTarget, amount: amt, pin: txPin })
        });
        const data: any = await readJson(res);
        if (!res.ok) {
          if (res.status >= 500 || String(data?.error || "").toLowerCase().includes("transaction")) {
            let w = await fetch(`/api/accounts/${me.account_number}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ op: "withdraw", amount: amt }),
            });
            let wdata: any = await readJson(w);
            if (!w.ok) { setError(wdata?.error || t('user.transfer_failed')); return; }
            let d = await fetch(`/api/accounts/${txTarget}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ op: "deposit", amount: amt }),
            });
            let ddata: any = await readJson(d);
            if (!d.ok) { setError(ddata?.error || t('user.transfer_failed')); return; }
            opOk = true;
          } else {
            setError(data?.error || t('user.transfer_failed'));
            return;
          }
        } else {
          opOk = true;
        }
      } catch (e: any) {
        try {
          let w = await fetch(`/api/accounts/${me.account_number}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ op: "withdraw", amount: amt }),
          });
          let wdata: any = await readJson(w);
          if (!w.ok) { setError(wdata?.error || (e?.message || t('user.transfer_failed'))); return; }
          let d = await fetch(`/api/accounts/${txTarget}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ op: "deposit", amount: amt }),
          });
          let ddata: any = await readJson(d);
          if (!d.ok) { setError(ddata?.error || (e?.message || t('user.transfer_failed'))); return; }
          opOk = true;
        } catch (err: any) {
          setError(err?.message || (e?.message || t('user.transfer_failed')));
          return;
        }
      }

      if (!opOk) return;

      // Auto-refresh data after successful transfer
      try {
        await refreshData();
      } catch (e: any) {
        setError(e?.message || t('user.transfer_failed'));
      }
      setTxAmount("");
      setTxTarget("");
      setTxPin("");
    } finally {
      setPending(false);
    }
  };

  const handleShowMyQR = () => {
    setQrMode("display");
    setQrModalOpen(true);
  };

  const handleScanQR = () => {
    setQrMode("scan");
    setQrModalOpen(true);
  };

  const handleAccountScanned = (scannedAccount: string) => {
    setTxTarget(scannedAccount);
    setQrModalOpen(false);
  };

  return (
    <main>
      <Header />
      <section className="quick-actions">
        <div className="inner container" style={{ display: "grid", gap: 16 }}>
          {me && (
            <div className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <h3 style={{ margin: 0 }}>{t('dash.overview')}</h3>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 16, fontWeight: 700 }}>{me.name}</div>
                <div
                    style={{
                        padding: '4px 7px',
                        borderRadius: 8,
                        background:
                            me.status === 'Active' ? '#28992e' :
                            me.status === 'Locked' ? '#ac3030' :
                            me.status === 'Archived' ? '#936929' :
                            'var(--muted)',
                        color: '#fff',
                        fontSize: 12,
                        fontWeight: 600,
                        margin: '0 7px'
                    }}
                >
                    {me.status}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.3em', flexWrap: 'wrap', width: '100%' }}>
                <div style={{ flex: '1 1 auto' }}>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>{t('dash.account')}</div>
                  <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: '0.3px' }}>{me.account_number}</div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: '0 0 auto' }}>
                  <div style={{ textAlign: 'right' }} className="right-sided-text">
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>{t('dash.balance')}</div>
                    <div style={{ fontSize: 28, fontWeight: 800, lineHeight: 1 }}>{/* large balance */}
                      <MoneyDisplay amount={me.balance} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
          {error && <div style={{ color: "#b00020" }}>{error}</div>}
          
          <div className="actions-grid">
            <div className="card card flexible-card">
              <h3>{t('dash.deposit')}</h3>
              <input placeholder={t('dash.amount')} value={depAmount} onChange={e => setDepAmount(e.target.value)} />
              <button className="btn primary" onClick={() => doOp("deposit")} disabled={pending}>{t('dash.deposit')}</button>
            </div>
            <div className="card card flexible-card">
              <h3>{t('dash.withdraw')}</h3>
              <input placeholder={t('dash.amount')} value={wdAmount} onChange={e => setWdAmount(e.target.value)} />
              <input type="password" placeholder={t('user.pin_placeholder')} value={wdPin} onChange={e => setWdPin(e.target.value)} maxLength={5} style={{ marginTop: 8 }} />
              <button className="btn primary" onClick={() => doOp("withdraw")} disabled={pending}>{t('dash.withdraw')}</button>
            </div>
            <div className="card card flexible-card">
              <h3>{t('dash.transfer')}</h3>
              <div style={{ display: 'flex', gap: '8px'}}>
                <input 
                  placeholder={t('dash.target')} 
                  value={txTarget} 
                  onChange={e => setTxTarget(e.target.value)} 
                  
                />
                <button 
                  className="btn ghost" 
                  onClick={handleScanQR}
                  title="Scan QR Code"
                  style={{ padding: '8px 12px', fontSize: '14px', flex: '1 0 6em'}}
                >
                  📷 Scan
                </button>
              </div>
              <input placeholder={t('dash.amount')} value={txAmount} onChange={e => setTxAmount(e.target.value)} />
              <input type="password" placeholder={t('user.pin_placeholder')} value={txPin} onChange={e => setTxPin(e.target.value)} maxLength={5} />
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn primary" onClick={doTransfer} disabled={pending}>
                  {t('dash.transfer')}
                </button>
                <button 
                  className="btn ghost" 
                  onClick={handleShowMyQR}
                  title="Show My QR Code"
                  style={{ padding: '8px 12px', fontSize: '14px', flex: '1 0 7em', border: '1px solid #405a9c'  }}
                >
                  📱 My QR
                </button>
              </div>
            </div>
          </div>

          <div className="card">
            <h3>{t('dash.spending')}</h3>
            <SpendingGraph transactions={transactions} />
          </div>

          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3>{t('dash.recent_tx')}</h3>
              <button 
                className="btn ghost" 
                onClick={refreshData}
                disabled={refreshing}
                style={{ padding: '8px 12px', fontSize: '14px' }}
              >
                {refreshing ? '🔄 Refreshing...' : '🔄 Refresh'}
              </button>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table className="table zebra">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th>Amount</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map(t => {
                    // Determine if this is incoming or outgoing money for the user
                    const isIncoming = t.target_account === me?.account_number || t.type === 'deposit';
                    const isOutgoing = (t.type === 'withdraw' || t.type === 'transfer') && !isIncoming;
                    
                    return (
                      <tr key={t.id}>
                        <td>{t.id}</td>
                        <td style={{ textTransform: 'capitalize' }}>{t.type}</td>
                        <td>
                          <span style={{ 
                            padding: '4px 8px', 
                            borderRadius: '4px', 
                            fontSize: '12px',
                            backgroundColor: t.status === 'Completed' ? '#3f9c29' : t.status === 'Pending' ? '#ff9800' : '#f44336',
                            color: 'white'
                          }}>
                            {t.status}
                          </span>
                        </td>
                        <td className="num">
                          <PositiveMoney 
                            amount={isIncoming ? t.amount : -t.amount} 
                            className="num"
                          />
                        </td>
                        <td>{t.created_at ? new Date(t.created_at).toLocaleDateString() : '-'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      <QRModal
        isOpen={qrModalOpen}
        onClose={() => setQrModalOpen(false)}
        mode={qrMode}
        accountNumber={me?.account_number}
        onAccountScanned={handleAccountScanned}
      />
    </main>
  );
}

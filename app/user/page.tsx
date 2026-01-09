"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Header } from '@/components/nav/Header';
import { SpendingGraph } from '@/components/dashboard/SpendingGraph';
import { useLanguage } from '@/components/ui/LanguageProvider';
import { QRModal } from '@/components/ui/QRModal';
import { MoneyDisplay, PositiveMoney } from '@/components/ui/MoneyDisplay';
import { useToast } from "@/components/ui/Toast";
import { fetchTransactions as fetchTransactionsJava, createTransaction, config } from '@/lib/java-api';

type Account = { account_number: string; name: string; balance: number; status: string };
type Transaction = { id: number; type: string; status: string; amount: number; account_number?: string; target_account?: string | null; note?: string | null; created_at?: string };


export default function UserPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const toast = useToast();
  const [me, setMe] = useState<Account | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [depAmount, setDepAmount] = useState("");
  const [wdAmount, setWdAmount] = useState("");
  const [wdPin, setWdPin] = useState("");
  const [txAmount, setTxAmount] = useState("");
  const [txTarget, setTxTarget] = useState("");
  const [txPin, setTxPin] = useState("");
  const [recipientChecking, setRecipientChecking] = useState(false);
  const [recipientExists, setRecipientExists] = useState<boolean | null>(null);
  const [recipientMaskedName, setRecipientMaskedName] = useState<string | null>(null);
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

  const verifyRecipient = useCallback(async (targetAccount: string) => {
    const res = await fetch(`/api/accounts/${encodeURIComponent(targetAccount)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const data: any = await readJson(res);

    if (res.status === 404) {
      return { exists: false as const, maskedName: null as string | null };
    }
    if (!res.ok) {
      throw new Error(data?.error || t("user.operation_failed"));
    }
    return {
      exists: Boolean(data?.exists),
      maskedName: typeof data?.maskedName === "string" ? data.maskedName : null,
    };
  }, [t]);

  const fetchMe = useCallback(async (): Promise<Account | null> => {
    try {
      const res = await fetch("/api/me");
      const data: any = await readJson(res);
      if (!res.ok) {
        setError(data?.error || t('user.operation_failed'));
        return null;
      }
      if (data?.authenticated) {
        if (!!data?.isAdmin) { router.replace("/admin"); return null; }
        setMe(data.account);
        return data.account as Account;
      }
      router.replace("/login");
      return null;
    } catch (e: any) {
      setError(e?.message || t('user.operation_failed'));
      return null;
    }
  }, [router, t]);

  const fetchTransactions = useCallback(async (acc: string) => {
    try {
      setRefreshing(true);
      const data = await fetchTransactionsJava({ account: acc, limit: 50 });
      const txs = Array.isArray(data?.transactions) ? data.transactions : [];
      setTransactions(txs);
      setError(null);
    } catch (e: any) {
      setTransactions([]);
      setError(e?.message || t('user.operation_failed'));
    } finally {
      setRefreshing(false);
    }
  }, [t]);

  const refreshData = useCallback(async () => {
    setRefreshing(true);
    try {
      const updated = await fetchMe();
      const acc = updated?.account_number ?? me?.account_number;
      if (acc) await fetchTransactions(acc);
    } catch (e: any) {
      setError(e?.message || t('user.operation_failed'));
    } finally {
      setRefreshing(false);
    }
  }, [fetchMe, fetchTransactions, me, t]);

  useEffect(() => {
    // Log Java API configuration for debugging
    config.logConfig();
    fetchMe().catch(() => undefined);
  }, [fetchMe]);

  useEffect(() => {
    if (me) fetchTransactions(me.account_number);
  }, [fetchTransactions, me]);

  useEffect(() => {
    const target = txTarget.trim();

    if (!target) {
      setRecipientChecking(false);
      setRecipientExists(null);
      setRecipientMaskedName(null);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    setRecipientChecking(true);
    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/accounts/${encodeURIComponent(target)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
          signal: controller.signal,
        });
        const data: any = await readJson(res);
        if (cancelled) return;

        if (res.status === 404) {
          setRecipientExists(false);
          setRecipientMaskedName(null);
          return;
        }
        if (!res.ok) {
          setRecipientExists(null);
          setRecipientMaskedName(null);
          return;
        }

        setRecipientExists(Boolean(data?.exists));
        setRecipientMaskedName(typeof data?.maskedName === "string" ? data.maskedName : null);
      } catch {
        if (cancelled) return;
        setRecipientExists(null);
        setRecipientMaskedName(null);
      } finally {
        if (cancelled) return;
        setRecipientChecking(false);
      }
    }, 350);

    return () => {
      cancelled = true;
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [txTarget]);

  const doOp = async (type: "deposit" | "withdraw") => {
    if (!me) return;
    if (pending) return;
    const amt = Number(type === "deposit" ? depAmount : wdAmount);
    if (!amt || amt <= 0) { setError(t('user.enter_valid_amount')); return; }
    
    if (type === "withdraw" && !wdPin) { setError(t('user.enter_pin')); return; }

    setPending(true);
    setError(null);
    try {
      let opOk = false;
      try {
        const transactionData = {
          type: type as 'deposit' | 'withdraw',
          source_account: me.account_number,
          amount: amt,
          note: `${type.charAt(0).toUpperCase() + type.slice(1)} operation`,
          pin: type === 'withdraw' ? wdPin : undefined
        };

        const result = await createTransaction(transactionData);
        if (result.success) {
          opOk = true;
          // If Java server returned updated balances, reflect them immediately
          try {
            const tx: any = result.transaction;
            if (tx && typeof tx.source_balance_after !== 'undefined') {
              setMe((prev) => prev ? { ...prev, balance: Number(tx.source_balance_after) } : prev);
            }
          } catch {}
        } else {
          throw new Error(result.message || 'Transaction failed');
        }
      } catch (e: any) {
        // Fallback to account API for backward compatibility
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
      const verifyTarget = txTarget.trim();
      const verification = await verifyRecipient(verifyTarget);
      setRecipientExists(verification.exists);
      setRecipientMaskedName(verification.maskedName);

      if (!verification.exists) {
        setError(t("user.recipient_not_found"));
        return;
      }

      let opOk = false;
      try {
        const transactionData = {
          type: 'transfer' as const,
          source_account: me.account_number,
          target_account: txTarget,
          amount: amt,
          note: `Transfer to ${verification.maskedName || txTarget}`,
          pin: txPin
        };

        const result = await createTransaction(transactionData);
        if (result.success) {
          opOk = true;
          try {
            const tx: any = result.transaction;
            if (tx && typeof tx.source_balance_after !== 'undefined') {
              setMe((prev) => prev ? { ...prev, balance: Number(tx.source_balance_after) } : prev);
            }
          } catch {}
        } else {
          throw new Error(result.message || 'Transfer failed');
        }
      } catch (e: any) {
        // Fallback to manual account operations for backward compatibility
        try {
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
        } catch (err: any) {
          setError(err?.message || t('user.transfer_failed'));
          return;
        }
      }

      if (!opOk) return;

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

  const copyAccountNumber = useCallback(async () => {
    const text = String(me?.account_number ?? "").trim();
    if (!text) return;

    try {
      const canUseClipboard = typeof navigator !== "undefined" && !!navigator.clipboard && !!window.isSecureContext;
      if (canUseClipboard) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.top = "-9999px";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand("copy");
        document.body.removeChild(ta);
        if (!ok) throw new Error("copy_failed");
      }
      toast.show(t("dash.copied"), "success");
    } catch {
      toast.show(t("dash.copy_failed"), "error");
    }
  }, [me?.account_number, t, toast]);

  return (
    <main>
      <Header />
      {/* <JavaServerTest /> */}
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
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: '0.3px' }}>{me.account_number}</div>
                    <button
                      className="btn ghost"
                      onClick={copyAccountNumber}
                      type="button"
                      title={t("dash.copy")}
                      aria-label={t("dash.copy")}
                      style={{ padding: "6px 10px", fontSize: 12 }}
                    >
                      {t("dash.copy")}
                    </button>
                  </div>
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
              {txTarget.trim() && (
                <div style={{ fontSize: 12, marginTop: -2, marginBottom: 6, color: recipientExists === false ? "#b00020" : "var(--muted)" }}>
                  {recipientChecking
                    ? t("user.recipient_checking")
                    : recipientExists === false
                      ? t("user.recipient_not_found")
                      : recipientMaskedName
                        ? `${t("user.recipient_belongs_to")} ${recipientMaskedName}`
                        : ""}
                </div>
              )}
              <input placeholder={t('dash.amount')} value={txAmount} onChange={e => setTxAmount(e.target.value)} />
              <input type="password" placeholder={t('user.pin_placeholder')} value={txPin} onChange={e => setTxPin(e.target.value)} maxLength={5} />
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  className="btn primary"
                  onClick={doTransfer}
                  disabled={pending || recipientChecking || recipientExists !== true}
                >
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
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <button className="btn ghost" onClick={() => router.push("/transactions")} style={{ padding: "8px 12px", fontSize: "14px" }}>
                  {t("nav.transactions")}
                </button>
                <button className="btn ghost" onClick={refreshData} disabled={refreshing} style={{ padding: '8px 12px', fontSize: '14px' }}>
                  {refreshing ? '🔄 Refreshing...' : '🔄 Refresh'}
                </button>
              </div>
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
                    const isIncoming = t.target_account === me?.account_number || t.type === 'deposit';
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

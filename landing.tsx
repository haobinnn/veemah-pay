"use client";

import React, { useEffect, useRef, useState } from "react";
import { fetchTransactions as fetchTransactionsJava, createTransaction, updateTransaction, cancelTransaction } from '@/lib/java-api';

type Account = {
  account_number: string;
  name: string;
  balance: number;
  status: "Active" | "Locked" | "Archived";
};

type Transaction = {
  id: number;
  type: "deposit" | "withdraw" | "transfer" | "fee";
  status: "Pending" | "Completed" | "Voided";
  account_number: string;
  target_account?: string | null;
  amount: number;
  fee?: number | null;
  note?: string | null;
  created_by: string;
  created_at: string;
  completed_at?: string | null;
  voided_at?: string | null;
};

export default function Landing98() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [selected, setSelected] = useState<Account | null>(null);
  const [amount, setAmount] = useState<string>("");
  const [me, setMe] = useState<Account | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [accountNumber, setAccountNumber] = useState("");
  const [pin, setPin] = useState("");
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  // Sign up fields
  const [newAccountNumber, setNewAccountNumber] = useState("");
  const [newName, setNewName] = useState("");
  const [newPin, setNewPin] = useState("");
  const [newPinConfirm, setNewPinConfirm] = useState("");
  const [newInitialBalance, setNewInitialBalance] = useState("");
  const [editName, setEditName] = useState<string>("");
  const [editStatus, setEditStatus] = useState<"Active" | "Locked" | "Archived">("Active");
  const [searchText, setSearchText] = useState("");
  const [transferTarget, setTransferTarget] = useState("");
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [txLoading, setTxLoading] = useState(false);
  const [txError, setTxError] = useState<string | null>(null);
  const [txType, setTxType] = useState<"all" | "deposit" | "withdraw" | "transfer">("all");
  const [txStatus, setTxStatus] = useState<"all" | "Pending" | "Completed" | "Voided">("all");
  const [txQuery, setTxQuery] = useState<string>("");
  const [txNotes, setTxNotes] = useState<Record<number, string>>({});

  // Windows 98-style click sound (Web Audio API)
  const audioCtxRef = useRef<AudioContext | null>(null);
  const playClick = () => {
    try {
      const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!AC) return;
      const ctx: AudioContext = audioCtxRef.current || new AC();
      audioCtxRef.current = ctx;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "square";
      osc.frequency.value = 1000;
      const t = ctx.currentTime;
      gain.gain.setValueAtTime(0.15, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(t + 0.06);
    } catch {}
  };

  const fetchAccounts = async () => {
    try {
      setLoading(true);
      const qs = new URLSearchParams();
      if (searchText.trim()) qs.set("q", searchText.trim());
      // Hard delete in backend: archived filtering no longer applicable
      const res = await fetch(`/api/accounts${qs.toString() ? `?${qs.toString()}` : ''}`);
      const data = await res.json();
      setAccounts(data.accounts ?? []);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load accounts");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Check session
    (async () => {
      try {
        const res = await fetch("/api/me");
        if (res.ok) {
          const data = await res.json();
          if (data?.authenticated) {
            setMe(data.account);
            const admin = !!data?.isAdmin;
            setIsAdmin(admin);
            if (admin) {
              fetchAccounts();
            } else {
              setLoading(false);
            }
          } else {
            setMe(null);
            setIsAdmin(false);
            setLoading(false);
          }
        } else {
          setMe(null);
          setIsAdmin(false);
          setLoading(false);
        }
      } catch (e) {
        setIsAdmin(false);
        setLoading(false);
      }
    })();
  }, []);

  // Keep admin edit fields in sync with selected row
  useEffect(() => {
    if (selected) {
      setEditName(selected.name);
      setEditStatus(selected.status);
    } else {
      setEditName("");
      setEditStatus("Active");
    }
  }, [selected]);

  // Auto-load transactions when selection or filters change (admin)
  useEffect(() => {
    if (selected) {
      fetchTransactions();
    } else {
      // If admin deselects, clear transactions list
      if (isAdmin) {
        setTransactions([]);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, txType, txStatus, txQuery]);

  // Auto-load transactions for customer when filters change
  useEffect(() => {
    if (me && !isAdmin) {
      fetchTransactions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me, txType, txStatus, txQuery]);

  const doOp = async (op: "deposit" | "withdraw") => {
    playClick();
    if (pending) return;
    // Use selected account if admin selected one; otherwise use the logged-in customer account
    const target = selected ?? (me && !isAdmin ? me : null);
    if (!target) {
      setError("Select an account first (admin) or log in as a customer.");
      return;
    }

    const amt = parseFloat(amount);
    if (Number.isNaN(amt) || amt <= 0) {
      setError("Enter a valid amount");
      return;
    }

    try {
      setPending(true);
      
      const transactionData = {
        type: op as 'deposit' | 'withdraw',
        source_account: target.account_number,
        amount: amt,
        note: `Admin ${op} operation`
      };

      const result = await createTransaction(transactionData);
      
      if (!result.success) {
        // Fallback to legacy accounts PATCH if Java server is unavailable
        const res = await fetch(`/api/accounts/${target.account_number}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ op, amount: amt }),
        });
        const data = await res.json().catch(() => ({}));
        
        if (!res.ok) {
          setError(data?.error ?? "Operation failed");
          return;
        }
      }
      
      setError(null);
      setAmount("");
      setSelected(null);
      if (me && !isAdmin) {
        await refreshMe();
      } else {
        await fetchAccounts();
      }
    } catch (e: any) {
      setError(e?.message ?? "Operation failed");
    } finally {
      setPending(false);
    }
  };

  const doTransfer = async () => {
    playClick();
    if (pending) return;

    const source = selected ?? (me && !isAdmin ? me : null);
    if (!source) {
      setError("Select a source account (admin) or log in as a customer.");
      return;
    }
    const amt = parseFloat(amount);
    if (Number.isNaN(amt) || amt <= 0) {
      setError("Enter a valid amount");
      return;
    }
    const tgt = transferTarget.trim();
    if (!tgt) {
      setError("Enter a valid target account number");
      return;
    }
    try {
      setPending(true);
      
      const transactionData = {
        type: 'transfer' as const,
        source_account: source.account_number,
        target_account: tgt,
        amount: amt,
        note: `Transfer to ${tgt}`
      };

      const result = await createTransaction(transactionData);
      
      if (!result.success) {
        // Fallback: if Java server is unavailable, perform manual withdraw+deposit
        let w = await fetch(`/api/accounts/${source.account_number}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ op: "withdraw", amount: amt }),
        });
        let wData: any = await w.json().catch(() => ({}));
        if (!w.ok) {
          setError(wData?.error ?? "Transfer failed (withdraw)");
          setPending(false);
          return;
        }
        // Deposit into target
        let d = await fetch(`/api/accounts/${tgt}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ op: "deposit", amount: amt }),
        });
        let dData: any = await d.json().catch(() => ({}));
        if (!d.ok) {
          // Attempt to rollback withdraw if deposit fails
          await fetch(`/api/accounts/${source.account_number}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ op: "deposit", amount: amt }),
          }).catch(() => {});
          setError(dData?.error ?? "Transfer failed (deposit)");
          setPending(false);
          return;
        }
        // Fallback succeeded - transfer completed manually
      } else {
        // Java server succeeded
      }

      setError(null);
      setAmount("");
      setTransferTarget("");
      setSelected(null);
      if (me && !isAdmin) {
        await refreshMe();
      } else {
        await fetchAccounts();
      }
    } catch (e: any) {
      setError(e?.message ?? "Transfer failed");
    } finally {
      setPending(false);
    }
  };

  const refreshMe = async () => {
    try {
      const res = await fetch("/api/me");
      if (res.ok) {
        const data = await res.json();
        if (data?.authenticated) {
          setMe(data.account);
          setIsAdmin(!!data?.isAdmin);
        } else {
          setMe(null);
          setIsAdmin(false);
        }
      }
    } catch {}
  };

  const fetchTransactions = async () => {
    try {
      setTxLoading(true);
      setTxError(null);
      const ctx = selected ?? (me && !isAdmin ? me : null);
      if (!ctx) {
        setTransactions([]);
        setTxLoading(false);
        return;
      }
      
      const params: any = { account: ctx.account_number };
      if (txType !== "all") params.type = txType;
      if (txStatus !== "all") params.status = txStatus;
      // Note: txQuery not yet supported in Java API
      
      const data = await fetchTransactionsJava(params);
      setTransactions(data.transactions as any ?? []);
      const notes: Record<number, string> = {};
      (data.transactions ?? []).forEach((t: any) => { notes[t.id] = t.note ?? ""; });
      setTxNotes(notes);
    } catch (e: any) {
      setTxError(e?.message ?? "Failed to load transactions");
      setTransactions([]);
    } finally {
      setTxLoading(false);
    }
  };

  const saveTxNote = async (id: number) => {
    playClick();
    const note = txNotes[id] ?? "";
    const res = await fetch(`/api/transactions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note }),
    });
    const data = await res.json();
    if (!res.ok) {
      setTxError(data.error ?? "Failed to update note");
      return;
    }
    setTxError(null);
    await fetchTransactions();
  };

  const completeTx = async (id: number) => {
    playClick();
    const res = await fetch(`/api/transactions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "complete" }),
    });
    const data = await res.json();
    if (!res.ok) {
      setTxError(data.error ?? "Failed to complete transaction");
      return;
    }
    setTxError(null);
    await fetchTransactions();
    if (me && !isAdmin) await refreshMe(); else await fetchAccounts();
  };

  const voidTx = async (id: number) => {
    playClick();
    const reason = window.prompt("Reason to void?") || "";
    const res = await fetch(`/api/transactions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "void", reason }),
    });
    const data = await res.json();
    if (!res.ok) {
      setTxError(data.error ?? "Failed to void transaction");
      return;
    }
    setTxError(null);
    await fetchTransactions();
    if (me && !isAdmin) await refreshMe(); else await fetchAccounts();
  };

  const rollbackTx = async (id: number) => {
    playClick();
    const reason = window.prompt("Reason to rollback?") || "";
    const res = await fetch(`/api/transactions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "rollback", reason }),
    });
    const data = await res.json();
    if (!res.ok) {
      setTxError(data.error ?? "Failed to rollback transaction");
      return;
    }
    setTxError(null);
    await fetchTransactions();
    if (me && !isAdmin) await refreshMe(); else await fetchAccounts();
  };

  const updateInfo = async () => {
    playClick();
    if (pending) return;

    if (!selected) {
      setError("Select an account to edit");
      return;
    }
    try {
      setPending(true);
      const res = await fetch(`/api/accounts/${selected.account_number}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: editName, status: editStatus }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Update failed");
        return;
      }
      setError(null);
      setSelected(data.account);
      await fetchAccounts();
    } catch (e: any) {
      setError(e?.message ?? "Update failed");
    } finally {
      setPending(false);
    }
  };

  const deleteAccount = async (acc: string) => {
    playClick();
    if (!isAdmin) {
      setError("Only admin can delete accounts.");
      return;
    }
    if (!acc) return;
    const ok = window.confirm(`Delete account ${acc} permanently? This cannot be undone.`);
    if (!ok) return;
    try {
      setPending(true);
      const res = await fetch(`/api/accounts/${acc}`, { method: "DELETE" });
      if (res.status === 204) {
        setError(null);
        setSelected(null);
        await fetchAccounts();
        return;
      }
      const data = await res.json();
      if (res.ok) {
        setError(null);
        setSelected(null);
        await fetchAccounts();
      } else {
        setError(data.error || "Delete failed");
      }
    } catch (e: any) {
      setError(e?.message ?? "Delete failed");
    } finally {
      setPending(false);
    }
  };

  const logout = async () => {
    playClick();
    await fetch("/api/logout", { method: "POST" });
    setMe(null);
    setIsAdmin(false);
    setAccounts([]);
    setSelected(null);
  };

  const login = async () => {
    playClick();
    setError(null);
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ account_number: accountNumber, pin }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Login failed");
      return;
    }
    setMe(data.account);
    setIsAdmin(!!data?.isAdmin);
    setAccountNumber("");
    setPin("");
    if (!!data?.isAdmin) {
      fetchAccounts();
    }
  };

  const signup = async () => {
    playClick();
    setError(null);
    const acc = newAccountNumber.trim();
    const nm = newName.trim();
    const pn = newPin.trim();
    const pn2 = newPinConfirm.trim();
    const init = newInitialBalance.trim();

    if (!/^[0-9]{5}$/.test(acc)) {
      setError('Account number must be 5 digits');
      return;
    }
    if (!nm) {
      setError('Name is required');
      return;
    }
    if (!/^[0-9]{4}$/.test(pn)) {
      setError('PIN must be 4 digits');
      return;
    }
    if (pn !== pn2) {
      setError('PINs do not match');
      return;
    }
    const initNum = init ? Number(init) : 0;
    if (Number.isNaN(initNum) || initNum < 0) {
      setError('Initial balance must be a nonnegative number');
      return;
    }

    const res = await fetch('/api/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ account_number: acc, name: nm, pin: pn, initial_balance: initNum }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? 'Signup failed');
      return;
    }
    setMe(data.account);
    setNewAccountNumber('');
    setNewName('');
    setNewPin('');
    setNewPinConfirm('');
    setNewInitialBalance('');
  };

  return (
    <>
    

    {/* Single Banking Panel (centered) */}
    <div style={{ position: 'fixed', top: '50%', left: 20, right: 20, transform: 'translateY(-50%)', zIndex: 1000 }}>
      <div className="window" style={{ maxWidth: 960, margin: '0 auto' }}>
        <div className="title-bar">
          <div className="title-bar-text">Windows 98 Banking Panel</div>
        </div>
        <div className="window-body">
          {me && (
            <div className="field-row" style={{ gap: 8, marginBottom: 8, justifyContent: 'flex-end' }}>
              <button onClick={logout}>Logout</button>
              {isAdmin && (
                <button onClick={() => { playClick(); fetchAccounts(); }}>Refresh</button>
              )}
            </div>
          )}
          {me && (
            <div className="status-bar" style={{ marginBottom: 8 }}>
              <p className="status-bar-field">{isAdmin ? 'Admin mode' : 'Customer mode'}</p>
            </div>
          )}
          {!me ? (
            <>
              <div className="field-row" style={{ gap: 12, marginBottom: 8 }}>
                <label>
                  <input type="radio" checked={mode === 'login'} onChange={() => { playClick(); setMode('login'); }} /> Login
                </label>
                <label>
                  <input type="radio" checked={mode === 'signup'} onChange={() => { playClick(); setMode('signup'); }} /> Sign Up
                </label>
              </div>

              {mode === 'login' ? (
                <>
                  <div className="field-row" style={{ alignItems: 'center' }}>
                    <label htmlFor="accnum">Account #</label>
                    <input id="accnum" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} />
                  </div>
                  <div className="field-row" style={{ alignItems: 'center' }}>
                    <label htmlFor="pin">PIN</label>
                    <input id="pin" type="password" value={pin} onChange={(e) => setPin(e.target.value)} />
                  </div>
                  <div className="field-row" style={{ marginTop: 8 }}>
                    <button onClick={login}>Start</button>
                  </div>
                  <div className="status-bar">
                    <p className="status-bar-field">Enter your account number and 4-digit PIN</p>
                  </div>
                </>
              ) : (
                <>
                  <div className="field-row" style={{ alignItems: 'center' }}>
                    <label htmlFor="newAcc">Account #</label>
                    <input id="newAcc" value={newAccountNumber} onChange={(e) => setNewAccountNumber(e.target.value)} />
                  </div>
                  <div className="field-row" style={{ alignItems: 'center' }}>
                    <label htmlFor="newName">Name</label>
                    <input id="newName" value={newName} onChange={(e) => setNewName(e.target.value)} />
                  </div>
                  <div className="field-row" style={{ alignItems: 'center' }}>
                    <label htmlFor="newPin">PIN</label>
                    <input id="newPin" type="password" value={newPin} onChange={(e) => setNewPin(e.target.value)} />
                  </div>
                  <div className="field-row" style={{ alignItems: 'center' }}>
                    <label htmlFor="newPin2">Confirm PIN</label>
                    <input id="newPin2" type="password" value={newPinConfirm} onChange={(e) => setNewPinConfirm(e.target.value)} />
                  </div>
                  <div className="field-row" style={{ alignItems: 'center' }}>
                    <label htmlFor="initBal">Initial Balance</label>
                    <input id="initBal" type="number" step="0.01" value={newInitialBalance} onChange={(e) => setNewInitialBalance(e.target.value)} />
                  </div>
                  <div className="field-row" style={{ marginTop: 8 }}>
                    <button onClick={signup}>Create Account</button>
                  </div>
                  <div className="status-bar">
                    <p className="status-bar-field">Account # must be 5 digits; PIN must be 4 digits.</p>
                  </div>
                </>
              )}
            </>
          ) : isAdmin ? (
            <>
                <div className="field-row" style={{ marginBottom: 8, gap: 8 }}>
                  <label htmlFor="searchText">Search</label>
                  <input id="searchText" value={searchText} onChange={(e) => setSearchText(e.target.value)} />
                  {/* Archived filter removed: hard delete is now supported */}
                  <button onClick={() => { playClick(); fetchAccounts(); }}>Search</button>
                </div>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Account #</th>
                      <th>Name</th>
                      <th>Status</th>
                      <th style={{ textAlign: 'right' }}>Balance</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {accounts.map((a) => (
                      <tr
                        key={a.account_number}
                        className={selected?.account_number === a.account_number ? 'selected' : undefined}
                      >
                        <td>{a.account_number}</td>
                        <td>{a.name}</td>
                        <td>{a.status}</td>
                        <td style={{ textAlign: 'right' }}>{a.balance.toFixed(2)}</td>
                        <td>
                          <div className="field-row" style={{ gap: 4 }}>
                            <button onClick={() => { playClick(); setSelected(a); }}>Select</button>
                            {isAdmin && (
                              <button
                                onClick={() => deleteAccount(a.account_number)}
                                disabled={a.account_number === '0000' || pending}
                              >
                                Delete
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="field-row" style={{ marginTop: 12 }}>
                  <label htmlFor="amountField">Amount</label>
                  <input
                    id="amountField"
                    type="number"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                  <button disabled={!selected || selected.status !== 'Active'} onClick={() => doOp('deposit')}>Deposit</button>
                  <button disabled={!selected || selected.status !== 'Active'} onClick={() => doOp('withdraw')}>Withdraw</button>
                </div>

                <div className="field-row" style={{ marginTop: 8 }}>
                  <label htmlFor="transferTarget">Transfer to</label>
                  <input id="transferTarget" value={transferTarget} onChange={(e) => setTransferTarget(e.target.value)} />
                  <button disabled={!selected || selected.status !== 'Active' || !transferTarget.trim()} onClick={doTransfer}>Transfer</button>
                </div>

                <div className="window" style={{ marginTop: 12 }}>
                  <div className="title-bar">
                    <div className="title-bar-text">Transactions</div>
                  </div>
                  <div className="window-body">
                    <div className="field-row" style={{ gap: 8, alignItems: 'center' }}>
                      <label>Type</label>
                      <select value={txType} onChange={(e) => setTxType(e.target.value as any)}>
                        <option value="all">All</option>
                        <option value="deposit">Deposit</option>
                        <option value="withdraw">Withdraw</option>
                        <option value="transfer">Transfer</option>
                      </select>
                      <label>Status</label>
                      <select value={txStatus} onChange={(e) => setTxStatus(e.target.value as any)}>
                        <option value="all">All</option>
                        <option value="Pending">Pending</option>
                        <option value="Completed">Completed</option>
                        <option value="Voided">Voided</option>
                      </select>
                      <label>Search</label>
                      <input value={txQuery} onChange={(e) => setTxQuery(e.target.value)} />
                      {/* Transactions auto-load on selection and filter changes */}
                    </div>
                    {txError && <div className="status-bar"><p className="status-bar-field">{txError}</p></div>}
                    <table className="table" style={{ marginTop: 8 }}>
                      <thead>
                        <tr>
                          <th>ID</th>
                          <th>Date</th>
                          <th>Type</th>
                          <th>Status</th>
                          <th style={{ textAlign: 'right' }}>Amount</th>
                          <th>Source → Target</th>
                          <th>Note</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {transactions.map((t) => (
                          <tr key={t.id}>
                            <td>{t.id}</td>
                            <td>{new Date(t.created_at).toLocaleString()}</td>
                            <td>{t.type}</td>
                            <td>{t.status}</td>
                            <td style={{ textAlign: 'right' }}>{t.amount.toFixed(2)}</td>
                            <td>{t.account_number}{t.target_account ? ` → ${t.target_account}` : ''}</td>
                            <td>
                              {t.status === 'Pending' ? (
                                <div className="field-row">
                                  <input value={txNotes[t.id] ?? ''} onChange={(e) => setTxNotes({ ...txNotes, [t.id]: e.target.value })} />
                                  <button onClick={() => saveTxNote(t.id)}>Save</button>
                                </div>
                              ) : (
                                <span>{t.note ?? ''}</span>
                              )}
                            </td>
                            <td>
                              <div className="field-row" style={{ gap: 4 }}>
                                {isAdmin && t.status === 'Pending' && (
                                  <button onClick={() => completeTx(t.id)}>Complete</button>
                                )}
                                {isAdmin && t.status === 'Pending' && (
                                  <button onClick={() => voidTx(t.id)}>Void</button>
                                )}
                                {isAdmin && t.status === 'Completed' && (
                                  <>
                                    <button onClick={() => voidTx(t.id)}>Void</button>
                                    <button onClick={() => rollbackTx(t.id)}>Rollback</button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="window" style={{ marginTop: 12 }}>
                  <div className="title-bar">
                    <div className="title-bar-text">Edit Customer Information</div>
                  </div>
                  <div className="window-body">
                    <div className="field-row" style={{ alignItems: 'center' }}>
                      <label htmlFor="editName">Name</label>
                      <input id="editName" value={editName} onChange={(e) => setEditName(e.target.value)} />
                    </div>
                    <div className="field-row" style={{ alignItems: 'center' }}>
                      <label htmlFor="editStatus">Status</label>
                      <select id="editStatus" value={editStatus} onChange={(e) => setEditStatus(e.target.value as any)}>
                        <option value="Active">Active</option>
                        <option value="Locked">Locked</option>
                      </select>
                    </div>
                    <div className="field-row" style={{ marginTop: 8 }}>
                      <button disabled={!selected} onClick={updateInfo}>Save Changes</button>
                    </div>
                    <div className="status-bar">
                      <p className="status-bar-field">
                        {selected ? `Editing: ${selected.account_number} — ${selected.name} (${selected.status})` : 'Select an account to edit'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="status-bar">
                  <p className="status-bar-field">
                    {selected ? `Selected: ${selected.account_number} — ${selected.name}` : 'Select an account to act'}
                  </p>
                </div>
              </>
            ) : (
              <>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Account #</th>
                      <th>Name</th>
                      <th>Status</th>
                      <th style={{ textAlign: 'right' }}>Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>{me.account_number}</td>
                      <td>{me.name}</td>
                      <td>{me.status}</td>
                      <td style={{ textAlign: 'right' }}>{me.balance.toFixed(2)}</td>
                    </tr>
                  </tbody>
                </table>

                <div className="field-row" style={{ marginTop: 12 }}>
                  <label htmlFor="amountField">Amount</label>
                  <input
                    id="amountField"
                    type="number"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                  <button disabled={me.status !== 'Active'} onClick={() => doOp('deposit')}>Deposit</button>
                  <button disabled={me.status !== 'Active'} onClick={() => doOp('withdraw')}>Withdraw</button>
                </div>

                <div className="field-row" style={{ marginTop: 8 }}>
                  <label htmlFor="transferTarget">Transfer to</label>
                  <input id="transferTarget" value={transferTarget} onChange={(e) => setTransferTarget(e.target.value)} />
                  <button disabled={me.status !== 'Active' || !transferTarget.trim()} onClick={doTransfer}>Transfer</button>
                </div>

                <div className="window" style={{ marginTop: 12 }}>
                  <div className="title-bar">
                    <div className="title-bar-text">Transactions</div>
                  </div>
                  <div className="window-body">
                    <div className="field-row" style={{ gap: 8, alignItems: 'center' }}>
                      <label>Type</label>
                      <select value={txType} onChange={(e) => setTxType(e.target.value as any)}>
                        <option value="all">All</option>
                        <option value="deposit">Deposit</option>
                        <option value="withdraw">Withdraw</option>
                        <option value="transfer">Transfer</option>
                      </select>
                      <label>Status</label>
                      <select value={txStatus} onChange={(e) => setTxStatus(e.target.value as any)}>
                        <option value="all">All</option>
                        <option value="Pending">Pending</option>
                        <option value="Completed">Completed</option>
                        <option value="Voided">Voided</option>
                      </select>
                      <label>Search</label>
                      <input value={txQuery} onChange={(e) => setTxQuery(e.target.value)} />
                      {/* Transactions auto-load for the logged-in user and on filter changes */}
                    </div>
                    {txError && <div className="status-bar"><p className="status-bar-field">{txError}</p></div>}
                    <table className="table" style={{ marginTop: 8 }}>
                      <thead>
                        <tr>
                          <th>ID</th>
                          <th>Date</th>
                          <th>Type</th>
                          <th>Status</th>
                          <th style={{ textAlign: 'right' }}>Amount</th>
                          <th>Source → Target</th>
                          <th>Note</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {transactions.map((t) => (
                          <tr key={t.id}>
                            <td>{t.id}</td>
                            <td>{new Date(t.created_at).toLocaleString()}</td>
                            <td>{t.type}</td>
                            <td>{t.status}</td>
                            <td style={{ textAlign: 'right' }}>{t.amount.toFixed(2)}</td>
                            <td>{t.account_number}{t.target_account ? ` → ${t.target_account}` : ''}</td>
                            <td>
                              {t.status === 'Pending' ? (
                                <div className="field-row">
                                  <input value={txNotes[t.id] ?? ''} onChange={(e) => setTxNotes({ ...txNotes, [t.id]: e.target.value })} />
                                  <button onClick={() => saveTxNote(t.id)}>Save</button>
                                </div>
                              ) : (
                                <span>{t.note ?? ''}</span>
                              )}
                            </td>
                            <td>
                              <div className="field-row" style={{ gap: 4 }}></div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
        </div>
      </div>
    </div>
    </>
  );
}

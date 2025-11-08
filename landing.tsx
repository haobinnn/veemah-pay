"use client";

import React, { useEffect, useState } from "react";

type Account = {
  account_number: string;
  name: string;
  balance: number;
  status: "Active" | "Locked";
};

export default function Landing98() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Account | null>(null);
  const [amount, setAmount] = useState<string>("");
  const [me, setMe] = useState<Account | null>(null);
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
  const [editStatus, setEditStatus] = useState<"Active" | "Locked">("Active");

  const fetchAccounts = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/accounts");
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
          setMe(data.account);
          // Load accounts if admin; otherwise load only after actions
          if (data.account.account_number === "0000") {
            fetchAccounts();
          } else {
            setLoading(false);
          }
        } else {
          setMe(null);
          setLoading(false);
        }
      } catch (e) {
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

  const doOp = async (op: "deposit" | "withdraw") => {
    // Use selected account if admin selected one; otherwise use the logged-in customer account
    const target = selected ?? (me && me.account_number !== "0000" ? me : null);
    if (!target) {
      setError("Select an account first (admin) or log in as a customer.");
      return;
    }

    const amt = parseFloat(amount);
    if (Number.isNaN(amt) || amt <= 0) {
      setError("Enter a valid amount");
      return;
    }

    const res = await fetch(`/api/accounts/${target.account_number}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ op, amount: amt }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Operation failed");
      return;
    }
    setError(null);
    setAmount("");
    setSelected(null);
    await fetchAccounts();
  };

  const updateInfo = async () => {
    if (!selected) {
      setError("Select an account to edit");
      return;
    }
    const res = await fetch(`/api/accounts/${selected.account_number}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editName, status: editStatus }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Update failed");
      return;
    }
    setError(null);
    setSelected(data.account);
    await fetchAccounts();
  };

  const logout = async () => {
    await fetch("/api/logout", { method: "POST" });
    setMe(null);
    setAccounts([]);
    setSelected(null);
  };

  const login = async () => {
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
    setAccountNumber("");
    setPin("");
    if (data.account.account_number === "0000") {
      fetchAccounts();
    }
  };

  const signup = async () => {
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
    <div style={{ padding: 20 }}>
      <div className="window" style={{ maxWidth: 960, margin: "0 auto" }}>
        <div className="title-bar">
          <div className="title-bar-text">Windows 98 Banking</div>
          <div className="title-bar-controls">
            <button aria-label="Minimize" />
            <button aria-label="Maximize" />
            <button aria-label="Close" />
          </div>
        </div>
        <div className="window-body">
          {/* Removed branded welcome text per request */}

          {error && (
            <div className="status-bar" style={{ marginBottom: 8 }}>
              <p className="status-bar-field">{error}</p>
            </div>
          )}

          {loading ? (
            <div className="field-row">Loading...</div>
          ) : me ? (
            // Authenticated view
            <>
              <div className="field-row" style={{ gap: 8 }}>
                <button onClick={logout}>Logout</button>
                {me.account_number === "0000" && (
                  <button onClick={fetchAccounts}>Refresh</button>
                )}
              </div>

              <div className="status-bar" style={{ marginTop: 12 }}>
                <p className="status-bar-field">
                  {me.account_number === "0000" ? "Admin mode" : "Customer mode"}
                </p>
              </div>
            </>
          ) : (
            // Auth window: Login or Sign Up
            <div className="window" style={{ marginTop: 12 }}>
              <div className="title-bar">
                <div className="title-bar-text">Authentication</div>
              </div>
              <div className="window-body">
                <div className="field-row" style={{ gap: 12, marginBottom: 8 }}>
                  <label>
                    <input type="radio" checked={mode === 'login'} onChange={() => setMode('login')} /> Login
                  </label>
                  <label>
                    <input type="radio" checked={mode === 'signup'} onChange={() => setMode('signup')} /> Sign Up
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
              </div>
            </div>
          )}
        </div>
      </div>
    </div>

    {/* Bottom Banking Panel */}
    <div style={{ position: 'fixed', bottom: 20, left: 20, right: 20, zIndex: 1000 }}>
      <div className="window" style={{ maxWidth: 960, margin: '0 auto' }}>
        <div className="title-bar">
          <div className="title-bar-text">Banking Panel</div>
        </div>
        <div className="window-body">
          {!me ? (
            <>
              <div className="status-bar">
                <p className="status-bar-field">Log in to view accounts and actions</p>
              </div>
            </>
          ) : me.account_number === "0000" ? (
            <>
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
                            <button onClick={() => setSelected(a)}>Select</button>
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
                  <button disabled={!selected} onClick={() => doOp('deposit')}>Deposit</button>
                  <button disabled={!selected} onClick={() => doOp('withdraw')}>Withdraw</button>
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
                  <button onClick={() => doOp('deposit')}>Deposit</button>
                  <button onClick={() => doOp('withdraw')}>Withdraw</button>
                </div>
              </>
            )}
        </div>
      </div>
    </div>
    </>
  );
}
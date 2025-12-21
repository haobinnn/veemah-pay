"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Header } from '@/components/nav/Header';
import { useLanguage } from '@/components/ui/LanguageProvider';
import { ParallaxBackground } from '@/components/landing/ParallaxBackground';
import { Modal } from "@/components/ui/Modal";

export default function SignupPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pin, setPin] = useState("");
  const [initialBalance, setInitialBalance] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [tosOpen, setTosOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [awaitingVerification, setAwaitingVerification] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");
  const [resendStatus, setResendStatus] = useState<string | null>(null);
  const [devCode, setDevCode] = useState<string | undefined>(undefined);

  const apiBase =
    typeof window !== "undefined"
      ? window.location.origin.replace("://0.0.0.0", "://localhost")
      : "";

  const submit = async () => {
    console.log("Submit clicked");
    if (pending) {
      console.log("Pending is true, ignoring click");
      return;
    }
    setError(null);

    // Validation
    if (!name.trim()) { setError("Name is required"); return; }
    if (!email.trim() || !email.includes("@")) { setError("Valid email is required"); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters"); return; }
    if (password !== confirmPassword) { setError("Passwords do not match"); return; }
    if (!/^\d{5}$/.test(pin)) { setError("PIN must be exactly 5 digits"); return; }
    if (!termsAccepted) { setError("You must accept the Terms of Service"); return; }

    console.log("Validation passed, sending request...");
    setPending(true);
    try {
      const res = await fetch(`${apiBase}/api/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          password,
          pin,
          initial_balance: initialBalance ? Number(initialBalance) : 0,
          terms_accepted: termsAccepted
        }),
      });
      const data = await res.json();
      console.log("Signup response:", data);
      
      if (!res.ok) {
        setError(data?.error || "Sign up failed");
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
      if (data?.verification_required) {
        setAwaitingVerification(true);
        if (data?.dev_code) {
          setDevCode(String(data.dev_code));
          console.log('%c [DEV MODE] Verification Code: ' + data.dev_code, 'background: #222; color: #bada55; padding: 4px; border-radius: 4px; font-size: 14px;');
        }
        // Scroll to top to show verification panel clearly
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        const acc = data?.account?.account_number;
        if (acc === "0000") {
          router.replace("/admin");
        } else {
          router.replace("/user");
        }
      }
    } catch (e: any) {
      console.error("Signup error:", e);
      setError(e?.message || `Unable to reach ${apiBase}. Is the server running?`);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setPending(false);
    }
  };

  const verify = async () => {
    if (!awaitingVerification) return;
    setError(null);
    setPending(true);
    try {
      const res = await fetch(`${apiBase}/api/verify-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code: verificationCode }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || "Verification failed");
        return;
      }
      const acc = data?.account?.account_number;
      if (acc === "0000") {
        router.replace("/admin");
      } else {
        router.replace("/user");
      }
    } catch (e: any) {
      setError(e?.message || "Verification failed");
    } finally {
      setPending(false);
    }
  };

  const verifyPanel = (
    <div style={{ display: "grid", gap: 20, width: "100%" }}>
      <div style={{ background: 'var(--bg)', padding: 12, border: '1px solid var(--border)', borderRadius: 8 }}>
        Please check your email for a 6-digit verification code. Enter it below to activate your account.
      </div>
      {resendStatus && (
        <div style={{ background: 'rgba(58,182,255,0.12)', color: 'var(--text)', padding: 12, border: '1px solid var(--border)', borderRadius: 8 }}>
          {resendStatus}
        </div>
      )}
      {devCode && (
        <div style={{ background: 'rgba(0, 128, 255, 0.12)', color: 'var(--text)', padding: 12, border: '1px solid var(--border)', borderRadius: 8 }}>
          Dev Code: <strong>{devCode}</strong> (Email restricted in test mode)
        </div>
      )}
      <div>
        <label style={{ display: 'block', marginBottom: 6, fontSize: '14px', fontWeight: 500 }}>Verification Code</label>
        <input placeholder="Enter 6-digit code" value={verificationCode} onChange={e => setVerificationCode(e.target.value)} maxLength={6} style={{ padding: '12px 16px', fontSize: '16px', background: 'var(--bg)', color: 'var(--text)', borderColor: 'var(--border)' }} />
      </div>
      <button 
        className="btn primary" 
        onClick={verify} 
        disabled={pending || !verificationCode}
        style={{ padding: '14px', fontSize: '16px', fontWeight: 600, marginTop: 8 }}
      >
        {pending ? 'Verifying...' : 'Verify Email'}
      </button>
      <button
        className="btn"
        onClick={async () => {
          if (pending) return;
          setPending(true);
          setError(null);
          try {
            const res = await fetch(`${apiBase}/api/verify-email/resend`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ email }),
            });
            const data = await res.json();
            if (!res.ok) {
              setError(data?.error || "Resend failed");
            } else {
              setResendStatus("Verification email resent. Please check your inbox.");
              if (data?.dev_code) {
                setDevCode(String(data.dev_code));
                console.log('%c [DEV MODE] Resent Code: ' + data.dev_code, 'background: #222; color: #bada55; padding: 4px; border-radius: 4px; font-size: 14px;');
              }
            }
          } catch (e: any) {
            setError(e?.message || "Resend failed");
          } finally {
            setPending(false);
          }
        }}
        style={{ padding: '12px', fontSize: '14px', fontWeight: 600 }}
      >
        Resend Code
      </button>
    </div>
  );

  const signupForm = (
    <div style={{ display: "grid", gap: 20, width: "100%" }}>
      <div>
        <label style={{ display: 'block', marginBottom: 6, fontSize: '14px', fontWeight: 500, color: 'var(--text)' }}>{t('signup.name')}</label>
        <input placeholder={t('signup.name_placeholder')} value={name} onChange={e => setName(e.target.value)} style={{ padding: '12px 16px', fontSize: '16px', background: 'var(--bg)', color: 'var(--text)', borderColor: 'var(--border)' }} />
      </div>
      <div>
        <label style={{ display: 'block', marginBottom: 6, fontSize: '14px', fontWeight: 500, color: 'var(--text)' }}>{t('signup.email')}</label>
        <input placeholder={t('signup.email_placeholder')} type="email" value={email} onChange={e => setEmail(e.target.value)} style={{ padding: '12px 16px', fontSize: '16px', background: 'var(--bg)', color: 'var(--text)', borderColor: 'var(--border)' }} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div>
          <label style={{ display: 'block', marginBottom: 6, fontSize: '14px', fontWeight: 500 }}>{t('signup.password')}</label>
          <input placeholder={t('signup.password_placeholder')} type="password" value={password} onChange={e => setPassword(e.target.value)} style={{ padding: '12px 16px', fontSize: '16px' }} />
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: 6, fontSize: '14px', fontWeight: 500 }}>{t('signup.confirm_password')}</label>
          <input placeholder={t('signup.confirm_password_placeholder')} type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} style={{ padding: '12px 16px', fontSize: '16px' }} />
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div>
          <label style={{ display: 'block', marginBottom: 6, fontSize: '14px', fontWeight: 500 }}>{t('signup.pin')}</label>
          <input placeholder={t('signup.pin_placeholder')} value={pin} onChange={e => setPin(e.target.value)} maxLength={5} style={{ padding: '12px 16px', fontSize: '16px' }} />
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: 6, fontSize: '14px', fontWeight: 500 }}>{t('signup.initial_balance')}</label>
          <input placeholder={t('signup.initial_balance_placeholder')} value={initialBalance} onChange={e => setInitialBalance(e.target.value)} style={{ padding: '12px 16px', fontSize: '16px' }} />
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
        <input type="checkbox" id="terms" checked={termsAccepted} onChange={e => setTermsAccepted(e.target.checked)} style={{ width: 'auto', margin: 0 }} />
        <label htmlFor="terms" style={{ fontSize: '14px' }}>
          {t('signup.terms')}{' '}
          <button
            type="button"
            className="btn ghost"
            onClick={() => setTosOpen(true)}
            style={{ padding: '4px 8px', fontSize: '12px', lineHeight: 1.2 }}
          >
            View
          </button>
        </label>
      </div>
      <button 
        type="button"
        className="btn primary" 
        onClick={submit} 
        disabled={pending}
        style={{ padding: '14px', fontSize: '16px', fontWeight: 600, marginTop: 8, cursor: pending ? 'not-allowed' : 'pointer' }}
      >
        {pending ? t('signup.creating') : t('signup.submit')}
      </button>
    </div>
  );

  return (
    <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      <div style={{ position: 'fixed', inset: 0, zIndex: 0 }}>
        <ParallaxBackground />
      </div>
      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <Header />
        <section style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
          <div className="container" style={{ maxWidth: 600, width: '100%' }}>
            <div className="card" style={{ alignItems: "stretch", padding: '40px', boxShadow: '0 20px 40px -10px rgba(0,0,0,0.1)', background: 'var(--card)' }}>
              <h2 style={{ margin: '0 0 8px 0', fontSize: '28px', color: 'var(--text)' }}>{t('signup.create_account')}</h2>
              <p style={{ margin: '0 0 32px 0', color: 'var(--muted)', fontSize: '14px' }}>
                {t('signup.subtitle')}
              </p>
              {error && (
                <div style={{ background: 'rgba(255, 0, 0, 0.1)', border: '1px solid var(--danger)', color: 'var(--danger)', padding: '12px', borderRadius: '8px', marginBottom: '24px', fontSize: '14px', textAlign: 'center', fontWeight: 600 }}>
                  {error}
                </div>
              )}
              {awaitingVerification ? verifyPanel : signupForm}
            </div>
          </div>
        </section>
      </div>
      <Modal open={tosOpen} onClose={() => setTosOpen(false)}>
        <div style={{ display: 'grid', gap: 12, position: 'relative' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 18 }}>VeemahPay Terms of Service</h3>
            <div style={{ marginTop: 4, color: 'var(--muted)', fontSize: 12 }}>Last updated: December 21, 2025</div>
          </div>
          <div style={{ maxHeight: '60vh', overflow: 'auto', paddingRight: 8, display: 'grid', gap: 12, fontSize: 13, lineHeight: 1.6 }}>
            <div>
              These Terms of Service (“Terms”) govern your access to and use of VeemahPay (the “Service”). By creating an account or using the Service, you agree to these Terms.
            </div>
            <div>
              <strong>1. Eligibility and Account Registration.</strong> You must provide accurate, complete, and up-to-date information and maintain the confidentiality of your credentials. You are responsible for all activity under your account.
            </div>
            <div>
              <strong>2. Security and Acceptable Use.</strong> Do not misuse the Service, attempt unauthorized access, interfere with operation, or use the Service for unlawful, fraudulent, or abusive purposes. You must promptly notify us of any suspected unauthorized activity.
            </div>
            <div>
              <strong>3. Transactions and Authorizations.</strong> By initiating deposits, withdrawals, or transfers, you authorize VeemahPay to process those instructions. Transaction availability, processing time, and limits may vary and can be changed to protect you, other users, and the Service.
            </div>
            <div>
              <strong>4. Currency.</strong> Amounts are presented and recorded in a single currency. VeemahPay does not currently support holding multiple currencies or foreign exchange (FX) conversion.
            </div>
            <div>
              <strong>5. Fees and Taxes.</strong> Certain features may have fees, which will be disclosed in the Service prior to completion when applicable. You are responsible for any taxes or government charges associated with your use of the Service.
            </div>
            <div>
              <strong>6. Communications.</strong> We may send you service-related notices and security alerts to the email address you provide. You agree that electronic communications satisfy legal notice requirements where permitted.
            </div>
            <div>
              <strong>7. Privacy.</strong> Our collection and use of information is described in our privacy practices within the Service. You consent to our processing of your information to provide, secure, and improve the Service.
            </div>
            <div>
              <strong>8. Availability and Changes.</strong> The Service may be modified, suspended, or discontinued at any time, including for maintenance or security reasons. We may update these Terms from time to time; continued use after an update constitutes acceptance of the updated Terms.
            </div>
            <div>
              <strong>9. Termination.</strong> We may suspend or terminate access to the Service if we reasonably believe you violated these Terms, pose a risk to the Service, or where required by law. You may stop using the Service at any time.
            </div>
            <div>
              <strong>10. Disclaimers.</strong> The Service is provided on an “as is” and “as available” basis. To the maximum extent permitted by law, we disclaim warranties of merchantability, fitness for a particular purpose, and non-infringement.
            </div>
            <div>
              <strong>11. Limitation of Liability.</strong> To the maximum extent permitted by law, VeemahPay will not be liable for indirect, incidental, special, consequential, or punitive damages, or any loss of profits or data, arising from or related to your use of the Service.
            </div>
            <div>
              <strong>12. Contact.</strong> If you have questions about these Terms, contact support via the channels provided within the Service.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" className="btn" onClick={() => setTosOpen(false)}>Close</button>
            <button
              type="button"
              className="btn primary"
              onClick={() => {
                setTermsAccepted(true);
                setTosOpen(false);
              }}
            >
              I Agree
            </button>
          </div>
        </div>
      </Modal>
    </main>
  );
}

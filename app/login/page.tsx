"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Header } from '@/components/nav/Header';
import { useLanguage } from '@/components/ui/LanguageProvider';
import { useAuth } from '@/components/ui/AuthProvider';
import { ParallaxBackground } from '@/components/landing/ParallaxBackground';

export default function LoginPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const { setMe } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const getClientLocation = async () => {
    if (typeof window === "undefined") return null;
    if (!("geolocation" in navigator)) return null;
    return await new Promise<{ lat: number; lon: number; accuracy?: number } | null>((resolve) => {
      let done = false;
      const finish = (v: { lat: number; lon: number; accuracy?: number } | null) => {
        if (done) return;
        done = true;
        resolve(v);
      };
      const timeout = window.setTimeout(() => finish(null), 900);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          window.clearTimeout(timeout);
          const lat = Number(pos.coords.latitude);
          const lon = Number(pos.coords.longitude);
          const accuracy = Number(pos.coords.accuracy);
          if (!Number.isFinite(lat) || !Number.isFinite(lon)) return finish(null);
          finish({ lat, lon, accuracy: Number.isFinite(accuracy) ? accuracy : undefined });
        },
        () => {
          window.clearTimeout(timeout);
          finish(null);
        },
        { enableHighAccuracy: false, maximumAge: 60_000, timeout: 800 }
      );
    });
  };

  const submit = async () => {
    if (pending) return;
    setError(null);
    setPending(true);
    try {
      const client_location = await getClientLocation();
      // Send as 'password' - API handles fallback to PIN if needed
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, client_location }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || "Login failed");
        return;
      }
      
      // Update AuthProvider state with the authenticated user
      const authData = {
        authenticated: true,
        account: data.account,
        isAdmin: !!data?.isAdmin
      };
      setMe(authData);
      
      const isAdmin = !!data?.isAdmin || String(data?.account?.account_number ?? "") === "0000";
      if (isAdmin) {
        router.replace("/admin");
      } else {
        router.replace("/user");
      }
    } catch (e: any) {
      setError(e?.message || "Login failed");
    } finally {
      setPending(false);
    }
  };

  return (
    <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      <div style={{ position: 'fixed', inset: 0, zIndex: 0 }}>
        <ParallaxBackground />
      </div>
      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <Header />
        <section style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
          <div className="container" style={{ maxWidth: 600, width: '100%' }}>
            <div className="card" style={{ padding: '48px', boxShadow: '0 20px 40px -10px rgba(0,0,0,0.1)', background: 'var(--card)' }}>
              <div style={{ textAlign: 'center', marginBottom: 32 }}>
                <h2 style={{ fontSize: '28px', fontWeight: 700, marginBottom: 8, color: 'var(--text)' }}>{t('login.welcome')}</h2>
                <p style={{ color: 'var(--muted)' }}>{t('login.subtitle')}</p>
              </div>
              
              {error && (
                <div style={{ 
                  background: 'rgba(255, 0, 0, 0.1)', 
                  color: 'var(--danger)', 
                  padding: '12px', 
                  borderRadius: '8px', 
                  marginBottom: '24px',
                  fontSize: '14px',
                  textAlign: 'center'
                }}>
                  {error}
                </div>
              )}

              <div style={{ display: "grid", gap: 24 }}>
                <div>
                  <label style={{ display: 'block', marginBottom: 8, fontSize: '14px', fontWeight: 600, color: 'var(--text)' }}>{t('login.email')}</label>
                  <input 
                    placeholder={t('login.email_placeholder')} 
                    type="email" 
                    value={email} 
                    onChange={e => setEmail(e.target.value)}
                    style={{ padding: '14px 16px', fontSize: '16px', background: 'var(--bg)', color: 'var(--text)', borderColor: 'var(--border)' }}
                  />
                </div>
                
                <div>
                  <label style={{ display: 'block', marginBottom: 8, fontSize: '14px', fontWeight: 600, color: 'var(--text)' }}>{t('login.password')}</label>
                  <input 
                    placeholder={t('login.password_placeholder')} 
                    type="password" 
                    value={password} 
                    onChange={e => setPassword(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && submit()}
                    style={{ padding: '14px 16px', fontSize: '16px', background: 'var(--bg)', color: 'var(--text)', borderColor: 'var(--border)' }}
                  />
                </div>

                <button 
                  className="btn primary" 
                  onClick={submit} 
                  disabled={pending}
                  style={{ padding: '16px', fontSize: '16px', fontWeight: 600, marginTop: 8 }}
                >
                  {pending ? t('login.signing_in') : t('login.sign_in_btn')}
                </button>
                
                <div style={{ textAlign: 'center', marginTop: 16 }}>
                  <Link href="/forgot-password" style={{ color: 'var(--primary)', fontSize: '14px', fontWeight: 500 }}>{t('login.forgot_your_password')}</Link>
                </div>

                <div style={{ textAlign: 'center', marginTop: 8, color: 'var(--muted)', fontSize: '14px' }}>
                  {t('login.dont_have_account')} <Link href="/signup" style={{ color: 'var(--primary)', fontWeight: 600 }}>{t('login.sign_up_link')}</Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

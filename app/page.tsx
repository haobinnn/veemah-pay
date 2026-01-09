"use client";
import Link from 'next/link';
import { Header } from '@/components/nav/Header';
import { ParallaxBackground } from '@/components/landing/ParallaxBackground';
import { useLanguage } from '@/components/ui/LanguageProvider';

export default function Page() {
  const { t } = useLanguage();
  return (
    <main style={{ position: 'relative', overflow: 'hidden', minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)' }}>
      {/* Interactive Background */}
      <ParallaxBackground />

      {/* Content Layer */}
      <div style={{ position: 'relative', zIndex: 10 }}>
        <Header />
        
        <section className="container" style={{ 
          minHeight: 'calc(100vh - 80px)', 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          justifyContent: 'center', 
          textAlign: 'center',
          padding: '2rem 1rem'
        }}>
          <div style={{ maxWidth: 900, animation: 'fadeIn 1s ease-out' }}>
             <h1 style={{ 
               fontSize: 'clamp(3rem, 8vw, 6rem)', 
               fontWeight: 800, 
               lineHeight: 1.1, 
               marginBottom: 24, 
               letterSpacing: '0',
               background: 'linear-gradient(90deg, #0b5d3b 0%, #12a777 45%, #18c6a0 75%, #0f8f6e 100%)',
               WebkitBackgroundClip: 'text', 
               WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              color: 'transparent' // Fallback
            }}>
              <span style={{ fontFamily: 'var(--font-longhaul), system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif' }}>
                <span style={{ letterSpacing: '0.02em' }}>Veemah</span><span style={{ fontSize: '0.52em', letterSpacing: '0.02em', fontWeight: 800, verticalAlign: 'baseline' }}>Pay</span>
              </span>
            </h1>
             
             <p style={{ 
               fontSize: 'clamp(1.125rem, 2.5vw, 1.5rem)', 
               color: 'var(--muted)', 
               marginBottom: 48, 
               lineHeight: 1.6,
               maxWidth: 600,
               marginLeft: 'auto',
               marginRight: 'auto'
             }}>
               {t('home.hero.description')}
             </p>
             
             <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
               <Link href="/signup" className="btn primary" style={{ 
                 padding: '16px 40px', 
                 fontSize: '1.1rem', 
                 borderRadius: 100, 
                 fontWeight: 600,
                 boxShadow: '0 10px 30px -10px var(--primary)'
               }}>
                 {t('home.hero.getstarted')}
               </Link>
               <Link href="/login" className="btn" style={{ 
                 padding: '16px 40px', 
                 fontSize: '1.1rem', 
                 borderRadius: 100, 
                 background: 'rgba(255,255,255,0.05)', 
                 backdropFilter: 'blur(10px)',
                 border: '1px solid var(--border)',
                 fontWeight: 600
               }}>
                 {t('nav.login')}
               </Link>
             </div>
          </div>
        </section>

        
      </div>

      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes twinkle {
          0%, 100% { opacity: 0.2; }
          50% { opacity: 0.9; }
        }
        @keyframes float {
          0% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
          100% { transform: translateY(0); }
        }
      `}</style>
    </main>
  );
}

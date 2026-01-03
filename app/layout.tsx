export const metadata = {
  title: 'VeemahPay',
  description: 'VeemahPay — Modern banking landing page',
};

import './globals.css';
import Script from 'next/script';
import { cookies } from 'next/headers';
import { ThemeProvider } from '@/components/ui/ThemeProvider';
import { ToastProvider } from '@/components/ui/Toast';
import { LanguageProvider } from '@/components/ui/LanguageProvider';
import { Chatbot } from '@/components/ui/Chatbot';
import { AuthProvider } from '@/components/ui/AuthProvider';
import { pool } from '@/lib/db';
import favicon from '../assets/img/favicon.png';

type Me = { 
  authenticated: boolean; 
  account?: { 
    account_number: string; 
    name: string; 
    balance: number; 
    status: string 
  } 
};

async function getServerMe(): Promise<Me> {
  try {
    const session = cookies().get('session')?.value;
    
    if (!session) {
      return { authenticated: false };
    }

    const result = await pool.query(
      'SELECT account_number, name, balance::float AS balance, status FROM accounts WHERE account_number = $1',
      [session]
    );
    
    if (result.rowCount === 0) {
      return { authenticated: false };
    }
    
    return { authenticated: true, account: result.rows[0] };
  } catch (error) {
    console.error('Server auth error:', error);
    return { authenticated: false };
  }
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const langCookie = cookies().get('language')?.value as 'en' | 'tl' | undefined;
  const initialMe = await getServerMe();
  
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="color-scheme" content="dark light" />
        <link rel="icon" href={favicon.src} />
        <Script id="theme-init" strategy="beforeInteractive">
          {`(function(){try{var s=localStorage.getItem('theme');if(s==='light'){document.documentElement.setAttribute('data-theme','light');return;}if(s==='dark'){return;}var d=window.matchMedia&&window.matchMedia('(prefers-color-scheme: light)').matches;if(d){document.documentElement.setAttribute('data-theme','light');localStorage.setItem('theme','light');}else{localStorage.setItem('theme','dark');}}catch(e){}})()`}
        </Script>
      </head>
      <body>
        <LanguageProvider initialLanguage={langCookie === 'tl' ? 'tl' : 'en'}>
          <ThemeProvider>
            <AuthProvider initialMe={initialMe}>
              <ToastProvider>
                {children}
                <Chatbot />
              </ToastProvider>
            </AuthProvider>
          </ThemeProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}

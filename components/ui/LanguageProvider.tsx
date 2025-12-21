"use client";
import React, { createContext, useContext, useLayoutEffect, useState } from 'react';

type Language = 'en' | 'tl';

type Translations = {
  [key: string]: {
    en: string;
    tl: string;
  };
};

const translations: Translations = {
  // Navigation
  'nav.home': { en: 'Home', tl: 'Tahanan' },
  'nav.login': { en: 'Login', tl: 'Mag-login' },
  'nav.signup': { en: 'Sign Up', tl: 'Mag-register' },
  'nav.dashboard': { en: 'Dashboard', tl: 'Dashboard' },
  'nav.signout': { en: 'Sign Out', tl: 'Mag-logout' },
  'nav.admin': { en: 'Admin', tl: 'Admin' },

  // Home
  'home.hero.title_line1': { en: 'VeemahPay', tl: 'VeemahPay' },
  'home.hero.title_line2': { en: '', tl: '' },
  'home.hero.description': { en: 'Secure, fast, and intelligent financial management. Join VeemahPay today and take control of your wealth with our AI-powered platform.', tl: 'Ligtas, mabilis, at matalinong pamamahala ng pananalapi. Sumali sa VeemahPay ngayon at kontrolin ang iyong yaman gamit ang aming AI-powered platform.' },
  'home.hero.title': { en: 'Banking for the Next Generation', tl: 'Bangko para sa Bagong Henerasyon' },
  'home.hero.subtitle': { en: 'Fast, secure, and easy payments.', tl: 'Mabilis, ligtas, at madaling bayad.' },
  'home.hero.getstarted': { en: 'Get Started', tl: 'Simulan Na' },
  'home.hero.learnmore': { en: 'Learn More', tl: 'Alamin Pa' },

  // Login
  'login.title': { en: 'Login', tl: 'Mag-login' },
  'login.welcome': { en: 'Welcome Back', tl: 'Maligayang Pagbabalik' },
  'login.subtitle': { en: 'Sign in to continue to VeemahPay', tl: 'Mag-sign in upang magpatuloy sa VeemahPay' },
  'login.email': { en: 'Email Address', tl: 'Email Address' },
  'login.email_placeholder': { en: 'name@example.com', tl: 'pangalan@halimbawa.com' },
  'login.password': { en: 'Password', tl: 'Password' },
  'login.password_placeholder': { en: 'Enter your password', tl: 'Ilagay ang iyong password' },
  'login.pin': { en: 'PIN', tl: 'PIN' },
  'login.submit': { en: 'Login', tl: 'Pumasok' },
  'login.logging_in': { en: 'Logging in...', tl: 'Pumapasok...' },
  'login.forgot_password': { en: 'Forgot Password?', tl: 'Nakalimutan ang Password?' },
  'login.sign_in_btn': { en: 'Sign In', tl: 'Mag-sign In' },
  'login.signing_in': { en: 'Signing in...', tl: 'Nag-sa-sign in...' },

  // Signup
  'signup.title': { en: 'Sign Up', tl: 'Gumawa ng Account' },
  'signup.create_account': { en: 'Create Your Account', tl: 'Gumawa ng Account' },
  'signup.subtitle': { en: 'Join VeemahPay for secure, next-generation banking.', tl: 'Sumali sa VeemahPay para sa ligtas at makabagong pagbabangko.' },
  'signup.name': { en: 'Full Name', tl: 'Buong Pangalan' },
  'signup.name_placeholder': { en: 'e.g. Juan dela Cruz', tl: 'hal. Juan dela Cruz' },
  'signup.email': { en: 'Email Address', tl: 'Email Address' },
  'signup.email_placeholder': { en: 'name@example.com', tl: 'pangalan@halimbawa.com' },
  'signup.password': { en: 'Password', tl: 'Password' },
  'signup.password_placeholder': { en: 'At least 8 characters', tl: 'Hindi bababa sa 8 karakter' },
  'signup.confirm_password': { en: 'Confirm Password', tl: 'Kumpirmahin ang Password' },
  'signup.confirm_password_placeholder': { en: 'Re-enter password', tl: 'Ilagay muli ang password' },
  'signup.pin': { en: 'PIN (5 digits)', tl: 'PIN (5 na numero)' },
  'signup.pin_placeholder': { en: '5-digit PIN', tl: '5-digit PIN' },
  'signup.initial_balance': { en: 'Initial Balance', tl: 'Paunang Balanse' },
  'signup.initial_balance_placeholder': { en: 'Optional (min 0)', tl: 'Opsyonal (min 0)' },
  'signup.terms': { en: 'I accept the Terms of Service', tl: 'Tinatanggap ko ang Mga Tuntunin ng Serbisyo' },
  'signup.submit': { en: 'Create Account', tl: 'Gumawa ng Account' },
  'signup.creating': { en: 'Creating...', tl: 'Ginagawa...' },
  'signup.have_account': { en: 'Already have an account?', tl: 'May account na?' },

  // Admin
  'admin.search_placeholder': { en: 'Search accounts', tl: 'Maghanap ng accounts' },
  'admin.search': { en: 'Search', tl: 'Hanapin' },
  'admin.refresh': { en: 'Refresh', tl: 'I-refresh' },
  'admin.account_num': { en: 'Account #', tl: 'Account #' },
  'admin.name': { en: 'Name', tl: 'Pangalan' },
  'admin.status': { en: 'Status', tl: 'Katayuan' },
  'admin.balance': { en: 'Balance', tl: 'Balanse' },
  'admin.edit_info': { en: 'Edit Info', tl: 'I-edit ang Impormasyon' },
  'admin.save': { en: 'Save', tl: 'I-save' },
  'admin.unlock_account': { en: 'Unlock Account', tl: 'I-unlock ang Account' },
  'admin.deposit': { en: 'Deposit', tl: 'Magdeposito' },
  'admin.withdraw': { en: 'Withdraw', tl: 'Mag-withdraw' },
  'admin.transactions': { en: 'Transactions', tl: 'Mga Transaksyon' },
  'admin.id': { en: 'ID', tl: 'ID' },
  'admin.type': { en: 'Type', tl: 'Uri' },
  'admin.target': { en: 'Target', tl: 'Pinadalhan' },
  'admin.actions': { en: 'Actions', tl: 'Aksyon' },
  'admin.complete': { en: 'Complete', tl: 'Kumpletuhin' },
  'admin.void': { en: 'Void', tl: 'I-void' },
  'admin.rollback': { en: 'Rollback', tl: 'I-rollback' },
  'admin.amount': { en: 'Amount', tl: 'Halaga' },

  // Dashboard
  'dash.overview': { en: 'Account Overview', tl: 'Pangkalahatang-ideya ng Account' },
  'dash.account': { en: 'Account', tl: 'Account' },
  'dash.name': { en: 'Name', tl: 'Pangalan' },
  'dash.status': { en: 'Status', tl: 'Katayuan' },
  'dash.balance': { en: 'Balance', tl: 'Balanse' },
  'dash.deposit': { en: 'Deposit', tl: 'Magdeposito' },
  'dash.withdraw': { en: 'Withdraw', tl: 'Mag-withdraw' },
  'dash.transfer': { en: 'Transfer', tl: 'Magpadala' },
  'dash.amount': { en: 'Amount', tl: 'Halaga' },
  'dash.target': { en: 'Target Account', tl: 'Account na Padadalhan' },
  'dash.recent_tx': { en: 'Recent Transactions', tl: 'Mga Nakaraang Transaksyon' },
  'dash.spending': { en: 'Spending Overview', tl: 'Pangkalahatang-ideya ng Gastusin' },

  // Forgot Password
  'forgot.title': { en: 'Reset Password', tl: 'I-reset ang Password' },
  'forgot.subtitle_email': { en: 'Enter your email to receive a reset code.', tl: 'Ilagay ang email para makatanggap ng reset code.' },
  'forgot.subtitle_code': { en: 'Enter the code sent to your email.', tl: 'Ilagay ang code na ipinadala sa email.' },
  'forgot.send_code': { en: 'Send Code', tl: 'Ipadala ang Code' },
  'forgot.sending': { en: 'Sending...', tl: 'Ipinapadala...' },
  'forgot.code_placeholder': { en: '6-digit Code', tl: '6-digit Code' },
  'forgot.new_pin_placeholder': { en: 'New PIN (5 digits)', tl: 'Bagong PIN (5 na numero)' },
  'forgot.confirm_pin_placeholder': { en: 'Confirm PIN (5 digits)', tl: 'Kumpirmahin ang PIN (5 na numero)' },
  'forgot.new_password_placeholder': { en: 'New Password (min 8)', tl: 'Bagong Password (min 8)' },
  'forgot.confirm_password_placeholder': { en: 'Confirm Password', tl: 'Kumpirmahin ang Password' },
  'forgot.continue': { en: 'Continue', tl: 'Magpatuloy' },
  'forgot.reset_btn': { en: 'Reset Password', tl: 'I-reset ang Password' },
  'forgot.resetting': { en: 'Resetting...', tl: 'Nagre-reset...' },
  'forgot.back': { en: 'Back', tl: 'Bumalik' },

  // User / Dashboard Errors & Inputs
  'user.enter_pin': { en: 'Enter PIN', tl: 'Ilagay ang PIN' },
  'user.enter_valid_amount': { en: 'Enter a valid amount', tl: 'Maglagay ng wastong halaga' },
  'user.enter_target_amount': { en: 'Enter target and amount', tl: 'Ilagay ang target at halaga' },
  'user.operation_failed': { en: 'Operation failed', tl: 'Nabigo ang operasyon' },
  'user.transfer_failed': { en: 'Transfer failed', tl: 'Nabigo ang paglilipat' },
  'user.pin_placeholder': { en: 'PIN', tl: 'PIN' },

  // Graph
  'graph.no_data': { en: 'No transaction data to display yet.', tl: 'Wala pang datos ng transaksyon.' },
  'graph.income': { en: 'Income', tl: 'Kita' },
  'graph.expense': { en: 'Expense', tl: 'Gastusin' },
  'graph.last_30_days': { en: 'Last 30 days', tl: 'Huling 30 araw' },
  'graph.net': { en: 'Net', tl: 'Net' },
  'graph.expense_avg_7d': { en: 'Expense (7d avg)', tl: 'Gastusin (7-araw avg)' },
  'graph.expense_by_category': { en: 'Expense by category', tl: 'Gastusin ayon sa kategorya' },
  'graph.monthly_trend': { en: 'Monthly trend', tl: 'Buwanang trend' },
  'graph.this_month': { en: 'This month', tl: 'Ngayong buwan' },
  'graph.last_month': { en: 'Last month', tl: 'Nakaraang buwan' },
  'graph.change': { en: 'Change', tl: 'Pagbabago' },
  'graph.other': { en: 'Other', tl: 'Iba pa' },

  // Chatbot
  'chat.placeholder': { en: 'Ask Veema anything...', tl: 'Magtanong kay Veema...' },
  'chat.header': { en: 'Veema AI Assistant', tl: 'Veema AI Assistant' },
};

type LanguageContextType = {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children, initialLanguage }: { children: React.ReactNode; initialLanguage?: Language }) {
  const [language, setLanguage] = useState<Language>(() => {
    if (typeof initialLanguage === 'string') return initialLanguage;
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('language') as Language | null;
      if (saved === 'en' || saved === 'tl') return saved;
    }
    return 'en';
  });

  useLayoutEffect(() => {
    try {
      localStorage.setItem('language', language);
      document.cookie = `language=${language};path=/;max-age=31536000`;
    } catch {}
  }, [language]);

  const t = (key: string) => {
    return translations[key]?.[language] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLanguage must be used within a LanguageProvider');
  return context;
}

export function LanguageToggle() {
  const { language, setLanguage } = useLanguage();
  return (
    <button 
      className="btn ghost" 
      onClick={() => setLanguage(language === 'en' ? 'tl' : 'en')}
      title={language === 'en' ? 'Switch to Tagalog' : 'Switch to English'}
    >
      {language === 'en' ? '🇵🇭 TL' : '🇺🇸 EN'}
    </button>
  );
}

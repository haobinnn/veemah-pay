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
  'nav.inbox': { en: 'Inbox', tl: 'Inbox' },
  'nav.settings': { en: 'Settings', tl: 'Settings' },
  'nav.transactions': { en: 'Transactions', tl: 'Mga Transaksyon' },

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
  'login.forgot_your_password': { en: 'Forgot your password?', tl: 'Nakalimutan ang iyong password?' },
  'login.sign_in_btn': { en: 'Sign In', tl: 'Mag-sign In' },
  'login.dont_have_account': { en: "Don't have an account?", tl: 'Wala pang account?' },
  'login.sign_up_link': { en: 'Sign up', tl: 'Mag-sign up' },
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
  'admin.role': { en: 'Role', tl: 'Tungkulin' },
  'admin.role_user': { en: 'User', tl: 'User' },
  'admin.role_admin': { en: 'Admin', tl: 'Admin' },
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
  'dash.copy': { en: 'Copy', tl: 'Kopyahin' },
  'dash.copied': { en: 'Copied to clipboard', tl: 'Nakopya sa clipboard' },
  'dash.copy_failed': { en: 'Copy failed', tl: 'Hindi nakopya' },
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

  'tx.history': { en: 'Transaction History', tl: 'Kasaysayan ng Transaksyon' },
  'tx.search_placeholder': { en: 'Search (ID, amount, account, note)', tl: 'Maghanap (ID, halaga, account, note)' },
  'tx.from': { en: 'From', tl: 'Mula' },
  'tx.to': { en: 'To', tl: 'Hanggang' },
  'tx.type_all': { en: 'All types', tl: 'Lahat ng uri' },
  'tx.status_all': { en: 'All statuses', tl: 'Lahat ng status' },
  'tx.direction_all': { en: 'All directions', tl: 'Lahat ng direksyon' },
  'tx.direction_in': { en: 'Incoming', tl: 'Papasok' },
  'tx.direction_out': { en: 'Outgoing', tl: 'Palabas' },
  'tx.min_amount': { en: 'Min amount', tl: 'Min halaga' },
  'tx.max_amount': { en: 'Max amount', tl: 'Max halaga' },
  'tx.apply': { en: 'Apply', tl: 'Ilapat' },
  'tx.load_more': { en: 'Load more', tl: 'Mag-load pa' },
  'tx.export_csv': { en: 'Export CSV', tl: 'I-export CSV' },
  'tx.print_statement': { en: 'Print statement (PDF)', tl: 'I-print ang statement (PDF)' },
  'tx.statement_month': { en: 'Statement month', tl: 'Buwan ng statement' },
  'tx.receipt': { en: 'Receipt', tl: 'Resibo' },

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
  'user.recipient_checking': { en: 'Checking recipient...', tl: 'Tinitingnan ang tatanggap...' },
  'user.recipient_not_found': { en: 'Recipient account not found', tl: 'Hindi nahanap ang account ng tatanggap' },
  'user.recipient_belongs_to': { en: 'This account belongs to', tl: 'Ang account na ito ay kay' },

  // Graph
  'graph.no_data': { en: 'No transaction data to display yet.', tl: 'Wala pang datos ng transaksyon.' },
  'graph.income': { en: 'Income', tl: 'Kita' },
  'graph.expense': { en: 'Expense', tl: 'Gastusin' },
  'graph.last_30_days': { en: 'Last 30 days', tl: 'Huling 30 araw' },
  'graph.range': { en: 'Range', tl: 'Saklaw' },
  'graph.range_7d': { en: '7 Days', tl: '7 Araw' },
  'graph.range_30d': { en: '30 Days', tl: '30 Araw' },
  'graph.range_90d': { en: '90 Days', tl: '90 Araw' },
  'graph.range_ytd': { en: 'Year to Date', tl: 'Year to Date' },
  'graph.net': { en: 'Net', tl: 'Net' },
  'graph.expense_avg_7d': { en: 'Expense (7d avg)', tl: 'Gastusin (7-araw avg)' },
  'graph.expense_by_category': { en: 'Expense by category', tl: 'Gastusin ayon sa kategorya' },
  'graph.monthly_trend': { en: 'Monthly trend', tl: 'Buwanang trend' },
  'graph.this_month': { en: 'This month', tl: 'Ngayong buwan' },
  'graph.last_month': { en: 'Last month', tl: 'Nakaraang buwan' },
  'graph.this_period': { en: 'This period', tl: 'Ngayong saklaw' },
  'graph.prev_period': { en: 'Previous period', tl: 'Nakaraang saklaw' },
  'graph.change': { en: 'Change', tl: 'Pagbabago' },
  'graph.other': { en: 'Other', tl: 'Iba pa' },

  // Chatbot
  'chat.placeholder': { en: 'Ask Veema anything...', tl: 'Magtanong kay Veema...' },
  'chat.header': { en: 'Veema AI Assistant', tl: 'Veema AI Assistant' },

  'inbox.title': { en: 'Inbox', tl: 'Inbox' },
  'inbox.loading': { en: 'Loading...', tl: 'Nilo-load...' },
  'inbox.empty': { en: 'No notifications yet', tl: 'Wala pang notifications' },
  'inbox.error': { en: 'Failed to load notifications', tl: 'Hindi ma-load ang notifications' },
  'inbox.mark_read': { en: 'Mark read', tl: 'Markahin bilang nabasa' },
  'inbox.mark_all_read': { en: 'Mark all as read', tl: 'Markahin lahat bilang nabasa' },
  'inbox.read': { en: 'Read', tl: 'Nabasa' },
  'inbox.view_all': { en: 'View all', tl: 'Tingnan lahat' },
  'inbox.all_notifications': { en: 'All notifications', tl: 'Lahat ng notifications' },
  'inbox.load_more': { en: 'Load more', tl: 'Mag-load pa' },

  'settings.title': { en: 'Settings', tl: 'Settings' },
  'settings.subtitle': { en: 'Manage your profile and security', tl: 'I-manage ang profile at security' },
  'settings.loading': { en: 'Loading...', tl: 'Nilo-load...' },
  'settings.account': { en: 'Account', tl: 'Account' },
  'settings.profile': { en: 'Profile', tl: 'Profile' },
  'settings.security': { en: 'Security', tl: 'Security' },
  'settings.name': { en: 'Name', tl: 'Pangalan' },
  'settings.email': { en: 'Email', tl: 'Email' },
  'settings.current_password_optional': { en: 'Current Password', tl: 'Kasalukuyang Password' },
  'settings.current_pin_optional': { en: 'Current PIN', tl: 'Kasalukuyang PIN' },
  'settings.save_profile': { en: 'Save Profile', tl: 'I-save ang Profile' },
  'settings.change_pin': { en: 'Change PIN', tl: 'Palitan ang PIN' },
  'settings.current_pin': { en: 'Current PIN', tl: 'Kasalukuyang PIN' },
  'settings.new_pin': { en: 'New PIN', tl: 'Bagong PIN' },
  'settings.confirm_pin': { en: 'Confirm PIN', tl: 'Kumpirmahin ang PIN' },
  'settings.save_pin': { en: 'Save PIN', tl: 'I-save ang PIN' },
  'settings.change_password': { en: 'Change Password', tl: 'Palitan ang Password' },
  'settings.new_password': { en: 'New Password', tl: 'Bagong Password' },
  'settings.confirm_password': { en: 'Confirm Password', tl: 'Kumpirmahin ang Password' },
  'settings.save_password': { en: 'Save Password', tl: 'I-save ang Password' },
  'settings.saving': { en: 'Saving...', tl: 'Ini-save...' },
  'settings.no_changes': { en: 'No changes to save', tl: 'Walang babaguhin' },
  'settings.update_failed': { en: 'Update failed', tl: 'Nabigo ang update' },
  'settings.profile_updated': { en: 'Profile updated', tl: 'Na-update ang profile' },
  'settings.pin_updated': { en: 'PIN updated', tl: 'Na-update ang PIN' },
  'settings.password_updated': { en: 'Password updated', tl: 'Na-update ang password' },
  'settings.pin_fields_required': { en: 'PIN fields are required', tl: 'Kailangan ang mga PIN field' },
  'settings.pin_mismatch': { en: 'PINs do not match', tl: 'Hindi magkatugma ang PIN' },
  'settings.pin_5_digits': { en: 'PIN must be exactly 5 digits', tl: 'Dapat 5 digits ang PIN' },
  'settings.password_fields_required': { en: 'Password fields are required', tl: 'Kailangan ang mga password field' },
  'settings.password_min_8': { en: 'Password must be at least 8 characters', tl: 'Dapat hindi bababa sa 8 karakter ang password' },
  'settings.password_mismatch': { en: 'Passwords do not match', tl: 'Hindi magkatugma ang password' },
  'settings.email_requires_verification_hint': { en: 'Changing your email requires verification. A code will be sent to the new address.', tl: 'Kapag magpapalit ng email, kailangan ng verification. Magpapadala ng code sa bagong address.' },
  'settings.current_password_required': { en: 'Current password is required', tl: 'Kailangan ang kasalukuyang password' },
  'settings.current_pin_required': { en: 'Current PIN is required', tl: 'Kailangan ang kasalukuyang PIN' },
  'settings.email_required': { en: 'Email is required', tl: 'Kailangan ang email' },
  'settings.verification_sent': { en: 'Verification code sent', tl: 'Naipadala ang verification code' },
  'settings.code_resent': { en: 'Verification code resent', tl: 'Muling naipadala ang verification code' },
  'settings.verification_code': { en: 'Verification Code', tl: 'Verification Code' },
  'settings.verification_code_required': { en: 'Verification code is required', tl: 'Kailangan ang verification code' },
  'settings.resend_code': { en: 'Resend Code', tl: 'Ipadala Muli ang Code' },
  'settings.verify': { en: 'Verify', tl: 'I-verify' },
  'settings.email_updated': { en: 'Email updated', tl: 'Na-update ang email' },
  'settings.email_change_pending': { en: 'Pending email change', tl: 'Naka-pending na pagpapalit ng email' },
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

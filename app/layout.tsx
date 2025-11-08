export const metadata = {
  title: 'RGBC — Win98',
  description: 'Richard Gwapo Banking Corporation in Windows 98 style',
};

import './globals.css';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
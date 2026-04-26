import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Zoom 教學平台 | 直播教學與日文自學整合平台',
  description: '整合 Zoom 直播課程、學生預約流程與 Jaeasy 日文自學模組的中文教學平台。',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang='zh-Hant' className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className='min-h-full bg-slate-50 text-slate-950'>{children}</body>
    </html>
  );
}

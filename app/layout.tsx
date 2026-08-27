import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'ExamGuard — Personalized Examination Integrity',
    template: '%s | ExamGuard',
  },
  description:
    "ExamGuard compares examination behavior against a personalized behavioral model built from each student's own learning history.",
  keywords: ['examination integrity', 'behavioral analysis', 'personalized model', 'academic integrity'],
  authors: [{ name: 'ExamGuard' }],
  robots: 'noindex, nofollow',
};

import { DemoTools } from '@/components/ui/DemoTools';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`h-full ${inter.variable}`}>
      <body className="h-full antialiased">
        {children}
        <DemoTools />
      </body>
    </html>
  );
}

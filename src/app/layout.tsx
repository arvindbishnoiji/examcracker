import type { Metadata } from 'next';
import './globals.css';
import { SiteConfigProvider } from '@/context/SiteConfigContext';
import { AuthProvider } from '@/context/AuthContext';
import { ToastProvider } from '@/hooks/useToast';
import { AppChrome } from '@/components/layout/AppChrome';

export const metadata: Metadata = {
  title: 'Exam Cracker — JEE & NEET Learning',
  description:
    'JEE and NEET coaching app with video lectures, tests, leaderboard and real-time doubt chat. Built with Firebase, Supabase and Cloudflare.',
  manifest: '/manifest.json',
  icons: { icon: '/favicon.ico' },
  openGraph: {
    title: 'Exam Cracker',
    description: 'Crack JEE & NEET with curated lectures, tests and live doubt support.',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen antialiased">
        <SiteConfigProvider>
          <AuthProvider>
            <ToastProvider>
              <AppChrome>{children}</AppChrome>
            </ToastProvider>
          </AuthProvider>
        </SiteConfigProvider>
      </body>
    </html>
  );
}

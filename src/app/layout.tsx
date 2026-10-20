import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import { ToastProvider } from '@/hooks/useToast';
import { Header } from '@/components/layout/Header';
import { BottomNav } from '@/components/layout/BottomNav';

export const metadata: Metadata = {
  title: 'Exam Cracker — JEE & NEET Learning',
  description: 'JEE and NEET coaching app with video lectures, tests, leaderboard and real-time doubt chat. Built with Firebase, Supabase and Cloudflare.',
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
    <html lang="en">
      <body className="min-h-screen bg-ink-50 text-ink-900 antialiased">
        <AuthProvider>
          <ToastProvider>
            <Header />
            <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 pb-20 md:pb-6">
              {children}
            </main>
            <BottomNav />
            <footer className="border-t border-ink-100 bg-white mt-8">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 text-center text-xs text-ink-500">
                <p>Exam Cracker • Firebase project darvo1 • Hosted on Cloudflare Workers</p>
                <p className="mt-1">All schedules shown in Asia/Kolkata (IST). Content filtered by your JEE/NEET & Class.</p>
              </div>
            </footer>
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}

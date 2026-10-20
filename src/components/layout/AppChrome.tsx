'use client';

import { usePathname } from 'next/navigation';
import { Header } from './Header';
import { BottomNav } from './BottomNav';
import { Footer } from './Footer';
import { StudentGate } from '@/components/auth/StudentGate';

/**
 * Keeps admin on its own full-screen canvas while public/student pages keep the
 * familiar header, footer and mobile bottom navigation.
 */
export function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAdmin = Boolean(pathname?.startsWith('/admin'));
  const isFocusedAuth = pathname === '/login' || pathname === '/onboarding';

  if (isAdmin) return <>{children}</>;

  return (
    <>
      {!isFocusedAuth && <Header />}
      <main className={isFocusedAuth ? 'w-full' : 'ec-main'}>
        <StudentGate>{children}</StudentGate>
      </main>
      {!isFocusedAuth && <Footer />}
      {!isFocusedAuth && <BottomNav />}
    </>
  );
}

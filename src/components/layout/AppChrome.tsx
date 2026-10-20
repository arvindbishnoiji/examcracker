'use client';

import { usePathname } from 'next/navigation';
import { Header } from './Header';
import { BottomNav } from './BottomNav';
import { Footer } from './Footer';

/**
 * Keeps admin on its own full-screen canvas while public/student pages keep the
 * familiar header, footer and mobile bottom navigation.
 */
export function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAdmin = Boolean(pathname?.startsWith('/admin'));
  const isFocusedLogin = pathname === '/login';

  if (isAdmin) return <>{children}</>;

  return (
    <>
      {!isFocusedLogin && <Header />}
      <main className={isFocusedLogin ? 'w-full' : 'ec-main'}>{children}</main>
      {!isFocusedLogin && <Footer />}
      {!isFocusedLogin && <BottomNav />}
    </>
  );
}

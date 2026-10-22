'use client';

import { usePathname } from 'next/navigation';
import { Header } from './Header';
import { BottomNav } from './BottomNav';
import { Footer } from './Footer';
import { StudentGate } from '@/components/auth/StudentGate';
import { PageFX } from '@/components/motion/PageFX';
import { AnimationLayerHost } from '@/components/site/AnimationLayerHost';
import { StudentTour } from '@/components/student/StudentTour';

/**
 * Keeps admin and standalone public/auth surfaces on their own full-bleed canvas
 * while authenticated student screens get the shared header, guided tour, footer
 * and mobile bottom navigation.
 */
export function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAdmin = Boolean(pathname?.startsWith('/admin'));
  const isStandalone = pathname === '/' || pathname === '/login' || pathname === '/onboarding';

  if (isAdmin) return <>{children}</>;

  return (
    <>
      <PageFX />
      <AnimationLayerHost />
      {!isStandalone && <Header />}
      <main className={isStandalone ? 'w-full' : 'ec-main'}>
        <StudentGate>{children}</StudentGate>
      </main>
      {!isStandalone && <StudentTour />}
      {!isStandalone && <Footer />}
      {!isStandalone && <BottomNav />}
    </>
  );
}

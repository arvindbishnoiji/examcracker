'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useSiteConfig } from '@/context/SiteConfigContext';

/**
 * Small, tasteful motion layer shared by every public page:
 *  • a gradient scroll-progress rail
 *  • a click ripple (skipped for reduced-motion users)
 *  • a page-change fade so navigations feel intentional
 *
 * It is purely decorative: nothing here blocks pointer events or reading.
 */
export function PageFX() {
  const { config } = useSiteConfig();
  const pathname = usePathname();
  const [progress, setProgress] = useState(0);
  const motionOff = config.theme.animation === 'none';

  useEffect(() => {
    if (motionOff) return;
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        const doc = document.documentElement;
        const max = doc.scrollHeight - doc.clientHeight;
        setProgress(max > 0 ? Math.min(100, Math.max(0, (doc.scrollTop / max) * 100)) : 0);
        frame = 0;
      });
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [motionOff, pathname]);

  useEffect(() => {
    if (motionOff) return;
    if (typeof window === 'undefined') return;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return;

    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, [data-no-ripple]')) return;
      const ripple = document.createElement('span');
      ripple.className = 'ec-ripple';
      ripple.style.left = `${event.clientX}px`;
      ripple.style.top = `${event.clientY}px`;
      document.body.appendChild(ripple);
      window.setTimeout(() => ripple.remove(), 680);
    };
    window.addEventListener('click', onClick);
    return () => window.removeEventListener('click', onClick);
  }, [motionOff]);

  if (motionOff) return null;

  return (
    <>
      <div className="ec-scroll-progress" style={{ width: `${progress}%` }} aria-hidden />
      <div key={pathname} className="ec-fade-in" aria-hidden style={{ display: 'none' }} />
    </>
  );
}

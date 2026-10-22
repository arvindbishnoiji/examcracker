'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import { X } from 'lucide-react';
import { useSiteConfig } from '@/context/SiteConfigContext';
import { useAuth } from '@/context/AuthContext';
import { buildAnimationDocument, layersForPage } from '@/lib/studio-config';
import type { AnimationLayer, BatchPage } from '@/types';

const PAGE_OVERRIDES: Array<{ startsWith: string; page: BatchPage }> = [
  { startsWith: '/home', page: 'home' },
  { startsWith: '/lectures', page: 'lectures' },
  { startsWith: '/tests', page: 'tests' },
  { startsWith: '/events', page: 'events' },
  { startsWith: '/leaderboard', page: 'dashboard' },
  { startsWith: '/profile', page: 'dashboard' },
  { startsWith: '/challenges', page: 'dashboard' },
];

function pageForPath(pathname: string | null): BatchPage | null {
  if (!pathname) return null;
  const match = PAGE_OVERRIDES.find((entry) => pathname === entry.startsWith || pathname.startsWith(`${entry.startsWith}/`));
  return match ? match.page : null;
}

function storageKey(layer: AnimationLayer, userId?: string | null): string {
  // once_user means one display per Firebase user, not one display across all
  // accounts that might sign in on the same browser.
  const userSuffix = layer.frequency === 'once_user' ? `:${userId || 'anonymous'}` : '';
  return `ec-anim-seen:${layer.id}${userSuffix}`;
}

function browserStorage(layer: AnimationLayer): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return layer.frequency === 'once_session' ? window.sessionStorage : window.localStorage;
  } catch {
    // Accessing the storage getter itself can throw in sandboxed/private modes.
    return null;
  }
}

function alreadySeen(layer: AnimationLayer, userId?: string | null): boolean {
  if (typeof window === 'undefined' || layer.frequency === 'always') return false;
  if (layer.frequency === 'once_user' && !userId) return false;
  const storage = browserStorage(layer);
  if (!storage) return false;
  try {
    const raw = storage.getItem(storageKey(layer, userId));
    if (!raw) return false;
    if (layer.frequency === 'once_user' || layer.frequency === 'once_session') return true;
    return raw === new Date().toISOString().slice(0, 10);
  } catch {
    return false;
  }
}

function rememberSeen(layer: AnimationLayer, userId?: string | null): void {
  if (typeof window === 'undefined' || layer.frequency === 'always') return;
  if (layer.frequency === 'once_user' && !userId) return;
  const storage = browserStorage(layer);
  if (!storage) return;
  try {
    const value = layer.frequency === 'once_day' ? new Date().toISOString().slice(0, 10) : 'seen';
    storage.setItem(storageKey(layer, userId), value);
  } catch {
    /* storage can be blocked; the layer still works for this view. */
  }
}

function useTriggerFire(layer: AnimationLayer | null, enabled: boolean): boolean {
  const [fire, setFire] = useState(false);

  useEffect(() => {
    if (!layer || !enabled) {
      setFire(false);
      return;
    }
    setFire(false);
    if (layer.trigger === 'page_load' || layer.trigger === 'schedule') {
      setFire(true);
      return;
    }

    let timer = 0;
    const scheduleDelay = () => {
      timer = window.setTimeout(() => setFire(true), Math.max(0, layer.delayMs));
    };

    if (layer.trigger === 'delay') {
      scheduleDelay();
    } else if (layer.trigger === 'scroll') {
      const onScroll = () => {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        if (window.scrollY > Math.max(120, max * 0.18)) setFire(true);
      };
      window.addEventListener('scroll', onScroll, { passive: true });
      onScroll();
      return () => window.removeEventListener('scroll', onScroll);
    } else if (layer.trigger === 'exit_intent') {
      const onLeave = (event: MouseEvent) => {
        if (event.clientY <= 4) setFire(true);
      };
      document.addEventListener('mouseleave', onLeave);
      return () => document.removeEventListener('mouseleave', onLeave);
    } else if (layer.trigger === 'idle') {
      const reset = () => {
        window.clearTimeout(timer);
        scheduleDelay();
      };
      ['pointermove', 'keydown', 'touchstart', 'wheel'].forEach((event) =>
        window.addEventListener(event, reset, { passive: true })
      );
      scheduleDelay();
      return () => {
        window.clearTimeout(timer);
        ['pointermove', 'keydown', 'touchstart', 'wheel'].forEach((event) =>
          window.removeEventListener(event, reset)
        );
      };
    }

    return () => window.clearTimeout(timer);
  }, [layer, enabled]);

  return fire;
}

/**
 * Mounts admin-authored animation layers for the current page. Layers run inside
 * a sandboxed iframe (unique origin, no same-origin access), so custom JS can
 * never touch student data, cookies or the parent document.
 */
export function AnimationLayerHost() {
  const { config } = useSiteConfig();
  const { profile, user } = useAuth();
  const pathname = usePathname();
  const page = pageForPath(pathname);
  const [dismissed, setDismissed] = useState<Record<string, boolean>>({});
  const [now, setNow] = useState(() => Date.now());
  const [seenVersion, setSeenVersion] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(media.matches);
    const listener = (event: MediaQueryListEvent) => setReducedMotion(event.matches);
    if (media.addEventListener) media.addEventListener('change', listener);
    else media.addListener(listener);
    return () => {
      if (media.removeEventListener) media.removeEventListener('change', listener);
      else media.removeListener(listener);
    };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60000);
    return () => window.clearInterval(timer);
  }, []);

  const student = profile ? { exam: profile.exam, classLevel: profile.class_level } : null;

  const layer = useMemo(() => {
    if (!page) return null;
    const studio = config.animations;
    if (studio.respectReducedMotion && reducedMotion) return null;
    const candidates = layersForPage(studio, page, student, now).filter(
      (candidate) => !dismissed[candidate.id] && !alreadySeen(candidate, user?.uid)
    );
    return candidates[0] || null;
    // seenVersion forces a re-evaluation after a layer is marked as seen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.animations, page, student?.exam, student?.classLevel, user?.uid, dismissed, now, seenVersion, reducedMotion]);

  const fire = useTriggerFire(layer, Boolean(layer));

  const close = useCallback(() => {
    if (!layer) return;
    rememberSeen(layer, user?.uid);
    setDismissed((previous) => ({ ...previous, [layer.id]: true }));
    setSeenVersion((version) => version + 1);
  }, [layer, user?.uid]);

  useEffect(() => {
    if (!layer || !fire || !layer.durationMs) return;
    const timer = window.setTimeout(close, layer.durationMs);
    return () => window.clearTimeout(timer);
  }, [layer, fire, close]);

  useEffect(() => {
    if (!layer || !fire) return;
    rememberSeen(layer, user?.uid);
  }, [layer, fire, user?.uid]);

  if (!layer || !fire) return null;

  const doc = buildAnimationDocument(layer);
  const interactive = layer.surface === 'banner' || layer.surface === 'corner';

  return (
    <div
      className="ec-anim-host"
      data-surface={layer.surface}
      data-anim-layer={layer.id}
      role={layer.surface === 'overlay' ? 'dialog' : 'complementary'}
      aria-label={layer.name}
      aria-live="polite"
    >
      {layer.surface === 'overlay' && layer.backdrop !== 'none' && (
        <div className="ec-anim-backdrop" data-kind={layer.backdrop} aria-hidden />
      )}
      <div style={{ position: layer.surface === 'overlay' ? 'relative' : 'relative', width: '100%', height: '100%' }}>
        <iframe
          title={layer.name}
          srcDoc={doc}
          sandbox="allow-scripts allow-popups"
          className="ec-anim-frame"
          data-surface={layer.surface}
          style={{ pointerEvents: interactive ? 'auto' : layer.surface === 'overlay' ? 'auto' : 'none' }}
          loading="lazy"
        />
      </div>
      {layer.caption && layer.surface !== 'overlay' && (
        <span className="ec-sr-only">{layer.caption}</span>
      )}
      {layer.reward.label && layer.reward.href && (
        <a className="ec-anim-reward" href={layer.reward.href}>
          <span aria-hidden>{layer.reward.icon || '🎁'}</span>
          {layer.reward.claimLabel || layer.reward.label}
        </a>
      )}
      {layer.dismissible && (
        <button type="button" className="ec-anim-close" onClick={close} aria-label={`Close ${layer.name}`}>
          <X size={16} />
        </button>
      )}
    </div>
  );
}

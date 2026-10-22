'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { BannersConfig } from '@/types';
import { BannerArtwork } from './BannerArtwork';

const DEFAULT_CAROUSEL_SETTINGS = {
  autoplay: true,
  rotationSeconds: 6,
  showDots: true,
  showArrows: true,
};

export function BannerCarousel({
  banners,
  settings,
  compact = false,
  className = '',
}: {
  banners: BannersConfig['items'];
  settings?: Partial<Pick<BannersConfig, 'autoplay' | 'rotationSeconds' | 'showDots' | 'showArrows'>>;
  compact?: boolean;
  className?: string;
}) {
  const safeSettings = { ...DEFAULT_CAROUSEL_SETTINGS, ...(settings || {}) };
  const uniqueBanners = useMemo(() => {
    const seen = new Set<string>();
    return (banners || []).filter((banner) => {
      if (!banner?.id || seen.has(banner.id)) return false;
      seen.add(banner.id);
      return true;
    });
  }, [banners]);

  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const count = uniqueBanners.length;

  const go = useCallback(
    (next: number) => {
      if (count === 0) return;
      setIndex(((next % count) + count) % count);
    },
    [count]
  );

  useEffect(() => {
    if (index >= count) setIndex(0);
  }, [count, index]);

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (!safeSettings.autoplay || count <= 1 || paused) return;
    timerRef.current = setInterval(() => {
      setIndex((previous) => (previous + 1) % count);
    }, Math.max(4, Number(safeSettings.rotationSeconds) || 6) * 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [safeSettings.autoplay, safeSettings.rotationSeconds, count, paused]);

  if (count === 0) return null;

  const activeIndex = Math.min(index, count - 1);

  if (count === 1) {
    return (
      <section className={`relative ${className}`} aria-label="Featured announcement">
        <BannerArtwork banner={uniqueBanners[0]} compact={compact} />
      </section>
    );
  }

  return (
    <section
      className={`relative ${className}`}
      aria-roledescription="carousel"
      aria-label="Featured announcements"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      onKeyDown={(event) => {
        if (event.key === 'ArrowLeft') {
          event.preventDefault();
          go(activeIndex - 1);
        } else if (event.key === 'ArrowRight') {
          event.preventDefault();
          go(activeIndex + 1);
        }
      }}
    >
      <div className="relative overflow-hidden rounded-[var(--ec-radius)]">
        <div
          className="flex transition-transform duration-500 ease-out"
          style={{ transform: `translateX(-${activeIndex * 100}%)` }}
        >
          {uniqueBanners.map((banner, slideIdx) => (
            <div
              key={banner.id}
              className="w-full shrink-0"
              aria-hidden={slideIdx !== activeIndex}
            >
              <BannerArtwork banner={banner} compact={compact} />
            </div>
          ))}
        </div>

        <span className="pointer-events-none absolute right-3 top-3 z-[2] rounded-full bg-slate-950/65 px-2.5 py-0.5 text-[10px] font-semibold tabular-nums text-white backdrop-blur-sm">
          {activeIndex + 1} / {count}
        </span>

        {safeSettings.showArrows && (
          <>
            <button
              type="button"
              onClick={() => go(activeIndex - 1)}
              aria-label="Previous banner"
              className="absolute left-2.5 top-1/2 z-[2] grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full border border-white/20 bg-slate-950/55 text-white backdrop-blur-sm transition hover:bg-slate-950/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              type="button"
              onClick={() => go(activeIndex + 1)}
              aria-label="Next banner"
              className="absolute right-2.5 top-1/2 z-[2] grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full border border-white/20 bg-slate-950/55 text-white backdrop-blur-sm transition hover:bg-slate-950/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
            >
              <ChevronRight size={18} />
            </button>
          </>
        )}
      </div>

      {safeSettings.showDots && (
        <div className="mt-2.5 flex items-center justify-center gap-1.5" role="tablist" aria-label="Choose slide">
          {uniqueBanners.map((banner, dotIndex) => (
            <button
              key={banner.id}
              type="button"
              role="tab"
              aria-selected={dotIndex === activeIndex}
              onClick={() => go(dotIndex)}
              aria-label={`Slide ${dotIndex + 1}: ${banner.title}`}
              className={`h-1.5 rounded-full transition-all ${
                dotIndex === activeIndex
                  ? 'w-6 bg-[var(--ec-brand)]'
                  : 'w-2 bg-ink-300 hover:bg-ink-400'
              }`}
            />
          ))}
        </div>
      )}
    </section>
  );
}

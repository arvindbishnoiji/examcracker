'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { BannersConfig } from '@/types';
import { BannerArtwork } from './BannerArtwork';

export function BannerCarousel({
  banners,
  settings,
  className = '',
}: {
  banners: BannersConfig['items'];
  settings: Pick<BannersConfig, 'autoplay' | 'rotationSeconds' | 'showDots' | 'showArrows'>;
  className?: string;
}) {
  const [index, setIndex] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const count = banners.length;

  const go = useCallback(
    (next: number) => {
      if (count === 0) return;
      setIndex(((next % count) + count) % count);
    },
    [count]
  );

  useEffect(() => {
    setIndex(0);
  }, [count]);

  useEffect(() => {
    if (!settings.autoplay || count <= 1) return;
    timerRef.current = setInterval(() => {
      setIndex((previous) => (previous + 1) % count);
    }, Math.max(3, settings.rotationSeconds) * 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [settings.autoplay, settings.rotationSeconds, count]);

  if (count === 0) return null;

  return (
    <section
      className={`relative ${className}`}
      aria-roledescription="carousel"
      aria-label="Featured banners"
      onMouseEnter={() => {
        if (timerRef.current) clearInterval(timerRef.current);
      }}
      onMouseLeave={() => {
        if (timerRef.current) clearInterval(timerRef.current);
        if (settings.autoplay && count > 1) {
          timerRef.current = setInterval(() => {
            setIndex((previous) => (previous + 1) % count);
          }, Math.max(3, settings.rotationSeconds) * 1000);
        }
      }}
    >
      <div className="relative overflow-hidden rounded-[var(--ec-radius)]">
        <div
          className="flex transition-transform duration-500 ease-out"
          style={{ transform: `translateX(-${index * 100}%)` }}
        >
          {banners.map((banner) => (
            <div key={banner.id} className="w-full shrink-0">
              <BannerArtwork banner={banner} />
            </div>
          ))}
        </div>

        {settings.showArrows && count > 1 && (
          <>
            <button
              type="button"
              onClick={() => go(index - 1)}
              aria-label="Previous banner"
              className="absolute left-2 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-black/35 text-white backdrop-blur grid place-items-center hover:bg-black/50"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={() => go(index + 1)}
              aria-label="Next banner"
              className="absolute right-2 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-black/35 text-white backdrop-blur grid place-items-center hover:bg-black/50"
            >
              ›
            </button>
          </>
        )}
      </div>

      {settings.showDots && count > 1 && (
        <div className="flex items-center justify-center gap-1.5 mt-2.5">
          {banners.map((banner, dotIndex) => (
            <button
              key={banner.id}
              type="button"
              onClick={() => go(dotIndex)}
              aria-label={`Go to banner ${dotIndex + 1}`}
              aria-current={dotIndex === index}
              className={`h-1.5 rounded-full transition-all ${
                dotIndex === index ? 'w-6 bg-[var(--ec-brand)]' : 'w-1.5 bg-ink-300'
              }`}
            />
          ))}
        </div>
      )}
    </section>
  );
}

'use client';

import Link from 'next/link';
import type { Banner } from '@/types';
import { isSafeHttpUrl, isValidInternalDeepLink } from '@/lib/validation';

function Cta({ banner, className = '' }: { banner: Banner; className?: string }) {
  if (!banner.ctaLabel || !banner.ctaHref) return null;
  const classes = `inline-flex items-center gap-1.5 px-4 py-2 text-xs sm:text-sm font-bold transition ${className}`;
  const style = { borderRadius: 'var(--ec-button-radius)' };
  if (isValidInternalDeepLink(banner.ctaHref)) {
    return (
      <Link href={banner.ctaHref} className={`${classes} bg-[var(--ec-surface)] text-ink-900 hover:opacity-90`} style={style}>
        {banner.ctaLabel} <span aria-hidden>→</span>
      </Link>
    );
  }
  if (isSafeHttpUrl(banner.ctaHref)) {
    return (
      <a
        href={banner.ctaHref}
        target="_blank"
        rel="noopener noreferrer"
        className={`${classes} bg-[var(--ec-surface)] text-ink-900 hover:opacity-90`}
        style={style}
      >
        {banner.ctaLabel} <span aria-hidden>↗</span>
      </a>
    );
  }
  return null;
}

export function BannerArtwork({
  banner,
  compact = false,
  className = '',
}: {
  banner: Banner;
  compact?: boolean;
  className?: string;
}) {
  const align =
    banner.textAlign === 'center' ? 'items-center text-center' : banner.textAlign === 'right' ? 'items-end text-right' : 'items-start text-left';
  const desktop = isSafeHttpUrl(banner.desktopImageUrl) ? banner.desktopImageUrl : '';
  const mobile = isSafeHttpUrl(banner.mobileImageUrl) ? banner.mobileImageUrl : '';
  const primaryImage = mobile || desktop;
  const overlay = Math.max(0, Math.min(90, banner.overlay)) / 100;

  return (
    <div
      className={`relative overflow-hidden rounded-[var(--ec-radius)] ${compact ? 'min-h-[150px]' : 'min-h-[210px] sm:min-h-[280px]'} ${className}`}
      style={{ background: banner.backgroundColor || 'linear-gradient(120deg, var(--ec-brand), var(--ec-secondary))' }}
    >
      {primaryImage && (
        <picture>
          {mobile && <source media="(max-width: 640px)" srcSet={mobile} />}
          <img
            src={desktop || mobile}
            alt={banner.title}
            className="absolute inset-0 h-full w-full object-cover"
            loading="lazy"
          />
        </picture>
      )}
      {!primaryImage && (
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(700px 300px at 85% -10%, rgb(255 255 255 / 0.24), transparent 60%), radial-gradient(500px 260px at 0% 110%, rgb(var(--ec-accent) / 0.35), transparent 60%)',
          }}
        />
      )}
      <div className="absolute inset-0" style={{ background: `rgba(5, 10, 25, ${overlay})` }} />
      <div className={`relative h-full flex flex-col justify-end p-4 sm:p-6 ${align}`}>
        {banner.badge && (
          <span className="inline-flex rounded-full bg-white/15 text-white border border-white/25 backdrop-blur px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] mb-2">
            {banner.badge}
          </span>
        )}
        <h3 className={`text-white drop-shadow-sm ${compact ? 'text-base' : 'text-xl sm:text-3xl'} leading-tight max-w-2xl`}>
          {banner.title}
        </h3>
        {banner.subtitle && (
          <p className={`text-white/90 mt-1 max-w-xl ${compact ? 'text-[11px]' : 'text-xs sm:text-sm'}`}>{banner.subtitle}</p>
        )}
        {banner.description && !compact && (
          <p className="text-white/75 text-[11px] sm:text-xs mt-1.5 max-w-lg line-clamp-2">{banner.description}</p>
        )}
        {banner.ctaLabel && banner.ctaHref && (
          <div className="mt-3">
            <Cta banner={banner} />
          </div>
        )}
      </div>
    </div>
  );
}

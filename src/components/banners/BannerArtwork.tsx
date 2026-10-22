'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowRight, ExternalLink } from 'lucide-react';
import type { Banner } from '@/types';
import { isSafeHttpUrl, isValidInternalDeepLink } from '@/lib/validation';

function BannerCta({ banner }: { banner: Banner }) {
  const label = banner.ctaLabel?.trim();
  const href = banner.ctaHref?.trim();
  if (!label || !href) return null;

  const baseClass =
    'inline-flex items-center gap-1.5 rounded-[var(--ec-button-radius)] bg-white px-4 py-2 text-xs sm:text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white';

  if (isValidInternalDeepLink(href)) {
    return (
      <Link href={href} className={baseClass}>
        <span>{label}</span>
        <ArrowRight size={14} aria-hidden />
      </Link>
    );
  }
  if (isSafeHttpUrl(href)) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={baseClass}
      >
        <span>{label}</span>
        <ExternalLink size={13} aria-hidden />
      </a>
    );
  }
  return null;
}

function formatAudienceBadge(audience?: Banner['audience']): string | null {
  if (!audience || audience === 'all') return null;
  return audience.replace('-', ' • Class ');
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
  const desktop = isSafeHttpUrl(banner.desktopImageUrl) ? banner.desktopImageUrl.trim() : '';
  const mobile = isSafeHttpUrl(banner.mobileImageUrl) ? banner.mobileImageUrl.trim() : '';
  const hasConfiguredImage = Boolean(desktop || mobile);
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [desktop, mobile]);

  const showImage = hasConfiguredImage && !imageFailed;
  const align =
    banner.textAlign === 'center'
      ? 'items-center text-center'
      : banner.textAlign === 'right'
        ? 'items-end text-right'
        : 'items-start text-left';

  const overlayAlpha = Math.max(0.28, Math.min(0.9, (Number(banner.overlay) || 38) / 100));
  const badgeText = banner.badge?.trim() || formatAudienceBadge(banner.audience);

  const sizeClasses = compact
    ? 'min-h-[148px] sm:min-h-[168px]'
    : showImage
      ? 'aspect-[16/9] sm:aspect-[21/8] min-h-[196px] sm:min-h-[248px]'
      : 'min-h-[188px] sm:min-h-[228px]';

  const scrimDirection =
    banner.textAlign === 'right'
      ? `linear-gradient(270deg, rgba(10, 18, 36, ${Math.min(0.92, overlayAlpha + 0.28)}) 0%, rgba(10, 18, 36, ${overlayAlpha}) 62%, rgba(10, 18, 36, ${Math.max(0.18, overlayAlpha - 0.16)}) 100%)`
      : banner.textAlign === 'center'
        ? `linear-gradient(180deg, rgba(10, 18, 36, ${Math.max(0.26, overlayAlpha - 0.08)}) 0%, rgba(10, 18, 36, ${Math.min(0.9, overlayAlpha + 0.26)}) 100%)`
        : `linear-gradient(90deg, rgba(10, 18, 36, ${Math.min(0.92, overlayAlpha + 0.28)}) 0%, rgba(10, 18, 36, ${overlayAlpha}) 62%, rgba(10, 18, 36, ${Math.max(0.18, overlayAlpha - 0.16)}) 100%)`;

  return (
    <article
      className={`relative overflow-hidden rounded-[var(--ec-radius)] border border-slate-900/10 ${sizeClasses} ${className}`}
      style={{
        background:
          banner.backgroundColor ||
          'linear-gradient(125deg, var(--ec-secondary, #1e3a8a) 0%, var(--ec-brand, #1d4ed8) 65%, #0f172a 100%)',
      }}
    >
      {showImage ? (
        <picture>
          {mobile && <source media="(max-width: 640px)" srcSet={mobile} />}
          <img
            src={desktop || mobile}
            alt={banner.title || 'Featured announcement'}
            onError={() => setImageFailed(true)}
            className="absolute inset-0 h-full w-full object-cover object-center"
            loading="lazy"
          />
        </picture>
      ) : (
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(640px 260px at 88% -12%, rgba(255, 255, 255, 0.20), transparent 62%), radial-gradient(480px 240px at 8% 115%, rgba(56, 189, 248, 0.22), transparent 60%)',
          }}
        />
      )}

      <div aria-hidden className="absolute inset-0" style={{ background: scrimDirection }} />

      <div className={`relative z-[1] flex h-full flex-col justify-end p-4 sm:p-6 lg:p-7 ${align}`}>
        {badgeText && (
          <span className="mb-2 inline-flex items-center rounded-full border border-white/25 bg-white/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-white backdrop-blur-sm">
            {badgeText}
          </span>
        )}
        {banner.title && (
          <h3
            className={`max-w-2xl font-bold tracking-tight text-white drop-shadow-sm ${
              compact ? 'text-base sm:text-lg' : 'text-lg sm:text-2xl lg:text-[26px]'
            } leading-snug`}
          >
            {banner.title}
          </h3>
        )}
        {banner.subtitle && (
          <p
            className={`mt-1 max-w-xl font-medium text-slate-100/95 ${
              compact ? 'text-xs' : 'text-xs sm:text-sm'
            }`}
          >
            {banner.subtitle}
          </p>
        )}
        {banner.description && !compact && (
          <p className="mt-1.5 max-w-lg text-xs leading-relaxed text-slate-200/85 line-clamp-2">
            {banner.description}
          </p>
        )}
        {banner.ctaLabel && banner.ctaHref && (
          <div className="mt-3.5">
            <BannerCta banner={banner} />
          </div>
        )}
      </div>
    </article>
  );
}

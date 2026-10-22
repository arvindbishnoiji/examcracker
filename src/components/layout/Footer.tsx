'use client';

import Link from 'next/link';
import { useSiteConfig } from '@/context/SiteConfigContext';
import { isSafeHttpUrl } from '@/lib/validation';
import { ArrowUpRight } from 'lucide-react';

/**
 * Night-studio footer: oversized outlined wordmark, quiet link columns and the
 * brand's real social links. Admin copy/values still drive every string.
 */
export function Footer() {
  const { config } = useSiteConfig();
  const { footer, theme } = config;
  if (!footer.show) return null;

  return (
    <footer className="ec-footer-night">
      <div className="mx-auto w-full max-w-[1240px] px-5 pb-6 pt-10 sm:px-8">
        <div className="grid gap-8 md:grid-cols-[1.5fr_repeat(3,minmax(0,1fr))]">
          <div className="min-w-0">
            <div className="flex items-center gap-2 px-1">
              <span
                className="grid h-9 w-9 place-items-center rounded-[12px] text-[0.75rem] font-black text-white"
                style={{ background: 'var(--ec-grad-aurora)' }}
              >
                {theme.logoText || 'EC'}
              </span>
              <span className="text-[0.95rem] font-extrabold tracking-[-0.02em]">{theme.brandName}</span>
            </div>
            <p className="mt-3 max-w-sm text-[0.82rem] leading-relaxed text-white/50">{footer.text}</p>
            {footer.note && <p className="mt-2 max-w-sm text-[0.72rem] leading-relaxed text-white/32">{footer.note}</p>}
            {footer.socialLinks.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {footer.socialLinks.map((link) => (
                  <a
                    key={link.id}
                    href={link.href}
                    target={isSafeHttpUrl(link.href) ? '_blank' : undefined}
                    rel={isSafeHttpUrl(link.href) ? 'noopener noreferrer' : undefined}
                    className="inline-flex items-center gap-1 rounded-full border border-white/12 px-2.5 py-1 text-[0.7rem] font-semibold text-white/60 transition hover:border-white/30 hover:text-white"
                  >
                    {link.label} <ArrowUpRight size={10} />
                  </a>
                ))}
              </div>
            )}
          </div>
          {footer.columns.map((column) => (
            <div key={column.id}>
              <p className="text-[0.62rem] font-extrabold uppercase tracking-[0.18em] text-white/35">{column.title}</p>
              <div className="mt-3 space-y-1.5">
                {column.links.map((link) => (
                  <Link
                    key={link.id}
                    href={link.href}
                    className="block text-[0.8rem] font-medium text-white/60 transition hover:text-white"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>

        <p className="ec-footer-word mt-10 select-none" aria-hidden>
          {theme.brandName.toUpperCase()}
        </p>

        <div className="hairline mt-4 flex flex-col items-center justify-between gap-2 border-t border-white/10 pt-4 text-[0.68rem] text-white/35 sm:flex-row">
          <p>{footer.copyright}</p>
          <p>Focused JEE &amp; NEET preparation · Built with care</p>
        </div>
      </div>
    </footer>
  );
}

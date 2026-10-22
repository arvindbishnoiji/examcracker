'use client';

import Link from 'next/link';
import { useSiteConfig } from '@/context/SiteConfigContext';
import { isSafeHttpUrl } from '@/lib/validation';
import { ArrowUpRight } from 'lucide-react';

export function Footer() {
  const { config } = useSiteConfig();
  const { footer, theme } = config;
  if (!footer.show) return null;

  return (
    <footer className="mt-10 border-t border-ink-100 bg-[var(--ec-surface)] text-[var(--ec-text)]">
      <div className="mx-auto w-full max-w-[1240px] px-4 pb-24 pt-8 sm:px-6 md:pb-8">
        <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-[1.5fr_repeat(3,minmax(0,1fr))]">
          <div className="min-w-0 sm:col-span-2 md:col-span-1">
            <div className="flex items-center gap-2.5">
              <span
                className="grid h-8 w-8 shrink-0 place-items-center rounded-xl text-xs font-extrabold text-white"
                style={{ background: 'var(--ec-grad-aurora)' }}
              >
                {theme.logoText || 'EC'}
              </span>
              <span className="text-sm font-extrabold tracking-tight">{theme.brandName}</span>
            </div>
            <p className="mt-2.5 max-w-sm text-xs leading-relaxed text-ink-500">{footer.text}</p>
            {footer.note ? <p className="mt-1.5 max-w-sm text-[11px] leading-relaxed text-ink-400">{footer.note}</p> : null}
            {footer.socialLinks.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {footer.socialLinks.map((link) => (
                  <a
                    key={link.id}
                    href={link.href}
                    target={isSafeHttpUrl(link.href) ? '_blank' : undefined}
                    rel={isSafeHttpUrl(link.href) ? 'noopener noreferrer' : undefined}
                    className="inline-flex items-center gap-1 rounded-full border border-ink-200 px-2.5 py-1 text-[11px] font-semibold text-ink-600 transition hover:border-brand-300 hover:text-brand-700"
                  >
                    {link.label} <ArrowUpRight size={10} />
                  </a>
                ))}
              </div>
            ) : null}
          </div>

          {footer.columns.map((column) => (
            <div key={column.id}>
              <p className="text-[10.5px] font-extrabold uppercase tracking-[0.14em] text-ink-400">{column.title}</p>
              <div className="mt-2.5 space-y-1.5">
                {column.links.map((link) => (
                  <Link
                    key={link.id}
                    href={link.href}
                    className="block text-xs font-medium text-ink-600 transition hover:text-brand-700"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 flex flex-col items-center justify-between gap-1.5 border-t border-ink-100 pt-4 text-[11px] text-ink-400 sm:flex-row">
          <p>{footer.copyright}</p>
          <p>Focused JEE &amp; NEET preparation</p>
        </div>
      </div>
    </footer>
  );
}

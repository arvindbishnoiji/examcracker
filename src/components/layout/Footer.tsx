'use client';

import Link from 'next/link';
import { useSiteConfig } from '@/context/SiteConfigContext';
import { isSafeHttpUrl } from '@/lib/validation';

export function Footer() {
  const { config } = useSiteConfig();
  const { footer, theme } = config;
  if (!footer.show) return null;

  return (
    <footer className="border-t border-ink-100 mt-10" style={{ background: 'var(--ec-surface)' }}>
      <div className="ec-main !pb-8">
        <div className="grid gap-8 md:grid-cols-[1.4fr_repeat(3,minmax(0,1fr))] py-8">
          <div>
            <div className="flex items-center gap-2">
              <div
                className="h-8 w-8 rounded-xl grid place-items-center text-sm font-bold"
                style={{ background: 'linear-gradient(135deg, var(--ec-brand), var(--ec-secondary))', color: 'var(--ec-on-brand)' }}
              >
                {theme.logoText || 'EC'}
              </div>
              <span className="font-bold">{theme.brandName}</span>
            </div>
            <p className="text-sm text-ink-500 mt-3 max-w-sm">{footer.text}</p>
            <p className="text-xs text-ink-500/80 mt-2 max-w-sm">{footer.note}</p>
            {footer.socialLinks.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-4">
                {footer.socialLinks.map((link) => (
                  <a
                    key={link.id}
                    href={link.href}
                    target={isSafeHttpUrl(link.href) ? '_blank' : undefined}
                    rel={isSafeHttpUrl(link.href) ? 'noopener noreferrer' : undefined}
                    className="text-xs px-2.5 py-1 rounded-full border border-ink-200 text-ink-600 hover:bg-ink-50"
                  >
                    {link.label}
                  </a>
                ))}
              </div>
            )}
          </div>
          {footer.columns.map((column) => (
            <div key={column.id}>
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-ink-500">{column.title}</p>
              <div className="mt-3 space-y-2">
                {column.links.map((link) => (
                  <Link
                    key={link.id}
                    href={link.href}
                    className="block text-sm text-ink-600 hover:text-brand-600"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="border-t border-ink-100 pt-4 flex flex-col sm:flex-row gap-2 items-center justify-between text-xs text-ink-500">
          <p>{footer.copyright}</p>
          <p>Made for focused JEE &amp; NEET preparation.</p>
        </div>
      </div>
    </footer>
  );
}

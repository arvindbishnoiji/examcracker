'use client';

import Link from 'next/link';
import { ArrowUpRight, Check, ShieldCheck } from 'lucide-react';
import type { LoginConfig, Testimonial, ThemeConfig } from '@/types';
import { isSafeHttpUrl } from '@/lib/validation';

/**
 * Classic sign-in / sign-up screen.
 *
 * A plain light page with a white top bar and one bordered card. In the split
 * layout the card has a solid brand-colour panel on the left (readable white
 * type, optional photo with a dark scrim) and the form on the right. Colours
 * follow the theme brand colour from Appearance.
 */
function asideStyle(login: LoginConfig): React.CSSProperties {
  if (login.backgroundType === 'image' && isSafeHttpUrl(login.backgroundImageUrl)) {
    return {
      backgroundImage: `linear-gradient(180deg, rgba(10,14,28,0.78), rgba(10,14,28,0.9)), url(${login.backgroundImageUrl})`,
    };
  }
  if (isSafeHttpUrl(login.heroImageUrl)) {
    return {
      backgroundImage: `linear-gradient(180deg, rgba(10,14,28,0.78), rgba(10,14,28,0.9)), url(${login.heroImageUrl})`,
    };
  }
  return {};
}

const CARD_WIDTH: Record<LoginConfig['cardWidth'], string> = {
  compact: 'max-w-sm',
  standard: 'max-w-[420px]',
  wide: 'max-w-lg',
};

function BrandMark({ login, theme }: { login: LoginConfig; theme: ThemeConfig }) {
  const logo = login.logoUrl || theme.logoUrl;
  return (
    <Link href="/login" className="flex items-center gap-2.5">
      {isSafeHttpUrl(logo) ? (
        <img src={logo} alt={theme.brandName} className="h-9 w-9 rounded-lg object-cover" />
      ) : (
        <span
          className="grid h-9 w-9 place-items-center rounded-lg text-[0.78rem] font-extrabold"
          style={{ background: 'var(--ec-brand)', color: 'var(--ec-on-brand)' }}
        >
          {theme.logoText || 'EC'}
        </span>
      )}
      <span className="min-w-0">
        <span className="block truncate text-[0.98rem] font-extrabold leading-tight text-gray-900">{theme.brandName}</span>
        {theme.tagline && <span className="hidden truncate text-[0.68rem] text-gray-500 sm:block">{theme.tagline}</span>}
      </span>
    </Link>
  );
}

function Highlights({ login }: { login: LoginConfig }) {
  const highlights = login.highlights.length
    ? login.highlights.slice(0, 5)
    : ['Chapter-wise lectures', 'Timed mock tests', 'Honest progress tracking', 'Mentor doubt support'];
  return (
    <ul className="mt-7 space-y-3">
      {highlights.map((highlight) => (
        <li key={highlight} className="flex items-start gap-2.5 text-[0.9rem] leading-snug text-white/90">
          <span className="ecc-auth-check mt-0.5">
            <Check size={12} strokeWidth={3} />
          </span>
          {highlight}
        </li>
      ))}
    </ul>
  );
}

function Aside({ login, theme, testimonials }: { login: LoginConfig; theme: ThemeConfig; testimonials: Testimonial[] }) {
  const quote = login.showTestimonials ? testimonials[0] : undefined;
  return (
    <aside className="ecc-auth-aside" style={asideStyle(login)}>
      <p className="text-[0.72rem] font-bold uppercase tracking-[0.14em] text-white/75">JEE · NEET · Class 11, 12 &amp; Droppers</p>
      <h1 className="mt-3">{login.heroTitle || 'Crack JEE & NEET with focused lectures and real tests'}</h1>
      <p className="mt-4 text-[0.95rem] leading-relaxed">
        {login.heroSubtitle ||
          'A personalised dashboard, chapter-wise lectures, timed tests and honest progress tracking — filtered for your exam and class.'}
      </p>
      <Highlights login={login} />
      {quote ? (
        <figure className="ecc-auth-quote mt-10">
          <blockquote className="text-[0.9rem] leading-relaxed text-white/90">“{quote.quote}”</blockquote>
          <figcaption className="mt-3 flex items-center gap-2.5">
            {isSafeHttpUrl(quote.avatarUrl) ? (
              <img src={quote.avatarUrl} alt="" className="h-8 w-8 rounded-full object-cover" />
            ) : (
              <span className="grid h-8 w-8 place-items-center rounded-full bg-white/20 text-[0.75rem] font-bold">{quote.name.slice(0, 1)}</span>
            )}
            <span className="text-[0.82rem] font-semibold">
              {quote.name}
              {quote.result && <span className="font-normal text-white/70"> · {quote.result}</span>}
            </span>
          </figcaption>
        </figure>
      ) : (
        <p className="ecc-auth-quote mt-10 text-[0.78rem] text-white/70">{theme.brandName} · built for serious preparation</p>
      )}
    </aside>
  );
}

export function LoginShell({
  login,
  theme,
  testimonials,
  children,
  preview = false,
}: {
  login: LoginConfig;
  theme: ThemeConfig;
  testimonials: Testimonial[];
  children: React.ReactNode;
  preview?: boolean;
}) {
  const split = login.layout === 'split';
  const showMobileHeading = login.mobileImagePosition !== 'hidden';

  const form = (
    <div className="ecc-auth-form">
      <div className={`mx-auto w-full ${CARD_WIDTH[login.cardWidth]}`}>
        {split && showMobileHeading && (
          <p className="mb-4 text-[0.82rem] font-semibold leading-snug lg:hidden" style={{ color: 'var(--ec-brand)' }}>
            {login.heroTitle}
          </p>
        )}
        <h2 className="text-[1.6rem] font-extrabold leading-tight tracking-[-0.02em] text-gray-900">{login.title}</h2>
        {login.subtitle && <p className="mt-1.5 text-[0.92rem] text-gray-600">{login.subtitle}</p>}
        {login.welcomeMessage && <p className="mt-1 text-[0.82rem] text-gray-500">{login.welcomeMessage}</p>}

        <div className="mt-6">{children}</div>

        {login.bannerEnabled && (login.bannerTitle || login.bannerBody) && (
          <div className="mt-6 rounded-lg border border-gray-200 bg-gray-50 p-3.5">
            {login.bannerTitle && <p className="text-[0.8rem] font-bold text-gray-900">{login.bannerTitle}</p>}
            {login.bannerBody && <p className="mt-1 text-[0.76rem] leading-relaxed text-gray-600">{login.bannerBody}</p>}
            {login.bannerCtaLabel && login.bannerCtaHref && (
              <Link href={login.bannerCtaHref} className="mt-2 inline-flex items-center gap-1 text-[0.76rem] font-bold underline" style={{ color: 'var(--ec-brand)' }}>
                {login.bannerCtaLabel} <ArrowUpRight size={12} />
              </Link>
            )}
          </div>
        )}

        <p className="mt-6 flex items-center justify-center gap-1.5 text-[0.7rem] text-gray-500">
          <ShieldCheck size={13} /> Secured by Firebase Authentication
        </p>
      </div>
    </div>
  );

  return (
    <div className={`ecc-auth ${preview ? '!min-h-[680px]' : ''}`}>
      <header className="ecc-auth-top">
        <div className="mx-auto flex h-16 w-full max-w-[1100px] items-center justify-between gap-3 px-4 sm:px-6">
          <BrandMark login={login} theme={theme} />
          <Link
            href={login.termsUrl || '/login'}
            className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-md border border-gray-300 px-3 py-1.5 text-[0.78rem] font-semibold text-gray-700 hover:bg-gray-50"
          >
            Need help? <ArrowUpRight size={13} />
          </Link>
        </div>
      </header>

      <main className="flex flex-1 items-center px-4 py-8 sm:px-6 sm:py-12">
        <div className="ecc-auth-frame" data-split={split ? 'true' : 'false'} style={split ? undefined : { maxWidth: 520 }}>
          {split && (
            <div className="hidden lg:flex">
              <Aside login={login} theme={theme} testimonials={testimonials} />
            </div>
          )}
          {form}
        </div>
      </main>

      <footer className="border-t border-gray-200 bg-white">
        <div className="mx-auto flex w-full max-w-[1100px] flex-col items-center justify-between gap-2 px-4 py-4 text-[0.74rem] text-gray-500 sm:flex-row sm:px-6">
          <p className="text-center sm:text-left">{login.footerText || `${theme.brandName} — focused JEE & NEET preparation.`}</p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            {login.footerLinks.map((link) => (
              <Link key={link.id} href={link.href} className="hover:text-gray-900 hover:underline">
                {link.label}
              </Link>
            ))}
            {login.termsUrl && (
              <Link href={login.termsUrl} className="hover:text-gray-900 hover:underline">
                Terms
              </Link>
            )}
            {login.privacyUrl && (
              <Link href={login.privacyUrl} className="hover:text-gray-900 hover:underline">
                Privacy
              </Link>
            )}
            <span>© {new Date().getFullYear()} {theme.brandName}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export function LoginFormPreview({ login }: { login: LoginConfig }) {
  return (
    <div className="space-y-3">
      <div>
        <label className="mb-1.5 block text-xs font-semibold text-ink-700">{login.emailLabel}</label>
        <div className="ec-field text-ink-400">you@example.com</div>
        {login.emailHelp && <p className="mt-1 text-[10px] text-ink-500">{login.emailHelp}</p>}
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-semibold text-ink-700">{login.passwordLabel}</label>
        <div className="ec-field text-ink-400">••••••••</div>
        {login.passwordHelp && <p className="mt-1 text-[10px] text-ink-500">{login.passwordHelp}</p>}
      </div>
      <div
        className="w-full py-2.5 text-center text-xs font-bold"
        style={{ background: 'var(--ec-brand)', color: 'var(--ec-on-brand)', borderRadius: 'var(--ec-button-radius)' }}
      >
        Sign in
      </div>
      {login.showGoogle && (
        <div className="w-full rounded-[var(--ec-button-radius)] border border-ink-200 bg-[var(--ec-surface)] py-2.5 text-center text-xs font-semibold">
          Continue with Google
        </div>
      )}
      <div className="flex items-center justify-between text-[11px] text-ink-500">
        <span>{login.forgotPasswordText}</span>
        {login.showSignup && <span>Create account</span>}
      </div>
    </div>
  );
}

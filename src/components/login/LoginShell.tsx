'use client';

import Link from 'next/link';
import { ArrowUpRight, Check, Sparkles } from 'lucide-react';
import type { LoginConfig, Testimonial, ThemeConfig } from '@/types';
import { isSafeHttpUrl } from '@/lib/validation';

/**
 * The sign-in screen is always a night canvas so the white type stays legible.
 * The admin's stored background choice is honoured as a *treatment* on top of
 * it (photo with a dark scrim, solid wash, or gradient orbs) rather than by
 * replacing the canvas with a light colour.
 */
function backgroundFor(login: LoginConfig): React.CSSProperties {
  if (login.backgroundType === 'image' && isSafeHttpUrl(login.backgroundImageUrl)) {
    return {
      backgroundImage: `linear-gradient(180deg, rgba(7,5,15,0.86), rgba(7,5,15,0.94)), url(${login.backgroundImageUrl})`,
      backgroundSize: 'cover, cover',
      backgroundPosition: 'center, center',
    };
  }
  if (login.backgroundType === 'solid') {
    return {
      backgroundImage: `radial-gradient(80% 60% at 20% 0%, ${login.backgroundColor}55, transparent 70%)`,
    };
  }
  return {
    backgroundImage: `radial-gradient(70% 55% at 15% 0%, ${login.gradientFrom}66, transparent 68%), radial-gradient(60% 50% at 88% 8%, ${login.gradientTo}55, transparent 70%)`,
  };
}

const CARD_WIDTH: Record<LoginConfig['cardWidth'], string> = {
  compact: 'max-w-sm',
  standard: 'max-w-[440px]',
  wide: 'max-w-xl',
};

const TICKER = [
  'Chapter-wise lectures',
  'Timed mock tests',
  'Rank leaderboards',
  'Doubt sessions',
  'Streaks & rewards',
  'Progress analytics',
  'PDF notes',
  'JEE · NEET',
  'Class 11 · 12 · Dropper',
];

function BrandMark({ login, theme, compact = false }: { login: LoginConfig; theme: ThemeConfig; compact?: boolean }) {
  const logo = login.logoUrl || theme.logoUrl;
  return (
    <div className="flex items-center gap-2.5">
      {isSafeHttpUrl(logo) ? (
        <img src={logo} alt={theme.brandName} className={`${compact ? 'h-9 w-9' : 'h-10 w-10'} rounded-[13px] object-cover`} />
      ) : (
        <span
          className={`${compact ? 'h-9 w-9' : 'h-10 w-10'} grid place-items-center rounded-[13px] text-[0.8rem] font-black shadow-lg`}
          style={{ background: 'var(--ec-grad-aurora)', color: '#fff' }}
        >
          {theme.logoText || 'EC'}
        </span>
      )}
      <div className="min-w-0">
        <p className="truncate font-extrabold leading-tight tracking-[-0.02em]">{theme.brandName}</p>
        <p className="truncate text-[0.6rem] uppercase tracking-[0.16em] text-white/45">{theme.tagline}</p>
      </div>
    </div>
  );
}

/** Paints the final phrase of the headline with the hot gradient. */
function Headline({ text }: { text: string }) {
  const words = text.split(' ').filter(Boolean);
  if (words.length < 3) return <span className="ec-gradient-hot">{text}</span>;
  const tailCount = Math.min(3, Math.max(2, Math.round(words.length * 0.34)));
  const head = words.slice(0, words.length - tailCount).join(' ');
  const tail = words.slice(words.length - tailCount).join(' ');
  return (
    <>
      {head} <span className="ec-gradient-hot">{tail}</span>
    </>
  );
}

function ProofRow({ login }: { login: LoginConfig }) {
  const highlights = login.highlights.length
    ? login.highlights.slice(0, 4)
    : ['Chapter-wise lectures', 'Timed mock tests', 'Honest progress tracking', 'Mentor doubt support'];
  return (
    <ul className="mt-5 grid gap-2 sm:grid-cols-2">
      {highlights.map((highlight) => (
        <li
          key={highlight}
          className="flex items-start gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-[0.78rem] leading-snug text-white/78"
        >
          <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-[var(--dx-lime)]/20 text-[var(--dx-lime)]">
            <Check size={10} strokeWidth={3} />
          </span>
          {highlight}
        </li>
      ))}
    </ul>
  );
}

function HeroCopy({
  login,
  theme,
  testimonials,
}: {
  login: LoginConfig;
  theme: ThemeConfig;
  testimonials: Testimonial[];
}) {
  return (
    <div className="relative">
      <span className="dx-pill">
        <span className="dx-live-dot" /> JEE · NEET · Class 11, 12 &amp; Droppers
      </span>
      <h1 className="ec-kinetic mt-5 max-w-[15ch] sm:max-w-[18ch]">
        <Headline text={login.heroTitle || 'Crack JEE & NEET with a plan that actually runs'} />
      </h1>
      <p className="mt-4 max-w-xl text-[0.94rem] leading-relaxed text-white/62">
        {login.heroSubtitle ||
          'A focused dashboard, chapter-wise lectures, timed tests and honest progress tracking — filtered for your exam and class.'}
      </p>
      <ProofRow login={login} />

      {login.showTestimonials && testimonials.length > 0 && (
        <div className="mt-6 grid gap-2.5 sm:grid-cols-2">
          {testimonials.slice(0, 2).map((testimonial) => (
            <figure key={testimonial.id} className="dx-glass-dark rounded-2xl p-3.5">
              <blockquote className="line-clamp-3 text-[0.78rem] leading-relaxed text-white/72">
                “{testimonial.quote}”
              </blockquote>
              <figcaption className="mt-2.5 flex items-center gap-2">
                {isSafeHttpUrl(testimonial.avatarUrl) ? (
                  <img src={testimonial.avatarUrl} alt="" className="h-6 w-6 rounded-full object-cover" />
                ) : (
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-white/12 text-[0.6rem] font-bold text-white">
                    {testimonial.name.slice(0, 1)}
                  </span>
                )}
                <span className="text-[0.72rem] font-bold text-white/90">{testimonial.name}</span>
                {testimonial.result && <span className="text-[0.66rem] text-white/45">· {testimonial.result}</span>}
              </figcaption>
            </figure>
          ))}
        </div>
      )}
      <p className="mt-5 flex items-center gap-1.5 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-white/35">
        <Sparkles size={12} className="text-[var(--dx-lime)]" /> {theme.brandName} · built for serious preparation
      </p>
    </div>
  );
}

function Ticker() {
  const items = [...TICKER, ...TICKER];
  return (
    <div className="ec-ticker mt-8">
      <div className="ec-ticker-track">
        {items.map((item, index) => (
          <span key={`${item}-${index}`}>{item}</span>
        ))}
      </div>
    </div>
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
  const cardBody = (
    <div className={`w-full ${CARD_WIDTH[login.cardWidth]}`}>
      <div className="flex items-center justify-between gap-3">
        <BrandMark login={login} theme={theme} compact />
        <span className="hidden rounded-full border border-white/12 px-2.5 py-1 text-[0.6rem] font-bold uppercase tracking-[0.14em] text-white/45 sm:inline-flex">
          Secure
        </span>
      </div>

      <p className="mt-6 text-[0.66rem] font-extrabold uppercase tracking-[0.2em] text-brand-700">
        {login.title}
      </p>
      <h2 className="mt-1.5 text-[1.55rem] font-extrabold leading-[1.12] tracking-[-0.03em] text-ink-900">
        {login.subtitle}
      </h2>
      {login.welcomeMessage && (
        <p className="mt-2 text-[0.82rem] leading-relaxed text-ink-600">{login.welcomeMessage}</p>
      )}

      <div className="mt-5">{children}</div>

      {login.bannerEnabled && (login.bannerTitle || login.bannerBody) && (
        <div className="mt-5 rounded-2xl border border-[var(--dx-lime)]/30 bg-[var(--dx-lime)]/[0.08] p-3.5">
          {login.bannerTitle && (
            <p className="text-[0.76rem] font-extrabold text-brand-700">{login.bannerTitle}</p>
          )}
          {login.bannerBody && (
            <p className="mt-1 text-[0.72rem] leading-relaxed text-ink-700">{login.bannerBody}</p>
          )}
          {login.bannerCtaLabel && login.bannerCtaHref && (
            <Link
              href={login.bannerCtaHref}
              className="mt-2 inline-flex items-center gap-1 text-[0.72rem] font-bold text-brand-700 underline"
            >
              {login.bannerCtaLabel} <ArrowUpRight size={11} />
            </Link>
          )}
        </div>
      )}

      {login.footerText && (
        <p className="mt-5 text-center text-[0.68rem] leading-relaxed text-ink-500">{login.footerText}</p>
      )}
      {(login.footerLinks.length > 0 || login.termsUrl || login.privacyUrl) && (
        <div className="mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[0.68rem] text-ink-500">
          {login.footerLinks.map((link) => (
            <Link key={link.id} href={link.href} className="hover:text-white">
              {link.label}
            </Link>
          ))}
          {login.termsUrl && (
            <Link href={login.termsUrl} className="hover:text-white">
              Terms
            </Link>
          )}
          {login.privacyUrl && (
            <Link href={login.privacyUrl} className="hover:text-white">
              Privacy
            </Link>
          )}
        </div>
      )}
      <p className="mt-2 text-center text-[0.62rem] text-ink-400">
        {theme.brandName} · Secured by Firebase Authentication
      </p>
    </div>
  );

  const showHeroColumn = login.layout === 'split' && login.mobileImagePosition !== 'hidden';

  return (
    <div className={`ec-night ${preview ? 'min-h-[680px]' : 'ec-auth-shell'}`} style={preview ? undefined : backgroundFor(login)}>
      <div
        className={`relative mx-auto flex w-full max-w-[1280px] flex-col px-4 pb-8 sm:px-6 lg:px-8 ${
          preview ? 'py-6' : 'min-h-[100svh] pt-6'
        }`}
      >
        <div className="flex items-center justify-between gap-3">
          <BrandMark login={login} theme={theme} />
          <div className="flex items-center gap-2">
            <Link href="/login" className="dx-pill hidden sm:inline-flex">
              <span className="dx-live-dot" /> Live batches open
            </Link>
            <Link href={login.termsUrl || '/login'} className="dx-cta-ghost !px-3.5 !py-2 !text-[0.72rem]">
              Need help? <ArrowUpRight size={13} />
            </Link>
          </div>
        </div>

        {login.layout === 'centered' || login.layout === 'hero' ? (
          <div className="flex flex-1 flex-col items-center justify-center py-8 text-center">
            <span className="dx-pill">
              <span className="dx-live-dot" /> JEE · NEET · Class 11, 12 &amp; Droppers
            </span>
            <h1 className="ec-kinetic mt-4 max-w-[22ch] text-center">
              <Headline text={login.heroTitle} />
            </h1>
            <p className="mt-3 max-w-xl text-[0.9rem] leading-relaxed text-white/60">{login.heroSubtitle}</p>
            <div className="ec-auth-card mt-6 w-full max-w-lg p-5 text-left sm:p-7">{cardBody}</div>
            {login.showTestimonials && testimonials.length > 0 && (
              <div className="mt-5 grid w-full max-w-2xl gap-2.5 sm:grid-cols-2">
                {testimonials.slice(0, 2).map((testimonial) => (
                  <figure key={testimonial.id} className="dx-glass-dark rounded-2xl p-3.5 text-left">
                    <blockquote className="text-[0.76rem] leading-relaxed text-white/70">“{testimonial.quote}”</blockquote>
                    <figcaption className="mt-2 text-[0.68rem] font-bold text-white/85">{testimonial.name}</figcaption>
                  </figure>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="grid flex-1 items-center gap-8 py-8 lg:grid-cols-[1.06fr_0.94fr] lg:gap-12">
            <div className={showHeroColumn ? 'hidden lg:block' : 'hidden'}>
              <HeroCopy login={login} theme={theme} testimonials={testimonials} />
            </div>
            <div className="flex w-full justify-center lg:justify-end">
              <div className="ec-auth-card w-full max-w-[470px] p-5 sm:p-7">
                <div className="mb-4 lg:hidden">
                  <h1 className="text-[1.35rem] font-extrabold leading-[1.15] tracking-[-0.03em] text-white">
                    <Headline text={login.heroTitle} />
                  </h1>
                </div>
                {cardBody}
              </div>
            </div>
          </div>
        )}

        <Ticker />
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-[0.66rem] text-white/35">
          <p>{login.footerText || `${theme.brandName} — focused JEE & NEET preparation.`}</p>
          <p>© {new Date().getFullYear()} {theme.brandName}</p>
        </div>
      </div>
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

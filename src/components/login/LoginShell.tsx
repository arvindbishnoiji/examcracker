'use client';

import Link from 'next/link';
import type { LoginConfig, Testimonial, ThemeConfig } from '@/types';
import { isSafeHttpUrl } from '@/lib/validation';

function backgroundFor(login: LoginConfig): React.CSSProperties {
  if (login.backgroundType === 'solid') return { background: login.backgroundColor };
  if (login.backgroundType === 'image' && isSafeHttpUrl(login.backgroundImageUrl)) {
    return {
      backgroundImage: `url(${login.backgroundImageUrl})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
    };
  }
  return { background: `linear-gradient(135deg, ${login.gradientFrom}, ${login.gradientTo})` };
}

const CARD_WIDTH: Record<LoginConfig['cardWidth'], string> = {
  compact: 'max-w-sm',
  standard: 'max-w-md',
  wide: 'max-w-xl',
};

function BrandMark({ login, theme, compact = false }: { login: LoginConfig; theme: ThemeConfig; compact?: boolean }) {
  const logo = login.logoUrl || theme.logoUrl;
  return (
    <div className="flex items-center gap-2.5">
      {isSafeHttpUrl(logo) ? (
        <img src={logo} alt={theme.brandName} className={`${compact ? 'h-9 w-9' : 'h-10 w-10'} rounded-xl object-cover`} />
      ) : (
        <span
          className={`${compact ? 'h-9 w-9' : 'h-10 w-10'} rounded-xl grid place-items-center text-sm font-extrabold shadow-sm`}
          style={{ background: 'linear-gradient(135deg, var(--ec-brand), var(--ec-secondary))', color: 'var(--ec-on-brand)' }}
        >
          {theme.logoText || 'EC'}
        </span>
      )}
      <div className="min-w-0">
        <p className="font-bold leading-tight truncate">{theme.brandName}</p>
        <p className="text-[10px] uppercase tracking-[0.12em] opacity-60 truncate">{theme.tagline}</p>
      </div>
    </div>
  );
}

function HeroPanel({
  login,
  theme,
  testimonials,
  compact = false,
}: {
  login: LoginConfig;
  theme: ThemeConfig;
  testimonials: Testimonial[];
  compact?: boolean;
}) {
  const hasImage = isSafeHttpUrl(login.heroImageUrl);
  return (
    <div className="relative h-full overflow-hidden rounded-[var(--ec-radius-lg)] border border-ink-100 bg-[var(--ec-surface)]">
      {hasImage && (
        <img
          src={login.heroImageUrl}
          alt=""
          className={`absolute inset-0 h-full w-full object-cover ${compact ? 'opacity-25' : 'opacity-30'}`}
        />
      )}
      <div
        className="absolute inset-0"
        style={{
          background: hasImage
            ? 'linear-gradient(180deg, color-mix(in srgb, var(--ec-surface) 40%, transparent), var(--ec-surface) 92%)'
            : 'radial-gradient(700px 320px at 90% 0%, rgb(var(--ec-brand-200) / 0.55), transparent 60%)',
        }}
      />
      <div className={`relative p-6 ${compact ? 'sm:p-7' : 'sm:p-10 lg:p-12'} flex flex-col h-full`}>
        <BrandMark login={login} theme={theme} />
        <div className="mt-8 sm:mt-12 max-w-xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-brand-100 bg-brand-50 px-3 py-1 text-[11px] font-semibold text-brand-700">
            🎯 JEE &amp; NEET · Class 11 &amp; 12
          </span>
          <h1 className={`${compact ? 'text-2xl' : 'text-3xl sm:text-[38px]'} leading-[1.1] mt-4`}>{login.heroTitle}</h1>
          <p className="text-sm text-ink-500 leading-relaxed mt-3 max-w-lg">{login.heroSubtitle}</p>
          <ul className="mt-5 space-y-2">
            {login.highlights.map((highlight) => (
              <li key={highlight} className="flex items-start gap-2 text-[13px] text-ink-600">
                <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[9px] text-emerald-700">
                  ✓
                </span>
                <span>{highlight}</span>
              </li>
            ))}
          </ul>
        </div>

        {login.showTestimonials && testimonials.length > 0 && !compact && (
          <div className="mt-auto pt-8 grid sm:grid-cols-2 gap-3">
            {testimonials.slice(0, 2).map((testimonial) => (
              <figure key={testimonial.id} className="rounded-2xl border border-ink-100 bg-[var(--ec-surface)]/90 p-4 backdrop-blur">
                <blockquote className="text-[12px] text-ink-600 leading-relaxed">“{testimonial.quote}”</blockquote>
                <figcaption className="mt-2 flex items-center gap-2">
                  {testimonial.avatarUrl && isSafeHttpUrl(testimonial.avatarUrl) ? (
                    <img src={testimonial.avatarUrl} alt="" className="h-6 w-6 rounded-full object-cover" />
                  ) : (
                    <span className="h-6 w-6 rounded-full bg-brand-100 text-brand-700 grid place-items-center text-[10px] font-bold">
                      {testimonial.name.slice(0, 1)}
                    </span>
                  )}
                  <span className="text-[11px] font-semibold">{testimonial.name}</span>
                  {testimonial.result && <span className="text-[10px] text-ink-500">· {testimonial.result}</span>}
                </figcaption>
              </figure>
            ))}
          </div>
        )}
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
  const alignment =
    login.cardAlign === 'left' ? 'items-start' : login.cardAlign === 'right' ? 'items-end' : 'items-center';
  const mobileHero =
    login.mobileImagePosition === 'hidden' ? 'hidden sm:block' : login.mobileImagePosition === 'background' ? 'hidden' : '';
  const card = (
    <div className={`w-full ${CARD_WIDTH[login.cardWidth]}`}>
      <BrandMark login={login} theme={theme} compact />
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-brand-600 mt-6">{login.title}</p>
      <h2 className="text-2xl sm:text-[26px] leading-tight mt-1">{login.subtitle}</h2>
      {login.welcomeMessage && <p className="text-sm text-ink-500 mt-2">{login.welcomeMessage}</p>}
      <div className="mt-5">{children}</div>
      {login.bannerEnabled && (login.bannerTitle || login.bannerBody) && (
        <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50/80 p-3.5">
          {login.bannerTitle && <p className="text-xs font-bold text-amber-900">{login.bannerTitle}</p>}
          {login.bannerBody && <p className="text-[11px] text-amber-800 mt-1 leading-relaxed">{login.bannerBody}</p>}
          {login.bannerCtaLabel && login.bannerCtaHref && (
            <Link href={login.bannerCtaHref} className="inline-flex mt-2 text-[11px] font-bold text-amber-900 underline">
              {login.bannerCtaLabel}
            </Link>
          )}
        </div>
      )}
      {login.footerText && <p className="text-[11px] text-ink-500 text-center mt-5 leading-relaxed">{login.footerText}</p>}
      {(login.footerLinks.length > 0 || login.termsUrl || login.privacyUrl) && (
        <div className="mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px] text-ink-500">
          {login.footerLinks.map((link) => (
            <Link key={link.id} href={link.href} className="hover:text-brand-600">
              {link.label}
            </Link>
          ))}
          {login.termsUrl && <Link href={login.termsUrl} className="hover:text-brand-600">Terms</Link>}
          {login.privacyUrl && <Link href={login.privacyUrl} className="hover:text-brand-600">Privacy</Link>}
        </div>
      )}
      <p className="text-[10px] text-ink-400 text-center mt-2">
        {theme.brandName} · Secured by Firebase Authentication
      </p>
    </div>
  );

  return (
    <div className={`relative overflow-hidden ${preview ? 'min-h-[620px]' : 'min-h-screen'}`} style={backgroundFor(login)}>
      {login.backgroundType === 'image' && <div className="absolute inset-0 bg-black/10" />}
      {login.layout === 'split' && (
        <div className={`relative mx-auto max-w-6xl px-4 py-5 sm:py-8 ${preview ? 'min-h-0' : 'min-h-screen'}`}>
          <div className="grid lg:grid-cols-[1.05fr_0.95fr] gap-6 lg:gap-8 items-stretch">
            <div className={mobileHero}>
              <HeroPanel login={login} theme={theme} testimonials={testimonials} />
            </div>
            <div className={`flex ${alignment} justify-center py-4 sm:py-8`}>
              <div className="ec-card w-full max-w-lg p-5 sm:p-7">{card}</div>
            </div>
          </div>
        </div>
      )}

      {login.layout === 'centered' && (
        <div className={`relative mx-auto flex ${preview ? 'min-h-[620px]' : 'min-h-screen'} max-w-5xl flex-col items-center justify-center px-4 py-10`}>
          <div className="w-full max-w-xl text-center mb-6">
            <div className="flex justify-center">
              <BrandMark login={login} theme={theme} />
            </div>
            <h1 className="text-2xl sm:text-3xl mt-5 max-w-2xl mx-auto">{login.heroTitle}</h1>
            <p className="text-sm text-ink-500 mt-2 max-w-xl mx-auto">{login.heroSubtitle}</p>
          </div>
          <div className={`w-full ${CARD_WIDTH[login.cardWidth]} ec-card p-5 sm:p-7`}>{card}</div>
          {login.showTestimonials && testimonials.length > 0 && (
            <div className="grid sm:grid-cols-2 gap-3 mt-6 max-w-2xl w-full">
              {testimonials.slice(0, 2).map((testimonial) => (
                <figure key={testimonial.id} className="ec-card p-4">
                  <blockquote className="text-[12px] text-ink-600 leading-relaxed">“{testimonial.quote}”</blockquote>
                  <figcaption className="text-[11px] font-semibold mt-2">{testimonial.name}</figcaption>
                </figure>
              ))}
            </div>
          )}
        </div>
      )}

      {login.layout === 'hero' && (
        <div className={`relative ${preview ? 'min-h-[620px]' : 'min-h-screen'}`}>
          {isSafeHttpUrl(login.heroImageUrl) && (
            <img src={login.heroImageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-black/25 to-black/60" />
          <div className={`relative mx-auto max-w-6xl px-4 py-8 ${preview ? 'min-h-[620px]' : 'min-h-screen'} grid lg:grid-cols-[1.1fr_0.9fr] gap-8 items-center`}>
            <div className="hidden lg:block text-white drop-shadow">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] opacity-80">JEE · NEET · Class 11 &amp; 12</p>
              <h1 className="text-4xl leading-[1.08] mt-3 max-w-xl text-white">{login.heroTitle}</h1>
              <p className="text-sm text-white/85 mt-3 max-w-lg">{login.heroSubtitle}</p>
              <ul className="mt-5 space-y-2">
                {login.highlights.map((highlight) => (
                  <li key={highlight} className="text-[13px] text-white/90 flex items-start gap-2">
                    <span className="text-emerald-300">✓</span>
                    {highlight}
                  </li>
                ))}
              </ul>
            </div>
            <div className={`flex ${alignment} justify-center`}>
              <div className="ec-card w-full max-w-lg p-5 sm:p-7">{card}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function LoginFormPreview({ login }: { login: LoginConfig }) {
  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-semibold text-ink-700 mb-1.5">{login.emailLabel}</label>
        <div className="ec-field text-ink-400">you@example.com</div>
        {login.emailHelp && <p className="text-[10px] text-ink-500 mt-1">{login.emailHelp}</p>}
      </div>
      <div>
        <label className="block text-xs font-semibold text-ink-700 mb-1.5">{login.passwordLabel}</label>
        <div className="ec-field text-ink-400">••••••••</div>
        {login.passwordHelp && <p className="text-[10px] text-ink-500 mt-1">{login.passwordHelp}</p>}
      </div>
      <div
        className="w-full text-center text-xs font-bold py-2.5"
        style={{ background: 'var(--ec-brand)', color: 'var(--ec-on-brand)', borderRadius: 'var(--ec-button-radius)' }}
      >
        Sign in
      </div>
      {login.showGoogle && (
        <div className="w-full text-center text-xs font-semibold py-2.5 border border-ink-200 bg-[var(--ec-surface)] rounded-[var(--ec-button-radius)]">
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

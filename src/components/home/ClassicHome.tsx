'use client';

/**
 * Classic home-screen building blocks.
 *
 * Shared by the live student home (`/home`) and the admin Home Page Builder's
 * live preview so what the admin sees is exactly what students get.
 */

import Link from 'next/link';
import { ArrowRight, BookOpenCheck, GraduationCap, PlayCircle } from 'lucide-react';
import type { FeatureFlags, HomeHeroConfig, HomeSectionConfig, HomeSectionItem } from '@/types';
import { isSafeHttpUrl, isValidInternalDeepLink } from '@/lib/validation';

export interface HeroTokens {
  name: string;
  exam: string;
  classLabel: string;
}

/** Replaces {name}, {exam} and {class} in admin-authored copy. */
export function fillTokens(text: string, tokens: HeroTokens): string {
  return (text || '')
    .replace(/\{name\}/g, tokens.name)
    .replace(/\{exam\}/g, tokens.exam)
    .replace(/\{class\}/g, tokens.classLabel);
}

/** Internal links use next/link; https links open in a new tab; anything else is dropped. */
export function SmartLink({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: React.ReactNode;
}) {
  if (isValidInternalDeepLink(href)) {
    return (
      <Link href={href} className={className}>
        {children}
      </Link>
    );
  }
  if (isSafeHttpUrl(href)) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
        {children}
      </a>
    );
  }
  return <span className={className}>{children}</span>;
}

export function isUsableHref(href: string | undefined | null): href is string {
  return Boolean(href) && (isValidInternalDeepLink(href as string) || isSafeHttpUrl(href as string));
}

export interface HeroAction {
  label: string;
  href: string;
}

export function heroStyleVars(hero: HomeHeroConfig): React.CSSProperties {
  const vars: Record<string, string> = {};
  if (hero.backgroundColor) vars['--ecc-hero-bg'] = hero.backgroundColor;
  if (hero.backgroundColor && hero.style === 'classic') vars['--ecc-hero-fg'] = '#ffffff';
  const style: React.CSSProperties = vars as React.CSSProperties;
  if (hero.style === 'image' && isSafeHttpUrl(hero.imageUrl)) {
    style.backgroundImage = `linear-gradient(100deg, rgba(10,14,28,0.86) 0%, rgba(10,14,28,0.6) 55%, rgba(10,14,28,0.35) 100%), url(${hero.imageUrl})`;
  }
  return style;
}

export function HomeHero({
  hero,
  tokens,
  greeting,
  primary,
  secondary,
  chips,
  aside,
}: {
  hero: HomeHeroConfig;
  tokens: HeroTokens;
  greeting?: string;
  primary: HeroAction;
  secondary?: HeroAction | null;
  chips?: React.ReactNode;
  aside?: React.ReactNode;
}) {
  const style = hero.style === 'image' && !isSafeHttpUrl(hero.imageUrl) ? 'classic' : hero.style;
  const sideImage = style !== 'image' && isSafeHttpUrl(hero.imageUrl) ? hero.imageUrl : '';
  const asideContent = aside || (sideImage ? <img src={sideImage} alt="" className="ecc-hero-image" loading="lazy" /> : null);
  const eyebrow = fillTokens(hero.eyebrow, tokens);
  return (
    <section className="ecc-hero" data-style={style} data-aside={asideContent ? 'true' : 'false'} style={heroStyleVars({ ...hero, style })}>
      <div className="min-w-0">
        {eyebrow && <span className="ecc-hero-eyebrow">{eyebrow}</span>}
        {greeting && <p className="ecc-hero-greeting">{greeting}</p>}
        <h1 className="ecc-hero-title">{fillTokens(hero.title, tokens)}</h1>
        {hero.subtitle && <p className="ecc-hero-sub">{fillTokens(hero.subtitle, tokens)}</p>}
        <div className="ecc-hero-actions">
          <SmartLink href={primary.href} className="ecc-btn ecc-btn-light">
            <PlayCircle size={16} /> {primary.label}
          </SmartLink>
          {secondary && (
            <SmartLink href={secondary.href} className="ecc-btn ecc-btn-ghost">
              <BookOpenCheck size={15} /> {secondary.label} <ArrowRight size={14} className="opacity-70" />
            </SmartLink>
          )}
        </div>
        {hero.showProfileChips && chips && <div className="ecc-hero-chips">{chips}</div>}
      </div>
      {asideContent}
    </section>
  );
}

export function ProfileChips({ exam, classLabel, unlocked }: { exam: string; classLabel: string; unlocked: number }) {
  return (
    <>
      <span className="ecc-hero-chip">
        <GraduationCap size={13} /> {exam} · {classLabel}
      </span>
      <span className="ecc-hero-chip">
        <BookOpenCheck size={13} /> {unlocked} course{unlocked === 1 ? '' : 's'} unlocked
      </span>
    </>
  );
}

export function HomeStatsPanel({
  title,
  badge,
  stats,
  percent,
}: {
  title: string;
  badge: string;
  stats: Array<{ label: string; value: string }>;
  percent: number | null;
}) {
  const pct = percent === null ? 0 : Math.max(0, Math.min(100, Math.round(percent)));
  return (
    <div className="ecc-stats">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="ecc-stat-label">Your progress</p>
          <p className="mt-1 text-[1rem] font-bold leading-snug">{title}</p>
        </div>
        <span className="ecc-chip ecc-chip-brand">{badge}</span>
      </div>
      <div className="ecc-stats-grid">
        {stats.map((stat) => (
          <div key={stat.label} className="ecc-stat">
            <p className="ecc-stat-label">{stat.label}</p>
            <p className="ecc-stat-value">{stat.value}</p>
          </div>
        ))}
      </div>
      <div className="mt-4">
        <div className="mb-1.5 flex items-center justify-between text-[0.72rem] font-semibold text-ink-500">
          <span>Average score</span>
          <span className="text-ink-800">{percent === null ? '—' : `${pct}%`}</span>
        </div>
        <div className="ecc-bar">
          <span style={{ width: `${pct}%` }} />
        </div>
      </div>
    </div>
  );
}

export function ClassicSection({
  section,
  children,
  title,
  subtitle,
}: {
  section: HomeSectionConfig;
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
}) {
  const heading = title ?? section.title;
  const sub = subtitle ?? section.subtitle;
  return (
    <section style={section.accent ? ({ ['--ecc-accent' as string]: section.accent } as React.CSSProperties) : undefined}>
      {(heading || sub || section.ctaLabel) && (
        <div className="ecc-section-head">
          <div className="min-w-0">
            {heading && <h2 className="ecc-section-title">{heading}</h2>}
            {sub && <p className="ecc-section-sub">{sub}</p>}
          </div>
          {section.ctaLabel && isUsableHref(section.ctaHref) && (
            <SmartLink href={section.ctaHref} className="ecc-link shrink-0">
              {section.ctaLabel} <ArrowRight size={13} />
            </SmartLink>
          )}
        </div>
      )}
      {children}
    </section>
  );
}

const HREF_FEATURE: Array<[string, keyof FeatureFlags]> = [
  ['/lectures', 'lectures'],
  ['/tests', 'tests'],
  ['/leaderboard', 'leaderboard'],
  ['/challenges', 'challenges'],
  ['/events', 'events'],
  ['/chat', 'chat'],
  ['/feedback', 'chat'],
  ['/notifications', 'notifications'],
  ['/search', 'search'],
];

/** Hides admin cards that link to a feature switched off in Feature Toggles. */
export function visibleItems(items: HomeSectionItem[] | undefined, features?: Partial<FeatureFlags>): HomeSectionItem[] {
  return (items || []).filter((item) => {
    if (!item.visible || !item.title.trim()) return false;
    if (!features || !item.href) return true;
    const match = HREF_FEATURE.find(([prefix]) => item.href === prefix || item.href.startsWith(`${prefix}?`) || item.href.startsWith(`${prefix}/`));
    return !match || features[match[1]] !== false;
  });
}

export function FeatureCards({ section, items }: { section: HomeSectionConfig; items: HomeSectionItem[] }) {
  const list = items.slice(0, Math.max(1, section.limit || 8));
  if (section.layout === 'list') {
    return (
      <div className="ecc-card divide-y divide-ink-100">
        {list.map((item) => (
          <SmartLink key={item.id} href={item.href} className="flex items-center gap-3 px-4 py-3 hover:bg-ink-50">
            <span className="ecc-icon">{item.icon || '•'}</span>
            <span className="min-w-0 flex-1">
              <span className="block text-[0.9rem] font-bold">{item.title}</span>
              {item.body && <span className="block text-[0.78rem] text-ink-500">{item.body}</span>}
            </span>
            {item.href && <ArrowRight size={15} className="shrink-0 text-ink-400" />}
          </SmartLink>
        ))}
      </div>
    );
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {list.map((item) => (
        <SmartLink key={item.id} href={item.href} className="ecc-card">
          <div className="ecc-card-body flex-row items-start gap-3">
            <span className="ecc-icon">{item.icon || '•'}</span>
            <div className="min-w-0 flex-1">
              <p className="ecc-card-title">{item.title}</p>
              {item.body && <p className="ecc-card-text">{item.body}</p>}
              {item.href && (
                <span className="ecc-link mt-2">
                  Open <ArrowRight size={12} />
                </span>
              )}
            </div>
          </div>
        </SmartLink>
      ))}
    </div>
  );
}

export function StepCards({ section, items }: { section: HomeSectionConfig; items: HomeSectionItem[] }) {
  const list = items.slice(0, Math.max(1, section.limit || 6));
  return (
    <ol className="grid gap-3 md:grid-cols-3">
      {list.map((item, index) => (
        <li key={item.id} className="ecc-card">
          <div className="ecc-card-body">
            <div className="flex items-center gap-3">
              <span className="ecc-step-num">{item.icon || index + 1}</span>
              <p className="ecc-card-title">{item.title}</p>
            </div>
            {item.body && <p className="ecc-card-text mt-2.5">{item.body}</p>}
            {item.href && isUsableHref(item.href) && (
              <SmartLink href={item.href} className="ecc-link mt-3">
                Go <ArrowRight size={12} />
              </SmartLink>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}

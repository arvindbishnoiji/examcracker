'use client';

/**
 * Shared student-screen primitives.
 *
 * Every manageable student screen renders its heading, optional announcement
 * banner, section wrappers, help note and empty state through these components.
 * The admin Screen Studio preview uses the exact same components, so what the
 * administrator sees is the real layout contract — not a disconnected mock.
 */

import Link from 'next/link';
import type { ReactNode } from 'react';
import { ArrowRight, Info, Megaphone } from 'lucide-react';
import type { ScreenAnnouncement, ScreenAnnouncementTone, ScreenHelp } from '@/types';
import { isSafeHttpUrl, isValidInternalDeepLink } from '@/lib/validation';

const TONE_CLASSES: Record<ScreenAnnouncementTone, { wrap: string; icon: string }> = {
  brand: { wrap: 'border-brand-200 bg-brand-50 text-brand-900', icon: 'text-brand-700' },
  info: { wrap: 'border-sky-200 bg-sky-50 text-sky-900', icon: 'text-sky-700' },
  success: { wrap: 'border-emerald-200 bg-emerald-50 text-emerald-900', icon: 'text-emerald-700' },
  warning: { wrap: 'border-amber-200 bg-amber-50 text-amber-900', icon: 'text-amber-700' },
};

export function ScreenPageHeader({
  eyebrow,
  title,
  description,
  meta,
  actions,
  showHeader = true,
  headingLevel = 'h1',
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  meta?: ReactNode;
  actions?: ReactNode;
  showHeader?: boolean;
  /** The admin preview renders at h2 so the page keeps a single h1. */
  headingLevel?: 'h1' | 'h2';
}) {
  if (!showHeader && !actions) return null;
  const Heading = headingLevel;
  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {showHeader && eyebrow ? (
          <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-brand-700">
            {eyebrow}
          </p>
        ) : null}
        {showHeader && (
          <>
            <Heading className="mt-1 text-[22px] font-extrabold leading-tight tracking-tight sm:text-3xl">
              {title}
            </Heading>
            {description ? (
              <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-ink-500 sm:text-sm">{description}</p>
            ) : null}
            {meta ? <div className="mt-2 flex flex-wrap items-center gap-1.5">{meta}</div> : null}
          </>
        )}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export function ScreenAnnouncementBanner({ announcement }: { announcement?: ScreenAnnouncement | null }) {
  if (!announcement?.enabled) return null;
  const title = announcement.title?.trim();
  const body = announcement.body?.trim();
  if (!title && !body) return null;
  const tone = TONE_CLASSES[announcement.tone] || TONE_CLASSES.brand;
  const ctaLabel = announcement.ctaLabel?.trim() || '';
  const ctaHref = announcement.ctaHref?.trim() || '';
  const internalLink = Boolean(ctaLabel && isValidInternalDeepLink(ctaHref));
  const externalLink = Boolean(ctaLabel && !internalLink && isSafeHttpUrl(ctaHref));
  return (
    <div className={`flex items-start gap-2.5 rounded-[var(--ec-radius)] border px-3.5 py-3 ${tone.wrap}`} role="note">
      <Megaphone size={15} className={`mt-0.5 shrink-0 ${tone.icon}`} aria-hidden />
      <div className="min-w-0 flex-1">
        {title ? <p className="text-[13px] font-bold leading-snug">{title}</p> : null}
        {body ? <p className="mt-0.5 text-[12px] leading-relaxed opacity-90">{body}</p> : null}
      </div>
      {internalLink ? (
        <Link
          href={ctaHref}
          className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white/80 px-3 py-1.5 text-[11px] font-bold text-ink-800 hover:bg-white"
        >
          {ctaLabel}
          <ArrowRight size={11} />
        </Link>
      ) : externalLink ? (
        <a
          href={ctaHref}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white/80 px-3 py-1.5 text-[11px] font-bold text-ink-800 hover:bg-white"
        >
          {ctaLabel}
          <ArrowRight size={11} />
        </a>
      ) : null}
    </div>
  );
}

export function ScreenHelpNote({ help }: { help?: ScreenHelp | null }) {
  if (!help || (!help.title?.trim() && !help.body?.trim())) return null;
  return (
    <div className="rounded-[var(--ec-radius)] border border-ink-100 bg-[var(--ec-surface)] p-4">
      {help.title ? (
        <p className="flex items-center gap-1.5 text-[13px] font-bold text-ink-800">
          <Info size={14} className="text-brand-600" aria-hidden />
          {help.title}
        </p>
      ) : null}
      {help.body ? <p className="mt-1 text-[11.5px] leading-relaxed text-ink-500">{help.body}</p> : null}
    </div>
  );
}

export function ScreenSection({
  title,
  subtitle,
  action,
  children,
  as: Tag = 'section',
}: {
  title?: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  as?: 'section' | 'div';
}) {
  return (
    <Tag>
      {title || subtitle || action ? (
        <div className="mb-2.5 flex flex-wrap items-end justify-between gap-2">
          <div className="min-w-0">
            {title ? <h2 className="text-[15px] font-extrabold tracking-tight sm:text-lg">{title}</h2> : null}
            {subtitle ? <p className="mt-0.5 text-[11.5px] text-ink-500">{subtitle}</p> : null}
          </div>
          {action}
        </div>
      ) : null}
      {children}
    </Tag>
  );
}

export function ScreenEmpty({
  title,
  body,
  action,
  icon,
}: {
  title: string;
  body?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="rounded-[var(--ec-radius)] border border-dashed border-ink-200 bg-[var(--ec-surface)] px-5 py-10 text-center">
      {icon ? (
        <div className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-2xl bg-brand-50 text-brand-700">
          {icon}
        </div>
      ) : null}
      <p className="text-sm font-bold text-ink-800">{title}</p>
      {body ? <p className="mx-auto mt-1 max-w-md text-[12px] leading-relaxed text-ink-500">{body}</p> : null}
      {action ? <div className="mt-4 flex flex-wrap justify-center gap-2">{action}</div> : null}
    </div>
  );
}

/** Card grid layout helper that honours the configured layout variant. */
export function screenGridClass(layout: string, compact = false): string {
  if (layout === 'list') return 'space-y-2.5';
  if (layout === 'compact') return 'grid gap-2.5 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4';
  return compact ? 'grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' : 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3';
}

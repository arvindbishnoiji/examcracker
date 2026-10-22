'use client';

import type { ReactNode } from 'react';
import {
  Bell,
  CalendarDays,
  Flame,
  LayoutDashboard,
  MessageSquare,
  PlayCircle,
  Search,
  Sparkles,
  Trophy,
  UserRound,
  Video,
} from 'lucide-react';
import type { PageIdentity, PageKey } from '@/lib/page-identity';
import { identityGradient, patternStyle } from '@/lib/page-identity';

const GLYPHS: Record<PageKey, ReactNode> = {
  home: <LayoutDashboard size={26} />,
  lectures: <Video size={26} />,
  tests: <PlayCircle size={26} />,
  leaderboard: <Trophy size={26} />,
  challenges: <Flame size={26} />,
  events: <CalendarDays size={26} />,
  chat: <MessageSquare size={26} />,
  notifications: <Bell size={26} />,
  search: <Search size={26} />,
  profile: <UserRound size={26} />,
  feedback: <Sparkles size={26} />,
};

const SMALL_GLYPHS: Record<PageKey, ReactNode> = {
  home: <LayoutDashboard size={10} />,
  lectures: <Video size={10} />,
  tests: <PlayCircle size={10} />,
  leaderboard: <Trophy size={10} />,
  challenges: <Flame size={10} />,
  events: <CalendarDays size={10} />,
  chat: <MessageSquare size={10} />,
  notifications: <Bell size={10} />,
  search: <Search size={10} />,
  profile: <UserRound size={10} />,
  feedback: <Sparkles size={10} />,
};

/**
 * The coloured identity band at the top of each student page.
 *
 * It does three jobs at once: tells you instantly *which* screen this is (colour
 * + glyph), states what the screen is for (kicker + one-liner), and lists the
 * three things you can actually do here — so no feature is a mystery.
 */
export function PageIdentityHero({
  identity,
  title,
  description,
  eyebrow,
  meta,
  actions,
  headingLevel = 'h1',
}: {
  identity: PageIdentity;
  title: string;
  description?: string;
  eyebrow?: string;
  meta?: ReactNode;
  actions?: ReactNode;
  headingLevel?: 'h1' | 'h2' | 'h3';
}) {
  const Heading = headingLevel;
  return (
    <section
      className="relative overflow-hidden rounded-[26px] text-white shadow-[0_40px_90px_-50px_rgba(15,10,40,0.75)]"
      style={{ background: identityGradient(identity) }}
    >
      {/* pattern + glows */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.5]" style={patternStyle(identity)} aria-hidden />
      <div
        className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full opacity-60 blur-3xl"
        style={{ background: identity.glow }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-28 -left-20 h-64 w-64 rounded-full opacity-35 blur-3xl"
        aria-hidden
        style={{ background: identity.from }}
      />
      {/* oversized watermark glyph */}
      <div
        className="pointer-events-none absolute -bottom-10 right-4 hidden opacity-[0.13] sm:block"
        aria-hidden
      >
        <span className="block scale-[5.6] origin-bottom-right">{GLYPHS[identity.key]}</span>
      </div>

      <div className="relative grid gap-5 p-5 sm:p-6 lg:grid-cols-[1.35fr_0.65fr] lg:items-center lg:p-7">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/12 px-2.5 py-1 text-[0.62rem] font-extrabold uppercase tracking-[0.14em] backdrop-blur">
              <span className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-white/25">{SMALL_GLYPHS[identity.key]}</span>
              {eyebrow || identity.kicker}
            </span>
            <span className="rounded-full border border-white/20 px-2.5 py-1 text-[0.6rem] font-bold uppercase tracking-[0.12em] text-white/70">
              {identity.label}
            </span>
          </div>

          <Heading className="mt-3 max-w-[22ch] text-[clamp(1.5rem,3vw,2.15rem)] font-extrabold leading-[1.06] tracking-[-0.035em] text-white">
            {title}
          </Heading>
          {description && (
            <p className="mt-2 max-w-2xl text-[0.88rem] leading-relaxed text-white/75">{description}</p>
          )}

          {meta ? <div className="mt-3 flex flex-wrap items-center gap-1.5">{meta}</div> : null}

          {actions ? <div className="mt-4 flex flex-wrap items-center gap-2">{actions}</div> : null}
        </div>

        <div className="rounded-2xl border border-white/18 bg-white/10 p-3 backdrop-blur-md">
          <p className="text-[0.6rem] font-extrabold uppercase tracking-[0.16em] text-white/55">You can do this here</p>
          <ul className="mt-2 space-y-1.5">
            {identity.canDo.map((item) => (
              <li key={item} className="flex items-start gap-2 text-[0.78rem] font-semibold leading-snug text-white/90">
                <span className="mt-[3px] grid h-3.5 w-3.5 shrink-0 place-items-center rounded-full bg-white/25 text-[8px]">
                  ✓
                </span>
                {item}
              </li>
            ))}
          </ul>
          <p className="mt-2.5 border-t border-white/15 pt-2 text-[0.66rem] leading-relaxed text-white/55">{identity.hint}</p>
        </div>
      </div>
    </section>
  );
}

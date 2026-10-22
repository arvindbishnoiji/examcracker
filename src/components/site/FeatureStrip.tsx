'use client';

import Link from 'next/link';
import {
  ArrowUpRight,
  Bell,
  BookOpenCheck,
  CalendarDays,
  Flame,
  Layers,
  MessagesSquare,
  Trophy,
  Video,
} from 'lucide-react';
import { useSiteConfig } from '@/context/SiteConfigContext';
import type { FeatureFlags } from '@/types';
import { Reveal } from '@/components/motion/Reveal';

interface FeatureTile {
  key: keyof FeatureFlags;
  label: string;
  description: string;
  href: string;
  tint: string;
  span: '1x1' | '2x1' | '2x2';
  icon: React.ReactNode;
}

const TILES: FeatureTile[] = [
  {
    key: 'lectures',
    label: 'Lectures',
    description: 'Chapter-wise playlists with ordered notes and progress that follows you.',
    href: '/lectures',
    tint: 'var(--ec-c1)',
    span: '2x2',
    icon: <Video size={17} />,
  },
  {
    key: 'tests',
    label: 'Mock tests',
    description: 'Timed papers with instant analysis.',
    href: '/tests',
    tint: 'var(--ec-c6)',
    span: '1x1',
    icon: <BookOpenCheck size={16} />,
  },
  {
    key: 'leaderboard',
    label: 'Leaderboard',
    description: 'See where you rank today.',
    href: '/leaderboard',
    tint: 'var(--ec-c8)',
    span: '1x1',
    icon: <Trophy size={16} />,
  },
  {
    key: 'challenges',
    label: 'Challenges',
    description: 'Sprints that pay you back with real rewards.',
    href: '/challenges',
    tint: 'var(--ec-c3)',
    span: '2x1',
    icon: <Flame size={16} />,
  },
  {
    key: 'events',
    label: 'Events',
    description: 'Marathons and doubt sessions.',
    href: '/events',
    tint: 'var(--ec-c5)',
    span: '1x1',
    icon: <CalendarDays size={16} />,
  },
  {
    key: 'chat',
    label: 'Mentor chat',
    description: 'Ask, get answered.',
    href: '/chat',
    tint: 'var(--ec-c2)',
    span: '1x1',
    icon: <MessagesSquare size={16} />,
  },
  {
    key: 'notifications',
    label: 'Updates',
    description: 'Curated notices.',
    href: '/notifications',
    tint: 'var(--ec-c4)',
    span: '1x1',
    icon: <Bell size={16} />,
  },
  {
    key: 'resources',
    label: 'Resources',
    description: 'PDFs and revision sheets.',
    href: '/lectures?tab=resources',
    tint: 'var(--ec-c7)',
    span: '1x1',
    icon: <Layers size={16} />,
  },
];

/**
 * Bento grid feature map — the 2026 default for "show many capabilities without
 * a wall of cards". Tile size encodes importance, colour encodes identity.
 */
export function FeatureStrip() {
  const { config } = useSiteConfig();
  const tiles = TILES.filter((tile) => config.features[tile.key] !== false);
  if (!tiles.length) return null;

  return (
    <Reveal motion="fade-up">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <p className="text-[0.62rem] font-extrabold uppercase tracking-[0.18em] text-ink-400">Inside the app</p>
          <h2 className="mt-1 text-[1.05rem] font-extrabold tracking-[-0.02em]">
            Eight doors. One preparation system.
          </h2>
        </div>
        <Link href="/lectures" className="ec-sec-link">
          Open library <ArrowUpRight size={12} />
        </Link>
      </div>
      <div className="ec-bento">
        {tiles.map((tile) => (
          <Link
            key={tile.key}
            href={tile.href}
            className="ec-bento-tile group"
            data-span={tile.span}
            style={{ ['--bento' as string]: tile.tint }}
          >
            <div className="flex items-start justify-between gap-2">
              <span className="ec-bento-icon">{tile.icon}</span>
              <ArrowUpRight size={15} className="text-ink-300 transition group-hover:text-ink-700" />
            </div>
            <div className="relative z-[1]">
              <p className={`font-extrabold tracking-[-0.02em] ${tile.span === '2x2' ? 'text-[1.35rem]' : 'text-[0.92rem]'}`}>
                {tile.label}
              </p>
              <p className={`mt-1 leading-snug text-ink-500 ${tile.span === '2x2' ? 'text-[0.82rem]' : 'text-[0.72rem]'}`}>
                {tile.description}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </Reveal>
  );
}

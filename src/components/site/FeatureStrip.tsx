'use client';

import Link from 'next/link';
import {
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
  icon: React.ReactNode;
}

const TILES: FeatureTile[] = [
  {
    key: 'lectures',
    label: 'Lectures',
    description: 'Chapter-wise playlists with notes',
    href: '/lectures',
    tint: 'ec-tint-1',
    icon: <Video size={16} />,
  },
  {
    key: 'tests',
    label: 'Mock tests',
    description: 'Timed tests with instant analysis',
    href: '/tests',
    tint: 'ec-tint-6',
    icon: <BookOpenCheck size={16} />,
  },
  {
    key: 'challenges',
    label: 'Challenges',
    description: 'Sprints with real rewards',
    href: '/challenges',
    tint: 'ec-tint-3',
    icon: <Flame size={16} />,
  },
  {
    key: 'leaderboard',
    label: 'Leaderboard',
    description: 'See where you rank today',
    href: '/leaderboard',
    tint: 'ec-tint-8',
    icon: <Trophy size={16} />,
  },
  {
    key: 'events',
    label: 'Events',
    description: 'Marathons and doubt sessions',
    href: '/events',
    tint: 'ec-tint-5',
    icon: <CalendarDays size={16} />,
  },
  {
    key: 'chat',
    label: 'Mentor chat',
    description: 'Ask doubts, get answers',
    href: '/chat',
    tint: 'ec-tint-4',
    icon: <MessagesSquare size={16} />,
  },
  {
    key: 'notifications',
    label: 'Updates',
    description: 'Notices curated for you',
    href: '/notifications',
    tint: 'ec-tint-2',
    icon: <Bell size={16} />,
  },
  {
    key: 'resources',
    label: 'Resources',
    description: 'PDFs, DPPs and revision sheets',
    href: '/lectures?tab=resources',
    tint: 'ec-tint-7',
    icon: <Layers size={16} />,
  },
];

/**
 * A colour-coded map of what the app can do — so new students understand every
 * feature in one glance instead of discovering it by accident.
 */
export function FeatureStrip() {
  const { config } = useSiteConfig();
  const colors = ['--ec-c1', '--ec-c2', '--ec-c3', '--ec-c4', '--ec-c5', '--ec-c6', '--ec-c7', '--ec-c8'];
  const tiles = TILES.filter((tile) => config.features[tile.key] !== false);
  if (!tiles.length) return null;

  return (
    <Reveal motion="fade-up">
      <div className="mb-1">
        <p className="text-[0.7rem] font-extrabold uppercase tracking-[0.16em] text-ink-400">
          Everything inside Exam Cracker
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
        {tiles.map((tile, index) => (
          <Link
            key={tile.key}
            href={tile.href}
            className={`ec-card ec-card-hover ec-tinted ${tile.tint} group flex items-start gap-2.5 p-3`}
          >
            <span
              className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-white shadow-sm transition group-hover:scale-105"
              style={{ background: `linear-gradient(135deg, var(${colors[index % colors.length]}), var(${colors[(index + 2) % colors.length]}))` }}
            >
              {tile.icon}
            </span>
            <span className="min-w-0">
              <span className="block text-[0.82rem] font-extrabold leading-tight text-ink-900">{tile.label}</span>
              <span className="mt-0.5 block text-[0.7rem] leading-snug text-ink-500">{tile.description}</span>
            </span>
          </Link>
        ))}
      </div>
    </Reveal>
  );
}

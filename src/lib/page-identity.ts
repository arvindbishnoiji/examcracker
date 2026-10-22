/**
 * Per-page identity
 * -----------------
 * Every student route gets its own colour, glyph, gradient and "what you can do
 * here" list. The goal is recognition: after two visits a student should know
 * which screen they landed on from the colour alone, and should never have to
 * guess what a page is for.
 *
 * Colours are written as raw hex so the hero band stays vivid in both light and
 * dark themes; the page content itself keeps using the admin palette.
 */

import type { CSSProperties } from 'react';

export type PageKey =
  | 'home'
  | 'lectures'
  | 'tests'
  | 'leaderboard'
  | 'challenges'
  | 'events'
  | 'chat'
  | 'notifications'
  | 'search'
  | 'profile'
  | 'feedback';

export interface PageIdentity {
  key: PageKey;
  label: string;
  kicker: string;
  from: string;
  to: string;
  /** Secondary glow used behind the watermark. */
  glow: string;
  pattern: 'stripes' | 'grid' | 'rays' | 'dots' | 'rings';
  /** Three short, plain-language capabilities. */
  canDo: string[];
  /** Short label shown next to the stat slots. */
  hint: string;
}

export const PAGE_IDENTITIES: Record<PageKey, PageIdentity> = {
  home: {
    key: 'home',
    label: 'Dashboard',
    kicker: 'Your command deck',
    from: '#6d28d9',
    to: '#db2777',
    glow: '#a78bfa',
    pattern: 'dots',
    canDo: ['See today’s plan', 'Resume lectures', 'Track your rank'],
    hint: 'Everything, in the order you should do it.',
  },
  lectures: {
    key: 'lectures',
    label: 'Lectures',
    kicker: 'Library & batches',
    from: '#4c1d95',
    to: '#6366f1',
    glow: '#a5b4fc',
    pattern: 'stripes',
    canDo: ['Browse batches', 'Watch chapter videos', 'Download notes'],
    hint: 'Pick a batch, then follow subject-by-subject.',
  },
  tests: {
    key: 'tests',
    label: 'Mock tests',
    kicker: 'Practice under the clock',
    from: '#0e7490',
    to: '#2563eb',
    glow: '#67e8f9',
    pattern: 'grid',
    canDo: ['Attempt live tests', 'Review answers', 'Read analysis'],
    hint: 'Timed papers with instant scoring.',
  },
  leaderboard: {
    key: 'leaderboard',
    label: 'Leaderboard',
    kicker: 'Where you rank',
    from: '#b45309',
    to: '#f59e0b',
    glow: '#fcd34d',
    pattern: 'rays',
    canDo: ['Compare scores', 'Spot toppers', 'Find your position'],
    hint: 'Ranked on real submitted attempts only.',
  },
  challenges: {
    key: 'challenges',
    label: 'Challenges',
    kicker: 'Small sprints, real rewards',
    from: '#be123c',
    to: '#f43f5e',
    glow: '#fda4af',
    pattern: 'dots',
    canDo: ['Join a sprint', 'Tick your checklist', 'Claim the reward'],
    hint: 'Short goals you can actually finish.',
  },
  events: {
    key: 'events',
    label: 'Events',
    kicker: 'Calendar & marathons',
    from: '#047857',
    to: '#14b8a6',
    glow: '#6ee7b7',
    pattern: 'rings',
    canDo: ['See what’s next', 'Join live sessions', 'Add to your plan'],
    hint: 'Everything scheduled, in IST.',
  },
  chat: {
    key: 'chat',
    label: 'Mentor chat',
    kicker: 'Ask, and get unstuck',
    from: '#0f766e',
    to: '#0ea5e9',
    glow: '#5eead4',
    pattern: 'dots',
    canDo: ['Ask a doubt', 'Share a screenshot', 'Read replies'],
    hint: 'Private thread with your mentor.',
  },
  notifications: {
    key: 'notifications',
    label: 'Updates',
    kicker: 'Only what matters',
    from: '#4338ca',
    to: '#0ea5e9',
    glow: '#93c5fd',
    pattern: 'stripes',
    canDo: ['Read new notices', 'Mark as read', 'Jump to the topic'],
    hint: 'Newest first, already filtered for you.',
  },
  search: {
    key: 'search',
    label: 'Search',
    kicker: 'One box, the whole app',
    from: '#1d4ed8',
    to: '#06b6d4',
    glow: '#7dd3fc',
    pattern: 'grid',
    canDo: ['Search lectures', 'Find tests', 'Open batches'],
    hint: 'Results respect your exam and class.',
  },
  profile: {
    key: 'profile',
    label: 'Profile',
    kicker: 'Your preparation, in numbers',
    from: '#7c3aed',
    to: '#a855f7',
    glow: '#d8b4fe',
    pattern: 'rings',
    canDo: ['Check your level', 'Review subject scores', 'Update details'],
    hint: 'Built from your real attempts and watch time.',
  },
  feedback: {
    key: 'feedback',
    label: 'Feedback',
    kicker: 'Talk to the team',
    from: '#9d174d',
    to: '#e11d48',
    glow: '#fda4af',
    pattern: 'rays',
    canDo: ['Report a problem', 'Suggest an idea', 'Read replies'],
    hint: 'Every thread gets a human reply.',
  },
};

export function pageIdentity(key: PageKey): PageIdentity {
  return PAGE_IDENTITIES[key];
}

export function identityGradient(identity: PageIdentity): string {
  return `linear-gradient(125deg, ${identity.from}, ${identity.to})`;
}

export function patternStyle(identity: PageIdentity): CSSProperties {
  switch (identity.pattern) {
    case 'stripes':
      return {
        backgroundImage:
          'repeating-linear-gradient(118deg, rgba(255,255,255,0.16) 0 1px, transparent 1px 18px)',
      };
    case 'grid':
      return {
        backgroundImage:
          'linear-gradient(rgba(255,255,255,0.14) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.14) 1px, transparent 1px)',
        backgroundSize: '26px 26px',
      };
    case 'rays':
      return {
        backgroundImage:
          'repeating-conic-gradient(from 0deg at 85% 15%, rgba(255,255,255,0.16) 0deg 6deg, transparent 6deg 18deg)',
      };
    case 'rings':
      return {
        backgroundImage:
          'repeating-radial-gradient(circle at 88% 12%, rgba(255,255,255,0.16) 0 1px, transparent 1px 22px)',
      };
    default:
      return {
        backgroundImage: 'radial-gradient(rgba(255,255,255,0.22) 1px, transparent 1.4px)',
        backgroundSize: '18px 18px',
      };
  }
}

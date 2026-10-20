import type { FeatureFlags } from '@/types';

/** Maps an app route to the feature toggle that controls its visibility. */
export function featureForPath(pathname: string): keyof FeatureFlags | null {
  const path = pathname.split('?')[0];
  if (path === '/lectures' || path.startsWith('/lectures/')) return 'lectures';
  if (path === '/tests' || path.startsWith('/tests/')) return 'tests';
  if (path === '/leaderboard') return 'leaderboard';
  if (path === '/chat') return 'chat';
  if (path === '/notifications') return 'notifications';
  if (path === '/events') return 'events';
  if (path === '/challenges') return 'challenges';
  if (path === '/search') return 'search';
  return null;
}

export function isRouteEnabled(pathname: string, features: FeatureFlags): boolean {
  const feature = featureForPath(pathname);
  if (!feature) return true;
  return Boolean(features[feature]);
}

export function isActivePath(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  if (href === '/home') return pathname === '/home';
  return pathname === href || pathname.startsWith(`${href}/`);
}

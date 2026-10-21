const FALLBACK_SITE_URL = 'https://examcrack.pages.dev';

/** Canonical public origin used by metadata, robots and the sitemap. */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || FALLBACK_SITE_URL).replace(/\/+$/, '');

export const SITE_NAME = 'Exam Cracker';

export const SITE_DESCRIPTION =
  'Exam Cracker is a JEE & NEET learning app for Class 11 and 12 students — curated lectures, scheduled mock tests, honest progress tracking and mentor support.';

export function absoluteUrl(path = '/'): string {
  return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

/** Routes that require a signed-in student and must never be indexed. */
export const PRIVATE_ROUTE_PREFIXES = [
  '/admin',
  '/home',
  '/onboarding',
  '/lectures',
  '/tests',
  '/leaderboard',
  '/profile',
  '/search',
  '/events',
  '/challenges',
  '/chat',
  '/notifications',
];

export function isPrivatePath(pathname: string): boolean {
  return PRIVATE_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

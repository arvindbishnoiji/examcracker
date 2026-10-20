// Pure route-gating rules for the student app.
// Used by <StudentGate> so every protected route enforces the same onboarding
// contract instead of each page re-implementing (and occasionally forgetting)
// its own redirect. Keeping this pure makes the security-critical behaviour
// unit-testable without a browser or Firebase session.

export type GateState = 'public' | 'loading' | 'allowed' | 'error' | 'redirect';

export interface GateInput {
  pathname: string | null;
  /** Firebase Auth has not finished restoring the persisted session yet. */
  initializing: boolean;
  /** A signed-in user exists. */
  signedIn: boolean;
  /** The student profile exists (onboarding complete). */
  hasProfile: boolean;
  /** Bootstrap request failed after sign-in. */
  bootstrapError: string | null;
  /** Bootstrap request is still in flight. */
  bootstrapLoading: boolean;
}

export type GateResult =
  | { state: 'public' }
  | { state: 'loading' }
  | { state: 'allowed' }
  | { state: 'error'; message: string }
  | { state: 'redirect'; to: string };

export const STUDENT_ROUTE_PREFIXES = [
  '/home',
  '/lectures',
  '/tests',
  '/leaderboard',
  '/profile',
  '/chat',
  '/notifications',
  '/search',
  '/events',
  '/challenges',
] as const;

const PUBLIC_ROUTES = new Set(['/', '/login', '/onboarding']);

export function normalizePathname(pathname: string | null | undefined): string {
  if (!pathname) return '/';
  const clean = pathname.split('?')[0].split('#')[0];
  if (clean.length > 1 && clean.endsWith('/')) return clean.replace(/\/+$/, '');
  return clean || '/';
}

export function isStudentRoute(pathname: string | null | undefined): boolean {
  const path = normalizePathname(pathname);
  return STUDENT_ROUTE_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

export function isPublicRoute(pathname: string | null | undefined): boolean {
  const path = normalizePathname(pathname);
  return PUBLIC_ROUTES.has(path);
}

/**
 * Resolves what the UI should do for a given route.
 *
 * Important: a failed bootstrap request must NOT be treated as "profile
 * missing". Doing so sends returning students into onboarding and can overwrite
 * their exam/class selection. We surface a retry state instead, which also
 * prevents redirect loops.
 */
export function resolveRouteGate(input: GateInput): GateResult {
  const path = normalizePathname(input.pathname);

  // Admin has its own server-backed authorisation gate in AdminShell.
  if (path === '/admin' || path.startsWith('/admin/')) return { state: 'public' };
  if (isPublicRoute(path)) return { state: 'public' };
  if (!isStudentRoute(path)) return { state: 'public' };

  if (input.initializing) return { state: 'loading' };
  if (!input.signedIn) return { state: 'redirect', to: '/login' };
  if (input.hasProfile) return { state: 'allowed' };
  if (input.bootstrapError) {
    return { state: 'error', message: input.bootstrapError };
  }
  if (input.bootstrapLoading) return { state: 'loading' };
  return { state: 'redirect', to: '/onboarding' };
}

/** Where a freshly signed-in user should land. */
export function postAuthDestination(input: {
  hasProfile: boolean;
  isAdmin: boolean;
}): '/home' | '/admin' | '/onboarding' {
  if (input.hasProfile) return '/home';
  if (input.isAdmin) return '/admin';
  return '/onboarding';
}

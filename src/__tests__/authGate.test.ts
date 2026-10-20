import { describe, expect, it } from 'vitest';
import {
  isPublicRoute,
  isStudentRoute,
  normalizePathname,
  postAuthDestination,
  resolveRouteGate,
} from '@/lib/auth-gate';

const base = {
  pathname: '/home',
  initializing: false,
  signedIn: true,
  hasProfile: true,
  bootstrapError: null as string | null,
  bootstrapLoading: false,
};

describe('route gate', () => {
  it('normalises query strings, hashes and trailing slashes', () => {
    expect(normalizePathname('/lectures/?q=jee#top')).toBe('/lectures');
    expect(normalizePathname('')).toBe('/');
    expect(normalizePathname(null)).toBe('/');
  });

  it('classifies public, admin and student routes', () => {
    expect(isPublicRoute('/login')).toBe(true);
    expect(isPublicRoute('/onboarding')).toBe(true);
    expect(isPublicRoute('/home')).toBe(false);
    expect(isStudentRoute('/tests/abc')).toBe(true);
    expect(isStudentRoute('/admin/students')).toBe(false);
    expect(isStudentRoute('/unknown')).toBe(false);
  });

  it('waits while Firebase restores the session', () => {
    expect(resolveRouteGate({ ...base, initializing: true }).state).toBe('loading');
  });

  it('redirects signed-out visitors to login', () => {
    expect(resolveRouteGate({ ...base, signedIn: false })).toEqual({ state: 'redirect', to: '/login' });
  });

  it('blocks every protected page until onboarding is complete', () => {
    for (const pathname of [
      '/home',
      '/lectures',
      '/lectures/123',
      '/tests',
      '/tests/123',
      '/leaderboard',
      '/profile',
      '/chat',
      '/notifications',
      '/search',
      '/events',
      '/challenges',
    ]) {
      expect(resolveRouteGate({ ...base, pathname, hasProfile: false })).toEqual({
        state: 'redirect',
        to: '/onboarding',
      });
    }
  });

  it('never treats a failed bootstrap request as missing onboarding', () => {
    const result = resolveRouteGate({
      ...base,
      hasProfile: false,
      bootstrapError: 'Network unavailable',
      bootstrapLoading: false,
    });
    expect(result.state).toBe('error');
    if (result.state === 'error') expect(result.message).toBe('Network unavailable');
  });

  it('does not redirect while the profile request is still loading', () => {
    expect(
      resolveRouteGate({ ...base, hasProfile: false, bootstrapLoading: true }).state
    ).toBe('loading');
  });

  it('allows completed students and public pages through', () => {
    expect(resolveRouteGate(base).state).toBe('allowed');
    expect(resolveRouteGate({ ...base, pathname: '/login', signedIn: false }).state).toBe('public');
    expect(resolveRouteGate({ ...base, pathname: '/onboarding', hasProfile: false, signedIn: true }).state).toBe('public');
    expect(resolveRouteGate({ ...base, pathname: '/admin', signedIn: false }).state).toBe('public');
    expect(resolveRouteGate({ ...base, pathname: '/not-a-real-page' }).state).toBe('public');
  });

  it('does not create a redirect loop for signed-in users without a profile', () => {
    const atOnboarding = resolveRouteGate({
      ...base,
      pathname: '/onboarding',
      hasProfile: false,
    });
    expect(atOnboarding.state).toBe('public');
    const atHome = resolveRouteGate({ ...base, pathname: '/home', hasProfile: false });
    expect(atHome).toEqual({ state: 'redirect', to: '/onboarding' });
  });
});

describe('post-auth destination', () => {
  it('sends returning students home and new students to onboarding', () => {
    expect(postAuthDestination({ hasProfile: true, isAdmin: false })).toBe('/home');
    expect(postAuthDestination({ hasProfile: false, isAdmin: false })).toBe('/onboarding');
  });

  it('lets the administrator reach the console without a student profile', () => {
    expect(postAuthDestination({ hasProfile: false, isAdmin: true })).toBe('/admin');
    expect(postAuthDestination({ hasProfile: true, isAdmin: true })).toBe('/home');
  });
});

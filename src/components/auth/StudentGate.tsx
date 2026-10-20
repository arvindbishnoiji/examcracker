'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { AlertCircle, LogIn, RefreshCw } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { resolveRouteGate } from '@/lib/auth-gate';

function GateSkeleton() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-4 px-1 py-4" aria-busy="true" aria-live="polite">
      <div className="ec-skeleton h-32 w-full" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="ec-skeleton h-40" />
        <div className="ec-skeleton h-40" />
        <div className="ec-skeleton h-40" />
      </div>
      <span className="sr-only">Checking your session and student profile…</span>
    </div>
  );
}

/**
 * Central student access gate. Every protected route runs through this component
 * so onboarding cannot be bypassed by typing a URL, and a failed bootstrap
 * request never masquerades as a missing profile.
 */
export function StudentGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, profile, initializing, bootstrapStatus, bootstrapError, refresh, signOut } = useAuth();

  const gate = resolveRouteGate({
    pathname,
    initializing,
    signedIn: Boolean(user),
    hasProfile: Boolean(profile),
    bootstrapError,
    bootstrapLoading: bootstrapStatus === 'loading',
  });

  useEffect(() => {
    if (gate.state === 'redirect') router.replace(gate.to);
  }, [gate, router]);

  if (gate.state === 'public' || gate.state === 'allowed') return <>{children}</>;
  if (gate.state === 'error') {
    return (
      <div className="mx-auto max-w-lg py-10 sm:py-16">
        <div className="ec-card p-6 sm:p-8 text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-amber-50 text-amber-700">
            <AlertCircle size={22} />
          </div>
          <h1 className="mt-4 text-xl font-extrabold tracking-tight">We couldn&apos;t load your profile</h1>
          <p className="mt-1.5 text-sm text-ink-500 leading-relaxed">
            Your session is still signed in. This is usually a temporary network or server problem — retrying will not
            change your exam or class selection.
          </p>
          <p className="mt-2 rounded-xl border border-ink-200 bg-ink-50 px-3 py-2 text-[11px] text-ink-600 break-words">
            {gate.message}
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={() => void refresh()}
              className="ec-btn inline-flex items-center gap-2 bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white"
            >
              <RefreshCw size={15} /> Try again
            </button>
            <button
              type="button"
              onClick={() => void signOut()}
              className="ec-btn inline-flex items-center gap-2 border border-ink-200 bg-[var(--ec-surface)] px-4 py-2.5 text-sm font-semibold"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    );
  }
  if (gate.state === 'redirect' && !user) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <div className="ec-card p-8">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-brand-50 text-brand-700">
            <LogIn size={22} />
          </div>
          <h1 className="mt-4 text-xl font-bold">Sign in to continue</h1>
          <p className="mt-1 text-sm text-ink-500">Redirecting you to the sign-in page…</p>
          <Link href="/login" className="mt-4 inline-flex text-sm font-semibold text-brand-700 hover:underline">
            Open sign in
          </Link>
        </div>
      </div>
    );
  }
  return <GateSkeleton />;
}

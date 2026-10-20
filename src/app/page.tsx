'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { postAuthDestination } from '@/lib/auth-gate';
import { Card, Skeleton } from '@/components/ui/Card';

export default function RootRedirectPage() {
  const { user, profile, initializing, bootstrapStatus, bootstrapError, isAdmin, refresh, signOut } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (initializing) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    if (bootstrapStatus !== 'ready') return;
    router.replace(postAuthDestination({ hasProfile: Boolean(profile), isAdmin }));
  }, [user, profile, initializing, bootstrapStatus, isAdmin, router]);

  if (bootstrapStatus === 'error') {
    return (
      <div className="max-w-lg mx-auto mt-10">
        <Card className="p-6 text-center">
          <h1 className="text-lg font-bold">Could not load your profile</h1>
          <p className="text-sm text-ink-500 mt-1">{bootstrapError || 'Please try again.'}</p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <button type="button" onClick={() => void refresh()} className="px-4 py-2 rounded-button bg-brand-600 text-white text-sm font-semibold">
              Retry
            </button>
            <button type="button" onClick={() => void signOut()} className="px-4 py-2 rounded-button border border-ink-200 text-sm font-semibold">
              Sign out
            </button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto mt-10">
      <Card className="p-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-brand-600 animate-pulse" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-64" />
          </div>
        </div>
        <p className="text-sm text-ink-500 mt-4">Loading Exam Cracker… Checking your session and personalised content.</p>
      </Card>
    </div>
  );
}

'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Card, Skeleton } from '@/components/ui/Card';

export default function RootRedirectPage() {
  const { user, profile, initializing, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (initializing || loading) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    if (!profile) {
      router.replace('/onboarding');
      return;
    }
    router.replace('/home');
  }, [user, profile, initializing, loading, router]);

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

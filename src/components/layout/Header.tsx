'use client';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { isAdminEmail } from '@/lib/config';
import { Button } from '@/components/ui/Button';
import { useState, useEffect } from 'react';

export function Header({ showNav = true }: { showNav?: boolean }) {
  const { user, profile, signOut, isAdmin } = useAuth();

  return (
    <header className="sticky top-0 z-40 bg-white/80 backdrop-blur border-b border-ink-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-14 sm:h-16">
        <Link href={user? profile ? '/home' : '/onboarding' : '/login'} className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-xl bg-brand-600 text-white grid place-items-center font-bold text-sm">EC</div>
          <span className="font-bold text-ink-900">Exam Cracker</span>
          <span className="hidden sm:inline text-xs bg-brand-50 text-brand-700 px-2 py-0.5 rounded-full border border-brand-100">JEE • NEET</span>
        </Link>
        <div className="flex items-center gap-1 sm:gap-2">
          {user && (
            <>
              <Link href="/lectures" className="hidden md:inline-flex px-3 py-2 text-sm font-medium text-ink-700 hover:bg-ink-50 rounded-xl">Lectures</Link>
              <Link href="/tests" className="hidden md:inline-flex px-3 py-2 text-sm font-medium text-ink-700 hover:bg-ink-50 rounded-xl">Tests</Link>
              <Link href="/leaderboard" className="hidden md:inline-flex px-3 py-2 text-sm font-medium text-ink-700 hover:bg-ink-50 rounded-xl">Leaderboard</Link>
              <Link href="/profile" className="relative p-2 text-ink-500 hover:text-ink-900">
                <span className="sr-only">Profile</span>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
              </Link>
              <div className="hidden sm:flex items-center gap-2 pl-2 border-l border-ink-100">
                <div className="text-right">
                  <p className="text-sm font-semibold text-ink-900 leading-none">{profile?.display_name || user.displayName || user.email}</p>
                  <p className="text-xs text-ink-500">{profile ? `${profile.exam} • Class ${profile.class_level}` : user.email}</p>
                </div>
                {isAdmin && <Link href="/admin" className="px-3 py-1.5 bg-ink-900 text-white text-xs font-semibold rounded-full">Admin</Link>}
                <Button variant="ghost" size="sm" onClick={signOut}>Sign out</Button>
              </div>
              <div className="sm:hidden flex items-center gap-1">
                {isAdmin && <Link href="/admin" className="px-2.5 py-1.5 bg-ink-900 text-white text-xs rounded-full">Admin</Link>}
              </div>
            </>
          )}
          {!user && (
            <Link href="/login" className="px-4 py-2 bg-brand-600 text-white text-sm font-semibold rounded-xl">Sign in</Link>
          )}
        </div>
      </div>
    </header>
  );
}

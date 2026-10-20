'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { onAuthStateChanged, getFirebaseAuth, signOutUser, getFreshIdToken } from '@/lib/firebase';
import { APP_CONFIG, isAdminEmail } from '@/lib/config';
import { getBootstrapData, onSessionExpired } from '@/lib/api';
import type { BootstrapResponse, StudentProfile } from '@/types';
import type { User } from 'firebase/auth';

export type BootstrapStatus = 'idle' | 'loading' | 'ready' | 'error';

interface AuthState {
  user: User | null;
  profile: StudentProfile | null;
  bootstrap: BootstrapResponse | null;
  loading: boolean;
  initializing: boolean;
  /** Explicit lifecycle of the profile/bootstrap request. */
  bootstrapStatus: BootstrapStatus;
  bootstrapError: string | null;
  needsOnboarding: boolean;
  isAdmin: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [bootstrap, setBootstrap] = useState<BootstrapResponse | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [bootstrapStatus, setBootstrapStatus] = useState<BootstrapStatus>('idle');
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);

  const loading = bootstrapStatus === 'loading';
  const isAdmin = !!user?.email && isAdminEmail(user.email);
  const needsOnboarding = !!user && !profile && bootstrapStatus === 'ready';

  const refresh = useCallback(async () => {
    if (!user) return;
    setBootstrapStatus('loading');
    setBootstrapError(null);
    try {
      const data = await getBootstrapData();
      setBootstrap(data);
      setProfile(data.profile);
      setBootstrapStatus('ready');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to load profile';
      setBootstrapError(msg);
      setBootstrapStatus('error');
    }
  }, [user]);

  const signOut = useCallback(async () => {
    await signOutUser();
    setProfile(null);
    setBootstrap(null);
    setBootstrapStatus('idle');
    setBootstrapError(null);
  }, []);

  useEffect(() => {
    let mounted = true;
    let auth;
    try {
      auth = getFirebaseAuth();
    } catch {
      setInitializing(false);
      return;
    }

    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      if (!mounted) return;
      setUser(fbUser);
      setBootstrapError(null);
      if (fbUser) {
        setBootstrapStatus('loading');
        try {
          const data = await getBootstrapData();
          if (!mounted) return;
          setBootstrap(data);
          setProfile(data.profile);
          setBootstrapStatus('ready');
        } catch (e) {
          if (!mounted) return;
          const msg = e instanceof Error ? e.message : 'Failed to load data';
          setBootstrapError(msg);
          setBootstrapStatus('error');
          // Keep whatever profile we had; never treat a network error as
          // "onboarding incomplete", which would overwrite the student's setup.
          setBootstrap(null);
        }
      } else {
        setProfile(null);
        setBootstrap(null);
        setBootstrapStatus('idle');
      }
      if (mounted) setInitializing(false);
    });

    const unsubExpired = onSessionExpired(() => {
      signOut();
    });

    return () => {
      mounted = false;
      unsub();
      unsubExpired();
    };
  }, [signOut]);

  // Refresh token periodically
  useEffect(() => {
    if (!user) return;
    const iv = setInterval(() => {
      getFreshIdToken(true).catch(() => {});
    }, 45 * 60 * 1000);
    return () => clearInterval(iv);
  }, [user]);

  const value: AuthState = {
    user,
    profile,
    bootstrap,
    loading,
    initializing,
    bootstrapStatus,
    bootstrapError,
    needsOnboarding: !!needsOnboarding,
    isAdmin,
    error: bootstrapError,
    refresh,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export function useRequireAuth(redirectTo = '/login') {
  const auth = useAuth();
  useEffect(() => {
    if (!auth.initializing && !auth.user) {
      window.location.href = redirectTo;
    }
  }, [auth.initializing, auth.user, redirectTo]);
  return auth;
}

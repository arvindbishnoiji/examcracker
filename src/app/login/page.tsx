'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  signInWithEmail,
  registerWithEmail,
  requestPasswordReset,
  signInWithGoogle,
  formatFirebaseAuthError,
  onRedirectAuthError,
} from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { postAuthDestination } from '@/lib/auth-gate';
import { useSiteConfig } from '@/context/SiteConfigContext';
import { APP_CONFIG } from '@/lib/config';
import { LoginShell } from '@/components/login/LoginShell';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/hooks/useToast';

export default function LoginPage() {
  const { user, profile, initializing, bootstrapStatus, bootstrapError, isAdmin, refresh } = useAuth();
  const { config } = useSiteConfig();
  const router = useRouter();
  const { push } = useToast();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);
  const [showReset, setShowReset] = useState(false);

  const login = config.login;
  const theme = config.theme;
  const showSignup = login.showSignup && config.features.signup;
  const showGoogle = login.showGoogle && config.features.googleAuth && APP_CONFIG.auth.googleEnabled;
  const effectiveMode = showSignup ? mode : 'signin';
  const testimonials = useMemo(
    () => config.testimonials.items.filter((item) => item.active).slice(0, 2),
    [config.testimonials.items]
  );

  useEffect(() => {
    if (initializing) return;
    if (!user) return;
    // Wait for the profile request before choosing a destination. A failed
    // request is not evidence that onboarding is incomplete.
    if (bootstrapStatus !== 'ready') return;
    router.replace(postAuthDestination({ hasProfile: Boolean(profile), isAdmin }));
  }, [user, profile, initializing, bootstrapStatus, isAdmin, router]);

  useEffect(() => {
    return onRedirectAuthError((message) => setError(message));
  }, []);

  async function handleEmailAuth(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!email.trim() || !password.trim()) {
      setError('Email and password are required.');
      return;
    }
    if (effectiveMode === 'signup' && displayName.trim().length < 2) {
      setError('Please enter your full name (2+ characters).');
      return;
    }
    setLoading(true);
    try {
      if (effectiveMode === 'signin') {
        await signInWithEmail(email, password);
      } else {
        await registerWithEmail(email, password, displayName);
      }
      push(effectiveMode === 'signin' ? 'Signed in successfully' : 'Account created successfully', 'success');
    } catch (err) {
      setError(formatFirebaseAuthError(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setError(null);
    setGoogleLoading(true);
    try {
      const result = await signInWithGoogle();
      if (result) {
        push('Google sign-in successful', 'success');
      } else {
        push('Redirecting to Google…', 'info');
      }
    } catch (err) {
      setError(formatFirebaseAuthError(err));
    } finally {
      setGoogleLoading(false);
    }
  }

  async function handleReset() {
    if (!email.trim()) {
      setError('Enter your email above to reset your password.');
      return;
    }
    setError(null);
    try {
      await requestPasswordReset(email);
      setResetSent(true);
      push('Password reset email sent. Check your inbox.', 'success');
    } catch (err) {
      setError(formatFirebaseAuthError(err));
    }
  }

  const form = (
    <div className="space-y-2">
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800" role="alert">
          {error}
        </div>
      )}
      {user && bootstrapStatus === 'error' && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900" role="alert">
          <p className="font-semibold">Signed in, but your profile could not load.</p>
          <p className="mt-0.5">{bootstrapError}</p>
          <button type="button" onClick={() => void refresh()} className="mt-2 font-semibold underline">
            Retry profile
          </button>
        </div>
      )}
      {resetSent && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
          Reset link sent to {email}. Check the spam folder if it is not visible.
        </div>
      )}

      {showGoogle && (
        <>
          <Button variant="outline" className="w-full justify-center" loading={googleLoading} onClick={handleGoogle}>
            <svg width="18" height="18" viewBox="0 0 24 24" className="mr-2" aria-hidden>
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Continue with Google
          </Button>
          <div className="relative flex items-center gap-3 py-1">
            <div className="h-px flex-1 bg-ink-100" />
            <span className="text-[10px] uppercase tracking-[0.12em] text-ink-400">or with email</span>
            <div className="h-px flex-1 bg-ink-100" />
          </div>
        </>
      )}

      {showSignup && (
        <div className="flex rounded-xl border border-ink-200 bg-ink-50/60 p-1">
          {(['signin', 'signup'] as const).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setMode(item)}
              className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                mode === item ? 'bg-[var(--ec-surface)] text-ink-900 shadow-sm' : 'text-ink-500 hover:text-ink-700'
              }`}
            >
              {item === 'signin' ? 'Sign in' : 'Create account'}
            </button>
          ))}
        </div>
      )}

      <form onSubmit={handleEmailAuth} className="space-y-3">
        {effectiveMode === 'signup' && (
          <Input
            label="Full name"
            placeholder="e.g. Arvind Bishnoi"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            autoComplete="name"
          />
        )}
        <div>
          <Input
            label={login.emailLabel}
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            required
          />
          {login.emailHelp && <p className="mt-1 text-[10px] text-ink-500">{login.emailHelp}</p>}
        </div>
        <div>
          <Input
            label={login.passwordLabel}
            type="password"
            placeholder="Minimum 6 characters"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete={effectiveMode === 'signin' ? 'current-password' : 'new-password'}
            required
          />
          {login.passwordHelp && <p className="mt-1 text-[10px] text-ink-500">{login.passwordHelp}</p>}
        </div>
        <Button type="submit" loading={loading} className="w-full">
          {effectiveMode === 'signin' ? 'Sign in' : 'Create account'}
        </Button>
      </form>

      <div className="flex items-center justify-between gap-2 text-xs">
        <button
          type="button"
          onClick={() => setShowReset((open) => !open)}
          className="font-medium text-brand-600 hover:underline"
        >
          {login.forgotPasswordText}
        </button>
        {login.showOnboardingNote && <span className="text-[10px] text-ink-400">Onboarding follows sign-in</span>}
      </div>

      {showReset && (
        <div className="rounded-xl border border-ink-200 bg-ink-50 p-3 space-y-2">
          <p className="text-xs font-semibold text-ink-700">Reset your password</p>
          <p className="text-[11px] text-ink-500">{login.forgotPasswordHelp}</p>
          <Button size="sm" variant="outline" onClick={handleReset}>
            Send reset link
          </Button>
        </div>
      )}

      {login.showOnboardingNote && (
        <p className="text-[10px] text-ink-400 leading-relaxed">
          First time? You will choose your name, JEE or NEET, and Class 11 or 12 once. Your dashboard then filters
          content automatically.
        </p>
      )}
    </div>
  );

  return (
    <LoginShell login={login} theme={theme} testimonials={testimonials}>
      {form}
    </LoginShell>
  );
}

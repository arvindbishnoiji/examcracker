'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithEmail, registerWithEmail, requestPasswordReset, signInWithGoogle, formatFirebaseAuthError, onRedirectAuthError } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { Card, CardBody } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/hooks/useToast';

export default function LoginPage(){
  const { user, profile, initializing } = useAuth();
  const router = useRouter();
  const { push } = useToast();
  const [mode, setMode] = useState<'signin'|'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string|null>(null);
  const [resetSent, setResetSent] = useState(false);
  const [showReset, setShowReset] = useState(false);

  useEffect(()=>{
    if(initializing) return;
    if(user && profile) router.replace('/home');
    else if(user && !profile) router.replace('/onboarding');
  },[user, profile, initializing, router]);

  useEffect(()=>{
    return onRedirectAuthError((msg)=> setError(msg));
  },[]);

  async function handleEmailAuth(e: React.FormEvent){
    e.preventDefault();
    setError(null);
    if(!email.trim() || !password.trim()) { setError('Email and password are required.'); return; }
    if(mode==='signup' && displayName.trim().length < 2){ setError('Please enter your full name (2+ characters).'); return; }
    setLoading(true);
    try{
      if(mode==='signin'){
        await signInWithEmail(email, password);
      } else {
        await registerWithEmail(email, password, displayName);
      }
      push(mode==='signin' ? 'Signed in successfully' : 'Account created successfully','success');
      // router effect will handle redirect
    }catch(err){
      setError(formatFirebaseAuthError(err));
    } finally { setLoading(false); }
  }

  async function handleGoogle(){
    setError(null);
    setGoogleLoading(true);
    try{
      const result = await signInWithGoogle();
      if(result){
        push('Google sign-in successful','success');
      } else {
        // redirect flow
        push('Redirecting to Google…','info');
      }
    }catch(err){ setError(formatFirebaseAuthError(err)); }
    finally { setGoogleLoading(false); }
  }

  async function handleReset(){
    if(!email.trim()){ setError('Enter your email above to reset password.'); return; }
    setError(null);
    try{
      await requestPasswordReset(email);
      setResetSent(true);
      push('Password reset email sent. Check your inbox.','success');
    }catch(err){ setError(formatFirebaseAuthError(err)); }
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="grid md:grid-cols-2 gap-6 items-start">
        <div className="space-y-4 pt-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-50 border border-brand-100 text-sm text-brand-700 font-medium">🎯 JEE & NEET • Class 11 & 12</div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-ink-900">Crack JEE & NEET with focused lectures & real tests</h1>
          <p className="text-ink-500 leading-relaxed">Sign in to access your personalised dashboard, batches, video lectures, timed tests and live doubt chat. Your content is filtered by exam and class.</p>
          <ul className="space-y-2 text-sm text-ink-600">
            <li className="flex gap-2"><span className="text-emerald-600">✓</span> Email & Google sign-in via Firebase (project darvo1)</li>
            <li className="flex gap-2"><span className="text-emerald-600">✓</span> Secure session with Firebase ID token → Supabase Edge Function</li>
            <li className="flex gap-2"><span className="text-emerald-600">✓</span> All schedules shown in Asia/Kolkata (IST)</li>
          </ul>
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-sm text-amber-900">
            <p className="font-semibold">First time?</p>
            <p>After sign-in you&apos;ll complete a one-time onboarding: name, JEE/NEET, Class 11/12. Then your personalised content loads.</p>
            <p className="mt-2 text-xs opacity-80">Admin: arvinddarabishnoi@gmail.com (must already exist in Firebase Auth; no public admin sign-up)</p>
          </div>
        </div>

        <Card className="p-0 overflow-hidden">
          <div className="px-6 pt-6 flex items-center gap-2 border-b border-ink-100 bg-ink-50/50">
            <button onClick={()=>setMode('signin')} className={`px-4 py-2.5 text-sm font-semibold border-b-2 ${mode==='signin'?'border-brand-600 text-brand-700 bg-white':'border-transparent text-ink-500'}`}>Sign in</button>
            <button onClick={()=>setMode('signup')} className={`px-4 py-2.5 text-sm font-semibold border-b-2 ${mode==='signup'?'border-brand-600 text-brand-700 bg-white':'border-transparent text-ink-500'}`}>Create account</button>
            <div className="ml-auto text-xs text-ink-500 hidden sm:block">Firebase Auth</div>
          </div>
          <CardBody className="space-y-4">
            {error && <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-800">{error}</div>}
            {resetSent && <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-sm text-emerald-800">Reset link sent to {email}. Check spam folder if not visible.</div>}

            <Button variant="outline" className="w-full justify-center" loading={googleLoading} onClick={handleGoogle}>
              <svg width="18" height="18" viewBox="0 0 24 24" className="mr-2"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
              Continue with Google
            </Button>

            <div className="relative flex items-center gap-3">
              <div className="h-px flex-1 bg-ink-100" />
              <span className="text-xs text-ink-400">or with email</span>
              <div className="h-px flex-1 bg-ink-100" />
            </div>

            <form onSubmit={handleEmailAuth} className="space-y-4">
              {mode==='signup' && <Input label="Full name" placeholder="e.g. Arvind Bishnoi" value={displayName} onChange={e=>setDisplayName(e.target.value)} />}
              <Input label="Email" type="email" placeholder="you@example.com" value={email} onChange={e=>setEmail(e.target.value)} required />
              <Input label="Password" type="password" placeholder="Minimum 6 characters" value={password} onChange={e=>setPassword(e.target.value)} required />
              <Button type="submit" loading={loading} className="w-full">{mode==='signin' ? 'Sign in' : 'Create account'}</Button>
            </form>

            <div className="flex items-center justify-between text-sm">
              <button onClick={()=>setShowReset(!showReset)} className="text-brand-600 hover:underline font-medium">Forgot password?</button>
              <span className="text-ink-400 text-xs">Firebase project darvo1</span>
            </div>

            {showReset && (
              <div className="p-3 rounded-xl bg-ink-50 border border-ink-200 space-y-2">
                <p className="text-sm font-medium text-ink-700">Reset your password</p>
                <p className="text-xs text-ink-500">We&apos;ll send a reset link to the email above.</p>
                <Button size="sm" variant="outline" onClick={handleReset}>Send reset link</Button>
              </div>
            )}

            <p className="text-xs text-ink-400 text-center">
              By continuing you agree to our Terms. Sessions persist via Firebase SDK. Never share your access codes.
            </p>
          </CardBody>
        </Card>
      </div>

      <div className="mt-8 grid sm:grid-cols-3 gap-3 text-sm">
        <Card className="p-4"><p className="font-semibold">Secure by design</p><p className="text-ink-500 text-xs mt-1">Supabase RLS denies direct table access. Every relational request verifies your Firebase ID token via Edge Function.</p></Card>
        <Card className="p-4"><p className="font-semibold">No YouTube key needed</p><p className="text-ink-500 text-xs mt-1">Lecture metadata & playlists via Cloudflare Worker ec-content-api. Uses public YouTube pages, not Data API.</p></Card>
        <Card className="p-4"><p className="font-semibold">Real scoring</p><p className="text-ink-500 text-xs mt-1">Test scores calculated server-side. Answers & explanations hidden until you submit.</p></Card>
      </div>
    </div>
  );
}

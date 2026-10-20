'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  Atom,
  Check,
  CheckCircle2,
  GraduationCap,
  Loader2,
  LogOut,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Target,
  Trophy,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { saveStudentProfile } from '@/lib/api';
import { useToast } from '@/hooks/useToast';

type Step = 1 | 2 | 3 | 4;
const DRAFT_KEY = 'ec-onboarding-draft-v1';

const STEP_LABELS: Record<Step, string> = {
  1: 'Your name',
  2: 'Your exam',
  3: 'Your class',
  4: 'Confirm',
};

interface Draft {
  displayName: string;
  exam: 'JEE' | 'NEET';
  classLevel: '11' | '12';
  step: Step;
}

export default function OnboardingPage() {
  const { user, profile, initializing, bootstrapStatus, bootstrapError, refresh, isAdmin, signOut } = useAuth();
  const router = useRouter();
  const { push } = useToast();

  const [displayName, setDisplayName] = useState('');
  const [exam, setExam] = useState<'JEE' | 'NEET'>('JEE');
  const [classLevel, setClassLevel] = useState<'11' | '12'>('11');
  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [restored, setRestored] = useState(false);

  // Restore an interrupted onboarding draft. This is a convenience only — the
  // server still requires a complete profile before protected content loads.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const draft = JSON.parse(raw) as Partial<Draft>;
        if (
          typeof draft.displayName === 'string' &&
          (draft.exam === 'JEE' || draft.exam === 'NEET') &&
          (draft.classLevel === '11' || draft.classLevel === '12')
        ) {
          setDisplayName(draft.displayName);
          setExam(draft.exam);
          setClassLevel(draft.classLevel);
          setStep(draft.step === 2 || draft.step === 3 || draft.step === 4 ? draft.step : 1);
          setRestored(true);
        }
      }
    } catch {
      // Ignore malformed drafts.
    }
  }, []);

  useEffect(() => {
    if (!user?.displayName) return;
    setDisplayName((current) => (current.trim() ? current : user.displayName || ''));
  }, [user?.displayName]);

  useEffect(() => {
    if (initializing || !user) return;
    if (bootstrapStatus !== 'ready') return;
    if (profile) router.replace('/home');
  }, [initializing, user, bootstrapStatus, profile, router]);

  useEffect(() => {
    if (initializing) return;
    if (!user) router.replace('/login');
  }, [initializing, user, router]);

  const selectedExamDescription = useMemo(
    () =>
      exam === 'JEE'
        ? 'Engineering entrance preparation — Physics, Chemistry and Mathematics.'
        : 'Medical entrance preparation — Physics, Chemistry and Biology.',
    [exam]
  );

  function persist(next: Draft) {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(next));
    } catch {
      // Storage can be blocked; onboarding still works.
    }
  }

  function goTo(next: Step) {
    setStep(next);
    setFieldError(null);
    setError(null);
    persist({ displayName, exam, classLevel, step: next });
  }

  function validateStep(current: Step): boolean {
    setFieldError(null);
    if (current === 1) {
      const trimmed = displayName.trim();
      if (trimmed.length < 2) {
        setFieldError('Enter your full name (at least 2 characters).');
        return false;
      }
      if (trimmed.length > 80) {
        setFieldError('Keep your name under 80 characters.');
        return false;
      }
    }
    return true;
  }

  function next() {
    if (!validateStep(step)) return;
    if (step < 4) goTo((step + 1) as Step);
  }

  function back() {
    if (step > 1) goTo((step - 1) as Step);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!validateStep(1)) {
      setStep(1);
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await saveStudentProfile({ displayName: displayName.trim(), exam, classLevel });
      try {
        localStorage.removeItem(DRAFT_KEY);
      } catch {
        // Ignore storage errors.
      }
      push(`Welcome to Exam Cracker, ${displayName.trim().split(' ')[0]}!`, 'success');
      await refresh();
      router.replace(isAdmin ? '/admin' : '/home');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'We could not save your profile. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (initializing || (user && bootstrapStatus === 'loading')) {
    return (
      <div className="min-h-screen grid place-items-center px-4" style={{ background: 'var(--ec-bg)' }}>
        <div className="text-center">
          <Loader2 className="mx-auto animate-spin text-brand-600" size={32} />
          <p className="mt-3 text-sm text-ink-500">Checking your account…</p>
        </div>
      </div>
    );
  }

  if (user && bootstrapStatus === 'error') {
    return (
      <div className="min-h-screen grid place-items-center px-4" style={{ background: 'var(--ec-bg)' }}>
        <div className="ec-card max-w-md w-full p-7 text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-amber-50 text-amber-700">
            <ShieldCheck size={22} />
          </div>
          <h1 className="mt-4 text-xl font-bold">We couldn&apos;t load your profile</h1>
          <p className="mt-1 text-sm text-ink-500">{bootstrapError || 'Please try again.'}</p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={() => void refresh()}
              className="ec-btn bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white"
            >
              Try again
            </button>
            <button
              type="button"
              onClick={() => void signOut()}
              className="ec-btn border border-ink-200 px-4 py-2.5 text-sm font-semibold"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden" style={{ background: 'var(--ec-bg)' }}>
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute -top-24 right-[-10%] h-[420px] w-[420px] rounded-full bg-brand-200/40 blur-3xl" />
        <div className="absolute bottom-[-20%] left-[-10%] h-[380px] w-[380px] rounded-full bg-amber-200/30 blur-3xl" />
      </div>

      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-5 sm:px-6 lg:py-8">
        <header className="flex items-center justify-between gap-3">
          <Link href="/login" className="flex items-center gap-2.5">
            <span
              className="grid h-10 w-10 place-items-center rounded-2xl text-sm font-extrabold shadow-sm"
              style={{ background: 'linear-gradient(135deg, var(--ec-brand), var(--ec-secondary))', color: 'var(--ec-on-brand)' }}
            >
              EC
            </span>
            <span>
              <span className="block text-sm font-extrabold leading-tight">Exam Cracker</span>
              <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-500">
                JEE · NEET · Class 11 &amp; 12
              </span>
            </span>
          </Link>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <Link href="/admin" className="hidden sm:inline-flex text-xs font-semibold text-brand-700 hover:underline">
                Admin console
              </Link>
            )}
            <button
              type="button"
              onClick={() => void signOut()}
              className="inline-flex items-center gap-1.5 rounded-xl border border-ink-200 bg-[var(--ec-surface)] px-3 py-2 text-xs font-semibold text-ink-600"
            >
              <LogOut size={13} /> Sign out
            </button>
          </div>
        </header>

        <div className="mt-6 grid flex-1 items-stretch gap-5 lg:mt-10 lg:grid-cols-[1.05fr_1fr]">
          {/* Brand / progression panel */}
          <section className="relative hidden overflow-hidden rounded-[28px] border border-ink-100 p-8 lg:flex lg:flex-col ec-hero-gradient">
            <div className="ec-hero-lines pointer-events-none absolute inset-0 opacity-60" aria-hidden />
            <div className="relative">
              <span className="ec-chip">
                <Sparkles size={12} /> Your learning path starts here
              </span>
              <h1 className="mt-5 max-w-lg text-[34px] font-extrabold leading-[1.08] tracking-[-0.03em]">
                One setup.
                <br />
                Content that actually
                <br />
                fits your exam.
              </h1>
              <p className="mt-4 max-w-md text-sm leading-relaxed text-ink-600">
                We personalise your dashboard, batches, lectures, tests and leaderboards using your exam and class.
                This required setup keeps every student&apos;s feed focused.
              </p>
            </div>

            <div className="relative mt-8 space-y-3">
              {[
                { icon: <Target size={16} />, title: 'Today’s goal', text: 'A daily target matched to your preparation track.' },
                { icon: <GraduationCap size={16} />, title: 'Your batch & lectures', text: 'Only the material you are eligible for appears.' },
                { icon: <Trophy size={16} />, title: 'Levels & leaderboards', text: 'Progress from your real test attempts and lesson activity.' },
              ].map((item) => (
                <div key={item.title} className="flex items-start gap-3 rounded-2xl border border-white/60 bg-white/55 px-3.5 py-3 backdrop-blur-sm">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-brand-600 text-white">{item.icon}</span>
                  <span>
                    <span className="block text-xs font-bold text-ink-900">{item.title}</span>
                    <span className="block text-[11px] leading-relaxed text-ink-600">{item.text}</span>
                  </span>
                </div>
              ))}
            </div>

            <div className="relative mt-auto pt-8">
              <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.14em] text-ink-500">
                <span>Level 1</span>
                <span>Personalised setup</span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/70">
                <div className="h-full w-1/3 rounded-full" style={{ background: 'linear-gradient(90deg, var(--ec-brand), var(--ec-accent))' }} />
              </div>
            </div>
          </section>

          {/* Form panel */}
          <section className="ec-card flex flex-col p-5 sm:p-7 lg:p-8">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-brand-600">Required setup</p>
                <h2 className="mt-1 text-2xl font-extrabold tracking-tight">Complete your profile</h2>
              </div>
              <span className="rounded-full border border-ink-200 bg-ink-50 px-3 py-1 text-[11px] font-bold text-ink-600">
                Step {step} of 4
              </span>
            </div>

            <div className="mt-4 flex items-center gap-1.5" aria-label="Onboarding progress">
              {[1, 2, 3, 4].map((index) => (
                <div key={index} className="flex flex-1 items-center gap-1.5">
                  <span
                    className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-[11px] font-bold transition ${
                      index < step
                        ? 'bg-emerald-100 text-emerald-700'
                        : index === step
                          ? 'bg-brand-600 text-white'
                          : 'bg-ink-100 text-ink-400'
                    }`}
                  >
                    {index < step ? <Check size={13} /> : index}
                  </span>
                  {index < 4 && <span className={`h-0.5 flex-1 rounded-full ${index < step ? 'bg-emerald-200' : 'bg-ink-100'}`} />}
                </div>
              ))}
            </div>
            <p className="mt-2 text-[11px] font-medium text-ink-500">{STEP_LABELS[step]}</p>

            {restored && step === 1 && (
              <p className="mt-3 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-[11px] text-sky-800">
                We restored your previous setup draft. You can change anything before finishing.
              </p>
            )}

            <form onSubmit={handleSubmit} className="mt-5 flex flex-1 flex-col">
              {error && (
                <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-xs text-red-800">
                  {error}
                </div>
              )}
              {fieldError && (
                <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-xs text-red-800">
                  {fieldError}
                </div>
              )}

              <div className="flex-1">
                {step === 1 && (
                  <div className="ec-fade-in space-y-4">
                    <div>
                      <label htmlFor="onboarding-name" className="block text-sm font-semibold text-ink-800">
                        What should we call you?
                      </label>
                      <p className="mt-1 text-xs text-ink-500">This appears on your profile, leaderboard and doubt chat.</p>
                      <input
                        id="onboarding-name"
                        value={displayName}
                        onChange={(event) => {
                          setDisplayName(event.target.value);
                          setFieldError(null);
                        }}
                        placeholder="Your full name"
                        autoComplete="name"
                        autoFocus
                        maxLength={80}
                        className="ec-field mt-3 !py-3 !text-base"
                      />
                      <p className="mt-1.5 text-[11px] text-ink-400">2–80 characters · required</p>
                    </div>
                    <div className="rounded-xl border border-ink-100 bg-ink-50/70 px-3.5 py-3 text-[11px] text-ink-600">
                      <p className="flex items-center gap-1.5 font-semibold text-ink-800">
                        <ShieldCheck size={13} className="text-emerald-600" /> Saved securely to your account
                      </p>
                      <p className="mt-1">You can update your name later from your profile. Exam and class changes stay server-validated.</p>
                    </div>
                  </div>
                )}

                {step === 2 && (
                  <fieldset className="ec-fade-in">
                    <legend className="text-sm font-semibold text-ink-800">Which exam are you preparing for?</legend>
                    <p className="mt-1 text-xs text-ink-500">This controls your lectures, batches, tests and leaderboard.</p>
                    <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
                      {[
                        { value: 'JEE' as const, title: 'JEE', subtitle: 'Engineering', icon: <Atom size={20} /> },
                        { value: 'NEET' as const, title: 'NEET', subtitle: 'Medical', icon: <Stethoscope size={20} /> },
                      ].map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setExam(option.value)}
                          aria-pressed={exam === option.value}
                          className={`relative rounded-2xl border px-4 py-4 text-left transition ${
                            exam === option.value
                              ? 'border-brand-300 bg-brand-50 ring-2 ring-brand-200'
                              : 'border-ink-200 hover:border-brand-200 hover:bg-ink-50/60'
                          }`}
                        >
                          <span className={`grid h-10 w-10 place-items-center rounded-xl ${exam === option.value ? 'bg-brand-600 text-white' : 'bg-ink-100 text-ink-600'}`}>
                            {option.icon}
                          </span>
                          <span className="mt-2 block text-sm font-extrabold">{option.title}</span>
                          <span className="block text-[11px] text-ink-500">{option.subtitle}</span>
                          {exam === option.value && (
                            <span className="absolute right-3 top-3 grid h-5 w-5 place-items-center rounded-full bg-brand-600 text-white">
                              <Check size={12} />
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                    <p className="mt-3 text-[11px] text-ink-500">{selectedExamDescription}</p>
                  </fieldset>
                )}

                {step === 3 && (
                  <fieldset className="ec-fade-in">
                    <legend className="text-sm font-semibold text-ink-800">Which class are you in?</legend>
                    <p className="mt-1 text-xs text-ink-500">Choose your current academic year.</p>
                    <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
                      {[
                        { value: '11' as const, title: 'Class 11', subtitle: 'First year of preparation' },
                        { value: '12' as const, title: 'Class 12', subtitle: 'Final year + revision' },
                      ].map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setClassLevel(option.value)}
                          aria-pressed={classLevel === option.value}
                          className={`relative rounded-2xl border px-4 py-4 text-left transition ${
                            classLevel === option.value
                              ? 'border-brand-300 bg-brand-50 ring-2 ring-brand-200'
                              : 'border-ink-200 hover:border-brand-200 hover:bg-ink-50/60'
                          }`}
                        >
                          <span className={`grid h-10 w-10 place-items-center rounded-xl ${classLevel === option.value ? 'bg-brand-600 text-white' : 'bg-ink-100 text-ink-600'}`}>
                            <GraduationCap size={20} />
                          </span>
                          <span className="mt-2 block text-sm font-extrabold">{option.title}</span>
                          <span className="block text-[11px] text-ink-500">{option.subtitle}</span>
                          {classLevel === option.value && (
                            <span className="absolute right-3 top-3 grid h-5 w-5 place-items-center rounded-full bg-brand-600 text-white">
                              <Check size={12} />
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  </fieldset>
                )}

                {step === 4 && (
                  <div className="ec-fade-in space-y-3">
                    <div className="rounded-2xl border border-brand-100 bg-brand-50/60 px-4 py-3">
                      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-brand-700">Your setup</p>
                      <dl className="mt-2 space-y-2 text-sm">
                        <div className="flex items-center justify-between gap-3">
                          <dt className="text-ink-500">Name</dt>
                          <dd className="font-semibold text-ink-900">{displayName.trim() || '—'}</dd>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <dt className="text-ink-500">Exam</dt>
                          <dd className="font-semibold text-ink-900">{exam}</dd>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <dt className="text-ink-500">Class</dt>
                          <dd className="font-semibold text-ink-900">Class {classLevel}</dd>
                        </div>
                      </dl>
                    </div>
                    <ul className="space-y-1.5 text-[11px] text-ink-600">
                      {[
                        'Your Home shows only content for this exam and class.',
                        'Batches and series still require enrollment or a valid access code.',
                        'You can update your profile later; restricted content stays server-validated.',
                      ].map((line) => (
                        <li key={line} className="flex items-start gap-1.5">
                          <CheckCircle2 size={13} className="mt-0.5 shrink-0 text-emerald-600" /> {line}
                        </li>
                      ))}
                    </ul>
                    <p className="text-[10px] leading-relaxed text-ink-400">
                      By continuing you confirm this setup is yours. Access is verified against your signed Firebase
                      session and enforced by the server.
                    </p>
                  </div>
                )}
              </div>

              <div className="mt-6 flex items-center justify-between gap-2 border-t border-ink-100 pt-4">
                {step > 1 ? (
                  <button
                    type="button"
                    onClick={back}
                    className="ec-btn inline-flex items-center gap-1.5 border border-ink-200 bg-[var(--ec-surface)] px-4 py-2.5 text-sm font-semibold"
                  >
                    <ArrowLeft size={15} /> Back
                  </button>
                ) : (
                  <span className="text-[11px] text-ink-400">Required — no skip</span>
                )}
                {step < 4 ? (
                  <button
                    type="button"
                    onClick={next}
                    className="ec-btn inline-flex items-center gap-1.5 bg-brand-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-brand-700"
                  >
                    Continue <ArrowRight size={15} />
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={loading}
                    className="ec-btn inline-flex items-center gap-2 bg-brand-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-brand-700 disabled:opacity-60"
                  >
                    {loading ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
                    {loading ? 'Building your dashboard…' : 'Enter my dashboard'}
                  </button>
                )}
              </div>
            </form>
          </section>
        </div>

        <p className="mt-4 text-center text-[10px] text-ink-400">
          Your exam and class choices are required to unlock personalised student content.
        </p>
      </div>
    </div>
  );
}

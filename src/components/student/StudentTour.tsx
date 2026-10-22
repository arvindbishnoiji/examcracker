'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  Award,
  BookOpenCheck,
  CheckCircle2,
  Compass,
  HelpCircle,
  MessageCircle,
  Sparkles,
  Timer,
  Trophy,
  X,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export const OPEN_STUDENT_TOUR_EVENT = 'ec-open-student-tour';

export function openStudentTour() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(OPEN_STUDENT_TOUR_EVENT));
  }
}

interface TourStep {
  badge: string;
  title: string;
  hindiHint: string;
  description: string;
  points: string[];
  actionLabel?: string;
  actionHref?: string;
  icon: React.ReactNode;
}

const TOUR_STEPS: TourStep[] = [
  {
    badge: 'Welcome Tour · Step 1 of 5',
    title: 'Your Personalised Exam Workspace',
    hindiHint: 'Aapke Exam (JEE / NEET) aur Class ke hisaab se sab kuch set hai',
    description:
      'Every batch, lecture, mock test, and leaderboard on Exam Cracker is automatically filtered for your chosen exam track and class level.',
    points: [
      'Home gives you instant access to your active batches, live tests & daily study plan.',
      'Use Search anytime to jump directly to any Physics, Chemistry, Maths or Biology topic.',
    ],
    icon: <Compass size={22} />,
  },
  {
    badge: 'Study Flow · Step 2 of 5',
    title: 'Batches → Subjects → Lecture Queue',
    hindiHint: 'Pehle Batch chunein → Subject kholein → Order me Lectures aur PDF Notes padhein',
    description:
      'Instead of random videos, courses follow a strict chapter sequence so you never miss concepts.',
    points: [
      'Open Lectures tab → pick your Batch or Chapter Series.',
      'Select a Subject to watch lectures in sequence and download attached PDF notes.',
    ],
    actionLabel: 'Browse Batches',
    actionHref: '/lectures',
    icon: <BookOpenCheck size={22} />,
  },
  {
    badge: 'Daily Discipline · Step 3 of 5',
    title: 'Focus Timer, Daily Targets & Streak',
    hindiHint: 'Roz timer chala kar padhein aur daily checklist poori karein',
    description:
      'Top ranks come from daily consistency. Use the built-in Pomodoro Focus Timer and Daily Study Checklist right on your Home screen.',
    points: [
      'Switch between 25m Concept, 45m PYQ Practice, or 180m Exam Simulation timer.',
      'Track your countdown days to JEE / NEET and maintain your daily study streak.',
    ],
    icon: <Timer size={22} />,
  },
  {
    badge: 'Exam Practice · Step 4 of 5',
    title: 'Timed NTA Mock Tests & Live Ranks',
    hindiHint: 'Asli exam jaise timer aur negative marking ke saath test dein',
    description:
      'Attempt scheduled and live mock tests with real marking schemes, instant scorecards, question-wise review, and Leaderboard rank.',
    points: [
      'Check question-by-question accuracy and explanations right after submission.',
      'Compare your score on the Leaderboard to benchmark your preparation.',
    ],
    actionLabel: 'Explore Mock Tests',
    actionHref: '/tests',
    icon: <Trophy size={22} />,
  },
  {
    badge: 'Rewards & Doubts · Step 5 of 5',
    title: 'Unlock Animated Badges & Ask Mentors',
    hindiHint: 'Lectures aur Tests poore karke animated badges jeetein aur doubt poochein',
    description:
      'Earn custom animated badges automatically as you complete lectures and tests — and reach out to mentors whenever you get stuck.',
    points: [
      'Tap any badge on Home or Profile to view "Kaise Milega" unlock rules & progress.',
      'Need help with a concept or test? Open Feedback / Doubts to message mentors directly.',
    ],
    actionLabel: 'View My Profile & Badges',
    actionHref: '/profile',
    icon: <Award size={22} />,
  },
];

function storageKey(uid: string) {
  return `ec-student-tour-seen:v1:${uid}`;
}

export function StudentTour() {
  const { user, profile } = useAuth();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  const markSeenAndClose = useCallback(() => {
    setOpen(false);
    if (user?.uid) {
      try {
        window.localStorage.setItem(storageKey(user.uid), '1');
      } catch {
        // Ignore storage restrictions in private browsing.
      }
    }
  }, [user?.uid]);

  // Auto-open once for first-time onboarded students landing on /home.
  useEffect(() => {
    if (!user?.uid || !profile || pathname !== '/home') return;
    let seen = false;
    try {
      seen = window.localStorage.getItem(storageKey(user.uid)) === '1';
    } catch {
      seen = true;
    }
    if (seen) return;
    const timer = window.setTimeout(() => {
      setStepIndex(0);
      setOpen(true);
    }, 650);
    return () => window.clearTimeout(timer);
  }, [user?.uid, profile, pathname]);

  // Allow re-opening anytime from Header / Home "Guide" button.
  useEffect(() => {
    const onManualOpen = () => {
      setStepIndex(0);
      setOpen(true);
    };
    window.addEventListener(OPEN_STUDENT_TOUR_EVENT, onManualOpen);
    return () => window.removeEventListener(OPEN_STUDENT_TOUR_EVENT, onManualOpen);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') markSeenAndClose();
      if (event.key === 'ArrowRight') setStepIndex((i) => Math.min(TOUR_STEPS.length - 1, i + 1));
      if (event.key === 'ArrowLeft') setStepIndex((i) => Math.max(0, i - 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, markSeenAndClose]);

  if (!open) return null;

  const current = TOUR_STEPS[stepIndex];
  const isLast = stepIndex === TOUR_STEPS.length - 1;
  const firstName = profile?.display_name?.split(' ')[0] || 'Scholar';

  return (
    <div
      className="fixed inset-0 z-[105] flex items-end justify-center bg-slate-950/55 p-3 backdrop-blur-xs sm:items-center sm:p-5"
      onClick={markSeenAndClose}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Student App Guide"
        className="ec-card relative w-full max-w-lg overflow-hidden shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        {/* Top gradient bar */}
        <div
          className="px-5 py-4 text-white sm:px-6"
          style={{ background: 'linear-gradient(125deg, var(--ec-brand), var(--ec-secondary))' }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white/15 backdrop-blur-xs">
                {current.icon}
              </span>
              <div>
                <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-white/80">
                  {stepIndex === 0 ? `Welcome, ${firstName}!` : current.badge}
                </p>
                <h2 className="mt-0.5 text-base font-extrabold leading-snug sm:text-lg">{current.title}</h2>
              </div>
            </div>
            <button
              type="button"
              onClick={markSeenAndClose}
              aria-label="Skip guide"
              className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/15 text-white hover:bg-white/25"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="space-y-3.5 p-5 sm:p-6">
          <div className="inline-flex items-center gap-1.5 rounded-xl border border-brand-100 bg-brand-50/70 px-3 py-1.5 text-xs font-bold text-brand-800">
            <HelpCircle size={13} className="shrink-0 text-brand-600" />
            <span>{current.hindiHint}</span>
          </div>

          <p className="text-xs leading-relaxed text-ink-600 sm:text-sm">{current.description}</p>

          <ul className="space-y-2 rounded-2xl border border-ink-100 bg-ink-50/50 p-3.5">
            {current.points.map((point) => (
              <li key={point} className="flex items-start gap-2 text-xs leading-relaxed text-ink-800">
                <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-emerald-600" />
                <span>{point}</span>
              </li>
            ))}
          </ul>

          {current.actionHref && current.actionLabel ? (
            <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
              <Link
                href={current.actionHref}
                onClick={markSeenAndClose}
                className="inline-flex items-center gap-1 text-xs font-bold text-brand-700 hover:underline"
              >
                {current.actionLabel} <ArrowRight size={13} />
              </Link>
              <Link
                href="/feedback"
                onClick={markSeenAndClose}
                className="inline-flex items-center gap-1 text-xs font-semibold text-ink-500 hover:text-ink-800"
              >
                <MessageCircle size={12} /> Need mentor help?
              </Link>
            </div>
          ) : null}

          {/* Progress dots + navigation buttons */}
          <div className="flex items-center justify-between gap-2 border-t border-ink-100 pt-3.5">
            <div className="flex items-center gap-1.5" aria-label={`Step ${stepIndex + 1} of ${TOUR_STEPS.length}`}>
              {TOUR_STEPS.map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  aria-label={`Go to step ${idx + 1}`}
                  onClick={() => setStepIndex(idx)}
                  className={`h-2 rounded-full transition-all ${
                    idx === stepIndex ? 'w-6 bg-brand-600' : 'w-2 bg-ink-200 hover:bg-ink-300'
                  }`}
                />
              ))}
            </div>

            <div className="flex items-center gap-2">
              {stepIndex > 0 ? (
                <button
                  type="button"
                  onClick={() => setStepIndex((i) => i - 1)}
                  className="ecc-btn ecc-btn-outline !min-h-[38px] !px-3 !py-1.5 text-xs"
                >
                  <ArrowLeft size={13} /> Back
                </button>
              ) : (
                <button
                  type="button"
                  onClick={markSeenAndClose}
                  className="px-2.5 py-1.5 text-xs font-semibold text-ink-500 hover:text-ink-800"
                >
                  Skip tour
                </button>
              )}

              {!isLast ? (
                <button
                  type="button"
                  onClick={() => setStepIndex((i) => i + 1)}
                  className="ecc-btn ecc-btn-brand !min-h-[38px] !px-4 !py-1.5 text-xs"
                >
                  Next <ArrowRight size={13} />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={markSeenAndClose}
                  className="ecc-btn ecc-btn-brand !min-h-[38px] !px-4 !py-1.5 text-xs"
                >
                  <Sparkles size={13} /> Start Studying
                </button>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

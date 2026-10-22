'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  Atom,
  Award,
  BookOpenCheck,
  CheckCircle2,
  Compass,
  FileCheck2,
  Flame,
  GraduationCap,
  Layers,
  Pause,
  Play,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Target,
  Timer,
  Trophy,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useSiteConfig } from '@/context/SiteConfigContext';
import { postAuthDestination } from '@/lib/auth-gate';
import { BADGE_CODE_TEMPLATES } from '@/lib/badge-animations';
import { AnimatedBadge } from '@/components/student/AnimatedBadge';
import { Card } from '@/components/ui/Card';
import type { BadgeCategory, BadgeRarity } from '@/types';

type TrackKey = 'JEE' | 'NEET' | 'DROPPER';

const TRACK_DETAILS: Record<
  TrackKey,
  {
    badge: string;
    title: string;
    subtitle: string;
    subjects: string[];
    highlights: string[];
    mockFormat: string;
  }
> = {
  JEE: {
    badge: 'Engineering Entrance · Class 11 & 12',
    title: 'JEE Main & Advanced Structured Preparation',
    subtitle:
      'Chapter-wise Physics, Chemistry & Mathematics queues, high-yield PYQ sheets, and full NTA-pattern timed mock exams.',
    subjects: ['Physics Mechanics & Electrodynamics', 'Organic, Inorganic & Physical Chemistry', 'Calculus, Algebra & Coordinate Geometry'],
    highlights: [
      'Ordered subject lecture queues — zero YouTube distraction',
      '+4 / -1 NTA mock tests with instant question-wise review',
      'Subject accuracy analytics + live rank board',
    ],
    mockFormat: '90 / 75 Qs · 180 Mins · +4 / -1 Marking',
  },
  NEET: {
    badge: 'Medical Entrance · Class 11 & 12',
    title: 'NEET UG NCERT-Focused Mastery Path',
    subtitle:
      'Line-by-line NCERT Biology, Chemistry & Physics lectures paired with high-speed assertion-reason & statement mock tests.',
    subjects: ['Botany & Zoology NCERT Complete', 'Physical, Organic & Inorganic Chemistry', 'High-Scoring Medical Physics'],
    highlights: [
      'Chapter-by-chapter NCERT lecture & PDF note sequence',
      '720-mark NEET mock tests with negative-marking control',
      'Weak-topic detection & mentor doubt threads',
    ],
    mockFormat: '180 Qs · 720 Marks · Speed & Accuracy Analysis',
  },
  DROPPER: {
    badge: 'Dedicated Rank Booster · Class 11 + 12 Combined',
    title: 'Dropper Full-Syllabus Rank Improvement Programme',
    subtitle:
      'Unlocks Class 11, Class 12, and dedicated Dropper revision batches together so repeat-year aspirants cover 100% syllabus systematically.',
    subjects: ['Combined Class 11 + Class 12 Syllabus Access', 'High-Weightage Revision Marathons', 'Weekly Full-Syllabus Rank Tests'],
    highlights: [
      'Automatic Class 11 + 12 + Dropper cohort access verified on server',
      'Daily focus timer + daily ranker target checklist',
      'Milestone badges for consistency & mock test breakthroughs',
    ],
    mockFormat: 'Full Syllabus + Part Tests · All-Cohort Leaderboard',
  },
};

const SHOWCASE_BADGES: Array<{
  id: string;
  title: string;
  rarity: BadgeRarity;
  category: BadgeCategory;
  howToEarn: string;
  code: string;
}> = [
  {
    id: 'maharathi',
    title: 'Physics Maharathi',
    rarity: 'legendary',
    category: 'course_completion',
    howToEarn: 'Complete all lectures & PDF DPPs in Physics Mechanics queue.',
    code: BADGE_CODE_TEMPLATES[0].code,
  },
  {
    id: 'topper-90',
    title: 'Mock Topper 90%+',
    rarity: 'epic',
    category: 'test_performance',
    howToEarn: 'Score 90% or above in any scheduled timed mock exam.',
    code: BADGE_CODE_TEMPLATES[1].code,
  },
  {
    id: 'streak-14',
    title: '14-Day Streak Star',
    rarity: 'rare',
    category: 'consistency',
    howToEarn: 'Maintain a 14-day uninterrupted lecture & test practice streak.',
    code: BADGE_CODE_TEMPLATES[4].code,
  },
  {
    id: 'verified-scholar',
    title: 'Verified Scholar',
    rarity: 'rare',
    category: 'verified',
    howToEarn: 'Awarded to verified disciplined scholars with active batch progress.',
    code: BADGE_CODE_TEMPLATES[2].code,
  },
];

const STEPS = [
  {
    num: '01',
    title: 'Select Your Exam & Class',
    body: 'Choose JEE or NEET and Class 11, Class 12, or Dropper in 30 seconds. Your entire dashboard filters to your exact syllabus.',
    icon: <GraduationCap size={20} />,
  },
  {
    num: '02',
    title: 'Follow Subject Lecture Queues',
    body: 'Open your batch, choose Physics / Chemistry / Maths / Biology, watch ordered lectures without distraction, and download PDF notes.',
    icon: <Layers size={20} />,
  },
  {
    num: '03',
    title: 'Attempt Timed Mock Tests',
    body: 'Practice real exam timers, +4/-1 marking, instant scorecards, question explanations, and live rank leaderboards.',
    icon: <FileCheck2 size={20} />,
  },
  {
    num: '04',
    title: 'Track Streaks & Earn Animated Badges',
    body: 'Use the built-in Pomodoro Focus Timer, complete daily checklists, ask mentor doubts, and unlock animated honours.',
    icon: <Award size={20} />,
  },
];

export default function PublicHomePage() {
  const { user, profile, initializing, bootstrapStatus, bootstrapError, isAdmin, refresh, signOut } = useAuth();
  const { config } = useSiteConfig();
  const router = useRouter();

  const [selectedTrack, setSelectedTrack] = useState<TrackKey>('JEE');
  const [activeBadgeId, setActiveBadgeId] = useState<string>(SHOWCASE_BADGES[0].id);
  const [demoSeconds, setDemoSeconds] = useState<number>(25 * 60);
  const [demoRunning, setDemoRunning] = useState<boolean>(false);

  useEffect(() => {
    if (initializing || !user) return;
    if (bootstrapStatus !== 'ready') return;
    router.replace(postAuthDestination({ hasProfile: Boolean(profile), isAdmin }));
  }, [user, profile, initializing, bootstrapStatus, isAdmin, router]);

  useEffect(() => {
    if (!demoRunning) return;
    const id = window.setInterval(() => {
      setDemoSeconds((prev) => (prev <= 1 ? 25 * 60 : prev - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, [demoRunning]);

  if (user && bootstrapStatus === 'error') {
    return (
      <div className="mx-auto max-w-lg px-4 py-16">
        <Card className="p-6 text-center">
          <h1 className="text-lg font-bold">Could not load your profile</h1>
          <p className="mt-1 text-sm text-ink-500">{bootstrapError || 'Please try again.'}</p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={() => void refresh()}
              className="rounded-button bg-brand-600 px-4 py-2 text-sm font-semibold text-white"
            >
              Retry
            </button>
            <button
              type="button"
              onClick={() => void signOut()}
              className="rounded-button border border-ink-200 px-4 py-2 text-sm font-semibold"
            >
              Sign out
            </button>
          </div>
        </Card>
      </div>
    );
  }

  if (user && (initializing || bootstrapStatus === 'loading')) {
    return (
      <div className="grid min-h-screen place-items-center px-4">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
          <p className="mt-3 text-sm font-semibold text-ink-600">Opening your Exam Cracker workspace…</p>
        </div>
      </div>
    );
  }

  const brandName = config.theme.brandName || 'Exam Cracker';
  const track = TRACK_DETAILS[selectedTrack];
  const selectedBadge = SHOWCASE_BADGES.find((b) => b.id === activeBadgeId) || SHOWCASE_BADGES[0];
  const timerMins = String(Math.floor(demoSeconds / 60)).padStart(2, '0');
  const timerSecs = String(demoSeconds % 60).padStart(2, '0');

  return (
    <div className="min-h-screen bg-[#f8f9fc] text-slate-900 pb-20 md:pb-0">
      {/* TOP STICKY NAVBAR */}
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link href="/" className="flex min-w-0 items-center gap-2.5">
            <span
              className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-xs font-extrabold text-white shadow-xs"
              style={{ background: 'linear-gradient(135deg, var(--ec-brand), var(--ec-secondary))' }}
            >
              {config.theme.logoText || 'EC'}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-base font-extrabold tracking-tight text-slate-900">
                {brandName}
              </span>
              <span className="hidden truncate text-[10.5px] font-semibold uppercase tracking-[0.12em] text-slate-500 sm:block">
                JEE · NEET · Class 11, 12 &amp; Dropper
              </span>
            </span>
          </Link>

          <nav className="hidden items-center gap-6 text-xs font-bold text-slate-600 md:flex">
            <a href="#tracks" className="transition hover:text-brand-700">
              Courses
            </a>
            <a href="#how-it-works" className="transition hover:text-brand-700">
              How It Works
            </a>
            <a href="#badges-preview" className="transition hover:text-brand-700">
              Animated Badges
            </a>
            <a href="#study-tools" className="transition hover:text-brand-700">
              Focus Toolkit
            </a>
          </nav>

          <div className="flex shrink-0 items-center gap-2">
            <Link
              href="/login"
              className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
            >
              Sign in
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-3.5 py-2 text-xs font-bold text-white shadow-xs transition hover:bg-brand-700"
            >
              Start Free <ArrowRight size={13} />
            </Link>
          </div>
        </div>
      </header>

      {/* HERO SECTION */}
      <section className="relative overflow-hidden border-b border-slate-200/80 bg-white">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-80 opacity-60"
          style={{
            background:
              'radial-gradient(60% 90% at 15% 0%, rgba(109, 40, 217, 0.10), transparent 70%), radial-gradient(50% 80% at 85% 5%, rgba(14, 165, 233, 0.09), transparent 70%)',
          }}
          aria-hidden="true"
        />

        <div className="relative mx-auto grid max-w-6xl items-center gap-8 px-4 py-10 sm:px-6 sm:py-14 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:gap-12 lg:py-16">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-bold text-brand-700">
              <Sparkles size={13} /> Built for Serious JEE &amp; NEET Rankers
            </span>

            <h1 className="mt-4 text-3xl font-extrabold leading-[1.12] tracking-[-0.03em] text-slate-900 sm:text-4xl lg:text-[2.75rem]">
              Structured Batches, Real Timed Mock Tests &amp; Zero Distraction.
            </h1>

            <p className="mt-4 max-w-xl text-sm leading-relaxed text-slate-600 sm:text-base">
              Stop losing hours in scattered playlists. <strong>{brandName}</strong> organises your exact{' '}
              <strong>JEE Main / Advanced</strong>, <strong>NEET UG</strong>, or <strong>Dropper</strong> syllabus into
              subject-wise lecture queues, PDF notes, NTA-style tests, daily focus timers, and milestone badges.
            </p>

            <div className="mt-6 flex flex-col gap-2.5 sm:flex-row sm:items-center">
              <Link
                href="/login"
                className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-xl bg-brand-600 px-6 py-3 text-sm font-extrabold text-white shadow-sm transition hover:bg-brand-700"
              >
                Start Free Preparation <ArrowRight size={16} />
              </Link>
              <a
                href="#how-it-works"
                className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
              >
                <Compass size={16} className="text-brand-600" /> See How It Works
              </a>
            </div>

            <div className="mt-7 grid grid-cols-3 gap-2.5 border-t border-slate-100 pt-6 sm:gap-4">
              {[
                { value: 'Batch → Queue', label: 'Chapter-wise video & PDF notes' },
                { value: '+4 / -1 Timer', label: 'Real exam scoring & solutions' },
                { value: '100% Focused', label: 'Built-in study timer & streaks' },
              ].map((stat) => (
                <div key={stat.value} className="min-w-0">
                  <p className="truncate text-sm font-extrabold text-slate-900 sm:text-base">{stat.value}</p>
                  <p className="mt-0.5 text-[11px] leading-snug text-slate-500">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* RIGHT HERO CARD: INTERACTIVE TRACK EXPLORER */}
          <div id="tracks" className="rounded-3xl border border-slate-200 bg-white p-4 shadow-lg shadow-slate-200/60 sm:p-6">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-brand-700">
                Choose Your Exam Track
              </p>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700 border border-emerald-200">
                <ShieldCheck size={12} /> Personalised Syllabus
              </span>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-1.5 rounded-2xl bg-slate-100 p-1">
              {[
                { id: 'JEE' as const, label: 'JEE', icon: <Atom size={14} /> },
                { id: 'NEET' as const, label: 'NEET', icon: <Stethoscope size={14} /> },
                { id: 'DROPPER' as const, label: 'Dropper', icon: <Target size={14} /> },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setSelectedTrack(tab.id)}
                  className={`inline-flex items-center justify-center gap-1.5 rounded-xl px-2.5 py-2 text-xs font-extrabold transition ${
                    selectedTrack === tab.id
                      ? 'bg-white text-brand-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.icon} {tab.label}
                </button>
              ))}
            </div>

            <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
              <span className="text-[10.5px] font-bold uppercase tracking-[0.1em] text-brand-700">{track.badge}</span>
              <h2 className="mt-1 text-base font-extrabold text-slate-900 sm:text-lg">{track.title}</h2>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-600">{track.subtitle}</p>

              <div className="mt-3 flex flex-wrap gap-1.5">
                {track.subjects.map((sub) => (
                  <span
                    key={sub}
                    className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700"
                  >
                    {sub}
                  </span>
                ))}
              </div>

              <ul className="mt-3.5 space-y-1.5 border-t border-slate-200/70 pt-3">
                {track.highlights.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-xs text-slate-700">
                    <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-emerald-600" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white px-3 py-2 border border-slate-200/80">
                <span className="text-[11px] font-bold text-slate-600">{track.mockFormat}</span>
                <Link href="/login" className="inline-flex items-center gap-1 text-xs font-extrabold text-brand-700 hover:underline">
                  Join {selectedTrack} Track <ArrowRight size={13} />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4-STEP CLARITY SECTION */}
      <section id="how-it-works" className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
        <div className="max-w-2xl">
          <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-brand-700">
            Simple &amp; Clear Workflow
          </p>
          <h2 className="mt-1.5 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
            How Your Daily Study Works on {brandName}
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Designed so even a first-time student on a mobile phone understands every feature in 30 seconds — complete
            with an automatic step-by-step tutorial on login.
          </p>
        </div>

        <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step) => (
            <div
              key={step.num}
              className="flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs transition hover:-translate-y-0.5 hover:border-brand-300"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-brand-700">
                    {step.icon}
                  </span>
                  <span className="font-mono text-xs font-extrabold text-slate-400">STEP {step.num}</span>
                </div>
                <h3 className="mt-4 text-base font-extrabold text-slate-900">{step.title}</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-600">{step.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* INTERACTIVE ANIMATED BADGES + FOCUS STUDY TIMER SHOWCASE */}
      <section id="badges-preview" className="border-y border-slate-200/80 bg-white">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-2 lg:items-center">
          {/* ANIMATED BADGES WALL */}
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-brand-700">
              Gamified Motivation · Live Coded Animations
            </p>
            <h2 className="mt-1.5 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
              Earn Animated Badges as You Master Chapters &amp; Tests
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Mentors design custom badges with uploaded artwork, custom CSS/JS motion effects, and crystal-clear{' '}
              <strong>Kaise Milega</strong> rules so every lecture and mock test feels rewarding.
            </p>

            <div className="mt-5 grid grid-cols-2 gap-3">
              {SHOWCASE_BADGES.map((badge) => (
                <button
                  key={badge.id}
                  type="button"
                  onClick={() => setActiveBadgeId(badge.id)}
                  className={`flex items-center gap-3 rounded-2xl border p-3 text-left transition ${
                    activeBadgeId === badge.id
                      ? 'border-brand-500 bg-brand-50/60 ring-1 ring-brand-200'
                      : 'border-slate-200 bg-slate-50/40 hover:bg-slate-50'
                  }`}
                >
                  <AnimatedBadge
                    badge={{
                      title: badge.title,
                      category: badge.category,
                      rarity: badge.rarity,
                      animation_preset: 'custom',
                      animation_code: badge.code,
                    }}
                    size="sm"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-xs font-extrabold text-slate-900">{badge.title}</p>
                    <p className="mt-0.5 capitalize text-[11px] font-semibold text-brand-700">{badge.rarity}</p>
                  </div>
                </button>
              ))}
            </div>

            <div className="mt-4 rounded-2xl border border-brand-100 bg-brand-50/50 p-4 flex items-center gap-4">
              <div className="shrink-0">
                <AnimatedBadge
                  badge={{
                    title: selectedBadge.title,
                    category: selectedBadge.category,
                    rarity: selectedBadge.rarity,
                    animation_preset: 'custom',
                    animation_code: selectedBadge.code,
                  }}
                  size="lg"
                />
              </div>
              <div className="min-w-0">
                <p className="text-[10.5px] font-extrabold uppercase tracking-[0.12em] text-brand-700">
                  Kaise Milega · How to Unlock
                </p>
                <p className="mt-0.5 text-sm font-extrabold text-slate-900">{selectedBadge.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-700">{selectedBadge.howToEarn}</p>
              </div>
            </div>
          </div>

          {/* INTERACTIVE RANKER FOCUS TIMER PREVIEW */}
          <div id="study-tools" className="rounded-3xl border border-slate-200 bg-slate-50/70 p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <span className="grid h-10 w-10 place-items-center rounded-2xl bg-brand-600 text-white">
                  <Timer size={19} />
                </span>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">Built-In Ranker Study Suite</h3>
                  <p className="text-xs text-slate-500">Included inside every student dashboard</p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-bold text-amber-800 border border-amber-200">
                <Flame size={12} /> Streak + Timer
              </span>
            </div>

            <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-2xs">
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">
                Try Live Pomodoro Focus Timer
              </p>
              <p className="mt-2 font-mono text-4xl font-extrabold tracking-tight text-slate-900 tabular-nums">
                {timerMins}:{timerSecs}
              </p>
              <div className="mt-4 flex justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setDemoRunning((r) => !r)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2 text-xs font-bold text-white hover:bg-brand-700"
                >
                  {demoRunning ? <Pause size={14} /> : <Play size={14} />}
                  {demoRunning ? 'Pause' : 'Test Timer'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDemoRunning(false);
                    setDemoSeconds(25 * 60);
                  }}
                  className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                >
                  <RotateCcw size={13} /> Reset
                </button>
              </div>
            </div>

            <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
              {[
                {
                  icon: <BookOpenCheck size={15} className="text-brand-600" />,
                  title: 'Daily Target Checklist',
                  desc: 'Plan daily lectures, DPPs & PYQs with completion progress.',
                },
                {
                  icon: <Trophy size={15} className="text-amber-600" />,
                  title: 'Exam Day Countdown',
                  desc: 'Keep your exact JEE / NEET target exam date in sight daily.',
                },
              ].map((feat) => (
                <div key={feat.title} className="rounded-2xl border border-slate-200/80 bg-white p-3.5">
                  <div className="flex items-center gap-2">
                    {feat.icon}
                    <p className="text-xs font-extrabold text-slate-900">{feat.title}</p>
                  </div>
                  <p className="mt-1 text-[11px] leading-relaxed text-slate-500">{feat.desc}</p>
                </div>
              ))}
            </div>

            <Link
              href="/login"
              className="mt-5 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-xs font-extrabold text-white transition hover:bg-slate-800"
            >
              Open Full Student Dashboard <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </section>

      {/* CLEAN FOOTER */}
      <footer className="bg-white py-8 text-xs text-slate-500">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 sm:flex-row sm:px-6">
          <p className="font-semibold text-slate-700">
            © {new Date().getFullYear()} {brandName} — Structured JEE &amp; NEET Learning Platform
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <Link href="/login" className="font-semibold text-slate-600 hover:text-brand-700">
              Student Sign In
            </Link>
            <Link href="/admin" className="font-semibold text-slate-600 hover:text-brand-700">
              Educator Console
            </Link>
          </div>
        </div>
      </footer>

      {/* MOBILE STICKY BOTTOM CTA BAR */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 p-2.5 pb-[calc(0.65rem+env(safe-area-inset-bottom))] backdrop-blur-md md:hidden">
        <div className="mx-auto flex max-w-md items-center gap-2">
          <Link
            href="/login"
            className="flex min-h-[42px] flex-1 items-center justify-center rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-800"
          >
            Sign In
          </Link>
          <Link
            href="/login"
            className="flex min-h-[42px] flex-[1.5] items-center justify-center gap-1.5 rounded-xl bg-brand-600 text-xs font-extrabold text-white"
          >
            Start Free Prep <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </div>
  );
}

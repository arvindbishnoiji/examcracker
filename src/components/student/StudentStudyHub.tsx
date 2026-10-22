'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Award,
  BookOpenCheck,
  CalendarClock,
  Check,
  CheckCircle2,
  Compass,
  FileCheck2,
  Flame,
  MessageCircle,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Timer,
  Trash2,
  Trophy,
} from 'lucide-react';
import type { CourseCatalogItem, ExamTrack, TestCardItem } from '@/types';
import { openStudentTour } from './StudentTour';

interface DailyTask {
  id: string;
  label: string;
  done: boolean;
}

const TIMER_PRESETS = [
  { minutes: 25, label: '25m Concept' },
  { minutes: 45, label: '45m PYQs' },
  { minutes: 60, label: '60m Revision' },
  { minutes: 180, label: '3h Mock Mode' },
] as const;

function todayKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function defaultTargetDateForExam(exam: ExamTrack): string {
  // Upcoming January/May exam window based on exam track
  return exam === 'JEE' ? '2027-01-24' : '2027-05-02';
}

function defaultTasksForExam(exam: ExamTrack): DailyTask[] {
  const coreSubject = exam === 'JEE' ? 'Physics & Maths' : 'Biology & Chemistry';
  return [
    { id: 't1', label: `Watch 2 ${coreSubject} lectures with notes`, done: false },
    { id: 't2', label: 'Solve 30 previous-year MCQs with timer', done: false },
    { id: 't3', label: 'Revise short notes & formula sheet before sleep', done: false },
  ];
}

function formatClock(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hrs = Math.floor(safe / 3600);
  const mins = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  if (hrs > 0) {
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function StudentStudyHub({
  uid,
  exam,
  enrolledCount,
  liveTestsCount,
  totalTestsCount,
  earnedBadgesCount,
  streak,
  resumeLecture,
  resumeWatchedMinutes = 0,
  nextTest,
}: {
  uid: string;
  exam: ExamTrack;
  enrolledCount: number;
  liveTestsCount: number;
  totalTestsCount: number;
  earnedBadgesCount: number;
  streak: number;
  resumeLecture?: CourseCatalogItem | null;
  resumeWatchedMinutes?: number;
  nextTest?: TestCardItem | null;
}) {
  const day = todayKey();
  const planKey = `ec-daily-plan:${uid}:${day}`;
  const targetDateKey = `ec-exam-date:${uid}:${exam}`;
  const focusMinutesKey = `ec-focus-mins:${uid}:${day}`;

  const [tasks, setTasks] = useState<DailyTask[]>(() => defaultTasksForExam(exam));
  const [newTaskText, setNewTaskText] = useState('');
  const [examDate, setExamDate] = useState<string>(() => defaultTargetDateForExam(exam));
  const [editingDate, setEditingDate] = useState(false);

  // Focus timer state
  const [selectedMinutes, setSelectedMinutes] = useState<number>(25);
  const [secondsLeft, setSecondsLeft] = useState<number>(25 * 60);
  const [running, setRunning] = useState<boolean>(false);
  const [todayFocusMinutes, setTodayFocusMinutes] = useState<number>(0);

  useEffect(() => {
    try {
      const savedTasks = window.localStorage.getItem(planKey);
      if (savedTasks) {
        const parsed = JSON.parse(savedTasks);
        if (Array.isArray(parsed) && parsed.length > 0) setTasks(parsed);
      } else {
        setTasks(defaultTasksForExam(exam));
      }
      const savedDate = window.localStorage.getItem(targetDateKey);
      if (savedDate && /^\d{4}-\d{2}-\d{2}$/.test(savedDate)) {
        setExamDate(savedDate);
      } else {
        setExamDate(defaultTargetDateForExam(exam));
      }
      const savedFocus = Number(window.localStorage.getItem(focusMinutesKey) || 0);
      if (Number.isFinite(savedFocus) && savedFocus >= 0) {
        setTodayFocusMinutes(savedFocus);
      }
    } catch {
      // Safe fallback when storage is restricted.
    }
  }, [planKey, targetDateKey, focusMinutesKey, exam]);

  useEffect(() => {
    if (!running) return;
    const interval = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          setRunning(false);
          setTodayFocusMinutes((mins) => {
            const updated = mins + selectedMinutes;
            try {
              window.localStorage.setItem(focusMinutesKey, String(updated));
            } catch {
              // ignore
            }
            return updated;
          });
          return selectedMinutes * 60;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [running, selectedMinutes, focusMinutesKey]);

  function persistTasks(next: DailyTask[]) {
    setTasks(next);
    try {
      window.localStorage.setItem(planKey, JSON.stringify(next));
    } catch {
      // ignore
    }
  }

  function toggleTask(id: string) {
    persistTasks(tasks.map((task) => (task.id === id ? { ...task, done: !task.done } : task)));
  }

  function addTask(event: React.FormEvent) {
    event.preventDefault();
    const label = newTaskText.trim();
    if (!label) return;
    persistTasks([
      ...tasks,
      { id: `custom-${Date.now()}`, label: label.slice(0, 100), done: false },
    ]);
    setNewTaskText('');
  }

  function removeTask(id: string) {
    persistTasks(tasks.filter((t) => t.id !== id));
  }

  const completedTasks = tasks.filter((t) => t.done).length;
  const planProgress = tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0;

  const daysRemaining = useMemo(() => {
    const targetMs = Date.parse(`${examDate}T00:00:00`);
    if (Number.isNaN(targetMs)) return null;
    return Math.max(0, Math.ceil((targetMs - Date.now()) / 86_400_000));
  }, [examDate]);

  const timerProgress = Math.max(
    0,
    Math.min(100, Math.round(((selectedMinutes * 60 - secondsLeft) / Math.max(1, selectedMinutes * 60)) * 100))
  );

  return (
    <div className="space-y-4">
      {/* 1. FOUR CLEAR NAVIGATION PILLARS (MOBILE 2x2 / DESKTOP 4-COL) */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
        <Link
          href="/lectures"
          className="ecc-card group flex-row items-center gap-3 p-3.5 transition hover:border-brand-300"
        >
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700">
            <BookOpenCheck size={19} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-extrabold text-ink-900 sm:text-sm">Batches &amp; Notes</p>
            <p className="truncate text-[11px] text-ink-500">
              {enrolledCount > 0 ? `${enrolledCount} unlocked courses` : 'Explore courses'}
            </p>
          </div>
          <ArrowRight size={14} className="hidden shrink-0 text-ink-400 transition group-hover:translate-x-0.5 sm:block" />
        </Link>

        <Link
          href="/tests"
          className="ecc-card group flex-row items-center gap-3 p-3.5 transition hover:border-emerald-300"
        >
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
            <FileCheck2 size={19} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-extrabold text-ink-900 sm:text-sm">Mock Tests</p>
            <p className="truncate text-[11px] text-ink-500">
              {liveTestsCount > 0 ? `${liveTestsCount} live right now` : `${totalTestsCount} practice tests`}
            </p>
          </div>
          <ArrowRight size={14} className="hidden shrink-0 text-ink-400 transition group-hover:translate-x-0.5 sm:block" />
        </Link>

        <Link
          href="/leaderboard"
          className="ecc-card group flex-row items-center gap-3 p-3.5 transition hover:border-amber-300"
        >
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-50 text-amber-700">
            <Trophy size={19} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-extrabold text-ink-900 sm:text-sm">Rank Board</p>
            <p className="truncate text-[11px] text-ink-500">
              {earnedBadgesCount > 0 ? `${earnedBadgesCount} badges unlocked` : 'Check live rankings'}
            </p>
          </div>
          <ArrowRight size={14} className="hidden shrink-0 text-ink-400 transition group-hover:translate-x-0.5 sm:block" />
        </Link>

        <div className="ecc-card flex-row items-center gap-2.5 p-3.5">
          <Link href="/feedback" className="flex min-w-0 flex-1 items-center gap-2.5">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-sky-50 text-sky-700">
              <MessageCircle size={19} />
            </span>
            <div className="min-w-0">
              <p className="truncate text-xs font-extrabold text-ink-900 sm:text-sm">Doubts &amp; Guide</p>
              <p className="truncate text-[11px] text-ink-500">Ask mentor or tour</p>
            </div>
          </Link>
          <button
            type="button"
            onClick={openStudentTour}
            title="Open Step-by-Step App Tutorial"
            className="shrink-0 rounded-lg border border-brand-200 bg-brand-50 px-2 py-1 text-[11px] font-bold text-brand-700 hover:bg-brand-100"
          >
            Guide
          </button>
        </div>
      </div>

      {/* 2. SMART NEXT STEP STRIP (RESUME LECTURE + LIVE TEST QUICK LAUNCH) */}
      {(resumeLecture || nextTest) ? (
        <div className="ecc-card p-3.5 sm:p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3 min-w-0">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-600 text-white">
                <Compass size={17} />
              </span>
              <div className="min-w-0">
                <p className="text-[10.5px] font-extrabold uppercase tracking-[0.12em] text-brand-700">
                  Recommended Next Step
                </p>
                <p className="mt-0.5 truncate text-sm font-bold text-ink-900">
                  {resumeLecture ? resumeLecture.title : nextTest?.title}
                </p>
                <p className="text-xs text-ink-500">
                  {resumeLecture
                    ? resumeWatchedMinutes > 0
                      ? `Watched ${resumeWatchedMinutes} min · Continue right where you left off`
                      : `Start this ${exam} lecture now`
                    : `${nextTest?.totalQuestions || 0} questions · Timed mock test`}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {resumeLecture ? (
                <Link
                  href={`/lectures/${resumeLecture.id}`}
                  className="ecc-btn ecc-btn-brand !min-h-[38px] !px-4 !py-1.5 text-xs"
                >
                  {resumeWatchedMinutes > 0 ? 'Resume Lecture' : 'Watch Lecture'} <ArrowRight size={13} />
                </Link>
              ) : null}
              {nextTest ? (
                <Link
                  href={`/tests/${nextTest.id}`}
                  className="ecc-btn ecc-btn-outline !min-h-[38px] !px-3.5 !py-1.5 text-xs"
                >
                  {nextTest.isLive ? 'Live Mock Test' : 'Practice Test'} <ArrowRight size={13} />
                </Link>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {/* 3. RANKER COMMAND DECK: DAILY STUDY PLANNER + POMODORO FOCUS TIMER */}
      <div className="grid gap-3.5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        {/* DAILY STUDY CHECKLIST + EXAM COUNTDOWN */}
        <section className="ecc-card p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm font-extrabold text-ink-900 sm:text-base">
                  Today&apos;s Ranker Study Plan
                </h2>
                {streak > 0 ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2.5 py-0.5 text-[11px] font-bold text-orange-700 border border-orange-200">
                    <Flame size={11} /> {streak}d Streak
                  </span>
                ) : null}
              </div>
              <p className="mt-0.5 text-xs text-ink-500">
                {completedTasks}/{tasks.length} daily targets done ({planProgress}%)
              </p>
            </div>

            <button
              type="button"
              onClick={() => setEditingDate((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-brand-200 bg-brand-50/80 px-2.5 py-1 text-[11px] font-bold text-brand-800 hover:bg-brand-100"
              title="Click to customize your target exam date"
            >
              <CalendarClock size={13} className="text-brand-600" />
              {daysRemaining !== null ? `${exam} Target: ${daysRemaining} days left` : `${exam} Countdown`}
            </button>
          </div>

          {editingDate ? (
            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-ink-200 bg-ink-50/70 p-2.5 text-xs">
              <label htmlFor="ec-target-date" className="font-semibold text-ink-700">
                Target {exam} Exam Date:
              </label>
              <input
                id="ec-target-date"
                type="date"
                value={examDate}
                onChange={(e) => {
                  const val = e.target.value;
                  setExamDate(val);
                  try {
                    window.localStorage.setItem(targetDateKey, val);
                  } catch {
                    // ignore
                  }
                }}
                className="rounded-lg border border-ink-200 bg-white px-2.5 py-1 text-xs font-semibold"
              />
              <button
                type="button"
                onClick={() => setEditingDate(false)}
                className="ml-auto rounded-lg bg-brand-600 px-2.5 py-1 text-[11px] font-bold text-white"
              >
                Done
              </button>
            </div>
          ) : null}

          <div className="ecc-bar mt-3 !h-2">
            <span style={{ width: `${planProgress}%` }} />
          </div>

          <ul className="mt-3 space-y-2">
            {tasks.map((task) => (
              <li
                key={task.id}
                className={`flex items-center justify-between gap-2.5 rounded-xl border px-3 py-2 text-xs transition ${
                  task.done
                    ? 'border-emerald-200 bg-emerald-50/50 text-ink-500'
                    : 'border-ink-100 bg-ink-50/30 text-ink-900'
                }`}
              >
                <button
                  type="button"
                  onClick={() => toggleTask(task.id)}
                  className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                >
                  <span
                    className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border transition ${
                      task.done
                        ? 'border-emerald-600 bg-emerald-600 text-white'
                        : 'border-ink-300 bg-white'
                    }`}
                  >
                    {task.done ? <Check size={12} strokeWidth={3} /> : null}
                  </span>
                  <span className={`truncate font-medium ${task.done ? 'line-through' : ''}`}>
                    {task.label}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => removeTask(task.id)}
                  aria-label={`Remove ${task.label}`}
                  className="text-ink-400 hover:text-red-600 p-1"
                >
                  <Trash2 size={13} />
                </button>
              </li>
            ))}
          </ul>

          <form onSubmit={addTask} className="mt-3 flex gap-2">
            <input
              value={newTaskText}
              onChange={(e) => setNewTaskText(e.target.value)}
              maxLength={100}
              placeholder="Add today's chapter goal (e.g. Rotational Motion DPP)…"
              className="ec-field !py-2 text-xs flex-1"
            />
            <button
              type="submit"
              disabled={!newTaskText.trim()}
              className="ecc-btn ecc-btn-brand !min-h-[38px] !px-3.5 !py-1.5 text-xs shrink-0 disabled:opacity-50"
            >
              <Plus size={14} /> Add
            </button>
          </form>
        </section>

        {/* DISTRACTION-FREE POMODORO / MOCK FOCUS TIMER */}
        <section className="ecc-card p-4 sm:p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="grid h-8 w-8 place-items-center rounded-xl bg-brand-50 text-brand-700">
                  <Timer size={17} />
                </span>
                <div>
                  <h2 className="text-sm font-extrabold text-ink-900 sm:text-base">Focus Study Timer</h2>
                  <p className="text-[11px] text-ink-500">Phone side rakhein · pure deep work</p>
                </div>
              </div>
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800">
                Today: {todayFocusMinutes}m
              </span>
            </div>

            <div className="mt-3 grid grid-cols-4 gap-1.5">
              {TIMER_PRESETS.map((preset) => (
                <button
                  key={preset.minutes}
                  type="button"
                  onClick={() => {
                    setRunning(false);
                    setSelectedMinutes(preset.minutes);
                    setSecondsLeft(preset.minutes * 60);
                  }}
                  className={`rounded-xl border px-2 py-1.5 text-[11px] font-bold transition ${
                    selectedMinutes === preset.minutes
                      ? 'border-brand-500 bg-brand-600 text-white'
                      : 'border-ink-200 bg-ink-50/50 text-ink-700 hover:bg-ink-100'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          <div className="my-4 rounded-2xl border border-ink-100 bg-ink-50/60 p-4 text-center">
            <p className="font-mono text-3xl font-extrabold tracking-tight text-ink-900 tabular-nums sm:text-4xl">
              {formatClock(secondsLeft)}
            </p>
            <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-ink-200/70">
              <div
                className="h-full rounded-full bg-brand-600 transition-all"
                style={{ width: `${timerProgress}%` }}
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setRunning((r) => !r)}
              className="ecc-btn ecc-btn-brand flex-1 !min-h-[40px] text-xs"
            >
              {running ? (
                <>
                  <Pause size={14} /> Pause Session
                </>
              ) : (
                <>
                  <Play size={14} /> Start Focus Session
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => {
                setRunning(false);
                setSecondsLeft(selectedMinutes * 60);
              }}
              aria-label="Reset timer"
              className="ecc-btn ecc-btn-outline !min-h-[40px] !px-3 text-xs"
            >
              <RotateCcw size={14} />
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

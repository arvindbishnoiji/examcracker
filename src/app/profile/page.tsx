'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { BookOpenCheck, GraduationCap, LogOut, MessageCircle, PlayCircle, Sparkles, Timer, Trophy } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { getStudentAnalysis, getStudentTests } from '@/lib/api';
import { Card, Badge, Skeleton } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { formatWatchDuration } from '@/lib/date';
import type { AnalysisResponse, TestCardItem } from '@/types';

export default function ProfileAnalysisPage() {
  const { profile, user, bootstrap, signOut } = useAuth();
  const [analysis, setAnalysis] = useState<AnalysisResponse | null>(null);
  const [tests, setTests] = useState<TestCardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [analysisData, testData] = await Promise.all([getStudentAnalysis(), getStudentTests().catch(() => [])]);
      setAnalysis(analysisData);
      setTests(testData);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load your analysis.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const testTitles = useMemo(() => new Map(tests.map((test) => [test.id, test.title])), [tests]);
  const lectureTitles = useMemo(
    () => new Map((bootstrap?.content || []).map((item) => [item.id, item.title])),
    [bootstrap?.content]
  );

  if (!profile) {
    return (
      <div className="mx-auto max-w-lg py-16 text-center text-sm text-ink-500">
        Finishing onboarding is required before your profile can load.
      </div>
    );
  }

  const initials = profile.display_name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

  const scoreWidth = analysis && analysis.totalMaxScore > 0 ? Math.min(100, Math.max(0, (analysis.totalScore / analysis.totalMaxScore) * 100)) : 0;
  const average = analysis?.averagePercentage || 0;

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <Card className="relative overflow-hidden p-5 sm:p-6">
        <div className="ec-grid-texture pointer-events-none absolute inset-0 opacity-70" aria-hidden />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start">
          <span className="ec-avatar h-16 w-16 shrink-0 text-xl">{initials || 'S'}</span>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-extrabold tracking-tight sm:text-2xl">{profile.display_name}</h1>
            <p className="mt-0.5 text-sm text-ink-500">{profile.email || user?.email || 'Signed-in student'}</p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <Badge variant="info"><GraduationCap size={10} className="mr-0.5" /> {profile.exam}</Badge>
              <Badge>Class {profile.class_level}</Badge>
              {analysis && <Badge variant="success"><Trophy size={10} className="mr-0.5" /> {analysis.level}</Badge>}
              <Badge variant="default"><BookOpenCheck size={10} className="mr-0.5" /> {bootstrap?.enrollments?.length || 0} active courses</Badge>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/chat"
              className="ec-btn inline-flex items-center gap-1.5 bg-brand-600 px-3.5 py-2 text-xs font-bold text-white"
            >
              <MessageCircle size={14} /> Ask a doubt
            </Link>
            <Button variant="outline" size="sm" onClick={() => void signOut()}>
              <LogOut size={13} className="mr-1.5" /> Sign out
            </Button>
          </div>
        </div>
      </Card>

      {loading && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((index) => (
            <Skeleton key={index} className="h-24" />
          ))}
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
          <Button size="sm" variant="outline" className="ml-2" onClick={() => void load()}>
            Retry
          </Button>
        </div>
      )}

      {analysis && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: 'Tests taken', value: analysis.testsTaken, icon: <BookOpenCheck size={15} />, hint: 'Submitted attempts' },
              { label: 'Average score', value: analysis.testsTaken ? `${average.toFixed(0)}%` : '—', icon: <Trophy size={15} />, hint: 'Across attempts' },
              { label: 'Lessons completed', value: analysis.completedLessons, icon: <PlayCircle size={15} />, hint: `${analysis.lessonProgress.length} touched` },
              { label: 'Watch time', value: formatWatchDuration(analysis.watchedSeconds), icon: <Timer size={15} />, hint: 'Real player progress' },
            ].map((stat) => (
              <Card key={stat.label} className="p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-ink-500">{stat.label}</p>
                  <span className="text-brand-600">{stat.icon}</span>
                </div>
                <p className="mt-1.5 text-2xl font-extrabold leading-none text-ink-900">{stat.value}</p>
                <p className="mt-1 text-[10px] text-ink-400">{stat.hint}</p>
              </Card>
            ))}
          </div>

          <Card className="p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-bold">Learning level · {analysis.level}</p>
                <p className="mt-0.5 text-[11px] text-ink-500">
                  An educational progress indicator based on your real test attempts and watch activity. It is not an
                  official JEE/NEET rank.
                </p>
              </div>
              <span className="ec-level-badge"><Sparkles size={11} /> {analysis.testsTaken} attempts</span>
            </div>
            <div className="mt-3 ec-progress-lg">
              <span style={{ width: `${Math.min(100, Math.max(0, average))}%` }} />
            </div>
            <div className="mt-1.5 flex items-center justify-between text-[10px] text-ink-500">
              <span>Average across submitted tests</span>
              <span>{average.toFixed(1)}%</span>
            </div>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <Card className="p-4 sm:p-5">
              <h2 className="flex items-center gap-1.5 text-sm font-bold"><BookOpenCheck size={15} className="text-brand-600" /> Recent attempts</h2>
              {analysis.attempts.length ? (
                <div className="mt-3 space-y-2">
                  {analysis.attempts.slice(0, 5).map((attempt) => (
                    <div key={attempt.id} className="flex items-center justify-between gap-3 rounded-xl border border-ink-100 bg-ink-50/60 p-3">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold">{testTitles.get(attempt.test_id) || `Test ${attempt.test_id.slice(0, 8)}`}</p>
                        <p className="text-[10px] text-ink-500">
                          {new Date(attempt.submitted_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-xs font-bold">{attempt.score}/{attempt.max_score}</p>
                        <p className="text-[10px] text-ink-500">{attempt.correct_count}✓ {attempt.incorrect_count}✗ {attempt.unanswered_count}—</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-xs text-ink-500">No attempts yet. Take a test to build your analysis.</p>
              )}
            </Card>

            <Card className="p-4 sm:p-5">
              <h2 className="flex items-center gap-1.5 text-sm font-bold"><PlayCircle size={15} className="text-brand-600" /> Lesson progress</h2>
              {analysis.lessonProgress.length ? (
                <div className="mt-3 space-y-2">
                  {analysis.lessonProgress.slice(0, 5).map((row) => (
                    <div key={row.id || row.lecture_id} className="flex items-center justify-between gap-3 rounded-xl border border-ink-100 bg-ink-50/60 p-3">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold">{lectureTitles.get(row.lecture_id) || `Lesson ${row.lecture_id.slice(0, 8)}`}</p>
                        <p className="text-[10px] text-ink-500">{row.completed ? 'Completed' : 'In progress'}</p>
                      </div>
                      <p className="shrink-0 text-xs font-semibold">{formatWatchDuration(row.watched_seconds)}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-xs text-ink-500">No lesson progress yet. Start a lecture to track it.</p>
              )}
            </Card>
          </div>

          <Card className="p-4 sm:p-5">
            <h2 className="text-sm font-bold">Score summary</h2>
            <p className="mt-1 text-xs text-ink-500">
              {analysis.totalScore}/{analysis.totalMaxScore} total marks across {analysis.testsTaken} submitted test{analysis.testsTaken === 1 ? '' : 's'}.
            </p>
            <div className="mt-3 ec-progress-lg">
              <span style={{ width: `${scoreWidth}%` }} />
            </div>
          </Card>
        </>
      )}

      <Card className="p-4">
        <h2 className="text-sm font-bold">Quick links</h2>
        <div className="mt-2 flex flex-wrap gap-2">
          {[
            { href: '/home', label: 'Home' },
            { href: '/tests', label: 'Tests' },
            { href: '/lectures', label: 'Lectures' },
            { href: '/leaderboard', label: 'Leaderboard' },
            { href: '/chat', label: 'Chat' },
          ].map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="ec-btn border border-ink-200 bg-[var(--ec-surface)] px-3 py-1.5 text-xs font-semibold hover:bg-ink-50"
            >
              {link.label}
            </Link>
          ))}
        </div>
      </Card>
    </div>
  );
}

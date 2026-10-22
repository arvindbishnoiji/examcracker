'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { BookOpenCheck, GraduationCap, LogOut, MessageCircle, Pencil, PlayCircle, Sparkles, Timer, Trophy } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useSiteConfig } from '@/context/SiteConfigContext';
import { getStudentAnalysis, getStudentTests, saveStudentProfile } from '@/lib/api';
import { Card, Badge, Skeleton } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/hooks/useToast';
import { formatWatchDuration } from '@/lib/date';
import { formatClassLevel } from '@/lib/validation';
import type { AnalysisResponse, ClassLevel, ExamTrack, StudentProfile, TestCardItem } from '@/types';
import { visibleSectionIds } from '@/lib/screen-config';
import { ScreenAnnouncementBanner, ScreenHelpNote, ScreenPageHeader } from '@/components/student/ScreenScaffold';
import { pageIdentity } from '@/lib/page-identity';
import { ProfileAvatar } from '@/components/student/ProfileAvatar';

export default function ProfileAnalysisPage() {
  const { profile, user, bootstrap, signOut, refresh } = useAuth();
  const { config } = useSiteConfig();
  const screen = config.profile;
  const { push } = useToast();
  const [analysis, setAnalysis] = useState<AnalysisResponse | null>(null);
  const [tests, setTests] = useState<TestCardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [form, setForm] = useState<{ displayName: string; exam: ExamTrack; classLevel: ClassLevel }>({
    displayName: '',
    exam: 'JEE',
    classLevel: '11',
  });

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

  useEffect(() => {
    if (!profile) return;
    setForm({ displayName: profile.display_name, exam: profile.exam, classLevel: profile.class_level });
  }, [profile]);

  useEffect(() => {
    if (!editing) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setEditing(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editing]);

  const testTitles = useMemo(() => new Map(tests.map((test) => [test.id, test.title])), [tests]);
  const lectureTitles = useMemo(
    () => new Map((bootstrap?.content || []).map((item) => [item.id, item.title])),
    [bootstrap?.content]
  );

  async function handleSaveProfile(event: React.FormEvent) {
    event.preventDefault();
    setEditError(null);
    if (form.displayName.trim().length < 2) {
      setEditError('Enter your full name (at least 2 characters).');
      return;
    }
    setSaving(true);
    try {
      await saveStudentProfile({
        displayName: form.displayName.trim(),
        exam: form.exam,
        classLevel: form.classLevel,
      });
      await refresh();
      push('Profile updated.', 'success');
      setEditing(false);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'We could not save your profile. Try again.');
    } finally {
      setSaving(false);
    }
  }

  if (!profile) {
    return (
      <div className="mx-auto max-w-lg py-16 text-center text-sm text-ink-500">
        Finishing onboarding is required before your profile can load.
      </div>
    );
  }

  // Narrowed once here so nested render helpers keep the non-null profile type.
  const currentProfile: StudentProfile = profile;

  const scoreWidth =
    analysis && analysis.totalMaxScore > 0
      ? Math.min(100, Math.max(0, (analysis.totalScore / analysis.totalMaxScore) * 100))
      : 0;
  const average = analysis?.averagePercentage || 0;
  const sections = visibleSectionIds('profile', screen);

  function renderSection(id: string) {
    if (id === 'identity') {
      return (
        <Card key={id} className="relative overflow-hidden p-5 sm:p-6">
          <div className="ec-grid-texture pointer-events-none absolute inset-0 opacity-70" aria-hidden />
          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start">
            <div className="shrink-0">
              <ProfileAvatar profile={currentProfile} size="lg" onUpdated={() => void refresh()} />
            </div>
            <div className="min-w-0 flex-1">
              {screen.heroEyebrow ? (
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-brand-700">{screen.heroEyebrow}</p>
              ) : null}
              <h2 className="text-xl font-extrabold tracking-tight sm:text-2xl">{profile?.display_name}</h2>
              <p className="mt-0.5 text-sm text-ink-500">{profile?.email || user?.email || 'Signed-in student'}</p>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <Badge variant="info"><GraduationCap size={10} className="mr-0.5" /> {profile?.exam}</Badge>
                <Badge>{formatClassLevel(profile?.class_level)}</Badge>
                {profile?.class_level === 'Dropper' && (
                  <Badge variant="info">11th + 12th + Dropper Access</Badge>
                )}
                {analysis && screen.showLevel ? (
                  <Badge variant="success"><Trophy size={10} className="mr-0.5" /> {analysis.level}</Badge>
                ) : null}
                <Badge variant="default">
                  <BookOpenCheck size={10} className="mr-0.5" /> {bootstrap?.enrollments?.length || 0} active courses
                </Badge>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/feedback"
                className="ec-btn inline-flex items-center gap-1.5 bg-brand-600 px-3.5 py-2 text-xs font-bold text-white"
              >
                <MessageCircle size={14} /> {screen.askDoubtLabel}
              </Link>
              {screen.allowProfileEdit ? (
                <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                  <Pencil size={13} className="mr-1.5" /> {screen.editLabel}
                </Button>
              ) : null}
              <Button variant="outline" size="sm" onClick={() => void signOut()}>
                <LogOut size={13} className="mr-1.5" /> {screen.signOutLabel}
              </Button>
            </div>
          </div>
        </Card>
      );
    }

    if (id === 'stats') {
      if (!screen.showQuickStats) return null;
      return (
        <div key={id} className="space-y-3">
          {loading && !analysis ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[1, 2, 3, 4].map((index) => <Skeleton key={index} className="h-24" />)}
            </div>
          ) : analysis ? (
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
          ) : null}
        </div>
      );
    }

    if (id === 'level') {
      if (!screen.showLevel || !analysis) return null;
      return (
        <Card key={id} className="p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-bold">Learning level · {analysis.level}</p>
              {screen.levelNote ? <p className="mt-0.5 text-[11px] text-ink-500">{screen.levelNote}</p> : null}
            </div>
            <span className="ec-level-badge"><Sparkles size={11} /> {analysis.testsTaken} attempts</span>
          </div>
          <div className="ec-progress-lg mt-3">
            <span style={{ width: `${Math.min(100, Math.max(0, average))}%` }} />
          </div>
          <div className="mt-1.5 flex items-center justify-between text-[10px] text-ink-500">
            <span>Average across submitted tests</span>
            <span>{average.toFixed(1)}%</span>
          </div>
        </Card>
      );
    }

    if (id === 'recent_attempts') {
      if (!screen.showRecentAttempts) return null;
      return (
        <Card key={id} className="p-4 sm:p-5">
          <h2 className="text-sm font-bold">{screen.recentAttemptsTitle}</h2>
          {!analysis ? null : analysis.attempts.length ? (
            <div className="mt-3 space-y-2">
              {analysis.attempts.slice(0, 5).map((attempt) => (
                <div key={attempt.id} className="flex items-center justify-between gap-3 rounded-xl border border-ink-100 bg-ink-50/60 p-3">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold">
                      {testTitles.get(attempt.test_id) || `Test ${attempt.test_id.slice(0, 8)}`}
                    </p>
                    <p className="text-[10px] text-ink-500">
                      {new Date(attempt.submitted_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-xs font-bold">{attempt.score}/{attempt.max_score}</p>
                    <p className="text-[10px] text-ink-500">
                      {attempt.correct_count}✓ {attempt.incorrect_count}✗ {attempt.unanswered_count}—
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-xs text-ink-500">{screen.emptyAttempts}</p>
          )}
        </Card>
      );
    }

    if (id === 'lesson_progress') {
      if (!screen.showLessonProgress) return null;
      return (
        <Card key={id} className="p-4 sm:p-5">
          <h2 className="text-sm font-bold">{screen.lessonProgressTitle}</h2>
          {!analysis ? null : analysis.lessonProgress.length ? (
            <div className="mt-3 space-y-2">
              {analysis.lessonProgress.slice(0, 6).map((row) => (
                <Link
                  key={row.id || row.lecture_id}
                  href={`/lectures/${row.lecture_id}`}
                  className="flex items-center justify-between gap-3 rounded-xl border border-ink-100 bg-ink-50/60 p-3 transition hover:border-brand-200 hover:bg-brand-50/30"
                >
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-ink-900">
                      {lectureTitles.get(row.lecture_id) || `Lesson ${row.lecture_id.slice(0, 8)}`}
                    </p>
                    <p className="text-[10px] text-ink-500">{row.completed ? 'Completed · Rewatch' : 'In progress · Resume'}</p>
                  </div>
                  <p className="shrink-0 text-xs font-semibold tabular-nums text-brand-700">{formatWatchDuration(row.watched_seconds)}</p>
                </Link>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-xs text-ink-500">{screen.emptyProgress}</p>
          )}
        </Card>
      );
    }

    if (id === 'score_summary') {
      if (!screen.showScoreSummary || !analysis) return null;
      return (
        <Card key={id} className="p-4 sm:p-5">
          <h2 className="text-sm font-bold">{screen.scoreSummaryTitle}</h2>
          <p className="mt-1 text-xs text-ink-500">
            {analysis.totalScore}/{analysis.totalMaxScore} total marks across {analysis.testsTaken} submitted test
            {analysis.testsTaken === 1 ? '' : 's'}.
          </p>
          <div className="ec-progress-lg mt-3">
            <span style={{ width: `${scoreWidth}%` }} />
          </div>
        </Card>
      );
    }

    if (id === 'quick_links') {
      if (!screen.showQuickLinks) return null;
      return (
        <Card key={id} className="p-4">
          <h2 className="text-sm font-bold">{screen.quickLinksTitle}</h2>
          <div className="mt-2 flex flex-wrap gap-2">
            {[
              { href: '/home', label: 'Home' },
              { href: '/tests', label: 'Tests' },
              { href: '/lectures', label: 'Lectures' },
              { href: '/leaderboard', label: 'Leaderboard' },
              { href: '/feedback', label: 'Feedback' },
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
      );
    }
    return null;
  }


  return (
    <div className="mx-auto max-w-5xl space-y-5">
      {screen.showHeader ? (
        <ScreenPageHeader
        identity={pageIdentity('profile')}
          eyebrow={screen.eyebrow}
          title={screen.pageTitle}
          description={screen.pageSubtitle}
        />
      ) : null}

      <ScreenAnnouncementBanner announcement={screen.announcement} />

      {loading && !analysis ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((index) => <Skeleton key={index} className="h-24" />)}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
          <Button size="sm" variant="outline" className="ml-2" onClick={() => void load()}>
            Try again
          </Button>
        </div>
      ) : null}

      {sections.map((id) => renderSection(id))}

      <ScreenHelpNote help={screen.help} />

      {editing ? (
        <div className="fixed inset-0 z-[90] flex items-start justify-center overflow-y-auto bg-black/45 p-3 sm:p-6">
          <div className="absolute inset-0" onClick={() => setEditing(false)} aria-hidden />
          <div
            role="dialog"
            aria-modal="true"
            aria-label={screen.editLabel}
            className="relative z-10 my-6 w-full max-w-md ec-card overflow-hidden"
          >
            <div className="flex items-start justify-between gap-3 border-b border-ink-100 px-5 py-4">
              <div>
                <h2 className="text-base font-bold">{screen.editLabel}</h2>
                <p className="mt-0.5 text-xs text-ink-500">
                  Your exam and class control which lectures, tests and leaderboards you can see.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditing(false)}
                aria-label="Close"
                className="grid h-8 w-8 place-items-center rounded-lg text-ink-500 hover:bg-ink-100"
              >
                ✕
              </button>
            </div>
            <form id="ec-profile-edit" onSubmit={handleSaveProfile} className="space-y-3 px-5 py-4">
              {editError ? (
                <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800">
                  {editError}
                </div>
              ) : null}
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-ink-700">Full name <span className="text-red-500">*</span></span>
                <input
                  className="ec-field"
                  value={form.displayName}
                  maxLength={80}
                  onChange={(event) => setForm({ ...form, displayName: event.target.value })}
                  autoComplete="name"
                  required
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-ink-700">Exam</span>
                <select
                  className="ec-field"
                  value={form.exam}
                  onChange={(event) => setForm({ ...form, exam: event.target.value as ExamTrack })}
                >
                  <option value="JEE">JEE</option>
                  <option value="NEET">NEET</option>
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-ink-700">Class</span>
                <select
                  className="ec-field"
                  value={form.classLevel}
                  onChange={(event) => setForm({ ...form, classLevel: event.target.value as ClassLevel })}
                >
                  <option value="11">Class 11</option>
                  <option value="12">Class 12</option>
                  <option value="Dropper">Dropper (Class 11 + 12 + Dropper syllabus)</option>
                </select>
              </label>
              <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-900">
                {form.classLevel === 'Dropper'
                  ? `Dropper students can access eligible Class 11, Class 12, and Dropper content for ${form.exam}. Course enrollment rules stay verified on the server.`
                  : 'Changing your exam or class hides content outside your selected cohort. Course access stays verified by the server.'}
              </p>
            </form>
            <div className="flex justify-end gap-2 border-t border-ink-100 px-5 py-3">
              <Button variant="outline" size="sm" onClick={() => setEditing(false)}>
                Cancel
              </Button>
              <Button size="sm" type="submit" form="ec-profile-edit" loading={saving}>
                Save changes
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

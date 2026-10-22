'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { getTestForAttempt, submitTestAttempt, getSubmittedTestResult, ApiError } from '@/lib/api';
import { Card, Badge, Skeleton } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/admin/ui';
import { useToast } from '@/hooks/useToast';
import { formatCountdown } from '@/lib/date';
import { useSiteConfig } from '@/context/SiteConfigContext';
import type { TestQuestion } from '@/types';
import { visibleSectionIds } from '@/lib/screen-config';
import { ScreenAnnouncementBanner, ScreenHelpNote } from '@/components/student/ScreenScaffold';

export default function TestAttemptPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const { push } = useToast();
  const { config } = useSiteConfig();
  const screen = config.testPlayer;
  const sections = visibleSectionIds('testPlayer', screen);
  const [test, setTest] = useState<any>(null);
  const [questions, setQuestions] = useState<TestQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [currentIdx, setCurrentIdx] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [confirmSubmitOpen, setConfirmSubmitOpen] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [result, setResult] = useState<any>(null);
  const timerRef = useRef<number | null>(null);
  const submitLockRef = useRef(false);
  const submitHandlerRef = useRef<(isAuto?: boolean) => Promise<void>>(async () => {});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      try {
        const data = await getTestForAttempt(id);
        setTest(data.test);
        setQuestions(data.questions);
        if (data.test.durationMinutes) {
          setTimeLeft(data.test.durationMinutes * 60);
        }
        const draftRaw = localStorage.getItem(`ec_test_draft_${id}`);
        if (draftRaw) {
          try {
            const d = JSON.parse(draftRaw);
            if (d && typeof d === 'object') setAnswers(d);
          } catch {}
        }
      } catch (e) {
        if (e instanceof ApiError && (e.status === 409 || e.status === 403)) {
          try {
            const res = await getSubmittedTestResult(id);
            setResult(res);
            setShowResult(true);
            setTest({ id, title: 'Test Result', description: '' });
          } catch {
            throw e;
          }
        } else {
          throw e;
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load test');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const hasTimer = timeLeft !== null;
  useEffect(() => {
    if (!hasTimer || showResult) return;
    timerRef.current = window.setInterval(() => {
      setTimeLeft((s) => {
        if (s === null) return null;
        if (s <= 1) {
          if (timerRef.current !== null) window.clearInterval(timerRef.current);
          timerRef.current = null;
          void submitHandlerRef.current(true);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => {
      if (timerRef.current !== null) window.clearInterval(timerRef.current);
      timerRef.current = null;
    };
  }, [hasTimer, showResult]);

  useEffect(() => {
    if (questions.length) localStorage.setItem(`ec_test_draft_${id}`, JSON.stringify(answers));
  }, [answers, id, questions.length]);

  async function executeSubmit() {
    if (!questions.length || submitLockRef.current) return;
    submitLockRef.current = true;
    setSubmitting(true);
    setConfirmSubmitOpen(false);
    let completed = false;
    try {
      const res = await submitTestAttempt(id, answers);
      setResult(res);
      setShowResult(true);
      completed = true;
      localStorage.removeItem(`ec_test_draft_${id}`);
      push('Test submitted — score calculated server-side', 'success');
      if (timerRef.current !== null) window.clearInterval(timerRef.current);
      timerRef.current = null;
    } catch (e) {
      push(e instanceof Error ? e.message : 'Submit failed', 'error');
      try {
        const res = await getSubmittedTestResult(id);
        setResult(res);
        setShowResult(true);
        completed = true;
      } catch {}
    } finally {
      if (!completed) submitLockRef.current = false;
      setSubmitting(false);
    }
  }

  async function handleSubmit(isAuto = false) {
    if (!questions.length || submitLockRef.current) return;
    if (!isAuto) {
      setConfirmSubmitOpen(true);
      return;
    }
    await executeSubmit();
  }
  submitHandlerRef.current = handleSubmit;

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-4">
        <Skeleton className="h-36 w-full" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card className="p-6 text-center">
          <p className="font-bold text-ink-900">{error}</p>
          <p className="mt-1.5 text-sm text-ink-500">
            This test may be scheduled for a different window, scoped to another exam or class cohort, or already submitted.
            Your previous result opens automatically whenever an attempt exists.
          </p>
          <div className="flex gap-2 justify-center mt-5">
            <Button variant="outline" onClick={() => router.back()}>
              Go back
            </Button>
            <Link href="/tests" className="ec-btn px-4 py-2 bg-brand-600 text-white rounded-xl text-sm font-semibold">
              Browse tests
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  if (showResult && result) {
    const { attempt, result: summary, review } = result;
    const totalQuestionsCount = summary.correct + summary.incorrect + summary.unanswered;
    return (
      <div className="mx-auto max-w-4xl space-y-5">
        <ScreenAnnouncementBanner announcement={screen.announcement} />
        <Card className="bg-gradient-to-br from-slate-900 via-brand-900 to-brand-700 p-6 sm:p-7 text-white border-0 shadow-lg">
          <span className="inline-flex rounded-full bg-white/15 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-brand-100">
            Server-Verified Scorecard
          </span>
          <h1 className="mt-2 text-2xl font-bold tracking-tight">
            {screen.resultTitle} · {test?.title || id.slice(0, 8)}
          </h1>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
            <div className="bg-white/10 border border-white/15 rounded-xl p-3.5 text-center">
              <p className="text-2xl font-bold tabular-nums">
                {summary.score}/{summary.maxScore}
              </p>
              <p className="text-xs text-white/75 mt-0.5">Total Score</p>
            </div>
            <div className="bg-white/10 border border-white/15 rounded-xl p-3.5 text-center">
              <p className="text-2xl font-bold tabular-nums">
                {summary.correct}/{totalQuestionsCount}
              </p>
              <p className="text-xs text-white/75 mt-0.5">Correct</p>
            </div>
            <div className="bg-white/10 border border-white/15 rounded-xl p-3.5 text-center">
              <p className="text-2xl font-bold tabular-nums">{summary.incorrect}</p>
              <p className="text-xs text-white/75 mt-0.5">Incorrect</p>
            </div>
            <div className="bg-white/10 border border-white/15 rounded-xl p-3.5 text-center">
              <p className="text-2xl font-bold tabular-nums">{Math.round(summary.percentage)}%</p>
              <p className="text-xs text-white/75 mt-0.5">Accuracy</p>
            </div>
          </div>
          <p className="text-xs text-white/75 mt-4">
            Unanswered: {summary.unanswered} • Scored authoritatively on Cloudflare D1
          </p>
          <div className="flex flex-wrap gap-2.5 mt-5">
            <Link
              href={`/leaderboard?testId=${id}`}
              className="ec-btn bg-white px-4 py-2 text-sm font-bold text-brand-800 shadow-sm"
            >
              {screen.leaderboardCtaLabel}
            </Link>
            <Link
              href="/tests"
              className="ec-btn px-4 py-2 bg-white/15 text-white rounded-xl text-sm font-semibold border border-white/25 hover:bg-white/25"
            >
              Back to tests
            </Link>
          </div>
        </Card>

        {sections.includes('review') ? (
          <section className="space-y-3">
            <div className="ec-section-header">
              <div>
                <p className="ec-eyebrow">Post-Test Analysis</p>
                <h2 className="ec-section-title">{screen.reviewTitle}</h2>
              </div>
            </div>
            {review?.length ? (
              review.map((r: any, idx: number) => (
                <Card
                  key={r.questionId || idx}
                  className={`p-4 border-l-4 ${r.isCorrect ? 'border-l-emerald-500' : 'border-l-red-500'}`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-bold text-sm text-ink-900">
                      Question {idx + 1} <span className="text-xs font-normal text-ink-400">({r.questionId})</span>
                    </p>
                    <Badge variant={r.isCorrect ? 'success' : 'danger'}>
                      {r.isCorrect ? 'Correct' : r.answer ? 'Incorrect' : 'Unattempted'} • {r.marksAwarded} marks
                    </Badge>
                  </div>
                  <p className="text-sm text-ink-700 mt-2 leading-relaxed">
                    {r.explanation || 'No explanation provided for this question.'}
                  </p>
                  <div className="flex flex-wrap gap-2 mt-3">
                    <Badge>Your response: {r.answer || '—'}</Badge>
                    <Badge variant="info">Correct key: {r.correctAnswer || '—'}</Badge>
                  </div>
                </Card>
              ))
            ) : (
              <Card className="p-4 text-sm text-ink-500">{screen.reviewEmpty}</Card>
            )}
          </section>
        ) : null}

        <Card className="border-dashed bg-ink-50/70 p-4 text-xs text-ink-500">
          <p>
            Attempt {attempt.id.slice(0, 8)} • Submitted{' '}
            {new Date(attempt.submitted_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST • Score
            calculated server-side.
          </p>
        </Card>

        <ScreenHelpNote help={screen.help} />
      </div>
    );
  }

  const q = questions[currentIdx];
  const answeredCount = Object.keys(answers).length;
  const total = questions.length;
  const unansweredCount = Math.max(0, total - answeredCount);

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <ScreenAnnouncementBanner announcement={screen.announcement} />

      <div className="grid gap-5 lg:grid-cols-[1fr_310px]">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-ink-200 bg-[var(--ec-surface)] px-4 py-3.5 shadow-sm">
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-ink-900">{test?.title}</h1>
              <p className="text-xs sm:text-sm text-ink-500">
                {test?.subject || 'General'}
                {test?.durationMinutes ? ` • ${test.durationMinutes} min` : ''}
                {` • ${total} questions`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {timeLeft !== null && (
                <div
                  role="timer"
                  aria-live="off"
                  className={`rounded-xl px-3.5 py-2 font-mono text-sm font-bold tabular-nums ${
                    timeLeft < screen.timerWarningMinutes * 60
                      ? 'bg-red-600 text-white animate-pulse'
                      : 'bg-ink-900 text-white'
                  }`}
                >
                  {formatCountdown(timeLeft)}
                </div>
              )}
              <Link
                href="/tests"
                className="ec-btn border border-ink-200 bg-[var(--ec-surface)] px-3 py-2 text-xs sm:text-sm font-semibold"
              >
                {screen.exitLabel}
              </Link>
            </div>
          </div>

          <Card className="p-0 overflow-hidden">
            <div className="p-4 bg-ink-50/80 border-b border-ink-100 flex flex-wrap items-center justify-between gap-2">
              <p className="font-bold text-sm text-ink-900">
                Question {currentIdx + 1} <span className="font-normal text-ink-500">of {total}</span>
              </p>
              <div className="flex items-center gap-2 text-xs">
                <span className="px-2.5 py-1 bg-white border border-ink-200 rounded-full font-semibold">
                  {answeredCount}/{total} answered
                </span>
                {q?.marks !== undefined && (
                  <span className="px-2.5 py-1 bg-brand-50 border border-brand-200 rounded-full font-semibold text-brand-700">
                    +{q.marks} / -{q.negativeMarks || 0}
                  </span>
                )}
              </div>
            </div>

            <div className="p-5 sm:p-6">
              {q ? (
                <div className="space-y-4">
                  <p className="text-base font-medium leading-relaxed text-ink-900 whitespace-pre-line">{q.text}</p>
                  {q.imageUrl && (
                    <img
                      src={q.imageUrl}
                      alt={`Question ${currentIdx + 1} diagram`}
                      className="max-w-full rounded-xl border border-ink-100 bg-white p-2"
                    />
                  )}
                  <div className="space-y-2.5">
                    {q.options.map((opt) => {
                      const selected = answers[q.id] === opt.id;
                      return (
                        <label
                          key={opt.id}
                          className={`flex items-center gap-3 p-3.5 rounded-xl border cursor-pointer transition ${
                            selected
                              ? 'bg-brand-50 border-brand-400 ring-1 ring-brand-200'
                              : 'bg-white border-ink-200 hover:bg-ink-50/70'
                          }`}
                        >
                          <input
                            type="radio"
                            name={`q-${q.id}`}
                            checked={selected}
                            onChange={() => setAnswers((a) => ({ ...a, [q.id]: opt.id }))}
                            className="h-4 w-4 text-brand-600"
                          />
                          <span className="font-bold text-sm w-6 text-ink-800">{opt.id}.</span>
                          <span className="text-sm flex-1 text-ink-800">{opt.text}</span>
                        </label>
                      );
                    })}
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!answers[q.id]}
                      onClick={() =>
                        setAnswers((a) => {
                          const n = { ...a };
                          delete n[q.id];
                          return n;
                        })
                      }
                    >
                      {screen.clearAnswerLabel}
                    </Button>
                    <span className="text-xs text-ink-400">
                      Responses auto-save locally while your attempt is active.
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-ink-500">No question data.</p>
              )}
            </div>

            <div className="p-4 bg-white border-t border-ink-100 flex items-center justify-between">
              <Button variant="outline" disabled={currentIdx === 0} onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))}>
                ← Previous
              </Button>
              <div className="flex gap-2">
                {currentIdx < total - 1 ? (
                  <Button onClick={() => setCurrentIdx((i) => Math.min(total - 1, i + 1))}>Next →</Button>
                ) : (
                  <Button onClick={() => void handleSubmit(false)} loading={submitting}>
                    {screen.submitLabel}
                  </Button>
                )}
              </div>
            </div>
          </Card>

          {sections.includes('warning') ? (
            <Card className="border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
              <p>
                Submitting sends your answers to the server for scoring. The server response is authoritative, and
                duplicate attempts are blocked unless your mentor allows them for this test.
              </p>
            </Card>
          ) : null}
        </div>

        <aside className="space-y-3">
          <Card className="p-4 lg:sticky lg:top-20">
            <h3 className="mb-3 font-bold text-sm text-ink-900">{screen.paletteTitle}</h3>
            <div className="grid grid-cols-5 gap-2">
              {questions.map((qq, idx) => {
                const isAnswered = !!answers[qq.id];
                const isCurrent = idx === currentIdx;
                return (
                  <button
                    key={qq.id}
                    type="button"
                    onClick={() => setCurrentIdx(idx)}
                    aria-label={`Question ${idx + 1}${isAnswered ? ', answered' : ', unanswered'}`}
                    className={`h-9 w-9 rounded-xl text-xs font-bold border transition ${
                      isCurrent
                        ? 'bg-brand-600 text-white border-brand-600 shadow-sm'
                        : isAnswered
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                          : 'bg-white border-ink-200 text-ink-700 hover:bg-ink-50'
                    }`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>
            <div className="flex flex-wrap gap-1.5 mt-3.5 text-[11px]">
              <span className="px-2 py-0.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-full font-medium">
                Answered ({answeredCount})
              </span>
              <span className="px-2 py-0.5 bg-white border border-ink-200 text-ink-600 rounded-full font-medium">
                Unanswered ({unansweredCount})
              </span>
            </div>
            <Button
              className="w-full mt-4"
              variant="danger"
              onClick={() => void handleSubmit(false)}
              loading={submitting}
            >
              {screen.submitLabel} · {answeredCount}/{total}
            </Button>
            <p className="mt-2 text-center text-[11px] text-ink-400">
              Submit once — the server records your attempt and guards against duplicates.
            </p>
          </Card>

          <ScreenHelpNote help={screen.help} />

          {screen.showInstructions && sections.includes('instructions') ? (
            <Card className="p-4">
              <h4 className="text-sm font-bold text-ink-900">{screen.instructionsTitle}</h4>
              <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-ink-500">
                {screen.instructions.map((line, index) => (
                  <li key={index}>{line}</li>
                ))}
              </ul>
            </Card>
          ) : null}
        </aside>
      </div>

      <ConfirmDialog
        open={confirmSubmitOpen}
        loading={submitting}
        tone="brand"
        title="Submit test for final scoring?"
        description={`${
          screen.submitConfirm || 'Submit your answers? You cannot change them after submission.'
        } Answered: ${answeredCount} of ${total}${unansweredCount > 0 ? ` (${unansweredCount} unanswered)` : ''}.`}
        confirmLabel={screen.submitLabel || 'Submit test'}
        cancelLabel="Review answers"
        onCancel={() => setConfirmSubmitOpen(false)}
        onConfirm={() => void executeSubmit()}
      />
    </div>
  );
}

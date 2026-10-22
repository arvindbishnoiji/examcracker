'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  AdminAnalyticsResponse,
  CourseCatalogItem,
  LeaderboardEntry,
  SiteSettingRow,
} from '@/types';
import {
  getAdminAnalytics,
  getAdminContentList,
  getAdminSiteSettings,
  getTestLeaderboard,
} from '@/lib/api';
import { formatClassLevel, isSafeHttpUrl } from '@/lib/validation';
import {
  AdminPageHeader,
  Banner as Callout,
  Panel,
  ProgressBar,
  Spinner,
  StatCard,
  StatusPill,
} from '../ui';

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

export function AnalyticsSection() {
  const [data, setData] = useState<AdminAnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await getAdminAnalytics());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analytics unavailable.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <Spinner label="Crunching real attempt data…" />;

  return (
    <div>
      <AdminPageHeader
        eyebrow="Tests & Ranks"
        title="Student Analytics"
        description="Real-time metrics computed directly from submitted mock test attempts and student profiles."
        actions={
          <button
            type="button"
            onClick={() => void load()}
            className="ec-btn border border-ink-200 bg-[var(--ec-surface)] px-3 py-2 text-xs font-semibold hover:bg-ink-50"
          >
            ⟳ Refresh
          </button>
        }
      />
      {error ? <Callout tone="danger" title="Analytics endpoint unavailable">{error}</Callout> : null}
      {data ? (
        <>
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <StatCard
              label="Students"
              value={data.students.total}
              hint={`${data.students.byExam.JEE || 0} JEE · ${data.students.byExam.NEET || 0} NEET`}
            />
            <StatCard
              label="Attempts"
              value={data.attempts.total}
              hint={`${data.attempts.averagePercentage.toFixed(1)}% average`}
              tone="warning"
            />
            <StatCard
              label="Active content"
              value={data.content.active}
              hint={`${data.content.total} total items`}
              tone="success"
            />
            <StatCard
              label="Enrollments"
              value={data.enrollments.total}
              hint={`${data.enrollments.byItem.length} item groups`}
              tone="info"
            />
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            <Panel title="Attempt volume · last 14 days">
              {data.attempts.last14Days.length ? (
                <div className="flex h-40 items-end gap-1.5">
                  {data.attempts.last14Days.map((day) => {
                    const max = Math.max(1, ...data.attempts.last14Days.map((item) => item.count));
                    return (
                      <div
                        key={day.date}
                        className="flex h-full flex-1 flex-col items-center justify-end gap-1"
                        title={`${day.date}: ${day.count}`}
                      >
                        <div
                          className="w-full rounded-t-md bg-brand-600"
                          style={{ height: `${Math.max(2, (day.count / max) * 100)}%`, opacity: day.count ? 1 : 0.2 }}
                        />
                        <span className="text-[8px] text-ink-400">{day.date.slice(8)}</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-ink-500">No attempts recorded yet.</p>
              )}
            </Panel>

            <Panel title="Exam & class mix">
              <div className="space-y-3">
                {Object.entries(data.students.byExam).map(([exam, count]) => (
                  <ProgressBar key={exam} label={`${exam} students`} value={count} max={Math.max(1, data.students.total)} />
                ))}
                {Object.entries(data.students.byClass).map(([classLevel, count]) => (
                  <ProgressBar
                    key={classLevel}
                    label={formatClassLevel(classLevel)}
                    value={count}
                    max={Math.max(1, data.students.total)}
                    color="var(--ec-accent)"
                  />
                ))}
              </div>
            </Panel>

            <Panel title="Subject performance" description="Averages across every graded question attempt.">
              {data.subjectPerformance.length ? (
                <div className="space-y-3">
                  {data.subjectPerformance.map((subject) => (
                    <div key={subject.subject}>
                      <ProgressBar label={`${subject.subject} · ${subject.attempts} attempts`} value={subject.averagePercentage} />
                      <p className="mt-0.5 text-[10px] text-ink-400">
                        {subject.correct} correct · {subject.incorrect} incorrect · {subject.unanswered} unanswered
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-ink-500">Not enough graded attempts yet.</p>
              )}
            </Panel>

            <Panel title="Top learners" description="Ranked by average percentage with at least one attempt.">
              <ol className="space-y-2">
                {data.attempts.topStudents.map((student, index) => (
                  <li key={student.firebaseUid} className="flex items-center gap-2.5">
                    <span className="grid h-7 w-7 place-items-center rounded-full bg-ink-100 text-[11px] font-bold text-ink-600">
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold">{student.name || 'Unnamed student'}</p>
                      <p className="text-[10px] text-ink-400">{student.attempts} attempts</p>
                    </div>
                    <span className="text-xs font-bold tabular-nums">{student.averagePercentage.toFixed(1)}%</span>
                  </li>
                ))}
                {data.attempts.topStudents.length === 0 ? <p className="text-xs text-ink-500">No attempts yet.</p> : null}
              </ol>
            </Panel>

            <Panel title="Recently joined students">
              <div className="space-y-2">
                {data.students.recent.slice(0, 8).map((student) => (
                  <div key={student.firebase_uid} className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold">{student.display_name || 'Unnamed student'}</p>
                      <p className="truncate text-[10px] text-ink-400">{student.email || student.firebase_uid}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      {student.exam ? <StatusPill tone="brand">{student.exam}</StatusPill> : null}
                      {student.class_level ? <StatusPill tone="neutral">{formatClassLevel(student.class_level)}</StatusPill> : null}
                    </div>
                  </div>
                ))}
                {data.students.recent.length === 0 ? <p className="text-xs text-ink-500">No student profiles yet.</p> : null}
              </div>
            </Panel>

            <Panel title="Enrollment concentration">
              <div className="space-y-3">
                {data.enrollments.byItem.slice(0, 8).map((item) => (
                  <div key={`${item.kind}-${item.itemId}`}>
                    <ProgressBar
                      label={`${item.title || item.itemId} · ${item.kind}`}
                      value={item.count}
                      max={Math.max(1, ...data.enrollments.byItem.map((entry) => entry.count))}
                    />
                  </div>
                ))}
                {data.enrollments.byItem.length === 0 ? <p className="text-xs text-ink-500">No enrollments yet.</p> : null}
              </div>
            </Panel>
          </div>
        </>
      ) : null}
    </div>
  );
}

export function LeaderboardsSection() {
  const [tests, setTests] = useState<CourseCatalogItem[]>([]);
  const [selected, setSelected] = useState<string>('');
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingBoard, setLoadingBoard] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const items = await getAdminContentList({ kind: 'test' });
        if (cancelled) return;
        setTests(items);
        if (items[0]) setSelected(items[0].id);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Unable to load tests.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    setLoadingBoard(true);
    getTestLeaderboard(selected)
      .then((result) => {
        if (!cancelled) setEntries(result.items);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Unable to load leaderboard.');
      })
      .finally(() => {
        if (!cancelled) setLoadingBoard(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selected]);

  if (loading) return <Spinner label="Loading tests…" />;

  return (
    <div>
      <AdminPageHeader
        eyebrow="Tests & Ranks"
        title="Test Leaderboards"
        description="Inspect the real ranking that students see for any test. Rankings come straight from server-scored attempts."
        meta={<StatusPill tone="brand">{tests.length} tests</StatusPill>}
      />
      {error ? <Callout tone="danger">{error}</Callout> : null}
      <div className="mt-4 grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <Panel title="Tests">
          <div className="max-h-[520px] space-y-1.5 overflow-y-auto">
            {tests.map((test) => (
              <button
                key={test.id}
                type="button"
                onClick={() => setSelected(test.id)}
                className={`w-full rounded-lg border px-2.5 py-2 text-left transition ${
                  selected === test.id ? 'border-brand-300 bg-brand-50' : 'border-ink-200 hover:bg-ink-50'
                }`}
              >
                <p className="truncate text-[11px] font-semibold">{test.title}</p>
                <p className="text-[10px] text-ink-400">
                  {test.exam} · Class {test.classes.join(', ')}
                </p>
              </button>
            ))}
            {tests.length === 0 ? <p className="text-xs text-ink-500">No tests yet.</p> : null}
          </div>
        </Panel>
        <Panel title="Ranking" description={selected ? undefined : 'Select a test to inspect its ranking.'}>
          {loadingBoard ? (
            <Spinner label="Loading ranking…" />
          ) : entries.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-ink-100 text-[10px] uppercase tracking-wide text-ink-400">
                  <tr>
                    <th className="py-2 pr-2">Rank</th>
                    <th className="py-2 pr-2">Student</th>
                    <th className="py-2 pr-2 text-right">Score</th>
                    <th className="py-2 text-right">Percentage</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry, index) => (
                    <tr key={`${entry.firebaseUid}-${index}`} className="border-b border-ink-50">
                      <td className="py-2 pr-2 font-bold tabular-nums">{entry.rank || index + 1}</td>
                      <td className="max-w-[220px] truncate py-2 pr-2">{entry.name || 'Student'}</td>
                      <td className="py-2 pr-2 text-right tabular-nums">
                        {entry.score} / {entry.maxScore}
                      </td>
                      <td className="py-2 text-right tabular-nums">
                        {entry.maxScore > 0 ? `${((entry.score / entry.maxScore) * 100).toFixed(1)}%` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-xs text-ink-500">No submitted attempts for this test yet.</p>
          )}
        </Panel>
      </div>
    </div>
  );
}

export function HealthSection() {
  const [items, setItems] = useState<CourseCatalogItem[]>([]);
  const [settings, setSettings] = useState<SiteSettingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getAdminContentList(), getAdminSiteSettings().catch(() => [] as SiteSettingRow[])])
      .then(([content, siteSettings]) => {
        if (cancelled) return;
        setItems(content);
        setSettings(siteSettings);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Unable to scan content.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const issues = useMemo(() => {
    const missingThumbs = items.filter(
      (item) => ['lecture', 'batch', 'series', 'event', 'test'].includes(item.kind) && !asRecord(item.metadata).thumbnailUrl
    );
    const testsNoQuestions = items.filter((item) => {
      if (item.kind !== 'test') return false;
      const meta = asRecord(item.metadata);
      const questions = meta.questions;
      return !Array.isArray(questions) || questions.length === 0;
    });
    const eventsNoSchedule = items.filter((item) => {
      if (item.kind !== 'event') return false;
      const meta = asRecord(item.metadata);
      return !meta.startsAt && !meta.starts_at && !meta.endsAt && !meta.ends_at;
    });
    const inactive = items.filter((item) => !item.active);
    const brokenLinks: string[] = [];
    for (const row of settings) {
      const value = asRecord(row.draft || row.published);
      if (Array.isArray(value.items)) {
        for (const asset of value.items) {
          const url = asRecord(asset).url;
          if (typeof url === 'string' && !isSafeHttpUrl(url)) brokenLinks.push(url);
        }
      }
    }
    return { missingThumbs, testsNoQuestions, eventsNoSchedule, inactive, brokenLinks };
  }, [items, settings]);

  if (loading) return <Spinner label="Scanning content for issues…" />;

  return (
    <div>
      <AdminPageHeader
        eyebrow="Website & Design"
        title="Content Quality Check"
        description="Automated quality checks across all courses, mock tests, and scheduled events."
        meta={
          <>
            <StatusPill tone="brand">{items.length} content items</StatusPill>
            <StatusPill tone="neutral">{settings.length} setting keys stored</StatusPill>
          </>
        }
      />
      {error ? <Callout tone="danger" title="Scan failed">{error}</Callout> : null}
      <div className="mt-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard label="Missing thumbnails" value={issues.missingThumbs.length} tone="warning" hint="Cards render clean fallback" />
        <StatCard label="Tests without questions" value={issues.testsNoQuestions.length} tone="danger" hint="Add questions before live" />
        <StatCard label="Events without schedule" value={issues.eventsNoSchedule.length} tone="warning" hint="Set start/end date" />
        <StatCard label="Hidden items" value={issues.inactive.length} tone="neutral" hint="Not shown to students" />
      </div>

      <div className="mt-4 grid items-start gap-4 xl:grid-cols-2">
        <IssueList
          title="Tests without questions"
          items={issues.testsNoQuestions}
          empty="Every test has a question bank."
          fixHref="/admin/tests"
        />
        <IssueList
          title="Missing custom thumbnails"
          items={issues.missingThumbs}
          empty="Every card has artwork."
          fixHref="/admin/batches"
        />
        <IssueList
          title="Events missing a schedule"
          items={issues.eventsNoSchedule}
          empty="Every event has a schedule."
          fixHref="/admin/events"
        />
        <Panel title="Published Website Configurations" description="Status of each saved page/theme setting.">
          <div className="space-y-1.5">
            {settings.map((row) => (
              <div key={row.key} className="flex items-center justify-between rounded-lg border border-ink-100 px-2.5 py-1.5">
                <span className="text-[11px] font-semibold">{row.key}</span>
                <div className="flex items-center gap-1.5">
                  <StatusPill tone={row.draft ? 'info' : 'neutral'}>{row.draft ? 'draft' : 'no draft'}</StatusPill>
                  <StatusPill tone={row.published ? 'success' : 'warning'}>{row.published ? 'published' : 'default'}</StatusPill>
                </div>
              </div>
            ))}
            {settings.length === 0 ? (
              <p className="text-xs text-ink-500">Default configurations active — edit any section to customize.</p>
            ) : null}
          </div>
        </Panel>
      </div>
    </div>
  );
}

function IssueList({
  title,
  items,
  empty,
  fixHref,
}: {
  title: string;
  items: CourseCatalogItem[];
  empty: string;
  fixHref: string;
}) {
  return (
    <Panel
      title={title}
      action={
        <Link href={fixHref} className="text-[11px] font-semibold text-brand-700">
          Fix →
        </Link>
      }
    >
      {items.length === 0 ? (
        <p className="text-xs text-ink-500">{empty}</p>
      ) : (
        <ul className="max-h-56 space-y-1.5 overflow-y-auto">
          {items.slice(0, 20).map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-2 text-[11px]">
              <span className="truncate">{item.title}</span>
              <StatusPill tone={item.active ? 'warning' : 'neutral'}>{item.kind}</StatusPill>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

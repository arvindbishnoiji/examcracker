'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { readAdminPreferences } from '@/lib/admin-prefs';
import type {
  AdminActivityEntry,
  AdminAnalyticsResponse,
  Banner,
  ChallengesConfig,
  CourseCatalogItem,
  LeaderboardEntry,
  NoticePopup,
  SiteSettingRow,
} from '@/types';
import {
  getAdminActivity,
  getAdminAnalytics,
  getAdminContentList,
  getAdminSiteSettings,
  getTestLeaderboard,
} from '@/lib/api';
import { formatClassLevel, isSafeHttpUrl } from '@/lib/validation';
import { formatISTDateTime } from '@/lib/date';
import { useToast } from '@/hooks/useToast';
import {
  AdminPageHeader,
  Banner as Callout,
  ConfirmDialog,
  Field,
  Pagination,
  Panel,
  ProgressBar,
  SearchInput,
  Segmented,
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
        eyebrow="Tests & performance"
        title="Student Analytics"
        description="Every chart is computed from submitted exam attempts and stored profiles. There are no simulated metrics."
        actions={<button type="button" onClick={() => void load()} className="ec-btn px-3 py-2 text-xs font-semibold border border-ink-200 bg-white">⟳ Refresh</button>}
      />
      {error && <Callout tone="danger" title="Analytics endpoint unavailable">{error}</Callout>}
      {data && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Students" value={data.students.total} hint={`${data.students.byExam.JEE || 0} JEE · ${data.students.byExam.NEET || 0} NEET`} />
            <StatCard label="Attempts" value={data.attempts.total} hint={`${data.attempts.averagePercentage.toFixed(1)}% average`} tone="warning" />
            <StatCard label="Active content" value={data.content.active} hint={`${data.content.total} total items`} tone="success" />
            <StatCard label="Enrollments" value={data.enrollments.total} hint={`${data.enrollments.byItem.length} item groups`} tone="info" />
          </div>

          <div className="grid gap-4 xl:grid-cols-2 mt-4">
            <Panel title="Attempt volume · last 14 days">
              {data.attempts.last14Days.length ? (
                <div className="flex items-end gap-1.5 h-40">
                  {data.attempts.last14Days.map((day) => {
                    const max = Math.max(1, ...data.attempts.last14Days.map((item) => item.count));
                    return (
                      <div key={day.date} className="flex-1 flex flex-col items-center justify-end gap-1 h-full" title={`${day.date}: ${day.count}`}>
                        <div className="w-full rounded-t-md bg-brand-600" style={{ height: `${Math.max(2, (day.count / max) * 100)}%`, opacity: day.count ? 1 : 0.2 }} />
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
                  <ProgressBar key={classLevel} label={`Class ${classLevel}`} value={count} max={Math.max(1, data.students.total)} color="var(--ec-accent)" />
                ))}
              </div>
            </Panel>

            <Panel title="Subject performance" description="Averages across every graded question attempt.">
              {data.subjectPerformance.length ? (
                <div className="space-y-3">
                  {data.subjectPerformance.map((subject) => (
                    <div key={subject.subject}>
                      <ProgressBar label={`${subject.subject} · ${subject.attempts} attempts`} value={subject.averagePercentage} />
                      <p className="text-[10px] text-ink-400 mt-0.5">
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
                    <span className="h-7 w-7 rounded-full bg-ink-100 grid place-items-center text-[11px] font-bold text-ink-600">{index + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold truncate">{student.name || 'Unnamed student'}</p>
                      <p className="text-[10px] text-ink-400">{student.attempts} attempts</p>
                    </div>
                    <span className="text-xs font-bold tabular-nums">{student.averagePercentage.toFixed(1)}%</span>
                  </li>
                ))}
                {data.attempts.topStudents.length === 0 && <p className="text-xs text-ink-500">No attempts yet.</p>}
              </ol>
            </Panel>

            <Panel title="Recently joined students">
              <div className="space-y-2">
                {data.students.recent.slice(0, 8).map((student) => (
                  <div key={student.firebase_uid} className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold truncate">{student.display_name || 'Unnamed student'}</p>
                      <p className="text-[10px] text-ink-400 truncate">{student.email || student.firebase_uid}</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {student.exam && <StatusPill tone="brand">{student.exam}</StatusPill>}
                      {student.class_level && <StatusPill tone="neutral">{formatClassLevel(student.class_level)}</StatusPill>}
                    </div>
                  </div>
                ))}
                {data.students.recent.length === 0 && <p className="text-xs text-ink-500">No student profiles yet.</p>}
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
                {data.enrollments.byItem.length === 0 && <p className="text-xs text-ink-500">No enrollments yet.</p>}
              </div>
            </Panel>
          </div>
        </>
      )}
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
        eyebrow="Tests & performance"
        title="Leaderboards"
        description="Inspect the real ranking that students see for any test. Rankings come straight from server-scored attempts."
        meta={<StatusPill tone="brand">{tests.length} tests</StatusPill>}
      />
      {error && <Callout tone="danger">{error}</Callout>}
      <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)] mt-4">
        <Panel title="Tests">
          <div className="max-h-[520px] overflow-y-auto space-y-1.5">
            {tests.map((test) => (
              <button
                key={test.id}
                type="button"
                onClick={() => setSelected(test.id)}
                className={`w-full text-left rounded-lg border px-2.5 py-2 transition ${
                  selected === test.id ? 'border-brand-300 bg-brand-50' : 'border-ink-200 hover:bg-ink-50'
                }`}
              >
                <p className="text-[11px] font-semibold truncate">{test.title}</p>
                <p className="text-[10px] text-ink-400">{test.exam} · Class {test.classes.join(', ')}</p>
              </button>
            ))}
            {tests.length === 0 && <p className="text-xs text-ink-500">No tests yet.</p>}
          </div>
        </Panel>
        <Panel title="Ranking" description={selected ? undefined : 'Select a test to inspect its ranking.'}>
          {loadingBoard ? (
            <Spinner label="Loading ranking…" />
          ) : entries.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="text-[10px] uppercase tracking-wide text-ink-400 border-b border-ink-100">
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
                      <td className="py-2 pr-2 truncate max-w-[220px]">{entry.name || 'Student'}</td>
                      <td className="py-2 pr-2 text-right tabular-nums">{entry.score} / {entry.maxScore}</td>
                      <td className="py-2 text-right tabular-nums">{entry.maxScore > 0 ? `${((entry.score / entry.maxScore) * 100).toFixed(1)}%` : '—'}</td>
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

function downloadFile(name: string, content: string, type = 'application/json') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function ReportsSection() {
  const [entries, setEntries] = useState<AdminActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    let cancelled = false;
    getAdminActivity(200)
      .then((items) => {
        if (!cancelled) setEntries(items);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Activity log unavailable.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter((entry) => `${entry.action} ${entry.actor_email} ${entry.summary} ${entry.target_type} ${entry.target_id}`.toLowerCase().includes(q));
  }, [entries, query]);

  const csv = useMemo(() => {
    const header = ['created_at', 'actor_email', 'action', 'target_type', 'target_id', 'summary'];
    const rows = filtered.map((entry) =>
      header.map((key) => `"${String((entry as unknown as Record<string, unknown>)[key] ?? '').replace(/"/g, '""')}"`).join(',')
    );
    return [header.join(','), ...rows].join('\n');
  }, [filtered]);

  return (
    <div>
      <AdminPageHeader
        eyebrow="System"
        title="Activity Reports"
        description="A server-side audit trail of every write performed through the admin API. Use it to verify what changed and when."
        actions={
          <button
            type="button"
            disabled={!filtered.length}
            onClick={() => downloadFile(`exam-cracker-activity-${new Date().toISOString().slice(0, 10)}.csv`, csv, 'text/csv')}
            className="ec-btn px-3 py-2 text-xs font-semibold bg-brand-600 text-white disabled:opacity-50"
          >
            Export CSV
          </button>
        }
      />
      {error && <Callout tone="danger" title="Cannot load activity">{error} — this route ships with the updated Edge Function.</Callout>}
      <Panel className="mt-4" title="Audit log" action={<SearchInput value={query} onChange={setQuery} placeholder="Search actor, action or target…" />}>
        {loading ? (
          <Spinner label="Loading audit trail…" />
        ) : filtered.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-[10px] uppercase tracking-wide text-ink-400 border-b border-ink-100">
                <tr>
                  <th className="py-2 pr-3">When (IST)</th>
                  <th className="py-2 pr-3">Actor</th>
                  <th className="py-2 pr-3">Action</th>
                  <th className="py-2 pr-3">Target</th>
                  <th className="py-2">Summary</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((entry) => (
                  <tr key={entry.id} className="border-b border-ink-50 align-top">
                    <td className="py-2 pr-3 whitespace-nowrap text-ink-500">{formatISTDateTime(entry.created_at)}</td>
                    <td className="py-2 pr-3">{entry.actor_email}</td>
                    <td className="py-2 pr-3"><StatusPill tone="neutral">{entry.action}</StatusPill></td>
                    <td className="py-2 pr-3 text-ink-500">{entry.target_type}{entry.target_id ? ` · ${entry.target_id.slice(0, 12)}` : ''}</td>
                    <td className="py-2 text-ink-700">{entry.summary}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-xs text-ink-500">No recorded writes yet. Publishing settings or changing content creates entries here.</p>
        )}
      </Panel>
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
    const missingThumbs = items.filter((item) =>
      ['lecture', 'batch', 'series', 'event', 'test'].includes(item.kind) && !asRecord(item.metadata).thumbnailUrl
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
      const media = asRecord(value);
      if (Array.isArray(media.items)) {
        for (const asset of media.items) {
          const url = asRecord(asset).url;
          if (typeof url === 'string' && !isSafeHttpUrl(url)) brokenLinks.push(url);
        }
      }
    }
    return { missingThumbs, testsNoQuestions, eventsNoSchedule, inactive, brokenLinks };
  }, [items, settings]);

  if (loading) return <Spinner label="Scanning content for real issues…" />;

  return (
    <div>
      <AdminPageHeader
        eyebrow="System"
        title="System & Content Health"
        description="Deterministic checks over stored content and settings. Each result is a real record you can open and fix."
        meta={
          <>
            <StatusPill tone="brand">{items.length} content items</StatusPill>
            <StatusPill tone="neutral">{settings.length} setting keys stored</StatusPill>
          </>
        }
      />
      {error && <Callout tone="danger" title="Scan failed">{error}</Callout>}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 mt-4">
        <StatCard label="Missing thumbnails" value={issues.missingThumbs.length} tone="warning" hint="Cards render without artwork" />
        <StatCard label="Tests without questions" value={issues.testsNoQuestions.length} tone="danger" hint="Students cannot attempt them" />
        <StatCard label="Events without schedule" value={issues.eventsNoSchedule.length} tone="warning" hint="No countdown or derived state" />
        <StatCard label="Inactive content" value={issues.inactive.length} tone="neutral" hint="Hidden from students" />
      </div>

      <div className="grid gap-4 xl:grid-cols-2 mt-4 items-start">
        <IssueList title="Tests without questions" items={issues.testsNoQuestions} empty="Every test has a question bank." fixHref="/admin/tests" />
        <IssueList title="Missing thumbnails" items={issues.missingThumbs} empty="Every card has artwork." fixHref="/admin/classic" />
        <IssueList title="Events missing a schedule" items={issues.eventsNoSchedule} empty="Every event has a schedule." fixHref="/admin/events" />
        <Panel title="Stored setting keys" description="Presence of draft and published payloads per key.">
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
            {settings.length === 0 && <p className="text-xs text-ink-500">No settings stored yet — publish a section to create rows.</p>}
          </div>
        </Panel>
      </div>
    </div>
  );
}

function IssueList({ title, items, empty, fixHref }: { title: string; items: CourseCatalogItem[]; empty: string; fixHref: string }) {
  return (
    <Panel
      title={title}
      action={<Link href={fixHref} className="text-[11px] font-semibold text-brand-700">Fix →</Link>}
    >
      {items.length === 0 ? (
        <p className="text-xs text-ink-500">{empty}</p>
      ) : (
        <ul className="space-y-1.5 max-h-56 overflow-y-auto">
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

export function SchedulingSection() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [popups, setPopups] = useState<NoticePopup[]>([]);
  const [challenges, setChallenges] = useState<ChallengesConfig['items']>([]);
  const [events, setEvents] = useState<CourseCatalogItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      getAdminSiteSettings().catch(() => [] as SiteSettingRow[]),
      getAdminContentList({ kind: 'event' }).catch(() => [] as CourseCatalogItem[]),
    ]).then(([rows, eventItems]) => {
      if (cancelled) return;
      const byKey = Object.fromEntries(rows.map((row) => [row.key, row]));
      const bannerValue = (byKey.banners?.draft || byKey.banners?.published || {}) as Partial<{ items: Banner[] }>;
      const popupValue = (byKey.popups?.draft || byKey.popups?.published || {}) as Partial<{ items: NoticePopup[] }>;
      const challengeValue = (byKey.challenges?.draft || byKey.challenges?.published || {}) as Partial<ChallengesConfig>;
      setBanners(bannerValue.items || []);
      setPopups(popupValue.items || []);
      setChallenges(challengeValue.items || []);
      setEvents(eventItems);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const timeline = useMemo(() => {
    const rows: Array<{ id: string; title: string; kind: string; start: string; end: string; status: string; href: string }> = [];
    for (const banner of banners) {
      rows.push({ id: banner.id, title: banner.title, kind: 'Banner', start: banner.startAt, end: banner.endAt, status: banner.status, href: '/admin/banners' });
    }
    for (const popup of popups) {
      rows.push({ id: popup.id, title: popup.title, kind: 'Popup', start: popup.startAt, end: popup.endAt, status: popup.active ? 'active' : 'paused', href: '/admin/popups' });
    }
    for (const challenge of challenges) {
      rows.push({ id: challenge.id, title: challenge.title, kind: 'Challenge', start: challenge.startAt, end: challenge.endAt, status: challenge.active ? 'active' : 'paused', href: '/admin/challenges' });
    }
    for (const event of events) {
      const meta = asRecord(event.metadata);
      rows.push({
        id: event.id,
        title: event.title,
        kind: 'Event',
        start: typeof meta.startsAt === 'string' ? meta.startsAt : '',
        end: typeof meta.endsAt === 'string' ? meta.endsAt : '',
        status: event.active ? 'active' : 'hidden',
        href: '/admin/events',
      });
    }
    return rows.sort((a, b) => {
      const aTime = a.start ? Date.parse(a.start) : Number.POSITIVE_INFINITY;
      const bTime = b.start ? Date.parse(b.start) : Number.POSITIVE_INFINITY;
      return aTime - bTime;
    });
  }, [banners, popups, challenges, events]);

  if (loading) return <Spinner label="Building the schedule…" />;

  return (
    <div>
      <AdminPageHeader
        eyebrow="System"
        title="Content Scheduling"
        description="Every dated surface in one timeline: banners, popups, challenges and events. Start and end times are stored in UTC and displayed in IST."
        meta={<StatusPill tone="brand">{timeline.length} scheduled items</StatusPill>}
      />
      <Callout tone="info" title="One source of truth">
        This view aggregates the real settings and content records — editing still happens in each dedicated manager, so
        nothing can drift out of sync.
      </Callout>
      <Panel className="mt-4" title="Timeline">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-[10px] uppercase tracking-wide text-ink-400 border-b border-ink-100">
              <tr>
                <th className="py-2 pr-3">Starts (IST)</th>
                <th className="py-2 pr-3">Ends (IST)</th>
                <th className="py-2 pr-3">Type</th>
                <th className="py-2 pr-3">Title</th>
                <th className="py-2 pr-3">State</th>
                <th className="py-2">Manage</th>
              </tr>
            </thead>
            <tbody>
              {timeline.map((row) => (
                <tr key={`${row.kind}-${row.id}`} className="border-b border-ink-50">
                  <td className="py-2 pr-3 whitespace-nowrap text-ink-600">{row.start ? formatISTDateTime(row.start) : '—'}</td>
                  <td className="py-2 pr-3 whitespace-nowrap text-ink-600">{row.end ? formatISTDateTime(row.end) : '—'}</td>
                  <td className="py-2 pr-3"><StatusPill tone="neutral">{row.kind}</StatusPill></td>
                  <td className="py-2 pr-3 truncate max-w-[260px]">{row.title}</td>
                  <td className="py-2 pr-3"><StatusPill tone={row.status === 'active' || row.status === 'published' ? 'success' : 'warning'}>{row.status}</StatusPill></td>
                  <td className="py-2"><Link href={row.href} className="text-[11px] font-semibold text-brand-700">Open →</Link></td>
                </tr>
              ))}
              {timeline.length === 0 && (
                <tr><td colSpan={6} className="py-6 text-center text-ink-500">Nothing scheduled yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

export function CampaignsSection() {
  const [events, setEvents] = useState<CourseCatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  useEffect(() => {
    let cancelled = false;
    getAdminContentList({ kind: 'event' })
      .then((items) => {
        if (!cancelled) setEvents(items);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return events.filter((event) => {
      const meta = asRecord(event.metadata);
      const isRevision = `${event.title} ${event.description} ${meta.category || ''}`.toLowerCase().includes('revision');
      if (!isRevision) return false;
      return !q || `${event.title} ${event.description}`.toLowerCase().includes(q);
    });
  }, [events, query]);

  if (loading) return <Spinner label="Loading campaigns…" />;

  return (
    <div>
      <AdminPageHeader
        eyebrow="Learning content"
        title="Revision Campaigns"
        description="Revision marathons are events tagged with “revision” in the title, description or category metadata. Create and edit them in the Events manager; this view is a focused campaign lens."
        meta={<StatusPill tone="brand">{filtered.length} revision campaigns</StatusPill>}
        actions={<Link href="/admin/events" className="ec-btn px-3 py-2 text-xs font-semibold bg-brand-600 text-white">Open Events →</Link>}
      />
      <Panel title="Campaigns" action={<SearchInput value={query} onChange={setQuery} placeholder="Search campaigns…" />}>
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map((event) => {
            const meta = asRecord(event.metadata);
            return (
              <div key={event.id} className="rounded-xl border border-violet-200 bg-violet-50/40 p-3">
                <p className="text-xs font-bold">{event.title}</p>
                <p className="text-[10px] text-ink-500 mt-1 line-clamp-2">{event.description}</p>
                <p className="text-[10px] text-violet-700 mt-2">
                  {typeof meta.startsAt === 'string' ? formatISTDateTime(meta.startsAt) : 'No start'} →{' '}
                  {typeof meta.endsAt === 'string' ? formatISTDateTime(meta.endsAt) : 'No end'}
                </p>
                <div className="flex items-center justify-between mt-2">
                  <StatusPill tone={event.active ? 'success' : 'neutral'}>{event.active ? 'Live' : 'Hidden'}</StatusPill>
                  <Link href="/admin/events" className="text-[10px] font-semibold text-violet-700">Edit →</Link>
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <p className="sm:col-span-2 xl:col-span-3 text-xs text-ink-500 py-6 text-center">
              No revision campaigns found. Tag an event with “revision” to surface it here.
            </p>
          )}
        </div>
      </Panel>
    </div>
  );
}

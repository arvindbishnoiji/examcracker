'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import type { AdminActivityEntry, AdminAnalyticsResponse, AdminOverviewResponse } from '@/types';
import { getAdminActivity, getAdminAnalytics, getAdminOverview } from '@/lib/api';
import { formatISTDateTime } from '@/lib/date';
import { ADMIN_SECTIONS, adminSectionHref } from '@/lib/admin-sections';
import { AdminPageHeader, Banner, BarChart, Panel, ProgressBar, Spinner, StatCard, StatusPill } from '../ui';

const QUICK_ACTIONS = [
  { label: 'Create a banner', href: '/admin/banners', icon: '▰', tone: 'from-brand-500 to-brand-700' },
  { label: 'Schedule an event', href: '/admin/events', icon: '▦', tone: 'from-violet-500 to-violet-700' },
  { label: 'Add a test', href: '/admin/tests', icon: '✎', tone: 'from-emerald-500 to-emerald-700' },
  { label: 'Post an announcement', href: '/admin/announcements', icon: '◔', tone: 'from-amber-500 to-amber-600' },
  { label: "Set today's goal", href: '/admin/goals', icon: '◎', tone: 'from-sky-500 to-sky-700' },
  { label: 'Tune the theme', href: '/admin/appearance', icon: '◐', tone: 'from-rose-500 to-rose-700' },
];

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export function OverviewSection() {
  const [overview, setOverview] = useState<AdminOverviewResponse | null>(null);
  const [analytics, setAnalytics] = useState<AdminAnalyticsResponse | null>(null);
  const [activity, setActivity] = useState<AdminActivityEntry[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);
  const [activityError, setActivityError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setAnalyticsError(null);
    setActivityError(null);
    const [overviewResult, analyticsResult, activityResult] = await Promise.allSettled([
      getAdminOverview(),
      getAdminAnalytics(),
      getAdminActivity(12),
    ]);
    if (overviewResult.status === 'fulfilled') setOverview(overviewResult.value);
    else setError(overviewResult.reason instanceof Error ? overviewResult.reason.message : 'Unable to load overview.');
    if (analyticsResult.status === 'fulfilled') setAnalytics(analyticsResult.value);
    else setAnalyticsError(analyticsResult.reason instanceof Error ? analyticsResult.reason.message : 'Analytics unavailable.');
    if (activityResult.status === 'fulfilled') setActivity(activityResult.value);
    else setActivityError(activityResult.reason instanceof Error ? activityResult.reason.message : 'Activity log unavailable.');
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const counts = overview?.counts;
  const attemptsSeries =
    analytics?.attempts.last14Days.map((day) => ({
      label: day.date.slice(5),
      value: day.count,
    })) || [];

  return (
    <div>
      <AdminPageHeader
        eyebrow="Command centre"
        title={`${greeting()}, Admin`}
        description="Everything that is live, everything that needs attention, and the fastest route to each tool — all driven by real platform data."
        actions={
          <>
            <button type="button" onClick={() => void load()} className="ec-btn px-3 py-2 text-xs font-semibold border border-ink-200 bg-white hover:bg-ink-50">
              ⟳ Refresh
            </button>
            <Link href="/admin/banners" className="ec-btn px-3.5 py-2 text-xs font-semibold bg-brand-600 text-white">
              + New banner
            </Link>
          </>
        }
      />

      {error && (
        <div className="mb-4">
          <Banner tone="danger" title="Overview could not load">
            {error} — verify the Supabase Edge Function is deployed and the admin session is valid.
          </Banner>
        </div>
      )}

      {loading && !analytics && !overview ? (
        <Spinner label="Loading platform state…" />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Students"
              value={analytics?.students.total ?? counts?.student_profiles ?? '—'}
              hint={analytics ? `${analytics.students.byExam.JEE || 0} JEE · ${analytics.students.byExam.NEET || 0} NEET` : 'Profiles on record'}
              tone="brand"
              icon="◍"
            />
            <StatCard
              label="Published content"
              value={analytics ? analytics.content.active : counts?.course_catalog ?? '—'}
              hint={analytics ? `${analytics.content.total} total items` : 'Catalog items'}
              tone="success"
              icon="▣"
            />
            <StatCard
              label="Test attempts"
              value={analytics?.attempts.total ?? counts?.exam_attempts ?? '—'}
              hint={analytics ? `${analytics.attempts.averagePercentage.toFixed(1)}% average score` : 'Submitted attempts'}
              tone="warning"
              icon="✎"
            />
            <StatCard
              label="Enrollments"
              value={analytics?.enrollments.total ?? counts?.enrollments ?? '—'}
              hint={analytics ? `${analytics.enrollments.byItem.length} active item groups` : 'Batch & series access'}
              tone="info"
              icon="▤"
            />
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] mt-4">
            <Panel title="Attempts · last 14 days" description="Every point is a submitted test attempt recorded by the API.">
              {analyticsError ? (
                <p className="text-xs text-ink-500">
                  Analytics endpoint unavailable: {analyticsError}. This view activates after the updated Edge Function is deployed.
                </p>
              ) : attemptsSeries.length > 0 ? (
                <BarChart data={attemptsSeries} height={170} formatValue={(value) => `${value}`} />
              ) : (
                <div className="h-[170px] grid place-items-center text-xs text-ink-500">No attempts recorded yet.</div>
              )}
            </Panel>

            <Panel title="Quick actions" description="Jump straight into the most frequent admin tasks.">
              <div className="grid grid-cols-2 gap-2">
                {QUICK_ACTIONS.map((action) => (
                  <Link
                    key={action.href}
                    href={action.href}
                    className={`group relative overflow-hidden rounded-xl p-3 text-white bg-gradient-to-br ${action.tone} transition hover:brightness-105`}
                  >
                    <span className="text-lg leading-none opacity-90">{action.icon}</span>
                    <p className="text-[11px] font-semibold mt-2 leading-tight">{action.label}</p>
                    <span className="absolute right-2 top-2 text-white/60 text-xs group-hover:translate-x-0.5 transition">→</span>
                  </Link>
                ))}
              </div>
            </Panel>
          </div>

          <div className="grid gap-4 xl:grid-cols-3 mt-4">
            <Panel title="Subject performance" description="Averages across all submitted attempts.">
              {analytics?.subjectPerformance.length ? (
                <div className="space-y-3">
                  {analytics.subjectPerformance.slice(0, 6).map((subject) => (
                    <ProgressBar
                      key={subject.subject}
                      label={`${subject.subject} · ${subject.attempts} attempts`}
                      value={subject.averagePercentage}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-xs text-ink-500">{analyticsError ? 'Requires the analytics endpoint.' : 'No subject data yet.'}</p>
              )}
            </Panel>

            <Panel title="Content health" description="Real gaps detected from stored content.">
              {analytics ? (
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: 'Missing thumbnails', value: analytics.contentHealth.missingThumbnails },
                    { label: 'Tests without questions', value: analytics.contentHealth.testsWithoutQuestions },
                    { label: 'Events missing schedule', value: analytics.contentHealth.eventsMissingSchedule },
                    { label: 'Inactive content', value: analytics.contentHealth.inactiveContent },
                  ].map((item) => (
                    <div key={item.label} className="rounded-xl border border-ink-200 p-3">
                      <p className="text-xl font-extrabold tabular-nums">{item.value}</p>
                      <p className="text-[10px] text-ink-500 mt-0.5 leading-tight">{item.label}</p>
                    </div>
                  ))}
                  <Link href="/admin/health" className="col-span-2 text-center text-[11px] font-semibold text-brand-700 py-2 rounded-lg bg-brand-50 hover:bg-brand-100">
                    Open content health →
                  </Link>
                </div>
              ) : (
                <p className="text-xs text-ink-500">{analyticsError ? 'Requires the analytics endpoint.' : 'Run a check from Content Health.'}</p>
              )}
            </Panel>

            <Panel
              title="Recent admin activity"
              description="Server-recorded writes."
              action={
                <Link href="/admin/reports" className="text-[11px] font-semibold text-brand-700">
                  All reports →
                </Link>
              }
            >
              {activity?.length ? (
                <ol className="space-y-2.5">
                  {activity.slice(0, 6).map((entry) => (
                    <li key={entry.id} className="flex gap-2.5">
                      <span className="mt-1 h-1.5 w-1.5 rounded-full bg-brand-500 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold text-ink-800 truncate">{entry.summary || entry.action}</p>
                        <p className="text-[10px] text-ink-400">
                          {entry.actor_email} · {formatISTDateTime(entry.created_at)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-xs text-ink-500">
                  {activityError
                    ? 'Activity log activates after the updated Edge Function is deployed.'
                    : 'No admin writes recorded yet.'}
                </p>
              )}
            </Panel>
          </div>

          <Panel className="mt-4" title="Every workspace" description="30 dedicated tools, grouped by intent.">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {['Design studio', 'Learning', 'Students', 'Growth', 'System'].map((group) => (
                <div key={group}>
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-ink-400 mb-2">{group}</p>
                  <div className="space-y-1.5">
                    {ADMIN_SECTIONS.filter((section) => section.group === group).map((section) => (
                      <Link
                        key={section.slug}
                        href={adminSectionHref(section.slug)}
                        className="flex items-center gap-2 rounded-lg border border-transparent px-2 py-1.5 hover:border-ink-200 hover:bg-ink-50 transition"
                      >
                        <span className="text-xs text-ink-400 w-4">{section.icon}</span>
                        <span className="text-[11px] font-medium text-ink-700 flex-1 truncate">{section.label}</span>
                        <span className="text-[10px] text-ink-300">→</span>
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-ink-400 mb-2">Status</p>
                <div className="rounded-xl border border-ink-200 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-ink-600">Theme publishing</span>
                    <StatusPill tone="success">Live</StatusPill>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-ink-600">Login designer</span>
                    <StatusPill tone="success">Live</StatusPill>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-ink-600">Homepage builder</span>
                    <StatusPill tone="success">Live</StatusPill>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-ink-600">Banner scheduler</span>
                    <StatusPill tone="success">Live</StatusPill>
                  </div>
                </div>
                <Link href="/admin/classic" className="mt-2 flex items-center justify-between rounded-xl border border-ink-200 px-3 py-2 text-[11px] font-semibold text-ink-700 hover:bg-ink-50">
                  Classic content tools <span>→</span>
                </Link>
              </div>
            </div>
          </Panel>
        </>
      )}
    </div>
  );
}

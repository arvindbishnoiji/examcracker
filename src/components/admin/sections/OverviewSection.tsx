'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { ArrowRight, Award, BookOpen, CheckCircle2, FileCheck2, Layers, Sparkles, Users } from 'lucide-react';
import type { AdminAnalyticsResponse, AdminOverviewResponse } from '@/types';
import { getAdminAnalytics, getAdminOverview } from '@/lib/api';
import { ADMIN_GROUPS, ADMIN_SECTIONS, adminSectionHref } from '@/lib/admin-sections';
import { AdminPageHeader, Banner, BarChart, Panel, ProgressBar, Spinner, StatCard } from '../ui';

const QUICK_ACTIONS = [
  { label: 'Create Animated Badge', sub: 'Upload image + Kaise Milega', href: '/admin/badges', tone: 'from-violet-600 to-indigo-700', icon: '🏅' },
  { label: 'Manage Batches', sub: 'Courses, codes & card design', href: '/admin/batches', tone: 'from-brand-600 to-violet-700', icon: '▣' },
  { label: 'Add Lectures & PDFs', sub: 'Videos, notes & playlists', href: '/admin/lectures', tone: 'from-sky-600 to-blue-700', icon: '▶' },
  { label: 'Create Mock Test', sub: 'Timed exam & question bank', href: '/admin/tests', tone: 'from-emerald-600 to-teal-700', icon: '✎' },
  { label: 'Hero Banners', sub: 'Home promotional slides', href: '/admin/banners', tone: 'from-amber-500 to-orange-600', icon: '▰' },
  { label: 'Send Announcement', sub: 'Notify JEE / NEET cohorts', href: '/admin/announcements', tone: 'from-rose-600 to-pink-700', icon: '◔' },
];

const WORKFLOW_STEPS = [
  {
    step: '1',
    title: 'Create Subjects',
    body: 'Add Physics, Chemistry, Maths or Biology once.',
    href: '/admin/subjects',
  },
  {
    step: '2',
    title: 'Create Batch / Series',
    body: 'Set JEE/NEET & Class target and assign subjects.',
    href: '/admin/batches',
  },
  {
    step: '3',
    title: 'Upload Lectures & Notes',
    body: 'Add videos, YouTube playlists, and PDF notes.',
    href: '/admin/lectures',
  },
  {
    step: '4',
    title: 'Publish Mock Tests',
    body: 'Add timed tests with +4/-1 marking & solutions.',
    href: '/admin/tests',
  },
  {
    step: '5',
    title: 'Launch Badges & Rewards',
    body: 'Upload badge art, Kaise Milega rules & animations.',
    href: '/admin/badges',
  },
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setAnalyticsError(null);
    const [overviewResult, analyticsResult] = await Promise.allSettled([
      getAdminOverview(),
      getAdminAnalytics(),
    ]);
    if (overviewResult.status === 'fulfilled') setOverview(overviewResult.value);
    else setError(overviewResult.reason instanceof Error ? overviewResult.reason.message : 'Unable to load overview.');
    if (analyticsResult.status === 'fulfilled') setAnalytics(analyticsResult.value);
    else setAnalyticsError(analyticsResult.reason instanceof Error ? analyticsResult.reason.message : 'Analytics unavailable.');
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
    <div className="space-y-5">
      <AdminPageHeader
        eyebrow="Academy Command Centre"
        title={`${greeting()}, Admin`}
        description="Manage courses, lectures, mock tests, students, animated badges, and website design — organised cleanly with zero duplicate tools."
        actions={
          <>
            <button
              type="button"
              onClick={() => void load()}
              className="ec-btn border border-ink-200 bg-[var(--ec-surface)] px-3 py-2 text-xs font-semibold hover:bg-ink-50"
            >
              ⟳ Refresh
            </button>
            <Link
              href="/admin/badges"
              className="ec-btn inline-flex items-center gap-1.5 bg-brand-600 px-3.5 py-2 text-xs font-semibold text-white"
            >
              <Sparkles size={13} /> Create Badge
            </Link>
          </>
        }
      />

      {error ? (
        <Banner tone="danger" title="Overview could not load">
          {error} — verify your admin session and API connection.
        </Banner>
      ) : null}

      {loading && !analytics && !overview ? (
        <Spinner label="Loading academy overview…" />
      ) : (
        <>
          {/* KPI CARDS */}
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <StatCard
              label="Total Students"
              value={analytics?.students.total ?? counts?.student_profiles ?? '—'}
              hint={
                analytics
                  ? `${analytics.students.byExam.JEE || 0} JEE · ${analytics.students.byExam.NEET || 0} NEET`
                  : 'Registered learners'
              }
              tone="brand"
              icon={<Users size={15} />}
            />
            <StatCard
              label="Published Content"
              value={analytics ? analytics.content.active : counts?.course_catalog ?? '—'}
              hint={analytics ? `${analytics.content.total} total items` : 'Batches, lectures & tests'}
              tone="success"
              icon={<Layers size={15} />}
            />
            <StatCard
              label="Mock Attempts"
              value={analytics?.attempts.total ?? counts?.exam_attempts ?? '—'}
              hint={analytics ? `${analytics.attempts.averagePercentage.toFixed(1)}% avg score` : 'Submitted exams'}
              tone="warning"
              icon={<FileCheck2 size={15} />}
            />
            <StatCard
              label="Active Enrollments"
              value={analytics?.enrollments.total ?? counts?.enrollments ?? '—'}
              hint={analytics ? `${analytics.enrollments.byItem.length} active batches/series` : 'Course access'}
              tone="info"
              icon={<BookOpen size={15} />}
            />
          </div>

          {/* 5-STEP ACADEMY SETUP GUIDE */}
          <Panel
            title="How to Manage Your Academy (Step-by-Step Flow)"
            description="New to the admin console? Follow these 5 steps in order so students get a clean, structured experience."
            icon={<CheckCircle2 size={16} />}
          >
            <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-5">
              {WORKFLOW_STEPS.map((item) => (
                <Link
                  key={item.step}
                  href={item.href}
                  className="group flex flex-col justify-between rounded-2xl border border-ink-200/80 bg-ink-50/40 p-3.5 transition hover:border-brand-300 hover:bg-brand-50/40"
                >
                  <div>
                    <span className="inline-grid h-6 w-6 place-items-center rounded-full bg-brand-600 text-[11px] font-extrabold text-white">
                      {item.step}
                    </span>
                    <p className="mt-2 text-xs font-extrabold text-ink-900">{item.title}</p>
                    <p className="mt-1 text-[11px] leading-relaxed text-ink-500">{item.body}</p>
                  </div>
                  <span className="mt-3 inline-flex items-center gap-1 text-[11px] font-bold text-brand-700 group-hover:translate-x-0.5 transition">
                    Open <ArrowRight size={12} />
                  </span>
                </Link>
              ))}
            </div>
          </Panel>

          {/* QUICK ACTIONS + CHART */}
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
            <Panel title="Quick Launch" description="Open the tools you use daily in one tap.">
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                {QUICK_ACTIONS.map((action) => (
                  <Link
                    key={action.href}
                    href={action.href}
                    className={`group relative overflow-hidden rounded-2xl bg-gradient-to-br p-3.5 text-white shadow-sm transition hover:-translate-y-0.5 hover:brightness-105 ${action.tone}`}
                  >
                    <span className="text-xl leading-none">{action.icon}</span>
                    <p className="mt-2.5 text-xs font-extrabold leading-snug">{action.label}</p>
                    <p className="mt-0.5 text-[10.5px] text-white/80 leading-tight">{action.sub}</p>
                    <span className="absolute right-3 top-3 text-xs text-white/60 transition group-hover:translate-x-0.5">
                      →
                    </span>
                  </Link>
                ))}
              </div>
            </Panel>

            <Panel title="Mock Test Activity · Last 14 Days" description="Daily submitted mock test count.">
              {analyticsError ? (
                <p className="text-xs text-ink-500">Analytics summary will populate once student attempts are submitted.</p>
              ) : attemptsSeries.length > 0 ? (
                <BarChart data={attemptsSeries} height={156} formatValue={(value) => `${value}`} />
              ) : (
                <div className="grid h-[156px] place-items-center text-xs text-ink-500">
                  No submitted test attempts in the last 14 days.
                </div>
              )}
            </Panel>
          </div>

          {/* SUBJECT PERFORMANCE + CONTENT HEALTH */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="Subject Accuracy Overview" description="Average student scores across subjects.">
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
                <p className="text-xs text-ink-500">Subject accuracy bars appear once students submit graded tests.</p>
              )}
            </Panel>

            <Panel
              title="Content Readiness Check"
              description="Quick quality scan so students never hit incomplete tests or missing artwork."
              action={
                <Link href="/admin/health" className="text-xs font-bold text-brand-700 hover:underline">
                  Full scan →
                </Link>
              }
            >
              {analytics ? (
                <div className="grid grid-cols-2 gap-2.5">
                  {[
                    { label: 'Tests missing questions', value: analytics.contentHealth.testsWithoutQuestions },
                    { label: 'Cards missing thumbnail', value: analytics.contentHealth.missingThumbnails },
                    { label: 'Unscheduled events', value: analytics.contentHealth.eventsMissingSchedule },
                    { label: 'Draft / hidden items', value: analytics.contentHealth.inactiveContent },
                  ].map((item) => (
                    <div key={item.label} className="rounded-xl border border-ink-200/80 bg-ink-50/40 p-3">
                      <p className="text-xl font-extrabold tabular-nums text-ink-900">{item.value}</p>
                      <p className="mt-0.5 text-[11px] text-ink-500">{item.label}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-ink-500">Open Content Quality Check to inspect catalogue items.</p>
              )}
            </Panel>
          </div>

          {/* CLEAN DIRECTORY OF ALL SECTIONS */}
          <Panel
            title="All Admin Tools by Category"
            description="Every module has one clear home — duplicate panels and audit clutter have been removed."
            icon={<Award size={16} />}
          >
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
              {ADMIN_GROUPS.map((group) => (
                <div key={group} className="rounded-2xl border border-ink-100 bg-ink-50/30 p-3">
                  <p className="mb-2 text-[10px] font-extrabold uppercase tracking-[0.14em] text-brand-700">{group}</p>
                  <div className="space-y-1">
                    {ADMIN_SECTIONS.filter((section) => section.group === group).map((section) => (
                      <Link
                        key={section.slug}
                        href={adminSectionHref(section.slug)}
                        className="flex items-center gap-2 rounded-xl px-2 py-1.5 text-xs font-medium text-ink-700 transition hover:bg-[var(--ec-surface)] hover:text-brand-700 hover:shadow-xs"
                      >
                        <span className="w-4 text-center text-xs text-ink-400">{section.icon}</span>
                        <span className="flex-1 truncate">{section.label}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </>
      )}
    </div>
  );
}

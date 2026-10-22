'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useSiteConfig } from '@/context/SiteConfigContext';
import { useToast } from '@/hooks/useToast';
import type {
  Announcement,
  CourseCatalogItem,
  HomeSectionConfig,
  LeaderboardEntry,
  LibraryItem,
  StudyChallenge,
  TestCardItem,
} from '@/types';
import { getStudentAnalysis, getStudentLibrary, getStudentTests, getTestLeaderboard, saveStudentLibraryItem } from '@/lib/api';
import { formatISTDateTime, formatWatchDuration, isScheduleActiveNow } from '@/lib/date';
import { formatClassLevel, formatClassList, isSafeHttpUrl, isValidInternalDeepLink } from '@/lib/validation';
import { activeEnrollmentKeys } from '@/lib/enrollment';
import { activityStreak } from '@/lib/progress';
import { ArrowRight, BookOpenCheck, Flame, GraduationCap, PlayCircle, Search, Sparkles, Trophy } from 'lucide-react';
import {
  getHomeSectionsForStudent,
  selectBannersForPlacement,
  type StudentAudience,
} from '@/lib/site-config';
import YoutubeThumbnail from '@/components/YoutubeThumbnail';
import { BannerCarousel } from '@/components/banners/BannerCarousel';
import { PopupHost } from '@/components/site/PopupHost';
import { BatchShowcase } from '@/components/batches/BatchShowcase';
import { FeatureStrip } from '@/components/site/FeatureStrip';

function sectionTint(seed: string): string {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) hash = (hash * 31 + seed.charCodeAt(index)) % 997;
  return `var(--ec-c${(hash % 8) + 1})`;
}

function SectionShell({ section, children }: { section: HomeSectionConfig; children: React.ReactNode }) {
  const tint = section.accent || sectionTint(section.id || section.type);
  return (
    <section>
      {(section.title || section.subtitle) && (
        <div className="ec-section-header" style={{ borderColor: `color-mix(in srgb, ${tint} 22%, transparent)` }}>
          <div className="flex items-start gap-2.5">
            <span
              className="mt-1 hidden h-8 w-1.5 shrink-0 rounded-full sm:block"
              style={{ background: `linear-gradient(180deg, ${tint}, transparent)` }}
              aria-hidden
            />
            <div>
              {section.title && <h2 className="ec-h2 text-[1.15rem] sm:text-[1.3rem]">{section.title}</h2>}
              {section.subtitle && <p className="mt-0.5 text-[0.8rem] leading-relaxed text-ink-500">{section.subtitle}</p>}
            </div>
          </div>
          {section.ctaLabel && isValidInternalDeepLink(section.ctaHref) && (
            <Link href={section.ctaHref} className="text-xs font-semibold text-brand-700 hover:underline">
              {section.ctaLabel} →
            </Link>
          )}
        </div>
      )}
      {children}
    </section>
  );
}

function metaOf(item: CourseCatalogItem): Record<string, unknown> {
  return (item.metadata || {}) as Record<string, unknown>;
}

function customThumbOf(item: CourseCatalogItem) {
  const meta = metaOf(item);
  const raw = ((meta.thumbnailUrl as string) || (meta.thumbnail_url as string) || '').trim();
  return isSafeHttpUrl(raw) ? raw : '';
}

function ContentCard({ item, cta = 'Open' }: { item: CourseCatalogItem; cta?: string }) {
  const meta = metaOf(item);
  const subjectLabel = String(item.subjectName || meta.subject || '').trim() || null;
  return (
    <Link href={`/lectures/${item.id}`} className="group ec-card ec-card-interactive overflow-hidden flex flex-col">
      <YoutubeThumbnail
        src={customThumbOf(item)}
        videoId={String(meta.videoId || '')}
        alt={item.title}
        duration={meta.duration ? String(meta.duration) : null}
        badge={meta.isPreview === true ? 'Free Preview' : subjectLabel || item.kind}
        subjectName={subjectLabel || item.exam}
        className="aspect-video w-full"
      />
      <div className="p-3.5 flex-1 flex flex-col">
        <p className="text-sm font-bold leading-snug text-ink-900 group-hover:text-brand-700 line-clamp-2">{item.title}</p>
        {item.description && (
          <p className="text-xs text-ink-500 line-clamp-2 mt-1">{item.description}</p>
        )}
        <div className="flex flex-wrap gap-1.5 mt-2.5">
          <span className="rounded-full bg-brand-50 text-brand-700 px-2 py-0.5 text-[10px] font-semibold">{item.exam}</span>
          <span className="rounded-full bg-ink-100 text-ink-700 px-2 py-0.5 text-[10px] font-semibold">{formatClassList(item.classes)}</span>
          {subjectLabel && (
            <span className="rounded-full bg-ink-100 text-ink-700 px-2 py-0.5 text-[10px] font-semibold">{subjectLabel}</span>
          )}
        </div>
        <span className="mt-auto pt-3 text-xs font-semibold text-brand-700">{cta} →</span>
      </div>
    </Link>
  );
}

function TestCard({ test }: { test: TestCardItem }) {
  return (
    <div className="ec-card p-4 flex flex-col">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-bold leading-snug line-clamp-2">{test.title}</p>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${test.isLive ? 'bg-emerald-50 text-emerald-700' : 'bg-sky-50 text-sky-700'}`}>
          {test.isLive ? 'Live' : 'Scheduled'}
        </span>
      </div>
      <p className="text-[11px] text-ink-500 line-clamp-2 mt-1">{test.description}</p>
      <div className="flex flex-wrap gap-1 mt-2 text-[10px] text-ink-600">
        {test.subject && <span className="rounded-full bg-ink-100 px-2 py-0.5">{test.subject}</span>}
        <span className="rounded-full bg-ink-100 px-2 py-0.5">{test.durationMinutes || 0} min</span>
        <span className="rounded-full bg-ink-100 px-2 py-0.5">{test.totalQuestions} Qs</span>
      </div>
      <p className="text-[10px] text-ink-400 mt-2">
        {test.scheduledAt ? formatISTDateTime(test.scheduledAt) : 'No schedule'}
        {test.endsAt ? ` → ${formatISTDateTime(test.endsAt)}` : ''}
      </p>
      <Link href={`/tests/${test.id}`} className="mt-3 w-full text-center px-3 py-2 rounded-[var(--ec-button-radius)] bg-[var(--ec-brand)] text-[var(--ec-on-brand)] text-xs font-bold">
        {test.isLive ? 'Attempt now' : 'Open test'}
      </Link>
    </div>
  );
}

function GoalCard({ item }: { item: CourseCatalogItem }) {
  const meta = metaOf(item);
  const deepLink = typeof meta.deepLink === 'string' ? meta.deepLink : '';
  return (
    <div className="rounded-[var(--ec-radius)] p-4 sm:p-5 text-white" style={{ background: 'linear-gradient(120deg, var(--ec-brand), var(--ec-secondary))' }}>
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] opacity-80">Today&apos;s goal</p>
      <h3 className="mt-1 text-lg font-extrabold leading-tight">{item.title}</h3>
      {item.description && <p className="text-sm opacity-90 mt-1">{item.description}</p>}
      <div className="flex flex-wrap items-center gap-2 mt-3">
        {Boolean(meta.startsAt || meta.endsAt) && (
          <span className="text-[11px] opacity-80">
            {meta.startsAt ? formatISTDateTime(String(meta.startsAt)) : 'Now'}
            {meta.endsAt ? ` → ${formatISTDateTime(String(meta.endsAt))}` : ''}
          </span>
        )}
        {deepLink && isValidInternalDeepLink(deepLink) && (
          <Link href={deepLink} className="ml-auto px-3.5 py-1.5 rounded-[var(--ec-button-radius)] bg-white text-ink-900 text-xs font-bold">
            {(meta.ctaLabel as string) || 'Start'}
          </Link>
        )}
      </div>
    </div>
  );
}

function ChallengeCard({
  challenge,
  joined,
  onToggle,
}: {
  challenge: StudyChallenge;
  joined: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="ec-card p-4" style={{ borderTop: `4px solid ${challenge.color || 'var(--ec-brand)'}` }}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-bold">{challenge.title}</p>
        <span className="text-[10px] font-bold rounded-full bg-ink-100 px-2 py-0.5">{challenge.targetCount} {challenge.targetType}</span>
      </div>
      <p className="text-[11px] text-ink-500 mt-1 line-clamp-2">{challenge.description || 'Stay consistent and finish the target.'}</p>
      {challenge.reward && <p className="text-[11px] font-semibold text-amber-700 mt-1.5">🏅 {challenge.reward}</p>}
      <button
        type="button"
        onClick={onToggle}
        className={`mt-3 w-full px-3 py-2 text-xs font-bold rounded-[var(--ec-button-radius)] ${joined ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-ink-900 text-white'}`}
      >
        {joined ? 'Joined ✓ · tap to leave' : 'Join challenge'}
      </button>
    </div>
  );
}

export default function HomePage() {
  const { user, profile, bootstrap, initializing, loading, error, refresh } = useAuth();
  const { config } = useSiteConfig();
  const { push } = useToast();
  const router = useRouter();

  const [tests, setTests] = useState<TestCardItem[]>([]);
  const [analysis, setAnalysis] = useState<Awaited<ReturnType<typeof getStudentAnalysis>> | null>(null);
  const [library, setLibrary] = useState<LibraryItem[]>([]);
  const [leaders, setLeaders] = useState<LeaderboardEntry[]>([]);
  const [leaderError, setLeaderError] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (initializing) return;
    if (!user) router.replace('/login');
    else if (!profile) router.replace('/onboarding');
  }, [user, profile, initializing, router]);

  const load = useCallback(async () => {
    if (!profile) return;
    setDataLoading(true);
    setLeaderError(false);
    const [testsResult, analysisResult, libraryResult] = await Promise.allSettled([
      getStudentTests(),
      getStudentAnalysis(),
      getStudentLibrary(),
    ]);
    const fetchedTests = testsResult.status === 'fulfilled' ? testsResult.value : [];
    setTests(fetchedTests);
    if (analysisResult.status === 'fulfilled') setAnalysis(analysisResult.value);
    if (libraryResult.status === 'fulfilled') setLibrary(libraryResult.value);

    const primaryTest = fetchedTests.find((t) => t.isLive) || fetchedTests[0];
    if (primaryTest?.id) {
      try {
        const leaderData = await getTestLeaderboard(primaryTest.id);
        setLeaders(leaderData.items);
      } catch {
        setLeaderError(true);
      }
    } else {
      setLeaders([]);
    }
    setDataLoading(false);
  }, [profile]);

  useEffect(() => {
    void load();
  }, [load]);

  const audience: StudentAudience | null = profile ? { exam: profile.exam, classLevel: profile.class_level } : null;

  const joinedChallenges = useMemo(
    () => new Set(library.filter((item) => item.item_type === 'challenge').map((item) => item.item_id)),
    [library]
  );

  async function toggleChallenge(challenge: StudyChallenge) {
    const joined = joinedChallenges.has(challenge.id);
    try {
      if (joined) {
        const { deleteStudentLibraryItem } = await import('@/lib/api');
        await deleteStudentLibraryItem('challenge', challenge.id);
        setLibrary((previous) => previous.filter((item) => !(item.item_type === 'challenge' && item.item_id === challenge.id)));
        push('Challenge removed.', 'success');
      } else {
        await saveStudentLibraryItem({ itemType: 'challenge', itemId: challenge.id, payload: { title: challenge.title } });
        setLibrary((previous) => [
          { id: `challenge-${challenge.id}`, item_type: 'challenge', item_id: challenge.id, payload: {}, updated_at: new Date().toISOString() },
          ...previous,
        ]);
        push('Challenge joined. Stay consistent!', 'success');
      }
    } catch (err) {
      push(err instanceof Error ? err.message : 'Could not update challenge.', 'error');
    }
  }

  if (initializing || loading || (dataLoading && !bootstrap)) {
    return (
      <div className="max-w-6xl mx-auto space-y-4">
        <div className="ec-skeleton h-28 w-full" />
        <div className="ec-skeleton h-48 w-full" />
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="ec-skeleton h-40" />
          <div className="ec-skeleton h-40" />
          <div className="ec-skeleton h-40" />
        </div>
      </div>
    );
  }

  if (!profile || !bootstrap) {
    return (
      <div className="max-w-2xl mx-auto ec-card p-6 text-center">
        <p className="font-semibold">Unable to load your dashboard</p>
        <p className="text-sm text-ink-500 mt-1">{error || 'Please try again.'}</p>
        <button type="button" onClick={() => void refresh()} className="mt-4 px-4 py-2 rounded-[var(--ec-button-radius)] bg-[var(--ec-brand)] text-[var(--ec-on-brand)] text-sm font-bold">
          Retry
        </button>
      </div>
    );
  }

  const content = bootstrap.content;
  const goals = content.filter((item) => item.kind === 'goal' && isScheduleActiveNow(metaOf(item).startsAt as string, metaOf(item).endsAt as string));
  const events = content.filter((item) => item.kind === 'event');
  const batches = content.filter((item) => item.kind === 'batch');
  const series = content.filter((item) => item.kind === 'series');
  const lectures = [...content.filter((item) => item.kind === 'lecture')].sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  const announcements = bootstrap.announcements || [];
  const liveTests = tests.filter((test) => test.isLive);
  const upcomingTests = tests.filter((test) => !test.isLive);
  const progressByLecture = new Map((analysis?.lessonProgress || []).map((row) => [row.lecture_id, row]));
  const continueLearning = [...lectures].sort((a, b) => {
    const aProgress = progressByLecture.get(a.id);
    const bProgress = progressByLecture.get(b.id);
    if (aProgress && !bProgress) return -1;
    if (!aProgress && bProgress) return 1;
    return (bProgress?.updated_at || '').localeCompare(aProgress?.updated_at || '') || b.updated_at.localeCompare(a.updated_at);
  });
  const subjects = Array.from(
    new Set(
      [...lectures, ...tests.map((test) => ({ metadata: { subject: test.subject } }))]
        .map((item) => String((item as { metadata?: Record<string, unknown> }).metadata?.subject || ''))
        .map((value) => value.trim())
        .filter(Boolean)
    )
  ).slice(0, 8);
  const activeChallenges = config.challenges.items
    .filter((challenge) => challenge.active)
    .filter((challenge) => isScheduleActiveNow(challenge.startAt, challenge.endAt));
  const featuredBatches = orderByIds(batches, config.homepage.sections.find((s) => s.type === 'featured_batches')?.itemIds);
  const featuredSeries = orderByIds(series, config.homepage.sections.find((s) => s.type === 'featured_series')?.itemIds);
  const popularLectures = orderByIds(lectures, config.homepage.sections.find((s) => s.type === 'popular_lectures')?.itemIds);
  const sections = getHomeSectionsForStudent(config.homepage, audience);
  const greeting = config.homepage.greetingTemplate.replace('{name}', profile.display_name.split(' ')[0] || 'there');
  const heroBanners = selectBannersForPlacement(config.banners, audience, 'home_hero');
  const dashboardBanners = selectBannersForPlacement(config.banners, audience, 'dashboard').filter(
    (b) => !heroBanners.some((hb) => hb.id === b.id)
  );
  const heroSection = sections.find((section) => section.type === 'hero');
  const heroTitle = (heroSection?.title || '').replace('{name}', profile.display_name.split(' ')[0] || 'there');
  const heroSubtitle = (heroSection?.subtitle || '').replace('{name}', profile.display_name.split(' ')[0] || 'there');
  const primaryTestId = (liveTests[0] || upcomingTests[0])?.id;
  const nextTest = liveTests[0] || upcomingTests[0];
  const todayGoal = goals[0];
  const enrolledCount = activeEnrollmentKeys(bootstrap.enrollments).size;
  const resumeLecture = continueLearning.find((lecture) => progressByLecture.has(lecture.id)) || continueLearning[0];

  function renderSection(section: HomeSectionConfig) {
    const limit = Math.max(1, Math.min(24, section.limit || 6));
    switch (section.type) {
      case 'hero': {
        if (!config.features.events && heroBanners.length === 0) return null;
        if (!heroBanners.length) return null;
        return (
          <SectionShell key={section.id} section={section}>
            <BannerCarousel banners={heroBanners.slice(0, limit)} settings={config.banners} />
          </SectionShell>
        );
      }
      case 'goal': {
        if (!config.features.challenges && !goals.length) return null;
        if (!goals.length) return null;
        return (
          <SectionShell key={section.id} section={section}>
            <div className="grid gap-3 md:grid-cols-2">
              {goals.slice(0, limit).map((goal) => <GoalCard key={goal.id} item={goal} />)}
            </div>
          </SectionShell>
        );
      }
      case 'live_tests':
      case 'upcoming_tests': {
        if (!config.features.tests) return null;
        const list = section.type === 'live_tests' ? liveTests : upcomingTests;
        if (!list.length) return null;
        return (
          <SectionShell key={section.id} section={section}>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {list.slice(0, limit).map((test) => <TestCard key={test.id} test={test} />)}
            </div>
          </SectionShell>
        );
      }
      case 'events': {
        const liveEvents = [...events]
          .filter((event) => {
            const meta = metaOf(event);
            const endMs = typeof meta.endsAt === 'string' ? Date.parse(meta.endsAt) : null;
            return endMs === null || Number.isNaN(endMs) || endMs > Date.now();
          })
          .sort((a, b) => {
            const aStart = metaOf(a).startsAt;
            const bStart = metaOf(b).startsAt;
            return (typeof aStart === 'string' ? Date.parse(aStart) : Number.MAX_SAFE_INTEGER) -
              (typeof bStart === 'string' ? Date.parse(bStart) : Number.MAX_SAFE_INTEGER);
          });
        if (!config.features.events || !liveEvents.length) return null;
        return (
          <SectionShell key={section.id} section={section}>
            <div className="grid sm:grid-cols-2 gap-3">
              {liveEvents.slice(0, limit).map((event) => {
                const meta = metaOf(event);
                const images = Array.isArray(meta.images) ? (meta.images as Array<{ url?: string }>) : [];
                const image = images[0]?.url || customThumbOf(event);
                return (
                  <div key={event.id} className="ec-card overflow-hidden">
                    {image && isSafeHttpUrl(image) && <img src={image} alt="" className="aspect-video w-full object-cover bg-ink-100" loading="lazy" />}
                    <div className="p-4">
                      <p className="text-sm font-bold">{event.title}</p>
                      <p className="text-[11px] text-ink-500 mt-1 line-clamp-2">{event.description}</p>
                      <p className="text-[11px] font-semibold text-brand-700 mt-2">
                        {typeof meta.startsAt === 'string' ? formatISTDateTime(meta.startsAt) : 'Schedule soon'}
                        {typeof meta.endsAt === 'string' ? ` → ${formatISTDateTime(meta.endsAt)}` : ''}
                      </p>
                      {typeof meta.deepLink === 'string' && isValidInternalDeepLink(meta.deepLink) && (
                        <Link href={meta.deepLink} className="inline-flex mt-2 text-[11px] font-bold text-brand-700">
                          {(meta.ctaLabel as string) || 'View event'} →
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <Link href="/events" className="mt-3 inline-flex text-xs font-bold text-brand-700">
              Open the events calendar →
            </Link>
          </SectionShell>
        );
      }
      case 'featured_batches':
      case 'featured_series': {
        const list = section.type === 'featured_batches' ? featuredBatches : featuredSeries;
        if (!list.length) return null;
        return (
          <SectionShell key={section.id} section={section}>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {list.slice(0, limit).map((item) => <ContentCard key={item.id} item={item} cta="View programme" />)}
            </div>
          </SectionShell>
        );
      }
      case 'continue_learning': {
        if (!config.features.continueLearning || !continueLearning.length) return null;
        return (
          <SectionShell key={section.id} section={section}>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {continueLearning.slice(0, limit).map((lecture) => {
                const progress = progressByLecture.get(lecture.id);
                const meta = metaOf(lecture);
                const pct = progress
                  ? progress.completed
                    ? 100
                    : Math.min(95, Math.max(6, Math.round((progress.watched_seconds / 1800) * 100)))
                  : 0;
                return (
                  <Link
                    key={lecture.id}
                    href={`/lectures/${lecture.id}`}
                    className="ec-card ec-card-interactive p-3 flex items-center gap-3"
                  >
                    <YoutubeThumbnail
                      src={customThumbOf(lecture)}
                      videoId={String(meta.videoId || '')}
                      alt={lecture.title}
                      progressPercent={pct}
                      completed={progress?.completed}
                      className="aspect-video w-28 rounded-lg shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-ink-900 line-clamp-2 leading-snug">{lecture.title}</p>
                      <p className="text-[11px] text-ink-500 mt-1">
                        {progress
                          ? progress.completed
                            ? 'Completed · Rewatch'
                            : `${Math.max(1, Math.round(progress.watched_seconds / 60))} min watched`
                          : 'Start lecture'}
                      </p>
                      <div className="h-1.5 rounded-full bg-ink-100 mt-2 overflow-hidden">
                        <div className="h-full bg-[var(--ec-brand)]" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </SectionShell>
        );
      }
      case 'popular_lectures': {
        if (!popularLectures.length) return null;
        return (
          <SectionShell key={section.id} section={section}>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {popularLectures.slice(0, limit).map((lecture) => <ContentCard key={lecture.id} item={lecture} cta="Watch" />)}
            </div>
          </SectionShell>
        );
      }
      case 'subject_shortcuts': {
        if (!subjects.length) return null;
        return (
          <SectionShell key={section.id} section={section}>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {subjects.map((subject) => (
                <Link
                  key={subject}
                  href={`/lectures?q=${encodeURIComponent(subject)}`}
                  className="ec-card px-3 py-4 text-center text-xs font-bold hover:border-brand-300"
                >
                  {subject}
                </Link>
              ))}
            </div>
          </SectionShell>
        );
      }
      case 'study_progress': {
        if (!analysis) return null;
        return (
          <SectionShell key={section.id} section={section}>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { label: 'Tests taken', value: analysis.testsTaken, hint: `${analysis.averagePercentage.toFixed(1)}% average` },
                { label: 'Lectures completed', value: analysis.completedLessons, hint: `${lectures.length} available` },
                { label: 'Study minutes', value: Math.round(analysis.watchedSeconds / 60), hint: 'Total watch time' },
                { label: 'Level', value: analysis.level, hint: `${analysis.totalScore}/${analysis.totalMaxScore} marks` },
              ].map((stat) => (
                <div key={stat.label} className="ec-card p-4">
                  <p className="text-[10px] uppercase tracking-[0.1em] text-ink-400 font-bold">{stat.label}</p>
                  <p className="text-xl font-extrabold mt-1 tabular-nums">{stat.value}</p>
                  <p className="text-[10px] text-ink-500 mt-0.5">{stat.hint}</p>
                </div>
              ))}
            </div>
          </SectionShell>
        );
      }
      case 'announcements': {
        if (!announcements.length) return null;
        return (
          <SectionShell key={section.id} section={section}>
            <div className="space-y-2">
              {announcements.slice(0, limit).map((announcement: Announcement) => (
                <div key={announcement.id} className="ec-card p-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-bold">{announcement.title}</p>
                    <span className="rounded-full bg-brand-50 text-brand-700 px-2 py-0.5 text-[10px] font-bold">{announcement.audience}</span>
                  </div>
                  <p className="text-xs text-ink-600 mt-1">{announcement.body}</p>
                  {announcement.scheduled_at && <p className="text-[10px] text-ink-400 mt-2">{formatISTDateTime(announcement.scheduled_at)}</p>}
                </div>
              ))}
            </div>
          </SectionShell>
        );
      }
      case 'challenges': {
        if (!config.features.challenges || !activeChallenges.length) return null;
        return (
          <SectionShell key={section.id} section={section}>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {activeChallenges.slice(0, limit).map((challenge) => (
                <ChallengeCard
                  key={challenge.id}
                  challenge={challenge}
                  joined={joinedChallenges.has(challenge.id)}
                  onToggle={() => void toggleChallenge(challenge)}
                />
              ))}
            </div>
          </SectionShell>
        );
      }
      case 'leaderboard_preview': {
        if (!config.features.leaderboard || leaderError || !leaders.length) return null;
        return (
          <SectionShell key={section.id} section={section}>
            <div className="ec-card p-4">
              <ol className="space-y-2">
                {leaders.slice(0, limit).map((entry) => (
                  <li key={entry.firebaseUid} className="flex items-center gap-2.5">
                    <span className="h-6 w-6 rounded-full bg-ink-100 grid place-items-center text-[10px] font-bold">{entry.rank}</span>
                    <span className="text-xs font-semibold flex-1 truncate">{entry.name}</span>
                    <span className="text-[11px] tabular-nums">{entry.score}/{entry.maxScore}</span>
                  </li>
                ))}
              </ol>
              {primaryTestId && (
                <Link href={`/leaderboard?testId=${primaryTestId}`} className="mt-3 inline-flex text-[11px] font-bold text-brand-700">
                  Full leaderboard →
                </Link>
              )}
            </div>
          </SectionShell>
        );
      }
      case 'quick_links': {
        const links = config.navigation.headerLinks.filter((link) => link.visible && isValidInternalDeepLink(link.href));
        if (!links.length) return null;
        return (
          <SectionShell key={section.id} section={section}>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {links.map((link) => (
                <Link key={link.id} href={link.href} className="ec-card px-3 py-3 text-xs font-bold flex items-center gap-2">
                  <span className="text-base">{link.icon || '→'}</span>
                  <span className="truncate">{link.label}</span>
                </Link>
              ))}
            </div>
          </SectionShell>
        );
      }
      case 'promo':
      case 'custom': {
        if (!section.body && !section.imageUrl) return null;
        return (
          <SectionShell key={section.id} section={section}>
            <div
              className="rounded-[var(--ec-radius)] overflow-hidden grid md:grid-cols-2"
              style={{ background: section.accent || 'var(--ec-brand)' }}
            >
              <div className="p-5 sm:p-6 text-white">
                {section.title && <h3 className="text-lg font-extrabold">{section.title}</h3>}
                {section.body && <p className="text-sm opacity-90 mt-1.5 whitespace-pre-line">{section.body}</p>}
                {section.ctaLabel && isValidInternalDeepLink(section.ctaHref) && (
                  <Link href={section.ctaHref} className="inline-flex mt-3 px-3.5 py-2 rounded-[var(--ec-button-radius)] bg-white text-ink-900 text-xs font-bold">
                    {section.ctaLabel}
                  </Link>
                )}
              </div>
              {isSafeHttpUrl(section.imageUrl) && (
                <img src={section.imageUrl} alt="" className="h-40 md:h-full w-full object-cover" loading="lazy" />
              )}
            </div>
          </SectionShell>
        );
      }
      case 'testimonials': {
        if (!config.features.testimonials) return null;
        const items = config.testimonials.items.filter((item) => item.active).slice(0, limit);
        if (!items.length) return null;
        return (
          <SectionShell key={section.id} section={section}>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {items.map((item) => (
                <div key={item.id} className="ec-card p-4">
                  <p className="text-[11px] text-amber-500">{'★'.repeat(item.rating)}</p>
                  <p className="text-xs text-ink-700 mt-1.5">“{item.quote}”</p>
                  <p className="text-[11px] font-bold mt-2">{item.name}{item.result ? ` · ${item.result}` : ''}</p>
                </div>
              ))}
            </div>
          </SectionShell>
        );
      }
      default:
        return null;
    }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <PopupHost placement="home" student={audience} />

      {config.homepage.showGreeting && (
        <section className="ec-hero-panel ec-fade-up p-5 sm:p-6 lg:p-7">
          <div className="ec-hero-lines pointer-events-none absolute inset-0" aria-hidden />
          <div className="relative grid gap-5 lg:grid-cols-[minmax(0,1.55fr)_minmax(280px,1fr)] lg:items-center">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="ec-eyebrow inline-flex items-center gap-1.5">
                  <Sparkles size={12} /> {profile.exam} command deck
                </span>
                {todayGoal && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[10px] font-bold text-amber-800">
                    <Flame size={11} /> Today&apos;s goal live
                  </span>
                )}
              </div>
              {config.homepage.showGreeting ? (
                <p className="mt-2 text-[12px] font-semibold text-ink-500">{greeting}</p>
              ) : null}
              <h1 className="ec-display mt-1.5 max-w-3xl">
                <span className="ec-gradient-text">{heroTitle || greeting}</span>
              </h1>
              <p className="ec-lead mt-2.5 max-w-xl text-[0.92rem]">
                {heroSubtitle ||
                  `A focused study plan for ${profile.exam} · ${formatClassLevel(profile.class_level)}. Pick up where you left off, then put your preparation to the test.`}
              </p>

              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                <span className="ec-chip"><GraduationCap size={12} /> {profile.exam} · {formatClassLevel(profile.class_level)}</span>
                <span className="ec-chip"><BookOpenCheck size={12} /> {enrolledCount} course{enrolledCount === 1 ? '' : 's'} unlocked</span>
                {analysis && <span className="ec-level-badge"><Trophy size={11} /> {analysis.level}</span>}
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Link
                  href={resumeLecture ? `/lectures/${resumeLecture.id}` : '/lectures'}
                  className="ec-btn inline-flex items-center gap-2 bg-[var(--ec-brand)] px-4 py-2.5 text-xs font-bold text-[var(--ec-on-brand)] shadow-sm hover:opacity-95"
                >
                  <PlayCircle size={16} />
                  {resumeLecture && progressByLecture.has(resumeLecture.id) ? 'Continue learning' : 'Start learning'}
                </Link>
                <Link
                  href={nextTest ? `/tests/${nextTest.id}` : '/tests'}
                  className="ec-btn inline-flex items-center gap-1.5 border border-[rgb(var(--ec-ink-200))] bg-[var(--ec-surface)] px-3.5 py-2.5 text-xs font-bold text-ink-800 hover:bg-ink-50"
                >
                  <BookOpenCheck size={15} />
                  {nextTest ? (nextTest.isLive ? 'Live test now' : 'Next test') : 'Browse tests'}
                  <ArrowRight size={13} className="opacity-60" />
                </Link>
                {heroSection?.ctaLabel && isValidInternalDeepLink(heroSection.ctaHref) ? (
                  <Link
                    href={heroSection.ctaHref}
                    className="ec-btn inline-flex items-center gap-1.5 px-3 py-2.5 text-xs font-bold text-brand-700 hover:bg-brand-50"
                  >
                    {heroSection.ctaLabel}
                    <ArrowRight size={13} className="opacity-70" />
                  </Link>
                ) : null}
                {todayGoal && isValidInternalDeepLink(String(metaOf(todayGoal).deepLink || '')) && (
                  <Link
                    href={String(metaOf(todayGoal).deepLink)}
                    className="ec-btn inline-flex items-center gap-1.5 px-3 py-2.5 text-xs font-bold text-amber-800 hover:bg-amber-50"
                  >
                    <Flame size={14} /> {(metaOf(todayGoal).ctaLabel as string) || 'Start today’s goal'}
                  </Link>
                )}
              </div>
            </div>

            {config.homepage.showQuickStats && (
              <div className="rounded-[calc(var(--ec-radius)+4px)] border border-white/60 bg-white/55 p-3.5 backdrop-blur-sm">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-ink-500">Your real progress</p>
                  {analysis && <span className="ec-level-badge">{analysis.level}</span>}
                </div>
                <div className="mt-2.5 grid grid-cols-2 gap-2">
                  {[
                    { label: 'Tests taken', value: analysis ? String(analysis.testsTaken) : '—', icon: <BookOpenCheck size={13} /> },
                    {
                      label: 'Average score',
                      value: analysis && analysis.testsTaken > 0 ? `${analysis.averagePercentage.toFixed(0)}%` : '—',
                      icon: <Trophy size={13} />,
                    },
                    { label: 'Lessons done', value: analysis ? String(analysis.completedLessons) : '—', icon: <PlayCircle size={13} /> },
                    {
                      label: 'Day streak',
                      value: analysis ? String(activityStreak([...analysis.attempts.map((a) => a.submitted_at), ...analysis.lessonProgress.map((p) => p.updated_at || '')])) : '—',
                      icon: <Flame size={13} />,
                    },
                  ].map((stat) => (
                    <div key={stat.label} className="ec-stat-tile">
                      <p className="flex items-center gap-1 text-[8.5px] font-bold uppercase tracking-[0.1em] text-ink-400">
                        {stat.icon} {stat.label}
                      </p>
                      <p className="mt-0.5 text-lg font-extrabold leading-none text-ink-900">{stat.value}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-3">
                  <div className="flex items-center justify-between text-[10px] font-semibold text-ink-500">
                    <span>Average across attempts</span>
                    <span>{analysis ? `${Math.round(analysis.averagePercentage)}%` : 'No attempts yet'}</span>
                  </div>
                  <div className="mt-1.5 ec-progress-lg">
                    <span style={{ width: `${analysis ? Math.min(100, Math.max(0, analysis.averagePercentage)) : 0}%` }} />
                  </div>
                  <p className="mt-1.5 text-[9.5px] leading-relaxed text-ink-400">
                    {analysis?.testsTaken
                      ? `${formatWatchDuration(analysis.watchedSeconds)} watched · ${analysis.completedLessons} lessons completed.`
                      : 'Take your first test to start a real progress history.'}
                  </p>
                </div>
              </div>
            )}
          </div>

          {config.homepage.showSearch && config.features.search && (
            <form action="/search" className="relative mt-5 max-w-2xl">
              <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
              <input
                name="q"
                aria-label="Search lectures, tests and batches"
                placeholder={config.seo.searchPlaceholder || 'Search lectures, tests, batches…'}
                className="h-11 w-full rounded-[14px] border border-[rgb(var(--ec-ink-200))] bg-[var(--ec-surface)] pl-10 pr-24 text-sm outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
              />
              <button type="submit" className="absolute right-1.5 top-1/2 -translate-y-1/2 ec-btn bg-[var(--ec-brand)] px-3.5 py-1.5 text-[11px] font-bold text-[var(--ec-on-brand)]">
                Search
              </button>
            </form>
          )}
        </section>
      )}

      {!config.homepage.showGreeting && config.homepage.showSearch && config.features.search && (
        <form action="/search" className="relative">
          <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
          <input
            name="q"
            aria-label="Search lectures, tests and batches"
            placeholder={config.seo.searchPlaceholder || 'Search lectures, tests, batches…'}
            className="h-11 w-full rounded-[14px] border border-[rgb(var(--ec-ink-200))] bg-[var(--ec-surface)] pl-10 pr-24 text-sm outline-none focus:border-brand-400"
          />
          <button type="submit" className="absolute right-1.5 top-1/2 -translate-y-1/2 ec-btn bg-[var(--ec-brand)] px-3.5 py-1.5 text-[11px] font-bold text-[var(--ec-on-brand)]">
            Search
          </button>
        </form>
      )}

      {dashboardBanners.length > 0 && (
        <BannerCarousel banners={dashboardBanners} settings={config.banners} compact />
      )}

      <FeatureStrip />

      <BatchShowcase
        batches={batches}
        config={config.batchStudio}
        student={profile ? { exam: profile.exam, classLevel: profile.class_level } : null}
        page="home"
      />

      {sections.length === 0 ? (
        <div className="ec-card p-8 text-center">
          <p className="font-bold">{config.theme.emptyStateTitle || 'Nothing here yet'}</p>
          <p className="text-sm text-ink-500 mt-1">{config.theme.emptyStateBody || 'Your admin has not published homepage sections yet.'}</p>
        </div>
      ) : (
        sections.map((section) => renderSection(section))
      )}

    </div>
  );
}

function orderByIds(items: CourseCatalogItem[], ids?: string[]): CourseCatalogItem[] {
  if (!ids || ids.length === 0) return items;
  const byId = new Map(items.map((item) => [item.id, item]));
  const ordered = ids.map((id) => byId.get(id)).filter((item): item is CourseCatalogItem => Boolean(item));
  const rest = items.filter((item) => !ids.includes(item.id));
  return [...ordered, ...rest];
}

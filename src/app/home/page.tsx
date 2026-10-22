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
import { ArrowRight, CalendarDays, Flame, Search } from 'lucide-react';
import {
  getHomeSectionsForStudent,
  selectBannersForPlacement,
  type StudentAudience,
} from '@/lib/site-config';
import YoutubeThumbnail from '@/components/YoutubeThumbnail';
import { BannerCarousel } from '@/components/banners/BannerCarousel';
import { PopupHost } from '@/components/site/PopupHost';
import { BatchShowcase } from '@/components/batches/BatchShowcase';
import {
  ClassicSection,
  FeatureCards,
  HomeHero,
  HomeStatsPanel,
  ProfileChips,
  SmartLink,
  StepCards,
  isUsableHref,
  visibleItems,
  type HeroTokens,
} from '@/components/home/ClassicHome';

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
    <Link href={`/lectures/${item.id}`} className="ecc-card group">
      <YoutubeThumbnail
        src={customThumbOf(item)}
        videoId={String(meta.videoId || '')}
        alt={item.title}
        duration={meta.duration ? String(meta.duration) : null}
        badge={meta.isPreview === true ? 'Free preview' : subjectLabel || item.kind}
        subjectName={subjectLabel || item.exam}
        className="aspect-video w-full"
      />
      <div className="ecc-card-body">
        <p className="ecc-card-title line-clamp-2">{item.title}</p>
        {item.description && <p className="ecc-card-text line-clamp-2">{item.description}</p>}
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          <span className="ecc-chip ecc-chip-brand">{item.exam}</span>
          <span className="ecc-chip">{formatClassList(item.classes)}</span>
          {subjectLabel && <span className="ecc-chip">{subjectLabel}</span>}
        </div>
        <span className="ecc-link mt-auto pt-3">
          {cta} <ArrowRight size={13} />
        </span>
      </div>
    </Link>
  );
}

function TestCard({ test }: { test: TestCardItem }) {
  return (
    <div className="ecc-card">
      <div className="ecc-card-body">
        <div className="flex items-start justify-between gap-2">
          <p className="ecc-card-title line-clamp-2">{test.title}</p>
          <span className={`ecc-chip shrink-0 ${test.isLive ? 'ecc-chip-live' : 'ecc-chip-brand'}`}>
            {test.isLive ? 'Live' : 'Scheduled'}
          </span>
        </div>
        {test.description && <p className="ecc-card-text line-clamp-2">{test.description}</p>}
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {test.subject && <span className="ecc-chip">{test.subject}</span>}
          <span className="ecc-chip">{test.durationMinutes || 0} min</span>
          <span className="ecc-chip">{test.totalQuestions} Qs</span>
        </div>
        <p className="mt-2.5 text-[0.72rem] text-ink-500">
          {test.scheduledAt ? formatISTDateTime(test.scheduledAt) : 'No schedule'}
          {test.endsAt ? ` → ${formatISTDateTime(test.endsAt)}` : ''}
        </p>
        <Link href={`/tests/${test.id}`} className="ecc-btn ecc-btn-brand mt-3 w-full">
          {test.isLive ? 'Attempt now' : 'Open test'} <ArrowRight size={14} />
        </Link>
      </div>
    </div>
  );
}

function GoalCard({ item }: { item: CourseCatalogItem }) {
  const meta = metaOf(item);
  const deepLink = typeof meta.deepLink === 'string' ? meta.deepLink : '';
  return (
    <div className="ecc-card border-l-4" style={{ borderLeftColor: 'var(--ec-brand)' }}>
      <div className="ecc-card-body">
        <p className="ecc-stat-label">Today&apos;s goal</p>
        <h3 className="mt-1 text-[1.05rem] font-bold leading-snug">{item.title}</h3>
        {item.description && <p className="ecc-card-text">{item.description}</p>}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {Boolean(meta.startsAt || meta.endsAt) && (
            <span className="text-[0.72rem] text-ink-500">
              {meta.startsAt ? formatISTDateTime(String(meta.startsAt)) : 'Now'}
              {meta.endsAt ? ` → ${formatISTDateTime(String(meta.endsAt))}` : ''}
            </span>
          )}
          {deepLink && isValidInternalDeepLink(deepLink) && (
            <Link href={deepLink} className="ecc-btn ecc-btn-brand ml-auto !min-h-0 !py-2 text-[0.78rem]">
              {(meta.ctaLabel as string) || 'Start'}
            </Link>
          )}
        </div>
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
    <div className="ecc-card">
      <div className="ecc-card-body">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <span className="ecc-icon !h-9 !w-9" style={challenge.color ? { color: challenge.color } : undefined}>
              <Flame size={16} />
            </span>
            <p className="ecc-card-title">{challenge.title}</p>
          </div>
          <span className="ecc-chip shrink-0">
            {challenge.targetCount} {challenge.targetType}
          </span>
        </div>
        <p className="ecc-card-text line-clamp-2">
          {challenge.description || 'Stay consistent and finish the target before the window closes.'}
        </p>
        {challenge.reward && <p className="mt-2 text-[0.76rem] font-semibold text-amber-700">🏅 {challenge.reward}</p>}
        <button
          type="button"
          onClick={onToggle}
          className={`ecc-btn mt-auto w-full ${joined ? 'ecc-btn-outline' : 'ecc-btn-brand'}`}
          style={{ marginTop: '0.9rem' }}
        >
          {joined ? 'Joined ✓ · tap to leave' : <>Join challenge <ArrowRight size={13} /></>}
        </button>
      </div>
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
      <div className="mx-auto max-w-6xl space-y-4">
        <div className="ec-skeleton h-44 w-full" />
        <div className="ec-skeleton h-12 w-full" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="ec-skeleton h-40" />
          <div className="ec-skeleton h-40" />
          <div className="ec-skeleton h-40" />
        </div>
      </div>
    );
  }

  if (!profile || !bootstrap) {
    return (
      <div className="ecc-card mx-auto max-w-2xl p-6 text-center">
        <p className="font-semibold">Unable to load your dashboard</p>
        <p className="mt-1 text-sm text-ink-500">{error || 'Please try again.'}</p>
        <button type="button" onClick={() => void refresh()} className="ecc-btn ecc-btn-brand mx-auto mt-4">
          Retry
        </button>
      </div>
    );
  }

  const homepage = config.homepage;
  const hero = homepage.hero;
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
  const featuredBatches = orderByIds(batches, homepage.sections.find((s) => s.type === 'featured_batches')?.itemIds);
  const featuredSeries = orderByIds(series, homepage.sections.find((s) => s.type === 'featured_series')?.itemIds);
  const popularLectures = orderByIds(lectures, homepage.sections.find((s) => s.type === 'popular_lectures')?.itemIds);
  const sections = getHomeSectionsForStudent(homepage, audience);
  const firstName = profile.display_name.split(' ')[0] || 'there';
  const tokens: HeroTokens = { name: firstName, exam: profile.exam, classLabel: formatClassLevel(profile.class_level) };
  const greeting = homepage.greetingTemplate.replace(/\{name\}/g, firstName);
  const heroBanners = selectBannersForPlacement(config.banners, audience, 'home_hero');
  const dashboardBanners = selectBannersForPlacement(config.banners, audience, 'dashboard').filter(
    (b) => !heroBanners.some((hb) => hb.id === b.id)
  );
  const primaryTestId = (liveTests[0] || upcomingTests[0])?.id;
  const nextTest = liveTests[0] || upcomingTests[0];
  const enrolledCount = activeEnrollmentKeys(bootstrap.enrollments).size;
  const resumeLecture = continueLearning.find((lecture) => progressByLecture.has(lecture.id)) || continueLearning[0];

  const primaryAction = {
    label: hero.primaryCtaLabel || (resumeLecture && progressByLecture.has(resumeLecture.id) ? 'Continue learning' : 'Start learning'),
    href: isUsableHref(hero.primaryCtaHref) ? hero.primaryCtaHref : resumeLecture ? `/lectures/${resumeLecture.id}` : '/lectures',
  };
  const secondaryAction = hero.showSecondaryCta
    ? {
        label: hero.secondaryCtaLabel || (nextTest ? (nextTest.isLive ? 'Live test now' : 'Next test') : 'Browse tests'),
        href: isUsableHref(hero.secondaryCtaHref) ? hero.secondaryCtaHref : nextTest ? `/tests/${nextTest.id}` : '/tests',
      }
    : null;
  const streak = activityStreak([
    ...(analysis?.attempts.map((a) => a.submitted_at) || []),
    ...(analysis?.lessonProgress.map((p) => p.updated_at || '') || []),
  ]);

  function renderSection(section: HomeSectionConfig) {
    const limit = Math.max(1, Math.min(24, section.limit || 6));
    switch (section.type) {
      case 'hero': {
        if (!heroBanners.length) return null;
        return (
          <ClassicSection key={section.id} section={section}>
            <BannerCarousel banners={heroBanners.slice(0, limit)} settings={config.banners} />
          </ClassicSection>
        );
      }
      case 'dashboard_banners': {
        if (!dashboardBanners.length) return null;
        return (
          <ClassicSection key={section.id} section={section}>
            <BannerCarousel banners={dashboardBanners.slice(0, limit)} settings={config.banners} compact />
          </ClassicSection>
        );
      }
      case 'feature_grid': {
        const items = visibleItems(section.items, config.features);
        if (!items.length) return null;
        return (
          <ClassicSection key={section.id} section={section}>
            <FeatureCards section={section} items={items} />
          </ClassicSection>
        );
      }
      case 'how_it_works': {
        const items = visibleItems(section.items);
        if (!items.length) return null;
        return (
          <ClassicSection key={section.id} section={section}>
            <StepCards section={section} items={items} />
          </ClassicSection>
        );
      }
      case 'batch_showcase': {
        const showcase = (
          <BatchShowcase
            batches={batches}
            config={config.batchStudio}
            student={{ exam: profile!.exam, classLevel: profile!.class_level }}
            page="home"
          />
        );
        if (!section.title && !section.subtitle) return <div key={section.id}>{showcase}</div>;
        return (
          <ClassicSection key={section.id} section={section}>
            {showcase}
          </ClassicSection>
        );
      }
      case 'goal': {
        if (!goals.length) return null;
        return (
          <ClassicSection key={section.id} section={section}>
            <div className="grid gap-3 md:grid-cols-2">
              {goals.slice(0, limit).map((goal) => <GoalCard key={goal.id} item={goal} />)}
            </div>
          </ClassicSection>
        );
      }
      case 'live_tests':
      case 'upcoming_tests': {
        if (!config.features.tests) return null;
        const list = section.type === 'live_tests' ? liveTests : upcomingTests;
        if (!list.length) return null;
        return (
          <ClassicSection key={section.id} section={section}>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {list.slice(0, limit).map((test) => <TestCard key={test.id} test={test} />)}
            </div>
          </ClassicSection>
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
          <ClassicSection key={section.id} section={section}>
            <div className="grid gap-3 sm:grid-cols-2">
              {liveEvents.slice(0, limit).map((event) => {
                const meta = metaOf(event);
                const images = Array.isArray(meta.images) ? (meta.images as Array<{ url?: string }>) : [];
                const image = images[0]?.url || customThumbOf(event);
                const start = typeof meta.startsAt === 'string' ? new Date(meta.startsAt) : null;
                return (
                  <div key={event.id} className="ecc-card flex-row">
                    <div className="flex w-[72px] shrink-0 flex-col items-center justify-center border-r border-ink-100 bg-ink-50 py-3 text-center">
                      <span className="text-[1.4rem] font-extrabold leading-none">
                        {start ? start.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit' }) : '—'}
                      </span>
                      <span className="mt-1 text-[0.66rem] font-bold uppercase tracking-[0.08em] text-ink-500">
                        {start ? start.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', month: 'short' }) : 'TBA'}
                      </span>
                    </div>
                    <div className="ecc-card-body min-w-0">
                      <p className="ecc-card-title">{event.title}</p>
                      {event.description && <p className="ecc-card-text line-clamp-2">{event.description}</p>}
                      <p className="mt-1.5 flex items-center gap-1 text-[0.72rem] font-semibold text-ink-600">
                        <CalendarDays size={12} />
                        {typeof meta.startsAt === 'string' ? formatISTDateTime(meta.startsAt) : 'Schedule soon'}
                        {typeof meta.endsAt === 'string' ? ` → ${formatISTDateTime(meta.endsAt)}` : ''}
                      </p>
                      {image && isSafeHttpUrl(image) && (
                        <img src={image} alt="" className="mt-2 h-20 w-full rounded-lg object-cover" loading="lazy" />
                      )}
                      {typeof meta.deepLink === 'string' && isValidInternalDeepLink(meta.deepLink) && (
                        <Link href={meta.deepLink} className="ecc-link mt-2">
                          {(meta.ctaLabel as string) || 'View event'} <ArrowRight size={12} />
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </ClassicSection>
        );
      }
      case 'featured_batches':
      case 'featured_series': {
        const list = section.type === 'featured_batches' ? featuredBatches : featuredSeries;
        if (!list.length) return null;
        return (
          <ClassicSection key={section.id} section={section}>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {list.slice(0, limit).map((item) => <ContentCard key={item.id} item={item} cta="View programme" />)}
            </div>
          </ClassicSection>
        );
      }
      case 'continue_learning': {
        if (!config.features.continueLearning || !continueLearning.length) return null;
        return (
          <ClassicSection key={section.id} section={section}>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {continueLearning.slice(0, limit).map((lecture) => {
                const progress = progressByLecture.get(lecture.id);
                const meta = metaOf(lecture);
                const pct = progress
                  ? progress.completed
                    ? 100
                    : Math.min(95, Math.max(6, Math.round((progress.watched_seconds / 1800) * 100)))
                  : 0;
                return (
                  <Link key={lecture.id} href={`/lectures/${lecture.id}`} className="ecc-card flex-row items-center gap-3 p-3">
                    <YoutubeThumbnail
                      src={customThumbOf(lecture)}
                      videoId={String(meta.videoId || '')}
                      alt={lecture.title}
                      progressPercent={pct}
                      completed={progress?.completed}
                      className="aspect-video w-28 shrink-0 rounded-md"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-[0.82rem] font-bold leading-snug">{lecture.title}</p>
                      <p className="mt-1 text-[0.72rem] text-ink-500">
                        {progress
                          ? progress.completed
                            ? 'Completed · Rewatch'
                            : `${Math.max(1, Math.round(progress.watched_seconds / 60))} min watched`
                          : 'Start lecture'}
                      </p>
                      <div className="ecc-bar mt-2 !h-1.5">
                        <span style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </ClassicSection>
        );
      }
      case 'popular_lectures': {
        if (!popularLectures.length) return null;
        return (
          <ClassicSection key={section.id} section={section}>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {popularLectures.slice(0, limit).map((lecture) => <ContentCard key={lecture.id} item={lecture} cta="Watch" />)}
            </div>
          </ClassicSection>
        );
      }
      case 'subject_shortcuts': {
        if (!subjects.length) return null;
        return (
          <ClassicSection key={section.id} section={section}>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
              {subjects.slice(0, limit).map((subject) => (
                <Link key={subject} href={`/lectures?q=${encodeURIComponent(subject)}`} className="ecc-card flex-row items-center gap-3 p-3">
                  <span className="ecc-icon !text-[0.8rem]">{subject.slice(0, 2).toUpperCase()}</span>
                  <span className="min-w-0 flex-1 truncate text-[0.86rem] font-bold">{subject}</span>
                  <ArrowRight size={14} className="shrink-0 text-ink-400" />
                </Link>
              ))}
            </div>
          </ClassicSection>
        );
      }
      case 'study_progress': {
        if (!analysis) return null;
        return (
          <ClassicSection key={section.id} section={section}>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { label: 'Tests taken', value: analysis.testsTaken, hint: `${analysis.averagePercentage.toFixed(1)}% average` },
                { label: 'Lectures completed', value: analysis.completedLessons, hint: `${lectures.length} available` },
                { label: 'Study minutes', value: Math.round(analysis.watchedSeconds / 60), hint: 'Total watch time' },
                { label: 'Level', value: analysis.level, hint: `${analysis.totalScore}/${analysis.totalMaxScore} marks` },
              ].map((stat) => (
                <div key={stat.label} className="ecc-card p-4">
                  <p className="ecc-stat-label">{stat.label}</p>
                  <p className="ecc-stat-value !text-[1.5rem]">{stat.value}</p>
                  <p className="mt-1 text-[0.72rem] text-ink-500">{stat.hint}</p>
                </div>
              ))}
            </div>
          </ClassicSection>
        );
      }
      case 'announcements': {
        if (!announcements.length) return null;
        return (
          <ClassicSection key={section.id} section={section}>
            <div className="ecc-card divide-y divide-ink-100">
              {announcements.slice(0, limit).map((announcement: Announcement) => (
                <div key={announcement.id} className="px-4 py-3.5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="text-[0.9rem] font-bold leading-snug">{announcement.title}</p>
                    <span className="ecc-chip ecc-chip-brand">{announcement.audience}</span>
                  </div>
                  <p className="mt-1 text-[0.82rem] leading-relaxed text-ink-600">{announcement.body}</p>
                  {announcement.scheduled_at && (
                    <p className="mt-1.5 text-[0.7rem] text-ink-400">{formatISTDateTime(announcement.scheduled_at)}</p>
                  )}
                </div>
              ))}
            </div>
          </ClassicSection>
        );
      }
      case 'challenges': {
        if (!config.features.challenges || !activeChallenges.length) return null;
        return (
          <ClassicSection key={section.id} section={section}>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {activeChallenges.slice(0, limit).map((challenge) => (
                <ChallengeCard
                  key={challenge.id}
                  challenge={challenge}
                  joined={joinedChallenges.has(challenge.id)}
                  onToggle={() => void toggleChallenge(challenge)}
                />
              ))}
            </div>
          </ClassicSection>
        );
      }
      case 'leaderboard_preview': {
        if (!config.features.leaderboard || leaderError || !leaders.length) return null;
        return (
          <ClassicSection key={section.id} section={section}>
            <div className="ecc-card overflow-x-auto">
              <table className="w-full text-left text-[0.84rem]">
                <thead>
                  <tr className="border-b border-ink-100 bg-ink-50 text-[0.68rem] uppercase tracking-[0.08em] text-ink-500">
                    <th className="px-4 py-2.5 font-bold">Rank</th>
                    <th className="px-4 py-2.5 font-bold">Student</th>
                    <th className="px-4 py-2.5 text-right font-bold">Score</th>
                  </tr>
                </thead>
                <tbody>
                  {leaders.slice(0, limit).map((entry) => (
                    <tr key={entry.firebaseUid} className="border-b border-ink-100 last:border-0">
                      <td className="px-4 py-2.5">
                        <span className={`ecc-chip ${entry.rank <= 3 ? 'ecc-chip-brand' : ''}`}>#{entry.rank}</span>
                      </td>
                      <td className="max-w-[16rem] truncate px-4 py-2.5 font-semibold">{entry.name}</td>
                      <td className="px-4 py-2.5 text-right font-bold tabular-nums">
                        {entry.score}/{entry.maxScore}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {primaryTestId && (
                <div className="border-t border-ink-100 px-4 py-2.5">
                  <Link href={`/leaderboard?testId=${primaryTestId}`} className="ecc-link">
                    Full leaderboard <ArrowRight size={12} />
                  </Link>
                </div>
              )}
            </div>
          </ClassicSection>
        );
      }
      case 'quick_links': {
        const links = config.navigation.headerLinks.filter((link) => link.visible && isValidInternalDeepLink(link.href));
        if (!links.length) return null;
        return (
          <ClassicSection key={section.id} section={section}>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              {links.slice(0, limit).map((link) => (
                <Link key={link.id} href={link.href} className="ecc-card flex-row items-center gap-2.5 p-3">
                  <span className="ecc-icon !h-9 !w-9 !text-[1rem]">{link.icon || '→'}</span>
                  <span className="truncate text-[0.84rem] font-bold">{link.label}</span>
                </Link>
              ))}
            </div>
          </ClassicSection>
        );
      }
      case 'promo':
      case 'custom': {
        if (!section.body && !section.imageUrl) return null;
        const promo = section.type === 'promo';
        const card = (
            <div
              className={`ecc-card md:grid md:grid-cols-2 ${promo ? 'text-white' : ''}`}
              style={promo ? { background: section.accent || 'var(--ec-brand)', borderColor: 'transparent' } : undefined}
            >
              <div className="p-5 sm:p-6">
                {promo && section.title && <h3 className="text-lg font-extrabold">{section.title}</h3>}
                {promo && section.subtitle && <p className="mt-1 text-sm font-semibold opacity-90">{section.subtitle}</p>}
                {section.body && (
                  <p className={`mt-1.5 whitespace-pre-line text-sm leading-relaxed ${promo ? 'opacity-90' : 'text-ink-600'}`}>{section.body}</p>
                )}
                {promo && section.ctaLabel && isUsableHref(section.ctaHref) && (
                  <SmartLink href={section.ctaHref} className="ecc-btn ecc-btn-light mt-4">
                    {section.ctaLabel}
                  </SmartLink>
                )}
              </div>
              {isSafeHttpUrl(section.imageUrl) && (
                <img src={section.imageUrl} alt="" className="h-44 w-full object-cover md:h-full" loading="lazy" />
              )}
            </div>
        );
        if (promo) return <section key={section.id}>{card}</section>;
        return (
          <ClassicSection key={section.id} section={section}>
            {card}
          </ClassicSection>
        );
      }
      case 'testimonials': {
        if (!config.features.testimonials) return null;
        const items = config.testimonials.items.filter((item) => item.active).slice(0, limit);
        if (!items.length) return null;
        return (
          <ClassicSection key={section.id} section={section}>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((item) => (
                <figure key={item.id} className="ecc-card p-4">
                  <p className="text-[0.8rem] text-amber-500">{'★'.repeat(item.rating)}</p>
                  <blockquote className="mt-1.5 text-[0.84rem] leading-relaxed text-ink-700">“{item.quote}”</blockquote>
                  <figcaption className="mt-3 text-[0.78rem] font-bold">
                    {item.name}
                    {item.result ? <span className="font-medium text-ink-500"> · {item.result}</span> : null}
                  </figcaption>
                </figure>
              ))}
            </div>
          </ClassicSection>
        );
      }
      default:
        return null;
    }
  }

  const searchEnabled = homepage.showSearch && config.features.search;

  return (
    <div className="ecc-page mx-auto max-w-[1180px]">
      <PopupHost placement="home" student={audience} />

      {homepage.showGreeting && (
        <HomeHero
          hero={hero}
          tokens={tokens}
          greeting={greeting}
          primary={primaryAction}
          secondary={secondaryAction}
          chips={<ProfileChips exam={profile.exam} classLabel={formatClassLevel(profile.class_level)} unlocked={enrolledCount} />}
          aside={
            homepage.showQuickStats ? (
              <HomeStatsPanel
                title={analysis ? `${analysis.testsTaken} tests · ${analysis.completedLessons} lessons` : 'No attempts yet'}
                badge={analysis ? analysis.level : 'Start now'}
                percent={analysis && analysis.testsTaken > 0 ? analysis.averagePercentage : null}
                stats={[
                  { label: 'Tests', value: analysis ? String(analysis.testsTaken) : '—' },
                  { label: 'Lessons', value: analysis ? String(analysis.completedLessons) : '—' },
                  { label: 'Watch time', value: analysis ? formatWatchDuration(analysis.watchedSeconds) : '—' },
                  { label: 'Day streak', value: String(streak) },
                ]}
              />
            ) : undefined
          }
        />
      )}

      {searchEnabled && (
        <form action="/search" className="ecc-search" role="search">
          <Search size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-400" />
          <input
            name="q"
            aria-label="Search lectures, tests and batches"
            placeholder={config.seo.searchPlaceholder || 'Search lectures, tests, batches…'}
          />
          <button type="submit" className="ecc-btn ecc-btn-brand absolute right-1.5 top-1/2 !min-h-0 -translate-y-1/2 !px-4 !py-2 text-[0.8rem]">
            Search
          </button>
        </form>
      )}

      {sections.map((section) => renderSection(section))}
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

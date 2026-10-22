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
import { ArrowRight, BookOpenCheck, Flame, GraduationCap, Layers, PlayCircle, Search, Sparkles, Trophy } from 'lucide-react';
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
import { Reveal } from '@/components/motion/Reveal';

function sectionTint(seed: string): string {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) hash = (hash * 31 + seed.charCodeAt(index)) % 997;
  return `var(--ec-c${(hash % 8) + 1})`;
}

function SectionShell({
  section,
  children,
  index = 0,
}: {
  section: HomeSectionConfig;
  children: React.ReactNode;
  index?: number;
}) {
  const tint = section.accent || sectionTint(section.id || section.type);
  return (
    <section style={{ ['--sec-tint' as string]: tint }}>
      {(section.title || section.subtitle) && (
        <div className="ec-sec-head mb-3.5">
          <div className="flex min-w-0 items-start gap-3">
            <span className="ec-sec-num shrink-0">{String(index + 1).padStart(2, '0')}</span>
            <div className="min-w-0">
              {section.title && <h2 className="ec-sec-title">{section.title}</h2>}
              {section.subtitle && (
                <p className="mt-1 max-w-2xl text-[0.8rem] leading-relaxed text-ink-500">{section.subtitle}</p>
              )}
            </div>
          </div>
          {section.ctaLabel && isValidInternalDeepLink(section.ctaHref) && (
            <Link href={section.ctaHref} className="ec-sec-link shrink-0">
              {section.ctaLabel} <ArrowRight size={12} />
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
    <Link href={`/lectures/${item.id}`} className="group ec-tile flex flex-col">
      <div className="ec-tile-media aspect-video w-full">
        <YoutubeThumbnail
          src={customThumbOf(item)}
          videoId={String(meta.videoId || '')}
          alt={item.title}
          duration={meta.duration ? String(meta.duration) : null}
          badge={meta.isPreview === true ? 'Free preview' : subjectLabel || item.kind}
          subjectName={subjectLabel || item.exam}
          className="aspect-video w-full"
        />
      </div>
      <div className="flex flex-1 flex-col p-3.5">
        <p className="ec-tile-title line-clamp-2 transition group-hover:text-brand-700">{item.title}</p>
        {item.description && <p className="mt-1 line-clamp-2 text-[0.76rem] leading-relaxed text-ink-500">{item.description}</p>}
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[0.6rem] font-extrabold uppercase tracking-[0.06em] text-brand-700">
            {item.exam}
          </span>
          <span className="rounded-full bg-ink-100 px-2 py-0.5 text-[0.6rem] font-bold text-ink-600">{formatClassList(item.classes)}</span>
          {subjectLabel && <span className="rounded-full bg-ink-100 px-2 py-0.5 text-[0.6rem] font-bold text-ink-600">{subjectLabel}</span>}
        </div>
        <div className="mt-auto flex items-center justify-between pt-3">
          <span className="text-[0.72rem] font-extrabold text-brand-700">{cta}</span>
          <span className="ec-tile-arrow"><ArrowRight size={13} /></span>
        </div>
      </div>
    </Link>
  );
}

function TestCard({ test }: { test: TestCardItem }) {
  return (
    <div className="ec-tile flex flex-col p-4" style={{ ['--bento' as string]: 'var(--ec-c6)' }}>
      <div className="flex items-start justify-between gap-2">
        <p className="ec-tile-title line-clamp-2">{test.title}</p>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[0.6rem] font-extrabold uppercase tracking-[0.08em] ${
            test.isLive ? 'bg-emerald-50 text-emerald-700' : 'bg-sky-50 text-sky-700'
          }`}
        >
          {test.isLive ? 'Live' : 'Scheduled'}
        </span>
      </div>
      <p className="mt-1 line-clamp-2 text-[0.74rem] leading-relaxed text-ink-500">{test.description}</p>
      <div className="mt-2 flex flex-wrap gap-1">
        {test.subject && <span className="rounded-full bg-ink-100 px-2 py-0.5 text-[0.6rem] font-bold text-ink-600">{test.subject}</span>}
        <span className="rounded-full bg-ink-100 px-2 py-0.5 text-[0.6rem] font-bold text-ink-600">{test.durationMinutes || 0} min</span>
        <span className="rounded-full bg-ink-100 px-2 py-0.5 text-[0.6rem] font-bold text-ink-600">{test.totalQuestions} Qs</span>
      </div>
      <p className="mt-2 text-[0.64rem] font-medium text-ink-400">
        {test.scheduledAt ? formatISTDateTime(test.scheduledAt) : 'No schedule'}
        {test.endsAt ? ` → ${formatISTDateTime(test.endsAt)}` : ''}
      </p>
      <Link
        href={`/tests/${test.id}`}
        className="ec-btn mt-3 flex w-full items-center justify-center gap-1 bg-[var(--ec-brand)] px-3 py-2 text-[0.72rem] font-extrabold text-[var(--ec-on-brand)]"
      >
        {test.isLive ? 'Attempt now' : 'Open test'} <ArrowRight size={12} />
      </Link>
    </div>
  );
}

function GoalCard({ item }: { item: CourseCatalogItem }) {
  const meta = metaOf(item);
  const deepLink = typeof meta.deepLink === 'string' ? meta.deepLink : '';
  return (
    <div className="ec-shine relative overflow-hidden rounded-[calc(var(--ec-radius)+2px)] p-4 text-white sm:p-5" style={{ background: 'var(--ec-grad-aurora)' }}>
      <p className="text-[0.6rem] font-extrabold uppercase tracking-[0.2em] opacity-75">Today&apos;s goal</p>
      <h3 className="mt-1.5 text-[1.15rem] font-extrabold leading-tight tracking-[-0.02em]">{item.title}</h3>
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
  const tint = challenge.color || 'var(--ec-c3)';
  return (
    <div
      className="ec-tile relative overflow-hidden p-4"
      style={{
        ['--bento' as string]: tint,
        background: `radial-gradient(320px 140px at 100% 0%, color-mix(in srgb, ${tint} 20%, transparent), transparent 70%), var(--ec-surface)`,
        borderColor: `color-mix(in srgb, ${tint} 30%, var(--ec-border))`,
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className="grid h-8 w-8 place-items-center rounded-[11px] text-white"
            style={{ background: `linear-gradient(140deg, ${tint}, color-mix(in srgb, ${tint} 50%, #fff))` }}
          >
            <Flame size={15} />
          </span>
          <p className="text-[0.9rem] font-extrabold leading-tight">{challenge.title}</p>
        </div>
        <span className="shrink-0 rounded-full bg-ink-100 px-2 py-0.5 text-[0.6rem] font-extrabold text-ink-600">
          {challenge.targetCount} {challenge.targetType}
        </span>
      </div>
      <p className="mt-2 line-clamp-2 text-[0.76rem] leading-relaxed text-ink-500">
        {challenge.description || 'Stay consistent and finish the target before the window closes.'}
      </p>
      {challenge.reward && (
        <p className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-dashed border-amber-300 bg-amber-50 px-2.5 py-1 text-[0.7rem] font-extrabold text-amber-800">
          🏅 {challenge.reward}
        </p>
      )}
      <button
        type="button"
        onClick={onToggle}
        className={`ec-btn mt-3 flex w-full items-center justify-center gap-1.5 px-3 py-2 text-[0.74rem] font-extrabold ${
          joined ? 'border border-emerald-200 bg-emerald-50 text-emerald-700' : 'text-white'
        }`}
        style={joined ? undefined : { background: `linear-gradient(120deg, ${tint}, color-mix(in srgb, ${tint} 55%, #7c3aed))` }}
      >
        {joined ? 'Joined ✓ · tap to leave' : <>Join challenge <ArrowRight size={12} /></>}
      </button>
    </div>
  );
}

function HowItWorks() {
  const steps = [
    {
      n: '01',
      title: 'Pick your batch',
      body: 'Open Lectures, match the batch to your exam and class, then unlock it with a code if needed.',
      tint: 'var(--ec-c1)',
      icon: <Layers size={16} />,
    },
    {
      n: '02',
      title: 'Watch, read, practise',
      body: 'Every subject lists ordered lectures and notes — then a timed test turns it into marks.',
      tint: 'var(--ec-c6)',
      icon: <PlayCircle size={16} />,
    },
    {
      n: '03',
      title: 'Track your progress',
      body: 'Review real test scores, streaks and leaderboard positions as your preparation improves.',
      tint: 'var(--ec-c3)',
      icon: <Trophy size={16} />,
    },
  ];
  return (
    <Reveal motion="fade-up">
      <div className="grid gap-2.5 md:grid-cols-3">
        {steps.map((step) => (
          <div
            key={step.n}
            className="ec-bento-tile !min-h-[128px]"
            style={{ ['--bento' as string]: step.tint }}
          >
            <div className="flex items-center justify-between">
              <span className="ec-bento-icon">{step.icon}</span>
              <span className="text-[1.5rem] font-black leading-none tracking-[-0.05em] text-transparent" style={{ WebkitTextStroke: `1.3px color-mix(in srgb, ${step.tint} 60%, transparent)` }}>
                {step.n}
              </span>
            </div>
            <div className="relative z-[1]">
              <p className="text-[0.9rem] font-extrabold tracking-[-0.02em]">{step.title}</p>
              <p className="mt-1 text-[0.74rem] leading-relaxed text-ink-500">{step.body}</p>
            </div>
          </div>
        ))}
      </div>
    </Reveal>
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
    const sectionIndex = Math.max(0, sections.findIndex((entry) => entry.id === section.id));
    const limit = Math.max(1, Math.min(24, section.limit || 6));
    switch (section.type) {
      case 'hero': {
        if (!config.features.events && heroBanners.length === 0) return null;
        if (!heroBanners.length) return null;
        return (
          <SectionShell key={section.id} section={section} index={sectionIndex}>
            <BannerCarousel banners={heroBanners.slice(0, limit)} settings={config.banners} />
          </SectionShell>
        );
      }
      case 'goal': {
        if (!config.features.challenges && !goals.length) return null;
        if (!goals.length) return null;
        return (
          <SectionShell key={section.id} section={section} index={sectionIndex}>
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
          <SectionShell key={section.id} section={section} index={sectionIndex}>
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
          <SectionShell key={section.id} section={section} index={sectionIndex}>
            <div className="grid sm:grid-cols-2 gap-3">
              {liveEvents.slice(0, limit).map((event) => {
                const meta = metaOf(event);
                const images = Array.isArray(meta.images) ? (meta.images as Array<{ url?: string }>) : [];
                const image = images[0]?.url || customThumbOf(event);
                return (
                  <div key={event.id} className="ec-tile flex overflow-hidden" style={{ ['--bento' as string]: 'var(--ec-c7)' }}>
                    <div
                      className="flex w-[74px] shrink-0 flex-col items-center justify-center gap-0.5 text-white"
                      style={{ background: 'linear-gradient(160deg, #047857, #14b8a6)' }}
                    >
                      <span className="text-[1.35rem] font-black leading-none tracking-[-0.04em]">
                        {typeof meta.startsAt === 'string' ? new Date(meta.startsAt).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit' }) : '—'}
                      </span>
                      <span className="text-[0.6rem] font-extrabold uppercase tracking-[0.12em] opacity-90">
                        {typeof meta.startsAt === 'string' ? new Date(meta.startsAt).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', month: 'short' }) : 'TBA'}
                      </span>
                      <span className="mt-1 rounded-full bg-white/20 px-1.5 py-0.5 text-[0.5rem] font-extrabold uppercase tracking-[0.08em]">
                        IST
                      </span>
                    </div>
                    <div className="min-w-0 flex-1 p-3.5">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-[0.86rem] font-extrabold leading-snug">{event.title}</p>
                        <ArrowRight size={13} className="mt-1 shrink-0 text-ink-300" />
                      </div>
                      <p className="mt-1 line-clamp-2 text-[0.74rem] leading-relaxed text-ink-500">{event.description}</p>
                      <p className="mt-1.5 text-[0.66rem] font-semibold text-brand-700">
                        {typeof meta.startsAt === 'string' ? formatISTDateTime(meta.startsAt) : 'Schedule soon'}
                        {typeof meta.endsAt === 'string' ? ` → ${formatISTDateTime(meta.endsAt)}` : ''}
                      </p>
                      {image && isSafeHttpUrl(image) && (
                        <img src={image} alt="" className="mt-2 h-20 w-full rounded-xl object-cover" loading="lazy" />
                      )}
                      {typeof meta.deepLink === 'string' && isValidInternalDeepLink(meta.deepLink) && (
                        <Link href={meta.deepLink} className="ec-sec-link mt-2">
                          {(meta.ctaLabel as string) || 'View event'} <ArrowRight size={11} />
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
          <SectionShell key={section.id} section={section} index={sectionIndex}>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {list.slice(0, limit).map((item) => <ContentCard key={item.id} item={item} cta="View programme" />)}
            </div>
          </SectionShell>
        );
      }
      case 'continue_learning': {
        if (!config.features.continueLearning || !continueLearning.length) return null;
        return (
          <SectionShell key={section.id} section={section} index={sectionIndex}>
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
          <SectionShell key={section.id} section={section} index={sectionIndex}>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {popularLectures.slice(0, limit).map((lecture) => <ContentCard key={lecture.id} item={lecture} cta="Watch" />)}
            </div>
          </SectionShell>
        );
      }
      case 'subject_shortcuts': {
        if (!subjects.length) return null;
        return (
          <SectionShell key={section.id} section={section} index={sectionIndex}>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
              {subjects.map((subject, subjectIndex) => {
                const tint = `var(--ec-c${(subjectIndex % 8) + 1})`;
                return (
                  <Link
                    key={subject}
                    href={`/lectures?q=${encodeURIComponent(subject)}`}
                    className="ec-bento-tile !min-h-[86px] !px-3 !py-3"
                    style={{ ['--bento' as string]: tint }}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className="grid h-9 w-9 place-items-center rounded-[12px] text-[0.82rem] font-black text-white"
                        style={{ background: `linear-gradient(135deg, ${tint}, color-mix(in srgb, ${tint} 45%, #fff))` }}
                      >
                        {subject.slice(0, 2).toUpperCase()}
                      </span>
                      <ArrowRight size={13} className="text-ink-300" />
                    </div>
                    <p className="relative z-[1] text-[0.82rem] font-extrabold leading-tight">{subject}</p>
                  </Link>
                );
              })}
            </div>
          </SectionShell>
        );
      }
      case 'study_progress': {
        if (!analysis) return null;
        return (
          <SectionShell key={section.id} section={section} index={sectionIndex}>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { label: 'Tests taken', value: analysis.testsTaken, hint: `${analysis.averagePercentage.toFixed(1)}% average` },
                { label: 'Lectures completed', value: analysis.completedLessons, hint: `${lectures.length} available` },
                { label: 'Study minutes', value: Math.round(analysis.watchedSeconds / 60), hint: 'Total watch time' },
                { label: 'Level', value: analysis.level, hint: `${analysis.totalScore}/${analysis.totalMaxScore} marks` },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="ec-tile p-4"
                  style={{ ['--bento' as string]: `var(--ec-c${(stat.label.length % 8) + 1})` }}
                >
                  <p className="text-[0.6rem] font-extrabold uppercase tracking-[0.12em] text-ink-400">{stat.label}</p>
                  <p className="mt-1.5 text-[1.5rem] font-extrabold leading-none tracking-[-0.03em] tabular-nums">{stat.value}</p>
                  <p className="mt-1 text-[0.66rem] text-ink-500">{stat.hint}</p>
                </div>
              ))}
            </div>
          </SectionShell>
        );
      }
      case 'announcements': {
        if (!announcements.length) return null;
        return (
          <SectionShell key={section.id} section={section} index={sectionIndex}>
            <ol className="relative space-y-2 border-l-2 border-dashed pl-4" style={{ borderColor: 'color-mix(in srgb, var(--sec-tint) 35%, transparent)' }}>
              {announcements.slice(0, limit).map((announcement: Announcement, noticeIndex) => (
                <li key={announcement.id} className="relative">
                  <span
                    className="absolute -left-[22px] top-4 h-3 w-3 rounded-full border-2 border-[var(--ec-surface)]"
                    style={{ background: `var(--ec-c${(noticeIndex % 8) + 1})` }}
                    aria-hidden
                  />
                  <div className="ec-tile p-3.5">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="text-[0.86rem] font-extrabold leading-snug">{announcement.title}</p>
                      <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[0.6rem] font-extrabold uppercase tracking-[0.06em] text-brand-700">
                        {announcement.audience}
                      </span>
                    </div>
                    <p className="mt-1 text-[0.78rem] leading-relaxed text-ink-600">{announcement.body}</p>
                    {announcement.scheduled_at && (
                      <p className="mt-2 text-[0.64rem] font-semibold text-ink-400">{formatISTDateTime(announcement.scheduled_at)}</p>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </SectionShell>
        );
      }
      case 'challenges': {
        if (!config.features.challenges || !activeChallenges.length) return null;
        return (
          <SectionShell key={section.id} section={section} index={sectionIndex}>
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
          <SectionShell key={section.id} section={section} index={sectionIndex}>
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
              <div className="grid grid-cols-3 items-end gap-2 rounded-[calc(var(--ec-radius)+2px)] border border-ink-100 bg-[var(--ec-surface)] p-3">
                {[1, 0, 2].map((index) => {
                  const entry = leaders[index];
                  if (!entry) return <div key={`gap-${index}`} />;
                  const medal = ['#fbbf24', '#cbd5e1', '#f59e0b'][index] || '#cbd5e1';
                  const heights = ['h-24', 'h-32', 'h-20'];
                  const order = leaders[index];
                  return (
                    <div key={entry.firebaseUid} className="flex flex-col items-center gap-1.5 text-center">
                      <span
                        className="grid h-10 w-10 place-items-center rounded-full text-[0.7rem] font-black text-white"
                        style={{ background: `linear-gradient(140deg, ${medal}, color-mix(in srgb, ${medal} 55%, #7c3aed))` }}
                      >
                        {order.rank}
                      </span>
                      <p className="line-clamp-1 text-[0.68rem] font-bold">{entry.name}</p>
                      <div
                        className={`w-full ${heights[index] || 'h-20'} rounded-t-xl`}
                        style={{
                          background: `linear-gradient(180deg, color-mix(in srgb, ${medal} 55%, transparent), color-mix(in srgb, ${medal} 12%, transparent))`,
                        }}
                      >
                        <p className="pt-1 text-[0.62rem] font-extrabold tabular-nums text-ink-700">{entry.score}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="ec-tile p-3.5">
                <p className="text-[0.62rem] font-extrabold uppercase tracking-[0.14em] text-ink-400">Your field</p>
                <ol className="mt-2 space-y-1.5">
                  {leaders.slice(3, Math.max(3, limit)).map((entry) => (
                    <li key={entry.firebaseUid} className="flex items-center gap-2.5 rounded-xl px-2 py-1.5 hover:bg-ink-50">
                      <span className="grid h-5 w-5 place-items-center rounded-full bg-ink-100 text-[0.58rem] font-extrabold">{entry.rank}</span>
                      <span className="flex-1 truncate text-[0.76rem] font-semibold">{entry.name}</span>
                      <span className="text-[0.7rem] font-bold tabular-nums text-ink-600">{entry.score}/{entry.maxScore}</span>
                    </li>
                  ))}
                  {leaders.length <= 3 && (
                    <li className="rounded-xl bg-ink-50 px-2 py-2 text-[0.72rem] text-ink-500">
                      Submit a test to enter the ranking — only real attempts count.
                    </li>
                  )}
                </ol>
                {primaryTestId && (
                  <Link href={`/leaderboard?testId=${primaryTestId}`} className="ec-sec-link mt-2.5">
                    Full leaderboard <ArrowRight size={12} />
                  </Link>
                )}
              </div>
            </div>
          </SectionShell>
        );
      }
      case 'quick_links': {
        const links = config.navigation.headerLinks.filter((link) => link.visible && isValidInternalDeepLink(link.href));
        if (!links.length) return null;
        return (
          <SectionShell key={section.id} section={section} index={sectionIndex}>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              {links.map((link, linkIndex) => (
                <Link
                  key={link.id}
                  href={link.href}
                  className="ec-bento-tile !min-h-[72px] !flex-row !items-center !gap-2.5 !px-3 !py-3"
                  style={{ ['--bento' as string]: `var(--ec-c${(linkIndex % 8) + 1})` }}
                >
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px] bg-[var(--ec-surface)] text-[0.9rem] shadow-sm">
                    {link.icon || '→'}
                  </span>
                  <span className="relative z-[1] truncate text-[0.76rem] font-extrabold">{link.label}</span>
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
          <SectionShell key={section.id} section={section} index={sectionIndex}>
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
          <SectionShell key={section.id} section={section} index={sectionIndex}>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {items.map((item) => (
                <div key={item.id} className="ec-tile p-4" style={{ ['--bento' as string]: 'var(--ec-c5)' }}>
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
    <div className="mx-auto max-w-[1240px] space-y-7">
      <PopupHost placement="home" student={audience} />

      {config.homepage.showGreeting && (
        <section className="ec-night ec-hero-deck ec-fade-up">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="dx-pill">
                <span className="dx-live-dot" /> {profile.exam} command deck
              </span>
              {analysis && <span className="dx-pill"><Trophy size={11} /> {analysis.level}</span>}
              {todayGoal && (
                <span className="dx-pill !border-amber-300/40 !bg-amber-300/10 !text-amber-200">
                  <Flame size={11} /> Today&apos;s goal is live
                </span>
              )}
            </div>

            <p className="mt-4 text-[0.72rem] font-bold uppercase tracking-[0.2em] text-white/40">{greeting}</p>
            <h1 className="ec-kinetic mt-2 max-w-[20ch]">
              {heroTitle ? (
                <>
                  {heroTitle.split(' ').slice(0, Math.max(1, heroTitle.split(' ').length - 3)).join(' ')}{' '}
                  <span className="ec-gradient-hot">
                    {heroTitle.split(' ').slice(-3).join(' ')}
                  </span>
                </>
              ) : (
                <>
                  Your rank is built <span className="ec-gradient-hot">one focused day</span> at a time.
                </>
              )}
            </h1>
            <p className="mt-3.5 max-w-xl text-[0.92rem] leading-relaxed text-white/60">
              {heroSubtitle ||
                `A focused plan for ${profile.exam} · ${formatClassLevel(profile.class_level)}. Continue where you stopped, then test yourself against the clock.`}
            </p>

            <div className="mt-5 flex flex-wrap items-center gap-2">
              <Link href={resumeLecture ? `/lectures/${resumeLecture.id}` : '/lectures'} className="dx-cta">
                <PlayCircle size={16} />
                {resumeLecture && progressByLecture.has(resumeLecture.id) ? 'Continue learning' : 'Start learning'}
              </Link>
              <Link href={nextTest ? `/tests/${nextTest.id}` : '/tests'} className="dx-cta-ghost">
                <BookOpenCheck size={15} />
                {nextTest ? (nextTest.isLive ? 'Live test now' : 'Next test') : 'Browse tests'}
                <ArrowRight size={13} className="opacity-60" />
              </Link>
              {heroSection?.ctaLabel && isValidInternalDeepLink(heroSection.ctaHref) ? (
                <Link href={heroSection.ctaHref} className="dx-cta-ghost">
                  {heroSection.ctaLabel} <ArrowRight size={13} className="opacity-70" />
                </Link>
              ) : null}
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-1.5">
              <span className="dx-pill !text-[0.66rem]"><GraduationCap size={12} /> {profile.exam} · {formatClassLevel(profile.class_level)}</span>
              <span className="dx-pill !text-[0.66rem]"><BookOpenCheck size={12} /> {enrolledCount} course{enrolledCount === 1 ? '' : 's'} unlocked</span>
              {todayGoal && isValidInternalDeepLink(String(metaOf(todayGoal).deepLink || '')) && (
                <Link href={String(metaOf(todayGoal).deepLink)} className="dx-pill !text-[0.66rem] !border-amber-300/40 !text-amber-200">
                  <Flame size={12} /> {(metaOf(todayGoal).ctaLabel as string) || 'Start today’s goal'}
                </Link>
              )}
            </div>
          </div>

          {config.homepage.showQuickStats && (
            <div className="ec-preview-dash p-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-[0.6rem] font-extrabold uppercase tracking-[0.16em] text-white/40">Your real progress</p>
                  <p className="mt-1 text-[1.05rem] font-extrabold tracking-[-0.02em] text-white">
                    {analysis ? `${analysis.testsTaken} tests · ${analysis.completedLessons} lessons` : 'No attempts yet'}
                  </p>
                </div>
                <span className="rounded-full border border-[var(--dx-lime)]/40 bg-[var(--dx-lime)]/10 px-2 py-0.5 text-[0.6rem] font-extrabold uppercase tracking-[0.1em] text-[var(--dx-lime)]">
                  {analysis ? analysis.level : 'Start now'}
                </span>
              </div>

              <div className="mt-4 flex items-center gap-4">
                <div className="dx-ring" style={{ ['--pct' as string]: Math.round(analysis ? Math.min(100, Math.max(0, analysis.averagePercentage)) : 0) }}>
                  <span>{analysis && analysis.testsTaken > 0 ? `${Math.round(analysis.averagePercentage)}%` : '—'}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: 'Tests', value: analysis ? String(analysis.testsTaken) : '—' },
                      { label: 'Lessons', value: analysis ? String(analysis.completedLessons) : '—' },
                      { label: 'Watch time', value: analysis ? formatWatchDuration(analysis.watchedSeconds) : '—' },
                      { label: 'Streak', value: String(activityStreak([...(analysis?.attempts.map((a) => a.submitted_at) || []), ...(analysis?.lessonProgress.map((p) => p.updated_at || '') || [])])) },
                    ].map((stat) => (
                      <div key={stat.label} className="dx-stat">
                        <p className="dx-stat-label">{stat.label}</p>
                        <p className="dx-stat-value mt-1 text-white">{stat.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-4">
                <div className="flex items-center justify-between text-[0.62rem] font-bold uppercase tracking-[0.1em] text-white/40">
                  <span>Average across attempts</span>
                  <span className="text-white/70">{analysis ? `${Math.round(analysis.averagePercentage)}%` : '—'}</span>
                </div>
                <div className="mt-2 ec-progress-lg !bg-white/10">
                  <span style={{ width: `${analysis ? Math.min(100, Math.max(0, analysis.averagePercentage)) : 0}%` }} />
                </div>
                <div className="dx-bars mt-3" aria-hidden>
                  {[...(analysis?.attempts.slice(-8) || []), ...Array(Math.max(0, 8 - (analysis?.attempts.length || 0))).fill(null)].slice(0, 8).map((attempt, index) => (
                    <span
                      key={index}
                      style={{
                        height: `${Math.max(12, attempt && attempt.max_score > 0 ? Math.round((attempt.score / attempt.max_score) * 100) : 8)}%`,
                        animationDelay: `${index * 60}ms`,
                        opacity: attempt ? 1 : 0.28,
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {config.homepage.showSearch && config.features.search && (
            <form action="/search" className="relative lg:col-span-2">
              <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-white/40" />
              <input
                name="q"
                aria-label="Search lectures, tests and batches"
                placeholder={config.seo.searchPlaceholder || 'Search lectures, tests, batches…'}
                className="h-12 w-full rounded-full border border-white/12 bg-white/[0.06] pl-11 pr-28 text-[0.86rem] text-white outline-none backdrop-blur transition placeholder:text-white/35 focus:border-[var(--dx-lime)]/60 focus:ring-2 focus:ring-[var(--dx-lime)]/20"
              />
              <button type="submit" className="dx-cta absolute right-1.5 top-1/2 -translate-y-1/2 !px-4 !py-2 !text-[0.72rem]">
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

      <HowItWorks />

      <BatchShowcase
        batches={batches}
        config={config.batchStudio}
        student={profile ? { exam: profile.exam, classLevel: profile.class_level } : null}
        page="home"
      />

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

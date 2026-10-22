'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { BookOpenCheck, CalendarClock, Clock3, ListChecks, RefreshCw, Search, Timer, Trophy, Zap } from 'lucide-react';
import { getStudentTests } from '@/lib/api';
import { Badge, Skeleton } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { formatISTDateTime } from '@/lib/date';
import { formatClassLevel, formatClassList } from '@/lib/validation';
import { selectBannersForPlacement } from '@/lib/site-config';
import { BannerCarousel } from '@/components/banners/BannerCarousel';
import { useAuth } from '@/context/AuthContext';
import { useSiteConfig } from '@/context/SiteConfigContext';
import type { TestCardItem } from '@/types';
import { visibleSectionIds } from '@/lib/screen-config';
import {
  ScreenAnnouncementBanner,
  ScreenEmpty,
  ScreenHelpNote,
  ScreenPageHeader,
  ScreenSection,
  screenGridClass,
} from '@/components/student/ScreenScaffold';

type Filter = 'all' | 'live' | 'upcoming' | 'completed';

export default function TestsPage() {
  const { profile, isAdmin } = useAuth();
  const { config } = useSiteConfig();
  const screen = config.tests;
  const [tests, setTests] = useState<TestCardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<'soonest' | 'title'>('soonest');
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setTests(await getStudentTests());
      setNow(Date.now());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load tests.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const counts = useMemo(
    () => ({
      all: tests.length,
      live: tests.filter((test) => test.isLive).length,
      upcoming: tests.filter((test) => !test.isLive && test.scheduledAt && new Date(test.scheduledAt).getTime() > now).length,
      completed: tests.filter((test) => test.endsAt && new Date(test.endsAt).getTime() < now).length,
    }),
    [tests, now]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = tests.filter((test) => {
      if (q && !`${test.title} ${test.description} ${test.subject || ''}`.toLowerCase().includes(q)) return false;
      if (filter === 'all') return true;
      if (filter === 'live') return test.isLive;
      if (filter === 'upcoming') return !test.isLive && Boolean(test.scheduledAt) && new Date(test.scheduledAt as string).getTime() > now;
      if (filter === 'completed') return Boolean(test.endsAt) && new Date(test.endsAt as string).getTime() < now;
      return true;
    });
    const sorted = sort === 'title'
      ? [...list].sort((a, b) => a.title.localeCompare(b.title))
      : [...list].sort((a, b) => {
          const aTime = a.scheduledAt ? new Date(a.scheduledAt).getTime() : Number.MAX_SAFE_INTEGER;
          const bTime = b.scheduledAt ? new Date(b.scheduledAt).getTime() : Number.MAX_SAFE_INTEGER;
          return aTime - bTime;
        });
    return screen.itemLimit > 0 ? sorted.slice(0, screen.itemLimit) : sorted;
  }, [tests, filter, query, sort, now, screen.itemLimit]);

  const sections = visibleSectionIds('tests', screen);
  const gridClass = screenGridClass(screen.layout);
  const testBanners = useMemo(
    () =>
      selectBannersForPlacement(
        config.banners,
        profile ? { exam: profile.exam, classLevel: profile.class_level } : null,
        'tests'
      ),
    [config.banners, profile]
  );

  function renderCatalogue() {
    if (loading) {
      return (
        <div className={gridClass}>
          {[1, 2, 3, 4, 5, 6].map((index) => (
            <Skeleton key={index} className="h-52" />
          ))}
        </div>
      );
    }
    if (error) {
      return (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
          <Button size="sm" variant="outline" className="ml-2" onClick={() => void load()}>
            Try again
          </Button>
        </div>
      );
    }
    if (filtered.length === 0) {
      return (
        <ScreenEmpty
          icon={<ListChecks size={18} />}
          title={query ? screen.noResultsTitle : screen.emptyTitle}
          body={query ? screen.noResultsBody : screen.emptyBody}
          action={
            isAdmin ? (
              <Link href="/admin/tests" className="ec-btn bg-ink-900 px-4 py-2 text-sm font-semibold text-white">
                Create a test
              </Link>
            ) : undefined
          }
        />
      );
    }
    return (
      <div className={gridClass}>
        {filtered.map((test) => {
          const ended = Boolean(test.endsAt && new Date(test.endsAt).getTime() < now);
          const status = test.isLive ? 'live' : ended ? 'ended' : 'scheduled';
          return (
            <article key={test.id} className="ec-card ec-card-interactive flex flex-col p-4">
              <div className="flex items-start justify-between gap-2">
                <h2 className="text-sm font-bold leading-snug line-clamp-2">{test.title}</h2>
                <span
                  className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ${
                    status === 'live'
                      ? 'bg-emerald-50 text-emerald-700'
                      : status === 'ended'
                        ? 'bg-ink-100 text-ink-500'
                        : 'bg-sky-50 text-sky-700'
                  }`}
                >
                  {status === 'live' && <span className="ec-live-dot" />}
                  {status}
                </span>
              </div>
              <p className="mt-1 text-xs text-ink-500 line-clamp-2">{test.description || 'No description.'}</p>

              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {test.subject && <Badge variant="info">{test.subject}</Badge>}
                {test.classes?.length ? <Badge>{formatClassList(test.classes)}</Badge> : null}
                <Badge variant="default"><Clock3 size={9} className="mr-0.5" /> {test.durationMinutes || 0} min</Badge>
                <Badge variant="default"><ListChecks size={9} className="mr-0.5" /> {test.totalQuestions} Qs</Badge>
                {test.totalMarks ? <Badge variant="default">{test.totalMarks} marks</Badge> : null}
              </div>

              <div className="mt-3 space-y-1 text-[10.5px] text-ink-500">
                <p className="flex items-center gap-1">
                  <CalendarClock size={11} />
                  {test.scheduledAt ? formatISTDateTime(test.scheduledAt) : 'No start time'}
                </p>
                {test.endsAt && <p className="pl-4">Ends {formatISTDateTime(test.endsAt)}</p>}
              </div>

              <div className="mt-3 flex gap-2 pt-1">
                <Link
                  href={`/tests/${test.id}`}
                  className={`ec-btn flex flex-1 items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold text-white ${
                    status === 'live' ? 'bg-emerald-600' : ended ? 'bg-ink-500' : 'bg-brand-600'
                  }`}
                >
                  {status === 'live' ? <><Zap size={13} /> {screen.attemptCtaLabel}</> : ended ? screen.endedCtaLabel : screen.openCtaLabel}
                </Link>
                <Link
                  href={`/leaderboard?testId=${test.id}`}
                  className="ec-btn inline-flex items-center gap-1 border border-ink-200 px-2.5 py-2 text-xs font-semibold"
                  aria-label={`Leaderboard for ${test.title}`}
                >
                  <Trophy size={13} />
                </Link>
              </div>
            </article>
          );
        })}
      </div>
    );
  }

  function renderSection(id: string) {
    if (id === 'filters') {
      if (!screen.showFilters && !screen.showSearch && !screen.showSort) return null;
      return (
        <div key={id} className="ec-card space-y-2 p-3 sm:flex sm:items-center sm:justify-between sm:space-y-0">
          {screen.showFilters ? (
            <div className="flex flex-wrap items-center gap-1.5">
              {(['all', 'live', 'upcoming', 'completed'] as Filter[]).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setFilter(item)}
                  aria-pressed={filter === item}
                  className={`ec-btn px-3 py-1.5 text-[11px] font-bold transition ${
                    filter === item ? 'bg-brand-600 text-white shadow-sm' : 'text-ink-600 hover:bg-ink-100'
                  }`}
                >
                  {screen.filterLabels[item]}
                  <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[9px] ${filter === item ? 'bg-white/20' : 'bg-ink-100'}`}>
                    {counts[item]}
                  </span>
                </button>
              ))}
            </div>
          ) : <span />}
          <div className="mt-2 flex flex-wrap items-center gap-2 sm:mt-0">
            {screen.showSearch ? (
              <div className="relative min-w-[170px] flex-1">
                <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={screen.searchPlaceholder}
                  aria-label="Search tests"
                  className="ec-field !py-2 !pl-8 !text-xs"
                  type="search"
                />
              </div>
            ) : null}
            {screen.showSort ? (
              <select
                value={sort}
                onChange={(event) => setSort(event.target.value as 'soonest' | 'title')}
                className="ec-field !w-auto !py-2 !text-xs"
                aria-label="Sort tests"
              >
                <option value="soonest">{screen.sortSoonestLabel}</option>
                <option value="title">{screen.sortTitleLabel}</option>
              </select>
            ) : null}
          </div>
        </div>
      );
    }
    if (id === 'catalogue') return <div key={id}>{renderCatalogue()}</div>;
    if (id === 'info') {
      return (
        <ScreenSection key={id} title={screen.infoTitle}>
          <p className="rounded-[var(--ec-radius)] border border-ink-100 bg-[var(--ec-surface)] p-4 text-[11.5px] leading-relaxed text-ink-500">
            {screen.infoBody}
          </p>
        </ScreenSection>
      );
    }
    return null;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <ScreenPageHeader
        showHeader={screen.showHeader}
        eyebrow={screen.eyebrow}
        title={screen.pageTitle}
        description={screen.pageSubtitle}
        meta={
          <>
            {profile ? <span className="ec-chip"><BookOpenCheck size={12} /> {profile.exam} · {formatClassLevel(profile.class_level)}</span> : null}
            {counts.live > 0 ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-800">
                <span className="ec-live-dot" /> {counts.live} live now
              </span>
            ) : null}
            <span className="ec-chip"><Timer size={12} /> {counts.upcoming} upcoming</span>
          </>
        }
        actions={
          <Button size="sm" variant="outline" onClick={() => void load()} aria-label="Refresh tests">
            <RefreshCw size={14} className="mr-1.5" /> Refresh
          </Button>
        }
      />

      {testBanners.length > 0 && (
        <BannerCarousel banners={testBanners} settings={config.banners} compact />
      )}

      <ScreenAnnouncementBanner announcement={screen.announcement} />

      {sections.map((id) => renderSection(id))}

      <ScreenHelpNote help={screen.help} />
    </div>
  );
}

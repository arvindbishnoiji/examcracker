'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import type { CourseCatalogItem, TestCardItem } from '@/types';
import { getStudentTests } from '@/lib/api';
import { useSiteConfig } from '@/context/SiteConfigContext';
import { visibleSectionIds } from '@/lib/screen-config';
import {
  ScreenAnnouncementBanner,
  ScreenEmpty,
  ScreenHelpNote,
  ScreenPageHeader,
} from '@/components/student/ScreenScaffold';

type ResultKind = 'lecture' | 'test' | 'batch' | 'series' | 'event' | 'announcement';

interface SearchResult {
  id: string;
  title: string;
  description: string;
  kind: ResultKind;
  href: string;
  exam: string;
  classes: string[];
  updatedAt: string;
  badge?: string;
}

interface AnnouncementRecord {
  id: string;
  title?: string;
  message?: string;
  body?: string;
  active?: boolean;
  created_at?: string;
}

const KIND_LABEL: Record<ResultKind, string> = {
  lecture: 'Lecture',
  test: 'Test',
  batch: 'Batch',
  series: 'Series',
  event: 'Event',
  announcement: 'Notice',
};

function metaOf(item: CourseCatalogItem): Record<string, unknown> {
  return (item.metadata || {}) as Record<string, unknown>;
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="max-w-4xl mx-auto ec-skeleton h-64" />}>
      <SearchScreen />
    </Suspense>
  );
}

function SearchScreen() {
  const router = useRouter();
  const params = useSearchParams();
  const { bootstrap, profile, initializing, user } = useAuth();
  const { config } = useSiteConfig();
  const screen = config.search;
  const [query, setQuery] = useState(params?.get('q') || '');
  const [committed, setCommitted] = useState(params?.get('q') || '');
  const [kind, setKind] = useState<'all' | ResultKind>('all');
  const [sort, setSort] = useState<'relevance' | 'newest' | 'az'>('relevance');
  const [tests, setTests] = useState<TestCardItem[]>([]);
  const [testsLoading, setTestsLoading] = useState(false);

  useEffect(() => {
    if (!initializing && !user) router.replace('/login');
  }, [initializing, user, router]);

  useEffect(() => {
    const incoming = params?.get('q') || '';
    setQuery(incoming);
    setCommitted(incoming);
  }, [params]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setTestsLoading(true);
    getStudentTests()
      .then((items) => {
        if (!cancelled) setTests(items);
      })
      .catch(() => {
        if (!cancelled) setTests([]);
      })
      .finally(() => {
        if (!cancelled) setTestsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const results = useMemo<SearchResult[]>(() => {
    const items: SearchResult[] = [];
    for (const item of bootstrap?.content || []) {
      if (item.kind === 'test') continue;
      if (item.kind === 'batch' || item.kind === 'series' || item.kind === 'event') {
        items.push({
          id: item.id,
          title: item.title,
          description: item.description || '',
          kind: item.kind,
          href: item.kind === 'event' ? '/events' : `/lectures?kind=${item.kind}&q=${encodeURIComponent(item.title)}`,
          exam: item.exam,
          classes: (item.classes || []).map(String),
          updatedAt: item.updated_at || '',
          badge: item.kind === 'batch' && Boolean(metaOf(item).codeDisplay) ? 'Access code' : undefined,
        });
      } else {
        items.push({
          id: item.id,
          title: item.title,
          description: [item.description, metaOf(item).subtitle, metaOf(item).instructor]
            .filter((value): value is string => typeof value === 'string' && value.length > 0)
            .join(' · '),
          kind: 'lecture',
          href: `/lectures/${item.id}`,
          exam: item.exam,
          classes: (item.classes || []).map(String),
          updatedAt: item.updated_at || '',
          badge: Boolean(metaOf(item).isPreview) ? 'Preview' : undefined,
        });
      }
    }
    for (const test of tests) {
      items.push({
        id: test.id,
        title: test.title,
        description: [test.description, test.subject].filter((value): value is string => Boolean(value)).join(' · '),
        kind: 'test',
        href: `/tests/${test.id}`,
        exam: test.exam,
        classes: (test.classes || []).map(String),
        updatedAt: test.scheduledAt || '',
        badge: test.isLive ? 'Live now' : test.active ? undefined : 'Inactive',
      });
    }
    for (const announcement of (bootstrap?.announcements || []) as AnnouncementRecord[]) {
      if (announcement.active === false) continue;
      const body = announcement.message || announcement.body || '';
      items.push({
        id: announcement.id,
        title: announcement.title || 'Announcement',
        description: body,
        kind: 'announcement',
        href: '/notifications',
        exam: 'Both',
        classes: [],
        updatedAt: announcement.created_at || '',
      });
    }
    return items;
  }, [bootstrap, tests]);

  const filtered = useMemo(() => {
    const q = committed.trim().toLowerCase();
    const tokens = q ? q.split(/\s+/).filter(Boolean) : [];
    let list = results.filter((item) => (kind === 'all' ? true : item.kind === kind));
    if (tokens.length) {
      list = list.filter((item) => {
        const haystack = `${item.title} ${item.description} ${item.kind} ${item.exam} ${item.classes.join(' ')} ${item.badge || ''}`.toLowerCase();
        return tokens.every((token) => haystack.includes(token));
      });
    }
    if (sort === 'newest') {
      list = [...list].sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
    } else if (sort === 'az') {
      list = [...list].sort((a, b) => a.title.localeCompare(b.title));
    }
    return list;
  }, [results, committed, kind, sort]);

  const kindCounts = useMemo(() => {
    const counts: Partial<Record<ResultKind, number>> = {};
    results.forEach((item) => {
      counts[item.kind] = (counts[item.kind] || 0) + 1;
    });
    return counts;
  }, [results]);

  const submit = useCallback(
    (event?: React.FormEvent) => {
      event?.preventDefault();
      setCommitted(query);
      const next = query.trim();
      router.replace(next ? `/search?q=${encodeURIComponent(next)}` : '/search');
    },
    [query, router]
  );

  const suggestions = screen.suggestions;
  const sections = visibleSectionIds('search', screen);
  const resultLimit = screen.itemLimit > 0 ? screen.itemLimit : filtered.length;

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <ScreenPageHeader
        showHeader={screen.showHeader}
        eyebrow={screen.eyebrow}
        title={screen.pageTitle}
        description={screen.pageSubtitle}
        meta={profile ? <span className="ec-chip">Filtered for {profile.exam} · Class {profile.class_level}</span> : null}
      />

      <ScreenAnnouncementBanner announcement={screen.announcement} />

      <form onSubmit={submit} className="flex flex-col gap-2 sm:flex-row" role="search">
        <label className="relative flex-1">
          <span className="sr-only">Search</span>
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400">⌕</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={screen.searchPlaceholder}
            className="ec-field pl-8"
            autoFocus
          />
        </label>
        <button type="submit" className="ec-btn px-4 py-2.5 text-sm font-bold bg-[var(--ec-brand)] text-[var(--ec-on-brand)]">
          {screen.searchCtaLabel}
        </button>
      </form>

      {!committed.trim() && sections.includes('suggestions') && screen.showSuggestions && suggestions.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-semibold text-ink-500">{screen.suggestionsTitle}:</span>
          {suggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => {
                setQuery(suggestion);
                setCommitted(suggestion);
                router.replace(`/search?q=${encodeURIComponent(suggestion)}`);
              }}
              className="rounded-full border border-ink-200 bg-white px-3 py-1 text-[11px] font-semibold text-ink-600 hover:border-brand-300 hover:text-brand-700"
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}

      {sections.includes('kind_filters') && screen.showKindFilters && (
      <div className="flex flex-wrap items-center gap-2">
        {(['all', 'lecture', 'test', 'batch', 'series', 'event', 'announcement'] as const).map((option) => {
          const count = option === 'all' ? results.length : kindCounts[option] || 0;
          return (
            <button
              key={option}
              type="button"
              onClick={() => setKind(option)}
              className={`rounded-full px-3 py-1.5 text-[11px] font-bold border ${
                kind === option ? 'bg-ink-900 text-white border-ink-900' : 'bg-white border-ink-200 text-ink-600'
              }`}
            >
              {option === 'all' ? 'All' : KIND_LABEL[option]} ({count})
            </button>
          );
        })}
        <label className="ml-auto flex items-center gap-1.5 text-[11px] font-semibold text-ink-500">
          Sort
          <select value={sort} onChange={(event) => setSort(event.target.value as typeof sort)} className="ec-field !w-auto !py-1.5 text-[11px]">
            <option value="relevance">Relevance</option>
            <option value="newest">Newest</option>
            <option value="az">A–Z</option>
          </select>
        </label>
      </div>
      )}

      <p className="text-[11px] text-ink-500">
        {committed.trim()
          ? `${filtered.length} result${filtered.length === 1 ? '' : 's'} for “${committed.trim()}”`
          : `${filtered.length} items available`}
        {testsLoading ? ' · loading tests…' : ''}
      </p>

      {sections.includes('results') ? (filtered.length === 0 ? (
        <ScreenEmpty
          icon={<span aria-hidden>🔍</span>}
          title={screen.noResultsTitle}
          body={screen.noResultsBody}
          action={
            <>
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  setCommitted('');
                  setKind('all');
                  router.replace('/search');
                }}
                className="ec-btn border border-ink-200 px-3 py-1.5 text-xs font-bold"
              >
                Clear search
              </button>
              <Link href="/lectures" className="ec-btn bg-[var(--ec-brand)] px-3 py-1.5 text-xs font-bold text-[var(--ec-on-brand)]">
                Browse lectures
              </Link>
            </>
          }
        />
      ) : (
        <ul className="space-y-2">
          {filtered.slice(0, resultLimit).map((item) => (
            <li key={`${item.kind}-${item.id}`}>
              <Link href={item.href} className="ec-card flex items-start gap-3 p-3.5 hover:-translate-y-0.5 transition">
                <span className="shrink-0 rounded-lg bg-brand-50 text-brand-700 text-[10px] font-bold px-2 py-1">
                  {KIND_LABEL[item.kind]}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold truncate">{item.title}</span>
                  {item.description && <span className="block text-[11px] text-ink-500 line-clamp-2 mt-0.5">{item.description}</span>}
                  <span className="flex flex-wrap gap-1 mt-1.5">
                    <span className="rounded-full bg-ink-100 px-2 py-0.5 text-[10px] font-semibold">{item.exam}</span>
                    {item.classes.length > 0 && (
                      <span className="rounded-full bg-ink-100 px-2 py-0.5 text-[10px] font-semibold">Class {item.classes.join('/')}</span>
                    )}
                    {item.badge && <span className="rounded-full bg-emerald-50 text-emerald-700 px-2 py-0.5 text-[10px] font-semibold">{item.badge}</span>}
                  </span>
                </span>
                <span className="shrink-0 text-ink-300">›</span>
              </Link>
            </li>
          ))}
        </ul>
      )) : null}

      {filtered.length > resultLimit && (
        <p className="text-center text-[11px] text-ink-400">
          Showing the first {resultLimit} of {filtered.length} matches. Refine your search to narrow it down.
        </p>
      )}

      {sections.includes('info') && screen.infoNote ? (
        <p className="rounded-[var(--ec-radius)] border border-ink-100 bg-[var(--ec-surface)] p-3 text-[11px] leading-relaxed text-ink-500">
          {screen.infoNote}
        </p>
      ) : null}

      <ScreenHelpNote help={screen.help} />
    </div>
  );
}

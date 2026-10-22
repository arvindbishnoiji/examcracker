'use client';

import { useCallback, useEffect, useMemo, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { RefreshCw, Trophy } from 'lucide-react';
import { getStudentTests, getTestLeaderboard } from '@/lib/api';
import { Badge, Skeleton } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useSiteConfig } from '@/context/SiteConfigContext';
import type { LeaderboardEntry, TestCardItem } from '@/types';
import { formatISTDateTime } from '@/lib/date';
import { formatClassLevel } from '@/lib/validation';
import { visibleSectionIds } from '@/lib/screen-config';
import {
  ScreenAnnouncementBanner,
  ScreenEmpty,
  ScreenHelpNote,
  ScreenPageHeader,
  ScreenSection,
  screenGridClass,
} from '@/components/student/ScreenScaffold';

function initials(name: string): string {
  return (
    name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('') || 'S'
  );
}

function LeaderboardContent() {
  const searchParams = useSearchParams();
  const initialTestId = searchParams?.get('testId') || '';
  const { config } = useSiteConfig();
  const screen = config.leaderboard;
  const [tests, setTests] = useState<TestCardItem[]>([]);
  const [selected, setSelected] = useState(initialTestId);
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadTests = useCallback(async () => {
    try {
      const items = await getStudentTests();
      setTests(items);
      setSelected((current) => current || items[0]?.id || '');
    } catch {
      // The empty state below explains that no tests are available.
    }
  }, []);

  useEffect(() => {
    void loadTests();
  }, [loadTests]);

  const loadLeaderboard = useCallback(async () => {
    if (!selected) {
      setEntries([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await getTestLeaderboard(selected);
      setEntries(res.items || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load this leaderboard.');
    } finally {
      setLoading(false);
    }
  }, [selected]);

  useEffect(() => {
    void loadLeaderboard();
  }, [loadLeaderboard]);

  const selectedTest = useMemo(() => tests.find((test) => test.id === selected), [tests, selected]);
  const limited = screen.itemLimit > 0 ? entries.slice(0, screen.itemLimit) : entries;
  const sections = visibleSectionIds('leaderboard', screen);

  function renderSection(id: string) {
    if (id === 'selector') {
      if (!screen.showTestSelector) return null;
      return (
        <div key={id} className="ec-card flex flex-wrap items-end gap-3 p-4">
          <label className="min-w-[240px] flex-1">
            <span className="text-xs font-semibold text-ink-700">{screen.selectorLabel}</span>
            <select
              value={selected}
              onChange={(event) => setSelected(event.target.value)}
              className="ec-field mt-1"
            >
              <option value="">— {screen.noTestTitle} —</option>
              {tests.map((test) => (
                <option key={test.id} value={test.id}>
                  {test.title} • {test.totalQuestions} Qs • {test.durationMinutes} min
                </option>
              ))}
            </select>
          </label>
          <Button size="sm" variant="outline" onClick={() => void loadLeaderboard()}>
            <RefreshCw size={14} className="mr-1.5" /> {screen.refreshLabel}
          </Button>
          <Link href="/tests" className="ec-btn border border-ink-200 px-3.5 py-2 text-xs font-semibold">
            {screen.browseCtaLabel}
          </Link>
        </div>
      );
    }
    if (id === 'ranking') {
      if (!selected) {
        return <ScreenEmpty key={id} icon={<Trophy size={18} />} title={screen.noTestTitle} body={screen.noTestBody} />;
      }
      if (loading) {
        return (
          <div key={id} className={screenGridClass('list')}>
            {[1, 2, 3, 4, 5].map((index) => (
              <Skeleton key={index} className="h-16 w-full" />
            ))}
          </div>
        );
      }
      if (error) {
        return (
          <div key={id} className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
            <Button size="sm" variant="outline" className="ml-2" onClick={() => void loadLeaderboard()}>
              Try again
            </Button>
          </div>
        );
      }
      if (!limited.length) {
        return (
          <ScreenEmpty
            key={id}
            icon={<Trophy size={18} />}
            title={screen.noAttemptsTitle}
            body={screen.noAttemptsBody}
            action={
              selectedTest ? (
                <Link
                  href={`/tests/${selectedTest.id}`}
                  className="ec-btn bg-brand-600 px-4 py-2 text-sm font-semibold text-white"
                >
                  {config.tests.attemptCtaLabel}
                </Link>
              ) : undefined
            }
          />
        );
      }
      return (
        <div key={id} className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-ink-500">
            <span>{screen.rankLabel}</span>
            {selectedTest ? <span className="truncate">{selectedTest.title}</span> : null}
          </div>
          {limited.map((entry) => (
            <div key={`${entry.firebaseUid}-${entry.submittedAt}`} className="ec-card flex items-center gap-3 p-3.5">
              <div
                className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-bold ${
                  entry.rank === 1
                    ? 'bg-amber-100 text-amber-800'
                    : entry.rank === 2
                      ? 'bg-ink-100 text-ink-700'
                      : entry.rank === 3
                        ? 'bg-orange-100 text-orange-800'
                        : 'bg-ink-50 text-ink-600'
                }`}
              >
                #{entry.rank}
              </div>
              {screen.showAvatars ? (
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-100 text-[11px] font-bold text-brand-700" aria-hidden>
                  {initials(entry.name || 'Student')}
                </span>
              ) : null}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <p className="truncate text-sm font-semibold text-ink-900">{entry.name || 'Student'}</p>
                  {entry.classLevel ? (
                    <Badge variant="default">{formatClassLevel(entry.classLevel)}</Badge>
                  ) : null}
                </div>
                {screen.showSubmittedTime ? (
                  <p className="text-[10.5px] text-ink-500">{formatISTDateTime(entry.submittedAt)}</p>
                ) : null}
              </div>
              <div className="shrink-0 text-right">
                <p className="text-sm font-bold text-ink-900">
                  {entry.score}/{entry.maxScore}
                </p>
                <p className="text-[10.5px] text-ink-500">
                  {entry.maxScore ? Math.round((entry.score / entry.maxScore) * 100) : 0}%
                </p>
              </div>
              {entry.rank <= 3 ? (
                <Badge variant={entry.rank === 1 ? 'warning' : entry.rank === 2 ? 'default' : 'info'}>
                  {entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : '🥉'}
                </Badge>
              ) : null}
            </div>
          ))}
        </div>
      );
    }
    if (id === 'info') {
      if (!screen.infoTitle && !screen.infoBody) return null;
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
    <div className="mx-auto max-w-4xl space-y-4">
      <ScreenPageHeader
        showHeader={screen.showHeader}
        eyebrow={screen.eyebrow}
        title={screen.pageTitle}
        description={screen.pageSubtitle}
      />
      <ScreenAnnouncementBanner announcement={screen.announcement} />
      {sections.map((id) => renderSection(id))}
      <ScreenHelpNote help={screen.help} />
    </div>
  );
}

export default function LeaderboardPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-4xl p-6 text-sm text-ink-500">Loading leaderboard…</div>}>
      <LeaderboardContent />
    </Suspense>
  );
}

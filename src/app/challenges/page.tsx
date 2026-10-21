'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useSiteConfig } from '@/context/SiteConfigContext';
import { useToast } from '@/hooks/useToast';
import { deleteStudentLibraryItem, getStudentLibrary, saveStudentLibraryItem } from '@/lib/api';
import { formatISTDateTime } from '@/lib/date';
import { matchesStudentExamAndClass } from '@/lib/validation';
import type { LibraryItem, StudyChallenge } from '@/types';
import { visibleSectionIds } from '@/lib/screen-config';
import {
  ScreenAnnouncementBanner,
  ScreenEmpty,
  ScreenHelpNote,
  ScreenPageHeader,
  ScreenSection,
} from '@/components/student/ScreenScaffold';

interface StoredProgress {
  checked: string[];
  joinedAt: string;
}

function progressOf(item: LibraryItem | undefined): StoredProgress {
  const payload = (item?.payload || {}) as Record<string, unknown>;
  return {
    checked: Array.isArray(payload.checked) ? payload.checked.filter((value): value is string => typeof value === 'string') : [],
    joinedAt: typeof payload.joinedAt === 'string' ? payload.joinedAt : '',
  };
}

function challengeState(challenge: StudyChallenge): 'upcoming' | 'active' | 'ended' {
  const now = Date.now();
  const start = challenge.startAt ? Date.parse(challenge.startAt) : null;
  const end = challenge.endAt ? Date.parse(challenge.endAt) : null;
  if (start && !Number.isNaN(start) && start > now) return 'upcoming';
  if (end && !Number.isNaN(end) && end <= now) return 'ended';
  return 'active';
}

export default function ChallengesPage() {
  const { profile, initializing, user } = useAuth();
  const { config } = useSiteConfig();
  const screen = config.challengesScreen;
  const router = useRouter();
  const { push } = useToast();
  const [library, setLibrary] = useState<LibraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setLibrary(await getStudentLibrary());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load your saved challenges.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!initializing && !user) {
      router.replace('/login');
      return;
    }
    if (user) void load();
  }, [initializing, user, router, load]);

  const challenges = useMemo(() => {
    if (!profile) return [];
    return config.challenges.items
      .filter((challenge) => challenge.active)
      .filter((challenge) =>
        matchesStudentExamAndClass(
          {
            exam: challenge.audience === 'all' ? 'Both' : challenge.audience.split('-')[0],
            classes: challenge.audience.includes('-') ? [challenge.audience.split('-')[1]] : null,
          },
          profile.exam,
          profile.class_level
        )
      )
      .sort((a, b) => {
        const order = { upcoming: 0, active: 1, ended: 2 } as const;
        return order[challengeState(a)] - order[challengeState(b)];
      });
  }, [config.challenges.items, profile]);

  const savedByChallenge = useMemo(() => {
    const map = new Map<string, LibraryItem>();
    library.filter((item) => item.item_type === 'challenge').forEach((item) => map.set(item.item_id, item));
    return map;
  }, [library]);

  async function join(challenge: StudyChallenge) {
    setBusyId(challenge.id);
    try {
      const saved = await saveStudentLibraryItem({
        itemType: 'challenge',
        itemId: challenge.id,
        payload: { checked: [], joinedAt: new Date().toISOString() },
      });
      setLibrary((current) => [saved, ...current.filter((item) => !(item.item_type === 'challenge' && item.item_id === challenge.id))]);
      push('Challenge joined', 'success');
    } catch (err) {
      push(err instanceof Error ? err.message : 'Could not join challenge', 'error');
    } finally {
      setBusyId(null);
    }
  }

  async function leave(challenge: StudyChallenge) {
    setBusyId(challenge.id);
    try {
      await deleteStudentLibraryItem('challenge', challenge.id);
      setLibrary((current) => current.filter((item) => !(item.item_type === 'challenge' && item.item_id === challenge.id)));
      push('Left challenge', 'success');
    } catch (err) {
      push(err instanceof Error ? err.message : 'Could not leave challenge', 'error');
    } finally {
      setBusyId(null);
    }
  }

  async function toggleItem(challenge: StudyChallenge, checklistId: string) {
    const saved = savedByChallenge.get(challenge.id);
    const progress = progressOf(saved);
    const checked = progress.checked.includes(checklistId)
      ? progress.checked.filter((value) => value !== checklistId)
      : [...progress.checked, checklistId];
    setBusyId(challenge.id);
    try {
      const item = await saveStudentLibraryItem({
        itemType: 'challenge',
        itemId: challenge.id,
        payload: { checked, joinedAt: progress.joinedAt || new Date().toISOString() },
      });
      setLibrary((current) => [item, ...current.filter((entry) => !(entry.item_type === 'challenge' && entry.item_id === challenge.id))]);
    } catch (err) {
      push(err instanceof Error ? err.message : 'Could not update checklist', 'error');
    } finally {
      setBusyId(null);
    }
  }

  if (initializing || loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-3">
        <div className="ec-skeleton h-10 w-64" />
        <div className="ec-skeleton h-40" />
        <div className="ec-skeleton h-40" />
      </div>
    );
  }

  const sections = visibleSectionIds('challengesScreen', screen);

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <ScreenPageHeader
        showHeader={screen.showHeader}
        eyebrow={screen.eyebrow}
        title={screen.pageTitle}
        description={screen.pageSubtitle}
        actions={
          <Link href="/home" className="ec-btn border border-ink-200 px-3.5 py-2 text-xs font-bold">
            ← Dashboard
          </Link>
        }
      />

      <ScreenAnnouncementBanner announcement={screen.announcement} />

      {error && (
        <div className="rounded-[var(--ec-radius)] border border-red-200 bg-red-50 p-3 text-xs text-red-800">
          {error}{' '}
          <button type="button" onClick={() => void load()} className="font-bold underline">
            Retry
          </button>
        </div>
      )}

      {!sections.includes('list') ? null : challenges.length === 0 ? (
        <ScreenEmpty icon={<span aria-hidden>🔥</span>} title={screen.emptyTitle} body={screen.emptyBody} />
      ) : (
        <div className="space-y-3">
          {challenges.map((challenge) => {
            const saved = savedByChallenge.get(challenge.id);
            const progress = progressOf(saved);
            const state = challengeState(challenge);
            const total = challenge.checklist.length;
            const done = progress.checked.length;
            const percent = total ? Math.round((done / total) * 100) : 0;
            return (
              <article key={challenge.id} className="ec-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-sm font-bold">{challenge.title}</h2>
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold capitalize ${
                        state === 'active'
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                          : state === 'upcoming'
                            ? 'border-sky-200 bg-sky-50 text-sky-700'
                            : 'border-ink-200 bg-ink-100 text-ink-500'
                      }`}>
                        {state}
                      </span>
                      {saved && <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-bold text-brand-700">{screen.joinedLabel}</span>}
                    </div>
                    <p className="text-xs text-ink-500 mt-1">{challenge.description}</p>
                    {screen.showSchedule || (screen.showReward && challenge.reward) ? (
                      <p className="text-[10px] text-ink-400 mt-1">
                        {screen.showSchedule ? (
                          <>
                            {challenge.startAt ? formatISTDateTime(challenge.startAt) : 'Open'} →{' '}
                            {challenge.endAt ? formatISTDateTime(challenge.endAt) : 'no end date'} · Target {challenge.targetCount}{' '}
                            {challenge.targetType}
                          </>
                        ) : null}
                        {screen.showReward && challenge.reward ? ` · Reward: ${challenge.reward}` : ''}
                      </p>
                    ) : null}
                  </div>
                  {saved ? (
                    <button
                      type="button"
                      disabled={busyId === challenge.id}
                      onClick={() => void leave(challenge)}
                      className="px-3 py-1.5 text-[11px] font-bold border border-ink-200 rounded-full disabled:opacity-60"
                    >
                      {screen.leaveLabel}
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={busyId === challenge.id || state === 'ended'}
                      onClick={() => void join(challenge)}
                      className="px-3 py-1.5 text-[11px] font-bold bg-[var(--ec-brand)] text-[var(--ec-on-brand)] rounded-full disabled:opacity-50"
                    >
                      {state === 'ended' ? screen.endedLabel : screen.joinLabel}
                    </button>
                  )}
                </div>

                {screen.showChecklist && total > 0 && (
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-[10px] font-semibold text-ink-500">
                      <span>{screen.checklistTitle}</span>
                      <span>{done}/{total} · {percent}%</span>
                    </div>
                    <div className="ec-progress mt-1">
                      <span style={{ width: `${percent}%` }} />
                    </div>
                    <ul className="mt-2 space-y-1">
                      {challenge.checklist.map((item) => {
                        const checked = progress.checked.includes(item.id);
                        return (
                          <li key={item.id}>
                            <label className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-[11px] ${
                              checked ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-ink-200 bg-white'
                            } ${saved ? 'cursor-pointer' : 'opacity-70 cursor-not-allowed'}`}>
                              <input
                                type="checkbox"
                                checked={checked}
                                disabled={!saved || busyId === challenge.id}
                                onChange={() => void toggleItem(challenge, item.id)}
                                className="accent-[var(--ec-brand)]"
                              />
                              <span className={checked ? 'line-through' : ''}>{item.label}</span>
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                    {!saved && screen.joinHint ? <p className="text-[10px] text-ink-400 mt-1">{screen.joinHint}</p> : null}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {sections.includes('info') ? (
        <ScreenSection>
          <ScreenHelpNote help={screen.help} />
        </ScreenSection>
      ) : null}
    </div>
  );
}

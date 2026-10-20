'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  BookOpen,
  CheckCircle2,
  FileText,
  GraduationCap,
  Layers,
  ListVideo,
  Lock,
  PlayCircle,
  RefreshCw,
  Search,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { getCatalogContent, enrollInBatchOrSeries, ApiError } from '@/lib/api';
import { Badge, EmptyState, Skeleton } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/hooks/useToast';
import type { CourseCatalogItem } from '@/types';
import { isSafeHttpUrl } from '@/lib/validation';
import { activeEnrollmentKeys, coursePriceLabel, isPaidCourse } from '@/lib/enrollment';

type Tab = 'batches' | 'series' | 'lectures' | 'resources';

const TAB_META: Record<Tab, { label: string; icon: React.ReactNode; empty: string }> = {
  batches: {
    label: 'Batches',
    icon: <Layers size={14} />,
    empty: 'No batches match your exam and class yet. New programmes appear here when published.',
  },
  series: {
    label: 'Series',
    icon: <ListVideo size={14} />,
    empty: 'No series match your exam and class yet. Check back after your mentor publishes one.',
  },
  lectures: {
    label: 'Lectures',
    icon: <PlayCircle size={14} />,
    empty: 'No lectures available for your selection yet.',
  },
  resources: {
    label: 'Resources',
    icon: <FileText size={14} />,
    empty: 'No notes or PDFs available for your selection yet.',
  },
};

function thumbOf(item: CourseCatalogItem, tab: Tab): string {
  const meta = (item.metadata || {}) as Record<string, unknown>;
  const raw = String(meta.thumbnailUrl || meta.thumbnail_url || '');
  if (isSafeHttpUrl(raw)) return raw;
  if (tab === 'lectures' && meta.videoId) return `https://img.youtube.com/vi/${String(meta.videoId)}/hqdefault.jpg`;
  return '';
}

function LecturesHubPageInner() {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get('q') || '';
  const { profile, bootstrap, isAdmin } = useAuth();
  const { push } = useToast();
  const [tab, setTab] = useState<Tab>('batches');
  const [items, setItems] = useState<CourseCatalogItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState(initialQuery);
  const [sort, setSort] = useState<'newest' | 'title'>('newest');
  const [enrollCodes, setEnrollCodes] = useState<Record<string, string>>({});
  const [enrolling, setEnrolling] = useState<string | null>(null);
  const [justEnrolled, setJustEnrolled] = useState<Set<string>>(new Set());
  const [onlyMine, setOnlyMine] = useState(false);

  const load = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    setError(null);
    try {
      const kind = tab === 'batches' ? 'batch' : tab === 'series' ? 'series' : tab;
      const data = await getCatalogContent({ kind: kind as 'batch' | 'series' | 'lecture' | 'resource' });
      setItems(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load this section.');
    } finally {
      setLoading(false);
    }
  }, [profile, tab]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setFilter(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    const kindParam = searchParams.get('kind');
    if (kindParam === 'batch') setTab('batches');
    else if (kindParam === 'series') setTab('series');
    else if (kindParam === 'resources') setTab('resources');
    else if (kindParam === 'lectures') setTab('lectures');
  }, [searchParams]);

  const activeKeys = useMemo(
    () => activeEnrollmentKeys(bootstrap?.enrollments),
    [bootstrap?.enrollments]
  );

  function isEnrolled(item: CourseCatalogItem): boolean {
    return (justEnrolled.has(item.id) || activeKeys.has(`${item.kind}:${item.id}`)) && ['batch', 'series'].includes(item.kind);
  }

  async function handleEnroll(item: CourseCatalogItem) {
    const code = enrollCodes[item.id] || '';
    setEnrolling(item.id);
    try {
      await enrollInBatchOrSeries({ itemType: item.kind as 'batch' | 'series', itemId: item.id, accessCode: code || undefined });
      setJustEnrolled((previous) => new Set([...Array.from(previous), item.id]));
      push(`You now have access to ${item.title}.`, 'success');
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : e instanceof Error ? e.message : 'Enrollment failed.';
      push(msg, 'error');
    } finally {
      setEnrolling(null);
    }
  }

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const list = items.filter((item) => {
      if (onlyMine && !isEnrolled(item)) return false;
      if (!q) return true;
      const meta = (item.metadata || {}) as Record<string, unknown>;
      return `${item.title} ${item.description} ${meta.subject || ''} ${meta.topic || ''}`.toLowerCase().includes(q);
    });
    return sort === 'title'
      ? [...list].sort((a, b) => a.title.localeCompare(b.title))
      : [...list].sort((a, b) => b.updated_at.localeCompare(a.updated_at));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, filter, sort, onlyMine, activeKeys, justEnrolled]);

  const canFilterMine = tab === 'batches' || tab === 'series';

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="ec-eyebrow flex items-center gap-1.5">
            <BookOpen size={12} /> Learning library
          </p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl">Lectures &amp; batches</h1>
          <p className="mt-1 text-sm text-ink-500">
            Curated for {profile?.exam || 'your exam'} · Class {profile?.class_level || '—'}. Access is verified on every
            lesson.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="ec-chip"><GraduationCap size={12} /> {activeKeys.size} unlocked</span>
          <Button size="sm" variant="outline" onClick={() => void load()} aria-label="Refresh content">
            <RefreshCw size={14} className="mr-1.5" /> Refresh
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Learning content types">
          {(Object.keys(TAB_META) as Tab[]).map((key) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              onClick={() => {
                setTab(key);
                setOnlyMine(false);
              }}
              className={`ec-btn inline-flex items-center gap-1.5 border px-3.5 py-2 text-xs font-bold transition ${
                tab === key
                  ? 'border-ink-900 bg-ink-900 text-white'
                  : 'border-[rgb(var(--ec-ink-200))] bg-[var(--ec-surface)] text-ink-700 hover:bg-ink-50'
              }`}
            >
              {TAB_META[key].icon} {TAB_META[key].label}
            </button>
          ))}
        </div>
        {canFilterMine && (
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-[rgb(var(--ec-ink-200))] bg-[var(--ec-surface)] px-3 py-1.5 text-[11px] font-semibold text-ink-700">
            <input type="checkbox" checked={onlyMine} onChange={(event) => setOnlyMine(event.target.checked)} />
            My courses only
          </label>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-[220px] flex-1">
          <div className="relative">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
            <Input
              aria-label={`Search ${tab}`}
              placeholder={`Search ${TAB_META[tab].label.toLowerCase()}…`}
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              className="!pl-9"
            />
          </div>
        </div>
        <select
          className="ec-field !w-auto !py-2 !text-xs"
          value={sort}
          onChange={(event) => setSort(event.target.value as 'newest' | 'title')}
          aria-label="Sort content"
        >
          <option value="newest">Newest first</option>
          <option value="title">A–Z</option>
        </select>
        <span className="text-[11px] text-ink-500">
          {filtered.length} result{filtered.length === 1 ? '' : 's'}
        </span>
      </div>

      {loading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((index) => (
            <Skeleton key={index} className="h-56" />
          ))}
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
          <Button size="sm" variant="outline" className="ml-2" onClick={() => void load()}>
            Retry
          </Button>
        </div>
      )}
      {!loading && !error && filtered.length === 0 && (
        <EmptyState
          icon={onlyMine ? <Lock size={18} /> : <Sparkles size={18} />}
          title={onlyMine ? 'No unlocked courses here yet' : `${TAB_META[tab].label} coming soon`}
          description={onlyMine ? 'Enroll in a batch or enter an access code from your mentor to unlock it.' : TAB_META[tab].empty}
          action={
            isAdmin ? (
              <Link href="/admin/batches" className="ec-btn inline-flex bg-ink-900 px-4 py-2 text-sm font-semibold text-white">
                Manage content
              </Link>
            ) : undefined
          }
        />
      )}

      {!loading && !error && filtered.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((item) => {
            const meta = item.metadata as Record<string, unknown>;
            const thumb = thumbOf(item, tab);
            const needsCode = Boolean(item.hasAccessCode);
            const enrolled = isEnrolled(item);
            const paid = isPaidCourse(item);
            const codeValue = enrollCodes[item.id] || '';
            const lessonParent = String(meta.parentId || meta.parent_id || meta.batchId || '');
            const preview = meta.isPreview === true;
            return (
              <article
                key={item.id}
                className="ec-card ec-card-interactive flex flex-col overflow-hidden"
              >
                <div className="relative">
                  {thumb && isSafeHttpUrl(thumb) ? (
                    <img
                      src={thumb}
                      alt=""
                      className="h-40 w-full bg-ink-100 object-cover"
                      loading="lazy"
                      decoding="async"
                    />
                  ) : (
                    <div className="grid h-40 w-full place-items-center bg-gradient-to-br from-brand-50 via-[var(--ec-surface-2)] to-ink-100 text-brand-700">
                      {tab === 'batches' ? <Layers size={30} /> : tab === 'series' ? <ListVideo size={30} /> : tab === 'resources' ? <FileText size={30} /> : <PlayCircle size={30} />}
                    </div>
                  )}
                  <div className="absolute left-2.5 top-2.5 flex flex-wrap gap-1.5">
                    <span className="rounded-full bg-black/60 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white backdrop-blur">
                      {item.kind}
                    </span>
                    {enrolled && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2 py-0.5 text-[9px] font-bold text-white">
                        <CheckCircle2 size={10} /> Enrolled
                      </span>
                    )}
                    {preview && (
                      <span className="rounded-full bg-white/90 px-2 py-0.5 text-[9px] font-bold text-brand-700">Preview</span>
                    )}
                  </div>
                </div>
                <div className="flex flex-1 flex-col gap-2 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="text-sm font-bold leading-snug line-clamp-2">{item.title}</h2>
                    <Badge variant={paid ? 'warning' : 'success'}>{coursePriceLabel(item)}</Badge>
                  </div>
                  <p className="text-xs text-ink-500 line-clamp-2">{item.description || 'No description added yet.'}</p>
                  <div className="flex flex-wrap gap-1">
                    <Badge>{item.exam}</Badge>
                    <Badge>Class {item.classes.join('/')}</Badge>
                    {needsCode && <Badge variant="info"><Lock size={9} className="mr-0.5" /> Access code</Badge>}
                    {Boolean(meta.subject) && <Badge variant="default">{String(meta.subject)}</Badge>}
                  </div>

                  {(tab === 'batches' || tab === 'series') && (
                    <div className="mt-auto space-y-2 pt-2">
                      {needsCode && !enrolled && (
                        <Input
                          aria-label={`Access code for ${item.title}`}
                          placeholder="Enter access code"
                          value={codeValue}
                          onChange={(event) => setEnrollCodes((previous) => ({ ...previous, [item.id]: event.target.value }))}
                        />
                      )}
                      {enrolled ? (
                        <Link
                          href={`/lectures/${item.id}`}
                          className="ec-btn flex w-full items-center justify-center gap-1.5 bg-emerald-600 px-3 py-2 text-xs font-bold text-white"
                        >
                          <PlayCircle size={14} /> Open course
                        </Link>
                      ) : paid && !needsCode ? (
                        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-medium text-amber-900">
                          Paid course — ask your mentor to enroll you. You cannot self-grant paid access.
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          loading={enrolling === item.id}
                          onClick={() => void handleEnroll(item)}
                          className="w-full"
                        >
                          {needsCode ? 'Unlock with code' : 'Enroll free'}
                        </Button>
                      )}
                      <Link
                        href={`/lectures/${item.id}`}
                        className="block text-center text-[11px] font-semibold text-ink-500 hover:text-brand-700"
                      >
                        View course details
                      </Link>
                    </div>
                  )}

                  {tab === 'lectures' && (
                    <div className="mt-auto flex gap-2 pt-2">
                      <Link
                        href={`/lectures/${item.id}`}
                        className="ec-btn flex flex-1 items-center justify-center gap-1.5 bg-brand-600 px-3 py-2 text-xs font-bold text-white"
                      >
                        <PlayCircle size={14} /> Watch
                      </Link>
                      {Boolean(meta.notesPdfUrl) && isSafeHttpUrl(String(meta.notesPdfUrl)) && (
                        <a
                          href={String(meta.notesPdfUrl)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ec-btn inline-flex items-center gap-1 border border-ink-200 px-3 py-2 text-xs font-semibold"
                        >
                          <FileText size={13} /> Notes
                        </a>
                      )}
                    </div>
                  )}

                  {tab === 'resources' && (
                    <div className="mt-auto pt-2">
                      {Boolean(meta.pdfUrl) && isSafeHttpUrl(String(meta.pdfUrl)) ? (
                        <a
                          href={String(meta.pdfUrl)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ec-btn flex w-full items-center justify-center gap-1.5 bg-ink-900 px-3 py-2 text-xs font-bold text-white"
                        >
                          <FileText size={14} /> Open resource
                        </a>
                      ) : (
                        <span className="text-xs text-ink-400">No file linked yet.</span>
                      )}
                    </div>
                  )}

                  {lessonParent && tab === 'lectures' && !preview && (
                    <p className="text-[10px] text-ink-400">Parent course access is checked server-side.</p>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      <div className="rounded-[var(--ec-radius)] border border-ink-100 bg-[var(--ec-surface)] p-4">
        <p className="flex items-center gap-1.5 text-sm font-bold">
          <Lock size={14} className="text-brand-600" /> How access works
        </p>
        <p className="mt-1 text-xs leading-relaxed text-ink-500">
          Free courses can be joined directly. Paid courses and restricted batches need a mentor grant or a valid access
          code. Lessons belonging to a batch or series stay locked until the server confirms an active enrollment, even
          if you open a direct URL.
        </p>
      </div>
    </div>
  );
}

export default function LecturesHubPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-6xl space-y-4">
          <div className="ec-skeleton h-10 w-64" />
          <div className="ec-skeleton h-48 w-full" />
        </div>
      }
    >
      <LecturesHubPageInner />
    </Suspense>
  );
}

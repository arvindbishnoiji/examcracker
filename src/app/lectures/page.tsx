'use client';
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import YoutubeThumbnail from '@/components/YoutubeThumbnail';
import { StudyPromoBanner } from '@/components/student/StudyPromoBanner';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  CheckCircle2,
  FileText,
  Layers,
  ListVideo,
  Lock,
  PlayCircle,
  RefreshCw,
  Search,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { getCatalogContent, getStudentSubjects, enrollInBatchOrSeries, ApiError } from '@/lib/api';
import { Badge, Skeleton } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/hooks/useToast';
import { useSiteConfig } from '@/context/SiteConfigContext';
import type { CourseCatalogItem, Subject } from '@/types';
import { isSafeHttpUrl } from '@/lib/validation';
import { activeEnrollmentKeys, coursePriceLabel, isPaidCourse } from '@/lib/enrollment';
import { visibleSectionIds } from '@/lib/screen-config';
import {
  ScreenAnnouncementBanner,
  ScreenEmpty,
  ScreenHelpNote,
  ScreenPageHeader,
  ScreenSection,
  screenGridClass,
} from '@/components/student/ScreenScaffold';

type Tab = 'batches' | 'series' | 'lectures' | 'resources';

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
  const { config } = useSiteConfig();
  const { push } = useToast();
  const screen = config.lectures;
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
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [subjectFilter, setSubjectFilter] = useState('');

  const tabMeta: Record<Tab, { label: string; icon: React.ReactNode }> = {
    batches: { label: screen.tabLabels.batches, icon: <Layers size={14} /> },
    series: { label: screen.tabLabels.series, icon: <ListVideo size={14} /> },
    lectures: { label: screen.tabLabels.lectures, icon: <PlayCircle size={14} /> },
    resources: { label: screen.tabLabels.resources, icon: <FileText size={14} /> },
  };

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
    if (!profile) return;
    let cancelled = false;
    getStudentSubjects()
      .then((rows) => {
        if (!cancelled) setSubjects(rows);
      })
      .catch(() => {
        // A subject catalogue failure must not block the lecture list.
        if (!cancelled) setSubjects([]);
      });
    return () => {
      cancelled = true;
    };
  }, [profile]);

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
      if (subjectFilter && (tab === 'lectures' || tab === 'resources')) {
        const itemSubject = item.subjectId || String(((item.metadata || {}) as Record<string, unknown>).subjectId || '');
        if (itemSubject !== subjectFilter) return false;
      }
      if (!q) return true;
      const meta = (item.metadata || {}) as Record<string, unknown>;
      return `${item.title} ${item.description} ${item.subjectName || ''} ${meta.subject || ''} ${meta.topic || ''}`.toLowerCase().includes(q);
    });
    const sorted = sort === 'title'
      ? [...list].sort((a, b) => a.title.localeCompare(b.title))
      : [...list].sort((a, b) => b.updated_at.localeCompare(a.updated_at));
    return screen.itemLimit > 0 ? sorted.slice(0, screen.itemLimit) : sorted;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, filter, sort, tab, onlyMine, subjectFilter, activeKeys, justEnrolled, screen.itemLimit]);

  const canFilterMine = tab === 'batches' || tab === 'series';
  const sections = visibleSectionIds('lectures', screen);
  const gridClass = screenGridClass(screen.layout);

  function renderCatalogue() {
    if (loading) {
      return (
        <div className={gridClass}>
          {[1, 2, 3, 4, 5, 6].map((index) => (
            <Skeleton key={index} className="h-56" />
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
      const isSearch = Boolean(filter.trim());
      return (
        <ScreenEmpty
          icon={onlyMine ? <Lock size={18} /> : <Sparkles size={18} />}
          title={
            isSearch
              ? screen.noResultsTitle
              : onlyMine
                ? 'No unlocked courses here yet'
                : screen.emptyTitle
          }
          body={
            isSearch
              ? screen.noResultsBody
              : onlyMine
                ? 'Enroll in a batch or enter an access code from your mentor to unlock it.'
                : screen.emptyBody
          }
          action={
            isSearch ? (
              <Button size="sm" variant="outline" onClick={() => setFilter('')}>
                Clear search
              </Button>
            ) : isAdmin ? (
              <Link href="/admin/batches" className="ec-btn bg-ink-900 px-4 py-2 text-sm font-semibold text-white">
                Manage content
              </Link>
            ) : undefined
          }
        />
      );
    }
    return (
      <div className={gridClass}>
        {filtered.map((item) => {
          const meta = item.metadata as Record<string, unknown>;
          const thumb = thumbOf(item, tab);
          const needsCode = Boolean(item.hasAccessCode);
          const enrolled = isEnrolled(item);
          const paid = isPaidCourse(item);
          const codeValue = enrollCodes[item.id] || '';
          const lessonParent = String(item.parentId || meta.parentId || meta.parent_id || meta.batchId || '');
          const preview = meta.isPreview === true;
          return (
            <article key={item.id} className="ec-card ec-card-interactive flex flex-col overflow-hidden">
              <div className="relative">
                {thumb && isSafeHttpUrl(thumb) ? (
                  <YoutubeThumbnail
                    src={thumb}
                    videoId={String(meta.videoId || '')}
                    alt={item.title}
                    className="h-40 w-full bg-ink-100 object-cover"
                    loading="lazy"
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
                  {Boolean(item.subjectName || meta.subject) && (
                    <Badge variant="default">{String(item.subjectName || meta.subject)}</Badge>
                  )}
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
                        <PlayCircle size={14} /> {screen.enrolledCtaLabel}
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
                      <PlayCircle size={14} /> {screen.watchCtaLabel}
                    </Link>
                    {Boolean(item.metadata && (item.metadata as Record<string, unknown>).notesFileId) ? (
                      <Link
                        href={`/lectures/${item.id}`}
                        className="ec-btn inline-flex items-center gap-1 border border-ink-200 px-3 py-2 text-xs font-semibold"
                      >
                        <FileText size={13} /> Notes
                      </Link>
                    ) : Boolean(meta.notesPdfUrl) && isSafeHttpUrl(String(meta.notesPdfUrl)) ? (
                      <a
                        href={String(meta.notesPdfUrl)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ec-btn inline-flex items-center gap-1 border border-ink-200 px-3 py-2 text-xs font-semibold"
                      >
                        <FileText size={13} /> Notes
                      </a>
                    ) : null}
                  </div>
                )}

                {tab === 'resources' && (
                  <div className="mt-auto pt-2">
                    {Boolean(meta.notesFileId) ? (
                      <Link
                        href={`/lectures/${item.id}`}
                        className="ec-btn flex w-full items-center justify-center gap-1.5 bg-ink-900 px-3 py-2 text-xs font-bold text-white"
                      >
                        <FileText size={14} /> Open resource
                      </Link>
                    ) : Boolean(meta.pdfUrl) && isSafeHttpUrl(String(meta.pdfUrl)) ? (
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
    );
  }

  function renderSection(id: string) {
    if (id === 'tabs') {
      return (
        <div key={id} className="flex flex-wrap gap-1.5" role="group" aria-label="Learning content types">
          {(Object.keys(tabMeta) as Tab[]).map((key) => (
            <button
              key={key}
              type="button"
              aria-pressed={tab === key}
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
              {tabMeta[key].icon} {tabMeta[key].label}
            </button>
          ))}
        </div>
      );
    }
    if (id === 'filters') {
      if (!screen.showFilters && !screen.showSearch) return null;
      return (
        <div key={id} className="flex flex-wrap items-center gap-2">
          {screen.showSearch ? (
            <div className="min-w-[200px] flex-1">
              <div className="relative">
                <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
                <Input
                  aria-label={`Search ${tabMeta[tab].label}`}
                  placeholder={screen.searchPlaceholder || `Search ${tabMeta[tab].label.toLowerCase()}…`}
                  value={filter}
                  onChange={(event) => setFilter(event.target.value)}
                  className="!pl-9"
                />
              </div>
            </div>
          ) : null}
          {subjects.length > 0 && (tab === 'lectures' || tab === 'resources') ? (
            <select
              className="ec-field !w-auto !py-2 !text-xs"
              value={subjectFilter}
              onChange={(event) => setSubjectFilter(event.target.value)}
              aria-label="Filter by subject"
            >
              <option value="">All subjects</option>
              {subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.name}
                </option>
              ))}
            </select>
          ) : null}
          {screen.showSort ? (
            <select
              className="ec-field !w-auto !py-2 !text-xs"
              value={sort}
              onChange={(event) => setSort(event.target.value as 'newest' | 'title')}
              aria-label="Sort content"
            >
              <option value="newest">{screen.sortNewestLabel}</option>
              <option value="title">{screen.sortTitleLabel}</option>
            </select>
          ) : null}
          {canFilterMine ? (
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-[rgb(var(--ec-ink-200))] bg-[var(--ec-surface)] px-3 py-1.5 text-[11px] font-semibold text-ink-700">
              <input type="checkbox" checked={onlyMine} onChange={(event) => setOnlyMine(event.target.checked)} />
              {screen.mineFilterLabel}
            </label>
          ) : null}
          <span className="text-[11px] text-ink-500">
            {filtered.length} result{filtered.length === 1 ? '' : 's'}
          </span>
        </div>
      );
    }
    if (id === 'catalogue') return <div key={id}>{renderCatalogue()}</div>;
    if (id === 'access_note') {
      return (
        <ScreenSection key={id} title={screen.accessNoteTitle}>
          <p className="rounded-[var(--ec-radius)] border border-ink-100 bg-[var(--ec-surface)] p-4 text-[11.5px] leading-relaxed text-ink-500">
            {screen.accessNoteBody}
          </p>
        </ScreenSection>
      );
    }
    return null;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <StudyPromoBanner exam={profile?.exam} classLevel={profile?.class_level} compact />

      <ScreenPageHeader
        showHeader={screen.showHeader}
        eyebrow={screen.eyebrow}
        title={screen.pageTitle}
        description={screen.pageSubtitle}
        meta={
          <>
            <span className="ec-chip"><Lock size={12} /> {activeKeys.size} unlocked</span>
          </>
        }
        actions={
          <Button size="sm" variant="outline" onClick={() => void load()} aria-label="Refresh content">
            <RefreshCw size={14} className="mr-1.5" /> Refresh
          </Button>
        }
      />

      <ScreenAnnouncementBanner announcement={screen.announcement} />

      {sections.map((id) => renderSection(id))}

      <ScreenHelpNote help={screen.help} />
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

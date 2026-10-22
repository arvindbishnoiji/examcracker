'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  CheckCircle2,
  FileText,
  KeyRound,
  Layers,
  ListVideo,
  Lock,
  PlayCircle,
  RefreshCw,
  Search,
  Sparkles,
  Unlock,
  X,
} from 'lucide-react';
import YoutubeThumbnail from '@/components/YoutubeThumbnail';
import { BannerCarousel } from '@/components/banners/BannerCarousel';
import { useAuth } from '@/context/AuthContext';
import { getCatalogContent, getStudentSubjects, enrollInBatchOrSeries, ApiError } from '@/lib/api';
import { Badge, Skeleton } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/hooks/useToast';
import { useSiteConfig } from '@/context/SiteConfigContext';
import type { CourseCatalogItem, Subject } from '@/types';
import { formatClassLevel, formatClassList, isSafeHttpUrl } from '@/lib/validation';
import { activeEnrollmentKeys, coursePriceLabel, isPaidCourse } from '@/lib/enrollment';
import { selectBannersForPlacement } from '@/lib/site-config';
import { BatchShowcase } from '@/components/batches/BatchShowcase';
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

function customThumbOf(item: CourseCatalogItem): string {
  const meta = (item.metadata || {}) as Record<string, unknown>;
  const raw = String(meta.thumbnailUrl || meta.thumbnail_url || '').trim();
  return isSafeHttpUrl(raw) ? raw : '';
}

function LecturesHubPageInner() {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get('q') || '';
  const { profile, bootstrap, isAdmin, refresh: refreshAuth } = useAuth();
  const { config } = useSiteConfig();
  const { push } = useToast();
  const screen = config.lectures;

  const [tab, setTab] = useState<Tab>('batches');
  const [items, setItems] = useState<CourseCatalogItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState(initialQuery);
  const [sort, setSort] = useState<'newest' | 'title'>('newest');
  const [enrollingId, setEnrollingId] = useState<string | null>(null);
  const [justEnrolled, setJustEnrolled] = useState<Set<string>>(new Set());
  const [onlyMine, setOnlyMine] = useState(false);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [subjectFilter, setSubjectFilter] = useState('');

  // Modal state for access-code protected courses
  const [codeTarget, setCodeTarget] = useState<CourseCatalogItem | null>(null);
  const [accessCode, setAccessCode] = useState('');
  const [codeError, setCodeError] = useState<string | null>(null);

  const tabMeta: Record<Tab, { label: string; icon: React.ReactNode }> = {
    batches: { label: screen.tabLabels.batches, icon: <Layers size={14} /> },
    series: { label: screen.tabLabels.series, icon: <ListVideo size={14} /> },
    lectures: { label: screen.tabLabels.lectures, icon: <PlayCircle size={14} /> },
    resources: { label: screen.tabLabels.resources, icon: <FileText size={14} /> },
  };

  const lectureBanners = useMemo(
    () =>
      selectBannersForPlacement(
        config.banners,
        profile ? { exam: profile.exam, classLevel: profile.class_level } : null,
        'lectures'
      ),
    [config.banners, profile]
  );

  const load = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    setError(null);
    try {
      const kind = tab === 'batches' ? 'batch' : tab === 'series' ? 'series' : tab === 'lectures' ? 'lecture' : 'resource';
      const data = await getCatalogContent({ kind });
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
    else if (kindParam === 'resources' || kindParam === 'resource') setTab('resources');
    else if (kindParam === 'lectures' || kindParam === 'lecture') setTab('lectures');
  }, [searchParams]);

  const activeKeys = useMemo(
    () => activeEnrollmentKeys(bootstrap?.enrollments),
    [bootstrap?.enrollments]
  );

  const isEnrolled = useCallback(
    (item: CourseCatalogItem): boolean =>
      (justEnrolled.has(item.id) || activeKeys.has(`${item.kind}:${item.id}`)) &&
      ['batch', 'series'].includes(item.kind),
    [justEnrolled, activeKeys]
  );

  async function submitEnrollment(item: CourseCatalogItem, code?: string) {
    setEnrollingId(item.id);
    setCodeError(null);
    try {
      await enrollInBatchOrSeries({
        itemType: item.kind as 'batch' | 'series',
        itemId: item.id,
        accessCode: code?.trim() || undefined,
      });
      setJustEnrolled((previous) => new Set([...Array.from(previous), item.id]));
      setCodeTarget(null);
      setAccessCode('');
      push(`You now have access to ${item.title}.`, 'success');
      void refreshAuth().catch(() => {});
    } catch (e) {
      const msg =
        e instanceof ApiError
          ? e.message
          : e instanceof Error
            ? e.message
            : 'Enrollment failed.';
      if (codeTarget) {
        setCodeError(msg);
      } else {
        push(msg, 'error');
      }
    } finally {
      setEnrollingId(null);
    }
  }

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const list = items.filter((item) => {
      if (onlyMine && !isEnrolled(item)) return false;
      if (subjectFilter && (tab === 'lectures' || tab === 'resources')) {
        const itemSubject =
          item.subjectId || String(((item.metadata || {}) as Record<string, unknown>).subjectId || '');
        if (itemSubject !== subjectFilter) return false;
      }
      if (!q) return true;
      const meta = (item.metadata || {}) as Record<string, unknown>;
      return `${item.title} ${item.description} ${item.subjectName || ''} ${meta.subject || ''} ${meta.topic || ''}`
        .toLowerCase()
        .includes(q);
    });
    const sorted =
      sort === 'title'
        ? [...list].sort((a, b) => a.title.localeCompare(b.title))
        : [...list].sort((a, b) => {
            if (tab === 'lectures') {
              const orderDiff = Number(a.sortOrder || 0) - Number(b.sortOrder || 0);
              if (orderDiff !== 0) return orderDiff;
            }
            return b.updated_at.localeCompare(a.updated_at);
          });
    return screen.itemLimit > 0 ? sorted.slice(0, screen.itemLimit) : sorted;
  }, [items, filter, sort, tab, onlyMine, subjectFilter, isEnrolled, screen.itemLimit]);

  const canFilterMine = tab === 'batches' || tab === 'series';
  const sections = visibleSectionIds('lectures', screen);
  const gridClass = screenGridClass(screen.layout);

  function renderCatalogue() {
    if (loading) {
      return (
        <div className={gridClass}>
          {[1, 2, 3, 4, 5, 6].map((index) => (
            <div key={index} className="ec-card overflow-hidden">
              <Skeleton className="aspect-video w-full rounded-none" />
              <div className="space-y-2 p-4">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            </div>
          ))}
        </div>
      );
    }

    if (error) {
      return (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <span>{error}</span>
          <Button size="sm" variant="outline" className="ml-3" onClick={() => void load()}>
            Try again
          </Button>
        </div>
      );
    }

    if (filtered.length === 0) {
      const isSearch = Boolean(filter.trim() || subjectFilter);
      return (
        <ScreenEmpty
          icon={onlyMine ? <Lock size={18} /> : <Sparkles size={18} />}
          title={
            isSearch
              ? screen.noResultsTitle
              : onlyMine
                ? 'No enrolled courses yet'
                : screen.emptyTitle
          }
          body={
            isSearch
              ? screen.noResultsBody
              : onlyMine
                ? 'Enroll in a batch or lecture series to see your active courses here.'
                : screen.emptyBody
          }
          action={
            isSearch ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setFilter('');
                  setSubjectFilter('');
                }}
              >
                Reset filters
              </Button>
            ) : isAdmin ? (
              <Link
                href="/admin/batches"
                className="ec-btn bg-brand-600 px-4 py-2 text-xs font-semibold text-white"
              >
                Manage Catalogue
              </Link>
            ) : undefined
          }
        />
      );
    }

    return (
      <div className={gridClass}>
        {filtered.map((item) => {
          const meta = (item.metadata || {}) as Record<string, unknown>;
          const needsCode = Boolean(item.hasAccessCode);
          const enrolled = isEnrolled(item);
          const paid = isPaidCourse(item);
          const preview = meta.isPreview === true;
          const subjectLabel = String(item.subjectName || meta.subject || '').trim() || null;

          return (
            <article key={item.id} className="ec-card ec-card-interactive flex flex-col overflow-hidden">
              <Link href={`/lectures/${item.id}`} className="block focus:outline-none">
                <YoutubeThumbnail
                  src={customThumbOf(item)}
                  videoId={String(meta.videoId || '')}
                  alt={item.title}
                  duration={meta.duration ? String(meta.duration) : null}
                  badge={
                    enrolled
                      ? 'Enrolled'
                      : preview
                        ? 'Free Preview'
                        : item.kind === 'batch'
                          ? 'Batch'
                          : item.kind === 'series'
                            ? 'Series'
                            : subjectLabel || item.kind
                  }
                  subjectName={subjectLabel || item.exam}
                  className="aspect-video w-full"
                />
              </Link>

              <div className="flex flex-1 flex-col gap-2.5 p-4">
                <div className="flex items-start justify-between gap-2">
                  <Link href={`/lectures/${item.id}`} className="group min-w-0 flex-1">
                    <h2 className="line-clamp-2 text-sm font-bold leading-snug text-ink-900 group-hover:text-brand-700">
                      {item.title}
                    </h2>
                  </Link>
                  {(tab === 'batches' || tab === 'series') && (
                    <Badge variant={paid ? 'warning' : 'success'}>{coursePriceLabel(item)}</Badge>
                  )}
                </div>

                <p className="line-clamp-2 text-xs leading-relaxed text-ink-500">
                  {item.description ||
                    (tab === 'batches' || tab === 'series'
                      ? 'Subject-structured syllabus with ordered video lectures and PDF notes.'
                      : 'Published study material tailored to your exam track.')}
                </p>

                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="info">{item.exam}</Badge>
                  <Badge>{formatClassList(item.classes)}</Badge>
                  {subjectLabel && <Badge variant="default">{subjectLabel}</Badge>}
                  {needsCode && !enrolled && (
                    <Badge variant="warning">
                      <Lock size={9} className="mr-0.5" /> Code Required
                    </Badge>
                  )}
                </div>

                {(tab === 'batches' || tab === 'series') && (
                  <div className="mt-auto flex flex-col gap-2 border-t border-ink-100 pt-3">
                    {enrolled ? (
                      <Link
                        href={`/lectures/${item.id}`}
                        className="ec-btn flex w-full items-center justify-center gap-1.5 bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
                      >
                        <CheckCircle2 size={14} /> {screen.enrolledCtaLabel}
                      </Link>
                    ) : paid && !needsCode ? (
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-medium text-amber-800">
                          Institute-enrolled batch
                        </span>
                        <Link
                          href={`/lectures/${item.id}`}
                          className="ec-btn border border-ink-200 px-3 py-1.5 text-xs font-semibold text-ink-700 hover:bg-ink-50"
                        >
                          View Syllabus
                        </Link>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          loading={enrollingId === item.id && !codeTarget}
                          onClick={() => {
                            if (needsCode) {
                              setCodeTarget(item);
                              setAccessCode('');
                              setCodeError(null);
                            } else {
                              void submitEnrollment(item);
                            }
                          }}
                          className="flex-1"
                        >
                          {needsCode ? (
                            <>
                              <KeyRound size={13} className="mr-1.5" /> Unlock with Code
                            </>
                          ) : (
                            <>
                              <Unlock size={13} className="mr-1.5" /> Enroll Free
                            </>
                          )}
                        </Button>
                        <Link
                          href={`/lectures/${item.id}`}
                          className="ec-btn border border-ink-200 bg-[var(--ec-surface)] px-3 py-2 text-xs font-semibold text-ink-700 hover:bg-ink-50"
                        >
                          Syllabus
                        </Link>
                      </div>
                    )}
                  </div>
                )}

                {tab === 'lectures' && (
                  <div className="mt-auto flex items-center gap-2 border-t border-ink-100 pt-3">
                    <Link
                      href={`/lectures/${item.id}`}
                      className="ec-btn flex flex-1 items-center justify-center gap-1.5 bg-brand-600 px-3 py-2 text-xs font-semibold text-white hover:bg-brand-700"
                    >
                      <PlayCircle size={14} /> {screen.watchCtaLabel}
                    </Link>
                    {Boolean(meta.notesFileId) ? (
                      <Link
                        href={`/lectures/${item.id}`}
                        className="ec-btn inline-flex items-center gap-1 border border-ink-200 px-3 py-2 text-xs font-semibold text-ink-700 hover:bg-ink-50"
                      >
                        <FileText size={13} /> Notes
                      </Link>
                    ) : Boolean(meta.notesPdfUrl) && isSafeHttpUrl(String(meta.notesPdfUrl)) ? (
                      <a
                        href={String(meta.notesPdfUrl)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ec-btn inline-flex items-center gap-1 border border-ink-200 px-3 py-2 text-xs font-semibold text-ink-700 hover:bg-ink-50"
                      >
                        <FileText size={13} /> Notes
                      </a>
                    ) : null}
                  </div>
                )}

                {tab === 'resources' && (
                  <div className="mt-auto border-t border-ink-100 pt-3">
                    {Boolean(meta.notesFileId || meta.driveFileId) ? (
                      <Link
                        href={`/lectures/${item.id}`}
                        className="ec-btn flex w-full items-center justify-center gap-1.5 bg-brand-600 px-3 py-2 text-xs font-semibold text-white hover:bg-brand-700"
                      >
                        <FileText size={14} /> Open Secured PDF
                      </Link>
                    ) : Boolean(meta.pdfUrl) && isSafeHttpUrl(String(meta.pdfUrl)) ? (
                      <a
                        href={String(meta.pdfUrl)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ec-btn flex w-full items-center justify-center gap-1.5 bg-brand-600 px-3 py-2 text-xs font-semibold text-white hover:bg-brand-700"
                      >
                        <FileText size={14} /> Open PDF Resource
                      </a>
                    ) : (
                      <span className="text-xs text-ink-400">No document attached yet.</span>
                    )}
                  </div>
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
        <div
          key={id}
          className="flex flex-wrap gap-1.5 border-b border-ink-100 pb-3"
          role="tablist"
          aria-label="Learning content types"
        >
          {(Object.keys(tabMeta) as Tab[]).map((key) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              onClick={() => {
                setTab(key);
                setOnlyMine(false);
              }}
              className={`ec-btn inline-flex items-center gap-1.5 border px-3.5 py-2 text-xs font-semibold transition ${
                tab === key
                  ? 'border-brand-600 bg-brand-600 text-white shadow-sm'
                  : 'border-ink-200 bg-[var(--ec-surface)] text-ink-700 hover:bg-ink-50'
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
        <div key={id} className="space-y-2.5">
          <div className="flex flex-wrap items-center gap-2">
            {screen.showSearch ? (
              <div className="min-w-[220px] flex-1">
                <div className="relative">
                  <Search
                    size={15}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400"
                  />
                  <Input
                    aria-label={`Search ${tabMeta[tab].label}`}
                    placeholder={
                      screen.searchPlaceholder || `Search ${tabMeta[tab].label.toLowerCase()}…`
                    }
                    value={filter}
                    onChange={(event) => setFilter(event.target.value)}
                    className="!pl-9"
                  />
                </div>
              </div>
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
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-ink-200 bg-[var(--ec-surface)] px-3 py-2 text-xs font-semibold text-ink-700">
                <input
                  type="checkbox"
                  checked={onlyMine}
                  onChange={(event) => setOnlyMine(event.target.checked)}
                />
                {screen.mineFilterLabel}
              </label>
            ) : null}

            <span className="text-xs font-medium text-ink-500">
              {filtered.length} {filtered.length === 1 ? 'item' : 'items'}
            </span>
          </div>

          {subjects.length > 0 && (tab === 'lectures' || tab === 'resources') && (
            <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter by subject">
              <button
                type="button"
                aria-pressed={subjectFilter === ''}
                onClick={() => setSubjectFilter('')}
                className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                  subjectFilter === ''
                    ? 'border-brand-600 bg-brand-50 text-brand-700'
                    : 'border-ink-200 bg-[var(--ec-surface)] text-ink-600 hover:bg-ink-50'
                }`}
              >
                All Subjects
              </button>
              {subjects.map((subj) => (
                <button
                  key={subj.id}
                  type="button"
                  aria-pressed={subjectFilter === subj.id}
                  onClick={() => setSubjectFilter(subj.id)}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                    subjectFilter === subj.id
                      ? 'border-brand-600 bg-brand-50 text-brand-700'
                      : 'border-ink-200 bg-[var(--ec-surface)] text-ink-600 hover:bg-ink-50'
                  }`}
                >
                  {subj.name}
                </button>
              ))}
            </div>
          )}
        </div>
      );
    }

    if (id === 'catalogue') return <div key={id}>{renderCatalogue()}</div>;

    if (id === 'access_note') {
      return (
        <ScreenSection key={id} title={screen.accessNoteTitle}>
          <p className="rounded-[var(--ec-radius)] border border-ink-100 bg-[var(--ec-surface)] p-4 text-xs leading-relaxed text-ink-500">
            {screen.accessNoteBody}
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
            {profile && (
              <span className="ec-chip">
                {profile.exam} · {formatClassLevel(profile.class_level)}
              </span>
            )}
            <span className="ec-chip">
              <CheckCircle2 size={12} /> {activeKeys.size} enrolled
            </span>
          </>
        }
        actions={
          <Button size="sm" variant="outline" onClick={() => void load()} aria-label="Refresh content">
            <RefreshCw size={14} className="mr-1.5" /> Refresh
          </Button>
        }
      />

      {lectureBanners.length > 0 && (
        <BannerCarousel banners={lectureBanners} settings={config.banners} compact />
      )}

      <ScreenAnnouncementBanner announcement={screen.announcement} />

      {tab === 'batches' && (
        <BatchShowcase
          batches={items.filter((item) => item.kind === 'batch')}
          config={config.batchStudio}
          student={profile ? { exam: profile.exam, classLevel: profile.class_level } : null}
          page="lectures"
          compact
        />
      )}

      {sections.map((id) => renderSection(id))}

      <ScreenHelpNote help={screen.help} />

      {/* Modal Dialog for Access-Code Course Enrollment */}
      {codeTarget && (
        <div
          className="fixed inset-0 z-[95] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label={`Unlock ${codeTarget.title}`}
        >
          <div className="w-full max-w-md ec-card shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-ink-100 px-5 py-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-brand-700">
                  Access Code Verification
                </p>
                <h2 className="mt-0.5 text-base font-bold text-ink-900">{codeTarget.title}</h2>
              </div>
              <button
                type="button"
                onClick={() => setCodeTarget(null)}
                aria-label="Close"
                className="grid h-8 w-8 place-items-center rounded-lg text-ink-500 hover:bg-ink-100"
              >
                <X size={16} />
              </button>
            </div>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                if (!accessCode.trim()) {
                  setCodeError('Enter the access code provided by your mentor.');
                  return;
                }
                void submitEnrollment(codeTarget, accessCode);
              }}
              className="space-y-4 px-5 py-4"
            >
              <p className="text-xs leading-relaxed text-ink-600">
                Enter your institute or mentor access code to unlock all subject playlists and PDF notes in{' '}
                <strong className="text-ink-900">{codeTarget.title}</strong>.
              </p>
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-ink-700">
                  Access Code <span className="text-red-500">*</span>
                </span>
                <input
                  className="ec-field font-mono"
                  value={accessCode}
                  onChange={(event) => setAccessCode(event.target.value)}
                  placeholder="Enter access code"
                  autoFocus
                  required
                />
              </label>
              {codeError && (
                <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                  {codeError}
                </p>
              )}
              <div className="flex justify-end gap-2 border-t border-ink-100 pt-3">
                <Button type="button" variant="outline" size="sm" onClick={() => setCodeTarget(null)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" loading={enrollingId === codeTarget.id}>
                  Verify & Unlock
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function LecturesHubPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-6xl space-y-4">
          <div className="ec-skeleton h-10 w-64" />
          <div className="ec-skeleton h-52 w-full" />
        </div>
      }
    >
      <LecturesHubPageInner />
    </Suspense>
  );
}

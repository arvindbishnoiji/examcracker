'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Clock,
  Download,
  ExternalLink,
  FileText,
  KeyRound,
  Layers,
  ListVideo,
  Lock,
  Play,
  SkipForward,
  Sparkles,
  Unlock,
  X,
} from 'lucide-react';
import {
  ApiError,
  enrollInBatchOrSeries,
  fetchAuthorizedBlob,
  getCatalogItem,
  getCourseFiles,
  getCourseTree,
  saveLessonProgress,
} from '@/lib/api';
import { Card, Badge, Skeleton } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import YoutubeThumbnail from '@/components/YoutubeThumbnail';
import { useToast } from '@/hooks/useToast';
import { useAuth } from '@/context/AuthContext';
import { getYoutubeEmbedUrl } from '@/lib/mediaProxy';
import { formatClassList, isSafeHttpUrl } from '@/lib/validation';
import {
  buildSubjectQueue,
  formatWatchDuration,
  lectureCompletionPercent,
} from '@/lib/lecture-queue';
import type {
  CourseCatalogItem,
  CourseTreeResponse,
  DriveFileItem,
  LectureMetadata,
  Subject,
  SubjectQueueItem,
} from '@/types';
import { useSiteConfig } from '@/context/SiteConfigContext';
import {
  ScreenAnnouncementBanner,
  ScreenEmpty,
  ScreenHelpNote,
  ScreenSection,
} from '@/components/student/ScreenScaffold';

const AUTOPLAY_PREF_KEY = 'ec-subject-autoplay-v1';

function metaOf(item: CourseCatalogItem | null | undefined): Record<string, unknown> {
  return (item?.metadata || {}) as Record<string, unknown>;
}

function customThumbOf(item: CourseCatalogItem): string {
  const meta = metaOf(item);
  const candidate = String(meta.thumbnailUrl || meta.thumbnail_url || '').trim();
  return isSafeHttpUrl(candidate) ? candidate : '';
}

function orderOf(item: CourseCatalogItem): number {
  if (typeof item.sortOrder === 'number' && Number.isFinite(item.sortOrder)) {
    return item.sortOrder;
  }
  return Number(metaOf(item).position || 0) || 0;
}

export default function LectureDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const { push } = useToast();
  const { profile, isAdmin, refresh: refreshAuth } = useAuth();
  const { config } = useSiteConfig();
  const screen = config.lecturePlayer;

  const [lecture, setLecture] = useState<CourseCatalogItem | null>(null);
  const [parentCourse, setParentCourse] = useState<CourseCatalogItem | null>(null);
  const [subject, setSubject] = useState<{ id: string; name: string | null } | null>(null);
  const [serverQueue, setServerQueue] = useState<SubjectQueueItem[]>([]);
  const [course, setCourse] = useState<CourseTreeResponse | null>(null);
  const [courseFiles, setCourseFiles] = useState<DriveFileItem[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [watched, setWatched] = useState(0);
  const [resumeStartSeconds, setResumeStartSeconds] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [saving, setSaving] = useState(false);

  const [autoplayEnabled, setAutoplayEnabled] = useState(true);
  const [autoplayCountdown, setAutoplayCountdown] = useState<number | null>(null);
  const [playerPlaying, setPlayerPlaying] = useState(true);

  const [activeSubject, setActiveSubject] = useState('all');

  const [enrollModalOpen, setEnrollModalOpen] = useState(false);
  const [accessCode, setAccessCode] = useState('');
  const [enrolling, setEnrolling] = useState(false);
  const [enrollError, setEnrollError] = useState<string | null>(null);

  const [pdfOpen, setPdfOpen] = useState(false);
  const [pdfTitle, setPdfTitle] = useState<string>('');
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const pdfUrlRef = useRef<string | null>(null);
  const tickRef = useRef<number | null>(null);
  const saveRef = useRef<number | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(AUTOPLAY_PREF_KEY);
      if (saved === '0') setAutoplayEnabled(false);
    } catch {
      // Ignore storage access errors
    }
  }, []);

  const toggleAutoplay = useCallback((nextValue: boolean) => {
    setAutoplayEnabled(nextValue);
    if (!nextValue) setAutoplayCountdown(null);
    try {
      localStorage.setItem(AUTOPLAY_PREF_KEY, nextValue ? '1' : '0');
    } catch {
      // Ignore storage access errors
    }
  }, []);

  const releasePdf = useCallback(() => {
    if (pdfUrlRef.current) URL.revokeObjectURL(pdfUrlRef.current);
    pdfUrlRef.current = null;
    setPdfUrl(null);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setAutoplayCountdown(null);
    try {
      const detail = await getCatalogItem(id);
      const { item } = detail;

      if (item.kind === 'batch' || item.kind === 'series') {
        const tree = await getCourseTree(item.id);
        setCourse(tree);
        setLecture(null);
        setParentCourse(tree.parent);
        setSubject(null);
        setServerQueue([]);
        if (tree.enrolled || isAdmin) {
          const files = await getCourseFiles(item.id).catch(() => []);
          setCourseFiles(files);
        } else {
          setCourseFiles([]);
        }
        return;
      }

      setLecture(item);
      setParentCourse(detail.parent || null);
      setSubject(detail.subject || null);
      setServerQueue(detail.subjectQueue || []);

      const initialWatched = Math.max(0, Number(detail.progress?.watchedSeconds || 0));
      const initialCompleted = Boolean(detail.progress?.completed);
      setWatched(initialWatched);
      setCompleted(initialCompleted);
      setResumeStartSeconds(!initialCompleted && initialWatched >= 10 ? initialWatched : 0);
      setPlayerPlaying(true);

      const parentId = item.parentId || String(metaOf(item).parentId || '');
      if (parentId) {
        try {
          const tree = await getCourseTree(parentId);
          setCourse(tree);
          if (!detail.parent) setParentCourse(tree.parent);
          if (!detail.subject && item.subjectId) {
            const matchedSubject = tree.subjects.find((entry) => entry.id === item.subjectId);
            if (matchedSubject) {
              setSubject({
                id: matchedSubject.id,
                name: matchedSubject.name,
              });
            }
          }
        } catch {
          setCourse(null);
        }
      } else {
        setCourse(null);
      }
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) {
        setError('This lecture or course is no longer available.');
      } else if (e instanceof ApiError && e.status === 403) {
        setError(e.message);
      } else {
        setError(e instanceof Error ? e.message : 'Unable to load this page right now.');
      }
    } finally {
      setLoading(false);
    }
  }, [id, isAdmin]);

  useEffect(() => {
    void load();
  }, [load]);

  // Strict subject-only queue resolution: uses serverQueue when present, or
  // ONLY the matching subject's lectures from the course tree (never cross-subject).
  const candidateSubjectLectures = useMemo<SubjectQueueItem[]>(() => {
    if (serverQueue.length > 0) return serverQueue;
    if (!lecture?.subjectId || !course) return [];
    const matchingSubject = course.subjects.find((entry) => entry.id === lecture.subjectId);
    if (!matchingSubject) return [];
    return matchingSubject.lectures as SubjectQueueItem[];
  }, [serverQueue, lecture?.subjectId, course]);

  const resolvedQueue = useMemo(
    () =>
      buildSubjectQueue(lecture, candidateSubjectLectures, {
        student: profile ? { exam: profile.exam, classLevel: profile.class_level } : null,
        isAdmin,
        relatedLimit: 6,
      }),
    [lecture, candidateSubjectLectures, profile, isAdmin]
  );

  const previousLecture = resolvedQueue.previous;
  const nextLecture = resolvedQueue.next;
  const subjectLabel = subject?.name || (lecture?.subjectId ? 'Subject' : null);

  // Track watch time while player is active
  useEffect(() => {
    if (!lecture || lecture.kind !== 'lecture' || !playerPlaying) return;
    tickRef.current = window.setInterval(() => {
      if (document.visibilityState === 'hidden') return;
      setWatched((value) => value + 1);
    }, 1000);
    return () => {
      if (tickRef.current) window.clearInterval(tickRef.current);
    };
  }, [lecture, playerPlaying]);

  // Debounced autosave to D1 lesson_progress
  useEffect(() => {
    if (!lecture || lecture.kind !== 'lecture' || watched === 0) return;
    if (saveRef.current) window.clearTimeout(saveRef.current);
    saveRef.current = window.setTimeout(() => {
      void saveLessonProgress({
        lectureId: lecture.id,
        watchedSeconds: watched,
        completed,
      }).catch(() => {
        /* Best-effort background sync */
      });
    }, 5000);
    return () => {
      if (saveRef.current) window.clearTimeout(saveRef.current);
    };
  }, [watched, completed, lecture]);

  // Subscribe to YouTube IFrame API state changes for accurate play/pause & end-of-video autoplay
  const bindYoutubeHandshake = useCallback(() => {
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    try {
      win.postMessage(JSON.stringify({ event: 'listening', id: id }), '*');
      win.postMessage(
        JSON.stringify({ event: 'command', func: 'addEventListener', args: ['onStateChange'] }),
        '*'
      );
    } catch {
      // Cross-origin postMessage failure is non-fatal
    }
  }, [id]);

  const handleLectureEnded = useCallback(() => {
    if (!lecture || lecture.kind !== 'lecture') return;
    setPlayerPlaying(false);
    setCompleted(true);
    void saveLessonProgress({
      lectureId: lecture.id,
      watchedSeconds: Math.max(1, watched),
      completed: true,
    }).catch(() => {});

    if (autoplayEnabled && nextLecture) {
      setAutoplayCountdown(5);
    }
  }, [lecture, watched, autoplayEnabled, nextLecture]);

  useEffect(() => {
    if (!lecture || lecture.kind !== 'lecture') return;
    const onMessage = (event: MessageEvent) => {
      if (typeof event.origin === 'string' && !event.origin.includes('youtube')) return;
      if (typeof event.data !== 'string') return;
      try {
        const parsed = JSON.parse(event.data) as {
          event?: string;
          info?: number | { playerState?: number; currentTime?: number };
        };
        const state =
          parsed.event === 'onStateChange' && typeof parsed.info === 'number'
            ? parsed.info
            : parsed.event === 'infoDelivery' &&
                parsed.info &&
                typeof parsed.info === 'object' &&
                typeof parsed.info.playerState === 'number'
              ? parsed.info.playerState
              : null;

        if (
          parsed.event === 'infoDelivery' &&
          parsed.info &&
          typeof parsed.info === 'object' &&
          typeof parsed.info.currentTime === 'number' &&
          parsed.info.currentTime > 0
        ) {
          const syncedSeconds = Math.floor(parsed.info.currentTime);
          setWatched((prev) => Math.max(prev, syncedSeconds));
        }

        if (state === 1) {
          setPlayerPlaying(true);
          setAutoplayCountdown(null);
        } else if (state === 2) {
          setPlayerPlaying(false);
        } else if (state === 0) {
          handleLectureEnded();
        }
      } catch {
        // Ignore unrelated postMessage payloads
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [lecture, handleLectureEnded]);

  // Countdown tick for subject-isolated Autoplay Next
  useEffect(() => {
    if (autoplayCountdown === null) return;
    if (!autoplayEnabled || !nextLecture) {
      setAutoplayCountdown(null);
      return;
    }
    if (autoplayCountdown <= 0) {
      setAutoplayCountdown(null);
      router.push(`/lectures/${nextLecture.id}`);
      return;
    }
    const timer = window.setTimeout(() => {
      setAutoplayCountdown((current) => (current !== null ? current - 1 : null));
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [autoplayCountdown, autoplayEnabled, nextLecture, router]);

  useEffect(() => releasePdf, [releasePdf]);

  async function saveProgressManual(nextCompleted?: boolean) {
    if (!lecture || lecture.kind !== 'lecture') return;
    const finalCompleted = typeof nextCompleted === 'boolean' ? nextCompleted : completed;
    setSaving(true);
    try {
      await saveLessonProgress({
        lectureId: lecture.id,
        watchedSeconds: watched,
        completed: finalCompleted,
      });
      setCompleted(finalCompleted);
      push(finalCompleted ? 'Marked complete and saved.' : 'Progress saved.', 'success');
    } catch (e) {
      push(e instanceof Error ? e.message : 'Progress could not be saved.', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function openPrivatePdf(fileId: string, titleLabel?: string) {
    setPdfError(null);
    setPdfLoading(true);
    setPdfTitle(titleLabel || lecture?.title || screen.notesTitle);
    setPdfOpen(true);
    try {
      const blob = await fetchAuthorizedBlob(`/files/${encodeURIComponent(fileId)}`);
      if (pdfUrlRef.current) URL.revokeObjectURL(pdfUrlRef.current);
      const url = URL.createObjectURL(blob);
      pdfUrlRef.current = url;
      setPdfUrl(url);
    } catch (e) {
      setPdfError(e instanceof Error ? e.message : 'The PDF could not be opened.');
    } finally {
      setPdfLoading(false);
    }
  }

  function closePdf() {
    setPdfOpen(false);
    setPdfError(null);
    releasePdf();
  }

  async function handleCourseEnroll(event: React.FormEvent) {
    event.preventDefault();
    if (!course) return;
    const parent = course.parent;
    if (parent.kind !== 'batch' && parent.kind !== 'series') return;
    const needsCode = Boolean(parent.hasAccessCode && !course.isFree);
    if (needsCode && !accessCode.trim()) {
      setEnrollError('Enter the access code provided by your mentor.');
      return;
    }
    setEnrollError(null);
    setEnrolling(true);
    try {
      await enrollInBatchOrSeries({
        itemType: parent.kind,
        itemId: parent.id,
        accessCode: accessCode.trim() || undefined,
      });
      push(`Enrolled in ${parent.title}.`, 'success');
      setEnrollModalOpen(false);
      setAccessCode('');
      await Promise.all([refreshAuth().catch(() => {}), load()]);
    } catch (err) {
      setEnrollError(err instanceof Error ? err.message : 'Enrollment failed. Check your code and try again.');
    } finally {
      setEnrolling(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl space-y-5">
        <Skeleton className="h-6 w-48" />
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-4">
            <Skeleton className="aspect-video w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
          <div className="space-y-3">
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-72 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-xl py-8">
        <Card className="p-6 text-center sm:p-8">
          <div className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-2xl bg-amber-50 text-amber-700">
            <Lock size={20} />
          </div>
          <h1 className="text-lg font-bold text-ink-900">{error}</h1>
          <p className="mt-1.5 text-xs leading-relaxed text-ink-500">
            Course eligibility and enrollment permissions are verified on the server for your account.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Button variant="outline" size="sm" onClick={() => router.back()}>
              Go back
            </Button>
            <Button size="sm" onClick={() => void load()}>
              Try again
            </Button>
            <Link
              href="/lectures"
              className="ec-btn inline-flex items-center border border-ink-200 bg-[var(--ec-surface)] px-3.5 py-2 text-xs font-semibold text-ink-700 hover:bg-ink-50"
            >
              Browse library
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Course Workspace View: Batch / Series → Subjects → Lectures & Study Files
  // ---------------------------------------------------------------------------
  if (!lecture && course) {
    const subjects = course.subjects;
    const visibleSubjects =
      activeSubject === 'all'
        ? subjects
        : activeSubject === 'general'
          ? []
          : subjects.filter((s) => s.id === activeSubject);
    const showUnassigned =
      (activeSubject === 'all' || activeSubject === 'general') && Boolean(course.unassigned);

    const unlockedLectures =
      subjects.reduce((sum, s) => sum + s.lectures.length, 0) +
      (course.unassigned?.lectures.length || 0);
    const totalLectures = course.totalLectureCount ?? unlockedLectures;
    const lockedLectures = course.lockedLectureCount ?? Math.max(0, totalLectures - unlockedLectures);
    const totalResources =
      (course.totalResourceCount ??
        subjects.reduce((sum, s) => sum + s.resources.length, 0) +
          (course.unassigned?.resources.length || 0)) + courseFiles.length;
    const isEmpty = subjects.length === 0 && !course.unassigned && totalLectures === 0;
    const requiresCode = Boolean(course.parent.hasAccessCode && !course.isFree);

    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-xs font-medium text-ink-500">
          <Link href="/lectures" className="font-semibold text-brand-700 hover:underline">
            {screen.backLabel || 'Lectures & Courses'}
          </Link>
          <ChevronRight size={13} aria-hidden />
          <span className="capitalize">{course.parent.kind}</span>
          <ChevronRight size={13} aria-hidden />
          <span className="truncate font-semibold text-ink-800">{course.parent.title}</span>
        </nav>

        <ScreenAnnouncementBanner announcement={screen.announcement} />

        <Card className="overflow-hidden">
          <div className="grid gap-0 md:grid-cols-[320px_minmax(0,1fr)] lg:grid-cols-[380px_minmax(0,1fr)]">
            <YoutubeThumbnail
              src={customThumbOf(course.parent)}
              videoId={String(metaOf(course.parent).videoId || '')}
              alt={course.parent.title}
              badge={course.parent.kind === 'batch' ? 'Batch' : 'Lecture Series'}
              subjectName={course.parent.exam}
              className="aspect-video w-full md:h-full"
            />
            <div className="flex flex-col justify-between p-5 sm:p-6">
              <div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge variant="info">{course.parent.exam}</Badge>
                  <Badge variant="default">{formatClassList(course.parent.classes)}</Badge>
                  <Badge variant={course.enrolled ? 'success' : 'warning'}>
                    {course.enrolled ? 'Enrolled' : course.isFree ? 'Free Enrollment' : 'Enrollment Required'}
                  </Badge>
                  <Badge variant="default">
                    {subjects.length} {subjects.length === 1 ? 'subject' : 'subjects'}
                  </Badge>
                  <Badge variant="default">
                    {totalLectures} {totalLectures === 1 ? 'lecture' : 'lectures'}
                  </Badge>
                  {totalResources > 0 && (
                    <Badge variant="default">
                      {totalResources} {totalResources === 1 ? 'PDF / note' : 'PDFs & notes'}
                    </Badge>
                  )}
                </div>

                <h1 className="mt-3 text-xl font-bold tracking-tight text-ink-900 sm:text-2xl">
                  {course.parent.title}
                </h1>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-600">
                  {course.parent.description ||
                    'Structured subject-wise syllabus with ordered video lectures and downloadable study notes.'}
                </p>
              </div>

              {!course.enrolled && (
                <div className="mt-4 flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50/80 p-3.5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-2 text-xs text-amber-950">
                    <Lock size={15} className="mt-0.5 shrink-0 text-amber-700" />
                    <div>
                      <p className="font-semibold">
                        {lockedLectures > 0
                          ? `${lockedLectures} lecture${lockedLectures === 1 ? ' is' : 's are'} locked until you enroll.`
                          : 'Enroll to unlock the full subject syllabus and PDF notes.'}
                      </p>
                      <p className="mt-0.5 text-[11px] text-amber-800">
                        {course.previewCount > 0
                          ? `${course.previewCount} free preview lecture${course.previewCount === 1 ? '' : 's'} available below.`
                          : requiresCode
                            ? 'Requires an access code from your mentor or institute.'
                            : 'Instant one-click enrollment for eligible students.'}
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => {
                      setEnrollError(null);
                      setEnrollModalOpen(true);
                    }}
                    className="shrink-0"
                  >
                    {requiresCode ? (
                      <>
                        <KeyRound size={14} className="mr-1.5" /> Unlock with Code
                      </>
                    ) : (
                      <>
                        <Unlock size={14} className="mr-1.5" /> Enroll Now
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </Card>

        {subjects.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 border-b border-ink-100 pb-3" role="tablist" aria-label="Filter syllabus by subject">
            <button
              type="button"
              role="tab"
              aria-selected={activeSubject === 'all'}
              onClick={() => setActiveSubject('all')}
              className={`ec-btn border px-3.5 py-1.5 text-xs font-semibold transition ${
                activeSubject === 'all'
                  ? 'border-brand-600 bg-brand-600 text-white shadow-sm'
                  : 'border-ink-200 bg-[var(--ec-surface)] text-ink-700 hover:bg-ink-50'
              }`}
            >
              All Subjects ({subjects.length})
            </button>
            {subjects.map((subj) => {
              const subjCount = subj.totalLectureCount ?? subj.lectures.length;
              return (
                <button
                  key={subj.id}
                  type="button"
                  role="tab"
                  aria-selected={activeSubject === subj.id}
                  onClick={() => setActiveSubject(subj.id)}
                  className={`ec-btn border px-3.5 py-1.5 text-xs font-semibold transition ${
                    activeSubject === subj.id
                      ? 'border-brand-600 bg-brand-600 text-white shadow-sm'
                      : 'border-ink-200 bg-[var(--ec-surface)] text-ink-700 hover:bg-ink-50'
                  }`}
                >
                  {subj.name} · {subjCount}
                </button>
              );
            })}
            {course.unassigned && (
              <button
                type="button"
                role="tab"
                aria-selected={activeSubject === 'general'}
                onClick={() => setActiveSubject('general')}
                className={`ec-btn border px-3.5 py-1.5 text-xs font-semibold transition ${
                  activeSubject === 'general'
                    ? 'border-brand-600 bg-brand-600 text-white shadow-sm'
                    : 'border-ink-200 bg-[var(--ec-surface)] text-ink-700 hover:bg-ink-50'
                }`}
              >
                General · {course.unassigned.lectures.length + course.unassigned.resources.length}
              </button>
            )}
          </div>
        )}

        {isEmpty ? (
          <ScreenEmpty
            icon={<Layers size={20} />}
            title="No lectures published in this course yet"
            body={`This ${course.parent.kind} has been created, and subject lectures will appear here as soon as your faculty publishes them.`}
          />
        ) : (
          <div className="space-y-7">
            {visibleSubjects.map((subj) => {
              const sortedLectures = [...subj.lectures].sort((a, b) => orderOf(a) - orderOf(b));
              const subjTotal = subj.totalLectureCount ?? sortedLectures.length;
              const subjLocked = Math.max(0, subjTotal - sortedLectures.length);
              return (
                <ScreenSection
                  key={subj.id}
                  title={subj.name}
                  subtitle={
                    subj.description ||
                    `${subjTotal} lecture${subjTotal === 1 ? '' : 's'}${
                      subj.resources.length ? ` · ${subj.resources.length} study resource${subj.resources.length === 1 ? '' : 's'}` : ''
                    }`
                  }
                  action={
                    sortedLectures[0] ? (
                      <Link
                        href={`/lectures/${sortedLectures[0].id}`}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:underline"
                      >
                        Start {subj.name} <ArrowRight size={13} />
                      </Link>
                    ) : null
                  }
                >
                  {sortedLectures.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-ink-200 bg-[var(--ec-surface)] px-4 py-6 text-center text-xs text-ink-500">
                      {subjLocked > 0
                        ? `${subjLocked} ${subj.name} lecture${subjLocked === 1 ? ' is' : 's are'} locked. Enroll above to start watching.`
                        : `No lectures published in ${subj.name} yet.`}
                    </div>
                  ) : (
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {sortedLectures.map((item, idx) => {
                        const meta = metaOf(item);
                        return (
                          <Link
                            key={item.id}
                            href={`/lectures/${item.id}`}
                            className="ec-card ec-card-interactive group flex flex-col overflow-hidden"
                          >
                            <YoutubeThumbnail
                              src={customThumbOf(item)}
                              videoId={String(meta.videoId || '')}
                              alt={item.title}
                              duration={meta.duration ? String(meta.duration) : null}
                              badge={meta.isPreview === true ? 'Free Preview' : `Lecture ${idx + 1}`}
                              subjectName={subj.name}
                              className="aspect-video w-full"
                            />
                            <div className="flex flex-1 flex-col justify-between p-3.5">
                              <div>
                                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-brand-700">
                                  <span>{subj.name}</span>
                                  {meta.topic ? (
                                    <>
                                      <span aria-hidden>·</span>
                                      <span className="truncate text-ink-500">{String(meta.topic)}</span>
                                    </>
                                  ) : null}
                                </div>
                                <h3 className="mt-1 line-clamp-2 text-sm font-bold leading-snug text-ink-900 group-hover:text-brand-700">
                                  {item.title}
                                </h3>
                              </div>
                              {item.description && (
                                <p className="mt-1.5 line-clamp-1 text-xs text-ink-500">{item.description}</p>
                              )}
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  )}

                  {subj.resources.length > 0 && (
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {subj.resources.map((resource) => (
                        <Link
                          key={resource.id}
                          href={`/lectures/${resource.id}`}
                          className="flex items-center justify-between gap-3 rounded-xl border border-ink-100 bg-[var(--ec-surface)] px-3.5 py-2.5 text-xs font-semibold text-ink-800 transition hover:border-brand-200 hover:bg-brand-50/40"
                        >
                          <span className="flex min-w-0 items-center gap-2">
                            <FileText size={15} className="shrink-0 text-brand-600" />
                            <span className="truncate">{resource.title}</span>
                          </span>
                          <span className="shrink-0 text-[11px] text-brand-700">Open PDF →</span>
                        </Link>
                      ))}
                    </div>
                  )}
                </ScreenSection>
              );
            })}

            {showUnassigned && course.unassigned && (
              <ScreenSection
                title="Course Orientation & General"
                subtitle="Course-wide sessions and announcements not tied to a single subject"
              >
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {course.unassigned.lectures.map((item) => {
                    const meta = metaOf(item);
                    return (
                      <Link
                        key={item.id}
                        href={`/lectures/${item.id}`}
                        className="ec-card ec-card-interactive flex flex-col overflow-hidden"
                      >
                        <YoutubeThumbnail
                          src={customThumbOf(item)}
                          videoId={String(meta.videoId || '')}
                          alt={item.title}
                          duration={meta.duration ? String(meta.duration) : null}
                          badge="General"
                          className="aspect-video w-full"
                        />
                        <div className="p-3.5">
                          <h3 className="line-clamp-2 text-sm font-bold text-ink-900">{item.title}</h3>
                          <p className="mt-1 text-xs text-ink-500">Course-level session</p>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </ScreenSection>
            )}

            {courseFiles.length > 0 && (
              <ScreenSection
                title="Course Study Material (PDFs)"
                subtitle="Private Google Drive handouts verified for enrolled students"
              >
                <div className="grid gap-2.5 sm:grid-cols-2">
                  {courseFiles.map((file) => (
                    <button
                      key={file.id}
                      type="button"
                      onClick={() => void openPrivatePdf(file.id, file.displayName)}
                      className="flex items-center justify-between gap-3 rounded-xl border border-ink-100 bg-[var(--ec-surface)] px-4 py-3 text-left transition hover:border-brand-200 hover:bg-brand-50/40"
                    >
                      <span className="flex min-w-0 items-center gap-2.5">
                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700">
                          <FileText size={15} />
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-xs font-bold text-ink-900">{file.displayName}</span>
                          <span className="block text-[11px] text-ink-500">
                            {file.sizeBytes ? `${Math.max(1, Math.round(file.sizeBytes / 1024))} KB · ` : ''}
                            Secured PDF
                          </span>
                        </span>
                      </span>
                      <span className="shrink-0 text-xs font-semibold text-brand-700">View</span>
                    </button>
                  ))}
                </div>
              </ScreenSection>
            )}
          </div>
        )}

        {/* Enrollment Modal */}
        {enrollModalOpen && (
          <div
            className="fixed inset-0 z-[95] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-label={`Enroll in ${course.parent.title}`}
          >
            <div className="w-full max-w-md ec-card shadow-2xl">
              <div className="flex items-start justify-between gap-3 border-b border-ink-100 px-5 py-4">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-brand-700">
                    Course Enrollment
                  </p>
                  <h2 className="mt-0.5 text-base font-bold text-ink-900">{course.parent.title}</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setEnrollModalOpen(false)}
                  aria-label="Close enrollment dialog"
                  className="grid h-8 w-8 place-items-center rounded-lg text-ink-500 hover:bg-ink-100"
                >
                  <X size={16} />
                </button>
              </div>
              <form onSubmit={handleCourseEnroll} className="space-y-4 px-5 py-4">
                <p className="text-xs leading-relaxed text-ink-600">
                  {requiresCode
                    ? 'Enter the batch access code shared by your faculty to unlock all subjects, lectures, and PDF notes.'
                    : 'Confirm enrollment to add this course to your study dashboard and unlock all subjects.'}
                </p>
                {requiresCode && (
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-semibold text-ink-700">
                      Access Code <span className="text-red-500">*</span>
                    </span>
                    <input
                      className="ec-field font-mono"
                      value={accessCode}
                      onChange={(e) => setAccessCode(e.target.value)}
                      placeholder="Enter access code"
                      autoFocus
                      required
                    />
                  </label>
                )}
                {enrollError && (
                  <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                    {enrollError}
                  </p>
                )}
                <div className="flex justify-end gap-2 border-t border-ink-100 pt-3">
                  <Button type="button" variant="outline" size="sm" onClick={() => setEnrollModalOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" size="sm" loading={enrolling}>
                    {requiresCode ? 'Verify & Enroll' : 'Confirm Enrollment'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {pdfOpen && (
          <div className="fixed inset-0 z-[95] overflow-y-auto bg-slate-950/65 p-3 sm:p-6" role="dialog" aria-modal="true">
            <div className="mx-auto w-full max-w-5xl overflow-hidden rounded-2xl bg-white shadow-2xl">
              <div className="flex items-center justify-between gap-3 border-b border-ink-100 px-4 py-3">
                <p className="truncate text-sm font-bold text-ink-900">{pdfTitle}</p>
                <div className="flex shrink-0 items-center gap-2">
                  {pdfUrl && (
                    <a
                      href={pdfUrl}
                      download={pdfTitle.endsWith('.pdf') ? pdfTitle : `${pdfTitle}.pdf`}
                      className="ec-btn border border-ink-200 px-2.5 py-1.5 text-[11px] font-semibold"
                    >
                      <Download size={12} className="mr-1 inline" /> Download
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={closePdf}
                    aria-label="Close PDF"
                    className="grid h-8 w-8 place-items-center rounded-lg text-ink-500 hover:bg-ink-100"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
              {pdfLoading && <p className="p-6 text-sm text-ink-500">Loading secured PDF…</p>}
              {pdfUrl && <iframe src={pdfUrl} title={pdfTitle} className="h-[75vh] w-full" />}
              {!pdfLoading && !pdfUrl && pdfError && <p className="p-6 text-sm text-red-700">{pdfError}</p>}
            </div>
          </div>
        )}
      </div>
    );
  }

  if (!lecture) return null;

  const meta = metaOf(lecture);
  const videoId = String(meta.videoId || '');
  const youtubeUrl = String(meta.youtubeUrl || '');
  const notesFileId = String(meta.notesFileId || '');
  const notesFileName = String(meta.notesFileName || '');
  const notesPdfUrl = String(meta.notesPdfUrl || '');
  const parentId = lecture.parentId || String(meta.parentId || '');
  const embedUrl = videoId
    ? getYoutubeEmbedUrl(videoId, { enableJsApi: true, startSeconds: resumeStartSeconds })
    : '';

  // ---------------------------------------------------------------------------
  // Study Resource (PDF / Notes) Detail View
  // ---------------------------------------------------------------------------
  if (lecture.kind === 'resource') {
    const resourceFileId = String(meta.notesFileId || meta.driveFileId || '');
    const externalUrl = String(meta.pdfUrl || meta.notesPdfUrl || '');
    return (
      <div className="mx-auto max-w-3xl space-y-5">
        <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-xs font-medium text-ink-500">
          <Link href="/lectures" className="font-semibold text-brand-700 hover:underline">
            {screen.backLabel || 'Lectures & Courses'}
          </Link>
          {parentCourse && (
            <>
              <ChevronRight size={13} aria-hidden />
              <Link href={`/lectures/${parentCourse.id}`} className="font-semibold text-brand-700 hover:underline">
                {parentCourse.title}
              </Link>
            </>
          )}
          {subjectLabel && (
            <>
              <ChevronRight size={13} aria-hidden />
              <span>{subjectLabel}</span>
            </>
          )}
        </nav>

        <Card className="p-5 sm:p-6">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-brand-700">Study Resource</p>
          <h1 className="mt-1 text-xl font-bold text-ink-900 sm:text-2xl">{lecture.title}</h1>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-600">
            {lecture.description || 'Downloadable notes and reference material for your preparation.'}
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <Badge variant="info">{lecture.exam}</Badge>
            <Badge variant="default">{formatClassList(lecture.classes)}</Badge>
            {subjectLabel && <Badge variant="default">{subjectLabel}</Badge>}
          </div>
          <div className="mt-5">
            {resourceFileId ? (
              <Button size="sm" loading={pdfLoading} onClick={() => void openPrivatePdf(resourceFileId, lecture.title)}>
                <FileText size={14} className="mr-1.5" /> Open Secured PDF
              </Button>
            ) : externalUrl && isSafeHttpUrl(externalUrl) ? (
              <a
                href={externalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="ec-btn inline-flex items-center gap-1.5 bg-brand-600 px-4 py-2 text-xs font-semibold text-white"
              >
                Open Resource <ExternalLink size={13} />
              </a>
            ) : (
              <p className="rounded-xl border border-dashed border-ink-200 px-4 py-3 text-xs text-ink-500">
                No PDF document has been attached to this resource yet.
              </p>
            )}
          </div>
          {pdfError && (
            <p role="alert" className="mt-3 text-xs font-semibold text-red-700">
              {pdfError}
            </p>
          )}
        </Card>

        {pdfOpen && (
          <div className="fixed inset-0 z-[95] overflow-y-auto bg-slate-950/65 p-3 sm:p-6" role="dialog" aria-modal="true">
            <div className="mx-auto w-full max-w-5xl overflow-hidden rounded-2xl bg-white shadow-2xl">
              <div className="flex items-center justify-between gap-3 border-b border-ink-100 px-4 py-3">
                <p className="truncate text-sm font-bold">{lecture.title}</p>
                <div className="flex shrink-0 items-center gap-2">
                  {pdfUrl && (
                    <a
                      href={pdfUrl}
                      download={`${lecture.title}.pdf`}
                      className="ec-btn border border-ink-200 px-2.5 py-1.5 text-[11px] font-semibold"
                    >
                      <Download size={12} className="mr-1 inline" /> Download
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={closePdf}
                    aria-label="Close PDF"
                    className="grid h-8 w-8 place-items-center rounded-lg text-ink-500 hover:bg-ink-100"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
              {pdfLoading && <p className="p-6 text-sm text-ink-500">Loading secured PDF…</p>}
              {pdfUrl && <iframe src={pdfUrl} title={lecture.title} className="h-[75vh] w-full" />}
              {!pdfLoading && !pdfUrl && pdfError && <p className="p-6 text-sm text-red-700">{pdfError}</p>}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Lecture Video Player + Strict Subject-Isolated Queue View
  // ---------------------------------------------------------------------------
  const currentPercent = lectureCompletionPercent(
    lecture as CourseCatalogItem<LectureMetadata>,
    watched,
    completed
  );
  const positionLabel =
    resolvedQueue.currentIndex >= 0 && resolvedQueue.queue.length > 0
      ? `Lecture ${resolvedQueue.currentIndex + 1} of ${resolvedQueue.queue.length}`
      : null;

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      {/* Structured Breadcrumb */}
      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-xs font-medium text-ink-500">
        <Link href="/lectures" className="font-semibold text-brand-700 hover:underline">
          {screen.backLabel || 'Lectures & Courses'}
        </Link>
        {parentCourse && (
          <>
            <ChevronRight size={13} aria-hidden />
            <Link
              href={`/lectures/${parentCourse.id}`}
              className="max-w-[220px] truncate font-semibold text-brand-700 hover:underline"
            >
              {parentCourse.title}
            </Link>
          </>
        )}
        {subjectLabel && (
          <>
            <ChevronRight size={13} aria-hidden />
            <span className="font-semibold text-ink-700">{subjectLabel}</span>
          </>
        )}
      </nav>

      <ScreenAnnouncementBanner announcement={screen.announcement} />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
        {/* Primary Player & Metadata Column */}
        <div className="min-w-0 space-y-5">
          <Card className="overflow-hidden">
            {/* True 16:9 Responsive Video Stage */}
            <div className="relative aspect-video w-full bg-slate-950">
              {embedUrl ? (
                <iframe
                  ref={iframeRef}
                  key={`${lecture.id}:${videoId}`}
                  src={embedUrl}
                  title={lecture.title}
                  onLoad={bindYoutubeHandshake}
                  className="h-full w-full border-0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                  allowFullScreen
                />
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center text-white">
                  <BookOpen size={28} className="text-slate-400" />
                  <p className="text-sm font-semibold">Video stream not attached yet</p>
                  {youtubeUrl && isSafeHttpUrl(youtubeUrl) && (
                    <a
                      href={youtubeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 inline-flex items-center gap-1 rounded-lg bg-white/15 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/25"
                    >
                      Open on YouTube <ExternalLink size={12} />
                    </a>
                  )}
                </div>
              )}

              {/* Subject-Isolated Autoplay Countdown Overlay */}
              {autoplayCountdown !== null && nextLecture && (
                <div
                  role="status"
                  aria-live="polite"
                  className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-950/90 p-5 text-center text-white backdrop-blur-sm"
                >
                  <span className="rounded-full border border-blue-400/30 bg-blue-500/20 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-blue-200">
                    Up Next in {subjectLabel || 'Same Subject'} · {autoplayCountdown}s
                  </span>
                  <h2 className="mt-3 max-w-lg text-base font-bold sm:text-lg">{nextLecture.title}</h2>
                  <div className="mt-4 flex flex-wrap items-center justify-center gap-2.5">
                    <Link
                      href={`/lectures/${nextLecture.id}`}
                      onClick={() => setAutoplayCountdown(null)}
                      className="ec-btn inline-flex items-center gap-1.5 bg-brand-600 px-4 py-2 text-xs font-bold text-white hover:bg-brand-700"
                    >
                      <Play size={13} /> Play Now
                    </Link>
                    <button
                      type="button"
                      onClick={() => setAutoplayCountdown(null)}
                      className="ec-btn border border-white/25 bg-white/10 px-4 py-2 text-xs font-semibold text-white hover:bg-white/20"
                    >
                      Stay on this lecture
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Lecture Details, Progress & Subject Navigation Controls */}
            <div className="space-y-4 p-4 sm:p-6">
              <div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {subjectLabel && <Badge variant="info">{subjectLabel}</Badge>}
                  {positionLabel && <Badge variant="default">{positionLabel}</Badge>}
                  <Badge variant="default">{lecture.exam}</Badge>
                  <Badge variant="default">{formatClassList(lecture.classes)}</Badge>
                  {Boolean(meta.topic) && <Badge variant="default">{String(meta.topic)}</Badge>}
                  {Boolean(meta.duration) && (
                    <Badge variant="default">
                      <Clock size={11} className="mr-1 inline" />
                      {String(meta.duration)}
                    </Badge>
                  )}
                  {completed && (
                    <Badge variant="success">
                      <CheckCircle2 size={11} className="mr-1 inline" /> Completed
                    </Badge>
                  )}
                </div>

                <h1 className="mt-2.5 text-lg font-bold leading-snug text-ink-900 sm:text-xl">
                  {lecture.title}
                </h1>
                {lecture.description && (
                  <p className="mt-1.5 text-sm leading-relaxed text-ink-600">{lecture.description}</p>
                )}
              </div>

              {/* Watch Progress Bar */}
              <div className="rounded-xl border border-ink-100 bg-ink-50/60 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="font-semibold text-ink-700">
                    Watch time: <span className="tabular-nums text-ink-900">{formatWatchDuration(watched)}</span>
                    {resumeStartSeconds >= 10 && !completed && (
                      <span className="ml-2 text-[11px] font-normal text-ink-500">
                        (Resumed at {formatWatchDuration(resumeStartSeconds)})
                      </span>
                    )}
                  </span>
                  <span className="font-semibold tabular-nums text-brand-700">{currentPercent}%</span>
                </div>
                <div className="ec-progress mt-2">
                  <span style={{ width: `${currentPercent}%` }} />
                </div>
              </div>

              {/* Primary Lecture Actions */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink-100 pt-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    variant={completed ? 'outline' : 'primary'}
                    loading={saving}
                    onClick={() => void saveProgressManual(!completed)}
                  >
                    <CheckCircle2 size={14} className="mr-1.5" />
                    {completed ? screen.markIncompleteLabel : screen.markCompleteLabel}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    loading={saving}
                    onClick={() => void saveProgressManual()}
                  >
                    {screen.saveProgressLabel}
                  </Button>
                  {notesFileId ? (
                    <Button
                      size="sm"
                      variant="outline"
                      loading={pdfLoading}
                      onClick={() => void openPrivatePdf(notesFileId, notesFileName || screen.notesTitle)}
                    >
                      <FileText size={14} className="mr-1.5" /> Lecture Notes (PDF)
                    </Button>
                  ) : notesPdfUrl && isSafeHttpUrl(notesPdfUrl) ? (
                    <a
                      href={notesPdfUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ec-btn inline-flex items-center gap-1.5 border border-ink-200 bg-[var(--ec-surface)] px-3 py-2 text-xs font-semibold text-ink-700 hover:bg-ink-50"
                    >
                      <FileText size={14} /> Lecture Notes <ExternalLink size={12} />
                    </a>
                  ) : null}
                </div>

                {/* Subject-Isolated Previous / Next Controls */}
                <div className="flex flex-wrap items-center gap-2">
                  {previousLecture ? (
                    <Link
                      href={`/lectures/${previousLecture.id}`}
                      title={`Previous in ${subjectLabel || 'subject'}: ${previousLecture.title}`}
                      className="ec-btn inline-flex items-center gap-1.5 border border-ink-200 bg-[var(--ec-surface)] px-3.5 py-2 text-xs font-semibold text-ink-800 hover:bg-ink-50"
                    >
                      <ArrowLeft size={14} /> {screen.previousLabel}
                    </Link>
                  ) : (
                    <span
                      aria-disabled="true"
                      className="ec-btn inline-flex cursor-not-allowed items-center gap-1.5 border border-ink-100 bg-ink-50 px-3.5 py-2 text-xs font-semibold text-ink-400"
                    >
                      <ArrowLeft size={14} /> {screen.previousLabel}
                    </span>
                  )}

                  {nextLecture ? (
                    <Link
                      href={`/lectures/${nextLecture.id}`}
                      title={`Next in ${subjectLabel || 'subject'}: ${nextLecture.title}`}
                      className="ec-btn inline-flex items-center gap-1.5 bg-brand-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-brand-700"
                    >
                      {screen.nextLabel} <ArrowRight size={14} />
                    </Link>
                  ) : (
                    <span
                      aria-disabled="true"
                      className="ec-btn inline-flex cursor-not-allowed items-center gap-1.5 border border-ink-100 bg-ink-50 px-3.5 py-2 text-xs font-semibold text-ink-400"
                    >
                      {screen.nextLabel} <ArrowRight size={14} />
                    </span>
                  )}
                </div>
              </div>

              {pdfError && (
                <p role="alert" className="text-xs font-semibold text-red-700">
                  {pdfError}
                </p>
              )}
            </div>
          </Card>

          {screen.showNotes && !notesFileId && notesPdfUrl && isSafeHttpUrl(notesPdfUrl) && (
            <Card className="overflow-hidden">
              <div className="flex items-center justify-between border-b border-ink-100 bg-ink-50 px-4 py-2.5 text-xs font-semibold">
                <span>{screen.notesTitle}</span>
                <a
                  href={notesPdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-brand-700 hover:underline"
                >
                  Open in new tab <ExternalLink size={12} />
                </a>
              </div>
              <iframe src={notesPdfUrl} title={screen.notesTitle} className="h-[480px] w-full" />
            </Card>
          )}

          {/* Related Lectures in Exact Same Subject */}
          {screen.showRelated && (
            <ScreenSection
              title={subjectLabel ? `More in ${subjectLabel}` : screen.relatedTitle}
              subtitle={
                subjectLabel
                  ? `Filtered strictly to ${subjectLabel}${parentCourse ? ` · ${parentCourse.title}` : ''}`
                  : 'Subject-matched lectures'
              }
            >
              {resolvedQueue.related.length > 0 ? (
                <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
                  {resolvedQueue.related.map((item) => {
                    const itemMeta = metaOf(item);
                    const pct = lectureCompletionPercent(
                      item as CourseCatalogItem<LectureMetadata>,
                      item.progress?.watchedSeconds,
                      item.progress?.completed
                    );
                    return (
                      <Link
                        key={item.id}
                        href={`/lectures/${item.id}`}
                        className="ec-card ec-card-interactive group flex flex-col overflow-hidden"
                      >
                        <YoutubeThumbnail
                          src={customThumbOf(item)}
                          videoId={String(itemMeta.videoId || '')}
                          alt={item.title}
                          duration={itemMeta.duration ? String(itemMeta.duration) : null}
                          subjectName={subjectLabel}
                          progressPercent={pct}
                          completed={item.progress?.completed}
                          className="aspect-video w-full"
                        />
                        <div className="p-3">
                          <p className="line-clamp-2 text-xs font-bold leading-snug text-ink-900 group-hover:text-brand-700">
                            {item.title}
                          </p>
                          {itemMeta.topic ? (
                            <p className="mt-1 truncate text-[11px] text-ink-500">{String(itemMeta.topic)}</p>
                          ) : null}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-ink-200 bg-[var(--ec-surface)] px-4 py-6 text-center text-xs text-ink-500">
                  {resolvedQueue.reason === 'missing_subject'
                    ? 'This lecture is not assigned to a subject yet, so cross-subject suggestions are hidden to keep your queue focused.'
                    : `No other lectures are published in ${subjectLabel || 'this subject'} right now.`}
                </div>
              )}
            </ScreenSection>
          )}

          {screen.progressNote && (
            <ScreenHelpNote help={{ title: screen.help.title || 'Study Tips', body: screen.progressNote }} />
          )}
        </div>

        {/* Sticky Subject-Isolated Up Next & Playlist Sidebar */}
        {screen.showRelated && (
          <aside className="space-y-4 lg:sticky lg:top-20" aria-label="Subject playback queue">
            {/* Up Next + Autoplay Card */}
            <Card className="p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <SkipForward size={15} className="text-brand-600" />
                  <h2 className="text-xs font-bold uppercase tracking-wider text-ink-700">
                    Up Next {subjectLabel ? `· ${subjectLabel}` : ''}
                  </h2>
                </div>
                <label className="inline-flex cursor-pointer items-center gap-2 text-[11px] font-semibold text-ink-600">
                  <span>Autoplay</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={autoplayEnabled}
                    aria-label="Toggle autoplay next lecture in this subject"
                    onClick={() => toggleAutoplay(!autoplayEnabled)}
                    className={`relative h-5 w-9 rounded-full transition ${
                      autoplayEnabled ? 'bg-brand-600' : 'bg-ink-300'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${
                        autoplayEnabled ? 'left-[18px]' : 'left-0.5'
                      }`}
                    />
                  </button>
                </label>
              </div>

              {nextLecture ? (
                <Link
                  href={`/lectures/${nextLecture.id}`}
                  className="mt-3 flex gap-3 rounded-xl border border-ink-100 bg-ink-50/60 p-2.5 transition hover:border-brand-200 hover:bg-brand-50/40"
                >
                  <YoutubeThumbnail
                    src={customThumbOf(nextLecture)}
                    videoId={String(metaOf(nextLecture).videoId || '')}
                    alt={nextLecture.title}
                    duration={metaOf(nextLecture).duration ? String(metaOf(nextLecture).duration) : null}
                    className="aspect-video w-28 shrink-0 rounded-lg"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-brand-700">
                      Lecture {resolvedQueue.currentIndex + 2} of {resolvedQueue.queue.length}
                    </p>
                    <p className="mt-0.5 line-clamp-2 text-xs font-bold leading-snug text-ink-900">
                      {nextLecture.title}
                    </p>
                    {subjectLabel && (
                      <p className="mt-1 truncate text-[11px] text-ink-500">{subjectLabel}</p>
                    )}
                  </div>
                </Link>
              ) : (
                <div className="mt-3 rounded-xl border border-dashed border-ink-200 bg-ink-50/50 p-3 text-xs text-ink-600">
                  {resolvedQueue.reason === 'missing_subject' ? (
                    <p>No subject queue available — this lecture has not been linked to a subject.</p>
                  ) : (
                    <div className="flex items-start gap-2">
                      <Sparkles size={15} className="mt-0.5 shrink-0 text-emerald-600" />
                      <div>
                        <p className="font-semibold text-ink-800">
                          End of {subjectLabel || 'subject'} queue
                        </p>
                        <p className="mt-0.5 text-[11px] text-ink-500">
                          Autoplay stops here so you never jump unexpectedly into another subject.
                        </p>
                        {parentCourse && (
                          <Link
                            href={`/lectures/${parentCourse.id}`}
                            className="mt-1.5 inline-block font-semibold text-brand-700 hover:underline"
                          >
                            Back to {parentCourse.title} syllabus →
                          </Link>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </Card>

            {/* Full Ordered Subject Playlist */}
            <Card className="overflow-hidden">
              <div className="flex items-center justify-between gap-2 border-b border-ink-100 px-4 py-3">
                <div className="min-w-0">
                  <h2 className="flex items-center gap-1.5 truncate text-sm font-bold text-ink-900">
                    <ListVideo size={16} className="shrink-0 text-brand-600" />
                    <span className="truncate">
                      {subjectLabel ? `${subjectLabel} Queue` : screen.relatedTitle}
                    </span>
                  </h2>
                  {parentCourse && (
                    <p className="truncate text-[11px] text-ink-500">{parentCourse.title}</p>
                  )}
                </div>
                <Badge variant="default">{resolvedQueue.queue.length}</Badge>
              </div>

              {resolvedQueue.queue.length > 0 ? (
                <div className="max-h-[60vh] divide-y divide-ink-100/80 overflow-y-auto">
                  {resolvedQueue.queue.map((queueItem, idx) => {
                    const isCurrent = queueItem.id === lecture.id;
                    const itemMeta = metaOf(queueItem);
                    const isDone = isCurrent ? completed : Boolean(queueItem.progress?.completed);
                    const pct = isCurrent
                      ? currentPercent
                      : lectureCompletionPercent(
                          queueItem as CourseCatalogItem<LectureMetadata>,
                          queueItem.progress?.watchedSeconds,
                          queueItem.progress?.completed
                        );

                    return (
                      <Link
                        key={queueItem.id}
                        href={`/lectures/${queueItem.id}`}
                        aria-current={isCurrent ? 'page' : undefined}
                        className={`flex items-start gap-2.5 p-3 transition ${
                          isCurrent
                            ? 'bg-brand-50/80'
                            : 'hover:bg-ink-50/70'
                        }`}
                      >
                        <span
                          className={`mt-1 grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-bold tabular-nums ${
                            isCurrent
                              ? 'bg-brand-600 text-white'
                              : isDone
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-ink-100 text-ink-600'
                          }`}
                        >
                          {isDone && !isCurrent ? '✓' : idx + 1}
                        </span>

                        <YoutubeThumbnail
                          src={customThumbOf(queueItem)}
                          videoId={String(itemMeta.videoId || '')}
                          alt={queueItem.title}
                          duration={itemMeta.duration ? String(itemMeta.duration) : null}
                          progressPercent={pct}
                          className="aspect-video w-24 shrink-0 rounded-lg"
                        />

                        <div className="min-w-0 flex-1">
                          <p
                            className={`line-clamp-2 text-xs font-semibold leading-snug ${
                              isCurrent ? 'text-brand-800' : 'text-ink-900'
                            }`}
                          >
                            {queueItem.title}
                          </p>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-ink-500">
                            {isCurrent ? (
                              <span className="font-bold text-brand-700">Now playing</span>
                            ) : isDone ? (
                              <span className="font-semibold text-emerald-700">Completed</span>
                            ) : pct > 0 ? (
                              <span>{pct}% watched</span>
                            ) : (
                              <span>{subjectLabel || 'Lecture'}</span>
                            )}
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <div className="p-5 text-center text-xs text-ink-500">
                  {resolvedQueue.reason === 'missing_subject'
                    ? 'Assign a subject to this lecture to display its ordered subject playlist.'
                    : `${screen.relatedEmptyTitle} ${screen.relatedEmptyBody}`}
                </div>
              )}
            </Card>
          </aside>
        )}
      </div>

      {/* Secured Private Drive PDF Modal */}
      {pdfOpen && (
        <div className="fixed inset-0 z-[95] overflow-y-auto bg-slate-950/65 p-3 sm:p-6" role="dialog" aria-modal="true">
          <div className="mx-auto w-full max-w-5xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between gap-3 border-b border-ink-100 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-ink-900">{pdfTitle || notesFileName || screen.notesTitle}</p>
                <p className="text-[11px] text-ink-500">
                  Private Google Drive document · verified for your signed-in account
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {pdfUrl && (
                  <>
                    <a
                      href={pdfUrl}
                      download={notesFileName || `${lecture.title}.pdf`}
                      className="ec-btn border border-ink-200 px-2.5 py-1.5 text-[11px] font-semibold"
                    >
                      <Download size={12} className="mr-1 inline" /> Download
                    </a>
                    <a
                      href={pdfUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ec-btn border border-ink-200 px-2.5 py-1.5 text-[11px] font-semibold"
                    >
                      <ExternalLink size={12} className="mr-1 inline" /> New tab
                    </a>
                  </>
                )}
                <button
                  type="button"
                  onClick={closePdf}
                  aria-label="Close PDF"
                  className="grid h-8 w-8 place-items-center rounded-lg text-ink-500 hover:bg-ink-100"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
            {pdfLoading && <p className="p-6 text-sm text-ink-500">Loading secured PDF…</p>}
            {pdfUrl && <iframe src={pdfUrl} title={pdfTitle || screen.notesTitle} className="h-[75vh] w-full" />}
            {!pdfLoading && !pdfUrl && pdfError && <p className="p-6 text-sm text-red-700">{pdfError}</p>}
          </div>
        </div>
      )}
    </div>
  );
}

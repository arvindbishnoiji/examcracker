'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Download, ExternalLink, FileText, Layers, Lock, PlayCircle, X } from 'lucide-react';
import { ApiError, fetchAuthorizedBlob, getCatalogItem, getCourseTree, saveLessonProgress } from '@/lib/api';
import { Card, Badge, Skeleton } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/hooks/useToast';
import { getYoutubeEmbedUrl } from '@/lib/mediaProxy';
import { isSafeHttpUrl } from '@/lib/validation';
import type { CourseCatalogItem, CourseTreeResponse, CourseTreeSubject } from '@/types';
import { useSiteConfig } from '@/context/SiteConfigContext';
import { ScreenAnnouncementBanner, ScreenHelpNote } from '@/components/student/ScreenScaffold';

function metaOf(item: CourseCatalogItem | null): Record<string, unknown> {
  return (item?.metadata || {}) as Record<string, unknown>;
}

function thumbOf(item: CourseCatalogItem): string {
  const meta = metaOf(item);
  const candidate = String(meta.thumbnailUrl || meta.thumbnail_url || '');
  if (isSafeHttpUrl(candidate)) return candidate;
  if (meta.videoId) return `https://img.youtube.com/vi/${String(meta.videoId)}/hqdefault.jpg`;
  return '';
}

function orderOf(item: CourseCatalogItem): number {
  return Number(item.sortOrder || 0) || Number(metaOf(item).position || 0) || 0;
}

type FlatEntry = { item: CourseCatalogItem; subjectId: string | null; subjectName: string | null };

function flattenTree(tree: CourseTreeResponse): FlatEntry[] {
  const rows: FlatEntry[] = [];
  const push = (subject: CourseTreeSubject) => {
    [...subject.lectures, ...subject.resources]
      .sort((a, b) => orderOf(a) - orderOf(b))
      .forEach((item) => rows.push({ item, subjectId: subject.id, subjectName: subject.name }));
  };
  tree.subjects.forEach(push);
  if (tree.unassigned) {
    [...tree.unassigned.lectures, ...tree.unassigned.resources]
      .sort((a, b) => orderOf(a) - orderOf(b))
      .forEach((item) => rows.push({ item, subjectId: null, subjectName: null }));
  }
  return rows;
}

export default function LectureDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const { push } = useToast();
  const { config } = useSiteConfig();
  const screen = config.lecturePlayer;

  const [lecture, setLecture] = useState<CourseCatalogItem | null>(null);
  const [course, setCourse] = useState<CourseTreeResponse | null>(null);
  const [subjectName, setSubjectName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [watched, setWatched] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeSubject, setActiveSubject] = useState('all');
  const [pdfOpen, setPdfOpen] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const pdfUrlRef = useRef<string | null>(null);
  const tickRef = useRef<number | null>(null);
  const saveRef = useRef<number | null>(null);

  const releasePdf = useCallback(() => {
    if (pdfUrlRef.current) URL.revokeObjectURL(pdfUrlRef.current);
    pdfUrlRef.current = null;
    setPdfUrl(null);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { item } = await getCatalogItem(id);
      if (item.kind === 'batch' || item.kind === 'series') {
        const tree = await getCourseTree(item.id);
        setCourse(tree);
        setLecture(null);
        setSubjectName(null);
        return;
      }
      setLecture(item);
      const parentId = item.parentId || String(metaOf(item).parentId || '');
      if (parentId) {
        try {
          const tree = await getCourseTree(parentId);
          setCourse(tree);
          const match = flattenTree(tree).find((row) => row.item.id === item.id);
          setSubjectName(match?.subjectName || null);
        } catch {
          setCourse(null);
        }
      } else {
        setCourse(null);
      }
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) {
        setError('This lecture is no longer published. Ask your mentor or pick another lesson.');
      } else if (e instanceof ApiError && e.status === 403) {
        setError(e.message);
      } else {
        setError(e instanceof Error ? e.message : 'This page could not be loaded.');
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!lecture || lecture.kind !== 'lecture') return;
    tickRef.current = window.setInterval(() => setWatched((value) => value + 1), 1000);
    return () => {
      if (tickRef.current) window.clearInterval(tickRef.current);
    };
  }, [lecture]);

  useEffect(() => {
    if (!lecture || lecture.kind !== 'lecture' || watched === 0) return;
    if (saveRef.current) window.clearTimeout(saveRef.current);
    saveRef.current = window.setTimeout(() => {
      void saveLessonProgress({ lectureId: lecture.id, watchedSeconds: watched, completed }).catch(() => {
        /* autosave is best-effort; the manual button reports errors */
      });
    }, 5000);
    return () => {
      if (saveRef.current) window.clearTimeout(saveRef.current);
    };
  }, [watched, completed, lecture]);

  useEffect(() => releasePdf, [releasePdf]);

  const siblings = useMemo(() => (course ? flattenTree(course) : []), [course]);
  const index = siblings.findIndex((row) => row.item.id === lecture?.id);
  const previous = index > 0 ? siblings[index - 1] : null;
  const next = index >= 0 && index < siblings.length - 1 ? siblings[index + 1] : null;

  async function saveProgress() {
    if (!lecture || lecture.kind !== 'lecture') return;
    setSaving(true);
    try {
      await saveLessonProgress({ lectureId: lecture.id, watchedSeconds: watched, completed });
      push('Progress saved.', 'success');
    } catch (e) {
      push(e instanceof Error ? e.message : 'Progress could not be saved.', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function openPrivatePdf(fileId: string) {
    setPdfError(null);
    setPdfLoading(true);
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

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl space-y-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-2xl">
        <Card className="p-6 text-center">
          <p className="font-semibold">{error}</p>
          <p className="mt-1 text-sm text-ink-500">Access is checked on the server from your signed-in account.</p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Button variant="outline" onClick={() => router.back()}>
              Go back
            </Button>
            <Button onClick={() => void load()}>Try again</Button>
            <Link href="/lectures" className="ec-btn border border-ink-200 px-4 py-2 text-sm font-semibold">
              All lectures
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Course view: Batch / Series → Subjects → Lectures & resources
  // ---------------------------------------------------------------------------
  if (!lecture && course) {
    const subjects = course.subjects;
    const visible =
      activeSubject === 'all' ? subjects : activeSubject === 'general' ? [] : subjects.filter((s) => s.id === activeSubject);
    const showUnassigned = (activeSubject === 'all' || activeSubject === 'general') && !!course.unassigned;
    const totalLectures = subjects.reduce((sum, subject) => sum + subject.lectures.length, 0);
    const totalResources = subjects.reduce((sum, subject) => sum + subject.resources.length, 0);
    const isEmpty = subjects.length === 0 && !course.unassigned;

    return (
      <div className="mx-auto max-w-6xl space-y-4">
        <Link href="/lectures" className="text-sm font-semibold text-brand-700 hover:underline">
          ← {screen.backLabel}
        </Link>
        <ScreenAnnouncementBanner announcement={screen.announcement} />

        <Card className="overflow-hidden">
          {thumbOf(course.parent) && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={thumbOf(course.parent)} alt="" className="h-40 w-full object-cover sm:h-56" />
          )}
          <div className="p-4 sm:p-5">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-brand-700">{course.parent.kind}</p>
            <h1 className="text-xl font-extrabold sm:text-2xl">{course.parent.title}</h1>
            <p className="mt-1 text-sm text-ink-500">{course.parent.description || 'No description added yet.'}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Badge variant="info">{course.parent.exam}</Badge>
              <Badge variant="default">Class {course.parent.classes.join(' / ')}</Badge>
              <Badge variant={course.enrolled ? 'success' : 'warning'}>
                {course.enrolled ? 'Enrolled' : 'Preview only'}
              </Badge>
              <Badge variant="default">{totalLectures} lectures</Badge>
              {totalResources > 0 && <Badge variant="default">{totalResources} resources</Badge>}
            </div>
            {!course.enrolled && (
              <p className="mt-3 flex items-start gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] font-medium text-amber-900">
                <Lock size={13} className="mt-0.5 shrink-0" />
                {course.previewCount > 0
                  ? `${course.previewCount} free preview${course.previewCount === 1 ? '' : 's'} unlocked. Enroll to open every subject.`
                  : 'Enroll in this batch or series to unlock its lessons.'}
              </p>
            )}
          </div>
        </Card>

        {subjects.length > 0 && (
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by subject">
            <button
              type="button"
              aria-pressed={activeSubject === 'all'}
              onClick={() => setActiveSubject('all')}
              className={`ec-btn border px-3 py-1.5 text-xs font-bold ${
                activeSubject === 'all' ? 'border-ink-900 bg-ink-900 text-white' : 'border-ink-200 text-ink-700'
              }`}
            >
              All subjects
            </button>
            {subjects.map((subject) => (
              <button
                key={subject.id}
                type="button"
                aria-pressed={activeSubject === subject.id}
                onClick={() => setActiveSubject(subject.id)}
                className={`ec-btn border px-3 py-1.5 text-xs font-bold ${
                  activeSubject === subject.id ? 'border-brand-600 bg-brand-600 text-white' : 'border-ink-200 text-ink-700'
                }`}
              >
                {subject.name} · {subject.lectures.length}
              </button>
            ))}
            {course.unassigned && (
              <button
                type="button"
                aria-pressed={activeSubject === 'general'}
                onClick={() => setActiveSubject('general')}
                className={`ec-btn border px-3 py-1.5 text-xs font-bold ${
                  activeSubject === 'general' ? 'border-ink-900 bg-ink-900 text-white' : 'border-ink-200 text-ink-700'
                }`}
              >
                General · {course.unassigned.lectures.length + course.unassigned.resources.length}
              </button>
            )}
          </div>
        )}

        {isEmpty ? (
          <Card className="p-8 text-center">
            <Layers className="mx-auto text-ink-300" size={26} />
            <p className="mt-2 text-sm font-bold">No lectures published yet</p>
            <p className="mt-1 text-xs text-ink-500">
              This {course.parent.kind} has no subjects assigned yet. Your mentor is still setting it up — check back
              soon.
            </p>
          </Card>
        ) : (
          <div className="space-y-5">
            {visible.map((subject) => (
              <section key={subject.id} aria-labelledby={`subject-${subject.id}`}>
                <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                  <h2 id={`subject-${subject.id}`} className="text-base font-bold">
                    {subject.name}
                  </h2>
                  <p className="text-[11px] text-ink-500">
                    {subject.lectures.length} lecture{subject.lectures.length === 1 ? '' : 's'} ·{' '}
                    {subject.resources.length} resource{subject.resources.length === 1 ? '' : 's'}
                  </p>
                </div>
                {subject.description && <p className="mb-2 text-xs text-ink-500">{subject.description}</p>}
                {subject.lectures.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-ink-200 px-4 py-4 text-center text-xs text-ink-500">
                    No lectures in {subject.name} yet.
                  </p>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {[...subject.lectures]
                      .sort((a, b) => orderOf(a) - orderOf(b))
                      .map((item) => {
                        const meta = metaOf(item);
                        const thumb = thumbOf(item);
                        return (
                          <Link key={item.id} href={`/lectures/${item.id}`} className="ec-card ec-card-interactive overflow-hidden">
                            <div className="relative">
                              {thumb ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={thumb} alt="" className="h-36 w-full bg-ink-100 object-cover" loading="lazy" />
                              ) : (
                                <div className="grid h-36 w-full place-items-center bg-ink-100 text-ink-400">
                                  <PlayCircle size={26} />
                                </div>
                              )}
                            </div>
                            <div className="p-3">
                              <p className="line-clamp-2 text-sm font-semibold">{item.title}</p>
                              <p className="mt-0.5 line-clamp-1 text-xs text-ink-500">
                                {String(meta.topic || meta.lesson || '')}
                              </p>
                              {meta.isPreview === true && (
                                <Badge variant="info" className="mt-1">
                                  Free preview
                                </Badge>
                              )}
                            </div>
                          </Link>
                        );
                      })}
                  </div>
                )}
                {subject.resources.length > 0 && (
                  <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
                    {subject.resources.map((resource) => (
                      <li key={resource.id}>
                        <Link
                          href={`/lectures/${resource.id}`}
                          className="flex items-center gap-2 rounded-xl border border-ink-100 px-3 py-2 text-xs font-semibold hover:bg-ink-50"
                        >
                          <FileText size={14} className="text-brand-600" /> {resource.title}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ))}

            {showUnassigned && course.unassigned && (
              <section aria-labelledby="subject-general">
                <h2 id="subject-general" className="mb-2 text-base font-bold">
                  General
                </h2>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {course.unassigned.lectures.map((item) => (
                    <Link key={item.id} href={`/lectures/${item.id}`} className="ec-card ec-card-interactive p-3">
                      <p className="line-clamp-2 text-sm font-semibold">{item.title}</p>
                      <p className="mt-0.5 text-xs text-ink-500">Course-level lecture</p>
                    </Link>
                  ))}
                </div>
              </section>
            )}
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
  const embedUrl = videoId ? getYoutubeEmbedUrl(videoId) : '';
  const parentId = lecture.parentId || String(meta.parentId || '');

  if (lecture.kind === 'resource') {
    const resourceFileId = String(meta.notesFileId || meta.driveFileId || '');
    const externalUrl = String(meta.pdfUrl || meta.notesPdfUrl || '');
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Link href={parentId ? `/lectures/${parentId}` : '/lectures'} className="text-sm font-semibold text-brand-700 hover:underline">
          ← {screen.backLabel}
        </Link>
        <Card className="p-5">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-brand-700">Resource</p>
          <h1 className="text-xl font-extrabold">{lecture.title}</h1>
          <p className="mt-1 text-sm text-ink-500">{lecture.description || 'No description added yet.'}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Badge variant="info">{lecture.exam}</Badge>
            <Badge variant="default">Class {lecture.classes.join(' / ')}</Badge>
            {subjectName && <Badge variant="default">{subjectName}</Badge>}
          </div>
          <div className="mt-4">
            {resourceFileId ? (
              <Button size="sm" loading={pdfLoading} onClick={() => void openPrivatePdf(resourceFileId)}>
                <FileText size={13} className="mr-1.5" /> Open PDF
              </Button>
            ) : externalUrl && isSafeHttpUrl(externalUrl) ? (
              <a
                href={externalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="ec-btn bg-brand-600 px-4 py-2 text-sm font-semibold text-white"
              >
                Open resource
              </a>
            ) : (
              <p className="rounded-xl border border-dashed border-ink-200 px-3 py-2 text-xs text-ink-500">
                No file is linked to this resource yet.
              </p>
            )}
          </div>
          {pdfError && (
            <p role="alert" className="mt-2 text-xs font-semibold text-red-700">
              {pdfError}
            </p>
          )}
        </Card>
        {pdfOpen && (
          <div className="fixed inset-0 z-[95] overflow-y-auto bg-black/60 p-3 sm:p-6" role="dialog" aria-modal="true">
            <div className="mx-auto w-full max-w-5xl overflow-hidden rounded-2xl bg-white shadow-2xl">
              <div className="flex items-center justify-between gap-3 border-b border-ink-100 px-4 py-3">
                <p className="truncate text-sm font-bold">{lecture.title}</p>
                <div className="flex shrink-0 items-center gap-2">
                  {pdfUrl && (
                    <a href={pdfUrl} download={`${lecture.title}.pdf`} className="ec-btn border border-ink-200 px-2.5 py-1.5 text-[11px] font-semibold">
                      <Download size={12} className="mr-1 inline" /> Download
                    </a>
                  )}
                  <button type="button" onClick={closePdf} aria-label="Close PDF" className="grid h-8 w-8 place-items-center rounded-lg text-ink-500 hover:bg-ink-100">
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

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <Link href={parentId ? `/lectures/${parentId}` : '/lectures'} className="text-sm font-semibold text-brand-700 hover:underline">
        ← {screen.backLabel}
      </Link>
      <ScreenAnnouncementBanner announcement={screen.announcement} />

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          <Card className="overflow-hidden">
            <div className="relative aspect-video bg-black">
              {embedUrl ? (
                <iframe
                  key={videoId}
                  src={embedUrl}
                  title={lecture.title}
                  className="h-full w-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                  allowFullScreen
                />
              ) : (
                <div className="grid h-full place-items-center p-6 text-center text-sm text-white">
                  <div>
                    <p>This lecture has no video yet.</p>
                    {youtubeUrl && isSafeHttpUrl(youtubeUrl) && (
                      <a href={youtubeUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block underline">
                        Open on YouTube
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>
            <div className="p-4 sm:p-5">
              <h1 className="text-lg font-bold leading-tight sm:text-xl">{lecture.title}</h1>
              <p className="mt-1 text-sm text-ink-500">{lecture.description}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Badge variant="info">{lecture.exam}</Badge>
                <Badge variant="default">Class {lecture.classes.join(' / ')}</Badge>
                {subjectName && <Badge variant="default">{subjectName}</Badge>}
                {Boolean(meta.topic) && <Badge variant="default">{String(meta.topic)}</Badge>}
                <Badge variant="default">{watched}s watched</Badge>
                {completed && <Badge variant="success">Completed</Badge>}
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => setCompleted((value) => !value)}>
                  {completed ? screen.markIncompleteLabel : screen.markCompleteLabel}
                </Button>
                <Button size="sm" onClick={saveProgress} loading={saving}>
                  {screen.saveProgressLabel}
                </Button>
                {notesFileId ? (
                  <Button size="sm" variant="outline" loading={pdfLoading} onClick={() => void openPrivatePdf(notesFileId)}>
                    <FileText size={13} className="mr-1.5" /> View notes PDF
                  </Button>
                ) : notesPdfUrl && isSafeHttpUrl(notesPdfUrl) ? (
                  <a href={notesPdfUrl} target="_blank" rel="noopener noreferrer" className="ec-btn border border-ink-200 px-3 py-2 text-sm font-semibold">
                    View notes
                  </a>
                ) : null}
              </div>
              {pdfError && (
                <p role="alert" className="mt-2 text-xs font-semibold text-red-700">
                  {pdfError}
                </p>
              )}

              <div className="mt-4 flex flex-wrap gap-2">
                {previous ? (
                  <Link href={`/lectures/${previous.item.id}`} className="ec-btn bg-ink-900 px-4 py-2 text-sm font-semibold text-white">
                    ← {screen.previousLabel}
                  </Link>
                ) : (
                  <span className="ec-btn bg-ink-100 px-4 py-2 text-sm font-semibold text-ink-400">← {screen.previousLabel}</span>
                )}
                {next ? (
                  <Link href={`/lectures/${next.item.id}`} className="ec-btn bg-brand-600 px-4 py-2 text-sm font-semibold text-white">
                    {screen.nextLabel} →
                  </Link>
                ) : (
                  <span className="ec-btn bg-ink-100 px-4 py-2 text-sm font-semibold text-ink-400">{screen.nextLabel} →</span>
                )}
              </div>
            </div>
          </Card>

          {screen.showNotes && !notesFileId && notesPdfUrl && isSafeHttpUrl(notesPdfUrl) && (
            <Card className="overflow-hidden">
              <div className="flex items-center justify-between border-b border-ink-100 bg-ink-50 p-2 text-xs font-semibold">
                <span>{screen.notesTitle}</span>
                <a href={notesPdfUrl} target="_blank" rel="noopener noreferrer" className="text-[11px] font-bold text-brand-700">
                  Open in a new tab ↗
                </a>
              </div>
              <iframe src={notesPdfUrl} title={screen.notesTitle} className="h-[480px] w-full" />
            </Card>
          )}

          {screen.progressNote && (
            <ScreenHelpNote help={{ title: screen.help.title || 'Player tips', body: screen.progressNote }} />
          )}
        </div>

        {screen.showRelated && (
          <div className="space-y-3">
            <h2 className="font-bold">
              {screen.relatedTitle} · {siblings.length}
            </h2>
            <div className="max-h-[70vh] space-y-2 overflow-auto pr-1">
              {siblings.map(({ item, subjectName: siblingSubject }) => {
                const active = item.id === lecture.id;
                const thumb = thumbOf(item);
                return (
                  <Link
                    key={item.id}
                    href={`/lectures/${item.id}`}
                    className={`flex gap-3 rounded-xl border p-2 ${
                      active ? 'border-brand-200 bg-brand-50' : 'border-ink-100 hover:bg-ink-50'
                    }`}
                  >
                    {thumb ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={thumb} alt="" className="h-14 w-20 shrink-0 rounded-lg bg-ink-100 object-cover" loading="lazy" />
                    ) : (
                      <span className="grid h-14 w-20 shrink-0 place-items-center rounded-lg bg-ink-100 text-ink-400">
                        <FileText size={15} />
                      </span>
                    )}
                    <div className="min-w-0">
                      <p className="line-clamp-2 text-sm font-semibold leading-tight">{item.title}</p>
                      <p className="line-clamp-1 text-xs text-ink-500">{siblingSubject || (item.kind === 'resource' ? 'Resource' : '')}</p>
                      {active && (
                        <Badge variant="info" className="mt-1">
                          Now open
                        </Badge>
                      )}
                    </div>
                  </Link>
                );
              })}
              {siblings.length === 0 && (
                <p className="rounded-xl border border-dashed border-ink-200 p-3 text-xs text-ink-500">
                  {screen.relatedEmptyTitle} {screen.relatedEmptyBody}
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {pdfOpen && (
        <div className="fixed inset-0 z-[95] overflow-y-auto bg-black/60 p-3 sm:p-6" role="dialog" aria-modal="true">
          <div className="mx-auto w-full max-w-5xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between gap-3 border-b border-ink-100 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-bold">{notesFileName || screen.notesTitle}</p>
                <p className="text-[10px] text-ink-500">Private Google Drive file · opened with your signed-in session</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {pdfUrl && (
                  <>
                    <a href={pdfUrl} download={notesFileName || `${lecture.title}.pdf`} className="ec-btn border border-ink-200 px-2.5 py-1.5 text-[11px] font-semibold">
                      <Download size={12} className="mr-1 inline" /> Download
                    </a>
                    <a href={pdfUrl} target="_blank" rel="noopener noreferrer" className="ec-btn border border-ink-200 px-2.5 py-1.5 text-[11px] font-semibold">
                      <ExternalLink size={12} className="mr-1 inline" /> New tab
                    </a>
                  </>
                )}
                <button type="button" onClick={closePdf} aria-label="Close PDF" className="grid h-8 w-8 place-items-center rounded-lg text-ink-500 hover:bg-ink-100">
                  <X size={16} />
                </button>
              </div>
            </div>
            {pdfLoading && <p className="p-6 text-sm text-ink-500">Loading secured PDF…</p>}
            {pdfUrl && <iframe src={pdfUrl} title={notesFileName || screen.notesTitle} className="h-[75vh] w-full" />}
            {!pdfLoading && !pdfUrl && pdfError && <p className="p-6 text-sm text-red-700">{pdfError}</p>}
          </div>
        </div>
      )}
    </div>
  );
}

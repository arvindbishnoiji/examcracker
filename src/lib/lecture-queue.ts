import type {
  ClassLevel,
  CourseCatalogItem,
  ExamTrack,
  LectureMetadata,
  SubjectQueueItem,
} from '@/types';
import { matchesStudentExamAndClass } from './validation';

export interface SubjectQueueOptions {
  student?: {
    exam: ExamTrack;
    classLevel: ClassLevel;
  } | null;
  enrolledParentIds?: ReadonlySet<string>;
  isAdmin?: boolean;
  nowMs?: number;
  relatedLimit?: number;
}

export interface ResolvedSubjectQueue {
  queue: SubjectQueueItem[];
  currentIndex: number;
  previous: SubjectQueueItem | null;
  next: SubjectQueueItem | null;
  upNext: SubjectQueueItem[];
  related: SubjectQueueItem[];
  reason: 'ok' | 'not_a_lecture' | 'missing_subject' | 'single_lecture' | 'empty';
}

function isPreviewLecture(item: CourseCatalogItem): boolean {
  const meta = (item.metadata || {}) as Record<string, unknown>;
  return meta.isPreview === true || meta.preview === true;
}

function isWithinLectureWindow(item: CourseCatalogItem, nowMs: number): boolean {
  const meta = (item.metadata || {}) as Record<string, unknown>;
  const starts = typeof meta.startsAt === 'string' && meta.startsAt ? Date.parse(meta.startsAt) : NaN;
  const ends = typeof meta.endsAt === 'string' && meta.endsAt ? Date.parse(meta.endsAt) : NaN;
  if (Number.isFinite(starts) && starts > nowMs) return false;
  if (Number.isFinite(ends) && ends < nowMs) return false;
  return true;
}

function lectureSortOrder(item: CourseCatalogItem): number {
  if (typeof item.sortOrder === 'number' && Number.isFinite(item.sortOrder)) {
    return item.sortOrder;
  }
  const meta = (item.metadata || {}) as Record<string, unknown>;
  const pos = Number(meta.sortOrder ?? meta.position ?? 0);
  return Number.isFinite(pos) ? pos : 0;
}

export function sortSubjectLectures<T extends CourseCatalogItem>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => {
    const orderDiff = lectureSortOrder(a) - lectureSortOrder(b);
    if (orderDiff !== 0) return orderDiff;
    const createdDiff = String(a.created_at || '').localeCompare(String(b.created_at || ''));
    if (createdDiff !== 0) return createdDiff;
    return String(a.id || '').localeCompare(String(b.id || ''));
  });
}

/**
 * Resolves the subject-isolated playback queue for a lecture using canonical
 * database relationship fields (`kind`, `subjectId`, `parentId`, `exam`, `classes`)
 * and never title text.
 */
export function buildSubjectQueue(
  currentLecture: CourseCatalogItem | null | undefined,
  candidates: readonly SubjectQueueItem[],
  options: SubjectQueueOptions = {}
): ResolvedSubjectQueue {
  const empty = (reason: ResolvedSubjectQueue['reason']): ResolvedSubjectQueue => ({
    queue: [],
    currentIndex: -1,
    previous: null,
    next: null,
    upNext: [],
    related: [],
    reason,
  });

  if (!currentLecture || currentLecture.kind !== 'lecture') {
    return empty('not_a_lecture');
  }

  const targetSubjectId = currentLecture.subjectId ? String(currentLecture.subjectId).trim() : '';
  if (!targetSubjectId) {
    return empty('missing_subject');
  }

  const targetParentId = currentLecture.parentId ? String(currentLecture.parentId).trim() : '';
  const nowMs = options.nowMs ?? Date.now();
  const relatedLimit = Math.max(1, options.relatedLimit ?? 8);
  const seenIds = new Set<string>();

  const filtered: SubjectQueueItem[] = [];
  for (const candidate of candidates) {
    if (!candidate || candidate.kind !== 'lecture') continue;
    if (candidate.active === false) continue;

    const candidateSubjectId = candidate.subjectId ? String(candidate.subjectId).trim() : '';
    if (!candidateSubjectId || candidateSubjectId !== targetSubjectId) continue;

    const candidateParentId = candidate.parentId ? String(candidate.parentId).trim() : '';
    if (candidateParentId !== targetParentId) continue;

    if (!isWithinLectureWindow(candidate, nowMs)) continue;

    if (!options.isAdmin && options.student) {
      if (
        !matchesStudentExamAndClass(
          candidate,
          options.student.exam,
          options.student.classLevel
        )
      ) {
        continue;
      }
      if (candidateParentId && options.enrolledParentIds) {
        const hasAccess =
          options.enrolledParentIds.has(candidateParentId) || isPreviewLecture(candidate);
        if (!hasAccess) continue;
      }
    }

    if (seenIds.has(candidate.id)) continue;
    seenIds.add(candidate.id);
    filtered.push(candidate as SubjectQueueItem);
  }

  const queue = sortSubjectLectures(filtered);
  if (queue.length === 0) {
    return empty('empty');
  }

  const currentIndex = queue.findIndex((entry) => entry.id === currentLecture.id);
  const previous = currentIndex > 0 ? queue[currentIndex - 1] : null;
  const next =
    currentIndex >= 0 && currentIndex < queue.length - 1 ? queue[currentIndex + 1] : null;
  const upNext = currentIndex >= 0 ? queue.slice(currentIndex + 1) : queue;
  const earlier = currentIndex > 0 ? queue.slice(0, currentIndex) : [];
  const related = [...upNext, ...earlier].slice(0, relatedLimit);

  return {
    queue,
    currentIndex,
    previous,
    next,
    upNext,
    related,
    reason: queue.length === 1 && currentIndex === 0 ? 'single_lecture' : 'ok',
  };
}

export function formatWatchDuration(seconds?: number | null): string {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  if (total <= 0) return '0m';
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  if (hours > 0) return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  if (minutes > 0) return `${minutes}m`;
  return `${total}s`;
}

export function parseDurationToSeconds(duration?: string | null): number {
  if (!duration || typeof duration !== 'string') return 0;
  const parts = duration
    .trim()
    .split(':')
    .map((part) => Number(part.trim()));
  if (parts.some((n) => !Number.isFinite(n) || n < 0)) return 0;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return 0;
}

export function lectureCompletionPercent(
  item: CourseCatalogItem<LectureMetadata>,
  watchedSeconds?: number | null,
  completed?: boolean | null
): number {
  if (completed) return 100;
  const watched = Math.max(0, Number(watchedSeconds) || 0);
  if (watched <= 0) return 0;
  const durationSeconds = parseDurationToSeconds(item.metadata?.duration);
  if (durationSeconds > 0) {
    return Math.min(98, Math.max(4, Math.round((watched / durationSeconds) * 100)));
  }
  return Math.min(90, Math.max(6, Math.round((watched / 2700) * 100)));
}

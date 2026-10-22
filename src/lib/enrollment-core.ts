// Exam Cracker — shared enrollment domain logic
// ---------------------------------------------------------------------------
// Pure, dependency-free rules used by the admin enrollment console and the
// Vitest suite. The Worker enforces authorisation and persistence; this module
// only answers "who is eligible" and "what would the bulk action do". The
// server must never rely on a client-supplied `isAdmin` flag.

export type EnrollmentItemType = 'batch' | 'series';
export type AudienceMode = 'selected' | 'all' | 'filter';
export type ExamTrack = 'JEE' | 'NEET';
export type ClassLevel = '11' | '12' | 'Dropper';

export interface CatalogItemLike {
  id: string;
  kind: string;
  title?: string | null;
  exam?: string | null;
  classes?: unknown;
  active?: boolean | null;
  access_code?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface StudentLike {
  firebase_uid: string;
  display_name?: string | null;
  email?: string | null;
  exam?: string | null;
  class_level?: string | null;
}

export interface EnrollmentLike {
  active?: boolean | null;
  status?: string | null;
  expires_at?: string | null;
  revoked_at?: string | null;
}

export type SkipReason =
  | 'not_found'
  | 'ineligible_exam'
  | 'ineligible_class'
  | 'not_allowed';

export interface SkippedStudent {
  uid: string;
  name?: string | null;
  reason: SkipReason;
}

export interface AudienceScope {
  mode: AudienceMode;
  /** Number of student profiles the audience resolved to before eligibility. */
  targeted: number;
  /** Number of students that will actually receive access. */
  eligible: number;
  /** Students deliberately excluded because they do not match the course. */
  skipped: number;
  /** True when the action covers both exams and/or both classes. */
  crossTrack: boolean;
  /** True when the admin must explicitly acknowledge the wide scope. */
  requiresConfirmation: boolean;
  label: string;
  filters: { exam: ExamTrack | ''; classLevel: ClassLevel | '' };
  includeFuture: boolean;
  respectEligibility: boolean;
}

export interface AudiencePlan {
  eligible: StudentLike[];
  skipped: SkippedStudent[];
  scope: AudienceScope;
}

export interface BulkEnrollInput {
  itemType: EnrollmentItemType;
  itemId: string;
  mode: AudienceMode;
  studentUids: string[];
  exam: ExamTrack | '';
  classLevel: ClassLevel | '';
  includeFuture: boolean;
  respectEligibility: boolean;
  confirmAll: boolean;
  expiresAt: string | null;
  dryRun: boolean;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const MAX_BULK_STUDENTS = 5000;
export const BULK_CHUNK_SIZE = 50;
export const MAX_PROFILE_SCAN = 10000;

export function isUuid(value: unknown): boolean {
  return UUID_RE.test(String(value || ''));
}

export function classListOf(classes: unknown): string[] {
  if (!Array.isArray(classes)) return [];
  const normalized: string[] = [];
  for (const entry of classes) {
    const cleaned = String(entry || '').trim();
    const mapped =
      cleaned === '11' || cleaned === '12'
        ? cleaned
        : /^dropper$/i.test(cleaned)
          ? 'Dropper'
          : '';
    if (mapped && !normalized.includes(mapped)) normalized.push(mapped);
  }
  return normalized;
}

export function examMatchesItem(itemExam: unknown, studentExam: unknown): boolean {
  const item = String(itemExam || 'Both');
  const student = String(studentExam || '');
  if (item === 'Both') return student === 'JEE' || student === 'NEET';
  return item === student;
}

export function classMatchesItem(classes: unknown, classLevel: unknown): boolean {
  const list = classListOf(classes);
  if (!list.length) return false;
  const studentClass = String(classLevel || '').trim();
  if (/^dropper$/i.test(studentClass)) {
    return list.some((entry) => entry === '11' || entry === '12' || entry === 'Dropper');
  }
  if (studentClass === '11' || studentClass === '12') {
    return list.includes(studentClass);
  }
  return false;
}

export function isEligibleForItem(item: CatalogItemLike, student: StudentLike): boolean {
  return examMatchesItem(item.exam, student.exam) && classMatchesItem(item.classes, student.class_level);
}

export function ineligibilityReason(item: CatalogItemLike, student: StudentLike): SkipReason | null {
  if (!examMatchesItem(item.exam, student.exam)) return 'ineligible_exam';
  if (!classMatchesItem(item.classes, student.class_level)) return 'ineligible_class';
  return null;
}

/** Paid content can never be self-enrolled by a student without an access code. */
export function isPaidItem(item: CatalogItemLike): boolean {
  const meta = item.metadata || {};
  if (meta.isFree === true) return false;
  if (meta.paid === true || meta.requiresPayment === true) return true;
  const price = Number(meta.price ?? meta.amount ?? meta.fee ?? 0);
  if (Number.isFinite(price) && price > 0) return true;
  return meta.isFree === false;
}

export function priceLabel(item: CatalogItemLike): string {
  const meta = item.metadata || {};
  if (!isPaidItem(item)) return 'Free';
  const amount = Number(meta.price ?? meta.amount ?? meta.fee ?? 0);
  const currency = String(meta.currency || 'INR').toUpperCase();
  if (Number.isFinite(amount) && amount > 0) {
    return `${currency === 'INR' ? '₹' : `${currency} `}${amount.toLocaleString('en-IN')}`;
  }
  return 'Paid';
}

export function enrollmentIsActive(row: EnrollmentLike, now: Date | number = Date.now()): boolean {
  if (!row || row.active === false) return false;
  if (row.status && row.status !== 'active') return false;
  if (row.revoked_at) return false;
  if (row.expires_at) {
    const expires = new Date(row.expires_at).getTime();
    if (Number.isFinite(expires) && expires <= (typeof now === 'number' ? now : now.getTime())) return false;
  }
  return true;
}

export function normalizeStudentUids(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const uid = String(value || '').trim();
    if (!uid || uid.length > 200 || seen.has(uid)) continue;
    seen.add(uid);
    out.push(uid);
  }
  return out;
}

export function chunkArray<T>(items: T[], size: number): T[][] {
  const width = Math.max(1, Math.floor(size));
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += width) {
    chunks.push(items.slice(index, index + width));
  }
  return chunks;
}

function normalizeExam(value: unknown): ExamTrack | '' {
  const exam = String(value || '').trim().toUpperCase();
  return exam === 'JEE' || exam === 'NEET' ? exam : '';
}

function normalizeClass(value: unknown): ClassLevel | '' {
  const level = String(value || '').trim();
  if (level === '11' || level === '12') return level;
  if (/^dropper$/i.test(level)) return 'Dropper';
  return '';
}

export interface ParseResult<T> {
  ok: boolean;
  value?: T;
  error?: string;
}

/**
 * Validates an admin bulk-enrollment payload. The server uses this before any
 * database access; the admin UI uses it to pre-validate the same shape.
 */
export function parseBulkEnrollInput(raw: unknown): ParseResult<BulkEnrollInput> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, error: 'Send a JSON object describing the enrollment.' };
  }
  const body = raw as Record<string, unknown>;
  const itemType = String(body.itemType || '');
  if (itemType !== 'batch' && itemType !== 'series') {
    return { ok: false, error: 'Choose a batch or a series.' };
  }
  const itemId = String(body.itemId || '').trim();
  if (!isUuid(itemId)) return { ok: false, error: 'Choose a valid batch or series.' };

  const mode = String(body.mode || body.audience || 'selected') as AudienceMode;
  if (!['selected', 'all', 'filter'].includes(mode)) {
    return { ok: false, error: 'Choose who should be enrolled.' };
  }

  const studentUids = normalizeStudentUids(body.studentUids);
  if (mode === 'selected' && studentUids.length === 0) {
    return { ok: false, error: 'Select at least one student.' };
  }
  if (studentUids.length > MAX_BULK_STUDENTS) {
    return { ok: false, error: `Select ${MAX_BULK_STUDENTS} students or fewer at a time.` };
  }

  const includeFuture = body.includeFuture === true;
  if (includeFuture && mode === 'selected') {
    return {
      ok: false,
      error: 'Future students can only be auto-enrolled from an all-students or filtered audience.',
    };
  }

  const respectEligibility = body.respectEligibility !== false;
  const exam = normalizeExam(body.exam);
  const classLevel = normalizeClass(body.classLevel);
  if (mode === 'filter' && !exam && !classLevel) {
    return { ok: false, error: 'Choose an exam or class filter for this audience.' };
  }

  let expiresAt: string | null = null;
  if (body.expiresAt) {
    const parsed = new Date(String(body.expiresAt));
    if (Number.isNaN(parsed.getTime())) return { ok: false, error: 'The access expiry date is not valid.' };
    if (parsed.getTime() <= Date.now()) return { ok: false, error: 'The access expiry date must be in the future.' };
    expiresAt = parsed.toISOString();
  }

  return {
    ok: true,
    value: {
      itemType,
      itemId,
      mode,
      studentUids,
      exam,
      classLevel,
      includeFuture,
      respectEligibility,
      confirmAll: body.confirmAll === true,
      expiresAt,
      dryRun: body.dryRun === true,
    },
  };
}

/**
 * Resolves an audience against the real student profiles. When
 * `respectEligibility` is true (the default), students outside the course's
 * exam/class are reported as skipped and never receive access. Turning it off
 * is an explicit override that requires `confirmAll` for all-student actions.
 */
export function resolveAudience(
  input: Pick<BulkEnrollInput, 'mode' | 'studentUids' | 'exam' | 'classLevel' | 'respectEligibility' | 'includeFuture' | 'confirmAll'>,
  profiles: StudentLike[],
  item: CatalogItemLike
): AudiencePlan {
  const byUid = new Map(profiles.map((profile) => [profile.firebase_uid, profile]));
  let targetedProfiles: StudentLike[] = [];
  const skipped: SkippedStudent[] = [];
  const targetedUids = new Set<string>();

  if (input.mode === 'selected') {
    for (const uid of input.studentUids) {
      const profile = byUid.get(uid);
      if (!profile) {
        skipped.push({ uid, reason: 'not_found' });
        continue;
      }
      targetedProfiles.push(profile);
      targetedUids.add(uid);
    }
  } else {
    targetedProfiles = profiles.filter((profile) => {
      if (input.mode === 'filter') {
        if (input.exam && profile.exam !== input.exam) return false;
        if (input.classLevel && String(profile.class_level) !== input.classLevel) return false;
      }
      return true;
    });
    for (const profile of targetedProfiles) targetedUids.add(profile.firebase_uid);
  }

  const eligible: StudentLike[] = [];
  for (const profile of targetedProfiles) {
    if (!input.respectEligibility) {
      eligible.push(profile);
      continue;
    }
    const reason = ineligibilityReason(item, profile);
    if (reason) skipped.push({ uid: profile.firebase_uid, name: profile.display_name || null, reason });
    else eligible.push(profile);
  }

  const exams = new Set(eligible.map((profile) => profile.exam).filter(Boolean));
  const classes = new Set(eligible.map((profile) => String(profile.class_level || '')).filter(Boolean));
  const itemExam = String(item.exam || 'Both');
  const itemClasses = classListOf(item.classes);
  const outsideExam = itemExam !== 'Both' && Array.from(exams).some((exam) => exam !== itemExam);
  const outsideClass =
    itemClasses.length > 0 && Array.from(classes).some((level) => !classMatchesItem(itemClasses, level));
  const crossTrack =
    !input.respectEligibility && eligible.length > 0 && (outsideExam || outsideClass);
  const requiresConfirmation = !input.respectEligibility && input.mode !== 'selected';

  const labelParts: string[] = [];
  const examLabel = input.exam || (input.mode === 'all' ? 'All exams' : 'All exams');
  const classLabel = input.classLevel ? `Class ${input.classLevel}` : input.mode === 'all' ? 'all classes' : 'all classes';
  labelParts.push(input.mode === 'selected' ? `${eligible.length} selected student${eligible.length === 1 ? '' : 's'}` : `${examLabel} · ${classLabel}`);
  if (!input.respectEligibility) labelParts.push('eligibility override');
  if (input.includeFuture) labelParts.push('future students included');

  return {
    eligible,
    skipped,
    scope: {
      mode: input.mode,
      targeted: targetedUids.size,
      eligible: eligible.length,
      skipped: skipped.length,
      crossTrack,
      requiresConfirmation,
      label: labelParts.join(' · '),
      filters: { exam: input.exam, classLevel: input.classLevel },
      includeFuture: input.includeFuture,
      respectEligibility: input.respectEligibility,
    },
  };
}

export interface BulkResultSummary {
  targeted: number;
  eligible: number;
  created: number;
  reactivated: number;
  alreadyActive: number;
  skipped: number;
  failed: number;
  ruleSaved: boolean;
}

export interface BulkFailure {
  uid: string;
  name?: string | null;
  reason: string;
}

/**
 * Counts the outcome of a processed bulk action. Created = no previous row;
 * reactivated = an existing row that was inactive/expired; alreadyActive rows
 * were left untouched (idempotent repeat).
 */
export function summarizeBulkResults(input: {
  targeted: number;
  eligible: number;
  skipped: number;
  created: number;
  reactivated: number;
  alreadyActive: number;
  failed: number;
  ruleSaved?: boolean;
}): BulkResultSummary {
  return {
    targeted: input.targeted,
    eligible: input.eligible,
    created: input.created,
    reactivated: input.reactivated,
    alreadyActive: input.alreadyActive,
    skipped: input.skipped,
    failed: input.failed,
    ruleSaved: Boolean(input.ruleSaved),
  };
}

/**
 * Turns enrollment rows into access state used by the student UI. Never invents
 * progress or access: only real rows returned by the server are considered.
 */
export function enrolledItemKeys(
  rows: Array<{ item_type?: string | null; item_id?: string | null; active?: boolean | null; status?: string | null; expires_at?: string | null }>,
  now: Date | number = Date.now()
): Set<string> {
  const keys = new Set<string>();
  for (const row of rows || []) {
    if (!row.item_type || !row.item_id) continue;
    if (!enrollmentIsActive({ active: row.active, status: row.status, expires_at: row.expires_at }, now)) continue;
    keys.add(`${row.item_type}:${row.item_id}`);
  }
  return keys;
}

export function daysBetween(from: Date | number, to: Date | number): number {
  const start = typeof from === 'number' ? from : from.getTime();
  const end = typeof to === 'number' ? to : to.getTime();
  return Math.max(0, Math.ceil((end - start) / 86400000));
}

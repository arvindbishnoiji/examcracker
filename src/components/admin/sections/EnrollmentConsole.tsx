'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleSlash,
  ClipboardList,
  History,
  Layers,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  UserPlus,
  Users,
  UsersRound,
  X,
} from 'lucide-react';
import {
  ApiError,
  bulkEnrollStudents,
  bulkRevokeEnrollments,
  createAdminEnrollment,
  deleteAdminEnrollment,
  deleteEnrollmentRule,
  getAdminContentList,
  getAdminEnrollmentList,
  getEnrollmentHistory,
  getEnrollmentRules,
  restoreAdminEnrollment,
  searchAdminStudents,
  setEnrollmentRuleActive,
  type BulkEnrollInput,
} from '@/lib/api';
import type {
  AdminEnrollmentRow,
  AdminStudentDirectoryResponse,
  CourseCatalogItem,
  EnrollmentBulkResult,
  EnrollmentHistoryEvent,
  EnrollmentRule,
  EnrollmentScope,
} from '@/types';
import { formatISTDateTime } from '@/lib/date';
import { formatClassLevel, formatClassList } from '@/lib/validation';
import { useToast } from '@/hooks/useToast';
import { isPaidCourse, coursePriceLabel } from '@/lib/enrollment';
import {
  AdminPageHeader,
  ConfirmDialog,
  Modal,
  Pagination,
  Panel,
  Segmented,
  Spinner,
  StatCard,
  StatusPill,
} from '../ui';

type Tab = 'students' | 'records' | 'rules' | 'history';
type ExamFilter = '' | 'JEE' | 'NEET';
type ClassFilter = '' | '11' | '12' | 'Dropper';

const SOURCE_LABEL: Record<string, string> = {
  manual: 'Admin grant',
  admin_bulk: 'Bulk grant',
  auto_rule: 'Auto-enrollment',
  access_code: 'Access code',
  self_service: 'Self-enrolled',
  import: 'Imported',
};

const SKIP_LABEL: Record<string, string> = {
  not_found: 'Profile no longer exists',
  ineligible_exam: 'Different exam track',
  ineligible_class: 'Different class',
  not_allowed: 'Not allowed',
  CONFIRMATION_REQUIRED: 'Needs confirmation',
};

function catalogMeta(item: CourseCatalogItem): Record<string, unknown> {
  return (item.metadata || {}) as Record<string, unknown>;
}

function catalogLabel(item: CourseCatalogItem): string {
  return `${item.kind === 'batch' ? 'Batch' : 'Series'} · ${item.exam} · ${formatClassList(item.classes)}`;
}

function formatDate(value?: string | null): string {
  if (!value) return 'No expiry';
  return formatISTDateTime(value);
}

function actionTone(action: EnrollmentHistoryEvent['action']): 'success' | 'danger' | 'info' | 'neutral' {
  if (action === 'granted' || action === 'reactivated' || action === 'auto_enrolled') return 'success';
  if (action === 'revoked') return 'danger';
  if (action === 'deduplicated') return 'neutral';
  return 'info';
}

function actionLabel(action: EnrollmentHistoryEvent['action']): string {
  return action
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

/* ------------------------------------------------------------------------- */
/* Enrollment flow                                                           */
/* ------------------------------------------------------------------------- */

function EnrollModal({
  open,
  onClose,
  courses,
  preselectedStudent,
  selectedUids,
  onComplete,
}: {
  open: boolean;
  onClose: () => void;
  courses: CourseCatalogItem[];
  preselectedStudent?: AdminStudentDirectoryResponse['items'][number] | null;
  selectedUids: string[];
  onComplete: () => void;
}) {
  const { push } = useToast();
  const [itemId, setItemId] = useState('');
  const [mode, setMode] = useState<'selected' | 'all' | 'filter'>(selectedUids.length ? 'selected' : 'all');
  const [exam, setExam] = useState<ExamFilter>('');
  const [classLevel, setClassLevel] = useState<ClassFilter>('');
  const [includeFuture, setIncludeFuture] = useState(false);
  const [respectEligibility, setRespectEligibility] = useState(true);
  const [expiresAt, setExpiresAt] = useState('');
  const [preview, setPreview] = useState<EnrollmentBulkResult | null>(null);
  const [scope, setScope] = useState<EnrollmentScope | null>(null);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const [confirmAll, setConfirmAll] = useState(false);
  const [phase, setPhase] = useState<'idle' | 'previewing' | 'enrolling'>('idle');
  const [result, setResult] = useState<EnrollmentBulkResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const uids = preselectedStudent ? [preselectedStudent.firebase_uid] : selectedUids;
  const effectiveMode = preselectedStudent ? 'selected' : mode;
  const item = courses.find((course) => course.id === itemId) || null;

  useEffect(() => {
    if (!open) return;
    setItemId('');
    setMode(selectedUids.length ? 'selected' : 'all');
    setExam('');
    setClassLevel('');
    setIncludeFuture(false);
    setRespectEligibility(true);
    setExpiresAt('');
    setPreview(null);
    setScope(null);
    setNeedsConfirmation(false);
    setConfirmAll(false);
    setPhase('idle');
    setResult(null);
    setError(null);
  }, [open, selectedUids.length]);

  const payload = useMemo<BulkEnrollInput | null>(() => {
    if (!item || !itemId) return null;
    return {
      itemType: item.kind as 'batch' | 'series',
      itemId,
      mode: effectiveMode,
      studentUids: effectiveMode === 'selected' ? uids : undefined,
      exam,
      classLevel,
      includeFuture,
      respectEligibility,
      confirmAll,
      expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
    };
  }, [item, itemId, effectiveMode, uids, exam, classLevel, includeFuture, respectEligibility, confirmAll, expiresAt]);

  async function runPreview() {
    if (!payload) {
      setError('Choose a batch or series first.');
      return;
    }
    if (payload.mode === 'selected' && !uids.length) {
      setError('Select at least one student.');
      return;
    }
    if (payload.mode === 'filter' && !exam && !classLevel) {
      setError('Choose an exam or class filter, or switch to all eligible students.');
      return;
    }
    setError(null);
    setNeedsConfirmation(false);
    setPhase('previewing');
    setResult(null);
    setPreview(null);
    try {
      const data = await bulkEnrollStudents({ ...payload, dryRun: true });
      setPreview(data);
      setScope(data.scope || null);
      if (data.scope?.requiresConfirmation) setNeedsConfirmation(true);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        const data = err.data as { scope?: EnrollmentScope } | undefined;
        setScope(data?.scope || null);
        setNeedsConfirmation(true);
        setError(err.message);
      } else {
        setError(err instanceof Error ? err.message : 'Could not preview this audience.');
      }
    } finally {
      setPhase('idle');
    }
  }

  async function runEnroll() {
    if (!payload) return;
    if (needsConfirmation && !confirmAll) {
      setError('Tick the confirmation checkbox to apply this wider audience.');
      return;
    }
    setError(null);
    setPhase('enrolling');
    try {
      const data = await bulkEnrollStudents(payload);
      setResult(data);
      setPreview(null);
      push(
        `${data.summary.created} new · ${data.summary.reactivated} reactivated · ${data.summary.alreadyActive} already active`,
        'success'
      );
      onComplete();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        const data = err.data as { scope?: EnrollmentScope } | undefined;
        setScope(data?.scope || scope);
        setNeedsConfirmation(true);
        setError(err.message);
      } else {
        setError(err instanceof Error ? err.message : 'Enrollment failed.');
      }
    } finally {
      setPhase('idle');
    }
  }

  const futureEligible = !preselectedStudent && effectiveMode !== 'selected';
  const wideAudience = !respectEligibility && effectiveMode !== 'selected';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={preselectedStudent ? `Manage access · ${preselectedStudent.display_name}` : 'Enroll students'}
      description="Choose a real batch or series, scope the audience, preview it, then confirm."
      size="lg"
      footer={
        result ? (
          <button
            type="button"
            onClick={onClose}
            className="ec-btn px-4 py-2 text-sm font-semibold bg-brand-600 text-white"
          >
            Done
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={onClose}
              className="ec-btn px-3 py-2 text-sm font-semibold border border-ink-200 bg-[var(--ec-surface)]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void runPreview()}
              disabled={phase !== 'idle' || !item}
              className="ec-btn px-3 py-2 text-sm font-semibold border border-ink-200 bg-[var(--ec-surface)] disabled:opacity-50"
            >
              {phase === 'previewing' ? 'Previewing…' : 'Preview audience'}
            </button>
            <button
              type="button"
              onClick={() => void runEnroll()}
              disabled={phase !== 'idle' || !item || (needsConfirmation && !confirmAll)}
              className="ec-btn px-4 py-2 text-sm font-semibold bg-brand-600 text-white disabled:opacity-50"
            >
              {phase === 'enrolling' ? 'Enrolling…' : 'Enroll students'}
            </button>
          </>
        )
      }
    >
      {result ? (
        <EnrollmentResult result={result} />
      ) : (
        <div className="space-y-5">
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-xs text-red-800 flex gap-2">
              <AlertTriangle size={16} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-ink-700 mb-1.5" htmlFor="enroll-course">
              Batch or series
            </label>
            <div className="relative">
              <select
                id="enroll-course"
                value={itemId}
                onChange={(event) => {
                  setItemId(event.target.value);
                  setPreview(null);
                  setScope(null);
                  setNeedsConfirmation(false);
                }}
                className="ec-field appearance-none pr-9"
              >
                <option value="">Choose a course…</option>
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.title} — {catalogLabel(course)}{course.active ? '' : ' (inactive)'}
                  </option>
                ))}
              </select>
              <ChevronDown size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-400" />
            </div>
            {item && (
              <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-ink-500">
                <StatusPill tone="brand">{item.exam}</StatusPill>
                <StatusPill tone="neutral">Class {item.classes.join('/')}</StatusPill>
                <StatusPill tone={isPaidCourse(item) ? 'warning' : 'success'}>{coursePriceLabel(item)}</StatusPill>
                {Boolean(catalogMeta(item).accessDays) && (
                  <span>Access {String(catalogMeta(item).accessDays)} days</span>
                )}
                {!item.active && <StatusPill tone="danger">Inactive — activate it first</StatusPill>}
              </div>
            )}
            {courses.length === 0 && (
              <p className="text-[11px] text-ink-500 mt-2">
                No batches or series exist yet. Create one in Learning → Batches or Series first.
              </p>
            )}
          </div>

          <fieldset>
            <legend className="block text-xs font-semibold text-ink-700 mb-2">Audience</legend>
            {preselectedStudent ? (
              <div className="rounded-xl border border-brand-200 bg-brand-50/60 px-3.5 py-3 text-xs text-brand-900 flex items-center gap-2">
                <UserPlus size={16} />
                <span>
                  <strong>{preselectedStudent.display_name}</strong> · {preselectedStudent.exam} · Class{' '}
                  {preselectedStudent.class_level}
                </span>
              </div>
            ) : (
              <div className="grid sm:grid-cols-3 gap-2">
                {[
                  {
                    value: 'selected' as const,
                    title: 'Selected students',
                    hint: `${uids.length} selected`,
                    icon: <Users size={16} />,
                    disabled: uids.length === 0,
                  },
                  {
                    value: 'all' as const,
                    title: 'All eligible students',
                    hint: 'Every student matching this course',
                    icon: <UsersRound size={16} />,
                    disabled: false,
                  },
                  {
                    value: 'filter' as const,
                    title: 'Filtered audience',
                    hint: 'Pick an exam and/or class',
                    icon: <Layers size={16} />,
                    disabled: false,
                  },
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    disabled={option.disabled}
                    onClick={() => {
                      setMode(option.value);
                      if (option.value === 'selected') setIncludeFuture(false);
                      setPreview(null);
                      setScope(null);
                      setNeedsConfirmation(false);
                    }}
                    className={`rounded-xl border px-3 py-2.5 text-left transition disabled:opacity-45 ${
                      mode === option.value
                        ? 'border-brand-300 bg-brand-50 ring-1 ring-brand-200'
                        : 'border-ink-200 hover:bg-ink-50'
                    }`}
                  >
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-ink-800">
                      {option.icon}
                      {option.title}
                    </span>
                    <span className="block text-[10px] text-ink-500 mt-0.5">{option.hint}</span>
                  </button>
                ))}
              </div>
            )}
            {!preselectedStudent && mode === 'filter' && (
              <div className="grid sm:grid-cols-2 gap-2 mt-2">
                <select className="ec-field !text-xs" value={exam} onChange={(event) => setExam(event.target.value as ExamFilter)}>
                  <option value="">All exams</option>
                  <option value="JEE">JEE</option>
                  <option value="NEET">NEET</option>
                </select>
                <select
                  className="ec-field !text-xs"
                  value={classLevel}
                  onChange={(event) => setClassLevel(event.target.value as ClassFilter)}
                >
                  <option value="">All classes</option>
                  <option value="11">Class 11</option>
                  <option value="12">Class 12</option>
                  <option value="Dropper">Dropper</option>
                </select>
              </div>
            )}
          </fieldset>

          <div className="space-y-2">
            <label className="flex items-start gap-2.5 rounded-xl border border-ink-200 px-3.5 py-3">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={respectEligibility}
                onChange={(event) => {
                  setRespectEligibility(event.target.checked);
                  setNeedsConfirmation(false);
                  setConfirmAll(false);
                  setPreview(null);
                }}
              />
              <span>
                <span className="block text-xs font-semibold text-ink-800">Respect JEE/NEET and class eligibility</span>
                <span className="block text-[11px] text-ink-500 mt-0.5">
                  Recommended. Students outside the course track are skipped and reported. Turn this off only for an
                  intentional cross-track grant.
                </span>
              </span>
            </label>

            <label className={`flex items-start gap-2.5 rounded-xl border px-3.5 py-3 ${futureEligible ? 'border-ink-200' : 'border-ink-100 opacity-60'}`}>
              <input
                type="checkbox"
                className="mt-0.5"
                checked={includeFuture}
                disabled={!futureEligible}
                onChange={(event) => setIncludeFuture(event.target.checked)}
              />
              <span>
                <span className="block text-xs font-semibold text-ink-800 flex items-center gap-1.5">
                  <Sparkles size={14} className="text-brand-600" />
                  All current and future eligible students
                </span>
                <span className="block text-[11px] text-ink-500 mt-0.5">
                  Creates a live auto-enrollment rule. New students who complete onboarding with a matching exam/class
                  receive access automatically. {futureEligible ? '' : 'Not available for a hand-picked list.'}
                </span>
              </span>
            </label>

            <div className="rounded-xl border border-ink-200 px-3.5 py-3">
              <label className="block text-xs font-semibold text-ink-800" htmlFor="enroll-expiry">
                Access expiry <span className="font-normal text-ink-500">(optional)</span>
              </label>
              <p className="text-[11px] text-ink-500 mt-0.5">Leave empty for ongoing access. Expired access is enforced by the API.</p>
              <input
                id="enroll-expiry"
                type="date"
                className="ec-field mt-2 !w-auto !text-xs"
                value={expiresAt}
                min={new Date(Date.now() + 86400000).toISOString().slice(0, 10)}
                onChange={(event) => setExpiresAt(event.target.value)}
              />
            </div>
          </div>

          {wideAudience && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-[11px] text-amber-900">
              <p className="flex items-center gap-1.5 font-semibold">
                <AlertTriangle size={14} /> Eligibility override on a wide audience
              </p>
              <p className="mt-1 leading-relaxed">
                This enrols every student in the selected audience, including other exam tracks or classes. Review the
                preview carefully.
              </p>
              {needsConfirmation && (
                <label className="flex items-start gap-2 mt-2 font-semibold">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={confirmAll}
                    onChange={(event) => setConfirmAll(event.target.checked)}
                  />
                  I understand this grants access across tracks/classes.
                </label>
              )}
            </div>
          )}

          {scope && (
            <div className="rounded-xl border border-brand-100 bg-brand-50/50 px-3.5 py-3">
              <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-brand-700">Scope preview</p>
              <p className="text-xs text-ink-700 mt-1">{scope.label}</p>
              <div className="grid grid-cols-3 gap-2 mt-2 text-center">
                <div className="rounded-lg bg-[var(--ec-surface)] border border-ink-100 py-1.5">
                  <p className="text-base font-bold text-ink-900">{scope.targeted}</p>
                  <p className="text-[10px] text-ink-500">audience</p>
                </div>
                <div className="rounded-lg bg-[var(--ec-surface)] border border-ink-100 py-1.5">
                  <p className="text-base font-bold text-emerald-700">{scope.eligible}</p>
                  <p className="text-[10px] text-ink-500">eligible</p>
                </div>
                <div className="rounded-lg bg-[var(--ec-surface)] border border-ink-100 py-1.5">
                  <p className="text-base font-bold text-amber-700">{scope.skipped}</p>
                  <p className="text-[10px] text-ink-500">skipped</p>
                </div>
              </div>
            </div>
          )}

          {preview && (
            <p className="text-[11px] text-ink-500">
              Preview only — no access has been granted yet. Confirm to enroll.
            </p>
          )}
        </div>
      )}
    </Modal>
  );
}

function EnrollmentResult({ result }: { result: EnrollmentBulkResult }) {
  const summary = result.summary;
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
        <CheckCircle2 size={20} className="text-emerald-600 mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-bold text-emerald-900">Enrollment finished</p>
          <p className="text-xs text-emerald-800 mt-0.5">
            {summary.eligible} eligible of {summary.targeted} in scope. The audit trail records every grant.
          </p>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { label: 'New', value: summary.created, tone: 'text-emerald-700' },
          { label: 'Reactivated', value: summary.reactivated, tone: 'text-brand-700' },
          { label: 'Already active', value: summary.alreadyActive, tone: 'text-ink-700' },
          { label: 'Skipped', value: summary.skipped, tone: 'text-amber-700' },
        ].map((row) => (
          <div key={row.label} className="rounded-xl border border-ink-200 px-3 py-2.5 text-center">
            <p className={`text-xl font-extrabold ${row.tone}`}>{row.value}</p>
            <p className="text-[10px] text-ink-500">{row.label}</p>
          </div>
        ))}
      </div>
      {summary.failed > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-xs text-red-800">
          <p className="font-semibold flex items-center gap-1.5"><AlertTriangle size={14} /> {summary.failed} write(s) failed</p>
          <ul className="mt-1 space-y-0.5">
            {(result.failures || []).slice(0, 8).map((failure) => (
              <li key={failure.uid}>{failure.name || failure.uid.slice(0, 8)} — {failure.reason}</li>
            ))}
          </ul>
        </div>
      )}
      {result.rule ? (
        <div className="rounded-xl border border-brand-200 bg-brand-50 px-3.5 py-3 text-xs text-brand-900">
          <p className="font-semibold flex items-center gap-1.5"><Sparkles size={14} /> Future auto-enrollment is now on</p>
          <p className="mt-1 text-[11px]">
            New eligible students will be enrolled in <strong>{result.rule.item_title || 'this course'}</strong> when they
            complete onboarding.
          </p>
        </div>
      ) : result.ruleError ? (
        <p className="text-[11px] text-amber-700">Enrollment succeeded, but the future auto-enrollment rule could not be saved: {result.ruleError}</p>
      ) : null}
      {Boolean(result.skipped?.length) && (
        <details className="rounded-xl border border-ink-200 px-3.5 py-3">
          <summary className="text-xs font-semibold cursor-pointer">Skipped students ({result.skipped?.length})</summary>
          <ul className="mt-2 space-y-1 text-[11px] text-ink-600">
            {result.skipped?.slice(0, 40).map((row) => (
              <li key={row.uid}>
                {row.name || row.uid.slice(0, 8)} — {SKIP_LABEL[row.reason] || row.reason}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------------- */
/* Student directory                                                         */
/* ------------------------------------------------------------------------- */

function StudentDirectory({
  onManage,
  selectedUids,
  setSelectedUids,
}: {
  onManage: (student: AdminStudentDirectoryResponse['items'][number]) => void;
  selectedUids: string[];
  setSelectedUids: (next: string[]) => void;
}) {
  const [query, setQuery] = useState('');
  const [exam, setExam] = useState<ExamFilter>('');
  const [classLevel, setClassLevel] = useState<ClassFilter>('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<AdminStudentDirectoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await searchAdminStudents({ query, exam, classLevel, page, pageSize: 25 }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load students.');
    } finally {
      setLoading(false);
    }
  }, [query, exam, classLevel, page]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 220);
    return () => clearTimeout(timer);
  }, [load]);

  const items = data?.items || [];
  const pageUids = items.map((student) => student.firebase_uid);
  const allOnPageSelected = pageUids.length > 0 && pageUids.every((uid) => selectedUids.includes(uid));
  const selectedSet = new Set(selectedUids);

  function toggle(uid: string) {
    setSelectedUids(selectedSet.has(uid) ? selectedUids.filter((entry) => entry !== uid) : [...selectedUids, uid]);
  }

  function togglePage() {
    if (allOnPageSelected) {
      setSelectedUids(selectedUids.filter((uid) => !pageUids.includes(uid)));
    } else {
      setSelectedUids(Array.from(new Set([...selectedUids, ...pageUids])));
    }
  }

  return (
    <Panel
      title="Student directory"
      description="Search real onboarded students, filter by exam/class and select students for enrollment."
      action={
        <button
          type="button"
          onClick={() => void load()}
          className="ec-btn px-2.5 py-1.5 text-xs font-semibold border border-ink-200 bg-[var(--ec-surface)] inline-flex items-center gap-1.5"
        >
          <RefreshCw size={13} /> Refresh
        </button>
      }
      bodyClassName="!p-0"
    >
      <div className="grid sm:grid-cols-[minmax(0,1fr)_130px_130px] gap-2 p-4 border-b border-ink-100">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
            placeholder="Search name, email or UID…"
            className="ec-field pl-9 !text-xs"
            type="search"
          />
        </div>
        <select
          className="ec-field !text-xs"
          value={exam}
          onChange={(event) => {
            setExam(event.target.value as ExamFilter);
            setPage(1);
          }}
        >
          <option value="">All exams</option>
          <option value="JEE">JEE</option>
          <option value="NEET">NEET</option>
        </select>
        <select
          className="ec-field !text-xs"
          value={classLevel}
          onChange={(event) => {
            setClassLevel(event.target.value as ClassFilter);
            setPage(1);
          }}
        >
          <option value="">All classes</option>
          <option value="11">Class 11</option>
          <option value="12">Class 12</option>
          <option value="Dropper">Dropper</option>
        </select>
      </div>

      {error && <div className="mx-4 mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">{error}</div>}
      {loading && !data ? (
        <div className="p-4"><Spinner label="Loading students…" /></div>
      ) : (
        <>
          <div className="flex items-center justify-between gap-3 px-4 py-2 border-b border-ink-100 text-[11px] text-ink-500">
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={allOnPageSelected} onChange={togglePage} />
              Select this page
            </label>
            <span>{data?.total ?? 0} students · {selectedUids.length} selected</span>
          </div>
          <ul className="divide-y divide-ink-100">
            {items.map((student) => (
              <li key={student.firebase_uid} className="px-4 py-2.5 flex items-center gap-3 hover:bg-ink-50/60">
                <input
                  type="checkbox"
                  checked={selectedSet.has(student.firebase_uid)}
                  onChange={() => toggle(student.firebase_uid)}
                  aria-label={`Select ${student.display_name}`}
                />
                <div className="h-8 w-8 rounded-full bg-brand-100 text-brand-700 grid place-items-center text-[11px] font-bold shrink-0">
                  {(student.display_name || 'S').slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold truncate">{student.display_name || 'Unnamed student'}</p>
                  <p className="text-[10px] text-ink-400 truncate">{student.email || student.firebase_uid}</p>
                </div>
                <div className="hidden sm:flex items-center gap-1.5 shrink-0">
                  <StatusPill tone="brand">{student.exam}</StatusPill>
                  <StatusPill tone="neutral">{formatClassLevel(student.class_level)}</StatusPill>
                </div>
                <button
                  type="button"
                  onClick={() => onManage(student)}
                  className="ec-btn px-2.5 py-1 text-[11px] font-semibold border border-ink-200 bg-[var(--ec-surface)] inline-flex items-center gap-1"
                >
                  <UserPlus size={12} /> Access
                </button>
              </li>
            ))}
            {items.length === 0 && !error && (
              <li className="px-4 py-10 text-center text-xs text-ink-500">
                No students match this search. New students appear here after completing onboarding.
              </li>
            )}
          </ul>
          <div className="p-4">
            <Pagination page={page} pageSize={data?.pageSize || 25} total={data?.total || 0} onPage={setPage} />
          </div>
        </>
      )}
    </Panel>
  );
}

/* ------------------------------------------------------------------------- */
/* Enrollment records                                                        */
/* ------------------------------------------------------------------------- */

function EnrollmentRecords({ refreshKey }: { refreshKey: number }) {
  const { push } = useToast();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'active' | 'revoked' | 'all'>('all');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Awaited<ReturnType<typeof getAdminEnrollmentList>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revokeIds, setRevokeIds] = useState<string[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [working, setWorking] = useState(false);
  const [restoreId, setRestoreId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await getAdminEnrollmentList({ query, status, page, pageSize: 25 }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load enrollments.');
    } finally {
      setLoading(false);
    }
  }, [query, status, page]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 220);
    return () => clearTimeout(timer);
  }, [load, refreshKey]);

  const items = data?.items || [];
  const pageIds = items.map((row) => row.id);
  const allSelected = pageIds.length > 0 && pageIds.every((id) => selected.includes(id));

  function toggle(id: string) {
    setSelected((previous) => (previous.includes(id) ? previous.filter((row) => row !== id) : [...previous, id]));
  }

  async function revokeSelected() {
    const rows = items.filter((row) => revokeIds.includes(row.id) && row.active);
    if (!rows.length) {
      setRevokeIds([]);
      return;
    }
    const groups = new Map<string, { itemType: 'batch' | 'series'; itemId: string; uids: string[] }>();
    for (const row of rows) {
      const key = `${row.item_type}:${row.item_id}`;
      const group = groups.get(key) || { itemType: row.item_type, itemId: row.item_id, uids: [] };
      group.uids.push(row.firebase_uid);
      groups.set(key, group);
    }
    setWorking(true);
    let revoked = 0;
    let failed = 0;
    try {
      for (const group of groups.values()) {
        const result = await bulkRevokeEnrollments({ itemType: group.itemType, itemId: group.itemId, studentUids: group.uids });
        revoked += result.revoked;
        failed += result.failed;
      }
      push(`${revoked} enrollment(s) revoked${failed ? ` · ${failed} failed` : ''}`, failed ? 'error' : 'success');
      setSelected([]);
      await load();
    } catch (err) {
      push(err instanceof Error ? err.message : 'Could not revoke access.', 'error');
    } finally {
      setWorking(false);
      setRevokeIds([]);
    }
  }

  return (
    <>
      {error && <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">{error}</div>}
      <Panel
        title="Enrollment records"
        description="Every grant with status, source, expiry and audit-backed revocation. Revoke is reversible soft removal."
        action={
          <div className="flex flex-wrap items-center gap-2">
            {selected.length > 0 && (
              <button
                type="button"
                onClick={() => setRevokeIds(selected)}
                disabled={working}
                className="ec-btn px-3 py-1.5 text-xs font-semibold bg-red-600 text-white disabled:opacity-50 inline-flex items-center gap-1.5"
              >
                <CircleSlash size={13} /> Revoke selected ({selected.length})
              </button>
            )}
            <button
              type="button"
              onClick={() => void load()}
              className="ec-btn px-2.5 py-1.5 text-xs font-semibold border border-ink-200 bg-[var(--ec-surface)] inline-flex items-center gap-1.5"
            >
              <RefreshCw size={13} /> Refresh
            </button>
          </div>
        }
        bodyClassName="!p-0"
      >
        <div className="grid sm:grid-cols-[minmax(0,1fr)_auto] gap-2 p-4 border-b border-ink-100">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
            <input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
              placeholder="Search student name, email or UID…"
              className="ec-field pl-9 !text-xs"
              type="search"
            />
          </div>
          <Segmented
            size="sm"
            value={status}
            onChange={(next) => {
              setStatus(next);
              setPage(1);
            }}
            options={[
              { value: 'all', label: 'All' },
              { value: 'active', label: 'Active' },
              { value: 'revoked', label: 'Revoked' },
            ]}
          />
        </div>
        <div className="flex flex-wrap items-center gap-3 px-4 py-2 border-b border-ink-100 text-[11px] text-ink-500">
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={() =>
                setSelected(allSelected ? selected.filter((id) => !pageIds.includes(id)) : Array.from(new Set([...selected, ...pageIds])))
              }
            />
            Select this page
          </label>
          <span className="ml-auto">
            {data?.counts.active ?? 0} active · {data?.counts.revoked ?? 0} revoked · {data?.total ?? 0} matching
          </span>
        </div>

        {loading ? (
          <div className="p-4"><Spinner label="Loading enrollment records…" /></div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="ec-table min-w-[820px]">
                <thead>
                  <tr>
                    <th className="w-8" />
                    <th>Student</th>
                    <th>Course</th>
                    <th>Status</th>
                    <th>Source</th>
                    <th>Granted</th>
                    <th>Expiry</th>
                    <th className="text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <input
                          type="checkbox"
                          checked={selected.includes(row.id)}
                          onChange={() => toggle(row.id)}
                          aria-label={`Select ${row.student_name || row.firebase_uid}`}
                        />
                      </td>
                      <td>
                        <p className="font-semibold text-ink-900">{row.student_name || 'Unknown student'}</p>
                        <p className="text-[10px] text-ink-400">{row.student_email || row.firebase_uid}</p>
                      </td>
                      <td>
                        <p className="font-medium">{row.item_title || 'Untitled'}</p>
                        <p className="text-[10px] text-ink-400">{row.item_type} · {row.exam || '—'} · {row.class_level ? formatClassLevel(row.class_level) : '—'}</p>
                      </td>
                      <td>
                        <StatusPill tone={row.active ? 'success' : 'danger'}>
                          {row.active ? 'Active' : 'Revoked'}
                        </StatusPill>
                      </td>
                      <td className="text-[11px] text-ink-600">{SOURCE_LABEL[row.source] || row.source}</td>
                      <td className="text-[11px] text-ink-600">{formatISTDateTime(row.created_at)}</td>
                      <td className="text-[11px] text-ink-600">{formatDate(row.expires_at)}</td>
                      <td className="text-right">
                        {row.active ? (
                          <button
                            type="button"
                            onClick={() => setRevokeIds([row.id])}
                            className="text-[11px] font-semibold text-red-600 hover:underline"
                          >
                            Revoke
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setRestoreId(row.id)}
                            className="text-[11px] font-semibold text-brand-700 hover:underline"
                          >
                            Restore
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {items.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-10 text-center text-xs text-ink-500">
                        No enrollment records match this filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="p-4">
              <Pagination page={page} pageSize={data?.pageSize || 25} total={data?.total || 0} onPage={setPage} />
            </div>
          </>
        )}
      </Panel>

      <ConfirmDialog
        open={revokeIds.length > 0}
        title={revokeIds.length === 1 ? 'Revoke this enrollment?' : `Revoke ${revokeIds.length} enrollments?`}
        description="Students lose access immediately. Records are marked revoked (not deleted), and the audit trail keeps a restore path."
        confirmLabel="Revoke access"
        loading={working}
        onCancel={() => setRevokeIds([])}
        onConfirm={() => void revokeSelected()}
      />
      <RestoreDialog
        open={Boolean(restoreId)}
        enrollmentId={restoreId}
        onClose={() => setRestoreId(null)}
        onRestored={async () => {
          setRestoreId(null);
          await load();
          push('Access restored.', 'success');
        }}
      />
    </>
  );
}

function RestoreDialog({
  open,
  enrollmentId,
  onClose,
  onRestored,
}: {
  open: boolean;
  enrollmentId: string | null;
  onClose: () => void;
  onRestored: () => Promise<void>;
}) {
  const [expiresAt, setExpiresAt] = useState('');
  const [force, setForce] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const { push } = useToast();

  useEffect(() => {
    if (!open) return;
    setExpiresAt('');
    setForce(false);
    setError(null);
  }, [open, enrollmentId]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Restore access"
      description="Reinstate the enrollment. Optionally set a new expiry; the restore is audited."
      size="sm"
      footer={
        <>
          <button type="button" onClick={onClose} className="ec-btn px-3 py-2 text-sm font-semibold border border-ink-200">
            Cancel
          </button>
          <button
            type="button"
            disabled={working}
            onClick={async () => {
              if (!enrollmentId) {
                setError('No enrollment selected.');
                return;
              }
              setWorking(true);
              setError(null);
              try {
                await restoreAdminEnrollment(enrollmentId, {
                  expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
                  force,
                });
                await onRestored();
              } catch (err) {
                setError(err instanceof Error ? err.message : 'Could not restore access.');
                push('Could not restore access.', 'error');
              } finally {
                setWorking(false);
              }
            }}
            className="ec-btn px-3 py-2 text-sm font-semibold bg-brand-600 text-white disabled:opacity-50"
          >
            {working ? 'Restoring…' : 'Restore access'}
          </button>
        </>
      }
    >
      <div className="space-y-3 text-sm">
        {error && <p className="rounded-lg bg-red-50 border border-red-200 px-2.5 py-2 text-xs text-red-800">{error}</p>}
        <label className="block text-xs font-semibold">
          New expiry <span className="font-normal text-ink-500">(optional)</span>
          <input
            type="date"
            value={expiresAt}
            className="ec-field mt-1 !text-xs"
            min={new Date(Date.now() + 86400000).toISOString().slice(0, 10)}
            onChange={(event) => setExpiresAt(event.target.value)}
          />
        </label>
        <label className="flex items-start gap-2 text-xs">
          <input type="checkbox" checked={force} onChange={(event) => setForce(event.target.checked)} className="mt-0.5" />
          Override exam/class mismatch if the student&apos;s eligibility has changed.
        </label>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------------- */
/* Rules and history                                                         */
/* ------------------------------------------------------------------------- */

function RulesPanel({ refreshKey, onChanged }: { refreshKey: number; onChanged: () => void }) {
  const { push } = useToast();
  const [rules, setRules] = useState<EnrollmentRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRules(await getEnrollmentRules());
    } catch (err) {
      push(err instanceof Error ? err.message : 'Could not load auto-enrollment rules.', 'error');
    } finally {
      setLoading(false);
    }
  }, [push]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  async function toggle(rule: EnrollmentRule) {
    setBusyId(rule.id);
    try {
      await setEnrollmentRuleActive(rule.id, !rule.active);
      setRules((previous) => previous.map((row) => (row.id === rule.id ? { ...row, active: !row.active } : row)));
      push(rule.active ? 'Future auto-enrollment paused.' : 'Future auto-enrollment resumed.', 'success');
    } catch (err) {
      push(err instanceof Error ? err.message : 'Could not update the rule.', 'error');
    } finally {
      setBusyId(null);
    }
  }

  async function remove(id: string) {
    setBusyId(id);
    try {
      await deleteEnrollmentRule(id);
      setRules((previous) => previous.filter((row) => row.id !== id));
      push('Auto-enrollment rule deleted. Existing enrollments are untouched.', 'success');
      onChanged();
    } catch (err) {
      push(err instanceof Error ? err.message : 'Could not delete the rule.', 'error');
    } finally {
      setBusyId(null);
      setDeleteId(null);
    }
  }

  return (
    <>
      <Panel
        title="Future auto-enrollment"
        description="Rules created by “All current and future eligible students”. New students are matched when they finish onboarding."
        action={
          <button type="button" onClick={() => void load()} className="ec-btn px-2.5 py-1.5 text-xs font-semibold border border-ink-200 inline-flex items-center gap-1.5">
            <RefreshCw size={13} /> Refresh
          </button>
        }
      >
        {loading ? (
          <Spinner label="Loading rules…" />
        ) : rules.length === 0 ? (
          <div className="rounded-xl border border-dashed border-ink-200 px-4 py-8 text-center">
            <Sparkles className="mx-auto text-brand-500" size={22} />
            <p className="text-sm font-semibold mt-2">No future auto-enrollment yet</p>
            <p className="text-xs text-ink-500 mt-1 max-w-md mx-auto">
              When enrolling, choose “All current and future eligible students”. The rule will appear here, and you can
              pause it without touching existing access.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {rules.map((rule) => (
              <li key={rule.id} className="rounded-xl border border-ink-200 px-3.5 py-3 flex flex-wrap items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-brand-50 text-brand-700 grid place-items-center shrink-0">
                  {rule.item_type === 'batch' ? <Layers size={16} /> : <ClipboardList size={16} />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold truncate">{rule.item_title || rule.name || rule.item_id}</p>
                  <p className="text-[10px] text-ink-500">
                    {rule.item_type} · {rule.filter_exam || 'all exams'} · {rule.filter_class ? formatClassLevel(rule.filter_class) : 'all classes'} ·
                    {' '}{rule.respect_eligibility ? 'eligibility enforced' : 'eligibility override'} ·{' '}
                    {rule.last_applied_count} auto-enrolled
                  </p>
                </div>
                <StatusPill tone={rule.active ? 'success' : 'neutral'}>{rule.active ? 'Live' : 'Paused'}</StatusPill>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void toggle(rule)}
                    disabled={busyId === rule.id}
                    className="ec-btn px-2.5 py-1 text-[11px] font-semibold border border-ink-200 disabled:opacity-50"
                  >
                    {rule.active ? 'Pause' : 'Resume'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteId(rule.id)}
                    disabled={busyId === rule.id}
                    className="text-[11px] font-semibold text-red-600 disabled:opacity-50"
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <ConfirmDialog
        open={Boolean(deleteId)}
        title="Delete this auto-enrollment rule?"
        description="Future students will no longer be enrolled automatically. Students who already have access keep it."
        confirmLabel="Delete rule"
        loading={busyId === deleteId}
        onCancel={() => setDeleteId(null)}
        onConfirm={() => deleteId && void remove(deleteId)}
      />
    </>
  );
}

function HistoryPanel({ refreshKey }: { refreshKey: number }) {
  const [events, setEvents] = useState<EnrollmentHistoryEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setEvents(await getEnrollmentHistory(150));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load history.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  return (
    <Panel title="Enrollment history" description="Immutable audit of grants, reactivations, revocations and automatic enrollments.">
      {error && <p className="text-xs text-red-700 mb-2">{error}</p>}
      {loading ? (
        <Spinner label="Loading history…" />
      ) : events.length === 0 ? (
        <div className="text-center py-8">
          <History className="mx-auto text-ink-400" size={22} />
          <p className="text-xs text-ink-500 mt-2">No enrollment events recorded yet.</p>
        </div>
      ) : (
        <ol className="space-y-2 max-h-[560px] overflow-y-auto pr-1">
          {events.map((event) => (
            <li key={event.id} className="relative rounded-xl border border-ink-200 px-3.5 py-2.5 flex items-start gap-3">
              <StatusPill tone={actionTone(event.action)}>{actionLabel(event.action)}</StatusPill>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-ink-800">
                  <strong>{event.student_name || event.student_email || event.firebase_uid.slice(0, 10)}</strong>
                  {' · '}
                  {event.item_title || `${event.item_type} ${event.item_id.slice(0, 8)}`}
                </p>
                <p className="text-[10px] text-ink-500 mt-0.5">
                  {formatISTDateTime(event.created_at)} · {SOURCE_LABEL[event.source] || event.source}
                  {event.actor_email ? ` · by ${event.actor_email}` : ''}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}

/* ------------------------------------------------------------------------- */
/* Main console                                                              */
/* ------------------------------------------------------------------------- */

export function EnrollmentConsole() {
  const [tab, setTab] = useState<Tab>('students');
  const [courses, setCourses] = useState<CourseCatalogItem[]>([]);
  const [coursesError, setCoursesError] = useState<string | null>(null);
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [preselected, setPreselected] = useState<AdminStudentDirectoryResponse['items'][number] | null>(null);
  const [selectedUids, setSelectedUids] = useState<string[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [summary, setSummary] = useState<{ active: number; revoked: number; total: number; students: number; rules: number }>({
    active: 0,
    revoked: 0,
    total: 0,
    students: 0,
    rules: 0,
  });

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [content, enrollments, students, rules] = await Promise.all([
          getAdminContentList(),
          getAdminEnrollmentList({ pageSize: 1 }),
          searchAdminStudents({ page: 1, pageSize: 1 }),
          getEnrollmentRules(),
        ]);
        if (!mounted) return;
        setCourses(content.filter((item) => item.kind === 'batch' || item.kind === 'series'));
        setSummary({
          active: enrollments.counts.active,
          revoked: enrollments.counts.revoked,
          total: enrollments.counts.total,
          students: students.total,
          rules: rules.filter((rule) => rule.active).length,
        });
      } catch (err) {
        if (mounted) setCoursesError(err instanceof Error ? err.message : 'Could not load the enrollment workspace.');
      }
    })();
    return () => {
      mounted = false;
    };
  }, [refreshKey]);

  function refresh() {
    setRefreshKey((value) => value + 1);
  }

  return (
    <div>
      <AdminPageHeader
        eyebrow="Students & access"
        title="Students & enrollments"
        description="Grant free or paid access to batches and series, enroll everyone eligible, and keep an enforceable audit trail. Server-side admin checks and database uniqueness prevent duplicate or self-granted access."
        meta={
          <>
            <StatusPill tone="brand"><Users size={12} /> {summary.students} students</StatusPill>
            <StatusPill tone="success"><ShieldCheck size={12} /> {summary.active} active enrollments</StatusPill>
            <StatusPill tone="warning"><Sparkles size={12} /> {summary.rules} live future rules</StatusPill>
          </>
        }
        actions={
          <button
            type="button"
            onClick={() => {
              setPreselected(null);
              setEnrollOpen(true);
            }}
            className="ec-btn px-3.5 py-2 text-xs font-bold bg-brand-600 text-white inline-flex items-center gap-1.5"
          >
            <UserPlus size={14} /> Enroll students
          </button>
        }
      />

      {coursesError && (
        <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-xs text-red-800">
          {coursesError}
        </div>
      )}

      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3 mb-4">
        <StatCard label="Active access" value={summary.active} hint={`${summary.total} total records`} tone="success" icon={<ShieldCheck size={16} />} />
        <StatCard label="Revoked" value={summary.revoked} hint="Soft removal · restorable" tone="danger" icon={<CircleSlash size={16} />} />
        <StatCard label="Students" value={summary.students} hint="Onboarded profiles" tone="brand" icon={<Users size={16} />} />
        <StatCard label="Future rules" value={summary.rules} hint="Auto-enroll on onboarding" tone="warning" icon={<Sparkles size={16} />} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: 'students', label: 'Students', icon: '◍' },
            { value: 'records', label: 'Enrollments', icon: '▤' },
            { value: 'rules', label: 'Auto-enrollment', icon: '✦' },
            { value: 'history', label: 'History', icon: '◷' },
          ]}
        />
        {tab === 'students' && selectedUids.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-ink-500">{selectedUids.length} selected</span>
            <button
              type="button"
              onClick={() => setSelectedUids([])}
              className="text-[11px] font-semibold text-ink-500 inline-flex items-center gap-1"
            >
              <X size={12} /> Clear
            </button>
            <button
              type="button"
              onClick={() => {
                setPreselected(null);
                setEnrollOpen(true);
              }}
              className="ec-btn px-3 py-1.5 text-xs font-bold bg-ink-900 text-white inline-flex items-center gap-1.5"
            >
              Enroll selected <ArrowRight size={13} />
            </button>
          </div>
        )}
      </div>

      {tab === 'students' && (
        <StudentDirectory
          onManage={(student) => {
            setPreselected(student);
            setEnrollOpen(true);
          }}
          selectedUids={selectedUids}
          setSelectedUids={setSelectedUids}
        />
      )}
      {tab === 'records' && <EnrollmentRecords refreshKey={refreshKey} />}
      {tab === 'rules' && <RulesPanel refreshKey={refreshKey} onChanged={refresh} />}
      {tab === 'history' && <HistoryPanel refreshKey={refreshKey} />}

      <EnrollModal
        open={enrollOpen}
        courses={courses}
        preselectedStudent={preselected}
        selectedUids={selectedUids}
        onClose={() => {
          setEnrollOpen(false);
          setPreselected(null);
        }}
        onComplete={() => {
          refresh();
        }}
      />
    </div>
  );
}

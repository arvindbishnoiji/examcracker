'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';
import {
  AdminPageHeader,
  Banner,
  ConfirmDialog,
  Field,
  Modal,
  Panel,
  SearchInput,
  Spinner,
  StatusPill,
} from '@/components/admin/ui';
import { useToast } from '@/hooks/useToast';
import {
  ApiError,
  archiveAdminSubject,
  createAdminSubject,
  getAdminContentList,
  getAdminSubjects,
  removeCourseSubject,
  setCourseSubjects,
  updateAdminSubject,
  type AdminSubjectInput,
} from '@/lib/api';
import type { ClassLevel, ContentExam, CourseCatalogItem, Subject } from '@/types';

type FormState = {
  name: string;
  description: string;
  exam: ContentExam;
  classes: ClassLevel[];
  active: boolean;
  sortOrder: string;
};

const EMPTY_FORM: FormState = {
  name: '',
  description: '',
  exam: 'Both',
  classes: ['11', '12'],
  active: true,
  sortOrder: '',
};

function toPayload(form: FormState): AdminSubjectInput {
  return {
    name: form.name.trim(),
    description: form.description.trim(),
    exam: form.exam,
    classes: form.classes,
    active: form.active,
    sortOrder: form.sortOrder ? Number(form.sortOrder) : 0,
  };
}

export function SubjectsSection() {
  const { push } = useToast();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [courses, setCourses] = useState<CourseCatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [exam, setExam] = useState<ContentExam | ''>('');
  const [classLevel, setClassLevel] = useState<ClassLevel | ''>('');
  const [includeArchived, setIncludeArchived] = useState(true);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Subject | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [assigning, setAssigning] = useState<Subject | null>(null);
  const [selectedCourse, setSelectedCourse] = useState('');
  const [assignSaving, setAssignSaving] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);
  const [pendingRemoval, setPendingRemoval] = useState<{ courseId: string; courseTitle: string } | null>(null);
  const [detachTarget, setDetachTarget] = useState<{
    subject: Subject;
    assignment: { courseId: string; courseTitle: string };
  } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await getAdminSubjects({
        query,
        exam,
        classLevel,
        includeArchived,
      });
      setSubjects(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Subjects could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [query, exam, classLevel, includeArchived]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void load();
    }, 250);
    return () => window.clearTimeout(handle);
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      getAdminContentList({ kind: 'batch' }),
      getAdminContentList({ kind: 'series' }),
    ])
      .then(([batches, series]) => {
        if (cancelled) return;
        setCourses([...batches, ...series]);
      })
      .catch(() => {
        if (!cancelled) setCourses([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const batches = useMemo(() => courses.filter((course) => course.kind === 'batch'), [courses]);
  const series = useMemo(() => courses.filter((course) => course.kind === 'series'), [courses]);

  const selectedCourseSubjects = useMemo(() => {
    if (!selectedCourse) return new Set<string>();
    const target = courses.find((course) => course.id === selectedCourse);
    const fromColumn = target?.subjectId ? [target.subjectId] : [];
    const assigned = subjects
      .filter((subject) => subject.assignments?.some((item) => item.courseId === selectedCourse))
      .map((subject) => subject.id);
    return new Set<string>([...fromColumn, ...assigned]);
  }, [selectedCourse, courses, subjects]);

  const linkedLectures = useMemo(() => {
    if (!selectedCourse) return 0;
    return subjects.reduce((total, subject) => {
      const assignment = subject.assignments?.find((item) => item.courseId === selectedCourse);
      return total + (assignment?.lectureCount || 0);
    }, 0);
  }, [selectedCourse, subjects]);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setFormOpen(true);
  }

  function openEdit(subject: Subject) {
    setEditing(subject);
    setForm({
      name: subject.name,
      description: subject.description || '',
      exam: subject.exam,
      classes: subject.classes.length ? subject.classes : ['11', '12'],
      active: subject.active,
      sortOrder: String(subject.sortOrder || ''),
    });
    setFormError(null);
    setFormOpen(true);
  }

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    const payload = toPayload(form);
    if (!payload.name) {
      setFormError('A subject name is required.');
      return;
    }
    if (payload.name.length > 80) {
      setFormError('Subject names are limited to 80 characters.');
      return;
    }
    if (!payload.classes || payload.classes.length === 0) {
      setFormError('Choose at least one class (11 or 12).');
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      if (editing) {
        await updateAdminSubject(editing.id, payload);
        push(`Updated ${payload.name}.`, 'success');
      } else {
        await createAdminSubject(payload);
        push(`Created ${payload.name}.`, 'success');
      }
      setFormOpen(false);
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'The subject could not be saved.');
    } finally {
      setSaving(false);
    }
  }

  async function handleRestore(subject: Subject) {
    try {
      await updateAdminSubject(subject.id, {
        name: subject.name,
        description: subject.description,
        exam: subject.exam,
        classes: subject.classes,
        active: true,
        archived: false,
        sortOrder: subject.sortOrder,
      });
      push(`${subject.name} restored.`, 'success');
      await load();
    } catch (err) {
      push(err instanceof Error ? err.message : 'The subject could not be restored.', 'error');
    }
  }

  async function handleArchive(subject: Subject) {
    try {
      await archiveAdminSubject(subject.id);
      push(`${subject.name} archived. Existing lectures keep working; it is hidden from new assignments.`, 'success');
      await load();
    } catch (err) {
      push(err instanceof Error ? err.message : 'The subject could not be archived.', 'error');
    }
  }

  async function handleAssign(subject: Subject) {
    if (!selectedCourse) {
      setAssignError('Choose a batch or series first.');
      return;
    }
    setAssignSaving(true);
    setAssignError(null);
    const currentIds = subjects
      .filter((item) => item.assignments?.some((entry) => entry.courseId === selectedCourse))
      .map((item) => item.id);
    const nextIds = Array.from(new Set([...currentIds, subject.id]));
    try {
      await setCourseSubjects(selectedCourse, nextIds);
      push(`${subject.name} is now available in this course.`, 'success');
      await load();
    } catch (err) {
      setAssignError(err instanceof Error ? err.message : 'The subject could not be assigned.');
    } finally {
      setAssignSaving(false);
    }
  }

  async function handleRemoveAssignment(assignment: { courseId: string; courseTitle: string }, subject: Subject) {
    setPendingRemoval(assignment);
    setAssignError(null);
    try {
      await removeCourseSubject(assignment.courseId, subject.id);
      push(`${subject.name} removed from ${assignment.courseTitle}.`, 'success');
      await load();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setAssignError(
          `${assignment.courseTitle} still has lectures linked to ${subject.name}. Move or delete those lectures first, then remove the subject.`
        );
      } else {
        setAssignError(err instanceof Error ? err.message : 'The assignment could not be removed.');
      }
    } finally {
      setPendingRemoval(null);
    }
  }

  async function confirmDetach() {
    if (!detachTarget) return;
    const target = detachTarget;
    setDetachTarget(null);
    await handleRemoveAssignment(target.assignment, target.subject);
  }

  const activeCount = subjects.filter((subject) => !subject.archived && subject.active).length;
  const archivedCount = subjects.filter((subject) => subject.archived).length;

  return (
    <div className="space-y-5">
      <AdminPageHeader
        eyebrow="Learning content"
        title="Subjects"
        description="Create the subject catalogue, decide which exam tracks and classes each subject applies to, and attach subjects to batches or series. Students only see the subjects you assign."
        actions={
          <Button size="sm" onClick={openCreate}>
            + New subject
          </Button>
        }
        meta={
          <>
            <StatusPill tone="brand">{subjects.length} shown</StatusPill>
            <StatusPill tone="success">{activeCount} active</StatusPill>
            <StatusPill tone="neutral">{archivedCount} archived</StatusPill>
          </>
        }
      />

      <Banner tone="info" title="Subjects are the middle layer">
        Hierarchy is <strong>Batch / Series → Subject → Lectures &amp; resources</strong>. A lecture can only use a subject
        assigned to its parent course — the API rejects mismatched pairs, and removing a subject that still has lectures
        is blocked with a 409 instead of silently detaching content.
      </Banner>

      <Panel title="Search and filter" description="Filtering runs on the server so archived and unrelated subjects never leak in.">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Search">
            <SearchInput value={query} onChange={setQuery} placeholder="Name, description or course…" />
          </Field>
          <Field label="Exam track">
            <select className="ec-field" value={exam} onChange={(event) => setExam(event.target.value as ContentExam | '')}>
              <option value="">All exams</option>
              <option value="JEE">JEE</option>
              <option value="NEET">NEET</option>
              <option value="Both">Both</option>
            </select>
          </Field>
          <Field label="Class">
            <select
              className="ec-field"
              value={classLevel}
              onChange={(event) => setClassLevel(event.target.value as ClassLevel | '')}
            >
              <option value="">All classes</option>
              <option value="11">Class 11</option>
              <option value="12">Class 12</option>
            </select>
          </Field>
          <Field label="Archived subjects">
            <select
              className="ec-field"
              value={includeArchived ? '1' : '0'}
              onChange={(event) => setIncludeArchived(event.target.value === '1')}
            >
              <option value="1">Include archived</option>
              <option value="0">Active only</option>
            </select>
          </Field>
        </div>
      </Panel>

      {error && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
          <Button size="sm" variant="outline" className="ml-2" onClick={() => void load()}>
            Retry
          </Button>
        </div>
      )}

      {loading && subjects.length === 0 ? (
        <div className="grid place-items-center py-16">
          <Spinner label="Loading subjects…" />
        </div>
      ) : subjects.length === 0 ? (
        <div className="ec-card p-8 text-center">
          <p className="text-sm font-bold">No subjects match this filter</p>
          <p className="mt-1 text-xs text-ink-500">
            Create a subject such as “Physics”, “Organic Chemistry” or “Human Physiology” to start grouping lectures.
          </p>
          <Button size="sm" className="mt-4" onClick={openCreate}>
            + New subject
          </Button>
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {subjects.map((subject) => (
            <Panel
              key={subject.id}
              title={subject.name}
              description={subject.description || 'No description yet.'}
              action={
                <div className="flex flex-wrap gap-1.5">
                  <Button size="sm" variant="outline" onClick={() => openEdit(subject)}>
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setAssigning(subject);
                      setAssignError(null);
                      setSelectedCourse(subject.assignments?.[0]?.courseId || '');
                    }}
                  >
                    Assign
                  </Button>
                  {subject.archived ? (
                    <Button size="sm" variant="outline" onClick={() => void handleRestore(subject)}>
                      Restore
                    </Button>
                  ) : (
                    <Button size="sm" variant="danger" onClick={() => void handleArchive(subject)}>
                      Archive
                    </Button>
                  )}
                </div>
              }
            >
              <div className="flex flex-wrap gap-1.5">
                <StatusPill tone="brand">{subject.exam}</StatusPill>
                <StatusPill tone="neutral">Class {subject.classes.join(' / ')}</StatusPill>
                <StatusPill tone={subject.archived ? 'danger' : subject.active ? 'success' : 'warning'}>
                  {subject.archived ? 'Archived' : subject.active ? 'Active' : 'Hidden'}
                </StatusPill>
                <StatusPill tone="info">{subject.lectureCount || 0} lectures</StatusPill>
                <StatusPill tone="neutral">Order {subject.sortOrder}</StatusPill>
              </div>

              <div className="mt-3 space-y-2">
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-ink-500">Used by</p>
                {subject.assignments && subject.assignments.length > 0 ? (
                  <ul className="space-y-1.5">
                    {subject.assignments.map((assignment) => (
                      <li
                        key={`${subject.id}-${assignment.courseId}`}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-ink-100 bg-ink-50/50 px-3 py-2"
                      >
                        <span className="min-w-0 text-xs font-semibold text-ink-700">
                          {assignment.courseTitle}
                          <span className="ml-1.5 font-normal text-ink-400">
                            {assignment.courseKind} · {assignment.lectureCount} lecture
                            {assignment.lectureCount === 1 ? '' : 's'}
                          </span>
                        </span>
                        <button
                          type="button"
                          className="text-[11px] font-bold text-red-600 hover:underline disabled:opacity-50"
                          disabled={pendingRemoval?.courseId === assignment.courseId}
                          onClick={() => setDetachTarget({ subject, assignment })}
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="rounded-xl border border-dashed border-ink-200 px-3 py-2 text-[11px] text-ink-500">
                    Not assigned to any batch or series yet. Students cannot see it until you assign it.
                  </p>
                )}
              </div>
            </Panel>
          ))}
        </div>
      )}

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? `Edit ${editing.name}` : 'New subject'}
        description="Subjects apply to an exam track and one or both classes."
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setFormOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button size="sm" form="subject-form" type="submit" loading={saving}>
              {editing ? 'Save changes' : 'Create subject'}
            </Button>
          </>
        }
      >
        <form id="subject-form" onSubmit={handleSave} className="space-y-3">
          <Field label="Subject name" required htmlFor="subject-name">
            <Input
              id="subject-name"
              value={form.name}
              maxLength={80}
              placeholder="e.g. Physics"
              onChange={(event) => setForm((state) => ({ ...state, name: event.target.value }))}
              required
            />
          </Field>
          <Field label="Description" help="Shown to students on the course page. Optional." htmlFor="subject-description">
            <Textarea
              id="subject-description"
              rows={3}
              value={form.description}
              maxLength={500}
              onChange={(event) => setForm((state) => ({ ...state, description: event.target.value }))}
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Exam track" required>
              <select
                className="ec-field"
                value={form.exam}
                onChange={(event) => setForm((state) => ({ ...state, exam: event.target.value as ContentExam }))}
              >
                <option value="JEE">JEE</option>
                <option value="NEET">NEET</option>
                <option value="Both">Both</option>
              </select>
            </Field>
            <Field label="Sort order" help="Lower numbers appear first.">
              <Input
                type="number"
                min={0}
                max={9999}
                value={form.sortOrder}
                onChange={(event) => setForm((state) => ({ ...state, sortOrder: event.target.value }))}
              />
            </Field>
          </div>
          <Field label="Applies to classes" required>
            <div className="flex gap-3 pt-1">
              {(['11', '12'] as ClassLevel[]).map((level) => (
                <label key={level} className="flex items-center gap-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    checked={form.classes.includes(level)}
                    onChange={(event) =>
                      setForm((state) => ({
                        ...state,
                        classes: event.target.checked
                          ? Array.from(new Set([...state.classes, level]))
                          : state.classes.filter((value) => value !== level),
                      }))
                    }
                  />
                  Class {level}
                </label>
              ))}
            </div>
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(event) => setForm((state) => ({ ...state, active: event.target.checked }))}
            />
            Visible to students where assigned
          </label>
          {editing?.archived && (
            <p className="rounded-xl border border-amber-200 bg-amber-50 p-2.5 text-[11px] text-amber-900">
              This subject is archived and hidden from new assignments. Use <strong>Restore</strong> in the list to make it
              available again.
            </p>
          )}
          {formError && (
            <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-2.5 text-xs text-red-700">
              {formError}
            </p>
          )}
        </form>
      </Modal>

      <Modal
        open={Boolean(assigning)}
        onClose={() => setAssigning(null)}
        title={assigning ? `Assign ${assigning.name}` : 'Assign subject'}
        description="Pick a batch or series. Saving replaces that course's subject list with the union below."
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setAssigning(null)}>
              Close
            </Button>
            {assigning && (
              <Button size="sm" loading={assignSaving} onClick={() => void handleAssign(assigning)}>
                Assign to course
              </Button>
            )}
          </>
        }
      >
        <div className="space-y-3">
          <Field label="Batch or series">
            <select className="ec-field" value={selectedCourse} onChange={(event) => setSelectedCourse(event.target.value)}>
              <option value="">Choose a course…</option>
              {batches.length > 0 && (
                <optgroup label="Batches">
                  {batches.map((course) => (
                    <option key={course.id} value={course.id}>
                      {course.title}
                      {course.active ? '' : ' (inactive)'}
                    </option>
                  ))}
                </optgroup>
              )}
              {series.length > 0 && (
                <optgroup label="Series">
                  {series.map((course) => (
                    <option key={course.id} value={course.id}>
                      {course.title}
                      {course.active ? '' : ' (inactive)'}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </Field>

          {selectedCourse ? (
            <div className="rounded-xl border border-ink-100 bg-ink-50/50 p-3 text-xs text-ink-600">
              <p className="font-semibold text-ink-800">
                {courses.find((course) => course.id === selectedCourse)?.title}
              </p>
              <p className="mt-0.5">
                {selectedCourseSubjects.size} subject{selectedCourseSubjects.size === 1 ? '' : 's'} assigned ·{' '}
                {linkedLectures} linked lecture{linkedLectures === 1 ? '' : 's'}
              </p>
            </div>
          ) : null}

          <p className="text-[11px] text-ink-500">
            {assigning
              ? `${assigning.name} will be available for lectures inside the selected course. If it is already assigned, nothing changes.`
              : ''}
          </p>

          {assignError && (
            <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-2.5 text-xs text-red-700">
              {assignError}
            </p>
          )}
        </div>
      </Modal>
      <ConfirmDialog
        open={!!detachTarget}
        title="Remove this subject from the course?"
        description={
          detachTarget
            ? `${detachTarget.subject.name} will no longer be selectable for lectures in ${detachTarget.assignment.courseTitle}. Existing lectures are kept but become unassigned.`
            : undefined
        }
        confirmLabel="Remove subject"
        loading={!!pendingRemoval}
        onConfirm={() => void confirmDetach()}
        onCancel={() => setDetachTarget(null)}
      />
    </div>
  );
}

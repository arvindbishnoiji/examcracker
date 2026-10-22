'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { Card, Badge, EmptyState, Skeleton } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Textarea, Select } from '@/components/ui/Input';
import { ConfirmDialog, Modal, StatusPill } from '@/components/admin/ui';
import { ImageField } from '@/components/admin/ImageField';
import { useToast } from '@/hooks/useToast';
import {
  getAdminOverview,
  getAdminContentList,
  createAdminContent,
  updateAdminContent,
  disableAdminContent,
  permanentlyDeleteAdminContent,
  getAdminAnnouncements,
  createAdminAnnouncement,
  updateAdminAnnouncement,
  getAdminStudents,
  getAdminSubjects,
  createAdminSubject,
  setCourseSubjects,
  uploadAdminPdf,
  getCourseFiles,
  getAdminDriveStatus,
  invalidateAuthorizedBlobCache,
} from '@/lib/api';
import {
  fetchVideoMetadata,
  importFullYoutubePlaylist,
  extractYoutubeVideoId,
  extractYoutubePlaylistId,
  getYoutubeDefaultThumbnail,
} from '@/lib/mediaProxy';
import { fromISTDateTimeLocalInput, toISTDateTimeLocalInput } from '@/lib/date';
import {
  CLASS_LEVELS,
  formatClassLevel,
  formatClassList,
  inheritChildAudience,
  isSafeHttpUrl,
  validateQuestionsJson,
} from '@/lib/validation';
import type {
  ClassLevel,
  ContentExam,
  CourseCatalogItem,
  DriveFileItem,
  DriveStatusResponse,
  Subject,
} from '@/types';
import YoutubeThumbnail from '@/components/YoutubeThumbnail';
import { ProfileImage } from '@/components/student/ProfileImage';

export type AdminTab =
  | 'overview'
  | 'goals'
  | 'batches'
  | 'lectures'
  | 'series'
  | 'tests'
  | 'events'
  | 'announcements'
  | 'students'
  | 'feedback';

function describeContentDeleteError(error: unknown): string {
  const message = error instanceof Error ? error.message : 'Deletion was blocked or failed.';
  if (!error || typeof error !== 'object' || !('payload' in error)) return message;
  const payload = (error as { payload?: Record<string, unknown> }).payload;
  const detail = typeof payload?.detail === 'string' ? payload.detail : '';
  if (message !== 'CONTENT_HAS_DEPENDENCIES') return detail ? `${message}: ${detail}` : message;

  const dependencies =
    payload?.dependencies && typeof payload.dependencies === 'object'
      ? (payload.dependencies as Record<string, unknown>)
      : {};
  const labels: Record<string, string> = {
    childContent: 'child content',
    enrollments: 'enrollments',
    lessonProgress: 'lesson progress',
    subjectAssignments: 'subject assignments',
    studentReferences: 'saved student references',
    storedFiles: 'stored files',
    testAttempts: 'test attempts',
  };
  const counts = Object.entries(dependencies)
    .filter((entry): entry is [string, number] => typeof entry[1] === 'number' && entry[1] > 0)
    .map(([key, count]) => `${count} ${labels[key] || key}`);
  return `Delete blocked${counts.length ? ` by ${counts.join(', ')}` : ''}.${detail ? ` ${detail}` : ''}`;
}

function ClassCheckboxGroup({
  value,
  onChange,
  label = 'Classes*',
}: {
  value: string[];
  onChange: (next: ClassLevel[]) => void;
  label?: string;
}) {
  return (
    <div>
      {label && <label className="block text-sm font-medium text-ink-700 mb-1.5">{label}</label>}
      <div className="flex flex-wrap gap-3 pt-1">
        {CLASS_LEVELS.map((level) => {
          const checked = value.includes(level);
          return (
            <label key={level} className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-700 cursor-pointer">
              <input
                type="checkbox"
                checked={checked}
                onChange={(event) => {
                  const next = event.target.checked
                    ? Array.from(new Set([...(value as ClassLevel[]), level]))
                    : (value.filter((item) => item !== level) as ClassLevel[]);
                  onChange(next);
                }}
              />
              <span>{formatClassLevel(level)}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

export default function AdminPage({
  embedded = false,
  initialTab,
}: { embedded?: boolean; initialTab?: AdminTab } = {}) {
  const { user, isAdmin, initializing } = useAuth();
  const [tab, setTab] = useState<AdminTab>(initialTab || 'overview');
  const [overview, setOverview] = useState<any>(null);
  const [ovLoading, setOvLoading] = useState(false);
  const [ovError, setOvError] = useState<string | null>(null);

  useEffect(() => {
    if (initialTab) setTab(initialTab);
  }, [initialTab]);

  const loadOverview = useCallback(async () => {
    setOvLoading(true);
    setOvError(null);
    try {
      const data = await getAdminOverview();
      setOverview(data);
    } catch (e) {
      setOvError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setOvLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin && tab === 'overview') void loadOverview();
  }, [isAdmin, tab, loadOverview]);

  if (initializing) {
    return <div className="max-w-4xl mx-auto p-6 text-sm text-ink-500">Loading…</div>;
  }
  if (!user) {
    return (
      <Card className="max-w-xl mx-auto p-6 text-center">
        <p className="font-semibold">Sign in required</p>
        <Link href="/login" className="inline-flex mt-3 px-4 py-2 bg-brand-600 text-white rounded-xl text-sm">
          Sign in
        </Link>
      </Card>
    );
  }
  if (!isAdmin) {
    return (
      <Card className="max-w-xl mx-auto p-8 text-center border-red-200 bg-red-50">
        <h2 className="font-bold text-red-800">Access denied</h2>
        <p className="text-sm text-red-700 mt-1">
          You are signed in as {user.email}. Admin access is restricted and verified server-side via Firebase ID token.
        </p>
        <Link href="/home" className="inline-flex mt-4 px-4 py-2 bg-white border border-red-200 rounded-xl text-sm">
          Go home
        </Link>
      </Card>
    );
  }

  const tabs: { id: AdminTab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'batches', label: 'Batches' },
    { id: 'series', label: 'Series' },
    { id: 'lectures', label: 'Lectures & Playlists' },
    { id: 'tests', label: 'Tests' },
    { id: 'goals', label: 'Goals' },
    { id: 'events', label: 'Events' },
    { id: 'announcements', label: 'Announcements' },
    { id: 'students', label: 'Students' },
    { id: 'feedback', label: 'Feedback' },
  ];

  return (
    <div className={embedded ? '' : 'max-w-6xl mx-auto'}>
      {!embedded && (
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h1 className="text-2xl font-bold">Admin Dashboard</h1>
            <p className="text-sm text-ink-500">
              Server-verified Firebase Admin Console · Cloudflare D1 catalogue &amp; relationships.
            </p>
          </div>
          <Badge variant="info">Admin: {user.email}</Badge>
        </div>
      )}

      {!initialTab && (
        <div className="flex gap-1.5 overflow-auto pb-3 border-b border-ink-100 -mx-4 px-4 sm:mx-0 sm:px-0 mb-5">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`shrink-0 px-3.5 py-2 rounded-lg text-xs font-semibold border transition ${
                tab === t.id
                  ? 'bg-brand-600 text-white border-brand-600 shadow-sm'
                  : 'bg-white border-ink-200 text-ink-700 hover:bg-ink-50'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      <div>
        {tab === 'overview' && (
          <AdminOverviewSection overview={overview} loading={ovLoading} error={ovError} onReload={loadOverview} />
        )}
        {tab === 'goals' && <AdminContentTab kind="goal" />}
        {tab === 'batches' && <AdminContentTab kind="batch" />}
        {tab === 'lectures' && <AdminLecturesTab />}
        {tab === 'series' && <AdminContentTab kind="series" />}
        {tab === 'tests' && <AdminTestsTab />}
        {tab === 'events' && <AdminContentTab kind="event" />}
        {tab === 'announcements' && <AdminAnnouncementsTab />}
        {tab === 'students' && <AdminStudentsTab />}
        {tab === 'feedback' && <AdminFeedbackTab />}
      </div>
    </div>
  );
}

function AdminOverviewSection({
  overview,
  loading,
  error,
  onReload,
}: {
  overview: any;
  loading: boolean;
  error: string | null;
  onReload: () => void;
}) {
  if (loading) return <Skeleton className="h-60 w-full" />;
  if (error) {
    return (
      <Card className="p-4 bg-red-50 border-red-200 text-sm text-red-700">
        {error}{' '}
        <Button size="sm" variant="outline" className="ml-2" onClick={onReload}>
          Retry
        </Button>
      </Card>
    );
  }
  if (!overview) {
    return (
      <Card className="p-6 text-center text-sm text-ink-500">
        No data.{' '}
        <Button size="sm" onClick={onReload}>
          Load
        </Button>
      </Card>
    );
  }
  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {Object.entries(overview.counts || {}).map(([k, v]) => (
          <Card key={k} className="p-4 text-center">
            <p className="text-xl font-bold tabular-nums">{String(v)}</p>
            <p className="text-xs text-ink-500 capitalize mt-0.5">{k.replace('_', ' ')}</p>
          </Card>
        ))}
      </div>
      <Card className="p-4">
        <h3 className="font-semibold text-sm">Latest Catalogue Updates</h3>
        <div className="mt-3 space-y-2">
          {(overview.latestContent || []).map((c: any) => (
            <div key={c.id} className="flex items-center justify-between p-2.5 bg-ink-50/70 rounded-xl text-sm">
              <span className="font-medium truncate">
                {c.title} <Badge>{c.kind}</Badge>
              </span>
              <span className="text-xs text-ink-500 shrink-0 ml-2">
                {c.exam} • {formatClassList(c.classes || [])}
              </span>
            </div>
          ))}
          {(!overview.latestContent || overview.latestContent.length === 0) && (
            <p className="text-sm text-ink-500">No content yet.</p>
          )}
        </div>
      </Card>
    </div>
  );
}

function AdminContentTab({ kind }: { kind: 'goal' | 'batch' | 'series' | 'event' }) {
  const { push } = useToast();
  const [items, setItems] = useState<CourseCatalogItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<CourseCatalogItem | null>(null);
  const [form, setForm] = useState<any>({
    title: '',
    description: '',
    exam: 'JEE',
    classes: ['11', '12', 'Dropper'],
    active: true,
    accessCode: '',
    startsAt: '',
    endsAt: '',
    deepLink: '',
    ctaLabel: '',
    priority: '',
    thumbnailUrl: '',
    codeDisplay: '',
    instructor: '',
    features: '',
    images: '',
    subtitle: '',
  });
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [examFilter, setExamFilter] = useState('all');
  const [classFilter, setClassFilter] = useState('all');
  const [stateFilter, setStateFilter] = useState('all');
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [workspaceId, setWorkspaceId] = useState('');
  const [workspaceSubjectIds, setWorkspaceSubjectIds] = useState<string[]>([]);
  const [newSubjectName, setNewSubjectName] = useState('');
  const [savingSubjects, setSavingSubjects] = useState(false);

  const [confirmAction, setConfirmAction] = useState<{
    mode: 'disable' | 'delete';
    item: CourseCatalogItem;
  } | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [data, subjectRows] = await Promise.all([
        getAdminContentList({ kind }),
        kind === 'batch' || kind === 'series'
          ? getAdminSubjects({ includeArchived: false })
          : Promise.resolve([] as Subject[]),
      ]);
      setItems(data);
      setSubjects(subjectRows);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setLoading(false);
    }
  }, [kind]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!workspaceId) return;
    setWorkspaceSubjectIds(
      subjects
        .filter((subject) => subject.assignments?.some((assignment) => assignment.courseId === workspaceId))
        .map((subject) => subject.id)
    );
  }, [workspaceId, subjects]);

  async function saveWorkspaceSubjects(event: React.FormEvent) {
    event.preventDefault();
    if (!workspaceId) return;
    setSavingSubjects(true);
    try {
      await setCourseSubjects(workspaceId, workspaceSubjectIds);
      push('Subject assignments saved to D1.', 'success');
      await load();
    } catch (error) {
      push(error instanceof Error ? error.message : 'Could not save subject assignments.', 'error');
    } finally {
      setSavingSubjects(false);
    }
  }

  async function createAndAssignSubject(event: React.FormEvent) {
    event.preventDefault();
    const course = items.find((item) => item.id === workspaceId);
    const name = newSubjectName.trim();
    if (!course || !name) return;
    setSavingSubjects(true);
    try {
      const created = await createAdminSubject({
        name,
        description: '',
        exam: course.exam,
        classes: course.classes,
        active: true,
        sortOrder: subjects.length + 1,
      });
      await setCourseSubjects(workspaceId, [...workspaceSubjectIds, created.id]);
      setNewSubjectName('');
      push(`${created.name} created and assigned to ${course.title}.`, 'success');
      await load();
    } catch (error) {
      push(error instanceof Error ? error.message : 'Could not create and assign this subject.', 'error');
    } finally {
      setSavingSubjects(false);
    }
  }

  const visibleItems = items.filter((item) => {
    const query = search.trim().toLowerCase();
    if (query && !`${item.title} ${item.description}`.toLowerCase().includes(query)) return false;
    if (examFilter !== 'all' && item.exam !== examFilter && item.exam !== 'Both') return false;
    if (classFilter !== 'all' && !item.classes.includes(classFilter as ClassLevel)) return false;
    if (stateFilter === 'active' && !item.active) return false;
    if (stateFilter === 'disabled' && item.active) return false;
    return true;
  });

  function openCreate() {
    setEditing(null);
    setForm({
      title: '',
      description: '',
      exam: 'JEE',
      classes: ['11', '12', 'Dropper'],
      active: true,
      accessCode: '',
      startsAt: '',
      endsAt: '',
      deepLink: '',
      ctaLabel: '',
      priority: '',
      thumbnailUrl: '',
      codeDisplay: '',
      instructor: '',
      features: '',
      images: '',
      subtitle: '',
    });
    setShowForm(true);
  }

  function openEdit(item: CourseCatalogItem) {
    setEditing(item);
    const meta = item.metadata as Record<string, any>;
    setForm({
      title: item.title,
      description: item.description,
      exam: item.exam,
      classes: item.classes?.length ? item.classes : ['11', '12'],
      active: item.active,
      accessCode: (item as any).access_code || '',
      startsAt: meta.startsAt
        ? toISTDateTimeLocalInput(meta.startsAt)
        : meta.starts_at
          ? toISTDateTimeLocalInput(meta.starts_at)
          : '',
      endsAt: meta.endsAt
        ? toISTDateTimeLocalInput(meta.endsAt)
        : meta.ends_at
          ? toISTDateTimeLocalInput(meta.ends_at)
          : '',
      deepLink: meta.deepLink || meta.deep_link || '',
      ctaLabel: meta.ctaLabel || '',
      priority: meta.priority || '',
      thumbnailUrl: meta.thumbnailUrl || '',
      codeDisplay: meta.codeDisplay || '',
      instructor: meta.instructor || '',
      features: Array.isArray(meta.features) ? meta.features.join(', ') : meta.features || '',
      images: Array.isArray(meta.images) ? meta.images.map((i: any) => i.url).join(', ') : meta.images || '',
      subtitle: meta.subtitle || '',
    });
    setShowForm(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim() || form.title.trim().length > 180) {
      push('Title required under 180 chars', 'error');
      return;
    }
    if (!['JEE', 'NEET', 'Both'].includes(form.exam)) {
      push('Exam must be JEE, NEET, or Both', 'error');
      return;
    }
    if (!form.classes.length) {
      push('Select at least one class (11, 12, or Dropper)', 'error');
      return;
    }
    if (form.thumbnailUrl && !isSafeHttpUrl(form.thumbnailUrl)) {
      push('Thumbnail must be an http(s) URL', 'error');
      return;
    }
    setSaving(true);
    try {
      const metadata: Record<string, unknown> = {};
      if (kind === 'goal') {
        if (form.startsAt) {
          const iso = fromISTDateTimeLocalInput(form.startsAt);
          if (iso) metadata.startsAt = iso;
        }
        if (form.endsAt) {
          const iso = fromISTDateTimeLocalInput(form.endsAt);
          if (iso) metadata.endsAt = iso;
        }
        if (form.deepLink) metadata.deepLink = form.deepLink;
        if (form.ctaLabel) metadata.ctaLabel = form.ctaLabel;
        if (form.priority) metadata.priority = Number(form.priority);
        metadata.displayText = form.description;
      } else if (kind === 'batch' || kind === 'series') {
        if (form.thumbnailUrl) metadata.thumbnailUrl = form.thumbnailUrl;
        if (form.codeDisplay) metadata.codeDisplay = form.codeDisplay;
        if (form.instructor) metadata.instructor = form.instructor;
        if (form.features) {
          metadata.features = form.features
            .split(',')
            .map((s: string) => s.trim())
            .filter(Boolean);
        }
      } else if (kind === 'event') {
        if (form.thumbnailUrl) metadata.thumbnailUrl = form.thumbnailUrl;
        if (form.subtitle) metadata.subtitle = form.subtitle;
        if (form.startsAt) {
          const iso = fromISTDateTimeLocalInput(form.startsAt);
          if (iso) metadata.startsAt = iso;
        }
        if (form.endsAt) {
          const iso = fromISTDateTimeLocalInput(form.endsAt);
          if (iso) metadata.endsAt = iso;
        }
        if (form.deepLink) metadata.deepLink = form.deepLink;
        if (form.ctaLabel) metadata.ctaLabel = form.ctaLabel;
        if (form.images) {
          const urls = form.images
            .split(',')
            .map((s: string) => s.trim())
            .filter(Boolean);
          metadata.images = urls.map((u: string) => ({ url: u }));
        }
      }
      const payload = {
        kind,
        title: form.title.trim(),
        description: form.description.slice(0, 10000),
        exam: form.exam,
        classes: form.classes,
        active: !!form.active,
        accessCode: form.accessCode || null,
        metadata,
      };
      if (editing) {
        await updateAdminContent(editing.id, payload);
        push(`${kind} updated.`, 'success');
      } else {
        const created = await createAdminContent(payload);
        if (kind === 'batch' || kind === 'series') setWorkspaceId(created.id);
        push(`Created ${created.title}.`, 'success');
      }
      setShowForm(false);
      await load();
    } catch (err) {
      push(err instanceof Error ? err.message : 'Save failed', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleRestore(item: CourseCatalogItem) {
    try {
      await updateAdminContent(item.id, {
        kind: item.kind as any,
        title: item.title,
        description: item.description,
        exam: item.exam,
        classes: item.classes,
        active: true,
        accessCode: (item as any).access_code ?? null,
        metadata: item.metadata as Record<string, unknown>,
        parentId: item.parentId,
        subjectId: item.subjectId,
        sortOrder: item.sortOrder,
      });
      push('Restored and published.', 'success');
      await load();
    } catch (err) {
      push(err instanceof Error ? err.message : 'Could not restore item.', 'error');
    }
  }

  async function executeConfirmedAction() {
    if (!confirmAction) return;
    setConfirmBusy(true);
    try {
      if (confirmAction.mode === 'disable') {
        await disableAdminContent(confirmAction.item.id);
        push('Disabled. You can restore it anytime.', 'success');
      } else {
        await permanentlyDeleteAdminContent(confirmAction.item.id);
        if (workspaceId === confirmAction.item.id) setWorkspaceId('');
        push('Item permanently deleted.', 'success');
      }
      setConfirmAction(null);
      await load();
    } catch (err) {
      push(describeContentDeleteError(err), 'error');
    } finally {
      setConfirmBusy(false);
    }
  }

  const activeWorkspaceCourse =
    (kind === 'batch' || kind === 'series') && workspaceId
      ? items.find((item) => item.id === workspaceId) || null
      : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-bold capitalize text-ink-900">{kind === 'series' ? 'Series' : `${kind}s`}</h2>
          <p className="text-xs text-ink-500">All changes persist directly to Cloudflare D1.</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => void load()}>
            Refresh
          </Button>
          <Button size="sm" onClick={openCreate}>
            + Create {kind}
          </Button>
        </div>
      </div>

      {loading && <Skeleton className="h-40 w-full" />}
      {error && (
        <div role="alert" className="p-3 bg-red-50 border border-red-200 text-sm text-red-700 rounded-xl">
          {error}{' '}
          <Button size="sm" variant="outline" className="ml-2" onClick={() => void load()}>
            Retry
          </Button>
        </div>
      )}
      {!loading && !error && items.length === 0 && (
        <EmptyState
          title={`No ${kind === 'series' ? 'series' : `${kind}s`} yet`}
          description={`Click "+ Create ${kind}" to open the creation dialog and configure exam track, class eligibility (11, 12, Dropper), and metadata.`}
        />
      )}

      {items.length > 0 && (
        <div className="grid gap-2.5 rounded-2xl border border-ink-200 bg-white p-3.5 sm:grid-cols-2 lg:grid-cols-4">
          <Input
            label="Search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={`Search ${kind}s…`}
          />
          <Select label="Exam" value={examFilter} onChange={(event) => setExamFilter(event.target.value)}>
            <option value="all">All exams</option>
            <option value="JEE">JEE</option>
            <option value="NEET">NEET</option>
          </Select>
          <Select label="Class" value={classFilter} onChange={(event) => setClassFilter(event.target.value)}>
            <option value="all">All classes</option>
            <option value="11">Class 11</option>
            <option value="12">Class 12</option>
            <option value="Dropper">Dropper</option>
          </Select>
          <Select label="State" value={stateFilter} onChange={(event) => setStateFilter(event.target.value)}>
            <option value="all">Active &amp; disabled</option>
            <option value="active">Active</option>
            <option value="disabled">Disabled</option>
          </Select>
        </div>
      )}

      {!loading && !error && items.length > 0 && visibleItems.length === 0 && (
        <EmptyState title="No items match these filters" description="Adjust search, exam, class, or state filters." />
      )}

      <div className="grid gap-3">
        {visibleItems.map((it) => {
          const meta = it.metadata as Record<string, any>;
          return (
            <Card key={it.id} className="p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className="font-bold text-sm text-ink-900">{it.title}</p>
                    <Badge variant={it.active ? 'success' : 'danger'}>{it.active ? 'Active' : 'Disabled'}</Badge>
                    <Badge variant="info">{it.exam}</Badge>
                    <Badge>{formatClassList(it.classes)}</Badge>
                  </div>
                  {it.description && <p className="text-xs text-ink-600 mt-1 line-clamp-2">{it.description}</p>}
                  <p className="text-[11px] text-ink-400 mt-1.5">
                    Updated {new Date(it.updated_at).toLocaleString('en-IN')}
                    {meta.instructor ? ` • Faculty: ${meta.instructor}` : ''}
                    {meta.startsAt ? ` • Starts ${meta.startsAt}` : ''}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5 shrink-0">
                  {(kind === 'batch' || kind === 'series') && (
                    <Button size="sm" onClick={() => setWorkspaceId(it.id)}>
                      Subjects &amp; Syllabus
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => openEdit(it)}>
                    Edit
                  </Button>
                  {it.active ? (
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => setConfirmAction({ mode: 'disable', item: it })}
                    >
                      Disable
                    </Button>
                  ) : (
                    <>
                      <Button size="sm" variant="outline" onClick={() => void handleRestore(it)}>
                        Restore
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => setConfirmAction({ mode: 'delete', item: it })}
                      >
                        Delete
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Subject Assignment Modal for Batch / Series */}
      <Modal
        open={Boolean(activeWorkspaceCourse)}
        onClose={() => setWorkspaceId('')}
        title={activeWorkspaceCourse ? `${activeWorkspaceCourse.title} · Subject Syllabus` : 'Course Subjects'}
        description={
          activeWorkspaceCourse
            ? `Assign subjects to this ${activeWorkspaceCourse.kind} (${activeWorkspaceCourse.exam} · ${formatClassList(activeWorkspaceCourse.classes)}) so lectures appear in ordered subject queues.`
            : undefined
        }
        size="lg"
      >
        {activeWorkspaceCourse && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-ink-100 bg-ink-50/70 px-3.5 py-2.5 text-xs">
              <span className="font-semibold text-ink-700">
                {workspaceSubjectIds.length} subject{workspaceSubjectIds.length === 1 ? '' : 's'} assigned
              </span>
              <Link
                href={`/lectures/${encodeURIComponent(activeWorkspaceCourse.id)}`}
                className="font-bold text-brand-700 hover:underline"
              >
                Preview student course view →
              </Link>
            </div>

            <form onSubmit={saveWorkspaceSubjects} className="space-y-3">
              <fieldset>
                <legend className="mb-2 text-xs font-bold uppercase tracking-wider text-ink-600">
                  Available Subjects
                </legend>
                {subjects.filter((subject) => subject.active && !subject.archived).length ? (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {subjects
                      .filter((subject) => subject.active && !subject.archived)
                      .map((subject) => {
                        const checked = workspaceSubjectIds.includes(subject.id);
                        const examOkay =
                          subject.exam === 'Both' ||
                          activeWorkspaceCourse.exam === 'Both' ||
                          subject.exam === activeWorkspaceCourse.exam;
                        const classOkay = subject.classes.some((level) =>
                          activeWorkspaceCourse.classes.includes(level)
                        );
                        return (
                          <label
                            key={subject.id}
                            className={`flex items-start gap-2.5 rounded-xl border p-3 text-sm ${
                              checked ? 'border-brand-300 bg-brand-50/70' : 'border-ink-200'
                            } ${!examOkay || !classOkay ? 'opacity-50' : 'cursor-pointer'}`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={!examOkay || !classOkay}
                              onChange={(event) =>
                                setWorkspaceSubjectIds((previous) =>
                                  event.target.checked
                                    ? [...new Set([...previous, subject.id])]
                                    : previous.filter((id) => id !== subject.id)
                                )
                              }
                            />
                            <span className="min-w-0">
                              <span className="block font-semibold text-ink-900">{subject.name}</span>
                              <span className="text-[11px] text-ink-500">
                                {subject.exam} · {formatClassList(subject.classes)}
                                {!examOkay || !classOkay ? ' · incompatible scope' : ''}
                              </span>
                            </span>
                          </label>
                        );
                      })}
                  </div>
                ) : (
                  <p className="rounded-xl border border-dashed border-ink-200 p-3 text-xs text-ink-500">
                    No subjects created yet. Create one below to attach it immediately.
                  </p>
                )}
              </fieldset>
              <div className="flex flex-wrap items-center gap-2">
                <Button type="submit" size="sm" loading={savingSubjects}>
                  Save Subject Assignments
                </Button>
                <Link
                  href={`/admin/lectures?parentId=${encodeURIComponent(activeWorkspaceCourse.id)}`}
                  className="ec-btn border border-ink-200 px-3 py-2 text-xs font-semibold"
                >
                  Open Lectures in Course →
                </Link>
              </div>
            </form>

            <form
              onSubmit={createAndAssignSubject}
              className="grid gap-2 rounded-xl border border-ink-200 bg-ink-50/50 p-3.5 sm:grid-cols-[1fr_auto] sm:items-end"
            >
              <Input
                label="Quick-create and assign a new subject"
                value={newSubjectName}
                onChange={(event) => setNewSubjectName(event.target.value)}
                placeholder="e.g. Physics, Organic Chemistry, Botany"
                maxLength={100}
                required
              />
              <Button type="submit" size="sm" variant="outline" loading={savingSubjects} disabled={!newSubjectName.trim()}>
                Create &amp; Assign
              </Button>
            </form>

            {workspaceSubjectIds.length > 0 && (
              <div className="space-y-1.5">
                {workspaceSubjectIds.map((subjectId) => {
                  const subj = subjects.find((row) => row.id === subjectId);
                  if (!subj) return null;
                  return (
                    <div
                      key={subjectId}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-ink-100 px-3 py-2 text-xs"
                    >
                      <span className="font-semibold text-ink-800">{subj.name}</span>
                      <Link
                        href={`/admin/lectures?parentId=${encodeURIComponent(activeWorkspaceCourse.id)}&subjectId=${encodeURIComponent(subj.id)}`}
                        className="font-bold text-brand-700 hover:underline"
                      >
                        + Add lecture to {subj.name} →
                      </Link>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Modal Form for Create / Edit Batch, Series, Goal, Event */}
      <Modal
        open={showForm}
        onClose={() => !saving && setShowForm(false)}
        title={`${editing ? 'Edit' : 'Create'} ${kind}`}
        description="Configure exam track, class eligibility (11, 12, Dropper), and visibility."
        size="lg"
        footer={
          <>
            <Button type="button" variant="outline" size="sm" disabled={saving} onClick={() => setShowForm(false)}>
              Cancel
            </Button>
            <Button type="submit" form={`admin-${kind}-form`} size="sm" loading={saving}>
              {editing ? `Save ${kind}` : `Create ${kind}`}
            </Button>
          </>
        }
      >
        <form id={`admin-${kind}-form`} onSubmit={handleSave} className="space-y-3.5">
          <Input
            label="Title*"
            value={form.title}
            onChange={(e) => setForm((s: any) => ({ ...s, title: e.target.value }))}
            required
          />
          <Textarea
            label="Description"
            value={form.description}
            onChange={(e) => setForm((s: any) => ({ ...s, description: e.target.value }))}
            rows={3}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <Select
              label="Exam Track*"
              value={form.exam}
              onChange={(e) => setForm((s: any) => ({ ...s, exam: e.target.value }))}
            >
              <option value="JEE">JEE</option>
              <option value="NEET">NEET</option>
              <option value="Both">Both (JEE &amp; NEET)</option>
            </Select>
            <ClassCheckboxGroup
              value={form.classes}
              onChange={(classes) => setForm((s: any) => ({ ...s, classes }))}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label="Access code (optional, server-enforced)"
              placeholder="Leave blank for open enrollment"
              value={form.accessCode}
              onChange={(e) => setForm((s: any) => ({ ...s, accessCode: e.target.value }))}
            />
            <div className="flex items-end pb-2">
              <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => setForm((s: any) => ({ ...s, active: e.target.checked }))}
                />
                Published &amp; visible to eligible students
              </label>
            </div>
          </div>

          {(kind === 'batch' || kind === 'series' || kind === 'event') && (
            <div className="space-y-3">
              <ImageField
                label="Thumbnail / Artwork (URL or Google Drive Upload · 16:9 recommended)"
                context={kind}
                value={form.thumbnailUrl}
                onChange={(thumbnailUrl) => setForm((s: any) => ({ ...s, thumbnailUrl }))}
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  label={kind === 'event' ? 'Subtitle' : 'Lead Faculty / Instructor'}
                  value={kind === 'event' ? form.subtitle : form.instructor}
                  onChange={(e) =>
                    setForm((s: any) => ({
                      ...s,
                      [kind === 'event' ? 'subtitle' : 'instructor']: e.target.value,
                    }))
                  }
                />
                {kind !== 'event' && (
                  <Input
                    label="Code badge hint (optional)"
                    value={form.codeDisplay}
                    onChange={(e) => setForm((s: any) => ({ ...s, codeDisplay: e.target.value }))}
                  />
                )}
                {kind !== 'event' && (
                  <div className="sm:col-span-2">
                    <Input
                      label="Highlights (comma-separated)"
                      value={form.features}
                      onChange={(e) => setForm((s: any) => ({ ...s, features: e.target.value }))}
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {(kind === 'goal' || kind === 'event') && (
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  label="Starts At (IST)"
                  type="datetime-local"
                  value={form.startsAt}
                  onChange={(e) => setForm((s: any) => ({ ...s, startsAt: e.target.value }))}
                />
                <Input
                  label="Ends At (IST)"
                  type="datetime-local"
                  value={form.endsAt}
                  onChange={(e) => setForm((s: any) => ({ ...s, endsAt: e.target.value }))}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  label="Deep link (internal)"
                  placeholder="/lectures or /tests"
                  value={form.deepLink}
                  onChange={(e) => setForm((s: any) => ({ ...s, deepLink: e.target.value }))}
                />
                <Input
                  label="CTA label"
                  value={form.ctaLabel}
                  onChange={(e) => setForm((s: any) => ({ ...s, ctaLabel: e.target.value }))}
                />
              </div>
              {kind === 'goal' && (
                <Input
                  label="Priority (number)"
                  type="number"
                  value={form.priority}
                  onChange={(e) => setForm((s: any) => ({ ...s, priority: e.target.value }))}
                />
              )}
              {kind === 'event' && (
                <div className="space-y-2">
                  <Input
                    label="Gallery image URLs (comma-separated)"
                    value={form.images}
                    onChange={(e) => setForm((s: any) => ({ ...s, images: e.target.value }))}
                  />
                  <ImageField
                    label="Upload Extra Gallery Image to Google Drive (appends to list above)"
                    context="event_gallery"
                    compact
                    value=""
                    placeholder="Upload to Google Drive to append URL automatically…"
                    onChange={(uploadedUrl) => {
                      if (!uploadedUrl.trim()) return;
                      setForm((s: any) => ({
                        ...s,
                        images: s.images?.trim() ? `${s.images.trim()}, ${uploadedUrl.trim()}` : uploadedUrl.trim(),
                      }));
                    }}
                  />
                </div>
              )}
            </div>
          )}
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(confirmAction)}
        loading={confirmBusy}
        title={
          confirmAction?.mode === 'disable'
            ? `Disable "${confirmAction.item.title}"?`
            : `Permanently delete "${confirmAction?.item.title || ''}"?`
        }
        description={
          confirmAction?.mode === 'disable'
            ? 'Students will no longer see this item, while all relationships, subjects, and progress stay preserved.'
            : 'Permanent deletion cannot be undone and is blocked if dependent lectures, enrollments, or files exist.'
        }
        confirmLabel={confirmAction?.mode === 'disable' ? 'Disable' : 'Delete permanently'}
        onCancel={() => setConfirmAction(null)}
        onConfirm={() => void executeConfirmedAction()}
      />
    </div>
  );
}

const EMPTY_LECTURE_FORM = {
  title: '',
  description: '',
  exam: 'JEE' as ContentExam,
  classes: ['11', '12', 'Dropper'] as ClassLevel[],
  active: true,
  accessCode: '',
  youtubeUrl: '',
  videoId: '',
  thumbnailUrl: '',
  lesson: '',
  topic: '',
  notesPdfUrl: '',
  isPreview: false,
  parentId: '',
  subjectId: '',
  position: '',
  duration: '',
  notesFileId: '',
  notesFileName: '',
};

function AdminLecturesTab() {
  const { push } = useToast();
  const [items, setItems] = useState<CourseCatalogItem[]>([]);
  const [batches, setBatches] = useState<CourseCatalogItem[]>([]);
  const [series, setSeries] = useState<CourseCatalogItem[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [courseFiles, setCourseFiles] = useState<DriveFileItem[]>([]);
  const [driveStatus, setDriveStatus] = useState<DriveStatusResponse | null>(null);
  const [probingDrive, setProbingDrive] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parentFilter, setParentFilter] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('');
  const [lectureSearch, setLectureSearch] = useState('');
  const [lectureStateFilter, setLectureStateFilter] = useState('all');
  const [lectureExamFilter, setLectureExamFilter] = useState('all');
  const [lectureClassFilter, setLectureClassFilter] = useState('all');

  const [pdfUploading, setPdfUploading] = useState(false);
  const [pdfProgress, setPdfProgress] = useState(0);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const pdfInputRef = useRef<HTMLInputElement | null>(null);
  const pdfAbortRef = useRef<AbortController | null>(null);

  const [form, setForm] = useState<any>({ ...EMPTY_LECTURE_FORM });
  const [editing, setEditing] = useState<CourseCatalogItem | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fetchingMeta, setFetchingMeta] = useState(false);

  // Modalized Playlist Importer
  const [playlistModalOpen, setPlaylistModalOpen] = useState(false);
  const [playlistUrl, setPlaylistUrl] = useState('');
  const [playlistItems, setPlaylistItems] = useState<any[]>([]);
  const [playlistTitle, setPlaylistTitle] = useState('');
  const [playlistLoading, setPlaylistLoading] = useState(false);
  const [playlistProgress, setPlaylistProgress] = useState('');
  const [playlistError, setPlaylistError] = useState<string | null>(null);
  const [playlistIncomplete, setPlaylistIncomplete] = useState(false);
  const [playlistTarget, setPlaylistTarget] = useState('');
  const [playlistExam, setPlaylistExam] = useState<ContentExam>('JEE');
  const [playlistClasses, setPlaylistClasses] = useState<ClassLevel[]>(['11', '12', 'Dropper']);
  const [playlistTopic, setPlaylistTopic] = useState('');
  const [playlistSubject, setPlaylistSubject] = useState('');

  const [confirmLectureAction, setConfirmLectureAction] = useState<{
    mode: 'disable' | 'delete';
    item: CourseCatalogItem;
  } | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const initializedWorkspaceLink = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [lectures, b, s, subj] = await Promise.all([
        getAdminContentList({ kind: 'lecture' }),
        getAdminContentList({ kind: 'batch' }),
        getAdminContentList({ kind: 'series' }),
        getAdminSubjects({ includeArchived: false }).catch(() => [] as Subject[]),
      ]);
      setItems(lectures);
      setBatches(b);
      setSeries(s);
      setSubjects(subj);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    getAdminDriveStatus(false)
      .then((res) => setDriveStatus(res))
      .catch(() => {});
  }, [load]);

  const allParents = [...batches, ...series];

  useEffect(() => {
    if (initializedWorkspaceLink.current) return;
    const params = new URLSearchParams(window.location.search);
    const parentId = params.get('parentId') || '';
    const parentCourse = [...batches, ...series].find((course) => course.id === parentId);
    if (!parentCourse) return;
    const subjectId = params.get('subjectId') || '';
    const matchedSubject = subjects.find(
      (subject) =>
        subject.id === subjectId && subject.assignments?.some((assignment) => assignment.courseId === parentId)
    );
    initializedWorkspaceLink.current = true;
    const inherited = inheritChildAudience(
      { exam: parentCourse.exam, classes: parentCourse.classes },
      matchedSubject ? { exam: matchedSubject.exam, classes: matchedSubject.classes } : null,
      null
    );
    setForm({
      ...EMPTY_LECTURE_FORM,
      parentId,
      subjectId: matchedSubject ? matchedSubject.id : '',
      exam: inherited.exam,
      classes: inherited.classes,
    });
    setShowForm(true);
  }, [batches, series, subjects]);

  const subjectsForParent = useCallback(
    (parentId: string) => {
      if (!parentId) return [] as Subject[];
      return subjects.filter((subject) => subject.assignments?.some((a) => a.courseId === parentId));
    },
    [subjects]
  );

  const parentTitle = useCallback(
    (id: string) => {
      const found = [...batches, ...series].find((row) => row.id === id);
      return found ? `${found.kind === 'batch' ? 'Batch' : 'Series'}: ${found.title}` : '';
    },
    [batches, series]
  );

  const filteredItems = items.filter((item) => {
    const m = (item.metadata || {}) as Record<string, any>;
    const itemParent = item.parentId || m.parentId || '';
    const itemSubject = item.subjectId || m.subjectId || '';
    if (parentFilter && itemParent !== parentFilter) return false;
    if (subjectFilter && itemSubject !== subjectFilter) return false;
    if (
      lectureSearch.trim() &&
      !`${item.title} ${item.description} ${m.lesson || ''} ${m.topic || ''}`
        .toLowerCase()
        .includes(lectureSearch.trim().toLowerCase())
    ) {
      return false;
    }
    if (lectureStateFilter === 'active' && !item.active) return false;
    if (lectureStateFilter === 'disabled' && item.active) return false;
    if (lectureExamFilter !== 'all' && item.exam !== lectureExamFilter && item.exam !== 'Both') return false;
    if (lectureClassFilter !== 'all' && !item.classes.includes(lectureClassFilter as ClassLevel)) return false;
    return true;
  });

  useEffect(() => {
    let cancelled = false;
    if (!form.parentId) {
      setCourseFiles([]);
      return () => {
        cancelled = true;
      };
    }
    getCourseFiles(form.parentId)
      .then((rows) => {
        if (!cancelled) setCourseFiles(rows);
      })
      .catch(() => {
        if (!cancelled) setCourseFiles([]);
      });
    return () => {
      cancelled = true;
    };
  }, [form.parentId]);

  function openCreate() {
    setEditing(null);
    setPdfError(null);
    const preParent = parentFilter ? allParents.find((c) => c.id === parentFilter) || null : null;
    const preSubject =
      preParent && subjectFilter
        ? subjectsForParent(preParent.id).find((s) => s.id === subjectFilter) || null
        : null;
    const inherited = inheritChildAudience(
      preParent ? { exam: preParent.exam, classes: preParent.classes } : null,
      preSubject ? { exam: preSubject.exam, classes: preSubject.classes } : null,
      null
    );
    setForm({
      ...EMPTY_LECTURE_FORM,
      parentId: preParent?.id || '',
      subjectId: preSubject?.id || '',
      exam: inherited.exam,
      classes: inherited.classes,
    });
    setShowForm(true);
  }

  function openEdit(item: CourseCatalogItem) {
    setEditing(item);
    const m = item.metadata as Record<string, any>;
    setPdfError(null);
    setForm({
      title: item.title,
      description: item.description,
      exam: item.exam,
      classes: item.classes?.length ? item.classes : ['11', '12'],
      active: item.active,
      accessCode: (item as any).access_code || '',
      youtubeUrl: m.youtubeUrl || '',
      videoId: m.videoId || '',
      thumbnailUrl: m.thumbnailUrl || '',
      lesson: m.lesson || '',
      topic: m.topic || '',
      notesPdfUrl: m.notesPdfUrl || '',
      isPreview: !!m.isPreview,
      parentId: item.parentId || m.parentId || '',
      subjectId: item.subjectId || m.subjectId || '',
      position: item.sortOrder ? String(item.sortOrder) : m.position || '',
      duration: m.duration || '',
      notesFileId: m.notesFileId || '',
      notesFileName: m.notesFileName || '',
    });
    setShowForm(true);
  }

  function handleParentChange(nextParentId: string) {
    const parentObj = allParents.find((c) => c.id === nextParentId) || null;
    setForm((s: any) => {
      const assigned = subjectsForParent(nextParentId);
      const keepSubject = assigned.find((subj) => subj.id === s.subjectId) || assigned[0] || null;
      const inherited = inheritChildAudience(
        parentObj ? { exam: parentObj.exam, classes: parentObj.classes } : null,
        keepSubject ? { exam: keepSubject.exam, classes: keepSubject.classes } : null,
        { exam: s.exam, classes: s.classes }
      );
      return {
        ...s,
        parentId: nextParentId,
        subjectId: keepSubject ? keepSubject.id : '',
        exam: parentObj ? inherited.exam : s.exam,
        classes: parentObj ? inherited.classes : s.classes,
      };
    });
  }

  function handleSubjectChange(nextSubjectId: string) {
    const parentObj = allParents.find((c) => c.id === form.parentId) || null;
    const subjObj = subjects.find((s) => s.id === nextSubjectId) || null;
    setForm((s: any) => {
      const inherited = inheritChildAudience(
        parentObj ? { exam: parentObj.exam, classes: parentObj.classes } : null,
        subjObj ? { exam: subjObj.exam, classes: subjObj.classes } : null,
        { exam: s.exam, classes: s.classes }
      );
      return {
        ...s,
        subjectId: nextSubjectId,
        exam: inherited.exam,
        classes: inherited.classes,
      };
    });
  }

  function handlePlaylistTargetChange(nextTargetId: string) {
    setPlaylistTarget(nextTargetId);
    const parentObj = allParents.find((c) => c.id === nextTargetId) || null;
    const assigned = subjectsForParent(nextTargetId);
    const nextSubj = assigned.find((s) => s.id === playlistSubject) || assigned[0] || null;
    setPlaylistSubject(nextSubj ? nextSubj.id : '');
    if (parentObj) {
      const inherited = inheritChildAudience(
        { exam: parentObj.exam, classes: parentObj.classes },
        nextSubj ? { exam: nextSubj.exam, classes: nextSubj.classes } : null,
        null
      );
      setPlaylistExam(inherited.exam);
      setPlaylistClasses(inherited.classes);
    }
  }

  async function verifyDriveFolder() {
    setProbingDrive(true);
    try {
      const res = await getAdminDriveStatus(true);
      setDriveStatus(res);
      if (res.probe?.ok) {
        push(`Drive folder verified (${res.probe.folderName || 'Accessible'}).`, 'success');
      } else {
        setPdfError(res.probe?.detail || res.credentialError || 'Google Drive folder verification failed.');
      }
    } catch (err) {
      setPdfError(err instanceof Error ? err.message : 'Unable to check Google Drive folder.');
    } finally {
      setProbingDrive(false);
    }
  }

  async function handlePdfUpload(file: File | null | undefined) {
    if (!file) return;
    if (!form.parentId) {
      setPdfError('Choose the parent batch or series first — private Drive PDFs are scoped to a course.');
      return;
    }
    const controller = new AbortController();
    pdfAbortRef.current = controller;
    setPdfUploading(true);
    setPdfProgress(0);
    setPdfError(null);
    try {
      const record = await uploadAdminPdf({
        courseId: form.parentId,
        file,
        signal: controller.signal,
        onProgress: (percent) => setPdfProgress(percent),
      });
      setForm((s: any) => ({
        ...s,
        notesFileId: record.id,
        notesFileName: record.displayName,
        notesPdfUrl: '',
      }));
      push('PDF uploaded to private Google Drive. Save the lecture to attach it.', 'success');
    } catch (e) {
      setPdfError(e instanceof Error ? e.message : 'The PDF upload failed.');
    } finally {
      setPdfUploading(false);
      pdfAbortRef.current = null;
      if (pdfInputRef.current) pdfInputRef.current.value = '';
    }
  }

  async function handleFetchMeta() {
    if (!form.youtubeUrl.trim()) {
      push('Enter YouTube URL first', 'error');
      return;
    }
    const vid = extractYoutubeVideoId(form.youtubeUrl);
    if (!vid) {
      push('Invalid YouTube URL', 'error');
      return;
    }
    setFetchingMeta(true);
    try {
      const meta = await fetchVideoMetadata(form.youtubeUrl);
      setForm((s: any) => ({
        ...s,
        title: s.title || meta.title,
        thumbnailUrl: s.thumbnailUrl || meta.thumbnail,
        videoId: meta.videoId,
        description: s.description || (meta.author ? `Faculty: ${meta.author}` : ''),
      }));
      push('Metadata auto-filled from YouTube.', 'success');
    } catch (e) {
      push(e instanceof Error ? e.message : 'Metadata fetch failed; enter fields manually.', 'error');
    } finally {
      setFetchingMeta(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) {
      push('Title is required', 'error');
      return;
    }
    if (!form.classes.length) {
      push('Select at least one class (11, 12, or Dropper)', 'error');
      return;
    }
    if (form.thumbnailUrl && !isSafeHttpUrl(form.thumbnailUrl)) {
      push('Thumbnail must be an http(s) URL', 'error');
      return;
    }
    if (form.notesPdfUrl && !isSafeHttpUrl(form.notesPdfUrl)) {
      push('Notes PDF URL must be an http(s) URL', 'error');
      return;
    }
    if (form.youtubeUrl && !extractYoutubeVideoId(form.youtubeUrl)) {
      push('Invalid YouTube URL', 'error');
      return;
    }
    if (form.subjectId && !form.parentId) {
      push('Choose a parent batch or series before selecting a subject.', 'error');
      return;
    }
    if (form.parentId && !form.subjectId) {
      push('Choose a subject assigned to this batch or series.', 'error');
      return;
    }
    if (form.notesFileId && !form.parentId) {
      push('A private Drive PDF requires a parent batch or series.', 'error');
      return;
    }
    setSaving(true);
    try {
      const vid = form.youtubeUrl ? extractYoutubeVideoId(form.youtubeUrl) : form.videoId || '';
      const metadata: Record<string, unknown> = {
        youtubeUrl: form.youtubeUrl || undefined,
        videoId: vid || undefined,
        thumbnailUrl: form.thumbnailUrl || (vid ? getYoutubeDefaultThumbnail(vid) : undefined),
        duration: form.duration || undefined,
        position: form.position ? Number(form.position) : undefined,
        parentId: form.parentId || undefined,
        subjectId: form.subjectId || undefined,
        lesson: form.lesson || undefined,
        topic: form.topic || undefined,
        notesPdfUrl: form.notesFileId ? undefined : form.notesPdfUrl || undefined,
        notesFileId: form.notesFileId || undefined,
        notesFileName: form.notesFileId ? form.notesFileName || undefined : undefined,
        isPreview: !!form.isPreview,
        playlistId: form.playlistId || undefined,
      };
      const payload = {
        kind: 'lecture' as const,
        title: form.title.trim(),
        description: form.description.slice(0, 10000),
        exam: form.exam,
        classes: form.classes,
        active: !!form.active,
        accessCode: form.accessCode || null,
        metadata,
        parentId: form.parentId || null,
        subjectId: form.subjectId || null,
        sortOrder: form.position ? Number(form.position) : 0,
      };
      if (editing) await updateAdminContent(editing.id, payload);
      else await createAdminContent(payload);
      invalidateAuthorizedBlobCache('/api/ec/files');
      push(editing ? 'Lecture updated.' : 'Lecture created and linked.', 'success');
      setShowForm(false);
      await load();
    } catch (err) {
      push(err instanceof Error ? err.message : 'Save failed', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleRestoreLecture(item: CourseCatalogItem) {
    try {
      await updateAdminContent(item.id, {
        kind: 'lecture',
        title: item.title,
        description: item.description,
        exam: item.exam,
        classes: item.classes,
        active: true,
        accessCode: (item as any).access_code ?? null,
        metadata: item.metadata as Record<string, unknown>,
        parentId: item.parentId,
        subjectId: item.subjectId,
        sortOrder: item.sortOrder,
      });
      push('Lecture restored and published.', 'success');
      await load();
    } catch (err) {
      push(err instanceof Error ? err.message : 'Could not restore lecture.', 'error');
    }
  }

  async function executeConfirmedLectureAction() {
    if (!confirmLectureAction) return;
    setConfirmBusy(true);
    try {
      if (confirmLectureAction.mode === 'disable') {
        await disableAdminContent(confirmLectureAction.item.id);
        push('Lecture disabled.', 'success');
      } else {
        await permanentlyDeleteAdminContent(confirmLectureAction.item.id);
        push('Lecture permanently deleted.', 'success');
      }
      setConfirmLectureAction(null);
      await load();
    } catch (err) {
      push(describeContentDeleteError(err), 'error');
    } finally {
      setConfirmBusy(false);
    }
  }

  async function handlePlaylistImport() {
    if (!playlistUrl.trim()) {
      push('Paste a YouTube playlist URL', 'error');
      return;
    }
    const pid = extractYoutubePlaylistId(playlistUrl);
    if (!pid) {
      push('Invalid playlist URL (requires list= parameter)', 'error');
      return;
    }
    setPlaylistLoading(true);
    setPlaylistItems([]);
    setPlaylistTitle('');
    setPlaylistError(null);
    setPlaylistProgress('Connecting to Cloudflare playlist proxy…');
    setPlaylistIncomplete(false);
    try {
      const res = await importFullYoutubePlaylist(playlistUrl, {
        onProgress: (p) =>
          setPlaylistProgress(
            `Fetched ${p.pagesFetched} page(s) • ${p.totalItems} unique videos${p.hasMore ? ' • loading more…' : ''}`
          ),
      });
      setPlaylistItems(res.items);
      setPlaylistTitle(res.title);
      const incomplete = Boolean(
        res.note &&
          (res.note.includes('safety limit') ||
            res.note.includes('repeated a pagination cursor') ||
            res.note.includes('did not return a continuation cursor'))
      );
      setPlaylistIncomplete(incomplete);
      const summary = `Imported ${res.items.length} unique videos in ${res.pagesFetched} page(s).`;
      if (incomplete) {
        setPlaylistError(`${summary} ${res.note || 'Retry before saving.'}`);
        push('Playlist import may be incomplete. Retry before saving.', 'error');
      } else {
        setPlaylistError(null);
        setPlaylistProgress(summary);
        push(summary, 'success');
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Playlist import failed.';
      setPlaylistError(message);
      setPlaylistItems([]);
      push(message, 'error');
    } finally {
      setPlaylistLoading(false);
    }
  }

  async function handlePlaylistSave() {
    if (!playlistItems.length) {
      push('No videos imported yet', 'error');
      return;
    }
    if (!playlistTarget) {
      push('Select target batch or series', 'error');
      return;
    }
    if (!playlistSubject) {
      push('Select a subject assigned to the target batch or series.', 'error');
      return;
    }
    if (!playlistClasses.length) {
      push('Select at least one class', 'error');
      return;
    }
    const selectedItems = playlistItems.filter((i: any) => i.selected !== false);
    if (!selectedItems.length) {
      push('Select at least one video', 'error');
      return;
    }
    const existingVideoIds = new Set(
      items.map((item: any) => String((item.metadata as Record<string, any>)?.videoId || '')).filter(Boolean)
    );
    const alreadyExists = selectedItems.filter((it: any) => existingVideoIds.has(String(it.videoId))).length;
    const itemsToSave = selectedItems.filter((it: any) => !existingVideoIds.has(String(it.videoId)));
    if (!itemsToSave.length) {
      push(`All ${alreadyExists} selected videos already exist as lectures.`, 'error');
      return;
    }
    setSaving(true);
    let ok = 0;
    let fail = 0;
    const failureMessages: string[] = [];
    try {
      for (const it of itemsToSave) {
        try {
          const order = playlistItems.findIndex((entry: any) => entry.videoId === it.videoId) + 1;
          const metadata = {
            youtubeUrl: it.watchUrl,
            videoId: it.videoId,
            thumbnailUrl: it.thumbnail,
            duration: it.duration,
            position: order,
            parentId: playlistTarget,
            subjectId: playlistSubject,
            lesson: playlistTopic || playlistTitle,
            topic: playlistTopic || playlistTitle,
            isPreview: false,
            playlistId: extractYoutubePlaylistId(playlistUrl),
          };
          await createAdminContent({
            kind: 'lecture',
            title: it.title.trim() || `Lecture ${order}`,
            description: it.description || `Imported from playlist ${playlistTitle}`,
            exam: playlistExam,
            classes: playlistClasses,
            active: true,
            accessCode: null,
            metadata,
            parentId: playlistTarget,
            subjectId: playlistSubject,
            sortOrder: order,
          });
          ok++;
        } catch (err) {
          fail++;
          if (failureMessages.length < 2) {
            failureMessages.push(err instanceof Error ? err.message : 'Save error');
          }
        }
      }
      if (fail === 0) {
        push(`Saved ${ok} lectures${alreadyExists ? `; skipped ${alreadyExists} duplicates` : ''}.`, 'success');
        setPlaylistModalOpen(false);
        setPlaylistItems([]);
        setPlaylistUrl('');
      } else {
        push(
          `Saved ${ok}; ${fail} failed${alreadyExists ? `; ${alreadyExists} duplicates skipped` : ''}. ${failureMessages.join(' • ')}`,
          'error'
        );
      }
    } finally {
      setSaving(false);
      if (ok) await load();
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-bold text-ink-900">Lectures &amp; Subject Queues</h2>
          <p className="text-xs text-ink-500">
            Every lecture links to its exact Batch/Series and Subject ID so Up Next and Autoplay stay strictly within that subject.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => void load()}>
            Refresh
          </Button>
          <Button size="sm" variant="outline" onClick={() => setPlaylistModalOpen(true)}>
            + Import Playlist
          </Button>
          <Button size="sm" onClick={openCreate}>
            + Add Lecture
          </Button>
        </div>
      </div>

      <Card className="p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Input
            label="Search lectures"
            type="search"
            value={lectureSearch}
            onChange={(e) => setLectureSearch(e.target.value)}
            placeholder="Title, topic, or description…"
          />
          <Select label="Filter by course" value={parentFilter} onChange={(e) => setParentFilter(e.target.value)}>
            <option value="">All batches &amp; series</option>
            {batches.map((b) => (
              <option key={b.id} value={b.id}>
                Batch: {b.title}
              </option>
            ))}
            {series.map((s) => (
              <option key={s.id} value={s.id}>
                Series: {s.title}
              </option>
            ))}
          </Select>
          <Select label="Filter by subject" value={subjectFilter} onChange={(e) => setSubjectFilter(e.target.value)}>
            <option value="">All subjects</option>
            {subjects.map((subject) => (
              <option key={subject.id} value={subject.id}>
                {subject.name}
              </option>
            ))}
          </Select>
          <Select label="Exam" value={lectureExamFilter} onChange={(e) => setLectureExamFilter(e.target.value)}>
            <option value="all">All exams</option>
            <option value="JEE">JEE</option>
            <option value="NEET">NEET</option>
          </Select>
          <Select label="Class" value={lectureClassFilter} onChange={(e) => setLectureClassFilter(e.target.value)}>
            <option value="all">All classes</option>
            <option value="11">Class 11</option>
            <option value="12">Class 12</option>
            <option value="Dropper">Dropper</option>
          </Select>
          <Select label="State" value={lectureStateFilter} onChange={(e) => setLectureStateFilter(e.target.value)}>
            <option value="all">Active &amp; disabled</option>
            <option value="active">Active</option>
            <option value="disabled">Disabled</option>
          </Select>
        </div>
        <p className="mt-2.5 text-xs text-ink-500">
          Showing {filteredItems.length} of {items.length} lecture{items.length === 1 ? '' : 's'}
          {subjects.length === 0 && (
            <>
              {' '}
              · no subjects yet —{' '}
              <Link href="/admin/subjects" className="font-semibold text-brand-700 hover:underline">
                create a subject first
              </Link>
            </>
          )}
        </p>
      </Card>

      {loading && <Skeleton className="h-40 w-full" />}
      {error && <div className="p-3 bg-red-50 border border-red-200 text-sm text-red-700 rounded-xl">{error}</div>}
      {!loading && items.length === 0 && (
        <EmptyState
          title="No lectures yet"
          description="Click '+ Add Lecture' or '+ Import Playlist' to publish subject-assigned lectures."
        />
      )}
      {!loading && items.length > 0 && filteredItems.length === 0 && (
        <EmptyState title="No lectures match this filter" description="Adjust course, subject, exam, or class filters." />
      )}

      <div className="grid gap-3">
        {filteredItems.map((it) => {
          const m = it.metadata as Record<string, any>;
          const matchedSubj = subjects.find((subject) => subject.id === (it.subjectId || m.subjectId));
          return (
            <Card key={it.id} className="p-3.5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <YoutubeThumbnail
                  src={m.thumbnailUrl}
                  videoId={String(m.videoId || '')}
                  alt={it.title}
                  duration={m.duration ? String(m.duration) : null}
                  className="aspect-video w-full sm:w-36 rounded-lg shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className="font-bold text-sm text-ink-900 line-clamp-1">{it.title}</p>
                    <Badge variant={it.active ? 'success' : 'danger'}>{it.active ? 'Active' : 'Disabled'}</Badge>
                    <Badge variant="info">{it.exam}</Badge>
                    <Badge>{formatClassList(it.classes)}</Badge>
                    {matchedSubj && <Badge variant="default">{matchedSubj.name}</Badge>}
                    {m.isPreview && <Badge variant="info">Preview</Badge>}
                  </div>
                  <p className="text-xs text-ink-500 line-clamp-1 mt-1">{it.description}</p>
                  <p className="text-[11px] text-ink-400 mt-1">
                    {parentTitle(it.parentId || m.parentId) || 'Standalone'} • Order #{it.sortOrder ?? m.position ?? 0}
                    {m.notesFileId ? ` • Private PDF: ${m.notesFileName || 'Attached'}` : ''}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5 shrink-0">
                  <Button size="sm" variant="outline" onClick={() => openEdit(it)}>
                    Edit
                  </Button>
                  {it.active ? (
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => setConfirmLectureAction({ mode: 'disable', item: it })}
                    >
                      Disable
                    </Button>
                  ) : (
                    <>
                      <Button size="sm" variant="outline" onClick={() => void handleRestoreLecture(it)}>
                        Restore
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => setConfirmLectureAction({ mode: 'delete', item: it })}
                      >
                        Delete
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Add / Edit Lecture Modal */}
      <Modal
        open={showForm}
        onClose={() => !saving && !pdfUploading && setShowForm(false)}
        title={editing ? 'Edit Lecture' : 'Add Lecture'}
        description="Assign the parent Batch/Series and Subject. Exam track and classes inherit automatically from the parent course."
        size="lg"
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={saving || pdfUploading}
              onClick={() => setShowForm(false)}
            >
              Cancel
            </Button>
            <Button type="submit" form="admin-lecture-modal-form" size="sm" loading={saving} disabled={pdfUploading}>
              {editing ? 'Save Lecture' : 'Publish Lecture'}
            </Button>
          </>
        }
      >
        <form id="admin-lecture-modal-form" onSubmit={handleSave} className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
            <Input
              label="YouTube Video URL*"
              placeholder="https://www.youtube.com/watch?v=..."
              value={form.youtubeUrl}
              onChange={(e) => setForm((s: any) => ({ ...s, youtubeUrl: e.target.value }))}
            />
            <Button type="button" variant="outline" size="sm" loading={fetchingMeta} onClick={handleFetchMeta}>
              Auto-fill Metadata
            </Button>
          </div>

          <Input
            label="Lecture Title*"
            value={form.title}
            onChange={(e) => setForm((s: any) => ({ ...s, title: e.target.value }))}
            required
          />

          <Textarea
            label="Description"
            value={form.description}
            onChange={(e) => setForm((s: any) => ({ ...s, description: e.target.value }))}
            rows={2}
          />

          <div className="rounded-xl border border-brand-100 bg-brand-50/40 p-3.5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-bold uppercase tracking-wider text-brand-800">
                Course &amp; Subject Placement
              </p>
              {form.parentId && (
                <StatusPill tone="brand">
                  Synced scope: {form.exam} · {formatClassList(form.classes)}
                </StatusPill>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Select
                label="Parent Batch / Series"
                value={form.parentId}
                onChange={(e) => handleParentChange(e.target.value)}
              >
                <option value="">Standalone (no enrollment gate)</option>
                {batches.map((b) => (
                  <option key={b.id} value={b.id}>
                    Batch: {b.title} ({b.exam} · {formatClassList(b.classes)})
                  </option>
                ))}
                {series.map((s) => (
                  <option key={s.id} value={s.id}>
                    Series: {s.title} ({s.exam} · {formatClassList(s.classes)})
                  </option>
                ))}
              </Select>

              {form.parentId ? (
                <div>
                  <Select
                    label="Assigned Subject*"
                    value={form.subjectId}
                    required
                    onChange={(e) => handleSubjectChange(e.target.value)}
                  >
                    <option value="">Choose a subject…</option>
                    {subjectsForParent(form.parentId).map((subject) => (
                      <option key={subject.id} value={subject.id}>
                        {subject.name}
                      </option>
                    ))}
                  </Select>
                  {subjectsForParent(form.parentId).length === 0 && (
                    <p className="mt-1 text-[11px] text-amber-800">
                      This course has no subjects assigned yet.{' '}
                      <Link href="/admin/subjects" className="font-semibold underline">
                        Assign subjects first
                      </Link>
                      .
                    </p>
                  )}
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-ink-700 mb-1.5">Subject</label>
                  <p className="rounded-xl border border-dashed border-ink-200 bg-white px-3 py-2 text-xs text-ink-500">
                    Select a parent Batch or Series to place this lecture inside a subject queue.
                  </p>
                </div>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Select
                label="Exam Track*"
                value={form.exam}
                onChange={(e) => setForm((s: any) => ({ ...s, exam: e.target.value }))}
              >
                <option value="JEE">JEE</option>
                <option value="NEET">NEET</option>
                <option value="Both">Both</option>
              </Select>
              <ClassCheckboxGroup
                value={form.classes}
                onChange={(classes) => setForm((s: any) => ({ ...s, classes }))}
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label="Chapter / Lesson Label"
              value={form.lesson}
              onChange={(e) => setForm((s: any) => ({ ...s, lesson: e.target.value }))}
              placeholder="e.g. Electrostatics - Lecture 01"
            />
            <Input
              label="Topic Tag"
              value={form.topic}
              onChange={(e) => setForm((s: any) => ({ ...s, topic: e.target.value }))}
              placeholder="e.g. Coulomb's Law"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label="Duration (MM:SS)"
              placeholder="48:30"
              value={form.duration}
              onChange={(e) => setForm((s: any) => ({ ...s, duration: e.target.value }))}
            />
            <Input
              label="Queue Order (#)"
              type="number"
              placeholder="1"
              value={form.position}
              onChange={(e) => setForm((s: any) => ({ ...s, position: e.target.value }))}
            />
          </div>

          <ImageField
            label="Custom Thumbnail (URL or Google Drive Upload · Optional 16:9)"
            context="lecture_thumbnail"
            value={form.thumbnailUrl}
            onChange={(thumbnailUrl) => setForm((s: any) => ({ ...s, thumbnailUrl }))}
          />

          {/* Private Google Drive PDF Upload Box */}
          <div className="rounded-xl border border-ink-200 bg-ink-50/60 p-3.5 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs font-bold text-ink-900">Lecture Notes PDF (Private Google Drive)</p>
                <p className="text-[11px] text-ink-500">
                  Uploaded server-side (max 20 MB) and streamed only to authorized students.
                </p>
              </div>
              <button
                type="button"
                disabled={probingDrive}
                onClick={() => void verifyDriveFolder()}
                className="ec-btn border border-ink-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-ink-700 disabled:opacity-50"
              >
                {probingDrive ? 'Checking Drive…' : 'Verify Drive Folder'}
              </button>
            </div>

            {driveStatus?.probe && (
              <p
                className={`rounded-lg border px-2.5 py-1.5 text-[11px] ${
                  driveStatus.probe.ok
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                    : 'border-red-200 bg-red-50 text-red-800'
                }`}
              >
                {driveStatus.probe.ok
                  ? `Drive folder verified (${driveStatus.probe.folderName || driveStatus.folderId}).`
                  : driveStatus.probe.detail}
              </p>
            )}

            {form.notesFileId && (
              <div className="flex flex-wrap items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
                <span className="font-semibold">{form.notesFileName || 'Attached PDF'}</span>
                <span className="text-emerald-700">· linked via Drive File ID</span>
                <button
                  type="button"
                  className="ml-auto font-bold text-red-700 hover:underline"
                  onClick={() => setForm((s: any) => ({ ...s, notesFileId: '', notesFileName: '' }))}
                >
                  Detach
                </button>
              </div>
            )}

            {pdfUploading ? (
              <div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-ink-200">
                  <div className="h-full bg-brand-600 transition-all" style={{ width: `${pdfProgress}%` }} />
                </div>
                <div className="mt-1 flex items-center justify-between text-[11px] text-ink-500">
                  <span>Uploading to private Drive… {pdfProgress}%</span>
                  <button
                    type="button"
                    className="font-bold text-red-600 hover:underline"
                    onClick={() => pdfAbortRef.current?.abort()}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <input
                  ref={pdfInputRef}
                  type="file"
                  accept="application/pdf,.pdf"
                  aria-label="Upload notes PDF"
                  className="block w-full max-w-xs text-xs"
                  disabled={!form.parentId}
                  onChange={(e) => void handlePdfUpload(e.target.files?.[0])}
                />
                {courseFiles.length > 0 && (
                  <Select
                    label=""
                    value=""
                    onChange={(e) => {
                      const picked = courseFiles.find((file) => file.id === e.target.value);
                      if (picked) {
                        setForm((s: any) => ({
                          ...s,
                          notesFileId: picked.id,
                          notesFileName: picked.displayName,
                          notesPdfUrl: '',
                        }));
                      }
                    }}
                  >
                    <option value="">Or attach an existing course PDF…</option>
                    {courseFiles.map((file) => (
                      <option key={file.id} value={file.id}>
                        {file.displayName}
                      </option>
                    ))}
                  </Select>
                )}
              </div>
            )}

            {pdfError && (
              <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-2.5 text-[11px] leading-relaxed text-red-800">
                {pdfError}
              </p>
            )}

            <details>
              <summary className="cursor-pointer text-[11px] font-semibold text-ink-500">
                Or link an external https:// PDF URL
              </summary>
              <div className="mt-2">
                <Input
                  label="External Notes PDF URL"
                  value={form.notesPdfUrl}
                  onChange={(e) => setForm((s: any) => ({ ...s, notesPdfUrl: e.target.value, notesFileId: '' }))}
                />
              </div>
            </details>
          </div>

          <div className="flex flex-wrap gap-5 pt-1">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={form.isPreview}
                onChange={(e) => setForm((s: any) => ({ ...s, isPreview: e.target.checked }))}
              />
              Free Preview (unlocked before enrollment)
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => setForm((s: any) => ({ ...s, active: e.target.checked }))}
              />
              Active &amp; published
            </label>
          </div>
        </form>
      </Modal>

      {/* Import YouTube Playlist Modal */}
      <Modal
        open={playlistModalOpen}
        onClose={() => !saving && !playlistLoading && setPlaylistModalOpen(false)}
        title="Import YouTube Playlist into Subject Queue"
        description="Fetches public playlist videos via the Cloudflare media proxy, deduplicates video IDs, and saves ordered lectures under one Batch/Series and Subject."
        size="xl"
        footer={
          playlistItems.length > 0 ? (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={saving}
                onClick={() => setPlaylistModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                loading={saving}
                disabled={saving || playlistLoading || playlistIncomplete}
                onClick={() => void handlePlaylistSave()}
              >
                Save {playlistItems.filter((i: any) => i.selected !== false).length} Lectures
              </Button>
            </>
          ) : undefined
        }
      >
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Input
              placeholder="https://www.youtube.com/playlist?list=..."
              value={playlistUrl}
              onChange={(e) => setPlaylistUrl(e.target.value)}
              className="flex-1 min-w-[260px]"
            />
            <Button loading={playlistLoading} disabled={playlistLoading} onClick={() => void handlePlaylistImport()}>
              Fetch Playlist
            </Button>
          </div>

          {playlistLoading && (
            <p role="status" aria-live="polite" className="text-xs font-medium text-brand-700">
              {playlistProgress}
            </p>
          )}
          {!playlistLoading && playlistProgress && !playlistError && (
            <p role="status" className="text-xs text-ink-500">
              {playlistProgress}
            </p>
          )}
          {playlistError && (
            <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800">
              {playlistError}
            </div>
          )}

          {playlistItems.length > 0 && (
            <div className="space-y-3.5">
              <div className="grid gap-3 rounded-xl border border-brand-100 bg-brand-50/40 p-3.5 sm:grid-cols-2 lg:grid-cols-3">
                <Select
                  label="Target Batch / Series*"
                  value={playlistTarget}
                  onChange={(e) => handlePlaylistTargetChange(e.target.value)}
                >
                  <option value="">Select target course…</option>
                  {batches.map((b) => (
                    <option key={b.id} value={b.id}>
                      Batch: {b.title}
                    </option>
                  ))}
                  {series.map((s) => (
                    <option key={s.id} value={s.id}>
                      Series: {s.title}
                    </option>
                  ))}
                </Select>
                <Select
                  label="Assigned Subject*"
                  value={playlistSubject}
                  required
                  onChange={(e) => setPlaylistSubject(e.target.value)}
                >
                  <option value="">Choose a subject…</option>
                  {(playlistTarget ? subjectsForParent(playlistTarget) : subjects).map((subject) => (
                    <option key={subject.id} value={subject.id}>
                      {subject.name}
                    </option>
                  ))}
                </Select>
                <Input
                  label="Chapter / Topic Tag"
                  value={playlistTopic}
                  onChange={(e) => setPlaylistTopic(e.target.value)}
                  placeholder={playlistTitle}
                />
                <Select
                  label="Exam Track"
                  value={playlistExam}
                  onChange={(e) => setPlaylistExam(e.target.value as ContentExam)}
                >
                  <option value="JEE">JEE</option>
                  <option value="NEET">NEET</option>
                  <option value="Both">Both</option>
                </Select>
                <div className="sm:col-span-2">
                  <ClassCheckboxGroup value={playlistClasses} onChange={setPlaylistClasses} />
                </div>
              </div>

              <div className="max-h-80 overflow-y-auto rounded-xl border border-ink-100">
                <div className="sticky top-0 z-[1] flex justify-between border-b border-ink-100 bg-ink-50 px-3 py-2 text-xs font-semibold">
                  <span>
                    {playlistTitle} • {playlistItems.length} videos
                  </span>
                  <span>{playlistItems.filter((i: any) => i.selected !== false).length} selected</span>
                </div>
                {playlistItems.map((it: any, idx: number) => (
                  <div key={it.videoId} className="flex items-start gap-3 border-b border-ink-100 p-2.5">
                    <input
                      type="checkbox"
                      className="mt-2"
                      checked={it.selected !== false}
                      onChange={(e) =>
                        setPlaylistItems((s) =>
                          s.map((x: any, i) => (i === idx ? { ...x, selected: e.target.checked } : x))
                        )
                      }
                    />
                    <YoutubeThumbnail
                      src={it.thumbnail}
                      videoId={it.videoId}
                      alt={it.title}
                      className="aspect-video w-24 rounded-md shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <input
                        aria-label={`Lecture ${idx + 1} title`}
                        value={it.title}
                        onChange={(e) =>
                          setPlaylistItems((s) => s.map((x, i) => (i === idx ? { ...x, title: e.target.value } : x)))
                        }
                        className="w-full text-xs font-semibold bg-transparent border-b border-transparent focus:border-brand-300 focus:outline-none"
                      />
                      <p className="text-[11px] text-ink-400 mt-0.5">
                        #{idx + 1} • {it.videoId} {it.duration ? `• ${it.duration}` : ''}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={idx === 0}
                        onClick={() =>
                          setPlaylistItems((s) => {
                            const next = [...s];
                            [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
                            return next;
                          })
                        }
                      >
                        ↑
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={idx === playlistItems.length - 1}
                        onClick={() =>
                          setPlaylistItems((s) => {
                            const next = [...s];
                            [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
                            return next;
                          })
                        }
                      >
                        ↓
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(confirmLectureAction)}
        loading={confirmBusy}
        title={
          confirmLectureAction?.mode === 'disable'
            ? `Disable "${confirmLectureAction.item.title}"?`
            : `Permanently delete "${confirmLectureAction?.item.title || ''}"?`
        }
        description={
          confirmLectureAction?.mode === 'disable'
            ? 'This lecture will be hidden from student subject queues while preserving watch history.'
            : 'Permanent deletion cannot be undone and is blocked if student progress or files reference this lecture.'
        }
        confirmLabel={confirmLectureAction?.mode === 'disable' ? 'Disable lecture' : 'Delete permanently'}
        onCancel={() => setConfirmLectureAction(null)}
        onConfirm={() => void executeConfirmedLectureAction()}
      />
    </div>
  );
}

function AdminTestsTab() {
  const { push } = useToast();
  const [items, setItems] = useState<CourseCatalogItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<CourseCatalogItem | null>(null);
  const [form, setForm] = useState<any>({
    title: '',
    description: '',
    exam: 'JEE',
    classes: ['11', '12', 'Dropper'],
    active: true,
    subject: '',
    durationMinutes: '30',
    scheduledAt: '',
    endsAt: '',
    isLive: false,
    allowMultipleAttempts: false,
    marksPerQuestion: '4',
    negativeMarks: '1',
    questionsJson: '',
  });
  const [validation, setValidation] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [disableTarget, setDisableTarget] = useState<CourseCatalogItem | null>(null);
  const [disabling, setDisabling] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAdminContentList({ kind: 'test' });
      setItems(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function openCreate() {
    setEditing(null);
    setForm({
      title: '',
      description: '',
      exam: 'JEE',
      classes: ['11', '12', 'Dropper'],
      active: true,
      subject: '',
      durationMinutes: '30',
      scheduledAt: '',
      endsAt: '',
      isLive: false,
      allowMultipleAttempts: false,
      marksPerQuestion: '4',
      negativeMarks: '1',
      questionsJson: JSON.stringify(
        {
          questions: [
            {
              id: 'q1',
              type: 'single-choice',
              text: 'Sample question',
              options: [
                { id: 'A', text: 'Option A' },
                { id: 'B', text: 'Option B' },
                { id: 'C', text: 'Option C' },
                { id: 'D', text: 'Option D' },
              ],
              correctAnswer: 'B',
              marks: 4,
              negativeMarks: 1,
              explanation: 'Shown after submission',
            },
          ],
        },
        null,
        2
      ),
    });
    setValidation(null);
    setShowForm(true);
  }

  function openEdit(item: CourseCatalogItem) {
    setEditing(item);
    const m = item.metadata as Record<string, any>;
    setForm({
      title: item.title,
      description: item.description,
      exam: item.exam,
      classes: item.classes?.length ? item.classes : ['11', '12'],
      active: item.active,
      subject: m.subject || '',
      durationMinutes: String(m.durationMinutes || 30),
      scheduledAt: m.scheduledAt
        ? toISTDateTimeLocalInput(m.scheduledAt)
        : m.scheduled_at
          ? toISTDateTimeLocalInput(m.scheduled_at)
          : '',
      endsAt: m.endsAt
        ? toISTDateTimeLocalInput(m.endsAt)
        : m.ends_at
          ? toISTDateTimeLocalInput(m.ends_at)
          : '',
      isLive: !!m.isLive,
      allowMultipleAttempts: !!m.allowMultipleAttempts,
      marksPerQuestion: String(m.marksPerQuestion || 4),
      negativeMarks: String(m.negativeMarks || 1),
      questionsJson: JSON.stringify({ questions: m.questions || [] }, null, 2),
    });
    setValidation(null);
    setShowForm(true);
  }

  function handleValidate() {
    const res = validateQuestionsJson(form.questionsJson);
    setValidation(res);
    if (res.valid) push(`Valid: ${res.questions.length} questions`, 'success');
    else push(`Found ${res.errors.length} validation errors`, 'error');
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const res = validateQuestionsJson(form.questionsJson);
    if (!res.valid) {
      setValidation(res);
      push('Fix question JSON validation errors before saving', 'error');
      return;
    }
    if (!form.title.trim()) {
      push('Title required', 'error');
      return;
    }
    if (!form.classes.length) {
      push('Select at least one class', 'error');
      return;
    }
    setSaving(true);
    try {
      const scheduledAt = form.scheduledAt ? fromISTDateTimeLocalInput(form.scheduledAt) : null;
      const endsAt = form.endsAt ? fromISTDateTimeLocalInput(form.endsAt) : null;
      const metadata: Record<string, unknown> = {
        subject: form.subject || undefined,
        durationMinutes: Number(form.durationMinutes) || 0,
        scheduledAt,
        endsAt,
        isLive: !!form.isLive,
        allowMultipleAttempts: !!form.allowMultipleAttempts,
        marksPerQuestion: Number(form.marksPerQuestion) || 4,
        negativeMarks: Number(form.negativeMarks) || 0,
        questions: res.questions,
        totalQuestions: res.questions.length,
        totalMarks: res.questions.reduce(
          (s, q) => s + (Number(q.marks) || Number(form.marksPerQuestion) || 4),
          0
        ),
      };
      const payload = {
        kind: 'test' as const,
        title: form.title.trim(),
        description: form.description.slice(0, 10000),
        exam: form.exam,
        classes: form.classes,
        active: !!form.active,
        accessCode: null,
        metadata,
      };
      if (editing) await updateAdminContent(editing.id, payload);
      else await createAdminContent(payload);
      push(editing ? 'Test updated.' : 'Test created.', 'success');
      setShowForm(false);
      await load();
    } catch (err) {
      push(err instanceof Error ? err.message : 'Save failed', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function confirmDisableTest() {
    if (!disableTarget) return;
    setDisabling(true);
    try {
      await disableAdminContent(disableTarget.id);
      push('Test disabled.', 'success');
      setDisableTarget(null);
      await load();
    } catch (err) {
      push(err instanceof Error ? err.message : 'Failed', 'error');
    } finally {
      setDisabling(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-bold text-ink-900">Tests &amp; Question Banks</h2>
          <p className="text-xs text-ink-500">Server-scored exams; answer keys remain hidden until submission.</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => void load()}>
            Refresh
          </Button>
          <Button size="sm" onClick={openCreate}>
            + Create Test
          </Button>
        </div>
      </div>

      {loading && <Skeleton className="h-40 w-full" />}
      {error && <div className="p-3 bg-red-50 border border-red-200 text-sm text-red-700 rounded-xl">{error}</div>}
      {!loading && items.length === 0 && (
        <EmptyState title="No tests yet" description="Create a test with validated JSON questions, IST schedule, and marking scheme." />
      )}

      <div className="grid gap-3">
        {items.map((it) => {
          const m = it.metadata as Record<string, any>;
          return (
            <Card key={it.id} className="p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className="font-bold text-sm text-ink-900">{it.title}</p>
                    <Badge variant={it.active ? 'success' : 'danger'}>{it.active ? 'Active' : 'Disabled'}</Badge>
                    <Badge variant="info">{it.exam}</Badge>
                    <Badge>{formatClassList(it.classes)}</Badge>
                    {m.isLive && <Badge variant="success">Live</Badge>}
                  </div>
                  {it.description && <p className="text-xs text-ink-500 mt-1">{it.description}</p>}
                  <p className="text-[11px] text-ink-400 mt-1">
                    {m.subject || 'All subjects'} • {m.durationMinutes || 0} min •{' '}
                    {Array.isArray(m.questions) ? m.questions.length : m.totalQuestions || 0} Qs • +{m.marksPerQuestion || 0} / -
                    {m.negativeMarks || 0}
                  </p>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <Button size="sm" variant="outline" onClick={() => openEdit(it)}>
                    Edit
                  </Button>
                  {it.active && (
                    <Button size="sm" variant="danger" onClick={() => setDisableTarget(it)}>
                      Disable
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <Modal
        open={showForm}
        onClose={() => !saving && setShowForm(false)}
        title={editing ? 'Edit Test' : 'Create Test'}
        description="Configure exam track, eligible classes (11, 12, Dropper), schedule, and JSON question bank."
        size="xl"
        footer={
          <>
            <Button type="button" variant="outline" size="sm" disabled={saving} onClick={() => setShowForm(false)}>
              Cancel
            </Button>
            <Button type="submit" form="admin-test-modal-form" size="sm" loading={saving}>
              {editing ? 'Save Test' : 'Create Test'}
            </Button>
          </>
        }
      >
        <form id="admin-test-modal-form" onSubmit={handleSave} className="space-y-3.5">
          <Input
            label="Test Title*"
            value={form.title}
            onChange={(e) => setForm((s: any) => ({ ...s, title: e.target.value }))}
            required
          />
          <Textarea
            label="Description / Instructions"
            value={form.description}
            onChange={(e) => setForm((s: any) => ({ ...s, description: e.target.value }))}
            rows={2}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <Select
              label="Exam Track*"
              value={form.exam}
              onChange={(e) => setForm((s: any) => ({ ...s, exam: e.target.value }))}
            >
              <option value="JEE">JEE</option>
              <option value="NEET">NEET</option>
              <option value="Both">Both</option>
            </Select>
            <ClassCheckboxGroup
              value={form.classes}
              onChange={(classes) => setForm((s: any) => ({ ...s, classes }))}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label="Subject"
              value={form.subject}
              onChange={(e) => setForm((s: any) => ({ ...s, subject: e.target.value }))}
              placeholder="Full Syllabus / Physics / Chemistry / Biology / Maths"
            />
            <Input
              label="Duration (minutes)*"
              type="number"
              value={form.durationMinutes}
              onChange={(e) => setForm((s: any) => ({ ...s, durationMinutes: e.target.value }))}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label="Scheduled At (IST)"
              type="datetime-local"
              value={form.scheduledAt}
              onChange={(e) => setForm((s: any) => ({ ...s, scheduledAt: e.target.value }))}
            />
            <Input
              label="Ends At (IST)"
              type="datetime-local"
              value={form.endsAt}
              onChange={(e) => setForm((s: any) => ({ ...s, endsAt: e.target.value }))}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label="Marks per question"
              type="number"
              value={form.marksPerQuestion}
              onChange={(e) => setForm((s: any) => ({ ...s, marksPerQuestion: e.target.value }))}
            />
            <Input
              label="Negative marks"
              type="number"
              value={form.negativeMarks}
              onChange={(e) => setForm((s: any) => ({ ...s, negativeMarks: e.target.value }))}
            />
          </div>

          <div className="flex flex-wrap gap-5">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={form.isLive}
                onChange={(e) => setForm((s: any) => ({ ...s, isLive: e.target.checked }))}
              />
              Mark Live Now
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={form.allowMultipleAttempts}
                onChange={(e) => setForm((s: any) => ({ ...s, allowMultipleAttempts: e.target.checked }))}
              />
              Allow multiple attempts
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => setForm((s: any) => ({ ...s, active: e.target.checked }))}
              />
              Active
            </label>
          </div>

          <div>
            <div className="mb-2.5 rounded-2xl border border-ink-200 bg-ink-50/50 p-3">
              <ImageField
                label="Question Diagram Uploader (Google Drive → Copy URL into question imageUrl)"
                help="Need a circuit, graph, or organic structure diagram inside a question? Upload here and copy the generated /api/ec/media/… URL into any question imageUrl field."
                context="question_diagram"
                compact
                value={form.lastDiagramUrl || ''}
                placeholder="Upload diagram image below to get a ready-to-use URL…"
                onChange={(url) => setForm((s: any) => ({ ...s, lastDiagramUrl: url }))}
              />
            </div>

            <label className="block text-sm font-medium text-ink-700 mb-1.5">
              Questions JSON* (paste or upload — preserves LaTeX)
            </label>
            <textarea
              value={form.questionsJson}
              onChange={(e) => setForm((s: any) => ({ ...s, questionsJson: e.target.value }))}
              rows={9}
              className="w-full rounded-xl border border-ink-200 bg-white px-3 py-2 text-xs font-mono"
              placeholder='{"questions":[...]}'
            />
            <div className="flex gap-2 mt-2">
              <Button type="button" size="sm" variant="outline" onClick={handleValidate}>
                Validate JSON
              </Button>
              <label className="px-3 py-1.5 bg-white border border-ink-200 rounded-lg text-xs font-semibold cursor-pointer">
                Upload .json
                <input
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    const r = new FileReader();
                    r.onload = () => setForm((s: any) => ({ ...s, questionsJson: String(r.result) }));
                    r.readAsText(f);
                  }}
                />
              </label>
            </div>
            {validation && (
              <div
                className={`mt-2 p-3 rounded-xl text-xs ${
                  validation.valid
                    ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                    : 'bg-red-50 border border-red-200 text-red-700'
                }`}
              >
                {validation.valid ? (
                  <p>✓ Valid — {validation.questions.length} questions ready.</p>
                ) : (
                  <div>
                    {validation.globalError && <p className="font-semibold">{validation.globalError}</p>}
                    {validation.errors.map((er: any, i: number) => (
                      <p key={i}>
                        Row {er.row} ({er.questionId}): {er.message}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(disableTarget)}
        loading={disabling}
        title={disableTarget ? `Disable "${disableTarget.title}"?` : 'Disable test?'}
        description="Students will no longer see this test on their dashboard, while past attempts remain preserved."
        confirmLabel="Disable test"
        onCancel={() => setDisableTarget(null)}
        onConfirm={() => void confirmDisableTest()}
      />
    </div>
  );
}

function AdminAnnouncementsTab() {
  const { push } = useToast();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ title: '', body: '', audience: 'All', active: true, scheduledAt: '' });
  const [editing, setEditing] = useState<any>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAdminAnnouncements();
      setItems(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function openCreate() {
    setEditing(null);
    setForm({ title: '', body: '', audience: 'All', active: true, scheduledAt: '' });
    setShowForm(true);
  }

  function openEdit(a: any) {
    setEditing(a);
    setForm({
      title: a.title,
      body: a.body,
      audience: a.audience,
      active: a.active,
      scheduledAt: a.scheduled_at ? toISTDateTimeLocalInput(a.scheduled_at) : '',
    });
    setShowForm(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      title: form.title,
      body: form.body,
      audience: form.audience,
      active: form.active,
      scheduledAt: form.scheduledAt ? fromISTDateTimeLocalInput(form.scheduledAt) : null,
    };
    setSaving(true);
    try {
      if (editing) await updateAdminAnnouncement(editing.id, payload);
      else await createAdminAnnouncement(payload);
      push(editing ? 'Announcement updated.' : 'Announcement created.', 'success');
      setShowForm(false);
      await load();
    } catch (err) {
      push(err instanceof Error ? err.message : 'Save failed', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-ink-900">Announcements</h2>
          <p className="text-xs text-ink-500">Broadcast notices targeted by exam track and class cohort.</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => void load()}>
            Refresh
          </Button>
          <Button size="sm" onClick={openCreate}>
            + New Announcement
          </Button>
        </div>
      </div>

      {loading && <Skeleton className="h-40 w-full" />}
      {error && <div className="p-3 bg-red-50 border border-red-200 text-sm text-red-700 rounded-xl">{error}</div>}
      {!loading && items.length === 0 && (
        <EmptyState title="No announcements" description="Post announcements targeted to All, JEE, NEET, Class 11, Class 12, or Dropper." />
      )}

      <div className="grid gap-3">
        {items.map((a) => (
          <Card key={a.id} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-bold text-sm text-ink-900">
                  {a.title}{' '}
                  <Badge variant={a.active ? 'success' : 'danger'}>{a.active ? 'Active' : 'Disabled'}</Badge>{' '}
                  <Badge variant="info">{a.audience}</Badge>
                </p>
                <p className="text-xs text-ink-600 mt-1">{a.body}</p>
                <p className="text-[11px] text-ink-400 mt-1">
                  Scheduled: {a.scheduled_at || 'Immediate'} • Created {a.created_at}
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={() => openEdit(a)}>
                Edit
              </Button>
            </div>
          </Card>
        ))}
      </div>

      <Modal
        open={showForm}
        onClose={() => !saving && setShowForm(false)}
        title={editing ? 'Edit Announcement' : 'New Announcement'}
        size="md"
        footer={
          <>
            <Button type="button" variant="outline" size="sm" disabled={saving} onClick={() => setShowForm(false)}>
              Cancel
            </Button>
            <Button type="submit" form="admin-announcement-modal-form" size="sm" loading={saving}>
              {editing ? 'Update' : 'Publish'}
            </Button>
          </>
        }
      >
        <form id="admin-announcement-modal-form" onSubmit={handleSave} className="space-y-3.5">
          <Input
            label="Title*"
            value={form.title}
            onChange={(e) => setForm((s) => ({ ...s, title: e.target.value }))}
            required
          />
          <Textarea
            label="Body*"
            value={form.body}
            onChange={(e) => setForm((s) => ({ ...s, body: e.target.value }))}
            rows={3}
            required
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <Select
              label="Audience"
              value={form.audience}
              onChange={(e) => setForm((s) => ({ ...s, audience: e.target.value }))}
            >
              <option value="All">All students</option>
              <option value="JEE">JEE (11, 12 &amp; Dropper)</option>
              <option value="NEET">NEET (11, 12 &amp; Dropper)</option>
              <option value="Dropper">All Droppers</option>
              <option value="JEE 11">JEE · Class 11</option>
              <option value="JEE 12">JEE · Class 12</option>
              <option value="JEE Dropper">JEE · Dropper</option>
              <option value="NEET 11">NEET · Class 11</option>
              <option value="NEET 12">NEET · Class 12</option>
              <option value="NEET Dropper">NEET · Dropper</option>
            </Select>
            <Input
              label="Scheduled At (IST)"
              type="datetime-local"
              value={form.scheduledAt}
              onChange={(e) => setForm((s) => ({ ...s, scheduledAt: e.target.value }))}
            />
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm((s) => ({ ...s, active: e.target.checked }))}
            />
            Active
          </label>
        </form>
      </Modal>
    </div>
  );
}

function AdminStudentsTab() {
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAdminStudents();
      setStudents(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = students.filter(
    (s) =>
      !filter ||
      s.display_name?.toLowerCase().includes(filter.toLowerCase()) ||
      s.email?.toLowerCase().includes(filter.toLowerCase()) ||
      s.exam?.toLowerCase().includes(filter.toLowerCase()) ||
      s.class_level?.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-ink-900">Students</h2>
        <Button size="sm" variant="outline" onClick={() => void load()}>
          Refresh
        </Button>
      </div>
      <Input
        placeholder="Search by name, email, exam, or class (11, 12, Dropper)…"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      />
      {loading && <Skeleton className="h-40 w-full" />}
      {error && <div className="p-3 bg-red-50 border border-red-200 text-sm text-red-700 rounded-xl">{error}</div>}
      {!loading && filtered.length === 0 && (
        <EmptyState title="No students" description="Students appear after onboarding via POST /profile." />
      )}
      <div className="grid gap-2">
        {filtered.map((s) => (
          <Card key={s.firebase_uid} className="p-3 flex items-center gap-3">
            <ProfileImage src={s.avatar_url} name={s.display_name} className="h-10 w-10" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm truncate">
                {s.display_name} <Badge variant="info">{s.exam}</Badge>{' '}
                <Badge>{formatClassLevel(s.class_level)}</Badge>
              </p>
              <p className="text-xs text-ink-500 truncate">
                {s.email} • UID {s.firebase_uid.slice(0, 8)} • {new Date(s.created_at).toLocaleDateString('en-IN')}
              </p>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

export function AdminFeedbackTab() {
  const { user } = useAuth();
  const { push } = useToast();
  const [threads, setThreads] = useState<any[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let unsub: (() => void) | undefined;
    import('@/lib/app-data')
      .then(({ subscribeToAllStudentThreads }) => {
        if (!cancelled) unsub = subscribeToAllStudentThreads(setThreads);
      })
      .catch(() => {
        if (!cancelled) push('Unable to load student feedback', 'error');
      });
    return () => {
      cancelled = true;
      unsub?.();
    };
  }, [push]);

  useEffect(() => {
    if (!selected || !user) return;
    let cancelled = false;
    let unsub: (() => void) | undefined;
    import('@/lib/app-data')
      .then(({ subscribeToFeedbackMessages }) => {
        if (!cancelled) unsub = subscribeToFeedbackMessages(selected, setMessages);
      })
      .catch(() => {
        if (!cancelled) push('Unable to load feedback details', 'error');
      });
    return () => {
      cancelled = true;
      unsub?.();
    };
  }, [selected, user, push]);

  async function handleReply(e: React.FormEvent) {
    e.preventDefault();
    if (!selected || !user || !reply.trim()) return;
    if (reply.length > 5000) {
      push('Message too long', 'error');
      return;
    }
    setSending(true);
    try {
      const { sendStudentMessage } = await import('@/lib/app-data');
      await sendStudentMessage(selected, reply.trim(), 'admin', user.uid);
      setReply('');
      push('Replied', 'success');
    } catch (err) {
      push(err instanceof Error ? err.message : 'Failed', 'error');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="grid md:grid-cols-[340px_1fr] gap-4">
      <Card className="p-0 overflow-hidden">
        <div className="p-3 border-b border-ink-100 bg-ink-50 flex items-center justify-between">
          <h3 className="font-semibold text-sm">Feedback inbox</h3>
          <Badge>{threads.length}</Badge>
        </div>
        <div className="max-h-[60vh] overflow-auto">
          {threads.length === 0 && (
            <p className="p-4 text-sm text-ink-500 text-center">No feedback submitted yet</p>
          )}
          {threads.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setSelected(t.id)}
              className={`w-full text-left p-3 border-b border-ink-100 hover:bg-ink-50 ${
                selected === t.id ? 'bg-brand-50' : ''
              }`}
            >
              <p className="font-semibold text-sm truncate">
                {t.studentName || t.studentUid.slice(0, 8)}
                {t.unreadByAdmin && <span className="ml-1 inline-block h-2 w-2 rounded-full bg-red-500" />}
              </p>
              <p className="text-xs text-ink-500 truncate">{t.lastMessageText || 'No messages'}</p>
              <p className="text-[11px] text-ink-400">
                {t.lastMessageAt ? new Date(t.lastMessageAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : ''}{' '}
                • {t.exam || ''} {t.classLevel ? formatClassLevel(t.classLevel) : ''}
              </p>
            </button>
          ))}
        </div>
      </Card>

      <Card className="p-0 overflow-hidden flex flex-col min-h-[60vh]">
        {!selected ? (
          <div className="flex-1 grid place-items-center text-sm text-ink-500 p-6 text-center">
            Select a feedback item to review and respond.
          </div>
        ) : (
          <>
            <div className="p-3 border-b border-ink-100 bg-ink-50 flex items-center justify-between">
              <h3 className="font-semibold text-sm">Thread • {selected.slice(0, 8)}</h3>
              <Badge variant="info">Admin</Badge>
            </div>
            <div className="flex-1 overflow-auto p-4 space-y-3 bg-ink-50">
              {messages.map((m) => (
                <div key={m.id} className={`flex ${m.senderRole === 'admin' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[75%] px-3 py-2 rounded-2xl text-sm ${
                      m.senderRole === 'admin'
                        ? 'bg-brand-600 text-white rounded-br-sm'
                        : 'bg-white border border-ink-200 rounded-bl-sm'
                    }`}
                  >
                    <p>{m.text}</p>
                    <p className="text-[10px] opacity-70 mt-1">
                      {new Date(m.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                    </p>
                  </div>
                </div>
              ))}
              {messages.length === 0 && (
                <p className="text-sm text-ink-500 text-center py-10">No messages in this thread.</p>
              )}
            </div>
            <form onSubmit={handleReply} className="p-3 border-t border-ink-100 flex gap-2 bg-white">
              <input
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder="Reply to feedback…"
                maxLength={5000}
                className="flex-1 rounded-full border border-ink-200 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              <Button type="submit" size="sm" loading={sending}>
                Send
              </Button>
            </form>
          </>
        )}
      </Card>
    </div>
  );
}

'use client';

import { useEffect, useMemo, useState } from 'react';
import type {
  CourseCatalogItem,
  DriveStatusResponse,
  FeatureFlags,
  FooterLinkColumn,
  LinkItem,
  MediaAsset,
  MediaAssetType,
  NavigationLink,
  SeoConfig,
  StudyChallenge,
} from '@/types';
import { useSettingWorkspace, type SettingWorkspace } from '@/hooks/useSettingWorkspace';
import { AUDIENCE_TARGETS, makeId } from '@/lib/site-config';
import { getAdminContentList, getAdminDriveStatus, uploadAdminPdf } from '@/lib/api';
import { isSafeHttpUrl, isValidInternalDeepLink } from '@/lib/validation';
import { formatISTDateTime, fromISTDateTimeLocalInput, toISTDateTimeLocalInput } from '@/lib/date';
import { useToast } from '@/hooks/useToast';
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
  Toggle,
} from '../ui';
import { LinkListEditor, StringListEditor } from '../ListEditors';
import { SettingsPublishBar } from '../SettingsPublishBar';

function PublishBar<T extends object>({ workspace }: { workspace: SettingWorkspace<T> }) {
  return (
    <SettingsPublishBar
      dirty={workspace.dirty}
      publishedAt={workspace.publishedAt}
      updatedAt={workspace.updatedAt}
      saving={workspace.saving}
      publishing={workspace.publishing}
      resetting={workspace.resetting}
      error={workspace.error}
      validationErrors={workspace.validationErrors}
      status={workspace.status}
      onSave={() => void workspace.saveDraft()}
      onPublish={() => void workspace.publish()}
      onReset={() => void workspace.reset()}
      onReload={() => void workspace.reload()}
    />
  );
}

function orderedMove<T>(items: T[], index: number, delta: number): T[] {
  const target = index + delta;
  if (target < 0 || target >= items.length) return items;
  const next = [...items];
  const [item] = next.splice(index, 1);
  next.splice(target, 0, item);
  return next;
}

function NavLinkEditor({
  title,
  description,
  links,
  onChange,
  max = 8,
  showIcon = false,
}: {
  title: string;
  description: string;
  links: NavigationLink[];
  onChange: (next: NavigationLink[]) => void;
  max?: number;
  showIcon?: boolean;
}) {
  return (
    <Panel
      title={title}
      description={description}
      action={
        <button
          type="button"
          onClick={() => onChange([...links, { id: makeId('nav'), label: 'New link', href: '/home', icon: '•', visible: true }])}
          disabled={links.length >= max}
          className="ec-btn px-2.5 py-1.5 text-[11px] font-semibold bg-brand-600 text-white disabled:opacity-40"
        >
          + Add link
        </button>
      }
    >
      <div className="space-y-2">
        {links.map((link, index) => {
          const valid = isValidInternalDeepLink(link.href) || isSafeHttpUrl(link.href);
          return (
            <div key={link.id} className="rounded-xl border border-ink-200 p-2.5">
              <div className="grid sm:grid-cols-[1fr_1fr_auto] gap-2">
                <input
                  className="ec-field !py-1.5 !text-xs"
                  value={link.label}
                  placeholder="Label"
                  onChange={(event) => onChange(links.map((item) => (item.id === link.id ? { ...item, label: event.target.value } : item)))}
                />
                <input
                  className={`ec-field !py-1.5 !text-xs ${valid ? '' : '!border-red-300'}`}
                  value={link.href}
                  placeholder="/lectures"
                  onChange={(event) => onChange(links.map((item) => (item.id === link.id ? { ...item, href: event.target.value } : item)))}
                />
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => onChange(orderedMove(links, index, -1))} disabled={index === 0} className="h-8 w-8 rounded-lg border border-ink-200 text-xs disabled:opacity-30" aria-label="Move up">↑</button>
                  <button type="button" onClick={() => onChange(orderedMove(links, index, 1))} disabled={index === links.length - 1} className="h-8 w-8 rounded-lg border border-ink-200 text-xs disabled:opacity-30" aria-label="Move down">↓</button>
                  <button type="button" onClick={() => onChange(links.filter((item) => item.id !== link.id))} className="h-8 w-8 rounded-lg border border-red-200 text-red-600 text-xs" aria-label="Remove">✕</button>
                </div>
              </div>
              <div className="flex items-center justify-between mt-1.5">
                <label className="flex items-center gap-1.5 text-[11px] text-ink-600">
                  <input
                    type="checkbox"
                    checked={link.visible}
                    onChange={(event) => onChange(links.map((item) => (item.id === link.id ? { ...item, visible: event.target.checked } : item)))}
                  />
                  Visible
                </label>
                {showIcon && (
                  <input
                    className="ec-field !py-1 !text-[11px] !w-20"
                    value={link.icon}
                    maxLength={2}
                    onChange={(event) => onChange(links.map((item) => (item.id === link.id ? { ...item, icon: event.target.value } : item)))}
                  />
                )}
                {!valid && <span className="text-[10px] text-red-600">Use an internal route or https:// URL</span>}
              </div>
            </div>
          );
        })}
        {links.length === 0 && <p className="text-xs text-ink-500">No links. Add the first one.</p>}
      </div>
    </Panel>
  );
}

export function NavigationSection() {
  const workspace = useSettingWorkspace('navigation');
  const { draft, update, loading } = workspace;
  if (loading) return <Spinner label="Loading navigation…" />;
  return (
    <div>
      <AdminPageHeader
        eyebrow="Website settings"
        title="Navigation & Menu Manager"
        description="Control the header CTA, header links, bottom navigation and the announcement bar. Every link is validated before publishing."
        meta={<StatusPill tone="brand">{draft.headerLinks.filter((link) => link.visible).length} header links</StatusPill>}
      />
      <PublishBar workspace={workspace} />
      <div className="grid gap-4 xl:grid-cols-2 mt-5">
        <NavLinkEditor
          title="Header links"
          description="Desktop header, ordered left to right."
          links={draft.headerLinks}
          onChange={(headerLinks) => update({ headerLinks })}
          showIcon
        />
        <NavLinkEditor
          title="Bottom navigation"
          description="Mobile bottom bar. Keep to 4–5 links."
          links={draft.bottomLinks}
          onChange={(bottomLinks) => update({ bottomLinks })}
          max={5}
          showIcon
        />
        <Panel title="Primary CTA" description="Shown in the header on larger screens.">
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="CTA label">
              <input className="ec-field" value={draft.ctaLabel} onChange={(event) => update({ ctaLabel: event.target.value })} />
            </Field>
            <Field label="CTA link">
              <input className="ec-field" value={draft.ctaHref} placeholder="/login" onChange={(event) => update({ ctaHref: event.target.value })} />
            </Field>
            <Toggle checked={draft.showSearch} onChange={(showSearch) => update({ showSearch })} label="Show header search" description="Requires global search to be enabled." />
          </div>
        </Panel>
        <Panel title="Announcement bar" description="A single-line strip above the header.">
          <div className="space-y-3">
            <Toggle
              checked={draft.announcementBarEnabled}
              onChange={(announcementBarEnabled) => update({ announcementBarEnabled })}
              label="Show announcement bar"
            />
            <Field label="Bar text">
              <input className="ec-field" value={draft.announcementBarText} onChange={(event) => update({ announcementBarText: event.target.value })} />
            </Field>
            <Field label="Bar link">
              <input className="ec-field" value={draft.announcementBarHref} placeholder="/events" onChange={(event) => update({ announcementBarHref: event.target.value })} />
            </Field>
          </div>
        </Panel>
      </div>
    </div>
  );
}

export function FooterSection() {
  const workspace = useSettingWorkspace('footer');
  const { draft, update, loading } = workspace;
  if (loading) return <Spinner label="Loading footer…" />;

  function patchColumn(id: string, patch: Partial<FooterLinkColumn>) {
    update({ columns: draft.columns.map((column) => (column.id === id ? { ...column, ...patch } : column)) });
  }

  return (
    <div>
      <AdminPageHeader
        eyebrow="Website settings"
        title="Footer Manager"
        description="Footer copy, link columns, social links and copyright — published with the rest of the site settings."
        meta={<StatusPill tone={draft.show ? 'success' : 'neutral'}>{draft.show ? 'Footer visible' : 'Footer hidden'}</StatusPill>}
      />
      <PublishBar workspace={workspace} />
      <div className="grid gap-4 xl:grid-cols-2 mt-5 items-start">
        <Panel title="Footer content">
          <div className="space-y-3">
            <Toggle checked={draft.show} onChange={(show) => update({ show })} label="Show footer" description="Applies to the student-facing app shell." />
            <Field label="About text">
              <textarea className="ec-field" rows={3} value={draft.text} onChange={(event) => update({ text: event.target.value })} />
            </Field>
            <Field label="Note">
              <input className="ec-field" value={draft.note} onChange={(event) => update({ note: event.target.value })} />
            </Field>
            <Field label="Copyright">
              <input className="ec-field" value={draft.copyright} onChange={(event) => update({ copyright: event.target.value })} />
            </Field>
            <LinkListEditor label="Social links" links={draft.socialLinks} onChange={(socialLinks) => update({ socialLinks })} max={8} help="Use https:// URLs." />
          </div>
        </Panel>
        <Panel
          title="Link columns"
          description="Each column renders with its own heading."
          action={
            <button
              type="button"
              onClick={() => update({ columns: [...draft.columns, { id: makeId('footer-col'), title: 'New column', links: [] }] })}
              disabled={draft.columns.length >= 4}
              className="ec-btn px-2.5 py-1.5 text-[11px] font-semibold bg-brand-600 text-white disabled:opacity-40"
            >
              + Add column
            </button>
          }
        >
          <div className="space-y-4">
            {draft.columns.map((column) => (
              <div key={column.id} className="rounded-xl border border-ink-200 p-3">
                <div className="flex items-center gap-2">
                  <input className="ec-field !py-1.5 !text-xs" value={column.title} onChange={(event) => patchColumn(column.id, { title: event.target.value })} />
                  <button type="button" onClick={() => update({ columns: draft.columns.filter((item) => item.id !== column.id) })} className="h-8 w-8 rounded-lg border border-red-200 text-red-600 text-xs" aria-label="Remove column">✕</button>
                </div>
                <div className="mt-2">
                  <LinkListEditor
                    label="Links"
                    links={column.links}
                    onChange={(links) => patchColumn(column.id, { links })}
                    max={8}
                  />
                </div>
              </div>
            ))}
            {draft.columns.length === 0 && <p className="text-xs text-ink-500">No columns yet.</p>}
          </div>
        </Panel>
      </div>
    </div>
  );
}

export function SearchSeoSection() {
  const workspace = useSettingWorkspace('seo');
  const { draft, update, loading } = workspace;
  if (loading) return <Spinner label="Loading SEO settings…" />;
  const fields: Array<{ key: keyof SeoConfig; label: string; help?: string; textarea?: boolean }> = [
    { key: 'title', label: 'Site title' },
    { key: 'description', label: 'Meta description', textarea: true, help: 'Aim for 120–160 characters.' },
    { key: 'ogImageUrl', label: 'Open Graph image URL', help: 'Used by social previews.' },
    { key: 'twitterHandle', label: 'Twitter / X handle' },
    { key: 'canonicalBase', label: 'Canonical base URL' },
    { key: 'searchPlaceholder', label: 'Search placeholder' },
  ];
  return (
    <div>
      <AdminPageHeader
        eyebrow="Website settings"
        title="Search & Discoverability"
        description="Metadata applied to the public site plus the search experience inside the student app."
        meta={
          <>
            <StatusPill tone={draft.robotsIndex ? 'success' : 'warning'}>{draft.robotsIndex ? 'Indexable' : 'noindex'}</StatusPill>
            <StatusPill tone={draft.enableGlobalSearch ? 'success' : 'neutral'}>{draft.enableGlobalSearch ? 'Search on' : 'Search off'}</StatusPill>
          </>
        }
      />
      <PublishBar workspace={workspace} />
      <div className="grid gap-4 xl:grid-cols-2 mt-5 items-start">
        <Panel title="Metadata">
          <div className="space-y-3">
            {fields.map((field) => (
              <Field key={String(field.key)} label={field.label} help={field.help}>
                {field.textarea ? (
                  <textarea className="ec-field" rows={3} value={String(draft[field.key] || '')} onChange={(event) => update({ [field.key]: event.target.value } as Partial<SeoConfig>)} />
                ) : (
                  <input className="ec-field" value={String(draft[field.key] || '')} onChange={(event) => update({ [field.key]: event.target.value } as Partial<SeoConfig>)} />
                )}
              </Field>
            ))}
            <Toggle checked={draft.robotsIndex} onChange={(robotsIndex) => update({ robotsIndex })} label="Allow search engine indexing" />
          </div>
        </Panel>
        <div className="space-y-4">
          <Panel title="Search experience">
            <div className="space-y-3">
              <Toggle
                checked={draft.enableGlobalSearch}
                onChange={(enableGlobalSearch) => update({ enableGlobalSearch })}
                label="Enable global search"
                description="Shows the search entry point in the header and homepage."
              />
              <StringListEditor
                label="Popular searches"
                items={draft.popularSearches}
                onChange={(popularSearches) => update({ popularSearches })}
                max={12}
                placeholder="Rotational motion"
                help="Shown as suggestions before a student types."
              />
              <StringListEditor
                label="Keywords"
                items={draft.keywords}
                onChange={(keywords) => update({ keywords })}
                max={15}
              />
            </div>
          </Panel>
          <Banner tone="info" title="Metadata is applied by the site layout">
            Title, description, keywords, OG image and favicon are emitted by the live app from these published values.
            Search suggestions are stored here and rendered by the homepage search block.
          </Banner>
        </div>
      </div>
    </div>
  );
}

const FEATURE_COPY: Array<{ key: keyof FeatureFlags; label: string; description: string; group: string }> = [
  { key: 'lectures', label: 'Lectures', description: 'Lecture catalogue and video pages.', group: 'Learning' },
  { key: 'resources', label: 'Resources', description: 'Notes and PDF resources.', group: 'Learning' },
  { key: 'tests', label: 'Tests', description: 'Test catalogue, attempts and results.', group: 'Learning' },
  { key: 'leaderboard', label: 'Leaderboards', description: 'Global and per-test rankings.', group: 'Learning' },
  { key: 'continueLearning', label: 'Continue learning', description: 'Resume cards from watch history.', group: 'Learning' },
  { key: 'recentlyViewed', label: 'Recently viewed', description: 'Recently opened lectures and tests.', group: 'Learning' },
  { key: 'challenges', label: 'Study challenges', description: 'Sprint cards and tracking.', group: 'Learning' },
  { key: 'events', label: 'Events', description: 'Event cards, calendar and countdowns.', group: 'Growth' },
  { key: 'notifications', label: 'Notifications', description: 'In-app inbox.', group: 'Growth' },
  { key: 'chat', label: 'Student chat', description: 'Doubt threads between students and admin.', group: 'Growth' },
  { key: 'search', label: 'Global search', description: 'Search across lectures, tests and series.', group: 'Growth' },
  { key: 'bookmarks', label: 'Bookmarks', description: 'Save lectures and tests.', group: 'Growth' },
  { key: 'notes', label: 'Notes', description: 'Personal study notes.', group: 'Growth' },
  { key: 'testimonials', label: 'Testimonials', description: 'Student stories on login and home.', group: 'Growth' },
  { key: 'popups', label: 'Popups', description: 'Frequency-controlled notice popups.', group: 'Growth' },
  { key: 'googleAuth', label: 'Google sign-in', description: 'Google provider button on the login page.', group: 'Access' },
  { key: 'signup', label: 'Account creation', description: 'Sign-up tab on the login page.', group: 'Access' },
  { key: 'bottomNav', label: 'Bottom navigation', description: 'Mobile navigation bar.', group: 'Access' },
];

export function FeaturesSection() {
  const workspace = useSettingWorkspace('features');
  const { draft, update, loading } = workspace;
  if (loading) return <Spinner label="Loading feature toggles…" />;
  const groups = Array.from(new Set(FEATURE_COPY.map((item) => item.group)));
  return (
    <div>
      <AdminPageHeader
        eyebrow="Website settings"
        title="Feature Toggles"
        description="Hide student-facing capabilities without deleting any data. Navigation links for hidden features are automatically dropped."
        meta={<StatusPill tone="brand">{Object.values(draft).filter(Boolean).length} of {Object.keys(draft).length} enabled</StatusPill>}
      />
      <PublishBar workspace={workspace} />
      <div className="grid gap-4 xl:grid-cols-3 mt-5">
        {groups.map((group) => (
          <Panel key={group} title={group}>
            <div className="space-y-3">
              {FEATURE_COPY.filter((item) => item.group === group).map((item) => (
                <Toggle
                  key={item.key}
                  checked={draft[item.key]}
                  onChange={(checked) => update({ [item.key]: checked } as Partial<FeatureFlags>)}
                  label={item.label}
                  description={item.description}
                />
              ))}
            </div>
          </Panel>
        ))}
      </div>
      <div className="mt-4">
        <Banner tone="warning" title="Google sign-in has two gates">
          The login button appears only when this toggle, the login designer&apos;s “Show Google” setting and{' '}
          <code>NEXT_PUBLIC_GOOGLE_AUTH_ENABLED</code> are all enabled. Turning this off never disables email sign-in.
        </Banner>
      </div>
    </div>
  );
}

const ASSET_TYPES: Array<{ value: MediaAssetType; label: string }> = [
  { value: 'image', label: 'Image' },
  { value: 'pdf', label: 'PDF' },
  { value: 'video', label: 'Video' },
  { value: 'other', label: 'Other' },
];

export function MediaSection() {
  const workspace = useSettingWorkspace('media');
  const { draft, update, loading } = workspace;
  const { push } = useToast();
  const [query, setQuery] = useState('');
  const [type, setType] = useState<'all' | MediaAssetType>('all');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [assetModalOpen, setAssetModalOpen] = useState(false);
  const [form, setForm] = useState({ name: '', url: '', type: 'image' as MediaAssetType, tags: '' });

  // Server-side Google Drive diagnostics & private PDF upload modal
  const [driveStatus, setDriveStatus] = useState<DriveStatusResponse | null>(null);
  const [probingDrive, setProbingDrive] = useState(false);
  const [courses, setCourses] = useState<CourseCatalogItem[]>([]);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [pdfCourseId, setPdfCourseId] = useState('');
  const [pdfDisplayName, setPdfDisplayName] = useState('');
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  useEffect(() => {
    getAdminDriveStatus(false)
      .then((res) => setDriveStatus(res))
      .catch(() => {});
  }, []);

  async function runDriveProbe() {
    setProbingDrive(true);
    try {
      const status = await getAdminDriveStatus(true);
      setDriveStatus(status);
      if (status.probe?.ok) {
        push(`Google Drive folder verified (${status.probe.folderName || 'Accessible'}).`, 'success');
      } else {
        push(status.probe?.detail || status.credentialError || 'Google Drive folder check reported an issue.', 'error');
      }
    } catch (err) {
      push(err instanceof Error ? err.message : 'Unable to check Google Drive status.', 'error');
    } finally {
      setProbingDrive(false);
    }
  }

  async function openUploadModal() {
    setUploadModalOpen(true);
    if (courses.length === 0) {
      try {
        const all = await getAdminContentList();
        const eligible = all.filter((item: CourseCatalogItem) => item.kind === 'batch' || item.kind === 'series');
        setCourses(eligible);
        if (eligible[0] && !pdfCourseId) setPdfCourseId(eligible[0].id);
      } catch {
        setCourses([]);
      }
    }
  }

  async function handlePrivatePdfUpload(event: React.FormEvent) {
    event.preventDefault();
    if (!pdfCourseId) {
      push('Select a batch or series for this PDF.', 'error');
      return;
    }
    if (!pdfFile) {
      push('Choose a PDF file to upload.', 'error');
      return;
    }
    setUploadingPdf(true);
    setUploadProgress(0);
    try {
      const uploaded = await uploadAdminPdf({
        courseId: pdfCourseId,
        file: pdfFile,
        displayName: pdfDisplayName.trim() || undefined,
        onProgress: setUploadProgress,
      });
      push(`Uploaded "${uploaded.displayName}" to private Google Drive.`, 'success');
      setUploadModalOpen(false);
      setPdfFile(null);
      setPdfDisplayName('');
      setUploadProgress(0);
    } catch (err) {
      push(err instanceof Error ? err.message : 'Google Drive upload failed.', 'error');
    } finally {
      setUploadingPdf(false);
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return draft.items.filter((item) => {
      if (type !== 'all' && item.type !== type) return false;
      if (!q) return true;
      return `${item.name} ${item.url} ${item.tags.join(' ')}`.toLowerCase().includes(q);
    });
  }, [draft.items, query, type]);

  if (loading) return <Spinner label="Loading media library…" />;

  function addAsset() {
    if (!form.name.trim()) {
      push('Give the asset a name.', 'error');
      return;
    }
    if (!isSafeHttpUrl(form.url)) {
      push('Enter a valid https:// asset URL.', 'error');
      return;
    }
    const asset: MediaAsset = {
      id: makeId('asset'),
      name: form.name.trim(),
      url: form.url.trim(),
      type: form.type,
      tags: form.tags.split(',').map((tag) => tag.trim()).filter(Boolean).slice(0, 8),
      notes: '',
      addedAt: new Date().toISOString(),
    };
    update({ items: [asset, ...draft.items] });
    setForm({ name: '', url: '', type: 'image', tags: '' });
    setAssetModalOpen(false);
    push('Asset added to the library. Publish to make it available site-wide.', 'success');
  }

  return (
    <div>
      <AdminPageHeader
        eyebrow="Website & Storage"
        title="Media Library & Google Drive"
        description="Manage public CDN media references and verify private Google Drive course storage."
        meta={
          <>
            <StatusPill tone="brand">{draft.items.length} media URLs</StatusPill>
            {driveStatus && (
              <StatusPill tone={driveStatus.configured ? 'success' : 'warning'}>
                {driveStatus.configured ? 'Drive credentials configured' : 'Drive setup required'}
              </StatusPill>
            )}
          </>
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void openUploadModal()}
              className="ec-btn px-3.5 py-2 text-xs font-semibold border border-ink-200 bg-[var(--ec-surface)] text-ink-800 hover:bg-ink-50"
            >
              ↑ Upload Course PDF
            </button>
            <button
              type="button"
              onClick={() => setAssetModalOpen(true)}
              className="ec-btn px-3.5 py-2 text-xs font-semibold bg-brand-600 text-white"
            >
              + Add Media URL
            </button>
          </div>
        }
      />
      <PublishBar workspace={workspace} />

      <div className="mt-5 space-y-4">
        <Panel
          title="Google Drive Private Storage"
          description="Course PDFs and student profile photos are stored privately via your server-side Drive service account."
          action={
            <button
              type="button"
              disabled={probingDrive}
              onClick={() => void runDriveProbe()}
              className="ec-btn px-3 py-1.5 text-xs font-semibold border border-ink-200 bg-[var(--ec-surface)] text-ink-800 disabled:opacity-50"
            >
              {probingDrive ? 'Checking folder…' : 'Verify Drive Folder'}
            </button>
          }
        >
          {driveStatus ? (
            <div className="space-y-3 text-xs">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-ink-100 bg-ink-50/60 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-ink-500">Configuration</p>
                  <p className="mt-1 font-semibold text-ink-900">
                    {driveStatus.configured ? 'Ready on server' : 'Missing server credentials'}
                  </p>
                </div>
                <div className="rounded-xl border border-ink-100 bg-ink-50/60 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-ink-500">Target Folder</p>
                  <p className="mt-1 truncate font-mono text-[11px] font-semibold text-ink-900">
                    {driveStatus.folderId || 'Not set'}
                  </p>
                </div>
                <div className="rounded-xl border border-ink-100 bg-ink-50/60 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-ink-500">Service Account</p>
                  <p className="mt-1 truncate font-mono text-[11px] font-semibold text-ink-900">
                    {driveStatus.serviceAccountEmail || 'Not configured'}
                  </p>
                </div>
              </div>
              {driveStatus.probe && (
                <Banner
                  tone={driveStatus.probe.ok ? 'success' : 'danger'}
                  title={
                    driveStatus.probe.ok
                      ? `Folder verified: ${driveStatus.probe.folderName || 'Accessible'}${
                          driveStatus.probe.canAddChildren === false ? ' (Read-only — grant Editor role)' : ' (Write access confirmed)'
                        }`
                      : `Drive folder check failed (HTTP ${driveStatus.probe.httpStatus})`
                  }
                >
                  {driveStatus.probe.ok
                    ? 'Server-side uploads can write private PDFs and profile photos into this folder.'
                    : driveStatus.probe.detail ||
                      'Share the target Google Drive folder with the service account email above as Editor.'}
                </Banner>
              )}
              {(driveStatus.credentialError || driveStatus.scopeWarning) && (
                <Banner tone="warning" title="Drive configuration warning">
                  {driveStatus.credentialError || driveStatus.scopeWarning}
                </Banner>
              )}
            </div>
          ) : (
            <p className="text-xs text-ink-500">Click &ldquo;Verify Drive Folder&rdquo; to test live folder permissions.</p>
          )}
        </Panel>

        <Panel
          title="Public Media URLs"
          description="Search reusable banner, poster, and resource URLs by name or tag."
          action={
            <div className="flex flex-wrap gap-2">
              <SearchInput value={query} onChange={setQuery} placeholder="Search assets…" />
              <select className="ec-field !py-1.5 !text-xs !w-auto" value={type} onChange={(event) => setType(event.target.value as typeof type)}>
                <option value="all">All types</option>
                {ASSET_TYPES.map((assetType) => (
                  <option key={assetType.value} value={assetType.value}>{assetType.label}</option>
                ))}
              </select>
            </div>
          }
        >
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map((asset) => (
              <div key={asset.id} className="rounded-xl border border-ink-200 p-3 flex flex-col justify-between">
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-semibold truncate">{asset.name}</p>
                    <StatusPill tone="neutral">{asset.type}</StatusPill>
                  </div>
                  <p className="text-[10px] text-ink-400 truncate mt-1">{asset.url}</p>
                  {asset.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {asset.tags.map((tag) => (
                        <span key={tag} className="text-[9px] rounded-full bg-ink-100 px-1.5 py-0.5 text-ink-600">{tag}</span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex gap-1.5 mt-3">
                  <button
                    type="button"
                    onClick={() => {
                      void navigator.clipboard.writeText(asset.url);
                      push('URL copied.', 'success');
                    }}
                    className="ec-btn px-2 py-1 text-[10px] font-semibold border border-ink-200"
                  >
                    Copy URL
                  </button>
                  <a href={asset.url} target="_blank" rel="noopener noreferrer" className="ec-btn px-2 py-1 text-[10px] font-semibold border border-ink-200">Open ↗</a>
                  <button type="button" onClick={() => setDeleteId(asset.id)} className="ec-btn px-2 py-1 text-[10px] font-semibold border border-red-200 text-red-700">Remove</button>
                </div>
              </div>
            ))}
            {filtered.length === 0 && (
              <p className="sm:col-span-2 lg:col-span-3 text-xs text-ink-500 py-8 text-center">No media URLs match this view.</p>
            )}
          </div>
        </Panel>
      </div>

      <Modal
        open={assetModalOpen}
        onClose={() => setAssetModalOpen(false)}
        title="Add Media URL"
        description="Register a validated https:// image, video, or document URL for reuse in banners and cards."
        size="md"
        footer={
          <>
            <button
              type="button"
              onClick={() => setAssetModalOpen(false)}
              className="ec-btn px-3.5 py-2 text-xs font-semibold border border-ink-200 bg-[var(--ec-surface)]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={addAsset}
              className="ec-btn px-4 py-2 text-xs font-semibold bg-brand-600 text-white"
            >
              Add to Library
            </button>
          </>
        }
      >
        <div className="space-y-3.5">
          <Field label="Name" required>
            <input className="ec-field" value={form.name} placeholder="JEE Hero Banner 16:9" onChange={(event) => setForm({ ...form, name: event.target.value })} />
          </Field>
          <Field label="Asset URL" required help="Must be an https:// URL.">
            <input className={`ec-field ${form.url && !isSafeHttpUrl(form.url) ? '!border-red-300' : ''}`} value={form.url} placeholder="https://…" onChange={(event) => setForm({ ...form, url: event.target.value })} />
          </Field>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Type">
              <select className="ec-field" value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value as MediaAssetType })}>
                {ASSET_TYPES.map((assetType) => (
                  <option key={assetType.value} value={assetType.value}>{assetType.label}</option>
                ))}
              </select>
            </Field>
            <Field label="Tags" help="Comma separated.">
              <input className="ec-field" value={form.tags} placeholder="hero, jee, 2026" onChange={(event) => setForm({ ...form, tags: event.target.value })} />
            </Field>
          </div>
        </div>
      </Modal>

      <Modal
        open={uploadModalOpen}
        onClose={() => !uploadingPdf && setUploadModalOpen(false)}
        title="Upload Private Course PDF"
        description="Uploads directly to your private Google Drive folder on the server and binds access to enrolled students."
        size="md"
        footer={
          <>
            <button
              type="button"
              disabled={uploadingPdf}
              onClick={() => setUploadModalOpen(false)}
              className="ec-btn px-3.5 py-2 text-xs font-semibold border border-ink-200 bg-[var(--ec-surface)] disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="media-drive-pdf-upload-form"
              disabled={uploadingPdf || !pdfFile || !pdfCourseId}
              className="ec-btn px-4 py-2 text-xs font-semibold bg-brand-600 text-white disabled:opacity-50"
            >
              {uploadingPdf ? `Uploading (${uploadProgress}%)…` : 'Upload PDF'}
            </button>
          </>
        }
      >
        <form id="media-drive-pdf-upload-form" onSubmit={handlePrivatePdfUpload} className="space-y-3.5">
          <Field label="Batch or Series" required help="Only students enrolled in this course will be authorized to stream or download the PDF.">
            <select
              className="ec-field"
              value={pdfCourseId}
              onChange={(event) => setPdfCourseId(event.target.value)}
              required
            >
              <option value="">Select a batch or series…</option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.title} ({course.exam} · {course.kind})
                </option>
              ))}
            </select>
          </Field>
          <Field label="Display Title (optional)" help="Defaults to the PDF filename if left blank.">
            <input
              className="ec-field"
              value={pdfDisplayName}
              onChange={(event) => setPdfDisplayName(event.target.value)}
              placeholder="Rotational Motion Formula Sheet"
            />
          </Field>
          <Field label="PDF File (max 20 MB)" required>
            <input
              type="file"
              accept="application/pdf,.pdf"
              onChange={(event) => setPdfFile(event.target.files?.[0] || null)}
              className="ec-field !py-2 text-xs"
              required
            />
          </Field>
          {uploadingPdf && (
            <div className="ec-progress">
              <span style={{ width: `${uploadProgress}%` }} />
            </div>
          )}
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteId)}
        title="Remove this asset?"
        description="Only the library entry is removed — the hosted file is untouched."
        confirmLabel="Remove asset"
        onCancel={() => setDeleteId(null)}
        onConfirm={() => {
          if (deleteId) update({ items: draft.items.filter((item) => item.id !== deleteId) });
          setDeleteId(null);
        }}
      />
    </div>
  );
}

function createChallenge(): StudyChallenge {
  return {
    id: makeId('challenge'),
    title: 'New challenge',
    description: '',
    targetType: 'lectures',
    targetCount: 3,
    checklist: [],
    startAt: '',
    endAt: '',
    audience: 'all',
    active: true,
    reward: '',
    color: '#7c3aed',
    updatedAt: new Date().toISOString(),
  };
}

export function ChallengesSection() {
  const workspace = useSettingWorkspace('challenges');
  const { draft, update, loading } = workspace;
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const items = draft.items;
  const editing = items.find((item) => item.id === editingId) || null;

  function patch(id: string, value: Partial<StudyChallenge>) {
    update({ items: items.map((item) => (item.id === id ? { ...item, ...value, updatedAt: new Date().toISOString() } : item)) });
  }

  if (loading) return <Spinner label="Loading challenges…" />;

  return (
    <div>
      <AdminPageHeader
        eyebrow="Learning content"
        title="Study Challenges"
        description="Short, measurable study sprints. Progress is computed from real lecture progress, tests and checklists on the student side."
        meta={<StatusPill tone="brand">{items.filter((item) => item.active).length} active challenges</StatusPill>}
        actions={
          <button
            type="button"
            onClick={() => {
              const challenge = createChallenge();
              update({ items: [...items, challenge] });
              setEditingId(challenge.id);
            }}
            className="ec-btn px-3.5 py-2 text-xs font-semibold bg-brand-600 text-white"
          >
            + New challenge
          </button>
        }
      />
      <PublishBar workspace={workspace} />
      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3 mt-5">
        {items.map((item) => (
          <div key={item.id} className="ec-card p-4" style={{ borderTop: `4px solid ${item.color || 'var(--ec-brand)'}` }}>
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-bold">{item.title}</p>
              <StatusPill tone={item.active ? 'success' : 'neutral'}>{item.active ? 'Active' : 'Off'}</StatusPill>
            </div>
            <p className="text-[11px] text-ink-500 mt-1 line-clamp-2">{item.description || 'No description'}</p>
            <p className="text-[10px] text-ink-400 mt-2">
              {item.targetCount} × {item.targetType}
              {item.startAt || item.endAt
                ? ` · ${item.startAt ? formatISTDateTime(item.startAt) : 'open'} → ${item.endAt ? formatISTDateTime(item.endAt) : 'open'}`
                : ' · no window'}
            </p>
            <div className="flex gap-1.5 mt-3">
              <button type="button" onClick={() => setEditingId(item.id)} className="ec-btn px-2.5 py-1.5 text-[11px] font-semibold bg-ink-900 text-white">Edit</button>
              <button type="button" onClick={() => patch(item.id, { active: !item.active })} className="ec-btn px-2.5 py-1.5 text-[11px] font-semibold border border-ink-200">{item.active ? 'Pause' : 'Activate'}</button>
              <button type="button" onClick={() => setDeleteId(item.id)} className="ec-btn px-2.5 py-1.5 text-[11px] font-semibold border border-red-200 text-red-700">Delete</button>
            </div>
          </div>
        ))}
        {items.length === 0 && (
          <div className="sm:col-span-2 xl:col-span-3 text-center py-10 border border-dashed border-ink-200 rounded-xl">
            <p className="text-sm font-semibold">No challenges yet</p>
            <p className="text-xs text-ink-500 mt-1">Challenges give students a concrete daily target.</p>
          </div>
        )}
      </div>

      <Modal
        open={Boolean(editing)}
        onClose={() => setEditingId(null)}
        title="Challenge"
        size="lg"
        footer={
          <>
            <button type="button" onClick={() => setEditingId(null)} className="ec-btn px-3 py-2 text-xs font-semibold border border-ink-200">Close</button>
            <button type="button" onClick={() => setEditingId(null)} className="ec-btn px-3 py-2 text-xs font-semibold bg-brand-600 text-white">Done</button>
          </>
        }
      >
        {editing && (
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Title" required>
              <input className="ec-field" value={editing.title} onChange={(event) => patch(editing.id, { title: event.target.value })} />
            </Field>
            <Field label="Reward">
              <input className="ec-field" value={editing.reward} onChange={(event) => patch(editing.id, { reward: event.target.value })} />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Description">
                <textarea className="ec-field" rows={3} value={editing.description} onChange={(event) => patch(editing.id, { description: event.target.value })} />
              </Field>
            </div>
            <Field label="Target type">
              <select className="ec-field" value={editing.targetType} onChange={(event) => patch(editing.id, { targetType: event.target.value as StudyChallenge['targetType'] })}>
                <option value="lectures">Lectures watched</option>
                <option value="tests">Tests attempted</option>
                <option value="minutes">Study minutes</option>
                <option value="checklist">Checklist items</option>
              </select>
            </Field>
            <Field label="Target count">
              <input type="number" min={1} className="ec-field" value={editing.targetCount} onChange={(event) => patch(editing.id, { targetCount: Math.max(1, Number(event.target.value)) })} />
            </Field>
            <Field label="Start (IST)">
              <input type="datetime-local" className="ec-field" value={toISTDateTimeLocalInput(editing.startAt)} onChange={(event) => patch(editing.id, { startAt: fromISTDateTimeLocalInput(event.target.value) || '' })} />
            </Field>
            <Field label="End (IST)">
              <input type="datetime-local" className="ec-field" value={toISTDateTimeLocalInput(editing.endAt)} onChange={(event) => patch(editing.id, { endAt: fromISTDateTimeLocalInput(event.target.value) || '' })} />
            </Field>
            <Field label="Audience">
              <select className="ec-field" value={editing.audience} onChange={(event) => patch(editing.id, { audience: event.target.value as StudyChallenge['audience'] })}>
                {AUDIENCE_TARGETS.map((target) => (
                  <option key={target.value} value={target.value}>{target.label}</option>
                ))}
              </select>
            </Field>
            <Field label="Accent colour">
              <input type="color" className="h-9 w-full rounded-lg border border-ink-200 p-1" value={editing.color} onChange={(event) => patch(editing.id, { color: event.target.value })} />
            </Field>
            <div className="sm:col-span-2">
              <Toggle checked={editing.active} onChange={(active) => patch(editing.id, { active })} label="Active" description="Inactive challenges are hidden from students." />
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteId)}
        title="Delete this challenge?"
        confirmLabel="Delete challenge"
        onCancel={() => setDeleteId(null)}
        onConfirm={() => {
          if (deleteId) update({ items: items.filter((item) => item.id !== deleteId) });
          setDeleteId(null);
        }}
      />
    </div>
  );
}

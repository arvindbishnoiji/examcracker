'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Banner, BannerPlacement } from '@/types';
import { useSettingWorkspace } from '@/hooks/useSettingWorkspace';
import { getBannerState, makeId, type BannerDerivedState } from '@/lib/site-config';
import { formatISTDateTime, fromISTDateTimeLocalInput, toISTDateTimeLocalInput } from '@/lib/date';
import { BannerArtwork } from '@/components/banners/BannerArtwork';
import {
  AdminPageHeader,
  Banner as Callout,
  ColorField,
  ConfirmDialog,
  Field,
  Modal,
  Panel,
  Segmented,
  Spinner,
  StatusPill,
  Toggle,
} from '../ui';
import { MultiPills } from '../ListEditors';
import { SettingsPublishBar } from '../SettingsPublishBar';

const PLACEMENTS: Array<{ value: BannerPlacement; label: string }> = [
  { value: 'home_hero', label: 'Homepage hero' },
  { value: 'dashboard', label: 'Dashboard card' },
  { value: 'login', label: 'Login page' },
  { value: 'lectures', label: 'Lectures' },
  { value: 'tests', label: 'Tests' },
];

const STATE_TONE: Record<BannerDerivedState, 'success' | 'warning' | 'neutral' | 'danger' | 'info'> = {
  active: 'success',
  scheduled: 'info',
  expired: 'warning',
  draft: 'neutral',
  paused: 'warning',
  archived: 'danger',
};

function createBanner(): Banner {
  const now = new Date().toISOString();
  return {
    id: makeId('banner'),
    title: 'Untitled banner',
    subtitle: '',
    description: '',
    badge: '',
    desktopImageUrl: '',
    mobileImageUrl: '',
    backgroundColor: '#1d4ed8',
    overlay: 45,
    textAlign: 'left',
    ctaLabel: 'Explore',
    ctaHref: '/lectures',
    placements: ['home_hero'],
    audience: 'all',
    startAt: '',
    endAt: '',
    timezone: 'Asia/Kolkata',
    priority: 0,
    status: 'draft',
    createdAt: now,
    updatedAt: now,
  };
}

export function BannersSection({ autoCreate = false }: { autoCreate?: boolean }) {
  const workspace = useSettingWorkspace('banners');
  const { draft, update, loading } = workspace;
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | BannerDerivedState>('all');
  const [placementFilter, setPlacementFilter] = useState<'all' | BannerPlacement>('all');
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [createdAuto, setCreatedAuto] = useState(false);

  const items = draft.items;
  const editing = items.find((item) => item.id === editingId) || null;

  useEffect(() => {
    if (!autoCreate || createdAuto || loading) return;
    setCreatedAuto(true);
    const banner = createBanner();
    update({ items: [...items, banner] });
    setEditingId(banner.id);
  }, [autoCreate, createdAuto, loading, items, update]);

  function patchBanner(id: string, patch: Partial<Banner>) {
    update({
      items: items.map((item) =>
        item.id === id ? { ...item, ...patch, updatedAt: new Date().toISOString() } : item
      ),
    });
  }

  function addBanner() {
    const banner = createBanner();
    update({ items: [...items, banner] });
    setEditingId(banner.id);
  }

  function duplicateBanner(banner: Banner) {
    const copy: Banner = {
      ...banner,
      id: makeId('banner'),
      title: `${banner.title} (copy)`,
      status: 'draft',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    update({ items: [...items, copy] });
    setEditingId(copy.id);
  }

  function movePriority(banner: Banner, direction: -1 | 1) {
    patchBanner(banner.id, { priority: banner.priority + direction });
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...items]
      .sort((a, b) => b.priority - a.priority || b.updatedAt.localeCompare(a.updatedAt))
      .filter((banner) => {
        if (q && !`${banner.title} ${banner.subtitle} ${banner.badge}`.toLowerCase().includes(q)) return false;
        if (placementFilter !== 'all' && !banner.placements.includes(placementFilter)) return false;
        if (statusFilter !== 'all' && getBannerState(banner) !== statusFilter) return false;
        return true;
      });
  }, [items, query, placementFilter, statusFilter]);

  if (loading) return <Spinner label="Loading banners…" />;

  const activeCount = items.filter((banner) => getBannerState(banner) === 'active').length;

  return (
    <div>
      <AdminPageHeader
        eyebrow="Design studio"
        title="Banners & Hero Slides"
        description="Schedule targeted hero slides for the homepage, dashboard and login page. Images are optional; every banner has a branded fallback."
        meta={
          <>
            <StatusPill tone="brand">{items.length} banners</StatusPill>
            <StatusPill tone="success">{activeCount} live now</StatusPill>
            <StatusPill tone="neutral">Carousel {draft.autoplay ? 'autoplay' : 'manual'}</StatusPill>
          </>
        }
        actions={
          <button type="button" onClick={addBanner} className="ec-btn px-3.5 py-2 text-xs font-semibold bg-brand-600 text-white">
            + New banner
          </button>
        }
      />

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

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px] mt-5 items-start">
        <div className="space-y-4">
          <Panel
            title="Banner library"
            description="Sorted by priority. Draft changes remain private until the global publish action."
            action={
              <div className="flex flex-wrap gap-2">
                <input
                  className="ec-field !py-1.5 !text-xs !w-40"
                  placeholder="Search banners…"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
                <select className="ec-field !py-1.5 !text-xs !w-auto" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}>
                  <option value="all">All states</option>
                  <option value="active">Active</option>
                  <option value="scheduled">Scheduled</option>
                  <option value="expired">Expired</option>
                  <option value="draft">Draft</option>
                  <option value="paused">Paused</option>
                  <option value="archived">Archived</option>
                </select>
                <select className="ec-field !py-1.5 !text-xs !w-auto" value={placementFilter} onChange={(event) => setPlacementFilter(event.target.value as typeof placementFilter)}>
                  <option value="all">All placements</option>
                  {PLACEMENTS.map((placement) => (
                    <option key={placement.value} value={placement.value}>{placement.label}</option>
                  ))}
                </select>
              </div>
            }
          >
            <div className="space-y-3">
              {filtered.map((banner) => {
                const state = getBannerState(banner);
                return (
                  <div key={banner.id} className="rounded-xl border border-ink-200 overflow-hidden bg-[var(--ec-surface)]">
                    <div className="grid sm:grid-cols-[210px_1fr]">
                      <div className="relative min-h-[110px] bg-ink-100">
                        <BannerArtwork banner={banner} compact className="!rounded-none h-full min-h-[110px]" />
                      </div>
                      <div className="p-3.5">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-bold truncate">{banner.title}</p>
                            <p className="text-[11px] text-ink-500 line-clamp-1">{banner.subtitle || banner.description || 'No supporting copy'}</p>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <StatusPill tone={STATE_TONE[state]}>{state}</StatusPill>
                            <StatusPill tone="neutral">P{banner.priority}</StatusPill>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 mt-2">
                          {banner.placements.map((placement) => (
                            <span key={placement} className="text-[10px] rounded-full bg-ink-100 text-ink-600 px-2 py-0.5">
                              {PLACEMENTS.find((item) => item.value === placement)?.label || placement}
                            </span>
                          ))}
                          {banner.audience !== 'all' && <StatusPill tone="info">{banner.audience}</StatusPill>}
                        </div>
                        <p className="text-[10px] text-ink-400 mt-2">
                          {banner.startAt || banner.endAt
                            ? `${banner.startAt ? formatISTDateTime(banner.startAt) : 'No start'} → ${banner.endAt ? formatISTDateTime(banner.endAt) : 'No end'}`
                            : 'Always scheduled (no start or end)'}
                        </p>
                        <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
                          <button type="button" onClick={() => setEditingId(banner.id)} className="ec-btn px-2.5 py-1.5 text-[11px] font-semibold bg-ink-900 text-white">Edit</button>
                          <button type="button" onClick={() => duplicateBanner(banner)} className="ec-btn px-2.5 py-1.5 text-[11px] font-semibold border border-ink-200">Duplicate</button>
                          <button type="button" onClick={() => movePriority(banner, 1)} className="h-7 w-7 rounded-lg border border-ink-200 text-xs" aria-label="Increase priority">↑</button>
                          <button type="button" onClick={() => movePriority(banner, -1)} className="h-7 w-7 rounded-lg border border-ink-200 text-xs" aria-label="Decrease priority">↓</button>
                          {banner.status === 'paused' ? (
                            <button type="button" onClick={() => patchBanner(banner.id, { status: 'published' })} className="ec-btn px-2.5 py-1.5 text-[11px] font-semibold border border-emerald-200 text-emerald-700">Resume</button>
                          ) : (
                            <button type="button" onClick={() => patchBanner(banner.id, { status: 'paused' })} className="ec-btn px-2.5 py-1.5 text-[11px] font-semibold border border-amber-200 text-amber-800">Pause</button>
                          )}
                          {banner.status !== 'archived' && (
                            <button type="button" onClick={() => patchBanner(banner.id, { status: 'archived' })} className="ec-btn px-2.5 py-1.5 text-[11px] font-semibold border border-ink-200 text-ink-500">Archive</button>
                          )}
                          <button type="button" onClick={() => setDeleteId(banner.id)} className="ec-btn px-2.5 py-1.5 text-[11px] font-semibold border border-red-200 text-red-700">Delete</button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              {filtered.length === 0 && (
                <div className="text-center py-10 border border-dashed border-ink-200 rounded-xl">
                  <p className="text-sm font-semibold">No banners match this view</p>
                  <p className="text-xs text-ink-500 mt-1">Create a banner or clear the filters.</p>
                  <button type="button" onClick={addBanner} className="mt-3 ec-btn px-3 py-2 text-xs font-semibold bg-brand-600 text-white">+ New banner</button>
                </div>
              )}
            </div>
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel title="Carousel behaviour" description="Applies to every hero carousel on the student site.">
            <div className="space-y-3">
              <Toggle
                checked={draft.autoplay}
                onChange={(autoplay) => update({ autoplay })}
                label="Automatic rotation"
                description="Students can always navigate manually."
              />
              <Field label={`Rotation · ${draft.rotationSeconds}s`}>
                <input
                  type="range"
                  min={3}
                  max={20}
                  value={draft.rotationSeconds}
                  onChange={(event) => update({ rotationSeconds: Number(event.target.value) })}
                  className="w-full accent-[var(--ec-brand)]"
                />
              </Field>
              <Toggle checked={draft.showDots} onChange={(showDots) => update({ showDots })} label="Show slide dots" />
              <Toggle checked={draft.showArrows} onChange={(showArrows) => update({ showArrows })} label="Show previous/next arrows" />
            </div>
          </Panel>

          <Panel title="Placement guide">
            <ul className="text-[11px] text-ink-500 space-y-2">
              <li><strong className="text-ink-700">Homepage hero</strong> — the first section on /home when the Hero section is enabled.</li>
              <li><strong className="text-ink-700">Dashboard card</strong> — reserved for dashboard-specific banners in the homepage builder.</li>
              <li><strong className="text-ink-700">Login</strong> — available to the login designer as promotional artwork.</li>
              <li><strong className="text-ink-700">Lectures / Tests</strong> — optional strip above the respective catalogues.</li>
            </ul>
          </Panel>

          <Callout tone="neutral" title="No invented engagement numbers">
            Impressions and clicks are not displayed because no server-side engagement store is deployed yet. The manager
            shows only schedule, priority and publishing state, which are real.
          </Callout>
        </div>
      </div>

      <Modal
        open={Boolean(editing)}
        onClose={() => setEditingId(null)}
        title={editing ? `Edit banner · ${editing.title}` : 'Banner'}
        description="Preview uses the real artwork component. Save the draft, then publish when every banner is ready."
        size="xl"
        footer={
          <>
            <button type="button" onClick={() => setEditingId(null)} className="ec-btn px-3 py-2 text-xs font-semibold border border-ink-200">
              Close
            </button>
            {editing && (
              <button
                type="button"
                onClick={() => {
                  patchBanner(editing.id, { status: 'published' });
                  setEditingId(null);
                }}
                className="ec-btn px-3 py-2 text-xs font-semibold bg-brand-600 text-white"
              >
                Mark published &amp; close
              </button>
            )}
          </>
        }
      >
        {editing && (
          <div className="grid lg:grid-cols-[1fr_390px] gap-5">
            <div className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Title" required>
                  <input className="ec-field" value={editing.title} onChange={(event) => patchBanner(editing.id, { title: event.target.value })} />
                </Field>
                <Field label="Badge">
                  <input className="ec-field" value={editing.badge} placeholder="New batch" onChange={(event) => patchBanner(editing.id, { badge: event.target.value })} />
                </Field>
                <Field label="Subtitle">
                  <input className="ec-field" value={editing.subtitle} onChange={(event) => patchBanner(editing.id, { subtitle: event.target.value })} />
                </Field>
                <Field label="Description">
                  <textarea className="ec-field" rows={2} value={editing.description} onChange={(event) => patchBanner(editing.id, { description: event.target.value })} />
                </Field>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Desktop image URL" help="Recommended 1600×600.">
                  <input className="ec-field" value={editing.desktopImageUrl} placeholder="https://…" onChange={(event) => patchBanner(editing.id, { desktopImageUrl: event.target.value })} />
                </Field>
                <Field label="Mobile image URL" help="Recommended 900×900. Falls back to desktop.">
                  <input className="ec-field" value={editing.mobileImageUrl} placeholder="https://…" onChange={(event) => patchBanner(editing.id, { mobileImageUrl: event.target.value })} />
                </Field>
                <ColorField label="Fallback background" value={editing.backgroundColor} onChange={(backgroundColor) => patchBanner(editing.id, { backgroundColor })} />
                <Field label={`Dark overlay · ${editing.overlay}%`}>
                  <input type="range" min={0} max={90} value={editing.overlay} onChange={(event) => patchBanner(editing.id, { overlay: Number(event.target.value) })} className="w-full accent-[var(--ec-brand)]" />
                </Field>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="CTA label">
                  <input className="ec-field" value={editing.ctaLabel} onChange={(event) => patchBanner(editing.id, { ctaLabel: event.target.value })} />
                </Field>
                <Field label="CTA destination" help="Internal route or https:// link.">
                  <input className="ec-field" value={editing.ctaHref} placeholder="/lectures" onChange={(event) => patchBanner(editing.id, { ctaHref: event.target.value })} />
                </Field>
                <Field label="Text alignment">
                  <Segmented
                    value={editing.textAlign}
                    onChange={(textAlign) => patchBanner(editing.id, { textAlign })}
                    options={[
                      { value: 'left', label: 'Left' },
                      { value: 'center', label: 'Center' },
                      { value: 'right', label: 'Right' },
                    ]}
                  />
                </Field>
                <Field label="Priority" help="Higher priority appears first.">
                  <input type="number" className="ec-field" value={editing.priority} onChange={(event) => patchBanner(editing.id, { priority: Number(event.target.value) })} />
                </Field>
              </div>

              <MultiPills
                label="Placements"
                help="A banner can appear in more than one placement."
                value={editing.placements}
                onChange={(placements) => patchBanner(editing.id, { placements })}
                options={PLACEMENTS}
              />

              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Audience">
                  <select className="ec-field" value={editing.audience} onChange={(event) => patchBanner(editing.id, { audience: event.target.value as Banner['audience'] })}>
                    <option value="all">All students</option>
                    <option value="JEE">JEE</option>
                    <option value="NEET">NEET</option>
                    <option value="JEE-11">JEE · Class 11</option>
                    <option value="JEE-12">JEE · Class 12</option>
                    <option value="NEET-11">NEET · Class 11</option>
                    <option value="NEET-12">NEET · Class 12</option>
                  </select>
                </Field>
                <Field label="Status">
                  <select className="ec-field" value={editing.status} onChange={(event) => patchBanner(editing.id, { status: event.target.value as Banner['status'] })}>
                    <option value="draft">Draft</option>
                    <option value="published">Published</option>
                    <option value="paused">Paused</option>
                    <option value="archived">Archived</option>
                  </select>
                </Field>
                <Field label="Starts at (IST)">
                  <input
                    type="datetime-local"
                    className="ec-field"
                    value={toISTDateTimeLocalInput(editing.startAt)}
                    onChange={(event) => patchBanner(editing.id, { startAt: fromISTDateTimeLocalInput(event.target.value) || '' })}
                  />
                </Field>
                <Field label="Ends at (IST)">
                  <input
                    type="datetime-local"
                    className="ec-field"
                    value={toISTDateTimeLocalInput(editing.endAt)}
                    onChange={(event) => patchBanner(editing.id, { endAt: fromISTDateTimeLocalInput(event.target.value) || '' })}
                  />
                </Field>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold">Artwork preview</p>
                <Segmented
                  size="sm"
                  value={previewDevice}
                  onChange={setPreviewDevice}
                  options={[
                    { value: 'desktop', label: 'Desktop' },
                    { value: 'mobile', label: 'Mobile' },
                  ]}
                />
              </div>
              <div className={`${previewDevice === 'mobile' ? 'max-w-[320px] mx-auto' : ''}`}>
                <BannerArtwork banner={editing} />
              </div>
              <div className="ec-card p-3 text-[11px] text-ink-500 space-y-1.5">
                <p><strong className="text-ink-700">Derived state:</strong> {getBannerState(editing)}</p>
                <p><strong className="text-ink-700">Visible to:</strong> {editing.audience === 'all' ? 'all students' : editing.audience}</p>
                <p><strong className="text-ink-700">Placements:</strong> {editing.placements.join(', ') || 'none'}</p>
                <p className="pt-1">Published banners still respect their schedule and audience when selected for a placement.</p>
              </div>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteId)}
        title="Delete this banner?"
        description="The banner is removed from the draft. Publish afterwards to update the live site."
        confirmLabel="Delete banner"
        onCancel={() => setDeleteId(null)}
        onConfirm={() => {
          if (deleteId) update({ items: items.filter((item) => item.id !== deleteId) });
          if (editingId === deleteId) setEditingId(null);
          setDeleteId(null);
        }}
      />
    </div>
  );
}

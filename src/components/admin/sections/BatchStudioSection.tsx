'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  CalendarDays,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  Layers,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Sparkles,
  Trash2,
  Wand2,
} from 'lucide-react';
import { AdminPageHeader, Banner, ConfirmDialog, Field, Panel, StatusPill, Toggle } from '../ui';
import { PreviewFrame, type PreviewDevice } from '../PreviewFrame';
import { SettingsPublishBar } from '../SettingsPublishBar';
import { useSettingWorkspace } from '@/hooks/useSettingWorkspace';
import { useToast } from '@/hooks/useToast';
import {
  createAdminContent,
  disableAdminContent,
  getAdminContentList,
  permanentlyDeleteAdminContent,
  updateAdminContent,
} from '@/lib/api';
import type {
  BatchAccent,
  BatchPage,
  BatchRewardType,
  CourseCatalogItem,
  MotionPreset,
} from '@/types';
import {
  AUDIENCE_LABELS,
  BATCH_ACCENTS,
  BATCH_LAYOUTS,
  BATCH_PAGES,
  BATCH_PAGE_LABELS,
  MOTION_PRESETS,
  REWARD_TYPES,
  accentPalette,
  readBatchLook,
  studioId,
} from '@/lib/studio-config';
import { fromISTDateTimeLocalInput, toISTDateTimeLocalInput } from '@/lib/date';
import { isSafeHttpUrl } from '@/lib/validation';
import { BatchStudioCard, type PreparedBatch } from '@/components/batches/BatchShowcase';

type Tab = 'programmes' | 'section';

interface BatchDraft {
  id: string | null;
  title: string;
  subtitle: string;
  description: string;
  exam: 'JEE' | 'NEET' | 'Both';
  classes: string[];
  accessCode: string;
  active: boolean;
  imageUrl: string;
  heroImageUrl: string;
  badge: string;
  instructor: string;
  features: string;
  startsAt: string;
  endsAt: string;
  accent: BatchAccent;
  motion: MotionPreset;
  pages: BatchPage[];
  seats: string;
  priority: string;
  rewardEnabled: boolean;
  rewardType: BatchRewardType;
  rewardLabel: string;
  rewardValue: string;
  rewardIcon: string;
  ctaLabel: string;
  ctaHref: string;
  extra: Record<string, unknown>;
}

const CLASS_OPTIONS = ['11', '12', 'Dropper'];
const CLASS_LABELS: Record<string, string> = { '11': 'Class 11', '12': 'Class 12', Dropper: 'Dropper' };

function emptyDraft(accent: BatchAccent = 'auto'): BatchDraft {
  return {
    id: null,
    title: '',
    subtitle: '',
    description: '',
    exam: 'JEE',
    classes: ['11', '12', 'Dropper'],
    accessCode: '',
    active: true,
    imageUrl: '',
    heroImageUrl: '',
    badge: '',
    instructor: '',
    features: '',
    startsAt: '',
    endsAt: '',
    accent,
    motion: 'fade-up',
    pages: ['home', 'lectures'],
    seats: '',
    priority: '0',
    rewardEnabled: true,
    rewardType: 'badge',
    rewardLabel: 'Golden streak badge',
    rewardValue: '+250 XP',
    rewardIcon: '🏅',
    ctaLabel: 'Open batch',
    ctaHref: '',
    extra: {},
  };
}

function draftFromItem(item: CourseCatalogItem): BatchDraft {
  const meta = (item.metadata || {}) as Record<string, unknown>;
  const studio = (meta.studio || {}) as Record<string, unknown>;
  const pick = (key: string): unknown => studio[key] ?? meta[key];
  const reward = (pick('reward') || {}) as Record<string, unknown>;
  const features = Array.isArray(pick('features'))
    ? (pick('features') as Array<Record<string, unknown>>).map((f) => String(f.label || '')).filter(Boolean)
    : String(pick('features') || '')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);
  const extra = { ...meta };
  delete extra.thumbnailUrl;
  delete extra.thumbnail_url;
  return {
    id: item.id,
    title: item.title,
    subtitle: String(pick('subtitle') || ''),
    description: item.description,
    exam: (item.exam === 'Both' ? 'Both' : item.exam) as BatchDraft['exam'],
    classes: item.classes?.length ? item.classes : ['11', '12'],
    accessCode: String(item.access_code || ''),
    active: item.active !== false,
    imageUrl: String(pick('imageUrl') || meta.thumbnailUrl || ''),
    heroImageUrl: String(pick('heroImageUrl') || ''),
    badge: String(pick('badge') || ''),
    instructor: String(pick('instructor') || ''),
    features: features.join(', '),
    startsAt: toISTDateTimeLocalInput(String(pick('startsAt') || '')),
    endsAt: toISTDateTimeLocalInput(String(pick('endsAt') || '')),
    accent: (pick('accent') as BatchAccent) || 'auto',
    motion: (pick('motion') as MotionPreset) || 'fade-up',
    pages: Array.isArray(pick('pages')) ? (pick('pages') as BatchPage[]) : ['home', 'lectures'],
    seats: pick('seats') ? String(pick('seats')) : '',
    priority: pick('priority') ? String(pick('priority')) : '0',
    rewardEnabled: Boolean(reward.enabled),
    rewardType: (reward.type as BatchRewardType) || 'badge',
    rewardLabel: String(reward.label || ''),
    rewardValue: String(reward.value || ''),
    rewardIcon: String(reward.icon || '🏅'),
    ctaLabel: String(pick('ctaLabel') || ''),
    ctaHref: String(pick('ctaHref') || ''),
    extra,
  };
}

function lookFromDraft(draft: BatchDraft) {
  const features = draft.features
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
    .map((label) => ({ id: `f-${label.slice(0, 6)}`, label, icon: '✓' }));
  return readBatchLook(
    {
      ...draft.extra,
      thumbnailUrl: draft.imageUrl,
      studio: {
        accent: draft.accent,
        motion: draft.motion,
        badge: draft.badge,
        imageUrl: draft.imageUrl,
        heroImageUrl: draft.heroImageUrl,
        instructor: draft.instructor,
        features,
        pages: draft.pages,
        seats: Number(draft.seats) || 0,
        priority: Number(draft.priority) || 0,
        subtitle: draft.subtitle,
        ctaLabel: draft.ctaLabel,
        ctaHref: draft.ctaHref,
        startsAt: fromISTDateTimeLocalInput(draft.startsAt) || '',
        endsAt: fromISTDateTimeLocalInput(draft.endsAt) || '',
        reward: {
          enabled: draft.rewardEnabled,
          type: draft.rewardType,
          label: draft.rewardLabel,
          value: draft.rewardValue,
          icon: draft.rewardIcon,
        },
      },
    },
    0
  );
}

export function BatchStudioSection() {
  const { push } = useToast();
  const [tab, setTab] = useState<Tab>('programmes');
  const [items, setItems] = useState<CourseCatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [draft, setDraft] = useState<BatchDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<CourseCatalogItem | null>(null);
  const [device, setDevice] = useState<PreviewDevice>('desktop');
  const [query, setQuery] = useState('');

  const workspace = useSettingWorkspace('batchStudio');

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const rows = await getAdminContentList({ kind: 'batch' });
      setItems(rows);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Could not load batches from D1.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q ? items.filter((item) => `${item.title} ${item.exam}`.toLowerCase().includes(q)) : items;
    return [...list].sort((a, b) => Number(b.active) - Number(a.active) || b.updated_at.localeCompare(a.updated_at));
  }, [items, query]);

  const liveCount = items.filter((item) => item.active).length;

  function startNew() {
    setDraft(emptyDraft('auto'));
    setTab('programmes');
  }

  function startEdit(item: CourseCatalogItem) {
    setDraft(draftFromItem(item));
    setTab('programmes');
  }

  function duplicateDraft(source: CourseCatalogItem) {
    const base = draftFromItem(source);
    setDraft({
      ...base,
      id: null,
      title: `${base.title} (copy)`,
      accessCode: '',
      active: false,
    });
  }

  async function saveDraft() {
    if (!draft) return;
    if (!draft.title.trim()) {
      push('Batch name is required.', 'error');
      return;
    }
    if (draft.imageUrl && !isSafeHttpUrl(draft.imageUrl)) {
      push('Cover image must be an https:// image link.', 'error');
      return;
    }
    if (draft.heroImageUrl && !isSafeHttpUrl(draft.heroImageUrl)) {
      push('Hero image must be an https:// image link.', 'error');
      return;
    }
    const startIso = draft.startsAt ? fromISTDateTimeLocalInput(draft.startsAt) : null;
    const endIso = draft.endsAt ? fromISTDateTimeLocalInput(draft.endsAt) : null;
    if (draft.startsAt && !startIso) {
      push('Start date is not valid.', 'error');
      return;
    }
    if (draft.endsAt && !endIso) {
      push('End date is not valid.', 'error');
      return;
    }
    if (startIso && endIso && Date.parse(startIso) >= Date.parse(endIso)) {
      push('The end date must be after the start date.', 'error');
      return;
    }

    const look = lookFromDraft(draft);
    const metadata: Record<string, unknown> = {
      ...draft.extra,
      thumbnailUrl: draft.imageUrl || '',
      studio: {
        accent: draft.accent,
        motion: draft.motion,
        badge: draft.badge,
        imageUrl: draft.imageUrl,
        heroImageUrl: draft.heroImageUrl,
        instructor: draft.instructor,
        subtitle: draft.subtitle,
        features: look.features,
        reward: look.reward,
        pages: draft.pages,
        startsAt: startIso || '',
        endsAt: endIso || '',
        seats: Number(draft.seats) || 0,
        priority: Number(draft.priority) || 0,
        ctaLabel: draft.ctaLabel,
        ctaHref: draft.ctaHref,
        updatedAt: new Date().toISOString(),
      },
    };

    const payload = {
      kind: 'batch' as const,
      title: draft.title.trim(),
      description: draft.description.slice(0, 10000),
      exam: draft.exam,
      classes: draft.classes as CourseCatalogItem['classes'],
      active: draft.active,
      accessCode: draft.accessCode.trim() || null,
      metadata,
    };

    setSaving(true);
    try {
      if (draft.id) {
        const updated = await updateAdminContent(draft.id, payload);
        push(`“${updated.title}” updated.`, 'success');
      } else {
        const created = await createAdminContent(payload);
        push(`“${created.title}” created.`, 'success');
        setDraft((current) => (current ? { ...current, id: created.id } : current));
      }
      await load();
    } catch (error) {
      push(error instanceof Error ? error.message : 'Save failed.', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(item: CourseCatalogItem) {
    setBusyId(item.id);
    try {
      if (item.active) {
        await disableAdminContent(item.id);
        push(`“${item.title}” unpublished.`, 'success');
      } else {
        await updateAdminContent(item.id, {
          kind: 'batch',
          title: item.title,
          description: item.description,
          exam: item.exam,
          classes: item.classes,
          active: true,
          accessCode: item.access_code ?? null,
          metadata: (item.metadata || {}) as Record<string, unknown>,
        });
        push(`“${item.title}” published.`, 'success');
      }
      await load();
    } catch (error) {
      push(error instanceof Error ? error.message : 'Could not update this batch.', 'error');
    } finally {
      setBusyId(null);
    }
  }

  async function removeItem(mode: 'disable' | 'permanent') {
    if (!confirmDelete) return;
    setBusyId(confirmDelete.id);
    try {
      if (mode === 'permanent') await permanentlyDeleteAdminContent(confirmDelete.id);
      else await disableAdminContent(confirmDelete.id);
      push(mode === 'permanent' ? 'Batch deleted permanently.' : 'Batch unpublished (data kept).', 'success');
      if (draft?.id === confirmDelete.id) setDraft(null);
      setConfirmDelete(null);
      await load();
    } catch (error) {
      push(error instanceof Error ? error.message : 'Delete failed.', 'error');
    } finally {
      setBusyId(null);
    }
  }

  const preview = useMemo(() => {
    if (!draft) return null;
    const item: CourseCatalogItem = {
      id: draft.id || 'preview',
      kind: 'batch',
      title: draft.title || 'Your batch name',
      description: draft.description,
      exam: draft.exam,
      classes: draft.classes as CourseCatalogItem['classes'],
      active: draft.active,
      metadata: {},
      created_at: '',
      updated_at: '',
    };
    const look = lookFromDraft(draft);
    const accentKey =
      draft.accent === 'auto' ? workspace.draft.accentCycle[0] || 'violet' : draft.accent;
    return {
      item,
      look,
      accent: accentPalette(accentKey, 0),
      index: 0,
    } satisfies PreparedBatch;
  }, [draft, workspace.draft.accentCycle]);

  return (
    <div className="pb-24">
      <AdminPageHeader
        eyebrow="Experience Studio"
        title="Batch Studio"
        description="Design a batch once: cover image, name, schedule, who receives it, which IDs and pages see it, its colour, motion and reward. Everything publishes straight to the student app."
        meta={
          <>
            <StatusPill tone="brand">{items.length} batches</StatusPill>
            <StatusPill tone="success">{liveCount} live</StatusPill>
            <StatusPill tone="info">D1 backed</StatusPill>
          </>
        }
        actions={
          <>
            <button
              type="button"
              onClick={() => void load()}
              className="ec-btn ec-btn-secondary inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
            </button>
            <button
              type="button"
              onClick={startNew}
              className="ec-btn ec-btn-primary ec-btn-glow inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold"
            >
              <Plus size={14} /> New batch
            </button>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button type="button" className="ec-studio-tab" data-active={tab === 'programmes'} onClick={() => setTab('programmes')}>
          <Layers size={13} /> Programmes
        </button>
        <button type="button" className="ec-studio-tab" data-active={tab === 'section'} onClick={() => setTab('section')}>
          <Wand2 size={13} /> Section design
        </button>
      </div>

      {loadError && <Banner tone="danger" title="Could not load batches">{loadError}</Banner>}

      {tab === 'section' ? (
        <SectionDesign workspace={workspace} items={items} device={device} onDevice={setDevice} />
      ) : (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
          <div className="space-y-3">
            <Panel
              title="Your batches"
              description="Newest first. Unpublished batches stay in D1 and never reach students."
              action={<span className="text-[11px] font-semibold text-ink-500">{filtered.length} shown</span>}
            >
              <div className="mb-3">
                <input
                  className="ec-field"
                  placeholder="Search by name or exam…"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </div>
              {loading ? (
                <div className="grid gap-2">
                  <div className="ec-skeleton h-20" />
                  <div className="ec-skeleton h-20" />
                </div>
              ) : filtered.length === 0 ? (
                <div className="rounded-xl border border-dashed border-ink-200 p-6 text-center">
                  <p className="text-sm font-bold">No batches yet</p>
                  <p className="mt-1 text-xs text-ink-500">Create your first batch — add a name and an image link, and it is live.</p>
                  <button type="button" onClick={startNew} className="ec-btn ec-btn-primary mt-3 px-3.5 py-2 text-xs font-bold">
                    <Plus size={13} className="mr-1 inline" /> Create batch
                  </button>
                </div>
              ) : (
                <ul className="space-y-2">
                  {filtered.map((item) => {
                    const look = readBatchLook(item.metadata as Record<string, unknown>);
                    const palette = accentPalette(look.accent);
                    return (
                      <li
                        key={item.id}
                        className="ec-card ec-card-hover overflow-hidden p-0"
                        style={{ borderLeft: `4px solid ${palette.from}` }}
                      >
                        <div className="flex items-start gap-3 p-3">
                          <div
                            className="grid h-12 w-16 shrink-0 place-items-center overflow-hidden rounded-lg text-[10px] font-bold text-white"
                            style={{ background: `linear-gradient(135deg, ${palette.from}, ${palette.to})` }}
                          >
                            {look.imageUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={look.imageUrl} alt="" className="h-full w-full object-cover" />
                            ) : (
                              item.exam
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-bold">{item.title}</p>
                            <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10px] text-ink-500">
                              <span>{item.exam}</span>
                              <span>·</span>
                              <span>{item.classes.join(', ')}</span>
                              {look.instructor && <span>· {look.instructor}</span>}
                              {look.reward.enabled && <span>· 🏅 {look.reward.label || 'reward'}</span>}
                            </p>
                            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                              <StatusPill tone={item.active ? 'success' : 'warning'}>
                                {item.active ? 'Published' : 'Draft'}
                              </StatusPill>
                              {item.access_code && <StatusPill tone="info"><KeyRound size={10} /> code</StatusPill>}
                              {look.startsAt && (
                                <span className="inline-flex items-center gap-1 text-[10px] text-ink-500">
                                  <CalendarDays size={10} /> {new Date(look.startsAt).toLocaleDateString('en-IN')}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-1 border-t border-ink-100 px-2 py-1.5">
                          <button
                            type="button"
                            onClick={() => startEdit(item)}
                            className="ec-btn inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-brand-700 hover:bg-brand-50"
                          >
                            <Pencil size={11} /> Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => duplicateDraft(item)}
                            className="ec-btn inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-ink-600 hover:bg-ink-50"
                          >
                            <Copy size={11} /> Duplicate
                          </button>
                          <button
                            type="button"
                            disabled={busyId === item.id}
                            onClick={() => void toggleActive(item)}
                            className="ec-btn inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-ink-600 hover:bg-ink-50 disabled:opacity-50"
                          >
                            {item.active ? <EyeOff size={11} /> : <Eye size={11} />}
                            {item.active ? 'Unpublish' : 'Publish'}
                          </button>
                          <Link
                            href={`/lectures/${item.id}`}
                            className="ec-btn inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-ink-600 hover:bg-ink-50"
                          >
                            <ArrowRight size={11} /> Open
                          </Link>
                          <button
                            type="button"
                            onClick={() => setConfirmDelete(item)}
                            className="ec-btn ml-auto inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-red-600 hover:bg-red-50"
                          >
                            <Trash2 size={11} /> Delete
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Panel>
          </div>

          <div className="space-y-3">
            {draft ? (
              <>
                <Panel
                  title={draft.id ? 'Edit batch' : 'Create a batch'}
                  description="Students see exactly the card below once the batch is published and inside its schedule window."
                  action={
                    <StatusPill tone={draft.active ? 'success' : 'warning'}>
                      {draft.active ? 'Will publish' : 'Saved as draft'}
                    </StatusPill>
                  }
                >
                  <div className="grid gap-3">
                    <Field label="Batch name" required help="Shown as the card headline. 180 characters max.">
                      <input
                        className="ec-field text-base font-semibold"
                        value={draft.title}
                        maxLength={180}
                        placeholder="e.g. JEE 2027 Dropper — Rank Accelerator"
                        onChange={(event) => setDraft({ ...draft, title: event.target.value })}
                      />
                    </Field>
                    <Field label="One-line promise" help="Appears under the name on the student card.">
                      <input
                        className="ec-field"
                        value={draft.subtitle}
                        maxLength={180}
                        placeholder="120 lectures · 24 tests · daily planner"
                        onChange={(event) => setDraft({ ...draft, subtitle: event.target.value })}
                      />
                    </Field>
                    <Field label="Description" help="Used on the batch page and as the card fallback copy.">
                      <textarea
                        className="ec-field min-h-[84px]"
                        value={draft.description}
                        maxLength={4000}
                        placeholder="What is inside, how it runs, who it is for…"
                        onChange={(event) => setDraft({ ...draft, description: event.target.value })}
                      />
                    </Field>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="Cover image link" help="Any https:// image. Leave empty for a gradient cover.">
                        <input
                          className="ec-field"
                          value={draft.imageUrl}
                          placeholder="https://…/batch-cover.jpg"
                          onChange={(event) => setDraft({ ...draft, imageUrl: event.target.value })}
                        />
                      </Field>
                      <Field label="Hero image link" help="Optional wide artwork for the spotlight card.">
                        <input
                          className="ec-field"
                          value={draft.heroImageUrl}
                          placeholder="https://…/batch-hero.jpg"
                          onChange={(event) => setDraft({ ...draft, heroImageUrl: event.target.value })}
                        />
                      </Field>
                    </div>
                    {(draft.imageUrl || draft.heroImageUrl) && (
                      <div className="flex items-center gap-2 rounded-xl border border-ink-100 bg-ink-50/60 p-2">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={draft.heroImageUrl || draft.imageUrl}
                          alt="Cover preview"
                          className="h-16 w-28 rounded-lg object-cover"
                          onError={(event) => {
                            (event.currentTarget as HTMLImageElement).style.opacity = '0.25';
                          }}
                        />
                        <p className="text-[11px] leading-relaxed text-ink-500">
                          Image links are rendered directly. Use a public https URL (Drive share links and Imgur both work).
                        </p>
                      </div>
                    )}

                    <div className="grid gap-3 sm:grid-cols-3">
                      <Field label="Exam">
                        <select
                          className="ec-field"
                          value={draft.exam}
                          onChange={(event) => setDraft({ ...draft, exam: event.target.value as BatchDraft['exam'] })}
                        >
                          <option value="JEE">JEE</option>
                          <option value="NEET">NEET</option>
                          <option value="Both">JEE + NEET</option>
                        </select>
                      </Field>
                      <Field label="Mentor / teacher">
                        <input
                          className="ec-field"
                          value={draft.instructor}
                          onChange={(event) => setDraft({ ...draft, instructor: event.target.value })}
                          placeholder="A. B. Sharma"
                        />
                      </Field>
                      <Field label="Badge">
                        <input
                          className="ec-field"
                          value={draft.badge}
                          maxLength={40}
                          placeholder="New · Limited · Topper's pick"
                          onChange={(event) => setDraft({ ...draft, badge: event.target.value })}
                        />
                      </Field>
                    </div>

                    <Field label="Class levels" help="Only students in these classes see the batch.">
                      <div className="flex flex-wrap gap-1.5">
                        {CLASS_OPTIONS.map((cls) => {
                          const selected = draft.classes.includes(cls);
                          return (
                            <button
                              key={cls}
                              type="button"
                              onClick={() =>
                                setDraft({
                                  ...draft,
                                  classes: selected
                                    ? draft.classes.filter((value) => value !== cls)
                                    : [...draft.classes, cls],
                                })
                              }
                              className={`ec-btn px-3 py-1.5 text-xs font-bold transition ${
                                selected
                                  ? 'ec-btn-primary'
                                  : 'border border-ink-200 bg-[var(--ec-surface)] text-ink-600 hover:bg-ink-50'
                              }`}
                            >
                              {CLASS_LABELS[cls]}
                            </button>
                          );
                        })}
                      </div>
                    </Field>

                    <Field label="Features" help="Comma separated. Each becomes a coloured chip on the card.">
                      <input
                        className="ec-field"
                        value={draft.features}
                        placeholder="Daily planner, Doubt sessions, Weekly tests"
                        onChange={(event) => setDraft({ ...draft, features: event.target.value })}
                      />
                    </Field>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="Starts (IST)" help="The card shows a live countdown until this time.">
                        <input
                          type="datetime-local"
                          className="ec-field"
                          value={draft.startsAt}
                          onChange={(event) => setDraft({ ...draft, startsAt: event.target.value })}
                        />
                      </Field>
                      <Field label="Ends (IST)" help="After this the card hides automatically.">
                        <input
                          type="datetime-local"
                          className="ec-field"
                          value={draft.endsAt}
                          onChange={(event) => setDraft({ ...draft, endsAt: event.target.value })}
                        />
                      </Field>
                    </div>

                    <Field label="Show on pages" help="Each page can show a different set of batches.">
                      <div className="flex flex-wrap gap-1.5">
                        {BATCH_PAGES.map((page) => {
                          const selected = draft.pages.includes(page);
                          return (
                            <button
                              key={page}
                              type="button"
                              onClick={() =>
                                setDraft({
                                  ...draft,
                                  pages: selected ? draft.pages.filter((value) => value !== page) : [...draft.pages, page],
                                })
                              }
                              className={`ec-btn px-2.5 py-1.5 text-[11px] font-bold ${
                                selected
                                  ? 'bg-brand-600 text-white'
                                  : 'border border-ink-200 text-ink-600 hover:bg-ink-50'
                              }`}
                            >
                              {BATCH_PAGE_LABELS[page]}
                            </button>
                          );
                        })}
                      </div>
                    </Field>

                    <Field label="Card colour" help="Every batch can own a different accent — the brief was “all colours different”.">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setDraft({ ...draft, accent: 'auto' })}
                          data-active={draft.accent === 'auto'}
                          className="ec-swatch bg-[conic-gradient(from_0deg,#7c3aed,#0ea5e9,#22c55e,#f59e0b,#e11d48,#7c3aed)]"
                          aria-label="Automatic colour"
                        />
                        {BATCH_ACCENTS.map((accent) => (
                          <button
                            key={accent.id}
                            type="button"
                            title={accent.label}
                            aria-label={accent.label}
                            data-active={draft.accent === accent.id}
                            onClick={() => setDraft({ ...draft, accent: accent.id })}
                            className="ec-swatch"
                            style={{ background: `linear-gradient(135deg, ${accent.from}, ${accent.to})` }}
                          />
                        ))}
                      </div>
                    </Field>

                    <Field label="Entrance animation">
                      <select
                        className="ec-field"
                        value={draft.motion}
                        onChange={(event) => setDraft({ ...draft, motion: event.target.value as MotionPreset })}
                      >
                        {MOTION_PRESETS.map((preset) => (
                          <option key={preset.id} value={preset.id}>
                            {preset.label} — {preset.hint}
                          </option>
                        ))}
                      </select>
                    </Field>

                    <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-bold text-amber-900">Completion reward</p>
                        <Toggle
                          checked={draft.rewardEnabled}
                          onChange={(next) => setDraft({ ...draft, rewardEnabled: next })}
                          label="Show reward"
                        />
                      </div>
                      {draft.rewardEnabled && (
                        <div className="mt-2 grid gap-2 sm:grid-cols-2">
                          <select
                            className="ec-field"
                            value={draft.rewardType}
                            onChange={(event) => setDraft({ ...draft, rewardType: event.target.value as BatchRewardType })}
                          >
                            {REWARD_TYPES.map((reward) => (
                              <option key={reward.id} value={reward.id}>
                                {reward.icon} {reward.label}
                              </option>
                            ))}
                          </select>
                          <input
                            className="ec-field"
                            value={draft.rewardIcon}
                            maxLength={4}
                            placeholder="Emoji"
                            onChange={(event) => setDraft({ ...draft, rewardIcon: event.target.value })}
                          />
                          <input
                            className="ec-field"
                            value={draft.rewardLabel}
                            placeholder="Reward label e.g. Golden streak badge"
                            onChange={(event) => setDraft({ ...draft, rewardLabel: event.target.value })}
                          />
                          <input
                            className="ec-field"
                            value={draft.rewardValue}
                            placeholder="Value e.g. +250 XP"
                            onChange={(event) => setDraft({ ...draft, rewardValue: event.target.value })}
                          />
                        </div>
                      )}
                    </div>

                    <div className="grid gap-3 sm:grid-cols-3">
                      <Field label="Seats" help="0 hides the seat pill.">
                        <input
                          type="number"
                          min={0}
                          className="ec-field"
                          value={draft.seats}
                          onChange={(event) => setDraft({ ...draft, seats: event.target.value })}
                        />
                      </Field>
                      <Field label="Priority" help="Higher shows first.">
                        <input
                          type="number"
                          className="ec-field"
                          value={draft.priority}
                          onChange={(event) => setDraft({ ...draft, priority: event.target.value })}
                        />
                      </Field>
                      <Field label="Access code" help="Leave blank for open access.">
                        <div className="flex gap-1">
                          <input
                            className="ec-field"
                            value={draft.accessCode}
                            onChange={(event) => setDraft({ ...draft, accessCode: event.target.value.toUpperCase() })}
                            placeholder="JEE27"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setDraft({
                                ...draft,
                                accessCode: studioId('EC').toUpperCase().slice(0, 8),
                              })
                            }
                            className="ec-btn shrink-0 border border-ink-200 px-2 text-[11px] font-bold hover:bg-ink-50"
                          >
                            <Sparkles size={12} />
                          </button>
                        </div>
                      </Field>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="Button label">
                        <input
                          className="ec-field"
                          value={draft.ctaLabel}
                          placeholder="Join the batch"
                          onChange={(event) => setDraft({ ...draft, ctaLabel: event.target.value })}
                        />
                      </Field>
                      <Field label="Custom button link" help="Optional. Defaults to the batch page.">
                        <input
                          className="ec-field"
                          value={draft.ctaHref}
                          placeholder="/lectures"
                          onChange={(event) => setDraft({ ...draft, ctaHref: event.target.value })}
                        />
                      </Field>
                    </div>

                    <Toggle
                      checked={draft.active}
                      onChange={(next) => setDraft({ ...draft, active: next })}
                      label="Publish immediately"
                      description="When off, the batch is saved but stays invisible to students."
                    />

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => void saveDraft()}
                        className="ec-btn ec-btn-primary ec-btn-glow inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold disabled:opacity-60"
                      >
                        {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                        {draft.id ? 'Save changes' : 'Create batch'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setDraft(null)}
                        className="ec-btn ec-btn-secondary px-3.5 py-2.5 text-xs font-bold"
                      >
                        Close editor
                      </button>
                      {draft.id && (
                        <Link
                          href={`/lectures/${draft.id}`}
                          className="ec-btn inline-flex items-center gap-1 px-3 py-2.5 text-xs font-bold text-brand-700 hover:bg-brand-50"
                        >
                          View live <ArrowRight size={12} />
                        </Link>
                      )}
                    </div>
                  </div>
                </Panel>

                {preview && (
                  <PreviewFrame
                    device={device}
                    onDevice={setDevice}
                    label="Live student card"
                    hint="Exactly what students see on the page you selected."
                  >
                    <BatchStudioCard batch={preview} config={workspace.draft} animation={draft.motion} />
                  </PreviewFrame>
                )}
              </>
            ) : (
              <Panel title="Nothing selected yet" description="Pick a batch on the left, or create a new one to see the live card.">
                <div className="rounded-2xl border border-dashed border-brand-200 bg-brand-50/50 p-10 text-center">
                  <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl ec-btn-primary text-white">
                    <Layers size={22} />
                  </div>
                  <p className="mt-3 text-sm font-bold">Batch Studio</p>
                  <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-ink-500">
                    Name it, paste an image link, choose when it starts, who should see it, which page it lives on,
                    which colour and motion it uses — and the reward students unlock.
                  </p>
                </div>
              </Panel>
            )}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        loading={Boolean(busyId)}
        title={`Delete “${confirmDelete?.title || ''}”?`}
        description="Unpublishing keeps all lectures, tests and student progress. Permanent deletion removes the record and is blocked when students still depend on it."
        confirmLabel="Delete permanently"
        cancelLabel="Keep data"
        onCancel={() => setConfirmDelete(null)}
        onConfirm={() => void removeItem('permanent')}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Section design tab                                                         */
/* -------------------------------------------------------------------------- */

function SectionDesign({
  workspace,
  items,
  device,
  onDevice,
}: {
  workspace: ReturnType<typeof useSettingWorkspace<'batchStudio'>>;
  items: CourseCatalogItem[];
  device: PreviewDevice;
  onDevice: (next: PreviewDevice) => void;
}) {
  const { draft, update } = workspace;
  const demo = useMemo<PreparedBatch>(() => {
    const sample = items.find((item) => item.active) || items[0];
    const look = sample
      ? readBatchLook(sample.metadata as Record<string, unknown>)
      : readBatchLook({ studio: { accent: 'violet', reward: { enabled: true, label: 'Golden badge', value: '+250 XP', icon: '🏅' }, features: [{ id: 'a', label: 'Daily planner', icon: '✓' }, { id: 'b', label: 'Doubt sessions', icon: '💬' }], seats: 40, instructor: 'Exam Cracker faculty', startsAt: new Date(Date.now() + 5 * 86400000).toISOString() } });
    const item: CourseCatalogItem = sample || {
      id: 'sample',
      kind: 'batch',
      title: 'JEE 2027 Rank Accelerator',
      description: '120 lectures, 24 rank tests, a daily planner and mentor doubt sessions.',
      exam: 'JEE',
      classes: ['11', '12', 'Dropper'],
      active: true,
      metadata: {},
      created_at: '',
      updated_at: '',
    };
    const accentKey = look.accent === 'auto' ? draft.accentCycle[0] || 'violet' : look.accent;
    return { item, look, accent: accentPalette(accentKey, 0), index: 0 };
  }, [items, draft.accentCycle]);

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="space-y-3">
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
          publishLabel="Publish section"
        />
        <Panel title="Section copy" description="The big editorial header above every batch card.">
          <div className="grid gap-3">
            <Toggle
              checked={draft.enabled}
              onChange={(next) => update({ enabled: next })}
              label="Show the batch showcase"
              description="Turn off to hide the section everywhere without deleting your batches."
            />
            <Field label="Eyebrow">
              <input
                className="ec-field"
                value={draft.eyebrow}
                maxLength={80}
                onChange={(event) => update({ eyebrow: event.target.value })}
              />
            </Field>
            <Field label="Headline" help="Rendered as a large gradient heading.">
              <input
                className="ec-field text-base font-bold"
                value={draft.title}
                maxLength={140}
                onChange={(event) => update({ title: event.target.value })}
              />
            </Field>
            <Field label="Sub headline">
              <textarea
                className="ec-field min-h-[72px]"
                value={draft.subtitle}
                maxLength={400}
                onChange={(event) => update({ subtitle: event.target.value })}
              />
            </Field>
            <Field label="Layout">
              <div className="grid gap-2 sm:grid-cols-2">
                {BATCH_LAYOUTS.map((layout) => (
                  <button
                    key={layout.id}
                    type="button"
                    onClick={() => update({ layout: layout.id })}
                    className={`rounded-xl border p-3 text-left transition ${
                      draft.layout === layout.id
                        ? 'border-brand-400 bg-brand-50'
                        : 'border-ink-200 hover:bg-ink-50'
                    }`}
                  >
                    <p className="text-xs font-bold">{layout.label}</p>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-ink-500">{layout.hint}</p>
                  </button>
                ))}
              </div>
            </Field>
            <div className="grid gap-2 sm:grid-cols-2">
              <Toggle checked={draft.showCountdown} onChange={(next) => update({ showCountdown: next })} label="Show countdown" />
              <Toggle checked={draft.showReward} onChange={(next) => update({ showReward: next })} label="Show rewards" />
              <Toggle checked={draft.showFeatures} onChange={(next) => update({ showFeatures: next })} label="Show feature chips" />
              <Toggle checked={draft.showInstructor} onChange={(next) => update({ showInstructor: next })} label="Show mentor" />
              <Toggle checked={draft.showSeats} onChange={(next) => update({ showSeats: next })} label="Show seats" />
            </div>
            <Field label="Pages" help="Where the showcase appears for students.">
              <div className="flex flex-wrap gap-1.5">
                {BATCH_PAGES.map((page) => {
                  const selected = draft.pages.includes(page);
                  return (
                    <button
                      key={page}
                      type="button"
                      onClick={() =>
                        update({
                          pages: selected ? draft.pages.filter((value) => value !== page) : [...draft.pages, page],
                        })
                      }
                      className={`ec-btn px-2.5 py-1.5 text-[11px] font-bold ${
                        selected ? 'bg-brand-600 text-white' : 'border border-ink-200 text-ink-600 hover:bg-ink-50'
                      }`}
                    >
                      {BATCH_PAGE_LABELS[page]}
                    </button>
                  );
                })}
              </div>
            </Field>
            <Field label="Maximum cards">
              <input
                type="range"
                min={1}
                max={12}
                value={draft.maxItems}
                onChange={(event) => update({ maxItems: Number(event.target.value) })}
                className="w-full accent-[var(--ec-brand)]"
              />
              <p className="mt-1 text-[11px] font-semibold text-ink-500">{draft.maxItems} cards</p>
            </Field>
            <Field label="Colour cycle" help="Batches set to “automatic” cycle through these colours in order.">
              <div className="flex flex-wrap gap-1.5">
                {BATCH_ACCENTS.map((accent) => {
                  const selected = draft.accentCycle.includes(accent.id);
                  return (
                    <button
                      key={accent.id}
                      type="button"
                      title={accent.label}
                      className="ec-swatch"
                      data-active={selected}
                      style={{ background: `linear-gradient(135deg, ${accent.from}, ${accent.to})` }}
                      onClick={() =>
                        update({
                          accentCycle: selected
                            ? draft.accentCycle.filter((value) => value !== accent.id)
                            : [...draft.accentCycle, accent.id],
                        })
                      }
                    />
                  );
                })}
              </div>
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="CTA label">
                <input
                  className="ec-field"
                  value={draft.ctaLabel}
                  onChange={(event) => update({ ctaLabel: event.target.value })}
                />
              </Field>
              <Field label="CTA link">
                <input
                  className="ec-field"
                  value={draft.ctaHref}
                  onChange={(event) => update({ ctaHref: event.target.value })}
                />
              </Field>
            </div>
          </div>
        </Panel>
      </div>
      <div className="space-y-3">
        <PreviewFrame device={device} onDevice={onDevice} label="Section preview" hint="Live layout, colours and motion.">
          <div className="space-y-4">
            <div>
              <span className="ec-eyebrow-pill">
                <Sparkles size={12} /> {draft.eyebrow || 'Batch Studio'}
              </span>
              <h2 className="ec-display mt-2.5 text-[1.75rem] leading-tight">
                <span className="ec-gradient-text">{draft.title || 'Your headline'}</span>
              </h2>
              {draft.subtitle && <p className="mt-1.5 text-sm leading-relaxed text-ink-500">{draft.subtitle}</p>}
            </div>
            {draft.layout === 'minimal' ? (
              <div className="ec-batch-card p-4" style={{ ['--accent-from' as string]: demo.accent.from }}>
                <p className="ec-batch-title">{demo.item.title}</p>
                <p className="mt-1 text-xs text-ink-500">{demo.item.description}</p>
              </div>
            ) : (
              <BatchStudioCard batch={demo} config={draft} animation={demo.look.motion} />
            )}
            <p className="text-[11px] text-ink-500">
              Audience targeting is handled per batch (exam + class levels) and per page, so each student only ever sees
              what is meant for them.
            </p>
          </div>
        </PreviewFrame>
        <Panel title="How the targeting works" description="A quick map so nobody has to guess.">
          <ul className="space-y-2 text-xs leading-relaxed text-ink-600">
            <li><strong>Who:</strong> exam + class levels on each batch, plus the audience rules on animation layers ({Object.values(AUDIENCE_LABELS).slice(0, 4).join(', ')}…).</li>
            <li><strong>When:</strong> start and end times are stored in IST; the card appears inside that window only.</li>
            <li><strong>Where:</strong> page pills on the batch decide home, lectures, tests, dashboard or events.</li>
            <li><strong>How it looks:</strong> accent colour, layout, motion preset, badge, chips, seats and reward per batch.</li>
            <li><strong>Access:</strong> an optional access code gates the batch; students enroll with the code from the lectures hub.</li>
          </ul>
        </Panel>
      </div>
    </div>
  );
}

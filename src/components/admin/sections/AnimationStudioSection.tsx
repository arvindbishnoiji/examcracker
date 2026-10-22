'use client';

import { useMemo, useState } from 'react';
import {
  Clapperboard,
  Code2,
  Copy,
  Eye,
  EyeOff,
  Layers,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
  Wand2,
} from 'lucide-react';
import { AdminPageHeader, Banner, Field, Panel, StatusPill, Toggle } from '../ui';
import { SettingsPublishBar } from '../SettingsPublishBar';
import { useSettingWorkspace } from '@/hooks/useSettingWorkspace';
import { useToast } from '@/hooks/useToast';
import {
  ANIMATION_TEMPLATES,
  AUDIENCE_IDS,
  AUDIENCE_LABELS,
  BATCH_PAGES,
  BATCH_PAGE_LABELS,
  buildAnimationDocument,
  studioId,
} from '@/lib/studio-config';
import { fromISTDateTimeLocalInput, toISTDateTimeLocalInput } from '@/lib/date';
import type { AnimationLayer, AnimationTrigger, BatchPage } from '@/types';

type CodeTab = 'html' | 'css' | 'js';

const TRIGGERS: Array<{ id: AnimationTrigger; label: string; hint: string }> = [
  { id: 'page_load', label: 'On page load', hint: 'Fires instantly when the page opens.' },
  { id: 'delay', label: 'After a delay', hint: 'Waits for the delay you set, then plays.' },
  { id: 'scroll', label: 'On scroll', hint: 'Plays once the student scrolls down a little.' },
  { id: 'exit_intent', label: 'Exit intent', hint: 'Plays when the pointer leaves the top of the window.' },
  { id: 'idle', label: 'When idle', hint: 'Plays after the student stops interacting.' },
  { id: 'schedule', label: 'Schedule only', hint: 'Plays for anyone inside the start/end window.' },
];

const SURFACES: Array<{ id: AnimationLayer['surface']; label: string; hint: string }> = [
  { id: 'overlay', label: 'Full overlay', hint: 'Covers the screen (with optional backdrop).' },
  { id: 'banner', label: 'Bottom banner', hint: 'A slim ribbon at the bottom edge.' },
  { id: 'corner', label: 'Corner sticker', hint: 'A floating card in the bottom-right corner.' },
  { id: 'floating', label: 'Floating canvas', hint: 'Transparent full-screen layer, no blocking.' },
];

const FREQUENCIES: Array<{ id: AnimationLayer['frequency']; label: string }> = [
  { id: 'once_session', label: 'Once per session' },
  { id: 'once_day', label: 'Once per day' },
  { id: 'once_user', label: 'Once per student' },
  { id: 'always', label: 'Every visit' },
];

const BACKDROPS: Array<{ id: AnimationLayer['backdrop']; label: string }> = [
  { id: 'none', label: 'No backdrop' },
  { id: 'dim', label: 'Dim' },
  { id: 'blur', label: 'Blur' },
  { id: 'vignette', label: 'Vignette' },
];

function blankLayer(templateId?: string): AnimationLayer {
  const template = ANIMATION_TEMPLATES.find((entry) => entry.id === templateId);
  return {
    id: studioId('layer'),
    name: template?.name || 'Untitled animation',
    enabled: true,
    surface: template?.surface || 'overlay',
    pages: ['home'],
    audience: 'all',
    trigger: template?.trigger || 'page_load',
    delayMs: template?.trigger === 'delay' ? 1200 : 0,
    durationMs: 0,
    frequency: 'once_session',
    caption: template?.caption || '',
    html: template?.html || '<div class="hello">Hello 👋</div>',
    css: template?.css || '.hello{font:800 28px Inter,sans-serif;color:#6d28d9}',
    js: template?.js || '',
    backdrop: template?.backdrop || 'none',
    dismissible: true,
    reward: { label: '', icon: '🎁', href: '', claimLabel: '' },
    startAt: '',
    endAt: '',
    priority: 0,
    updatedAt: new Date().toISOString(),
  };
}

export function AnimationStudioSection() {
  const workspace = useSettingWorkspace('animations');
  const { push } = useToast();
  const { draft, update, setDraft } = workspace;
  const [editingId, setEditingId] = useState<string | null>(null);
  const [codeTab, setCodeTab] = useState<CodeTab>('html');
  const [previewKey, setPreviewKey] = useState(0);
  const [showTemplates, setShowTemplates] = useState(false);

  const editing = useMemo(
    () => draft.layers.find((layer) => layer.id === editingId) || null,
    [draft.layers, editingId]
  );

  const previewDoc = useMemo(() => {
    if (!editing) return '';
    return buildAnimationDocument(editing);
    // previewKey forces a reload so loops restart on demand.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing?.html, editing?.css, editing?.js, previewKey]);

  function addLayer(templateId?: string) {
    const layer = blankLayer(templateId);
    update({ layers: [...draft.layers, layer] });
    setEditingId(layer.id);
    setShowTemplates(false);
    push('Animation added. Tune the timing, page and reward, then publish.', 'success');
  }

  function patchLayer(patch: Partial<AnimationLayer>) {
    if (!editing) return;
    update({
      layers: draft.layers.map((layer) =>
        layer.id === editing.id ? { ...layer, ...patch, updatedAt: new Date().toISOString() } : layer
      ),
    });
  }

  function removeLayer(id: string) {
    update({ layers: draft.layers.filter((layer) => layer.id !== id) });
    if (editingId === id) setEditingId(null);
  }

  function duplicateLayer(layer: AnimationLayer) {
    const copy: AnimationLayer = {
      ...layer,
      id: studioId('layer'),
      name: `${layer.name} (copy)`,
      enabled: false,
      priority: layer.priority - 1,
      updatedAt: new Date().toISOString(),
    };
    update({ layers: [...draft.layers, copy] });
    setEditingId(copy.id);
  }

  return (
    <div className="pb-24">
      <AdminPageHeader
        eyebrow="Experience Studio"
        title="Animation Studio"
        description="Author your own animation “index.html” per page: paste HTML, CSS and JS, choose which page and audience it plays for, set the trigger, timing, frequency and an optional reward/action link."
        meta={
          <>
            <StatusPill tone="brand">{draft.layers.length} layers</StatusPill>
            <StatusPill tone="success">
              {draft.layers.filter((layer) => layer.enabled).length} enabled
            </StatusPill>
            <StatusPill tone="info">Sandboxed iframe</StatusPill>
          </>
        }
        actions={
          <>
            <button
              type="button"
              onClick={() => setShowTemplates((open) => !open)}
              className="ec-btn ec-btn-secondary inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold"
            >
              <Wand2 size={13} /> Templates
            </button>
            <button
              type="button"
              onClick={() => addLayer()}
              className="ec-btn ec-btn-primary ec-btn-glow inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold"
            >
              <Plus size={14} /> Blank layer
            </button>
          </>
        }
      />

      {showTemplates && (
        <Panel
          title="Start from a template"
          description="Every template is fully editable HTML/CSS/JS. Nothing is locked."
          className="mb-4"
        >
          <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
            {ANIMATION_TEMPLATES.map((template) => (
              <button
                key={template.id}
                type="button"
                onClick={() => addLayer(template.id)}
                className="ec-card ec-card-hover p-3 text-left"
              >
                <p className="flex items-center gap-1.5 text-xs font-bold">
                  <Sparkles size={12} className="text-brand-600" /> {template.name}
                </p>
                <p className="mt-1 text-[11px] leading-relaxed text-ink-500">{template.description}</p>
                <span className="mt-2 inline-flex rounded-full bg-ink-100 px-2 py-0.5 text-[10px] font-bold text-ink-600">
                  {template.surface} · {template.trigger.replace('_', ' ')}
                </span>
              </button>
            ))}
          </div>
        </Panel>
      )}

      <div className="mb-4">
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
          publishLabel="Publish animations"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.35fr)]">
        <div className="space-y-3">
          <Panel title="Studio controls" description="Global switches for every published layer.">
            <div className="grid gap-2">
              <Toggle
                checked={draft.enabled}
                onChange={(next) => update({ enabled: next })}
                label="Animations are live"
                description="A single kill-switch for every layer on the student site."
              />
              <Toggle
                checked={draft.respectReducedMotion}
                onChange={(next) => update({ respectReducedMotion: next })}
                label="Respect reduced motion"
                description="Skips layers for students who ask their device for less motion."
              />
            </div>
          </Panel>

          <Panel
            title="Layers"
            description="Ordered by priority. The highest eligible layer plays first."
            action={<StatusPill tone="neutral">{draft.layers.length}</StatusPill>}
          >
            {draft.layers.length === 0 ? (
              <div className="rounded-xl border border-dashed border-brand-200 bg-brand-50/50 p-6 text-center">
                <Clapperboard className="mx-auto text-brand-600" size={22} />
                <p className="mt-2 text-sm font-bold">No animation layers yet</p>
                <p className="mx-auto mt-1 max-w-xs text-xs leading-relaxed text-ink-500">
                  Pick a template above, or start blank and paste your own HTML, CSS and JS.
                </p>
              </div>
            ) : (
              <ul className="space-y-2">
                {[...draft.layers]
                  .sort((a, b) => b.priority - a.priority)
                  .map((layer) => (
                    <li key={layer.id} className="ec-card p-2.5">
                      <div className="flex items-start gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-bold">{layer.name}</p>
                          <p className="mt-0.5 text-[10px] text-ink-500">
                            {layer.surface} · {layer.trigger.replace('_', ' ')} · {layer.pages.join(', ')}
                          </p>
                          <div className="mt-1 flex flex-wrap gap-1">
                            <StatusPill tone={layer.enabled ? 'success' : 'neutral'}>
                              {layer.enabled ? 'On' : 'Off'}
                            </StatusPill>
                            <StatusPill tone="info">{AUDIENCE_LABELS[layer.audience]}</StatusPill>
                            {layer.reward.label && <StatusPill tone="warning">🎁 reward</StatusPill>}
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-0.5">
                          <button
                            type="button"
                            title={layer.enabled ? 'Disable' : 'Enable'}
                            onClick={() => {
                              update({
                                layers: draft.layers.map((entry) =>
                                  entry.id === layer.id ? { ...entry, enabled: !entry.enabled } : entry
                                ),
                              });
                            }}
                            className="rounded-lg p-1.5 text-ink-500 hover:bg-ink-100"
                          >
                            {layer.enabled ? <Eye size={13} /> : <EyeOff size={13} />}
                          </button>
                          <button
                            type="button"
                            title="Edit"
                            onClick={() => setEditingId(layer.id)}
                            className="rounded-lg p-1.5 text-brand-700 hover:bg-brand-50"
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            type="button"
                            title="Duplicate"
                            onClick={() => duplicateLayer(layer)}
                            className="rounded-lg p-1.5 text-ink-500 hover:bg-ink-100"
                          >
                            <Copy size={13} />
                          </button>
                          <button
                            type="button"
                            title="Delete"
                            onClick={() => removeLayer(layer.id)}
                            className="rounded-lg p-1.5 text-red-600 hover:bg-red-50"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
              </ul>
            )}
          </Panel>
        </div>

        <div className="space-y-3">
          {editing ? (
            <>
              <Panel
                title={editing.name}
                description="Everything here is saved to the animations setting and published atomically."
                action={<StatusPill tone={editing.enabled ? 'success' : 'neutral'}>{editing.enabled ? 'Enabled' : 'Disabled'}</StatusPill>}
              >
                <div className="grid gap-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Layer name" required>
                      <input
                        className="ec-field font-semibold"
                        value={editing.name}
                        onChange={(event) => patchLayer({ name: event.target.value })}
                      />
                    </Field>
                    <Field label="Caption / label" help="Shown to screen readers and used in admin lists.">
                      <input
                        className="ec-field"
                        value={editing.caption}
                        onChange={(event) => patchLayer({ caption: event.target.value })}
                      />
                    </Field>
                  </div>

                  <Field label="Which pages?" help="The same code can run on multiple pages.">
                    <div className="flex flex-wrap gap-1.5">
                      {BATCH_PAGES.map((page) => {
                        const selected = editing.pages.includes(page);
                        return (
                          <button
                            key={page}
                            type="button"
                            onClick={() =>
                              patchLayer({
                                pages: selected
                                  ? editing.pages.filter((value) => value !== page)
                                  : [...editing.pages, page as BatchPage],
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

                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Who sees it?">
                      <select
                        className="ec-field"
                        value={editing.audience}
                        onChange={(event) => patchLayer({ audience: event.target.value as AnimationLayer['audience'] })}
                      >
                        {AUDIENCE_IDS.map((audience) => (
                          <option key={audience} value={audience}>
                            {AUDIENCE_LABELS[audience]}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Frequency">
                      <select
                        className="ec-field"
                        value={editing.frequency}
                        onChange={(event) => patchLayer({ frequency: event.target.value as AnimationLayer['frequency'] })}
                      >
                        {FREQUENCIES.map((frequency) => (
                          <option key={frequency.id} value={frequency.id}>
                            {frequency.label}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </div>

                  <Field label="Surface" help="How the layer sits on the page.">
                    <div className="grid gap-2 sm:grid-cols-2">
                      {SURFACES.map((surface) => (
                        <button
                          key={surface.id}
                          type="button"
                          onClick={() => patchLayer({ surface: surface.id })}
                          className={`rounded-xl border p-2.5 text-left ${
                            editing.surface === surface.id
                              ? 'border-brand-400 bg-brand-50'
                              : 'border-ink-200 hover:bg-ink-50'
                          }`}
                        >
                          <p className="text-xs font-bold">{surface.label}</p>
                          <p className="text-[10px] text-ink-500">{surface.hint}</p>
                        </button>
                      ))}
                    </div>
                  </Field>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Trigger">
                      <select
                        className="ec-field"
                        value={editing.trigger}
                        onChange={(event) => patchLayer({ trigger: event.target.value as AnimationTrigger })}
                      >
                        {TRIGGERS.map((trigger) => (
                          <option key={trigger.id} value={trigger.id}>
                            {trigger.label}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Backdrop" help="Only used by full-overlay layers.">
                      <select
                        className="ec-field"
                        value={editing.backdrop}
                        onChange={(event) => patchLayer({ backdrop: event.target.value as AnimationLayer['backdrop'] })}
                      >
                        {BACKDROPS.map((backdrop) => (
                          <option key={backdrop.id} value={backdrop.id}>
                            {backdrop.label}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Delay (ms)" help="0 = instant.">
                      <input
                        type="number"
                        min={0}
                        max={120000}
                        step={100}
                        className="ec-field"
                        value={editing.delayMs}
                        onChange={(event) => patchLayer({ delayMs: Number(event.target.value) })}
                      />
                    </Field>
                    <Field label="Auto-hide after (ms)" help="0 keeps it until the student closes it.">
                      <input
                        type="number"
                        min={0}
                        max={600000}
                        step={500}
                        className="ec-field"
                        value={editing.durationMs}
                        onChange={(event) => patchLayer({ durationMs: Number(event.target.value) })}
                      />
                    </Field>
                    <Field label="Start (IST)" help="Optional window.">
                      <input
                        type="datetime-local"
                        className="ec-field"
                        value={toISTDateTimeLocalInput(editing.startAt)}
                        onChange={(event) =>
                          patchLayer({ startAt: fromISTDateTimeLocalInput(event.target.value) || '' })
                        }
                      />
                    </Field>
                    <Field label="End (IST)">
                      <input
                        type="datetime-local"
                        className="ec-field"
                        value={toISTDateTimeLocalInput(editing.endAt)}
                        onChange={(event) =>
                          patchLayer({ endAt: fromISTDateTimeLocalInput(event.target.value) || '' })
                        }
                      />
                    </Field>
                    <Field label="Priority" help="Higher wins when several layers match.">
                      <input
                        type="number"
                        className="ec-field"
                        value={editing.priority}
                        onChange={(event) => patchLayer({ priority: Number(event.target.value) })}
                      />
                    </Field>
                    <div className="flex items-end">
                      <Toggle
                        checked={editing.dismissible}
                        onChange={(next) => patchLayer({ dismissible: next })}
                        label="Let students close it"
                      />
                    </div>
                  </div>

                  <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3">
                    <p className="text-xs font-bold text-amber-900">Choose the reward</p>
                    <p className="mt-0.5 text-[11px] text-amber-800/80">
                      Shown as a claimable chip on the layer. Leave the link empty to hide it.
                    </p>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      <input
                        className="ec-field"
                        placeholder="Reward label e.g. 7-day streak bonus"
                        value={editing.reward.label}
                        onChange={(event) => patchLayer({ reward: { ...editing.reward, label: event.target.value } })}
                      />
                      <div className="flex gap-2">
                        <input
                          className="ec-field w-16 text-center"
                          maxLength={4}
                          value={editing.reward.icon}
                          onChange={(event) => patchLayer({ reward: { ...editing.reward, icon: event.target.value } })}
                        />
                        <input
                          className="ec-field"
                          placeholder="Claim link /profile"
                          value={editing.reward.href}
                          onChange={(event) => patchLayer({ reward: { ...editing.reward, href: event.target.value } })}
                        />
                      </div>
                      <input
                        className="ec-field sm:col-span-2"
                        placeholder="Claim button text e.g. Claim in profile"
                        value={editing.reward.claimLabel}
                        onChange={(event) => patchLayer({ reward: { ...editing.reward, claimLabel: event.target.value } })}
                      />
                    </div>
                  </div>
                </div>
              </Panel>

              <Panel
                title="Animation code"
                description="Paste an index.html body, its CSS and JS. Runs inside a sandboxed iframe (scripts allowed, no access to app data)."
                action={
                  <button
                    type="button"
                    onClick={() => setPreviewKey((key) => key + 1)}
                    className="ec-btn ec-btn-secondary inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold"
                  >
                    <Layers size={12} /> Reload preview
                  </button>
                }
              >
                <div className="mb-2 flex flex-wrap items-center gap-1.5">
                  {(['html', 'css', 'js'] as CodeTab[]).map((code) => (
                    <button
                      key={code}
                      type="button"
                      className="ec-studio-tab uppercase"
                      data-active={codeTab === code}
                      onClick={() => setCodeTab(code)}
                    >
                      <Code2 size={12} /> {code}
                    </button>
                  ))}
                  <span className="ml-auto text-[10px] text-ink-500">
                    {(editing[codeTab] || '').length.toLocaleString()} / 12,000 chars
                  </span>
                </div>
                <textarea
                  className="ec-code"
                  spellCheck={false}
                  value={editing[codeTab]}
                  onChange={(event) => patchLayer({ [codeTab]: event.target.value } as Partial<AnimationLayer>)}
                  placeholder={
                    codeTab === 'html'
                      ? '<div class="wrap">…</div>'
                      : codeTab === 'css'
                        ? '.wrap { … }'
                        : '// optional JS'
                  }
                />

                <div className="mt-3">
                  <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold text-ink-600">
                    <Eye size={12} /> Live sandbox preview
                  </p>
                  <div className="ec-studio-preview-frame" style={{ height: 320 }}>
                    <iframe
                      key={previewKey}
                      title="Animation preview"
                      srcDoc={previewDoc}
                      sandbox="allow-scripts allow-popups"
                      style={{ width: '100%', height: '100%', border: 0, background: 'transparent' }}
                    />
                  </div>
                  <p className="mt-1.5 text-[10px] leading-relaxed text-ink-500">
                    The preview uses the same document builder as the live host, so what you see here is what students
                    get. Inline links inside the iframe must be full URLs.
                  </p>
                </div>
              </Panel>
            </>
          ) : (
            <Panel title="Pick a layer to edit" description="Or add a template to see the code editor.">
              <div className="rounded-2xl border border-dashed border-brand-200 bg-brand-50/50 p-10 text-center">
                <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl ec-btn-primary text-white">
                  <Clapperboard size={22} />
                </div>
                <p className="mt-3 text-sm font-bold">Animation Studio</p>
                <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-ink-500">
                  Choose the page, the audience, the moment it fires, how long it plays, how often it reappears, and the
                  reward chip students can claim.
                </p>
              </div>
            </Panel>
          )}
        </div>
      </div>

      <Banner tone="info" title="Safety model">
        Layers render inside <code className="rounded bg-white/60 px-1">sandbox=&quot;allow-scripts&quot;</code> — an
        isolated origin without same-origin access, so authored JS cannot read student data, cookies or the parent page.
        Every publish is validated (pages, timing, links, code size) before it reaches D1.
      </Banner>
    </div>
  );
}

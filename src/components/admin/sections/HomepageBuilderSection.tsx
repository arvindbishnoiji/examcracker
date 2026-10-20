'use client';

import { useEffect, useMemo, useState } from 'react';
import type { CourseCatalogItem, HomeSectionConfig, HomeSectionType } from '@/types';
import { useSettingWorkspace } from '@/hooks/useSettingWorkspace';
import {
  AUDIENCE_TARGETS,
  createHomeSection,
  HOME_SECTION_LABELS,
  HOME_SECTION_TYPES,
  makeId,
  moveSection,
} from '@/lib/site-config';
import { getAdminContentList } from '@/lib/api';
import { AdminPageHeader, Banner, ConfirmDialog, Field, Panel, Segmented, Spinner, StatusPill, Toggle } from '../ui';
import { PreviewFrame, type PreviewDevice } from '../PreviewFrame';
import { SettingsPublishBar } from '../SettingsPublishBar';

const SECTION_ICONS: Record<HomeSectionType, string> = {
  hero: '▰',
  goal: '◎',
  upcoming_tests: '✎',
  live_tests: '◉',
  events: '▦',
  featured_batches: '▣',
  featured_series: '▤',
  continue_learning: '▶',
  popular_lectures: '☰',
  subject_shortcuts: '⌘',
  study_progress: '▧',
  announcements: '◔',
  challenges: '⚡',
  leaderboard_preview: '♜',
  quick_links: '⇥',
  promo: '❐',
  custom: '✎',
  testimonials: '❝',
};

function HomeWireframe({ sections, showGreeting }: { sections: HomeSectionConfig[]; showGreeting: boolean }) {
  return (
    <div className="rounded-xl border border-ink-200 bg-[var(--ec-bg)] p-3 space-y-2 min-h-[520px]">
      <div className="ec-header rounded-xl border px-3 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="h-5 w-5 rounded bg-brand-600" />
          <span className="text-[10px] font-bold">Exam Cracker</span>
        </div>
        <div className="flex gap-1">
          <span className="h-4 w-8 rounded bg-ink-100" />
          <span className="h-4 w-8 rounded bg-ink-100" />
          <span className="h-4 w-10 rounded bg-brand-600" />
        </div>
      </div>
      {showGreeting && (
        <div className="px-1">
          <div className="h-2.5 w-36 rounded bg-ink-200" />
          <div className="h-1.5 w-24 rounded bg-ink-100 mt-1.5" />
        </div>
      )}
      {sections.map((section, index) => (
        <div
          key={section.id}
          className={`rounded-xl border p-2.5 ${
            section.visible ? 'border-ink-200 bg-[var(--ec-surface)]' : 'border-dashed border-ink-200 bg-ink-50 opacity-55'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-[9px] font-bold text-ink-400 w-3">{index + 1}</span>
              <span className="text-[11px]">{SECTION_ICONS[section.type]}</span>
              <span className="text-[10px] font-semibold truncate">{section.title || HOME_SECTION_LABELS[section.type]}</span>
            </div>
            <div className="flex items-center gap-1">
              {section.audience !== 'all' && (
                <span className="text-[8px] bg-brand-50 text-brand-700 rounded-full px-1.5 py-0.5">{section.audience}</span>
              )}
              <span className={`text-[8px] ${section.visible ? 'text-emerald-600' : 'text-ink-400'}`}>
                {section.visible ? 'Visible' : 'Hidden'}
              </span>
            </div>
          </div>
          {section.type === 'hero' ? (
            <div className="mt-2 h-16 rounded-lg bg-gradient-to-br from-brand-500 to-brand-800 p-2 flex flex-col justify-between">
              <div className="h-1.5 w-24 rounded bg-white/70" />
              <div className="h-4 w-16 rounded bg-white/90" />
            </div>
          ) : section.type === 'custom' || section.type === 'promo' ? (
            <div className="mt-2 h-12 rounded-lg bg-ink-100 p-2 text-[8px] text-ink-500 line-clamp-2">
              {section.body || 'Custom content'}
            </div>
          ) : (
            <div className="mt-2 grid grid-cols-3 gap-1.5">
              {[0, 1, 2].map((item) => (
                <div key={item} className="h-9 rounded-md bg-ink-50 border border-ink-100" />
              ))}
            </div>
          )}
        </div>
      ))}
      {sections.length === 0 && (
        <div className="rounded-xl border border-dashed border-ink-200 p-6 text-center">
          <p className="text-[11px] font-semibold">No sections</p>
          <p className="text-[9px] text-ink-500 mt-1">Add sections to build the dashboard.</p>
        </div>
      )}
    </div>
  );
}

export function HomepageBuilderSection() {
  const workspace = useSettingWorkspace('homepage');
  const { draft, update, loading } = workspace;
  const [addType, setAddType] = useState<HomeSectionType>('promo');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [device, setDevice] = useState<PreviewDevice>('desktop');
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const sections = draft.sections;
  const visibleCount = sections.filter((section) => section.visible).length;

  function setSections(next: HomeSectionConfig[]) {
    update({ sections: next });
  }

  function patchSection(id: string, patch: Partial<HomeSectionConfig>) {
    setSections(sections.map((section) => (section.id === id ? { ...section, ...patch } : section)));
  }

  function addSection() {
    const section = createHomeSection(addType, sections.length);
    setSections([...sections, section]);
    setEditingId(section.id);
  }

  function duplicateSection(section: HomeSectionConfig) {
    const copy: HomeSectionConfig = {
      ...section,
      id: makeId('section'),
      title: `${section.title} (copy)`,
    };
    const index = sections.findIndex((item) => item.id === section.id);
    const next = [...sections];
    next.splice(index + 1, 0, copy);
    setSections(next);
    setEditingId(copy.id);
  }

  function handleDrop(index: number) {
    if (dragIndex === null || dragIndex === index) {
      setDragIndex(null);
      return;
    }
    setSections(moveSection(sections, dragIndex, index));
    setDragIndex(null);
  }

  if (loading) return <Spinner label="Loading homepage sections…" />;

  return (
    <div>
      <AdminPageHeader
        eyebrow="Design studio"
        title="Home Page Builder"
        description="Compose the student dashboard from real data-backed sections. Reorder, hide, target by exam/class and publish — the live homepage follows this exact order."
        meta={
          <>
            <StatusPill tone="brand">{sections.length} sections</StatusPill>
            <StatusPill tone="success">{visibleCount} visible</StatusPill>
            <StatusPill tone="neutral">{draft.showSearch ? 'Search on' : 'Search off'}</StatusPill>
          </>
        }
        actions={
          <>
            <a href="/home" target="_blank" className="ec-btn px-3 py-2 text-xs font-semibold border border-ink-200 hover:bg-ink-50">
              View homepage ↗
            </a>
            <button type="button" onClick={addSection} className="ec-btn px-3 py-2 text-xs font-semibold bg-brand-600 text-white">
              + Add section
            </button>
          </>
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

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_430px] mt-5 items-start">
        <div className="space-y-5">
          <Panel title="Homepage options" description="Global behaviours applied before sections render.">
            <div className="grid sm:grid-cols-2 gap-4">
              <Toggle
                checked={draft.showGreeting}
                onChange={(showGreeting) => update({ showGreeting })}
                label="Show greeting"
                description="Personalised welcome line above the first section."
              />
              <Toggle
                checked={draft.showSearch}
                onChange={(showSearch) => update({ showSearch })}
                label="Show search block"
                description="Global content search entry point."
              />
              <Toggle
                checked={draft.showQuickStats}
                onChange={(showQuickStats) => update({ showQuickStats })}
                label="Show quick stats"
                description="Attempts, average score and study streak in the greeting area."
              />
              <Field label="Greeting template" help="{name} is replaced with the student's display name.">
                <input
                  className="ec-field"
                  value={draft.greetingTemplate}
                  onChange={(event) => update({ greetingTemplate: event.target.value })}
                />
              </Field>
            </div>
          </Panel>

          <Panel
            title="Sections"
            description="Drag to reorder, or use the arrow buttons. Hidden sections are omitted without gaps."
            action={
              <div className="flex items-center gap-2">
                <select className="ec-field !py-1.5 !text-xs !w-auto" value={addType} onChange={(event) => setAddType(event.target.value as HomeSectionType)}>
                  {HOME_SECTION_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {HOME_SECTION_LABELS[type]}
                    </option>
                  ))}
                </select>
                <button type="button" onClick={addSection} className="ec-btn px-2.5 py-1.5 text-xs font-semibold bg-brand-600 text-white">
                  Add
                </button>
              </div>
            }
          >
            <div className="space-y-2">
              {sections.map((section, index) => {
                const expanded = editingId === section.id;
                return (
                  <div
                    key={section.id}
                    draggable
                    onDragStart={() => setDragIndex(index)}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={() => handleDrop(index)}
                    className={`rounded-xl border transition ${
                      expanded ? 'border-brand-300 bg-brand-50/20' : 'border-ink-200 bg-[var(--ec-surface)]'
                    } ${dragIndex === index ? 'opacity-60' : ''}`}
                  >
                    <div className="flex items-center gap-2 px-3 py-2.5">
                      <span className="cursor-grab text-ink-400 text-xs select-none" title="Drag to reorder">⠿</span>
                      <span className="h-7 w-7 rounded-lg bg-ink-100 text-ink-700 grid place-items-center text-xs">
                        {SECTION_ICONS[section.type]}
                      </span>
                      <button type="button" onClick={() => setEditingId(expanded ? null : section.id)} className="flex-1 min-w-0 text-left">
                        <span className="flex items-center gap-2">
                          <span className="text-sm font-semibold truncate">
                            {section.title || HOME_SECTION_LABELS[section.type]}
                          </span>
                          {!section.visible && <StatusPill tone="neutral">Hidden</StatusPill>}
                          {section.audience !== 'all' && <StatusPill tone="info">{section.audience}</StatusPill>}
                          {section.type === 'hero' && <StatusPill tone="brand">Hero</StatusPill>}
                        </span>
                        <span className="text-[10px] text-ink-500">
                          {HOME_SECTION_LABELS[section.type]} · {section.layout} · limit {section.limit}
                        </span>
                      </button>
                      <div className="flex items-center gap-1">
                        <button type="button" onClick={() => setSections(moveSection(sections, index, index - 1))} disabled={index === 0} className="h-7 w-7 rounded-lg border border-ink-200 text-xs disabled:opacity-30" aria-label="Move up">↑</button>
                        <button type="button" onClick={() => setSections(moveSection(sections, index, index + 1))} disabled={index === sections.length - 1} className="h-7 w-7 rounded-lg border border-ink-200 text-xs disabled:opacity-30" aria-label="Move down">↓</button>
                        <button type="button" onClick={() => duplicateSection(section)} className="h-7 px-2 rounded-lg border border-ink-200 text-[10px] font-semibold" title="Duplicate">Copy</button>
                        <button type="button" onClick={() => setDeleteId(section.id)} className="h-7 w-7 rounded-lg border border-red-200 text-red-600 text-xs" aria-label="Delete">✕</button>
                      </div>
                    </div>

                    {expanded && (
                      <div className="border-t border-ink-100 p-3 space-y-3">
                        <div className="grid sm:grid-cols-2 gap-3">
                          <Field label="Section type">
                            <select
                              className="ec-field"
                              value={section.type}
                              onChange={(event) => patchSection(section.id, { type: event.target.value as HomeSectionType })}
                            >
                              {HOME_SECTION_TYPES.map((type) => (
                                <option key={type} value={type}>{HOME_SECTION_LABELS[type]}</option>
                              ))}
                            </select>
                          </Field>
                          <Field label="Audience">
                            <select
                              className="ec-field"
                              value={section.audience}
                              onChange={(event) => patchSection(section.id, { audience: event.target.value as HomeSectionConfig['audience'] })}
                            >
                              {AUDIENCE_TARGETS.map((target) => (
                                <option key={target.value} value={target.value}>{target.label}</option>
                              ))}
                            </select>
                          </Field>
                          <Field label="Title">
                            <input className="ec-field" value={section.title} onChange={(event) => patchSection(section.id, { title: event.target.value })} />
                          </Field>
                          <Field label="Subtitle">
                            <input className="ec-field" value={section.subtitle} onChange={(event) => patchSection(section.id, { subtitle: event.target.value })} />
                          </Field>
                          <Field label="Layout">
                            <select
                              className="ec-field"
                              value={section.layout}
                              onChange={(event) => patchSection(section.id, { layout: event.target.value as HomeSectionConfig['layout'] })}
                            >
                              <option value="grid">Grid</option>
                              <option value="carousel">Carousel</option>
                              <option value="split">Split</option>
                              <option value="banner">Banner</option>
                              <option value="list">List</option>
                            </select>
                          </Field>
                          <Field label="Item limit" help="1–24 items after filtering.">
                            <input
                              type="number"
                              min={1}
                              max={24}
                              className="ec-field"
                              value={section.limit}
                              onChange={(event) => patchSection(section.id, { limit: Number(event.target.value) })}
                            />
                          </Field>
                          <Field label="CTA label">
                            <input className="ec-field" value={section.ctaLabel} onChange={(event) => patchSection(section.id, { ctaLabel: event.target.value })} />
                          </Field>
                          <Field label="CTA link">
                            <input className="ec-field" value={section.ctaHref} placeholder="/lectures" onChange={(event) => patchSection(section.id, { ctaHref: event.target.value })} />
                          </Field>
                        </div>

                        {(section.type === 'custom' || section.type === 'promo') && (
                          <div className="grid sm:grid-cols-2 gap-3">
                            <Field label="Body copy">
                              <textarea className="ec-field" rows={4} value={section.body} onChange={(event) => patchSection(section.id, { body: event.target.value })} />
                            </Field>
                            <Field label="Image URL">
                              <input className="ec-field" value={section.imageUrl} placeholder="https://…" onChange={(event) => patchSection(section.id, { imageUrl: event.target.value })} />
                            </Field>
                          </div>
                        )}

                        {(section.type === 'hero' || section.type === 'custom' || section.type === 'promo') && (
                          <Field label="Accent colour" help="Optional. Leave empty to inherit the brand colour.">
                            <div className="flex items-center gap-2">
                              <input
                                type="color"
                                value={section.accent || '#2563eb'}
                                onChange={(event) => patchSection(section.id, { accent: event.target.value })}
                                className="h-9 w-11 rounded-lg border border-ink-200 p-1"
                              />
                              <input className="ec-field font-mono text-xs" value={section.accent} placeholder="#2563eb" onChange={(event) => patchSection(section.id, { accent: event.target.value })} />
                            </div>
                          </Field>
                        )}

                        {(section.type === 'featured_batches' || section.type === 'featured_series' || section.type === 'popular_lectures') && (
                          <FeaturedItemsPicker
                            type={section.type}
                            selected={section.itemIds || []}
                            onChange={(itemIds) => patchSection(section.id, { itemIds })}
                          />
                        )}

                        <Toggle
                          checked={section.visible}
                          onChange={(visible) => patchSection(section.id, { visible })}
                          label="Visible on the student homepage"
                          description="Hidden sections are skipped entirely, so no empty gaps remain."
                        />
                      </div>
                    )}
                  </div>
                );
              })}
              {sections.length === 0 && (
                <Banner tone="warning" title="No sections yet">
                  Add at least one section. You can also hide the whole homepage by disabling student navigation features.
                </Banner>
              )}
            </div>
          </Panel>
        </div>

        <div className="xl:sticky xl:top-[76px] space-y-3">
          <PreviewFrame device={device} onDevice={setDevice} label="Order preview" hint="Wireframe only — real data renders on /home.">
            <HomeWireframe sections={sections} showGreeting={draft.showGreeting} />
          </PreviewFrame>
          <div className="ec-card p-4 text-[11px] text-ink-500 space-y-1.5">
            <p className="font-semibold text-ink-700">Empty sections are safe</p>
            <p>Each section checks for real content. If there are no active tests, banners or events, it disappears rather than leaving a blank card.</p>
            <p className="pt-1">Featured pickers use content published for the student&apos;s exam and class.</p>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={Boolean(deleteId)}
        title="Remove this section?"
        description="This removes it from the draft. Publish afterwards to update the live homepage."
        confirmLabel="Remove section"
        onCancel={() => setDeleteId(null)}
        onConfirm={() => {
          if (deleteId) setSections(sections.filter((section) => section.id !== deleteId));
          setDeleteId(null);
          if (editingId === deleteId) setEditingId(null);
        }}
      />
    </div>
  );
}

function FeaturedItemsPicker({
  type,
  selected,
  onChange,
}: {
  type: HomeSectionConfig['type'];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const kind = type === 'featured_batches' ? 'batch' : type === 'featured_series' ? 'series' : 'lecture';
  const [items, setItems] = useState<CourseCatalogItem[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getAdminContentList({ kind })
      .then((data) => {
        if (!cancelled) setItems(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Unable to load content.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [kind]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items.slice(0, 30);
    return items.filter((item) => item.title.toLowerCase().includes(q)).slice(0, 30);
  }, [items, query]);

  return (
    <Field
      label="Featured content"
      help="Leave empty to automatically use the newest active content for the student's exam and class."
    >
      {error && <p className="text-[11px] text-red-600 mb-1">{error}</p>}
      <input className="ec-field mb-2" placeholder={`Search ${kind}s…`} value={query} onChange={(event) => setQuery(event.target.value)} />
      <div className="max-h-44 overflow-y-auto rounded-xl border border-ink-200 divide-y divide-ink-100">
        {loading && <p className="p-3 text-xs text-ink-500">Loading {kind}s…</p>}
        {!loading && filtered.length === 0 && <p className="p-3 text-xs text-ink-500">No {kind}s found.</p>}
        {filtered.map((item) => {
          const active = selected.includes(item.id);
          return (
            <label key={item.id} className="flex items-center gap-2 px-3 py-2 text-xs cursor-pointer hover:bg-ink-50">
              <input
                type="checkbox"
                checked={active}
                onChange={() =>
                  onChange(active ? selected.filter((id) => id !== item.id) : [...selected, item.id])
                }
              />
              <span className="flex-1 truncate">{item.title}</span>
              <StatusPill tone={item.active ? 'success' : 'neutral'}>{item.active ? 'Live' : 'Hidden'}</StatusPill>
            </label>
          );
        })}
      </div>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {selected.map((id) => {
            const item = items.find((entry) => entry.id === id);
            return (
              <span key={id} className="inline-flex items-center gap-1 rounded-full bg-brand-50 border border-brand-100 px-2 py-0.5 text-[10px] text-brand-700">
                {item?.title || id.slice(0, 8)}
                <button type="button" onClick={() => onChange(selected.filter((entry) => entry !== id))} aria-label="Remove">
                  ✕
                </button>
              </span>
            );
          })}
        </div>
      )}
    </Field>
  );
}

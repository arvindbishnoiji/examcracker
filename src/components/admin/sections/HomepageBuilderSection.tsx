'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { CourseCatalogItem, HomeHeroConfig, HomepageConfig, HomeSectionConfig, HomeSectionItem, HomeSectionType } from '@/types';
import { useSettingWorkspace } from '@/hooks/useSettingWorkspace';
import { useSiteConfig } from '@/context/SiteConfigContext';
import {
  AUDIENCE_TARGETS,
  createHomeSection,
  DEFAULT_FEATURE_ITEMS,
  DEFAULT_STEP_ITEMS,
  HOME_HERO_STYLES,
  HOME_ITEM_SECTION_TYPES,
  HOME_SECTION_LABELS,
  HOME_SECTION_TYPES,
  makeId,
  moveSection,
} from '@/lib/site-config';
import { getAdminContentList } from '@/lib/api';
import { Search } from 'lucide-react';
import {
  ClassicSection,
  FeatureCards,
  HomeHero,
  HomeStatsPanel,
  ProfileChips,
  StepCards,
  visibleItems,
} from '@/components/home/ClassicHome';
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
  dashboard_banners: '▭',
  feature_grid: '▦',
  how_it_works: '①',
  batch_showcase: '◫',
};

/** Where the data for each section comes from — shown in the editor. */
const SECTION_SOURCE: Partial<Record<HomeSectionType, { text: string; href?: string; link?: string }>> = {
  hero: { text: 'Shows banners placed on “Home hero”.', href: '/admin/banners', link: 'Manage banners' },
  dashboard_banners: { text: 'Shows banners placed on “Dashboard card”.', href: '/admin/banners', link: 'Manage banners' },
  batch_showcase: { text: 'Cards, layout and copy come from Batch Studio. Leave the title empty to use Batch Studio’s heading.', href: '/admin/batch-studio', link: 'Open Batch Studio' },
  goal: { text: "Shows active Today's goals.", href: '/admin/goals', link: "Manage today's goals" },
  featured_batches: { text: 'Shows active batches for the student’s exam and class.', href: '/admin/batches', link: 'Manage batches' },
  featured_series: { text: 'Shows active series for the student’s exam and class.', href: '/admin/series', link: 'Manage series' },
  testimonials: { text: 'Shows active testimonials.', href: '/admin/testimonials', link: 'Manage testimonials' },
  challenges: { text: 'Shows active, scheduled challenges.', href: '/admin/challenges', link: 'Manage challenges' },
  quick_links: { text: 'Uses the visible header navigation links.', href: '/admin/navigation', link: 'Edit navigation' },
  announcements: { text: 'Shows published announcements.', href: '/admin/notifications', link: 'Manage announcements' },
  feature_grid: { text: 'Cards are edited below. Cards linking to a feature that is switched off in Feature Toggles are hidden automatically.' },
  how_it_works: { text: 'Steps are edited below. The badge text is optional — leave it empty to number steps automatically.' },
  events: { text: 'Shows upcoming events.', href: '/admin/events', link: 'Manage events' },
};

const SAMPLE_TOKENS = { name: 'Aarav', exam: 'JEE', classLabel: 'Class 12' };

function SectionPreview({ section }: { section: HomeSectionConfig }) {
  if (HOME_ITEM_SECTION_TYPES.includes(section.type)) {
    const items = visibleItems(section.items);
    if (!items.length) {
      return (
        <ClassicSection section={section}>
          <p className="rounded-lg border border-dashed border-ink-200 p-3 text-center text-[11px] text-ink-500">No visible cards — hidden for students.</p>
        </ClassicSection>
      );
    }
    return (
      <ClassicSection section={section}>
        {section.type === 'feature_grid' ? <FeatureCards section={section} items={items} /> : <StepCards section={section} items={items} />}
      </ClassicSection>
    );
  }
  if (section.type === 'promo' || section.type === 'custom') {
    return (
      <ClassicSection section={section} title={section.type === 'promo' ? '' : undefined} subtitle={section.type === 'promo' ? '' : undefined}>
        <div
          className="ecc-card p-4"
          style={section.type === 'promo' ? { background: section.accent || 'var(--ec-brand)', color: '#fff', borderColor: 'transparent' } : undefined}
        >
          {section.type === 'promo' && section.title && <p className="font-extrabold">{section.title}</p>}
          <p className="mt-1 line-clamp-3 whitespace-pre-line text-xs opacity-90">{section.body || 'Add body text or an image.'}</p>
        </div>
      </ClassicSection>
    );
  }
  const banner = section.type === 'hero' || section.type === 'dashboard_banners' || section.type === 'batch_showcase';
  return (
    <ClassicSection section={section} title={section.title || (banner ? HOME_SECTION_LABELS[section.type] : '')}>
      {banner ? (
        <div className="grid h-20 place-items-center rounded-lg border border-dashed border-ink-200 bg-ink-50 text-[11px] font-semibold text-ink-500">
          {HOME_SECTION_LABELS[section.type]} · live data
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {[0, 1, 2].map((item) => (
            <div key={item} className="ecc-card h-14 p-2">
              <div className="h-2 w-3/4 rounded bg-ink-100" />
              <div className="mt-1.5 h-1.5 w-1/2 rounded bg-ink-100" />
            </div>
          ))}
        </div>
      )}
    </ClassicSection>
  );
}

function HomeLivePreview({
  draft,
  device,
}: {
  draft: HomepageConfig;
  device: PreviewDevice;
}) {
  const visible = draft.sections.filter((section) => section.visible);
  return (
    <div className={`ecc-page rounded-xl bg-[var(--ec-bg)] p-3 ${device === 'mobile' ? '!gap-5' : ''}`} style={{ fontSize: device === 'mobile' ? 13 : 14 }}>
      {draft.showGreeting ? (
        <HomeHero
          hero={draft.hero}
          tokens={SAMPLE_TOKENS}
          greeting={draft.greetingTemplate.replace(/\{name\}/g, SAMPLE_TOKENS.name)}
          primary={{ label: draft.hero.primaryCtaLabel || 'Continue learning', href: draft.hero.primaryCtaHref || '/lectures' }}
          secondary={draft.hero.showSecondaryCta ? { label: draft.hero.secondaryCtaLabel || 'Next test', href: draft.hero.secondaryCtaHref || '/tests' } : null}
          chips={<ProfileChips exam="JEE" classLabel="Class 12" unlocked={2} />}
          aside={
            draft.showQuickStats && device === 'desktop' ? (
              <HomeStatsPanel
                title="12 tests · 48 lessons"
                badge="Rising"
                percent={68}
                stats={[
                  { label: 'Tests', value: '12' },
                  { label: 'Lessons', value: '48' },
                  { label: 'Watch time', value: '31h' },
                  { label: 'Day streak', value: '6' },
                ]}
              />
            ) : undefined
          }
        />
      ) : (
        <p className="rounded-lg border border-dashed border-ink-200 p-3 text-center text-[11px] text-ink-500">Welcome panel hidden</p>
      )}
      {draft.showSearch && (
        <div className="ecc-search">
          <Search size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-400" />
          <input readOnly placeholder="Search lectures, tests, batches…" aria-label="Search preview" />
        </div>
      )}
      {visible.map((section) => (
        <SectionPreview key={section.id} section={section} />
      ))}
    </div>
  );
}

function ItemsEditor({
  section,
  onChange,
}: {
  section: HomeSectionConfig;
  onChange: (items: HomeSectionItem[]) => void;
}) {
  const items = section.items || [];
  const isSteps = section.type === 'how_it_works';
  function patch(id: string, next: Partial<HomeSectionItem>) {
    onChange(items.map((item) => (item.id === id ? { ...item, ...next } : item)));
  }
  function move(from: number, to: number) {
    if (to < 0 || to >= items.length) return;
    const next = [...items];
    const [entry] = next.splice(from, 1);
    next.splice(to, 0, entry);
    onChange(next);
  }
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-ink-700">{isSteps ? 'Steps' : 'Cards'} ({items.length})</p>
        <button
          type="button"
          onClick={() => onChange((isSteps ? DEFAULT_STEP_ITEMS : DEFAULT_FEATURE_ITEMS).map((item) => ({ ...item, id: makeId('item') })))}
          className="text-[11px] font-semibold text-ink-500 hover:underline"
        >
          Restore defaults
        </button>
      </div>
      {items.map((item, index) => (
        <div key={item.id} className={`rounded-lg border p-2.5 ${item.visible ? 'border-ink-200' : 'border-dashed border-ink-200 opacity-60'}`}>
          <div className="grid gap-2 sm:grid-cols-[64px_minmax(0,1fr)_minmax(0,1fr)]">
            <input
              className="ec-field text-center"
              value={item.icon}
              maxLength={8}
              placeholder={isSteps ? String(index + 1) : '📚'}
              aria-label="Badge / icon"
              onChange={(event) => patch(item.id, { icon: event.target.value })}
            />
            <input className="ec-field" value={item.title} placeholder="Title" aria-label="Title" onChange={(event) => patch(item.id, { title: event.target.value })} />
            <input className="ec-field" value={item.href} placeholder="/lectures (optional)" aria-label="Link" onChange={(event) => patch(item.id, { href: event.target.value })} />
          </div>
          <textarea
            className="ec-field mt-2"
            rows={2}
            value={item.body}
            placeholder="Short description"
            aria-label="Description"
            onChange={(event) => patch(item.id, { body: event.target.value })}
          />
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <label className="mr-auto inline-flex items-center gap-1.5 text-[11px] font-semibold text-ink-600">
              <input type="checkbox" checked={item.visible} onChange={(event) => patch(item.id, { visible: event.target.checked })} />
              Visible
            </label>
            <button type="button" onClick={() => move(index, index - 1)} disabled={index === 0} className="h-7 w-7 rounded-lg border border-ink-200 text-xs disabled:opacity-30" aria-label="Move card up">↑</button>
            <button type="button" onClick={() => move(index, index + 1)} disabled={index === items.length - 1} className="h-7 w-7 rounded-lg border border-ink-200 text-xs disabled:opacity-30" aria-label="Move card down">↓</button>
            <button type="button" onClick={() => onChange(items.filter((entry) => entry.id !== item.id))} className="h-7 w-7 rounded-lg border border-red-200 text-xs text-red-600" aria-label="Remove card">✕</button>
          </div>
        </div>
      ))}
      {items.length < 24 && (
        <button
          type="button"
          onClick={() => onChange([...items, { id: makeId('item'), icon: '', title: isSteps ? 'New step' : 'New card', body: '', href: '', visible: true }])}
          className="text-xs font-semibold text-brand-600 hover:underline"
        >
          + Add {isSteps ? 'step' : 'card'}
        </button>
      )}
    </div>
  );
}

function HeroEditor({
  hero,
  onChange,
}: {
  hero: HomeHeroConfig;
  onChange: (patch: Partial<HomeHeroConfig>) => void;
}) {
  const { config } = useSiteConfig();
  return (
    <div className="space-y-4">
      <Field label="Panel style">
        <Segmented options={HOME_HERO_STYLES} value={hero.style} onChange={(style) => onChange({ style })} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Small label above heading" help="Tokens: {name}, {exam}, {class}.">
          <input className="ec-field" value={hero.eyebrow} placeholder="{exam} · {class}" onChange={(event) => onChange({ eyebrow: event.target.value })} />
        </Field>
        <Field label="Background colour" help="Empty = theme brand colour.">
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={hero.backgroundColor || config.theme.primaryColor || '#1e40af'}
              onChange={(event) => onChange({ backgroundColor: event.target.value })}
              className="h-10 w-11 shrink-0 cursor-pointer rounded-lg border border-ink-200 p-1"
              aria-label="Hero background colour"
            />
            <input
              className="ec-field font-mono text-xs"
              value={hero.backgroundColor}
              placeholder="Brand colour"
              onChange={(event) => onChange({ backgroundColor: event.target.value })}
            />
            {hero.backgroundColor && (
              <button type="button" onClick={() => onChange({ backgroundColor: '' })} className="shrink-0 text-[11px] font-semibold text-ink-500 hover:underline">
                Reset
              </button>
            )}
          </div>
        </Field>
      </div>
      <Field label="Heading" required help="Tokens: {name}, {exam}, {class}.">
        <input className="ec-field" value={hero.title} onChange={(event) => onChange({ title: event.target.value })} />
      </Field>
      <Field label="Description">
        <textarea className="ec-field" rows={3} value={hero.subtitle} onChange={(event) => onChange({ subtitle: event.target.value })} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Main button text" help="Empty = “Continue learning” / “Start learning”.">
          <input className="ec-field" value={hero.primaryCtaLabel} placeholder="Automatic" onChange={(event) => onChange({ primaryCtaLabel: event.target.value })} />
        </Field>
        <Field label="Main button link" help="Empty = the student’s last lecture.">
          <input className="ec-field" value={hero.primaryCtaHref} placeholder="Automatic" onChange={(event) => onChange({ primaryCtaHref: event.target.value })} />
        </Field>
      </div>
      <Toggle
        checked={hero.showSecondaryCta}
        onChange={(showSecondaryCta) => onChange({ showSecondaryCta })}
        label="Show second button"
        description="By default it opens the live or next test."
      />
      {hero.showSecondaryCta && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Second button text" help="Empty = “Live test now” / “Next test”.">
            <input className="ec-field" value={hero.secondaryCtaLabel} placeholder="Automatic" onChange={(event) => onChange({ secondaryCtaLabel: event.target.value })} />
          </Field>
          <Field label="Second button link" help="Empty = the live or next test.">
            <input className="ec-field" value={hero.secondaryCtaHref} placeholder="Automatic" onChange={(event) => onChange({ secondaryCtaHref: event.target.value })} />
          </Field>
        </div>
      )}
      <Field
        label="Image URL"
        help={hero.style === 'image' ? 'Required for this style — used as the panel background.' : 'Optional — shown on the right when quick stats are off.'}
      >
        <input className="ec-field" value={hero.imageUrl} placeholder="https://…" onChange={(event) => onChange({ imageUrl: event.target.value })} />
      </Field>
      <Toggle
        checked={hero.showProfileChips}
        onChange={(showProfileChips) => onChange({ showProfileChips })}
        label="Show exam / class chips"
        description="Small chips under the buttons with the student’s exam, class and unlocked courses."
      />
    </div>
  );
}

export function HomepageBuilderSection() {
  const workspace = useSettingWorkspace('homepage');
  const { draft, update, loading } = workspace;
  const [addType, setAddType] = useState<HomeSectionType>('feature_grid');
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

  function patchHero(patch: Partial<HomeHeroConfig>) {
    update({ hero: { ...draft.hero, ...patch } });
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
      title: section.title ? `${section.title} (copy)` : '',
      items: (section.items || []).map((item) => ({ ...item, id: makeId('item') })),
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

  if (loading) return <Spinner label="Loading home screen…" />;

  return (
    <div>
      <AdminPageHeader
        eyebrow="Screen Studio"
        title="Home Screen Builder"
        description="Everything on the student home screen is edited here: the welcome panel (heading, text, buttons, colour, image), search, and every block below it — banners, feature cards, steps, batches, tests, events and more. Reorder, hide, target by exam/class, then publish."
        meta={
          <>
            <StatusPill tone="brand">{sections.length} sections</StatusPill>
            <StatusPill tone="success">{visibleCount} visible</StatusPill>
            <StatusPill tone="neutral">{draft.showGreeting ? 'Welcome panel on' : 'Welcome panel off'}</StatusPill>
          </>
        }
        actions={
          <>
            <Link href="/admin/screens" className="ec-btn px-3 py-2 text-xs font-semibold border border-ink-200 hover:bg-ink-50">
              Screen Studio
            </Link>
            <a href="/home" target="_blank" className="ec-btn px-3 py-2 text-xs font-semibold border border-ink-200 hover:bg-ink-50">
              View home screen ↗
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

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_480px] mt-5 items-start">
        <div className="space-y-5">
          <Panel title="Welcome panel" description="The top panel students see first. Changes show instantly in the preview.">
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <Toggle
                  checked={draft.showGreeting}
                  onChange={(showGreeting) => update({ showGreeting })}
                  label="Show welcome panel"
                  description="Turn off to start the home screen directly with the sections."
                />
                <Toggle
                  checked={draft.showQuickStats}
                  onChange={(showQuickStats) => update({ showQuickStats })}
                  label="Show progress box"
                  description="Tests, lessons, watch time, streak and average score."
                />
              </div>
              <Field label="Greeting line" help="{name} is replaced with the student's first name. Shown above the heading.">
                <input className="ec-field" value={draft.greetingTemplate} onChange={(event) => update({ greetingTemplate: event.target.value })} />
              </Field>
              <HeroEditor hero={draft.hero} onChange={patchHero} />
            </div>
          </Panel>

          <Panel title="Search bar" description="Search box under the welcome panel.">
            <Toggle
              checked={draft.showSearch}
              onChange={(showSearch) => update({ showSearch })}
              label="Show search bar"
              description="Also requires the Search feature in Feature Toggles. Placeholder text is set in Search & SEO."
            />
          </Panel>

          <Panel
            title="Sections"
            description="Drag to reorder, or use the arrows. Sections without live content are skipped automatically, so students never see empty boxes."
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
                const source = SECTION_SOURCE[section.type];
                const itemSection = HOME_ITEM_SECTION_TYPES.includes(section.type);
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
                        </span>
                        <span className="text-[10px] text-ink-500">
                          {HOME_SECTION_LABELS[section.type]}
                          {itemSection ? ` · ${(section.items || []).length} cards` : ` · limit ${section.limit}`}
                        </span>
                      </button>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => patchSection(section.id, { visible: !section.visible })}
                          className="h-7 px-2 rounded-lg border border-ink-200 text-[10px] font-semibold"
                          title={section.visible ? 'Hide section' : 'Show section'}
                        >
                          {section.visible ? 'Hide' : 'Show'}
                        </button>
                        <button type="button" onClick={() => setSections(moveSection(sections, index, index - 1))} disabled={index === 0} className="h-7 w-7 rounded-lg border border-ink-200 text-xs disabled:opacity-30" aria-label="Move up">↑</button>
                        <button type="button" onClick={() => setSections(moveSection(sections, index, index + 1))} disabled={index === sections.length - 1} className="h-7 w-7 rounded-lg border border-ink-200 text-xs disabled:opacity-30" aria-label="Move down">↓</button>
                        <button type="button" onClick={() => duplicateSection(section)} className="h-7 px-2 rounded-lg border border-ink-200 text-[10px] font-semibold" title="Duplicate">Copy</button>
                        <button type="button" onClick={() => setDeleteId(section.id)} className="h-7 w-7 rounded-lg border border-red-200 text-red-600 text-xs" aria-label="Delete">✕</button>
                      </div>
                    </div>

                    {expanded && (
                      <div className="border-t border-ink-100 p-3 space-y-3">
                        {source && (
                          <p className="rounded-lg bg-ink-50 px-3 py-2 text-[11px] leading-relaxed text-ink-600">
                            {source.text}{' '}
                            {source.href && (
                              <Link href={source.href} className="font-semibold text-brand-700 hover:underline">
                                {source.link} →
                              </Link>
                            )}
                          </p>
                        )}
                        <div className="grid sm:grid-cols-2 gap-3">
                          <Field label="Section type">
                            <select
                              className="ec-field"
                              value={section.type}
                              onChange={(event) => {
                                const type = event.target.value as HomeSectionType;
                                const needsItems = HOME_ITEM_SECTION_TYPES.includes(type) && !(section.items || []).length;
                                patchSection(section.id, needsItems ? { type, items: createHomeSection(type).items } : { type });
                              }}
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
                          {(section.type === 'feature_grid' || section.type === 'custom') && (
                            <Field label="Layout">
                              <select
                                className="ec-field"
                                value={section.layout === 'list' ? 'list' : 'grid'}
                                onChange={(event) => patchSection(section.id, { layout: event.target.value as HomeSectionConfig['layout'] })}
                              >
                                <option value="grid">Cards grid</option>
                                <option value="list">Simple list</option>
                              </select>
                            </Field>
                          )}
                          <Field label="Item limit" help="Maximum items shown (1–24).">
                            <input
                              type="number"
                              min={1}
                              max={24}
                              className="ec-field"
                              value={section.limit}
                              onChange={(event) => patchSection(section.id, { limit: Number(event.target.value) })}
                            />
                          </Field>
                          <Field label="Link text (top-right)" help="Optional, e.g. “View all”.">
                            <input className="ec-field" value={section.ctaLabel} onChange={(event) => patchSection(section.id, { ctaLabel: event.target.value })} />
                          </Field>
                          <Field label="Link destination">
                            <input className="ec-field" value={section.ctaHref} placeholder="/lectures" onChange={(event) => patchSection(section.id, { ctaHref: event.target.value })} />
                          </Field>
                        </div>

                        {itemSection && (
                          <ItemsEditor section={section} onChange={(items) => patchSection(section.id, { items })} />
                        )}

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

                        {(section.type !== 'hero' && section.type !== 'dashboard_banners' && section.type !== 'batch_showcase') && (
                          <Field label={section.type === 'promo' ? 'Card colour' : 'Heading underline colour'} help="Optional. Leave empty to inherit the brand colour.">
                            <div className="flex items-center gap-2">
                              <input
                                type="color"
                                value={section.accent || '#2563eb'}
                                onChange={(event) => patchSection(section.id, { accent: event.target.value })}
                                className="h-9 w-11 rounded-lg border border-ink-200 p-1"
                              />
                              <input className="ec-field font-mono text-xs" value={section.accent} placeholder="Brand colour" onChange={(event) => patchSection(section.id, { accent: event.target.value })} />
                              {section.accent && (
                                <button type="button" onClick={() => patchSection(section.id, { accent: '' })} className="shrink-0 text-[11px] font-semibold text-ink-500 hover:underline">
                                  Reset
                                </button>
                              )}
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
                          label="Visible on the student home screen"
                          description="Hidden sections are skipped entirely, so no empty gaps remain."
                        />
                      </div>
                    )}
                  </div>
                );
              })}
              {sections.length === 0 && (
                <Banner tone="warning" title="No sections yet">
                  Add at least one section, or use “Reset” in the publish bar to restore the classic default layout.
                </Banner>
              )}
            </div>
          </Panel>
        </div>

        <div className="xl:sticky xl:top-[76px] space-y-3">
          <PreviewFrame device={device} onDevice={setDevice} label="Live preview" hint="Your draft with sample student data. Live data sections show placeholders.">
            <div className="max-h-[78vh] overflow-y-auto">
              <HomeLivePreview draft={draft} device={device} />
            </div>
          </PreviewFrame>
          <div className="ec-card p-4 text-[11px] text-ink-500 space-y-1.5">
            <p className="font-semibold text-ink-700">Save → Publish</p>
            <p>“Save draft” keeps your changes private. “Publish” updates the home screen for every student immediately.</p>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={Boolean(deleteId)}
        title="Remove this section?"
        description="This removes it from the draft. Publish afterwards to update the live home screen."
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

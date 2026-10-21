'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import type { OnboardingFeature, ScreenSectionConfig, SiteConfig } from '@/types';
import { useSettingWorkspace } from '@/hooks/useSettingWorkspace';
import {
  SCREEN_DEFINITIONS,
  findScreenBySlug,
  screenHref,
  type ScreenDefinition,
  type ScreenKey,
} from '@/lib/screen-config';
import { isSafeHttpUrl, isValidInternalDeepLink } from '@/lib/validation';
import { AdminPageHeader, Banner, ConfirmDialog, Field, Panel, Spinner, StatusPill, Toggle } from '../ui';
import { PreviewFrame, type PreviewDevice } from '../PreviewFrame';
import { SettingsPublishBar } from '../SettingsPublishBar';
import { StringListEditor } from '../ListEditors';
import { ScreenPreview } from './ScreenPreview';
import { announcementGroup, screenFieldGroups, type ScreenField } from './screenFields';

type EditorTab = 'content' | 'layout' | 'sections' | 'messages' | 'banner';

function readPath(source: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (!acc || typeof acc !== 'object') return undefined;
    return (acc as Record<string, unknown>)[key];
  }, source);
}

function setPath<T>(source: T, path: string, value: unknown): T {
  const [head, ...rest] = path.split('.');
  const base: Record<string, unknown> = Array.isArray(source)
    ? { ...(source as unknown as Record<string, unknown>) }
    : { ...((source as Record<string, unknown>) || {}) };
  if (!rest.length) {
    base[head] = value;
  } else {
    base[head] = setPath(base[head], rest.join('.'), value);
  }
  return base as T;
}

function liveHref(definition: ScreenDefinition): string {
  return definition.route.includes('[') ? definition.route.slice(0, definition.route.indexOf('/[')) : definition.route;
}

function ScreenNotFound({ slug }: { slug: string }) {
  return (
    <div className="mx-auto max-w-lg py-16 text-center">
      <p className="text-4xl" aria-hidden>🧭</p>
      <h1 className="mt-3 text-xl font-bold">Screen not found</h1>
      <p className="mt-1 text-sm text-ink-500">“{slug}” is not a student screen you can manage here.</p>
      <Link
        href="/admin/screens"
        className="ec-btn mt-5 inline-flex bg-brand-600 px-4 py-2 text-sm font-semibold text-white"
      >
        Back to Screen Studio
      </Link>
    </div>
  );
}

export function ScreenEditor({ slug }: { slug: string }) {
  const definition = findScreenBySlug(slug);
  if (!definition) return <ScreenNotFound slug={slug} />;
  return <ScreenEditorInner key={definition.key} definition={definition} />;
}

function ScreenEditorInner({ definition }: { definition: ScreenDefinition }) {
  const workspace = useSettingWorkspace(definition.key);
  const { draft, update, loading, dirty, setDraft } = workspace;
  const router = useRouter();
  const [tab, setTab] = useState<EditorTab>('content');
  const [device, setDevice] = useState<PreviewDevice>('desktop');
  const [pendingScreen, setPendingScreen] = useState<string | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  const groups = useMemo(() => screenFieldGroups(definition.key), [definition.key]);
  const groupById = useMemo(() => new Map(groups.map((group) => [group.id, group])), [groups]);
  const tabs: Array<{ id: EditorTab; label: string }> = useMemo(() => {
    const list: Array<{ id: EditorTab; label: string }> = [{ id: 'content', label: 'Content' }];
    if (groupById.has('display')) list.push({ id: 'layout', label: 'Display' });
    if (definition.sections.length) list.push({ id: 'sections', label: 'Sections' });
    list.push({ id: 'messages', label: 'Empty & help' });
    list.push({ id: 'banner', label: 'Banner' });
    return list;
  }, [definition.sections.length, groupById]);

  const base = draft as unknown as Record<string, unknown>;

  function goToScreen(nextSlug: string) {
    if (nextSlug === definition.slug) return;
    if (dirty) {
      setPendingScreen(nextSlug);
      return;
    }
    router.push(screenHref(nextSlug));
  }

  function fieldValue(field: ScreenField): unknown {
    return readPath(base, field.path);
  }

  function setField(field: ScreenField, value: unknown) {
    setDraft((previous) => setPath(previous, field.path, value));
  }

  function fieldError(field: ScreenField): string | undefined {
    const value = fieldValue(field);
    if (field.path === 'pageTitle' && (typeof value !== 'string' || !value.trim())) {
      return 'A page heading is required.';
    }
    if (field.type === 'number' && field.min !== undefined && field.max !== undefined) {
      const parsed = Number(value);
      if (!Number.isFinite(parsed) || parsed < field.min || parsed > field.max) {
        return `Enter a number between ${field.min} and ${field.max}.`;
      }
    }
    if (field.path === 'announcement.title') {
      const enabled = Boolean(readPath(base, 'announcement.enabled'));
      if (enabled && (typeof value !== 'string' || !value.trim())) {
        return 'A banner heading is required when the banner is shown.';
      }
    }
    if (field.path === 'announcement.ctaHref') {
      const ctaLabel = String(readPath(base, 'announcement.ctaLabel') || '').trim();
      const href = String(value || '').trim();
      if (ctaLabel && !href) return 'Add a destination for the banner button.';
      if (href && !isValidInternalDeepLink(href) && !isSafeHttpUrl(href)) {
        return 'Use an internal route such as /tests, or an https:// link.';
      }
    }
    if (field.type === 'text' && typeof value === 'string' && field.maxLength && value.length > field.maxLength) {
      return `${field.maxLength} characters or fewer.`;
    }
    return undefined;
  }

  function renderField(field: ScreenField) {
    const value = fieldValue(field);
    const error = fieldError(field);
    if (field.type === 'toggle') {
      return (
        <Toggle
          key={field.path}
          checked={Boolean(value)}
          onChange={(next) => setField(field, next)}
          label={field.label}
          description={field.help}
        />
      );
    }
    if (field.type === 'stringList') {
      return (
        <StringListEditor
          key={field.path}
          label={field.label}
          help={field.help}
          items={Array.isArray(value) ? (value as string[]) : []}
          onChange={(next) => setField(field, next)}
          max={field.max ?? 10}
          addLabel="Add item"
        />
      );
    }
    if (field.type === 'select') {
      return (
        <Field key={field.path} label={field.label} help={field.help} error={error}>
          <select
            className="ec-field"
            value={String(value ?? '')}
            onChange={(event) => setField(field, event.target.value)}
          >
            {(field.options || []).map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>
      );
    }
    if (field.type === 'textarea') {
      return (
        <Field key={field.path} label={field.label} help={field.help} error={error}>
          <textarea
            className="ec-field"
            rows={field.rows || 3}
            maxLength={field.maxLength}
            placeholder={field.placeholder}
            value={String(value ?? '')}
            onChange={(event) => setField(field, event.target.value)}
          />
        </Field>
      );
    }
    if (field.type === 'number') {
      return (
        <Field key={field.path} label={field.label} help={field.help} error={error}>
          <input
            type="number"
            className="ec-field"
            min={field.min}
            max={field.max}
            value={Number(value ?? 0)}
            onChange={(event) => setField(field, Number(event.target.value))}
          />
        </Field>
      );
    }
    return (
      <Field key={field.path} label={field.label} help={field.help} error={error}>
        <input
          className="ec-field"
          maxLength={field.maxLength}
          placeholder={field.placeholder}
          value={String(value ?? '')}
          onChange={(event) => setField(field, event.target.value)}
        />
      </Field>
    );
  }

  function renderGroup(groupId: string) {
    const group = groupById.get(groupId);
    if (!group) return null;
    return (
      <Panel key={group.id} title={group.title} description={group.description}>
        <div className="grid gap-4 sm:grid-cols-2">
          {group.fields.map((field) =>
            field.type === 'toggle' || field.type === 'textarea' || field.type === 'stringList' ? (
              <div key={field.path} className="sm:col-span-2">
                {renderField(field)}
              </div>
            ) : (
              <div key={field.path}>{renderField(field)}</div>
            )
          )}
        </div>
      </Panel>
    );
  }

  function patchSection(id: string, patch: Partial<ScreenSectionConfig>) {
    const sections = (base.sections as ScreenSectionConfig[]) || [];
    update({ sections: sections.map((item) => (item.id === id ? { ...item, ...patch } : item)) } as Partial<typeof draft>);
  }

  function moveSection(index: number, delta: number) {
    const sections = [...((base.sections as ScreenSectionConfig[]) || [])];
    const target = index + delta;
    if (target < 0 || target >= sections.length) return;
    const [item] = sections.splice(index, 1);
    sections.splice(target, 0, item);
    update({ sections } as Partial<typeof draft>);
  }

  function renderSections() {
    const sections = (base.sections as ScreenSectionConfig[]) || [];
    const definitions = new Map(definition.sections.map((item) => [item.id, item]));
    const reorderable = definition.reorderable !== false;
    return (
      <Panel
        title="Sections on this screen"
        description={
          reorderable
            ? 'Reorder with the arrow buttons. Hidden optional sections disappear completely — no empty gaps remain.'
            : 'Show or hide optional blocks. This screen has a fixed reading order, so ordering is controlled in code.'
        }
      >
        <div className="space-y-2">
          {sections.map((section, index) => {
            const meta = definitions.get(section.id);
            if (!meta) return null;
            return (
              <div key={section.id} className="rounded-xl border border-ink-200 bg-[var(--ec-surface)] p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-1.5 text-sm font-semibold">
                      {section.title || meta.label}
                      {meta.required ? <StatusPill tone="neutral">Always visible</StatusPill> : null}
                      {!section.visible ? <StatusPill tone="warning">Hidden</StatusPill> : null}
                    </p>
                    <p className="mt-0.5 text-[11px] text-ink-500">{meta.description}</p>
                  </div>
                  {reorderable ? (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => moveSection(index, -1)}
                        disabled={index === 0}
                        className="h-8 w-8 rounded-lg border border-ink-200 text-xs disabled:opacity-30"
                        aria-label={`Move ${meta.label} up`}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => moveSection(index, 1)}
                        disabled={index === sections.length - 1}
                        className="h-8 w-8 rounded-lg border border-ink-200 text-xs disabled:opacity-30"
                        aria-label={`Move ${meta.label} down`}
                      >
                        ↓
                      </button>
                    </div>
                  ) : (
                    <StatusPill tone="neutral">Fixed order</StatusPill>
                  )}
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <Field label="Section heading" help="Leave the default to use the shipped heading.">
                    <input
                      className="ec-field"
                      maxLength={120}
                      value={section.title}
                      onChange={(event) => patchSection(section.id, { title: event.target.value })}
                    />
                  </Field>
                  <Field label="Section description">
                    <input
                      className="ec-field"
                      maxLength={240}
                      value={section.subtitle}
                      onChange={(event) => patchSection(section.id, { subtitle: event.target.value })}
                    />
                  </Field>
                </div>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <p className="text-[11px] text-ink-500">
                    {meta.required
                      ? 'This section is required for the screen to work, so it stays visible.'
                      : 'Hidden sections are not rendered for students.'}
                  </p>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={section.visible}
                    aria-label={`${meta.label} visible`}
                    disabled={Boolean(meta.required)}
                    onClick={() => patchSection(section.id, { visible: !section.visible })}
                    className={`relative h-6 w-11 shrink-0 rounded-full transition ${
                      section.visible ? 'bg-brand-600' : 'bg-ink-300'
                    } ${meta.required ? 'cursor-not-allowed opacity-60' : ''}`}
                  >
                    <span
                      className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
                        section.visible ? 'left-[22px]' : 'left-0.5'
                      }`}
                    />
                  </button>
                </div>
              </div>
            );
          })}
          {sections.length === 0 ? (
            <Banner tone="info" title="This screen has no optional sections">
              Its heading, labels, empty states and banner are still fully editable.
            </Banner>
          ) : null}
        </div>
      </Panel>
    );
  }

  function renderOnboardingFeatures() {
    if (definition.key !== 'onboarding') return null;
    const features = (base.features as OnboardingFeature[]) || [];
    return (
      <Panel
        title="Welcome-panel highlights"
        description="Up to five short highlights shown beside the form. Required questions are not affected."
      >
        <div className="space-y-2">
          {features.map((feature, index) => (
            <div key={feature.id || index} className="rounded-xl border border-ink-200 p-3">
              <div className="grid gap-2 sm:grid-cols-[1fr_2fr_auto]">
                <input
                  className="ec-field"
                  maxLength={80}
                  placeholder="Title"
                  value={feature.title}
                  onChange={(event) => {
                    const next = features.map((item, itemIndex) =>
                      itemIndex === index ? { ...item, title: event.target.value } : item
                    );
                    update({ features: next } as Partial<typeof draft>);
                  }}
                />
                <input
                  className="ec-field"
                  maxLength={240}
                  placeholder="One short sentence"
                  value={feature.text}
                  onChange={(event) => {
                    const next = features.map((item, itemIndex) =>
                      itemIndex === index ? { ...item, text: event.target.value } : item
                    );
                    update({ features: next } as Partial<typeof draft>);
                  }}
                />
                <button
                  type="button"
                  onClick={() => update({ features: features.filter((_, itemIndex) => itemIndex !== index) } as Partial<typeof draft>)}
                  className="h-9 w-9 rounded-lg border border-red-200 text-red-600"
                  aria-label={`Remove highlight ${index + 1}`}
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
          {features.length < 5 ? (
            <button
              type="button"
              onClick={() =>
                update({
                  features: [...features, { id: `feature-${Date.now().toString(36)}`, title: 'New highlight', text: '' }],
                } as Partial<typeof draft>)
              }
              className="text-xs font-semibold text-brand-600 hover:underline"
            >
              + Add highlight
            </button>
          ) : null}
        </div>
      </Panel>
    );
  }

  if (loading) return <Spinner label="Loading this screen…" />;

  return (
    <div>
      <AdminPageHeader
        eyebrow="Screen Studio"
        title={definition.label}
        description={definition.description}
        meta={
          <>
            <StatusPill tone="neutral">{definition.route}</StatusPill>
            <StatusPill tone={dirty ? 'warning' : 'success'}>{dirty ? 'Unsaved changes' : 'Draft up to date'}</StatusPill>
          </>
        }
        actions={
          <>
            <label className="flex items-center gap-2 text-[11px] font-semibold text-ink-500">
              <span className="sr-only">Switch screen</span>
              <select
                className="ec-field !w-auto !py-2 !text-xs"
                value={definition.slug}
                onChange={(event) => goToScreen(event.target.value)}
              >
                {SCREEN_DEFINITIONS.map((screen) => (
                  <option key={screen.slug} value={screen.slug}>
                    {screen.label}
                  </option>
                ))}
              </select>
            </label>
            {dirty ? (
              <button
                type="button"
                onClick={() => setConfirmDiscard(true)}
                className="ec-btn inline-flex border border-ink-200 px-3 py-2 text-xs font-semibold hover:bg-ink-50"
              >
                Discard changes
              </button>
            ) : null}
            <a
              href={liveHref(definition)}
              target="_blank"
              rel="noopener noreferrer"
              className="ec-btn inline-flex items-center border border-ink-200 px-3 py-2 text-xs font-semibold hover:bg-ink-50"
            >
              Open live screen ↗
            </a>
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

      {dirty ? (
        <div className="mt-3">
          <Banner tone="warning" title="Unsaved changes">
            Save a draft before leaving this page. Students keep seeing the last published version until you press
            <strong> Publish to students</strong>.
          </Banner>
        </div>
      ) : null}

      <div className="mt-5 grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-4">
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Screen editor sections">
            {tabs.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={tab === item.id}
                onClick={() => setTab(item.id)}
                className={`ec-btn px-3 py-1.5 text-xs font-bold ${
                  tab === item.id
                    ? 'bg-ink-900 text-white'
                    : 'border border-ink-200 bg-[var(--ec-surface)] text-ink-600 hover:bg-ink-50'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {tab === 'content' ? (
            <>
              {renderGroup('headings')}
              {renderGroup('labels')}
              {renderOnboardingFeatures()}
            </>
          ) : null}

          {tab === 'layout' ? renderGroup('display') : null}
          {tab === 'sections' ? renderSections() : null}
          {tab === 'messages' ? (
            <>
              {renderGroup('empty')}
              {renderGroup('help')}
            </>
          ) : null}
          {tab === 'banner' ? (
            <Panel title={announcementGroup().title} description={announcementGroup().description}>
              <div className="grid gap-4 sm:grid-cols-2">
                {announcementGroup().fields.map((field) =>
                  field.type === 'toggle' || field.type === 'textarea' ? (
                    <div key={field.path} className="sm:col-span-2">
                      {renderField(field)}
                    </div>
                  ) : (
                    <div key={field.path}>{renderField(field)}</div>
                  )
                )}
              </div>
            </Panel>
          ) : null}
        </div>

        <div className="space-y-3 xl:sticky xl:top-[76px]">
          <PreviewFrame
            device={device}
            onDevice={setDevice}
            label="Screen preview"
            hint="Uses the same layout components as the live student screen."
          >
            <ScreenPreview screenKey={definition.key} config={draft as unknown as SiteConfig[ScreenKey]} />
          </PreviewFrame>
          <div className="ec-card p-4">
            <p className="text-xs font-bold text-ink-800">What this editor cannot change</p>
            <p className="mt-1 text-[11px] leading-relaxed text-ink-500">{definition.locked}</p>
            <p className="mt-2 text-[11px] leading-relaxed text-ink-500">
              Students only see changes after <strong>Publish to students</strong>. Drafts stay private to this admin
              account.
            </p>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={Boolean(pendingScreen)}
        title="Leave without saving?"
        description="This screen has unsaved changes. Leaving now discards them."
        confirmLabel="Discard and switch"
        onCancel={() => setPendingScreen(null)}
        onConfirm={() => {
          const target = pendingScreen;
          setPendingScreen(null);
          if (target) router.push(screenHref(target));
        }}
      />
      <ConfirmDialog
        open={confirmDiscard}
        title="Discard unsaved changes?"
        description="Reload the last saved draft for this screen. Published settings are not affected."
        confirmLabel="Discard and reload"
        onCancel={() => setConfirmDiscard(false)}
        onConfirm={() => {
          setConfirmDiscard(false);
          void workspace.reload();
        }}
      />
    </div>
  );
}

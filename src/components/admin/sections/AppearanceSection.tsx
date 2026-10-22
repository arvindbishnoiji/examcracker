'use client';

import { useState } from 'react';
import type { ThemeConfig } from '@/types';
import { useSettingWorkspace } from '@/hooks/useSettingWorkspace';
import { usePrefersDark } from '@/hooks/usePrefersDark';
import { applyThemePreset, buildPreviewStyle, THEME_PRESETS } from '@/lib/theme';
import { DEFAULT_THEME } from '@/lib/site-config';
import { AdminPageHeader, ColorField, Field, Panel, Segmented, Spinner, StatusPill, Toggle } from '../ui';
import { ImageField } from '../ImageField';
import { PreviewFrame, type PreviewDevice } from '../PreviewFrame';
import { SettingsPublishBar } from '../SettingsPublishBar';

function ThemePreview({ theme }: { theme: ThemeConfig }) {
  const prefersDark = usePrefersDark();
  const mode = theme.mode === 'dark' || (theme.mode === 'system' && prefersDark) ? 'dark' : 'light';
  return (
    <div
      style={buildPreviewStyle(theme, prefersDark)}
      data-ec-theme={mode}
      data-ec-card={theme.cardStyle}
      className="overflow-hidden rounded-[var(--ec-radius)] border border-ink-200 bg-[var(--ec-bg)] text-[var(--ec-text)] shadow-card"
    >
      <div className="ec-header border-b px-3 py-2.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {theme.logoUrl ? (
            <img src={theme.logoUrl} alt="" className="h-7 w-7 rounded-lg object-cover" />
          ) : (
            <span
              className="h-7 w-7 rounded-lg grid place-items-center text-[11px] font-bold"
              style={{ background: 'linear-gradient(135deg, var(--ec-brand), var(--ec-secondary))', color: 'var(--ec-on-brand)' }}
            >
              {theme.logoText || 'EC'}
            </span>
          )}
          <div className="min-w-0">
            <p className="text-[11px] font-bold truncate">{theme.brandName || 'Exam Cracker'}</p>
            <p className="text-[8px] text-current opacity-60 truncate">{theme.tagline}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="hidden sm:inline text-[8px] font-semibold px-2 py-1 rounded-full bg-[var(--ec-brand-100)] text-[var(--ec-brand-700)]">
            Lectures
          </span>
          <span
            className="text-[8px] font-bold px-2 py-1"
            style={{ background: 'var(--ec-brand)', color: 'var(--ec-on-brand)', borderRadius: 'var(--ec-button-radius)' }}
          >
            Sign in
          </span>
        </div>
      </div>
      <div className="p-3 space-y-2.5">
        <div className="ec-hero-gradient rounded-[var(--ec-radius)] border border-ink-100 p-3.5">
          <span className="inline-flex text-[8px] font-semibold px-2 py-0.5 rounded-full bg-[var(--ec-brand-50)] text-[var(--ec-brand-700)] border border-[var(--ec-brand-100)]">
            {theme.tagline || 'JEE • NEET'}
          </span>
          <h3 className="text-[15px] leading-tight mt-1.5" style={{ fontFamily: 'var(--ec-font-heading)', fontWeight: 'var(--ec-heading-weight)' }}>
            Your rank, built one focused day at a time.
          </h3>
          <p className="text-[9px] text-ink-500 mt-1 max-w-[85%]">
            Lectures, timed tests and a plan that follows your syllabus.
          </p>
          <div className="flex gap-1.5 mt-2.5">
            <span
              className="text-[8px] font-bold px-2.5 py-1.5"
              style={{ background: 'var(--ec-brand)', color: 'var(--ec-on-brand)', borderRadius: 'var(--ec-button-radius)' }}
            >
              Explore lectures
            </span>
            <span className="text-[8px] font-semibold px-2.5 py-1.5 border border-ink-200 rounded-[var(--ec-button-radius)] bg-[var(--ec-surface)]">
              View tests
            </span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: 'Tests taken', value: '18' },
            { label: 'Avg. score', value: '72%' },
          ].map((stat) => (
            <div key={stat.label} className="ec-card p-2.5">
              <p className="text-[8px] uppercase tracking-wide text-ink-500">{stat.label}</p>
              <p className="text-sm font-extrabold mt-0.5">{stat.value}</p>
            </div>
          ))}
        </div>
        <div className="ec-card p-2.5">
          <div className="flex items-center justify-between">
            <p className="text-[9px] font-semibold">Continue learning</p>
            <StatusPill tone="brand">New</StatusPill>
          </div>
          <div className="mt-1.5 flex items-center gap-2">
            <span className="h-7 w-10 rounded-md bg-[var(--ec-brand-100)]" />
            <div className="min-w-0 flex-1">
              <p className="text-[9px] font-medium truncate">Rotational motion · Lecture 4</p>
              <div className="h-1 rounded-full bg-ink-100 mt-1 overflow-hidden">
                <div className="h-full w-2/3 bg-[var(--ec-brand)]" />
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="ec-field !py-1.5 !text-[9px] flex-1">Search lectures…</span>
          <span
            className="text-[8px] font-bold px-2 py-1.5"
            style={{ background: 'var(--ec-accent)', color: '#111827', borderRadius: 'var(--ec-button-radius)' }}
          >
            Go
          </span>
        </div>
        <div className="rounded-[var(--ec-radius)] border border-dashed border-ink-200 p-2.5 text-center bg-[var(--ec-surface)]">
          <p className="text-[9px] font-semibold">{theme.emptyStateTitle || 'Nothing here yet'}</p>
          <p className="text-[8px] text-ink-500 mt-0.5 line-clamp-2">{theme.emptyStateBody}</p>
        </div>
      </div>
    </div>
  );
}

export function AppearanceSection() {
  const workspace = useSettingWorkspace('theme');
  const [device, setDevice] = useState<PreviewDevice>('desktop');
  const { draft, update, loading } = workspace;

  if (loading) return <Spinner label="Loading appearance settings…" />;

  return (
    <div>
      <AdminPageHeader
        eyebrow="Website settings"
        title="Website Appearance"
        description="Publish a real, global design system: colours, typography, shape, density, header and motion. Every preset updates actual theme tokens used by the student site."
        meta={
          <>
            <StatusPill tone={draft.mode === 'dark' ? 'brand' : 'neutral'}>
              {draft.mode === 'dark' ? 'Dark mode' : draft.mode === 'system' ? 'System theme' : 'Light mode'}
            </StatusPill>
            <StatusPill tone="info">Preset: {THEME_PRESETS.find((preset) => preset.id === draft.preset)?.label || 'Custom'}</StatusPill>
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

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px] mt-5 items-start">
        <div className="space-y-5">
          <Panel title="Design presets" description="Presets replace the real colour, font, radius and surface tokens.">
            <div className="grid sm:grid-cols-2 gap-3">
              {THEME_PRESETS.map((preset) => {
                const active = draft.preset === preset.id;
                const themed = applyThemePreset(draft, preset.id);
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => update(applyThemePreset(draft, preset.id))}
                    className={`rounded-xl border p-3 text-left transition ${
                      active ? 'border-brand-500 ring-2 ring-brand-500/20 bg-brand-50/40' : 'border-ink-200 hover:bg-ink-50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="flex -space-x-1">
                        {[themed.primaryColor, themed.secondaryColor, themed.accentColor, themed.surfaceColor].map((color) => (
                          <span
                            key={color}
                            className="h-5 w-5 rounded-full border-2 border-white shadow-sm"
                            style={{ background: color }}
                          />
                        ))}
                      </span>
                      <span className="text-sm font-semibold">{preset.label}</span>
                      {active && <StatusPill tone="success" className="ml-auto">Active</StatusPill>}
                    </div>
                    <p className="text-[11px] text-ink-500 mt-1.5 leading-relaxed">{preset.description}</p>
                  </button>
                );
              })}
            </div>
          </Panel>

          <Panel title="Brand identity" description="Used in the header, login page, footer and browser metadata.">
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Brand name" required>
                <input className="ec-field" value={draft.brandName} onChange={(event) => update({ brandName: event.target.value })} />
              </Field>
              <Field label="Tagline">
                <input className="ec-field" value={draft.tagline} onChange={(event) => update({ tagline: event.target.value })} />
              </Field>
              <Field label="Logo initials" help="Shown when no logo image is configured.">
                <input className="ec-field" value={draft.logoText} maxLength={6} onChange={(event) => update({ logoText: event.target.value })} />
              </Field>
              <Field label="Theme mode">
                <Segmented
                  value={draft.mode}
                  onChange={(mode) => update({ mode })}
                  options={[
                    { value: 'light', label: 'Light' },
                    { value: 'dark', label: 'Dark' },
                    { value: 'system', label: 'System' },
                  ]}
                />
              </Field>
              <div className="sm:col-span-2 grid sm:grid-cols-2 gap-4">
                <ImageField
                  label="Logo image (URL or Google Drive)"
                  help="Optional. Paste a link OR upload a square PNG/JPG/WebP logo to Google Drive."
                  context="logo"
                  preferSquareCrop
                  value={draft.logoUrl}
                  onChange={(logoUrl) => update({ logoUrl })}
                />
                <ImageField
                  label="Favicon image (URL or Google Drive)"
                  help="Defaults to /favicon.ico when empty."
                  context="favicon"
                  preferSquareCrop
                  value={draft.faviconUrl}
                  onChange={(faviconUrl) => update({ faviconUrl })}
                />
              </div>
            </div>
          </Panel>

          <Panel title="Colour system" description="The palette is expanded into a full scale at runtime, so every existing screen updates.">
            <div className="grid sm:grid-cols-2 gap-4">
              <ColorField label="Primary / brand" value={draft.primaryColor} onChange={(primaryColor) => update({ primaryColor })} />
              <ColorField label="Secondary" value={draft.secondaryColor} onChange={(secondaryColor) => update({ secondaryColor })} />
              <ColorField label="Accent" value={draft.accentColor} onChange={(accentColor) => update({ accentColor })} />
              <ColorField label="Page background" value={draft.backgroundColor} onChange={(backgroundColor) => update({ backgroundColor })} />
              <ColorField label="Card surface" value={draft.surfaceColor} onChange={(surfaceColor) => update({ surfaceColor })} />
              <ColorField label="Primary text" value={draft.textColor} onChange={(textColor) => update({ textColor })} />
            </div>
          </Panel>

          <Panel title="Typography" description="Fonts load from Google Fonts with system fallbacks.">
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Type preset">
                <select
                  className="ec-field"
                  value={draft.fontPreset}
                  onChange={(event) => update({ fontPreset: event.target.value as ThemeConfig['fontPreset'] })}
                >
                  <option value="modern">Modern — Inter</option>
                  <option value="minimal">Minimal — system UI</option>
                  <option value="academic">Academic — serif headings</option>
                  <option value="display">Display — Manrope</option>
                </select>
              </Field>
              <Field label="Heading character">
                <select
                  className="ec-field"
                  value={draft.headingStyle}
                  onChange={(event) => update({ headingStyle: event.target.value as ThemeConfig['headingStyle'] })}
                >
                  <option value="tight">Tight &amp; bold</option>
                  <option value="balanced">Balanced</option>
                  <option value="editorial">Editorial serif</option>
                </select>
              </Field>
            </div>
          </Panel>

          <Panel title="Shape, surfaces & layout" description="Controls cards, buttons, inputs and the page shell.">
            <div className="space-y-4">
              <Field label={`Corner radius · ${draft.radius}px`} help="0 is square, 32 is very rounded.">
                <input
                  type="range"
                  min={0}
                  max={32}
                  value={draft.radius}
                  onChange={(event) => update({ radius: Number(event.target.value) })}
                  className="w-full accent-[var(--ec-brand)]"
                />
              </Field>
              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Button shape">
                  <Segmented
                    value={draft.buttonShape}
                    onChange={(buttonShape) => update({ buttonShape })}
                    options={[
                      { value: 'rounded', label: 'Rounded' },
                      { value: 'pill', label: 'Pill' },
                      { value: 'square', label: 'Square' },
                    ]}
                  />
                </Field>
                <Field label="Card style">
                  <select
                    className="ec-field"
                    value={draft.cardStyle}
                    onChange={(event) => update({ cardStyle: event.target.value as ThemeConfig['cardStyle'] })}
                  >
                    <option value="elevated">Elevated</option>
                    <option value="outlined">Outlined</option>
                    <option value="flat">Flat</option>
                    <option value="glass">Glass</option>
                  </select>
                </Field>
                <Field label="Shadow strength">
                  <Segmented
                    value={draft.shadow}
                    onChange={(shadow) => update({ shadow })}
                    options={[
                      { value: 'none', label: 'None' },
                      { value: 'soft', label: 'Soft' },
                      { value: 'strong', label: 'Strong' },
                    ]}
                  />
                </Field>
                <Field label="Page width">
                  <Segmented
                    value={draft.pageWidth}
                    onChange={(pageWidth) => update({ pageWidth })}
                    options={[
                      { value: 'narrow', label: 'Narrow' },
                      { value: 'standard', label: 'Standard' },
                      { value: 'wide', label: 'Wide' },
                    ]}
                  />
                </Field>
                <Field label="Spacing density">
                  <Segmented
                    value={draft.density}
                    onChange={(density) => update({ density })}
                    options={[
                      { value: 'compact', label: 'Compact' },
                      { value: 'comfortable', label: 'Comfortable' },
                      { value: 'spacious', label: 'Spacious' },
                    ]}
                  />
                </Field>
                <Field label="Header style">
                  <select
                    className="ec-field"
                    value={draft.headerStyle}
                    onChange={(event) => update({ headerStyle: event.target.value as ThemeConfig['headerStyle'] })}
                  >
                    <option value="light">Light / surface</option>
                    <option value="dark">Dark</option>
                    <option value="transparent">Transparent blur</option>
                    <option value="gradient">Brand gradient</option>
                  </select>
                </Field>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <Toggle
                  checked={draft.stickyHeader}
                  onChange={(stickyHeader) => update({ stickyHeader })}
                  label="Sticky header"
                  description="Keeps navigation visible while students scroll."
                />
                <Toggle
                  checked={draft.showBottomNav}
                  onChange={(showBottomNav) => update({ showBottomNav })}
                  label="Mobile bottom navigation"
                  description="Hide if you prefer a drawer-only mobile experience."
                />
              </div>
              <Field label="Animation intensity">
                <Segmented
                  value={draft.animation}
                  onChange={(animation) => update({ animation })}
                  options={[
                    { value: 'none', label: 'None' },
                    { value: 'subtle', label: 'Subtle' },
                    { value: 'expressive', label: 'Expressive' },
                  ]}
                />
              </Field>
            </div>
          </Panel>

          <Panel title="Empty states" description="Friendly copy used when a section has no published content yet.">
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Empty-state title">
                <input
                  className="ec-field"
                  value={draft.emptyStateTitle}
                  onChange={(event) => update({ emptyStateTitle: event.target.value })}
                />
              </Field>
              <Field label="Empty-state message">
                <textarea
                  className="ec-field"
                  rows={3}
                  value={draft.emptyStateBody}
                  onChange={(event) => update({ emptyStateBody: event.target.value })}
                />
              </Field>
            </div>
          </Panel>
        </div>

        <div className="xl:sticky xl:top-[76px] space-y-3">
          <PreviewFrame
            device={device}
            onDevice={setDevice}
            label="Visual theme preview"
            hint="This preview uses the same CSS tokens as the published site."
          >
            <ThemePreview theme={draft} />
          </PreviewFrame>
          <div className="ec-card p-4">
            <p className="text-xs font-semibold mb-2">Applied tokens</p>
            <div className="grid grid-cols-2 gap-2 text-[10px] text-ink-500">
              <span>Radius: <strong className="text-ink-700">{draft.radius}px</strong></span>
              <span>Buttons: <strong className="text-ink-700">{draft.buttonShape}</strong></span>
              <span>Cards: <strong className="text-ink-700">{draft.cardStyle}</strong></span>
              <span>Density: <strong className="text-ink-700">{draft.density}</strong></span>
              <span>Page: <strong className="text-ink-700">{draft.pageWidth}</strong></span>
              <span>Motion: <strong className="text-ink-700">{draft.animation}</strong></span>
            </div>
            <p className="text-[10px] text-ink-500 mt-3">
              Default reference: {DEFAULT_THEME.brandName}. Use “Reset defaults” to restore the shipped theme.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useState } from 'react';
import type { LoginConfig } from '@/types';
import { APP_CONFIG } from '@/lib/config';
import { useSettingWorkspace } from '@/hooks/useSettingWorkspace';
import { useSiteConfig } from '@/context/SiteConfigContext';
import { LoginFormPreview, LoginShell } from '@/components/login/LoginShell';
import { AdminPageHeader, ColorField, Field, Panel, Segmented, Spinner, StatusPill, Toggle } from '../ui';
import { LinkListEditor, StringListEditor } from '../ListEditors';
import { PreviewFrame, type PreviewDevice } from '../PreviewFrame';
import { SettingsPublishBar } from '../SettingsPublishBar';

const LAYOUTS: Array<{ value: LoginConfig['layout']; label: string; description: string }> = [
  { value: 'split', label: 'Split screen', description: 'Story-led hero beside the sign-in card.' },
  { value: 'centered', label: 'Centered card', description: 'Calm, focused and fast on every device.' },
  { value: 'hero', label: 'Visual hero', description: 'Full-bleed image with a floating sign-in card.' },
];

function LayoutMiniature({ layout }: { layout: LoginConfig['layout'] }) {
  return (
    <div className="h-16 w-full rounded-lg border border-ink-200 bg-ink-50 overflow-hidden flex gap-1 p-1.5">
      {layout === 'split' && (
        <>
          <div className="w-1/2 rounded bg-brand-100" />
          <div className="flex-1 grid place-items-center">
            <div className="h-8 w-8 rounded bg-[var(--ec-surface)] border border-ink-200" />
          </div>
        </>
      )}
      {layout === 'centered' && (
        <div className="flex-1 grid place-items-center">
          <div className="h-9 w-12 rounded bg-[var(--ec-surface)] border border-ink-200" />
        </div>
      )}
      {layout === 'hero' && (
        <div className="relative flex-1 rounded bg-gradient-to-br from-brand-500 to-brand-800 grid place-items-center">
          <div className="h-8 w-10 rounded bg-white/90" />
        </div>
      )}
    </div>
  );
}

export function LoginDesignerSection() {
  const workspace = useSettingWorkspace('login');
  const { config } = useSiteConfig();
  const [device, setDevice] = useState<PreviewDevice>('desktop');
  const { draft, update, loading } = workspace;
  const testimonials = config.testimonials.items.filter((item) => item.active);

  if (loading) return <Spinner label="Loading login design…" />;

  return (
    <div>
      <AdminPageHeader
        eyebrow="Design studio"
        title="Login Page Designer"
        description="Design a premium sign-in experience while keeping the real Firebase authentication flow untouched. This screen only changes presentation and helper copy."
        meta={
          <>
            <StatusPill tone="info">Layout: {LAYOUTS.find((layout) => layout.value === draft.layout)?.label}</StatusPill>
            <StatusPill tone="neutral">Auth: Firebase (unchanged)</StatusPill>
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
          <Panel title="Layout preset" description="Choose the overall composition. Mobile layouts adapt automatically.">
            <div className="grid sm:grid-cols-3 gap-3">
              {LAYOUTS.map((layout) => (
                <button
                  key={layout.value}
                  type="button"
                  onClick={() => update({ layout: layout.value })}
                  className={`rounded-xl border p-2.5 text-left transition ${
                    draft.layout === layout.value
                      ? 'border-brand-500 ring-2 ring-brand-500/20 bg-brand-50/40'
                      : 'border-ink-200 hover:bg-ink-50'
                  }`}
                >
                  <LayoutMiniature layout={layout.value} />
                  <p className="text-xs font-bold mt-2">{layout.label}</p>
                  <p className="text-[10px] text-ink-500 mt-0.5 leading-snug">{layout.description}</p>
                </button>
              ))}
            </div>
            <div className="grid sm:grid-cols-3 gap-4 mt-4">
              <Field label="Card alignment">
                <select className="ec-field" value={draft.cardAlign} onChange={(event) => update({ cardAlign: event.target.value as LoginConfig['cardAlign'] })}>
                  <option value="left">Left</option>
                  <option value="center">Center</option>
                  <option value="right">Right</option>
                </select>
              </Field>
              <Field label="Card width">
                <select className="ec-field" value={draft.cardWidth} onChange={(event) => update({ cardWidth: event.target.value as LoginConfig['cardWidth'] })}>
                  <option value="compact">Compact</option>
                  <option value="standard">Standard</option>
                  <option value="wide">Wide</option>
                </select>
              </Field>
              <Field label="Mobile visual position">
                <select
                  className="ec-field"
                  value={draft.mobileImagePosition}
                  onChange={(event) => update({ mobileImagePosition: event.target.value as LoginConfig['mobileImagePosition'] })}
                >
                  <option value="top">Show above card</option>
                  <option value="hidden">Hide on mobile</option>
                  <option value="background">Use as background</option>
                </select>
              </Field>
            </div>
          </Panel>

          <Panel title="Identity & copy" description="Shown inside the sign-in card.">
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Login logo URL" help="Falls back to the website logo / initials.">
                <input className="ec-field" value={draft.logoUrl} placeholder="https://…" onChange={(event) => update({ logoUrl: event.target.value })} />
              </Field>
              <Field label="Card eyebrow">
                <input className="ec-field" value={draft.title} onChange={(event) => update({ title: event.target.value })} />
              </Field>
              <Field label="Headline" required>
                <input className="ec-field" value={draft.subtitle} onChange={(event) => update({ subtitle: event.target.value })} />
              </Field>
              <Field label="Welcome message">
                <input className="ec-field" value={draft.welcomeMessage} onChange={(event) => update({ welcomeMessage: event.target.value })} />
              </Field>
            </div>
          </Panel>

          <Panel title="Hero story" description="The left-hand (or background) marketing panel.">
            <div className="space-y-4">
              <Field label="Hero image URL" help="Leave empty for a generated gradient panel.">
                <input className="ec-field" value={draft.heroImageUrl} placeholder="https://…" onChange={(event) => update({ heroImageUrl: event.target.value })} />
              </Field>
              <Field label="Hero headline">
                <input className="ec-field" value={draft.heroTitle} onChange={(event) => update({ heroTitle: event.target.value })} />
              </Field>
              <Field label="Hero description">
                <textarea className="ec-field" rows={3} value={draft.heroSubtitle} onChange={(event) => update({ heroSubtitle: event.target.value })} />
              </Field>
              <StringListEditor
                label="Highlights"
                help="Short proof points. Keep to 3–5 for the strongest layout."
                items={draft.highlights}
                onChange={(highlights) => update({ highlights })}
                placeholder="e.g. Live doubt sessions every evening"
                max={8}
              />
              <Toggle
                checked={draft.showTestimonials}
                onChange={(showTestimonials) => update({ showTestimonials })}
                label="Show featured testimonials"
                description="Uses active testimonials from the Testimonials manager."
              />
            </div>
          </Panel>

          <Panel title="Background" description="Use a solid colour, a branded gradient or a validated image URL.">
            <div className="space-y-4">
              <Field label="Background type">
                <Segmented
                  value={draft.backgroundType}
                  onChange={(backgroundType) => update({ backgroundType })}
                  options={[
                    { value: 'gradient', label: 'Gradient' },
                    { value: 'solid', label: 'Solid' },
                    { value: 'image', label: 'Image' },
                  ]}
                />
              </Field>
              {draft.backgroundType === 'solid' && (
                <ColorField label="Background colour" value={draft.backgroundColor} onChange={(backgroundColor) => update({ backgroundColor })} />
              )}
              {draft.backgroundType === 'gradient' && (
                <div className="grid sm:grid-cols-2 gap-4">
                  <ColorField label="Gradient start" value={draft.gradientFrom} onChange={(gradientFrom) => update({ gradientFrom })} />
                  <ColorField label="Gradient end" value={draft.gradientTo} onChange={(gradientTo) => update({ gradientTo })} />
                </div>
              )}
              {draft.backgroundType === 'image' && (
                <Field label="Background image URL" help="Use a 1920×1080 image. Overlay is applied automatically.">
                  <input
                    className="ec-field"
                    value={draft.backgroundImageUrl}
                    placeholder="https://…"
                    onChange={(event) => update({ backgroundImageUrl: event.target.value })}
                  />
                </Field>
              )}
            </div>
          </Panel>

          <Panel title="Form & access" description="Authentication behaviour stays with Firebase; labels and visibility are yours.">
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Email label" required>
                <input className="ec-field" value={draft.emailLabel} onChange={(event) => update({ emailLabel: event.target.value })} />
              </Field>
              <Field label="Password label" required>
                <input className="ec-field" value={draft.passwordLabel} onChange={(event) => update({ passwordLabel: event.target.value })} />
              </Field>
              <Field label="Email helper text">
                <input className="ec-field" value={draft.emailHelp} onChange={(event) => update({ emailHelp: event.target.value })} />
              </Field>
              <Field label="Password helper text">
                <input className="ec-field" value={draft.passwordHelp} onChange={(event) => update({ passwordHelp: event.target.value })} />
              </Field>
              <Field label="Forgot-password label">
                <input className="ec-field" value={draft.forgotPasswordText} onChange={(event) => update({ forgotPasswordText: event.target.value })} />
              </Field>
              <Field label="Forgot-password instructions">
                <input className="ec-field" value={draft.forgotPasswordHelp} onChange={(event) => update({ forgotPasswordHelp: event.target.value })} />
              </Field>
            </div>
            <div className="grid sm:grid-cols-2 gap-3 mt-4">
              <Toggle
                checked={draft.showGoogle}
                onChange={(showGoogle) => update({ showGoogle })}
                label="Show Google sign-in"
                description={
                  APP_CONFIG.auth.googleEnabled
                    ? 'Only visible when the global Google feature toggle is on.'
                    : 'Disabled by NEXT_PUBLIC_GOOGLE_AUTH_ENABLED.'
                }
                disabled={!APP_CONFIG.auth.googleEnabled}
              />
              <Toggle
                checked={draft.showSignup}
                onChange={(showSignup) => update({ showSignup })}
                label="Allow account creation"
                description="Hides the Create account tab. Does not change Firebase signup policy."
              />
            </div>
            <div className="mt-4">
              <Toggle
                checked={draft.showOnboardingNote}
                onChange={(showOnboardingNote) => update({ showOnboardingNote })}
                label="Show onboarding note"
                description="Reminds students they will choose JEE/NEET and class after signing in."
              />
            </div>
            <div className="mt-4 rounded-xl border border-ink-200 bg-ink-50/60 p-3 text-[11px] text-ink-500">
              Authentication is intentionally not editable here. There is no bypass switch, and admin email checks remain
              server-side in the Edge Function.
            </div>
          </Panel>

          <Panel title="Promotional banner" description="A contextual card below the form.">
            <div className="space-y-3">
              <Toggle
                checked={draft.bannerEnabled}
                onChange={(bannerEnabled) => update({ bannerEnabled })}
                label="Show banner"
                description="Useful for exam announcements, new batches or events."
              />
              {draft.bannerEnabled && (
                <>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <Field label="Banner title">
                      <input className="ec-field" value={draft.bannerTitle} onChange={(event) => update({ bannerTitle: event.target.value })} />
                    </Field>
                    <Field label="Banner CTA label">
                      <input className="ec-field" value={draft.bannerCtaLabel} onChange={(event) => update({ bannerCtaLabel: event.target.value })} />
                    </Field>
                  </div>
                  <Field label="Banner body">
                    <textarea className="ec-field" rows={2} value={draft.bannerBody} onChange={(event) => update({ bannerBody: event.target.value })} />
                  </Field>
                  <Field label="Banner CTA link">
                    <input className="ec-field" value={draft.bannerCtaHref} placeholder="/events" onChange={(event) => update({ bannerCtaHref: event.target.value })} />
                  </Field>
                </>
              )}
            </div>
          </Panel>

          <Panel title="Footer & legal" description="Keep support and policy links discoverable.">
            <div className="space-y-4">
              <Field label="Footer text">
                <textarea className="ec-field" rows={2} value={draft.footerText} onChange={(event) => update({ footerText: event.target.value })} />
              </Field>
              <LinkListEditor
                label="Footer links"
                links={draft.footerLinks}
                onChange={(footerLinks) => update({ footerLinks })}
                help="Internal routes or https:// links."
              />
              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Terms link">
                  <input className="ec-field" value={draft.termsUrl} placeholder="/terms" onChange={(event) => update({ termsUrl: event.target.value })} />
                </Field>
                <Field label="Privacy link">
                  <input className="ec-field" value={draft.privacyUrl} placeholder="/privacy" onChange={(event) => update({ privacyUrl: event.target.value })} />
                </Field>
              </div>
            </div>
          </Panel>
        </div>

        <div className="xl:sticky xl:top-[76px] space-y-3">
          <PreviewFrame
            device={device}
            onDevice={setDevice}
            label="Login preview"
            hint="Rendered with the published site theme and your draft login content."
          >
            <div className="max-h-[640px] overflow-y-auto rounded-xl border border-ink-200 bg-white">
              <LoginShell
                login={draft}
                theme={config.theme}
                testimonials={testimonials}
                preview
              >
                <LoginFormPreview login={draft} />
              </LoginShell>
            </div>
          </PreviewFrame>
          <div className="ec-card p-4">
            <p className="text-xs font-semibold mb-2">What this controls</p>
            <ul className="text-[11px] text-ink-500 space-y-1.5 list-disc pl-4">
              <li>Visual layout, copy, imagery and footer links.</li>
              <li>Visibility of Google and sign-up surfaces (provider still governed by Firebase).</li>
              <li>Mobile composition and card sizing.</li>
              <li>Nothing related to passwords, sessions or admin access.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

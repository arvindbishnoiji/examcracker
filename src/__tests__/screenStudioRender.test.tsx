import React from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { SiteConfig } from '../types';
import { DEFAULT_SCREEN_CONFIGS, SCREEN_KEYS, screenDefinition } from '../lib/screen-config';
import { mergeSiteConfig } from '../lib/site-config';
import { ScreenPreview } from '../components/admin/screens/ScreenPreview';

// The preview is rendered outside the Next.js router in this test.
vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) =>
    React.createElement('a', { href, ...rest }, children),
}));

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

describe('Screen Studio preview rendering', () => {
  it('renders every screen preview from built-in defaults without throwing', () => {
    for (const key of SCREEN_KEYS) {
      const config = DEFAULT_SCREEN_CONFIGS[key] as SiteConfig[typeof key];
      const html = renderToString(
        <ScreenPreview screenKey={key} config={config as SiteConfig[(typeof SCREEN_KEYS)[number]]} />
      );
      expect(html.length).toBeGreaterThan(200);
      expect(html).toContain(screenDefinition(key).route);
      // The configured page heading must be present in the real layout.
      expect(html).toContain(escapeHtml(config.pageTitle));
    }
  });

  it('always previews the mandatory onboarding questions', () => {
    const config = DEFAULT_SCREEN_CONFIGS.onboarding;
    const html = renderToString(<ScreenPreview screenKey="onboarding" config={config} />);
    expect(html).toContain(escapeHtml(config.nameQuestion));
    expect(html).toContain(escapeHtml(config.examQuestion));
    expect(html).toContain(escapeHtml(config.classQuestion));
    // JEE / NEET and Class 11 / 12 are fixed requirements, not editable copy.
    expect(html).toContain('JEE');
    expect(html).toContain('NEET');
    expect(html).toContain('Class 11');
    expect(html).toContain('Class 12');
  });

  it('reflects published values and hidden sections in the preview', () => {
    const merged = mergeSiteConfig({
      profile: {
        ...DEFAULT_SCREEN_CONFIGS.profile,
        pageTitle: 'My learning report',
        sections: DEFAULT_SCREEN_CONFIGS.profile.sections.map((section) =>
          section.id === 'quick_links' ? { ...section, visible: false } : section
        ),
      },
    });
    const html = renderToString(<ScreenPreview screenKey="profile" config={merged.profile} />);
    expect(html).toContain('My learning report');
    // Hidden block is not rendered.
    expect(html).not.toContain('Quick links');
  });

  it('renders the announcement banner only when enabled', () => {
    const base = mergeSiteConfig({
      tests: {
        ...DEFAULT_SCREEN_CONFIGS.tests,
        announcement: {
          enabled: true,
          title: 'Weekly mock this Sunday',
          body: 'Starts at 10 AM IST.',
          ctaLabel: 'Open tests',
          ctaHref: '/tests',
          tone: 'warning',
        },
      },
    });
    const on = renderToString(<ScreenPreview screenKey="tests" config={base.tests} />);
    expect(on).toContain('Weekly mock this Sunday');
    expect(on).toContain('Open tests');

    const off = renderToString(
      <ScreenPreview
        screenKey="tests"
        config={{ ...base.tests, announcement: { ...base.tests.announcement, enabled: false } }}
      />
    );
    expect(off).not.toContain('Weekly mock this Sunday');
  });
});

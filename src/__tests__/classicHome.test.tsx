import React from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_HOMEPAGE,
  DEFAULT_LOGIN,
  DEFAULT_THEME,
  HOME_SECTION_TYPES,
  createHomeSection,
  mergeSiteConfig,
} from '../lib/site-config';
import { validateSettingValue } from '../lib/site-validation';
import {
  FeatureCards,
  HomeHero,
  StepCards,
  fillTokens,
  visibleItems,
} from '../components/home/ClassicHome';
import { LoginShell } from '../components/login/LoginShell';

vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) =>
    React.createElement('a', { href, ...rest }, children),
}));

describe('Classic home configuration', () => {
  it('ships a v2 default with an editable hero and every former hard-coded block as a section', () => {
    expect(DEFAULT_HOMEPAGE.version).toBe(2);
    expect(DEFAULT_HOMEPAGE.hero.title.length).toBeGreaterThan(0);
    const types = DEFAULT_HOMEPAGE.sections.map((section) => section.type);
    for (const type of ['dashboard_banners', 'feature_grid', 'how_it_works', 'batch_showcase'] as const) {
      expect(types).toContain(type);
    }
    expect(validateSettingValue('homepage', DEFAULT_HOMEPAGE).ok).toBe(true);
  });

  it('migrates a pre-v2 saved config without losing blocks or the hero headline', () => {
    const legacy = {
      showGreeting: true,
      greetingTemplate: 'Hi {name}',
      showSearch: false,
      showQuickStats: true,
      sections: [
        { id: 'h', type: 'hero', title: 'Old hero headline', subtitle: 'Old hero text', visible: true },
        { id: 't', type: 'live_tests', title: 'Live', visible: true },
      ],
    };
    const merged = mergeSiteConfig({ homepage: legacy as never }).homepage;
    expect(merged.version).toBe(2);
    expect(merged.hero.title).toBe('Old hero headline');
    expect(merged.hero.subtitle).toBe('Old hero text');
    const types = merged.sections.map((section) => section.type);
    expect(types.slice(0, 4)).toEqual(['dashboard_banners', 'feature_grid', 'how_it_works', 'batch_showcase']);
    expect(types.slice(4)).toEqual(['hero', 'live_tests']);
    // The headline moved into the hero; the banner carousel no longer repeats it.
    expect(merged.sections.find((section) => section.type === 'hero')?.title).toBe('Featured');
    expect(merged.sections.find((section) => section.type === 'feature_grid')?.items?.length).toBeGreaterThan(0);
  });

  it('does not re-add blocks the admin deliberately removed in a v2 config', () => {
    const saved = { ...DEFAULT_HOMEPAGE, sections: [createHomeSection('live_tests', 0)] };
    const merged = mergeSiteConfig({ homepage: JSON.parse(JSON.stringify(saved)) }).homepage;
    expect(merged.sections.map((section) => section.type)).toEqual(['live_tests']);
  });

  it('sanitises hero values and validates links', () => {
    const merged = mergeSiteConfig({
      homepage: { ...DEFAULT_HOMEPAGE, hero: { ...DEFAULT_HOMEPAGE.hero, style: 'weird', backgroundColor: 'red' } } as never,
    }).homepage;
    expect(merged.hero.style).toBe('classic');
    expect(merged.hero.backgroundColor).toBe('');

    const bad = { ...DEFAULT_HOMEPAGE, hero: { ...DEFAULT_HOMEPAGE.hero, primaryCtaHref: 'javascript:alert(1)' } };
    expect(validateSettingValue('homepage', bad).ok).toBe(false);
    const noImage = { ...DEFAULT_HOMEPAGE, hero: { ...DEFAULT_HOMEPAGE.hero, style: 'image' as const, imageUrl: '' } };
    expect(validateSettingValue('homepage', noImage).ok).toBe(false);
  });

  it('creates publishable defaults for the new section types', () => {
    for (const type of HOME_SECTION_TYPES) {
      const section = createHomeSection(type, 0);
      expect(section.type).toBe(type);
      expect(section.title.length).toBeGreaterThan(0);
    }
    expect(createHomeSection('feature_grid').items?.length).toBeGreaterThan(0);
    expect(createHomeSection('how_it_works').items?.length).toBe(3);
  });
});

describe('Classic home rendering', () => {
  it('fills {name}, {exam} and {class} tokens in the hero', () => {
    const tokens = { name: 'Aarav', exam: 'NEET', classLabel: 'Class 11' };
    expect(fillTokens('{name} · {exam} · {class}', tokens)).toBe('Aarav · NEET · Class 11');
    const html = renderToString(
      <HomeHero
        hero={{ ...DEFAULT_HOMEPAGE.hero, title: 'Hello {name}', eyebrow: '{exam}' }}
        tokens={tokens}
        primary={{ label: 'Go', href: '/lectures' }}
        secondary={null}
      />
    );
    expect(html).toContain('Hello Aarav');
    expect(html).toContain('NEET');
    expect(html).toContain('href="/lectures"');
  });

  it('hides hidden cards and cards for disabled features', () => {
    const section = createHomeSection('feature_grid');
    const items = visibleItems(
      [...(section.items || []), { id: 'x', icon: '', title: 'Hidden', body: '', href: '', visible: false }],
      { tests: false }
    );
    expect(items.some((item) => item.title === 'Hidden')).toBe(false);
    expect(items.some((item) => item.href === '/tests')).toBe(false);
    const html = renderToString(<FeatureCards section={section} items={items} />);
    expect(html).toContain('Lectures');
    const steps = createHomeSection('how_it_works');
    expect(renderToString(<StepCards section={steps} items={visibleItems(steps.items)} />)).toContain('Pick your batch');
  });

  it('renders the classic login shell with readable copy and the form slot', () => {
    const html = renderToString(
      <LoginShell login={DEFAULT_LOGIN} theme={DEFAULT_THEME} testimonials={[]}>
        <form id="slot" />
      </LoginShell>
    );
    expect(html).toContain('ecc-auth');
    expect(html).toContain('id="slot"');
    expect(html).toContain(DEFAULT_LOGIN.title);
    expect(html).not.toContain('ec-night');
  });
});

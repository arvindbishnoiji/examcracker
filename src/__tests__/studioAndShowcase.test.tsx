// @vitest-environment jsdom
import React from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { AnimationStudioConfig, BatchShowcaseConfig, CourseCatalogItem } from '../types';
import {
  DEFAULT_ANIMATION_STUDIO,
  DEFAULT_BATCH_STUDIO,
  BATCH_ACCENTS,
  accentPalette,
  buildAnimationDocument,
  layersForPage,
  readBatchLook,
  sanitizeAnimations,
  sanitizeBatchStudio,
} from '../lib/studio-config';
import { DEFAULT_SITE_CONFIG, SITE_SETTING_KEYS, mergeSiteConfig } from '../lib/site-config';
import { validateSettingValue } from '../lib/site-validation';
import { BatchShowcase, prepareBatches } from '../components/batches/BatchShowcase';

vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) =>
    React.createElement('a', { href, ...rest }, children),
}));

function batch(overrides: Partial<CourseCatalogItem> = {}): CourseCatalogItem {
  return {
    id: 'batch-1',
    kind: 'batch',
    title: 'JEE 2027 Rank Accelerator',
    description: '120 lectures, 24 tests and a daily planner.',
    exam: 'JEE',
    classes: ['11', '12'],
    active: true,
    metadata: {
      thumbnailUrl: 'https://example.com/cover.jpg',
      studio: {
        accent: 'violet',
        motion: 'zoom-in',
        badge: 'New',
        instructor: 'A. Sharma',
        seats: 40,
        pages: ['home'],
        startsAt: '2026-12-01T10:00:00.000Z',
        reward: { enabled: true, type: 'badge', label: 'Golden badge', value: '+250 XP', icon: '🏅' },
        features: [
          { id: 'f1', label: 'Daily planner', icon: '✓' },
          { id: 'f2', label: 'Doubt sessions', icon: '💬' },
        ],
      },
    },
    created_at: '2026-10-01T00:00:00.000Z',
    updated_at: '2026-10-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('Batch Studio + Animation Studio model', () => {
  it('registers both experience settings as first-class site settings', () => {
    expect(SITE_SETTING_KEYS).toContain('batchStudio');
    expect(SITE_SETTING_KEYS).toContain('animations');
    expect(validateSettingValue('batchStudio', DEFAULT_BATCH_STUDIO)).toEqual({ ok: true, errors: [] });
    expect(validateSettingValue('animations', DEFAULT_ANIMATION_STUDIO)).toEqual({ ok: true, errors: [] });
  });

  it('sanitises malformed batch-studio and animation-studio payloads without crashing', () => {
    const studio = sanitizeBatchStudio({
      enabled: 'yes',
      layout: 'explode',
      pages: ['home', 'not-a-page'],
      accentCycle: ['violet', 'not-a-colour'],
      maxItems: 99,
    });
    expect(studio.enabled).toBe(DEFAULT_BATCH_STUDIO.enabled);
    expect(studio.layout).toBe(DEFAULT_BATCH_STUDIO.layout);
    expect(studio.pages).toEqual(['home']);
    expect(studio.accentCycle).toEqual(['violet']);
    expect(studio.maxItems).toBe(12);

    const animations = sanitizeAnimations({
      enabled: true,
      layers: [
        { id: 'a', name: 'Confetti', pages: ['home'], html: '<b>Hi</b>', css: 'b{}', js: 'console.log(1)' },
        { id: 'b', name: 'Empty', pages: ['home'], html: '', css: '', js: '' },
        { id: 'c', name: 'Huge delay', pages: ['tests'], html: '<i>x</i>', delayMs: 9999999 },
      ],
    });
    expect(animations.layers).toHaveLength(2);
    expect(animations.layers[0].html).toContain('<b>Hi</b>');
    expect(animations.layers[1].delayMs).toBe(120000);
  });

  it('merges new setting keys through the published-config pipeline', () => {
    const merged = mergeSiteConfig({
      batchStudio: { title: 'Featured programmes', layout: 'tile', pages: ['lectures'] } as never,
      animations: {
        layers: [{ id: 'l1', name: 'Ribbon', pages: ['home'], html: '<p>Hey</p>' }],
      } as never,
    });
    expect(merged.batchStudio.title).toBe('Featured programmes');
    expect(merged.batchStudio.layout).toBe('tile');
    expect(merged.batchStudio.pages).toEqual(['lectures']);
    expect(merged.animations.layers).toHaveLength(1);
    expect(merged.animations.layers[0].name).toBe('Ribbon');
    // Defaults still fill every untouched field.
    expect(merged.batchStudio.accentCycle.length).toBeGreaterThan(0);
    expect(DEFAULT_SITE_CONFIG.animations.enabled).toBe(true);
  });

  it('filters animation layers by page, audience and schedule window', () => {
    const config: AnimationStudioConfig = {
      enabled: true,
      respectReducedMotion: true,
      layers: [
        {
          id: 'jee-home',
          name: 'JEE home popup',
          enabled: true,
          surface: 'overlay',
          pages: ['home'],
          audience: 'JEE-12',
          trigger: 'page_load',
          delayMs: 0,
          durationMs: 0,
          frequency: 'once_session',
          caption: '',
          html: '<p>JEE</p>',
          css: '',
          js: '',
          backdrop: 'dim',
          dismissible: true,
          reward: { label: '', icon: '', href: '', claimLabel: '' },
          startAt: '2026-10-01T00:00:00.000Z',
          endAt: '2026-12-01T00:00:00.000Z',
          priority: 5,
          updatedAt: '',
        },
        {
          id: 'expired',
          name: 'Expired',
          enabled: true,
          surface: 'banner',
          pages: ['home'],
          audience: 'all',
          trigger: 'page_load',
          delayMs: 0,
          durationMs: 0,
          frequency: 'always',
          caption: '',
          html: '<p>old</p>',
          css: '',
          js: '',
          backdrop: 'none',
          dismissible: true,
          reward: { label: '', icon: '', href: '', claimLabel: '' },
          startAt: '2020-01-01T00:00:00.000Z',
          endAt: '2021-01-01T00:00:00.000Z',
          priority: 99,
          updatedAt: '',
        },
      ],
    };
    const now = Date.parse('2026-10-22T00:00:00.000Z');
    expect(layersForPage(config, 'home', { exam: 'JEE', classLevel: '12' }, now).map((layer) => layer.id)).toEqual([
      'jee-home',
    ]);
    expect(layersForPage(config, 'home', { exam: 'NEET', classLevel: '12' }, now)).toEqual([]);
    expect(layersForPage({ ...config, enabled: false }, 'home', { exam: 'JEE', classLevel: '12' }, now)).toEqual([]);
  });

  it('builds a sandbox-ready document with the authored code', () => {
    const doc = buildAnimationDocument({ html: '<div id="x">Hi</div>', css: '#x{color:red}', js: 'console.log(1)' });
    expect(doc).toContain('<div id="x">Hi</div>');
    expect(doc).toContain('#x{color:red}');
    expect(doc).toContain('console.log(1)');
    expect(doc.startsWith('<!doctype html>')).toBe(true);
  });

  it('reads per-batch look metadata with safe fallbacks', () => {
    const look = readBatchLook(batch().metadata as Record<string, unknown>);
    expect(look.accent).toBe('violet');
    expect(look.motion).toBe('zoom-in');
    expect(look.imageUrl).toBe('https://example.com/cover.jpg');
    expect(look.reward.enabled).toBe(true);
    expect(look.features).toHaveLength(2);

    const bare = readBatchLook(null);
    expect(bare.accent).toBe('auto');
    expect(bare.reward.enabled).toBe(false);
    expect(bare.features).toEqual([]);
    expect(accentPalette(bare.accent, 3).id).toBe(BATCH_ACCENTS[3].id);
  });

  it('prepares only the batches each student should see, on the right page', () => {
    const config: BatchShowcaseConfig = { ...DEFAULT_BATCH_STUDIO, pages: ['home'], maxItems: 6, accentCycle: ['violet'] };
    const visible = prepareBatches(
      [
        batch(),
        batch({ id: 'neet', exam: 'NEET' }),
        batch({ id: 'old', metadata: { studio: { endsAt: '2020-01-01T00:00:00.000Z' } } }),
        batch({ id: 'tests-only', metadata: { studio: { pages: ['tests'] } } }),
      ],
      config,
      { exam: 'JEE', classLevel: '12' },
      'home'
    );
    expect(visible.map((entry) => entry.item.id)).toEqual(['batch-1']);
    expect(visible[0].accent.id).toBe('violet');
  });

  it('honours the global Batch Studio page placement', () => {
    const config: BatchShowcaseConfig = {
      ...DEFAULT_BATCH_STUDIO,
      enabled: true,
      pages: ['lectures'],
    };
    expect(prepareBatches([batch()], config, { exam: 'JEE', classLevel: '12' }, 'home')).toEqual([]);
    expect(prepareBatches([batch({ metadata: { studio: { pages: ['lectures'] } } })], config, { exam: 'JEE', classLevel: '12' }, 'lectures')).toHaveLength(1);
  });

  it('renders hero artwork and honours a safe per-batch CTA link', () => {
    const source = batch({
      metadata: {
        thumbnailUrl: 'https://example.com/cover.jpg',
        studio: {
          heroImageUrl: 'https://example.com/hero.jpg',
          ctaLabel: 'View tests',
          ctaHref: '/tests',
          pages: ['home'],
        },
      },
    });
    const html = renderToString(
      React.createElement(BatchShowcase, {
        batches: [source],
        config: DEFAULT_BATCH_STUDIO,
        student: { exam: 'JEE', classLevel: '12' },
        page: 'home',
      })
    );
    expect(html).toContain('src="https://example.com/hero.jpg"');
    expect(html).toContain('href="/tests"');
    expect(html).toContain('View tests');

    const minimalHtml = renderToString(
      React.createElement(BatchShowcase, {
        batches: [source],
        config: { ...DEFAULT_BATCH_STUDIO, layout: 'minimal' },
        student: { exam: 'JEE', classLevel: '12' },
        page: 'home',
      })
    );
    expect(minimalHtml).toContain('href="/tests"');
  });

  it('renders the colour-coded showcase card markup', () => {
    const html = renderToString(
      React.createElement(BatchShowcase, {
        batches: [batch()],
        config: DEFAULT_BATCH_STUDIO,
        student: { exam: 'JEE', classLevel: '12' },
        page: 'home',
      })
    );
    expect(html).toContain('JEE 2027 Rank Accelerator');
    expect(html).toContain('Golden badge');
    expect(html).toContain('Daily planner');
    expect(html).toContain('ec-batch-card');
    expect(html).toContain('A. Sharma');
  });
});

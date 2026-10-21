import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { SiteConfig } from '../types';
import {
  DEFAULT_SCREEN_CONFIGS,
  SCREEN_DEFINITIONS,
  SCREEN_KEYS,
  baseScreen,
  sanitizeLecturesScreen,
  sanitizeScreenSections,
  screenDefinition,
  visibleSectionIds,
} from '../lib/screen-config';
import {
  DEFAULT_SITE_CONFIG,
  SITE_SETTING_KEYS,
  defaultForSetting,
  mergeSiteConfig,
  sanitizeSiteConfig,
} from '../lib/site-config';
import { isScreenSettingKey, validateScreen, validateSettingValue } from '../lib/site-validation';

describe('Screen Studio configuration model', () => {
  it('exposes every manageable student screen as a settings key', () => {
    for (const key of SCREEN_KEYS) {
      expect(SITE_SETTING_KEYS).toContain(key);
      expect(isScreenSettingKey(key)).toBe(true);
      expect(DEFAULT_SITE_CONFIG[key]).toBeTruthy();
      expect(defaultForSetting(key)).toEqual(DEFAULT_SCREEN_CONFIGS[key]);
    }
    // Login/signup stay outside the editor.
    expect(SCREEN_KEYS).not.toContain('login' as never);
    expect(SCREEN_DEFINITIONS.some((screen) => screen.slug === 'login')).toBe(false);
    expect(SCREEN_DEFINITIONS.some((screen) => screen.route.startsWith('/login'))).toBe(false);
  });

  it('ships defaults that pass validation for every screen', () => {
    for (const key of SCREEN_KEYS) {
      const result = validateSettingValue(key, DEFAULT_SITE_CONFIG[key]);
      expect({ key, errors: result.errors }).toEqual({ key, errors: [] });
    }
    // And after the full sanitise/merge round-trip.
    const merged = mergeSiteConfig({});
    for (const key of SCREEN_KEYS) {
      expect(validateSettingValue(key, merged[key]).ok).toBe(true);
    }
  });

  it('sanitises stored section lists: allowlist, required blocks, order', () => {
    const sections = sanitizeScreenSections('profile', [
      { id: 'quick_links', visible: false, title: 'Shortcuts' },
      { id: 'not_a_section', visible: true },
      { id: 'identity', visible: false, title: 'Hacked' },
      { id: 'quick_links', visible: true },
    ]);
    expect(sections.map((section) => section.id)).toEqual([
      'quick_links',
      'identity',
      'stats',
      'level',
      'recent_attempts',
      'lesson_progress',
      'score_summary',
    ]);
    expect(sections[0]).toMatchObject({ id: 'quick_links', visible: false, title: 'Shortcuts' });
    // Required block cannot be hidden, but a custom heading is preserved.
    expect(sections[1]).toMatchObject({ id: 'identity', visible: true, title: 'Hacked' });
    // Unknown ids never survive.
    expect(sections.some((section) => section.id === 'not_a_section')).toBe(false);
  });

  it('resolves visible section order for student pages', () => {
    const config = sanitizeLecturesScreen({
      ...DEFAULT_SCREEN_CONFIGS.lectures,
      sections: [
        { id: 'access_note', visible: true },
        { id: 'tabs', visible: true },
        { id: 'filters', visible: false },
        { id: 'catalogue', visible: true },
      ],
    });
    expect(visibleSectionIds('lectures', config)).toEqual(['access_note', 'tabs', 'catalogue']);
  });

  it('rejects unsafe or incomplete screen documents', () => {
    expect(validateScreen('tests', { ...DEFAULT_SCREEN_CONFIGS.tests, pageTitle: '   ' }).ok).toBe(false);
    expect(
      validateScreen('tests', {
        ...DEFAULT_SCREEN_CONFIGS.tests,
        sections: [
          { id: 'catalogue', visible: false },
          { id: 'filters', visible: true },
        ],
      }).errors.join(' ')
    ).toMatch(/cannot be hidden/i);
    expect(
      validateScreen('tests', {
        ...DEFAULT_SCREEN_CONFIGS.tests,
        announcement: {
          enabled: true,
          title: 'New test',
          body: '',
          ctaLabel: 'Open',
          ctaHref: 'javascript:alert(1)',
          tone: 'brand',
        },
      }).ok
    ).toBe(false);
    expect(validateScreen('tests', { ...DEFAULT_SCREEN_CONFIGS.tests, itemLimit: 500 }).ok).toBe(false);
    expect(
      validateScreen('search', {
        ...DEFAULT_SCREEN_CONFIGS.search,
        suggestions: new Array(30).fill('x'),
      }).ok
    ).toBe(false);
    expect(
      validateScreen('profile', {
        ...DEFAULT_SCREEN_CONFIGS.profile,
        sections: [{ id: 'unknown', visible: true }],
      }).ok
    ).toBe(false);
  });

  it('falls back to safe defaults when stored values are malformed', () => {
    const merged = mergeSiteConfig({
      lectures: {
        pageTitle: '',
        itemLimit: 900,
        tabLabels: { batches: '', series: 42 },
        sections: 'not-an-array',
      } as unknown as SiteConfig['lectures'],
      leaderboard: null as unknown as SiteConfig['leaderboard'],
    });
    expect(merged.lectures.pageTitle).toBe(DEFAULT_SCREEN_CONFIGS.lectures.pageTitle);
    expect(merged.lectures.itemLimit).toBe(48);
    expect(merged.lectures.tabLabels.batches).toBe(DEFAULT_SCREEN_CONFIGS.lectures.tabLabels.batches);
    expect(Array.isArray(merged.lectures.sections)).toBe(true);
    expect(merged.leaderboard.pageTitle).toBe(DEFAULT_SCREEN_CONFIGS.leaderboard.pageTitle);
    expect(validateSettingValue('lectures', merged.lectures).ok).toBe(true);
  });

  it('keeps published screen values while new keys default safely', () => {
    const merged = mergeSiteConfig({
      tests: { ...DEFAULT_SCREEN_CONFIGS.tests, pageTitle: 'Weekly mock exams' },
    });
    expect(merged.tests.pageTitle).toBe('Weekly mock exams');
    expect(merged.chat.pageTitle).toBe(DEFAULT_SCREEN_CONFIGS.chat.pageTitle);
    expect(sanitizeSiteConfig(merged).tests.pageTitle).toBe('Weekly mock exams');
  });

  it('keeps the admin registry and student pages consistent', () => {
    for (const definition of SCREEN_DEFINITIONS) {
      const config = baseScreen(definition.key);
      expect(config.pageTitle.length).toBeGreaterThan(0);
      expect(screenDefinition(definition.key).route).toBe(definition.route);
      for (const section of definition.sections) {
        expect(typeof section.required === 'boolean' || section.required === undefined).toBe(true);
      }
    }
    // No duplicate slugs or keys.
    expect(new Set(SCREEN_DEFINITIONS.map((item) => item.slug)).size).toBe(SCREEN_DEFINITIONS.length);
    expect(new Set(SCREEN_DEFINITIONS.map((item) => item.key)).size).toBe(SCREEN_DEFINITIONS.length);
  });

  it('mirrors the screen allowlist and required sections in the Supabase Edge Function', () => {
    const source = readFileSync(
      resolve(__dirname, '../../supabase/functions/ec-site-api/index.ts'),
      'utf8'
    );
    for (const definition of SCREEN_DEFINITIONS) {
      expect(source).toContain(`"${definition.key}"`);
      for (const section of definition.sections) {
        expect(source).toContain(`id: "${section.id}", required: ${section.required ? 'true' : 'false'}`);
      }
    }
    // Login is a stored contract but must not be an editable Screen Studio entry.
    expect(source).not.toMatch(/login:\s*\[/);
  });
});

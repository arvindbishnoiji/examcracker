import { describe, expect, it } from 'vitest';
import type { Banner, HomeSectionConfig, NoticePopup, Testimonial } from '../types';
import {
  audienceMatches,
  createHomeSection,
  DEFAULT_SITE_CONFIG,
  DEFAULT_TESTIMONIALS,
  DEFAULT_THEME,
  getBannerState,
  getHomeSectionsForStudent,
  getPopupState,
  isBannerVisible,
  markPopupSeen,
  mergeSiteConfig,
  moveSection,
  pickPopupForPlacement,
  popupShouldDisplay,
  sanitizeSiteConfig,
  selectBannersForPlacement,
} from '../lib/site-config';
import { validateSettingValue } from '../lib/site-validation';
import { DEFAULT_LECTURES_SCREEN } from '../lib/screen-config';
import { THEME_PRESETS } from '../lib/theme';

const NOW = Date.parse('2026-10-20T10:00:00.000Z');

function banner(overrides: Partial<Banner> = {}): Banner {
  return {
    id: 'banner-1',
    title: 'JEE Main crash course',
    subtitle: '',
    description: '',
    badge: '',
    desktopImageUrl: '',
    mobileImageUrl: '',
    backgroundColor: '#1d4ed8',
    overlay: 40,
    textAlign: 'left',
    ctaLabel: 'Explore',
    ctaHref: '/lectures',
    placements: ['home_hero'],
    audience: 'all',
    startAt: '',
    endAt: '',
    timezone: 'Asia/Kolkata',
    priority: 0,
    status: 'published',
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
    ...overrides,
  };
}

function popup(overrides: Partial<NoticePopup> = {}): NoticePopup {
  return {
    id: 'popup-1',
    title: 'Schedule change',
    body: 'Tomorrow’s test starts at 7 PM.',
    imageUrl: '',
    ctaLabel: '',
    ctaHref: '',
    active: true,
    frequency: 'once_day',
    placements: ['home'],
    audience: 'all',
    startAt: '',
    endAt: '',
    priority: 0,
    dismissible: true,
    updatedAt: '2026-10-01T00:00:00.000Z',
    ...overrides,
  };
}

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
    removeItem: (key: string) => {
      data.delete(key);
    },
  };
}

describe('Banner scheduling and targeting', () => {
  it('derives real states from status and IST schedule', () => {
    expect(getBannerState(banner(), NOW)).toBe('active');
    expect(getBannerState(banner({ status: 'draft' }), NOW)).toBe('draft');
    expect(getBannerState(banner({ status: 'paused' }), NOW)).toBe('paused');
    expect(getBannerState(banner({ status: 'archived' }), NOW)).toBe('archived');
    expect(getBannerState(banner({ startAt: '2026-10-21T00:00:00.000Z' }), NOW)).toBe('scheduled');
    expect(getBannerState(banner({ endAt: '2026-10-19T00:00:00.000Z' }), NOW)).toBe('expired');
  });

  it('only exposes published, in-window banners to the matching placement and audience', () => {
    const jee12 = { exam: 'JEE', classLevel: '12' };
    expect(isBannerVisible(banner(), jee12, 'home_hero', NOW)).toBe(true);
    expect(isBannerVisible(banner(), jee12, 'login', NOW)).toBe(false);
    expect(isBannerVisible(banner({ status: 'draft' }), jee12, 'home_hero', NOW)).toBe(false);
    expect(isBannerVisible(banner({ audience: 'NEET' }), jee12, 'home_hero', NOW)).toBe(false);
    expect(isBannerVisible(banner({ audience: 'JEE-12' }), jee12, 'home_hero', NOW)).toBe(true);
    expect(isBannerVisible(banner({ audience: 'JEE-11' }), jee12, 'home_hero', NOW)).toBe(false);
  });

  it('sorts eligible banners by priority and drops the rest', () => {
    const config = {
      items: [
        banner({ id: 'low', priority: 1 }),
        banner({ id: 'high', priority: 9 }),
        banner({ id: 'paused', status: 'paused', priority: 20 }),
        banner({ id: 'login-only', placements: ['login'], priority: 30 }),
      ],
      autoplay: true,
      rotationSeconds: 6,
      showDots: true,
      showArrows: true,
    };
    const selected = selectBannersForPlacement(config, { exam: 'JEE', classLevel: '12' }, 'home_hero', NOW);
    expect(selected.map((item) => item.id)).toEqual(['high', 'low']);
  });
});

describe('Homepage sections', () => {
  it('filters hidden and non-matching sections while preserving order', () => {
    const sections: HomeSectionConfig[] = [
      { ...createHomeSection('hero', 0), id: 'a' },
      { ...createHomeSection('goal', 1), id: 'b', visible: false },
      { ...createHomeSection('events', 2), id: 'c', audience: 'NEET' },
      { ...createHomeSection('announcements', 3), id: 'd', audience: 'JEE-12' },
    ];
    const visible = getHomeSectionsForStudent(
      { showGreeting: true, greetingTemplate: 'Hi {name}', showSearch: true, showQuickStats: true, sections },
      { exam: 'JEE', classLevel: '12' }
    );
    expect(visible.map((section) => section.id)).toEqual(['a', 'd']);
  });

  it('defaults to a batch-first student path with structured series and secondary all-lecture browsing', () => {
    const sections = getHomeSectionsForStudent(DEFAULT_SITE_CONFIG.homepage, { exam: 'JEE', classLevel: '11' });
    const types = sections.map((section) => section.type);
    expect(types.indexOf('featured_batches')).toBeGreaterThanOrEqual(0);
    expect(types.indexOf('featured_series')).toBeGreaterThan(types.indexOf('featured_batches'));
    expect(types.indexOf('continue_learning')).toBeGreaterThan(types.indexOf('featured_series'));
    expect(types.indexOf('live_tests')).toBeGreaterThan(types.indexOf('continue_learning'));
    expect(DEFAULT_LECTURES_SCREEN.tabLabels.batches).toBe('Batches');
    expect(DEFAULT_LECTURES_SCREEN.tabLabels.lectures).toBe('All lectures');
  });

  it('moves sections without mutating the original array', () => {
    const original: HomeSectionConfig[] = [
      { ...createHomeSection('hero', 0), id: 'a' },
      { ...createHomeSection('goal', 1), id: 'b' },
      { ...createHomeSection('events', 2), id: 'c' },
    ];
    const moved = moveSection(original, 0, 2);
    expect(moved.map((section) => section.id)).toEqual(['b', 'c', 'a']);
    expect(original.map((section) => section.id)).toEqual(['a', 'b', 'c']);
    expect(moveSection(original, 0, 99)).toBe(original);
  });

  it('creates real, publishable defaults for every section type', () => {
    for (const type of ['hero', 'goal', 'upcoming_tests', 'live_tests', 'events', 'featured_batches', 'featured_series', 'continue_learning', 'popular_lectures', 'subject_shortcuts', 'study_progress', 'announcements', 'challenges', 'leaderboard_preview', 'quick_links', 'promo', 'custom', 'testimonials'] as const) {
      const section = createHomeSection(type, 0);
      expect(section.type).toBe(type);
      expect(section.id.length).toBeGreaterThan(4);
      expect(section.visible).toBe(true);
      expect(section.title.length).toBeGreaterThan(0);
      expect(section.limit).toBeGreaterThan(0);
    }
    expect(validateSettingValue('homepage', { showGreeting: true, greetingTemplate: 'Hi', showSearch: true, showQuickStats: true, sections: [createHomeSection('hero', 0)] }).ok).toBe(true);
  });
});

describe('Popup frequency rules', () => {
  it('derives states from active flag and schedule', () => {
    expect(getPopupState(popup(), NOW)).toBe('active');
    expect(getPopupState(popup({ active: false }), NOW)).toBe('paused');
    expect(getPopupState(popup({ startAt: '2026-10-22T00:00:00.000Z' }), NOW)).toBe('scheduled');
    expect(getPopupState(popup({ endAt: '2026-10-01T00:00:00.000Z' }), NOW)).toBe('expired');
  });

  it('respects placement, audience and once-per-day frequency', () => {
    const jee12 = { exam: 'JEE', classLevel: '12' };
    const storage = memoryStorage();
    expect(popupShouldDisplay(popup(), jee12, 'home', storage, NOW)).toBe(true);
    expect(popupShouldDisplay(popup({ placements: ['login'] }), jee12, 'home', storage, NOW)).toBe(false);
    expect(popupShouldDisplay(popup({ audience: 'NEET' }), jee12, 'home', storage, NOW)).toBe(false);

    markPopupSeen(popup(), storage, NOW);
    expect(popupShouldDisplay(popup(), jee12, 'home', storage, NOW)).toBe(false);
    expect(popupShouldDisplay(popup(), jee12, 'home', memoryStorage(), NOW + 86400000)).toBe(true);
  });

  it('picks the highest priority eligible popup', () => {
    const result = pickPopupForPlacement(
      {
        items: [
          popup({ id: 'low', priority: 1 }),
          popup({ id: 'high', priority: 7 }),
          popup({ id: 'paused', priority: 99, active: false }),
        ],
      },
      { exam: 'JEE', classLevel: '12' },
      'home',
      memoryStorage(),
      NOW
    );
    expect(result?.id).toBe('high');
  });
});

describe('Theme and settings sanitisation', () => {
  it('ships five real presets that change theme fields', () => {
    expect(THEME_PRESETS.length).toBeGreaterThanOrEqual(5);
    const ids = THEME_PRESETS.map((preset) => preset.id);
    for (const id of ['modern', 'minimal', 'academic', 'dark-premium', 'colorful-learning']) {
      expect(ids).toContain(id);
    }
    const merged = mergeSiteConfig({ theme: THEME_PRESETS[4].patch as never });
    expect(merged.theme.primaryColor).not.toBe(DEFAULT_THEME.primaryColor);
  });

  it('rejects malformed theme and login payloads', () => {
    const badTheme = validateSettingValue('theme', { ...DEFAULT_THEME, primaryColor: 'blue' });
    expect(badTheme.ok).toBe(false);

    const badLogin = validateSettingValue('login', { title: '', emailLabel: '', passwordLabel: '' });
    expect(badLogin.ok).toBe(false);

    const goodLogin = mergeSiteConfig({});
    expect(validateSettingValue('login', goodLogin.login).ok).toBe(true);
  });

  it('caps stored arrays and drops invalid testimonial URLs', () => {
    const items: Testimonial[] = Array.from({ length: 60 }).map((_, index) => ({
      ...DEFAULT_TESTIMONIALS.items[0],
      id: `t-${index}`,
      name: `Student ${index}`,
      quote: 'Great experience',
      avatarUrl: 'javascript:alert(1)',
    }));
    const sanitized = sanitizeSiteConfig({ ...mergeSiteConfig({}), testimonials: { ...DEFAULT_TESTIMONIALS, items } });
    expect(sanitized.testimonials.items.length).toBeLessThanOrEqual(40);
    for (const item of sanitized.testimonials.items) {
      expect(item.avatarUrl).toBe('');
    }
  });

  it('matches the seven audience targets used by the admin pickers', () => {
    const jee12 = { exam: 'JEE', classLevel: '12' };
    expect(audienceMatches('all', jee12)).toBe(true);
    expect(audienceMatches('JEE', jee12)).toBe(true);
    expect(audienceMatches('NEET', jee12)).toBe(false);
    expect(audienceMatches('JEE-12', jee12)).toBe(true);
    expect(audienceMatches('JEE-11', jee12)).toBe(false);
    expect(audienceMatches('NEET-12', jee12)).toBe(false);
    expect(audienceMatches('JEE', null)).toBe(false);
  });
});

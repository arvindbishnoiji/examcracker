import type {
  AnimationStudioConfig,
  BannersConfig,
  ChallengesConfig,
  FeatureFlags,
  FooterConfig,
  HomepageConfig,
  LoginConfig,
  MediaConfig,
  NavigationConfig,
  PopupsConfig,
  BatchShowcaseConfig,
  SeoConfig,
  SiteSettingKey,
  TestimonialsConfig,
  ThemeConfig,
} from '@/types';
import { isSafeHttpUrl, isValidInternalDeepLink } from './validation';
import { isHexColor } from './theme';
import { parseSchedule } from './site-config';
import {
  SCREEN_DEFINITIONS,
  type ScreenKey,
  screenDefinition,
} from './screen-config';

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}

function result(errors: string[]): ValidationResult {
  return { ok: errors.length === 0, errors };
}

function text(
  value: unknown,
  label: string,
  { min = 0, max = 400, required = false }: { min?: number; max?: number; required?: boolean } = {}
): string | null {
  if (typeof value !== 'string') return `${label} must be text.`;
  const trimmed = value.trim();
  if (required && trimmed.length < Math.max(1, min)) return `${label} is required.`;
  if (trimmed.length > 0 && trimmed.length < min) return `${label} must be at least ${min} characters.`;
  if (trimmed.length > max) return `${label} must be ${max} characters or fewer.`;
  return null;
}

export function isEmptyOrHttpUrl(value: unknown): boolean {
  if (value === undefined || value === null || value === '') return true;
  return typeof value === 'string' && isSafeHttpUrl(value);
}

export function isEmptyOrInternalLink(value: unknown): boolean {
  if (value === undefined || value === null || value === '') return true;
  if (typeof value !== 'string') return false;
  return isValidInternalDeepLink(value) || isSafeHttpUrl(value);
}

function validateSchedule(startAt: unknown, endAt: unknown, label: string): string[] {
  const errors: string[] = [];
  const start = typeof startAt === 'string' ? parseSchedule(startAt) : null;
  const end = typeof endAt === 'string' ? parseSchedule(endAt) : null;
  if (startAt && start === null) errors.push(`${label} start date is invalid.`);
  if (endAt && end === null) errors.push(`${label} end date is invalid.`);
  if (start !== null && end !== null && start >= end) {
    errors.push(`${label} end date must be after the start date.`);
  }
  return errors;
}

export function validateTheme(theme: ThemeConfig): ValidationResult {
  const errors: string[] = [];
  const nameError = text(theme.brandName, 'Brand name', { max: 80, required: true });
  if (nameError) errors.push(nameError);
  if (text(theme.logoText, 'Logo initials', { max: 6 })) errors.push('Logo initials must be 6 characters or fewer.');
  if (text(theme.tagline, 'Tagline', { max: 140 })) errors.push('Tagline must be 140 characters or fewer.');
  for (const [key, label] of [
    ['primaryColor', 'Primary colour'],
    ['secondaryColor', 'Secondary colour'],
    ['accentColor', 'Accent colour'],
    ['backgroundColor', 'Background colour'],
    ['surfaceColor', 'Surface colour'],
    ['textColor', 'Text colour'],
  ] as const) {
    if (!isHexColor(theme[key])) errors.push(`${label} must be a valid hex colour.`);
  }
  if (theme.radius < 0 || theme.radius > 32) errors.push('Corner radius must be between 0 and 32px.');
  if (!isEmptyOrHttpUrl(theme.logoUrl)) errors.push('Logo URL must be a valid http(s) URL.');
  if (!isEmptyOrHttpUrl(theme.faviconUrl)) errors.push('Favicon URL must be a valid http(s) URL.');
  if (text(theme.emptyStateTitle, 'Empty-state title', { max: 120 })) errors.push('Empty-state title must be 120 characters or fewer.');
  if (text(theme.emptyStateBody, 'Empty-state message', { max: 400 })) errors.push('Empty-state message must be 400 characters or fewer.');
  return result(errors);
}

export function validateLogin(login: LoginConfig): ValidationResult {
  const errors: string[] = [];
  const checks: Array<[string | null, string]> = [
    [text(login.title, 'Login title', { max: 120, required: true }), 'Login title is required (120 characters max).'],
    [text(login.subtitle, 'Login subtitle', { max: 240 }), 'Login subtitle must be 240 characters or fewer.'],
    [text(login.welcomeMessage, 'Welcome message', { max: 400 }), 'Welcome message must be 400 characters or fewer.'],
    [text(login.emailLabel, 'Email label', { max: 60, required: true }), 'Email label is required.'],
    [text(login.passwordLabel, 'Password label', { max: 60, required: true }), 'Password label is required.'],
    [text(login.heroTitle, 'Hero title', { max: 180 }), 'Hero title must be 180 characters or fewer.'],
    [text(login.heroSubtitle, 'Hero subtitle', { max: 500 }), 'Hero subtitle must be 500 characters or fewer.'],
    [text(login.footerText, 'Footer text', { max: 400 }), 'Footer text must be 400 characters or fewer.'],
    [text(login.bannerTitle, 'Banner title', { max: 120 }), 'Banner title must be 120 characters or fewer.'],
    [text(login.bannerBody, 'Banner body', { max: 400 }), 'Banner body must be 400 characters or fewer.'],
  ];
  for (const [error, message] of checks) if (error) errors.push(message);

  for (const [key, label] of [
    ['backgroundColor', 'Background colour'],
    ['gradientFrom', 'Gradient start colour'],
    ['gradientTo', 'Gradient end colour'],
  ] as const) {
    if (!isHexColor(login[key])) errors.push(`${label} must be a valid hex colour.`);
  }
  if (login.backgroundType === 'image' && !isEmptyOrHttpUrl(login.backgroundImageUrl)) {
    errors.push('Background image must be a valid http(s) URL.');
  }
  if (!isEmptyOrHttpUrl(login.heroImageUrl)) errors.push('Hero image must be a valid http(s) URL.');
  if (!isEmptyOrHttpUrl(login.logoUrl)) errors.push('Login logo must be a valid http(s) URL.');
  if (!isEmptyOrInternalLink(login.bannerCtaHref)) errors.push('Banner CTA must be an internal route or http(s) link.');
  if (!isEmptyOrInternalLink(login.termsUrl)) errors.push('Terms link must be an internal route or http(s) link.');
  if (!isEmptyOrInternalLink(login.privacyUrl)) errors.push('Privacy link must be an internal route or http(s) link.');
  const highlights = Array.isArray(login.highlights) ? login.highlights : [];
  const footerLinks = Array.isArray(login.footerLinks) ? login.footerLinks : [];
  if (highlights.length > 8) errors.push('Keep highlights to 8 items or fewer.');
  for (const highlight of highlights) {
    if (text(highlight, 'Highlight', { max: 200, required: true })) {
      errors.push('Each highlight must be 1–200 characters.');
      break;
    }
  }
  for (const link of footerLinks) {
    if (!text(link.label, 'Footer link label', { max: 80, required: true }) || !isEmptyOrInternalLink(link.href)) {
      errors.push('Login footer links need a label and a valid destination.');
      break;
    }
  }
  return result(errors);
}

export function validateHomepage(homepage: HomepageConfig): ValidationResult {
  const errors: string[] = [];
  if (homepage.sections.length === 0) {
    errors.push('Add at least one homepage section (or hide the whole homepage in Feature Toggles).');
  }
  if (homepage.sections.length > 40) errors.push('A maximum of 40 homepage sections is supported.');
  const ids = new Set<string>();
  for (const section of homepage.sections) {
    if (!section.id.trim() || ids.has(section.id)) errors.push('Every section needs a unique id.');
    ids.add(section.id);
    if (text(section.title, 'Section title', { max: 120 })) {
      errors.push('Section titles must be 120 characters or fewer.');
    }
    if (text(section.subtitle, 'Section subtitle', { max: 240 })) {
      errors.push('Section subtitles must be 240 characters or fewer.');
    }
    if (!isEmptyOrHttpUrl(section.imageUrl)) errors.push(`Section "${section.title || section.id}" has an invalid image URL.`);
    if (!isEmptyOrInternalLink(section.ctaHref)) errors.push(`Section "${section.title || section.id}" has an invalid CTA link.`);
    if (section.limit < 1 || section.limit > 24) errors.push('Section limits must be between 1 and 24.');
    if ((section.type === 'custom' || section.type === 'promo') && !section.body.trim() && !section.imageUrl) {
      errors.push(`Section "${section.title || section.id}" needs body text or an image.`);
    }
    for (const item of section.items || []) {
      if (text(item.title, 'Item title', { max: 80, required: true })) {
        errors.push(`Every card in "${section.title || section.id}" needs a title (80 characters max).`);
        break;
      }
      if (!isEmptyOrInternalLink(item.href)) {
        errors.push(`Card "${item.title}" in "${section.title || section.id}" has an invalid link.`);
        break;
      }
    }
  }
  if (text(homepage.greetingTemplate, 'Greeting template', { max: 120, required: true })) {
    errors.push('Greeting template is required (120 characters max).');
  }
  const hero = homepage.hero;
  if (hero) {
    if (text(hero.title, 'Hero heading', { max: 160, required: true })) {
      errors.push('Hero heading is required (160 characters max).');
    }
    if (text(hero.subtitle, 'Hero description', { max: 320 })) errors.push('Hero description must be 320 characters or fewer.');
    if (!isEmptyOrInternalLink(hero.primaryCtaHref)) errors.push('Hero primary button link must be an internal path such as /lectures.');
    if (!isEmptyOrInternalLink(hero.secondaryCtaHref)) errors.push('Hero secondary button link must be an internal path such as /tests.');
    if (!isEmptyOrHttpUrl(hero.imageUrl)) errors.push('Hero image must be an https:// URL.');
    if (hero.style === 'image' && !hero.imageUrl) errors.push('The "Full background image" hero style needs an image URL.');
    if (hero.backgroundColor && !/^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(hero.backgroundColor)) {
      errors.push('Hero background colour must be a hex value such as #1e3a8a.');
    }
  }
  return result(errors);
}

export function validateNavigation(nav: NavigationConfig): ValidationResult {
  const errors: string[] = [];
  for (const [list, label] of [
    [nav.headerLinks, 'Header'],
    [nav.bottomLinks, 'Bottom'],
  ] as const) {
    if (list.length > 10) errors.push(`${label} navigation supports at most 10 links.`);
    const ids = new Set<string>();
    for (const link of list) {
      if (!link.label.trim()) errors.push(`${label} links need a label.`);
      if (link.label.length > 40) errors.push(`${label} link labels must be 40 characters or fewer.`);
      if (!isValidInternalDeepLink(link.href)) errors.push(`${label} link "${link.label || link.id}" must point to an app route.`);
      if (ids.has(link.id)) errors.push(`${label} link ids must be unique.`);
      ids.add(link.id);
    }
  }
  if (nav.ctaLabel.trim() && !isValidInternalDeepLink(nav.ctaHref)) {
    errors.push('Header CTA needs a valid internal route.');
  }
  if (nav.announcementBarEnabled && !nav.announcementBarText.trim()) {
    errors.push('Announcement bar text is required when the bar is enabled.');
  }
  if (nav.announcementBarHref && !isValidInternalDeepLink(nav.announcementBarHref)) {
    errors.push('Announcement bar link must be an internal route.');
  }
  return result(errors);
}

export function validateFooter(footer: FooterConfig): ValidationResult {
  const errors: string[] = [];
  if (!footer.show) return result([]);
  if (text(footer.text, 'Footer text', { max: 300 })) errors.push('Footer text must be 300 characters or fewer.');
  if (footer.columns.length > 4) errors.push('The footer supports up to 4 link columns.');
  for (const column of footer.columns) {
    if (!column.title.trim()) errors.push('Footer columns need a title.');
    if (column.links.length > 8) errors.push('Footer columns support up to 8 links.');
    for (const link of column.links) {
      if (!link.label.trim() || !isEmptyOrInternalLink(link.href)) {
        errors.push(`Footer link in "${column.title}" needs a label and valid destination.`);
      }
    }
  }
  for (const link of footer.socialLinks) {
    if (!link.label.trim() || !isEmptyOrInternalLink(link.href)) {
      errors.push('Social links need a label and valid destination.');
    }
  }
  return result(errors);
}

export function validateBanners(config: BannersConfig): ValidationResult {
  const errors: string[] = [];
  if (config.items.length > 40) errors.push('At most 40 banners can be stored.');
  const ids = new Set<string>();
  for (const banner of config.items) {
    const label = banner.title || banner.id;
    if (!banner.title.trim()) errors.push('Every banner needs a title.');
    if (banner.title.length > 140) errors.push(`Banner "${label}" title must be 140 characters or fewer.`);
    if (ids.has(banner.id)) errors.push(`Banner id "${banner.id}" is duplicated.`);
    ids.add(banner.id);
    if (!banner.placements.length) errors.push(`Banner "${label}" needs at least one placement.`);
    if (!isEmptyOrHttpUrl(banner.desktopImageUrl)) errors.push(`Banner "${label}" desktop image must be a valid http(s) URL.`);
    if (!isEmptyOrHttpUrl(banner.mobileImageUrl)) errors.push(`Banner "${label}" mobile image must be a valid http(s) URL.`);
    if (banner.ctaLabel.trim() && !isEmptyOrInternalLink(banner.ctaHref)) {
      errors.push(`Banner "${label}" CTA needs an internal route or http(s) link.`);
    }
    if (banner.overlay < 0 || banner.overlay > 90) errors.push(`Banner "${label}" overlay must be between 0 and 90%.`);
    errors.push(...validateSchedule(banner.startAt, banner.endAt, `Banner "${label}"`));
    if (config.rotationSeconds < 3 || config.rotationSeconds > 20) {
      errors.push('Carousel rotation must be between 3 and 20 seconds.');
      break;
    }
  }
  return result(errors);
}

export function validatePopups(config: PopupsConfig): ValidationResult {
  const errors: string[] = [];
  if (config.items.length > 30) errors.push('At most 30 popups can be stored.');
  for (const popup of config.items) {
    if (!popup.title.trim()) errors.push('Every popup needs a title.');
    if (!popup.body.trim()) errors.push(`Popup "${popup.title || popup.id}" needs body text.`);
    if (!popup.placements.length) errors.push(`Popup "${popup.title}" needs at least one placement.`);
    if (!isEmptyOrHttpUrl(popup.imageUrl)) errors.push(`Popup "${popup.title}" image must be a valid http(s) URL.`);
    if (popup.ctaLabel.trim() && !isEmptyOrInternalLink(popup.ctaHref)) {
      errors.push(`Popup "${popup.title}" CTA needs an internal route or http(s) link.`);
    }
    errors.push(...validateSchedule(popup.startAt, popup.endAt, `Popup "${popup.title}"`));
  }
  return result(errors);
}

export function validateTestimonials(config: TestimonialsConfig): ValidationResult {
  const errors: string[] = [];
  for (const item of config.items) {
    if (!item.name.trim()) errors.push('Testimonials need a student name.');
    if (!item.quote.trim()) errors.push(`Testimonial from "${item.name || item.id}" needs a quote.`);
    if (item.quote.length > 500) errors.push('Testimonial quotes must be 500 characters or fewer.');
    if (!isEmptyOrHttpUrl(item.avatarUrl)) errors.push(`Testimonial from "${item.name}" has an invalid avatar URL.`);
    if (item.rating < 1 || item.rating > 5) errors.push('Testimonial ratings must be between 1 and 5.');
  }
  return result(errors);
}

export function validateChallenges(config: ChallengesConfig): ValidationResult {
  const errors: string[] = [];
  for (const challenge of config.items) {
    if (!challenge.title.trim()) errors.push('Challenges need a title.');
    if (challenge.targetType === 'checklist' && challenge.checklist.length === 0) {
      errors.push(`Challenge "${challenge.title || challenge.id}" needs at least one checklist item.`);
    }
    if (!challenge.targetCount || challenge.targetCount < 1) {
      errors.push(`Challenge "${challenge.title || challenge.id}" needs a positive target.`);
    }
    errors.push(...validateSchedule(challenge.startAt, challenge.endAt, `Challenge "${challenge.title}"`));
    if (!isHexColor(challenge.color)) errors.push(`Challenge "${challenge.title}" colour must be a hex value.`);
  }
  return result(errors);
}

export function validateFeatures(_features: FeatureFlags): ValidationResult {
  return result([]);
}

export function validateSeo(seo: SeoConfig): ValidationResult {
  const errors: string[] = [];
  if (text(seo.title, 'SEO title', { max: 120, required: true })) errors.push('SEO title is required (120 characters max).');
  if (text(seo.description, 'SEO description', { max: 400 })) errors.push('SEO description must be 400 characters or fewer.');
  if (!isEmptyOrHttpUrl(seo.ogImageUrl)) errors.push('Open Graph image must be a valid http(s) URL.');
  if (!isEmptyOrHttpUrl(seo.canonicalBase)) errors.push('Canonical base must be a valid http(s) URL.');
  if (seo.keywords.length > 20) errors.push('Keep keywords to 20 items or fewer.');
  if (seo.popularSearches.length > 20) errors.push('Keep popular searches to 20 items or fewer.');
  if (text(seo.searchPlaceholder, 'Search placeholder', { max: 120, required: true })) {
    errors.push('Search placeholder is required.');
  }
  return result(errors);
}

export function validateMedia(config: MediaConfig): ValidationResult {
  const errors: string[] = [];
  if (config.items.length > 300) errors.push('The media library supports up to 300 assets.');
  for (const asset of config.items) {
    if (!asset.name.trim()) errors.push('Media assets need a name.');
    if (!isSafeHttpUrl(asset.url)) errors.push(`Media asset "${asset.name || asset.id}" needs a valid http(s) URL.`);
  }
  return result(errors);
}


// ---------------------------------------------------------------------------
// Screen Studio documents
// ---------------------------------------------------------------------------

const SCREEN_KEYS: ScreenKey[] = SCREEN_DEFINITIONS.map((definition) => definition.key);

export function isScreenSettingKey(key: SiteSettingKey): key is ScreenKey {
  return (SCREEN_KEYS as SiteSettingKey[]).includes(key);
}

function validateScreenAnnouncement(value: unknown, label: string): string[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return [`${label}: the announcement banner is malformed.`];
  }
  const raw = value as Record<string, unknown>;
  const errors: string[] = [];
  if (raw.enabled !== true) return errors;
  const title = typeof raw.title === 'string' ? raw.title.trim() : '';
  if (!title) errors.push(`${label}: announcement title is required when the banner is enabled.`);
  if (title.length > 140) errors.push(`${label}: announcement title must be 140 characters or fewer.`);
  if (typeof raw.body === 'string' && raw.body.length > 600) {
    errors.push(`${label}: announcement message must be 600 characters or fewer.`);
  }
  const ctaLabel = typeof raw.ctaLabel === 'string' ? raw.ctaLabel.trim() : '';
  if (ctaLabel && !isEmptyOrInternalLink(raw.ctaHref)) {
    errors.push(`${label}: announcement button needs a valid internal route or https:// link.`);
  }
  return errors;
}

function validateScreenSections(key: ScreenKey, value: unknown): string[] {
  const definition = screenDefinition(key);
  const errors: string[] = [];
  if (!Array.isArray(value)) {
    return [`${definition.label}: sections must be a list.`];
  }
  const seen = new Set<string>();
  for (const item of value) {
    if (!item || typeof item !== 'object') {
      errors.push(`${definition.label}: a section entry is malformed.`);
      continue;
    }
    const id = String((item as Record<string, unknown>).id || '');
    if (!definition.sections.some((entry) => entry.id === id)) {
      errors.push(`${definition.label}: “${id || 'unknown'}” is not a supported section.`);
      continue;
    }
    seen.add(id);
    const title = (item as Record<string, unknown>).title;
    if (typeof title === 'string' && title.length > 120) {
      errors.push(`${definition.label}: section headings must be 120 characters or fewer.`);
    }
    const subtitle = (item as Record<string, unknown>).subtitle;
    if (typeof subtitle === 'string' && subtitle.length > 240) {
      errors.push(`${definition.label}: section descriptions must be 240 characters or fewer.`);
    }
  }
  for (const entry of definition.sections) {
    if (entry.required && !seen.has(entry.id)) {
      errors.push(`${definition.label}: the “${entry.label}” section is required.`);
    }
    if (entry.required) {
      const match = value.find(
        (item) => item && typeof item === 'object' && String((item as Record<string, unknown>).id) === entry.id
      ) as Record<string, unknown> | undefined;
      if (match && match.visible === false) {
        errors.push(`${definition.label}: “${entry.label}” cannot be hidden because the screen needs it.`);
      }
    }
  }
  return errors;
}

function validateScreenCommon(key: ScreenKey, value: unknown): string[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return [`${screenDefinition(key).label}: the screen configuration must be an object.`];
  }
  const raw = value as Record<string, unknown>;
  const definition = screenDefinition(key);
  const errors: string[] = [];

  if (typeof raw.pageTitle !== 'string' || !raw.pageTitle.trim()) {
    errors.push(`${definition.label}: the page heading is required.`);
  } else if (raw.pageTitle.length > 120) {
    errors.push(`${definition.label}: the page heading must be 120 characters or fewer.`);
  }
  if (typeof raw.pageSubtitle === 'string' && raw.pageSubtitle.length > 300) {
    errors.push(`${definition.label}: the page description must be 300 characters or fewer.`);
  }
  if (typeof raw.eyebrow === 'string' && raw.eyebrow.length > 60) {
    errors.push(`${definition.label}: the small label above the heading must be 60 characters or fewer.`);
  }
  if (raw.itemLimit !== undefined) {
    const limit = Number(raw.itemLimit);
    if (!Number.isFinite(limit) || limit < 0 || limit > 48) {
      errors.push(`${definition.label}: the item limit must be between 0 and 48.`);
    }
  }
  if (raw.layout !== undefined && !['grid', 'list', 'compact'].includes(String(raw.layout))) {
    errors.push(`${definition.label}: choose a supported layout.`);
  }
  for (const field of ['emptyTitle', 'emptyBody', 'noResultsTitle', 'noResultsBody'] as const) {
    const limit = field.toLowerCase().includes('title') ? 120 : 400;
    const fieldValue = raw[field];
    if (typeof fieldValue === 'string' && fieldValue.length > limit) {
      errors.push(`${definition.label}: “${field}” must be ${limit} characters or fewer.`);
    }
  }
  if (raw.help && typeof raw.help === 'object' && !Array.isArray(raw.help)) {
    const help = raw.help as Record<string, unknown>;
    if (typeof help.title === 'string' && help.title.length > 120) {
      errors.push(`${definition.label}: the help heading must be 120 characters or fewer.`);
    }
    if (typeof help.body === 'string' && help.body.length > 600) {
      errors.push(`${definition.label}: the help text must be 600 characters or fewer.`);
    }
  }
  errors.push(...validateScreenAnnouncement(raw.announcement, definition.label));
  errors.push(...validateScreenSections(key, raw.sections));
  return errors;
}

function shortText(
  raw: Record<string, unknown>,
  key: string,
  label: string,
  max = 60,
  required = false
): string | null {
  const value = raw[key];
  if (value === undefined) return null;
  if (typeof value !== 'string') return `${label} must be text.`;
  const trimmed = value.trim();
  if (required && !trimmed) return `${label} is required.`;
  if (trimmed.length > max) return `${label} must be ${max} characters or fewer.`;
  return null;
}

function collect(errors: string[], checks: Array<string | null>): void {
  for (const error of checks) if (error) errors.push(error);
}

function validateScreenLabels(
  raw: Record<string, unknown>,
  field: string,
  label: string,
  expectedKeys: string[]
): string[] {
  if (raw[field] === undefined) return [];
  const value = raw[field];
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return [`${label}: the tab labels are malformed.`];
  }
  const errors: string[] = [];
  for (const key of expectedKeys) {
    const entry = (value as Record<string, unknown>)[key];
    if (typeof entry !== 'string' || !entry.trim()) {
      errors.push(`${label}: the “${key}” label is required.`);
    } else if (entry.length > 40) {
      errors.push(`${label}: the “${key}” label must be 40 characters or fewer.`);
    }
  }
  return errors;
}

export function validateScreen(key: ScreenKey, value: unknown): ValidationResult {
  const errors = validateScreenCommon(key, value);
  if (errors.length && (!value || typeof value !== 'object')) return result(errors);
  const raw = (value || {}) as Record<string, unknown>;
  const definition = screenDefinition(key);

  switch (key) {
    case 'lectures':
      errors.push(...validateScreenLabels(raw, 'tabLabels', definition.label, ['batches', 'series', 'lectures', 'resources']));
      collect(errors, [
        shortText(raw, 'mineFilterLabel', `${definition.label}: “my courses” label`, 40, true),
        shortText(raw, 'enrolledCtaLabel', `${definition.label}: enrolled button label`, 40, true),
        shortText(raw, 'watchCtaLabel', `${definition.label}: watch button label`, 40, true),
        shortText(raw, 'accessNoteTitle', `${definition.label}: access note heading`, 120),
        shortText(raw, 'accessNoteBody', `${definition.label}: access note`, 800),
      ]);
      break;
    case 'lecturePlayer':
      collect(errors, [
        shortText(raw, 'backLabel', `${definition.label}: back link label`, 40, true),
        shortText(raw, 'relatedTitle', `${definition.label}: related heading`, 60, true),
        shortText(raw, 'notesTitle', `${definition.label}: notes heading`, 80, true),
        shortText(raw, 'progressNote', `${definition.label}: player tip`, 600),
      ]);
      break;
    case 'tests':
      errors.push(...validateScreenLabels(raw, 'filterLabels', definition.label, ['all', 'live', 'upcoming', 'completed']));
      collect(errors, [
        shortText(raw, 'openCtaLabel', `${definition.label}: open button label`, 40, true),
        shortText(raw, 'attemptCtaLabel', `${definition.label}: attempt button label`, 40, true),
        shortText(raw, 'endedCtaLabel', `${definition.label}: ended button label`, 40, true),
        shortText(raw, 'infoBody', `${definition.label}: fairness note`, 800),
      ]);
      break;
    case 'testPlayer': {
      if (raw.instructions !== undefined) {
        if (!Array.isArray(raw.instructions)) {
          errors.push(`${definition.label}: instructions must be a list.`);
        } else {
          if (raw.instructions.length > 8) errors.push(`${definition.label}: keep instructions to 8 items or fewer.`);
          for (const item of raw.instructions) {
            if (typeof item !== 'string' || !item.trim()) {
              errors.push(`${definition.label}: every instruction needs text.`);
              break;
            }
            if (item.length > 240) {
              errors.push(`${definition.label}: instructions must be 240 characters or fewer.`);
              break;
            }
          }
        }
      }
      collect(errors, [
        shortText(raw, 'submitLabel', `${definition.label}: submit button label`, 40, true),
        shortText(raw, 'submitConfirm', `${definition.label}: submission confirmation`, 240, true),
        shortText(raw, 'paletteTitle', `${definition.label}: palette heading`, 60, true),
        shortText(raw, 'reviewTitle', `${definition.label}: review heading`, 80, true),
      ]);
      if (raw.timerWarningMinutes !== undefined) {
        const minutes = Number(raw.timerWarningMinutes);
        if (!Number.isFinite(minutes) || minutes < 1 || minutes > 30) {
          errors.push(`${definition.label}: the timer warning must be between 1 and 30 minutes.`);
        }
      }
      break;
    }
    case 'leaderboard':
      collect(errors, [
        shortText(raw, 'selectorLabel', `${definition.label}: test selector label`, 60, true),
        shortText(raw, 'refreshLabel', `${definition.label}: refresh label`, 40, true),
        shortText(raw, 'browseCtaLabel', `${definition.label}: browse button label`, 40, true),
        shortText(raw, 'noTestTitle', `${definition.label}: empty-state heading`, 120, true),
        shortText(raw, 'noAttemptsTitle', `${definition.label}: no-attempts heading`, 120, true),
      ]);
      break;
    case 'profile':
      collect(errors, [
        shortText(raw, 'askDoubtLabel', `${definition.label}: chat button label`, 40, true),
        shortText(raw, 'signOutLabel', `${definition.label}: sign-out label`, 40, true),
        shortText(raw, 'editLabel', `${definition.label}: edit button label`, 40, true),
        shortText(raw, 'recentAttemptsTitle', `${definition.label}: attempts heading`, 80, true),
        shortText(raw, 'levelNote', `${definition.label}: level explanation`, 400),
      ]);
      break;
    case 'eventsScreen':
      errors.push(...validateScreenLabels(raw, 'filterLabels', definition.label, ['all', 'live', 'upcoming', 'completed', 'unscheduled']));
      collect(errors, [
        shortText(raw, 'addToCalendarLabel', `${definition.label}: calendar button label`, 40, true),
        shortText(raw, 'detailsCtaLabel', `${definition.label}: details button label`, 40, true),
        shortText(raw, 'infoBody', `${definition.label}: reminder note`, 800),
      ]);
      break;
    case 'challengesScreen':
      collect(errors, [
        shortText(raw, 'joinLabel', `${definition.label}: join button label`, 40, true),
        shortText(raw, 'leaveLabel', `${definition.label}: leave button label`, 40, true),
        shortText(raw, 'checklistTitle', `${definition.label}: checklist heading`, 80, true),
        shortText(raw, 'joinHint', `${definition.label}: join hint`, 200),
      ]);
      break;
    case 'chat':
      collect(errors, [
        shortText(raw, 'composerPlaceholder', `${definition.label}: message placeholder`, 120, true),
        shortText(raw, 'sendLabel', `${definition.label}: send button label`, 40, true),
        shortText(raw, 'emptyTitle', `${definition.label}: empty-state heading`, 120, true),
        shortText(raw, 'helpBody', `${definition.label}: privacy note`, 600),
      ]);
      break;
    case 'notifications':
      collect(errors, [
        shortText(raw, 'markReadLabel', `${definition.label}: mark-read label`, 40, true),
        shortText(raw, 'openLabel', `${definition.label}: open label`, 40, true),
        shortText(raw, 'unreadOnlyLabel', `${definition.label}: unread filter label`, 40, true),
        shortText(raw, 'emptyTitle', `${definition.label}: empty-state heading`, 120, true),
      ]);
      break;
    case 'search': {
      if (raw.suggestions !== undefined) {
        if (!Array.isArray(raw.suggestions)) {
          errors.push(`${definition.label}: suggested searches must be a list.`);
        } else {
          if (raw.suggestions.length > 10) errors.push(`${definition.label}: keep suggested searches to 10 or fewer.`);
          for (const item of raw.suggestions) {
            if (typeof item !== 'string' || !item.trim()) {
              errors.push(`${definition.label}: every suggested search needs text.`);
              break;
            }
            if (item.length > 60) {
              errors.push(`${definition.label}: suggested searches must be 60 characters or fewer.`);
              break;
            }
          }
        }
      }
      collect(errors, [
        shortText(raw, 'searchCtaLabel', `${definition.label}: search button label`, 40, true),
        shortText(raw, 'searchPlaceholder', `${definition.label}: search placeholder`, 120, true),
        shortText(raw, 'infoNote', `${definition.label}: discovery note`, 400),
      ]);
      break;
    }
    case 'onboarding': {
      if (raw.features !== undefined) {
        if (!Array.isArray(raw.features)) {
          errors.push(`${definition.label}: highlights must be a list.`);
        } else {
          if (raw.features.length > 5) errors.push(`${definition.label}: keep highlights to 5 or fewer.`);
          for (const item of raw.features) {
            if (!item || typeof item !== 'object') {
              errors.push(`${definition.label}: a highlight is malformed.`);
              break;
            }
            const entry = item as Record<string, unknown>;
            if (typeof entry.title !== 'string' || !entry.title.trim()) {
              errors.push(`${definition.label}: every highlight needs a title.`);
              break;
            }
            if (typeof entry.text === 'string' && entry.text.length > 240) {
              errors.push(`${definition.label}: highlight text must be 240 characters or fewer.`);
              break;
            }
          }
        }
      }
      collect(errors, [
        shortText(raw, 'brandPanelTitle', `${definition.label}: welcome heading`, 180, true),
        shortText(raw, 'formTitle', `${definition.label}: form heading`, 120, true),
        shortText(raw, 'nameQuestion', `${definition.label}: name question`, 120, true),
        shortText(raw, 'examQuestion', `${definition.label}: exam question`, 120, true),
        shortText(raw, 'classQuestion', `${definition.label}: class question`, 120, true),
        shortText(raw, 'finishLabel', `${definition.label}: finish button label`, 60, true),
        shortText(raw, 'continueLabel', `${definition.label}: continue button label`, 40, true),
        shortText(raw, 'backLabel', `${definition.label}: back button label`, 40, true),
        shortText(raw, 'footerNote', `${definition.label}: footer note`, 300),
      ]);
      break;
    }
    default:
      break;
  }

  return result(errors);
}

export function validateBatchStudio(config: BatchShowcaseConfig): ValidationResult {
  const errors: string[] = [];
  const checks: Array<[string | null, string]> = [
    [text(config.eyebrow, 'Eyebrow', { max: 80 }), 'Eyebrow must be 80 characters or fewer.'],
    [text(config.title, 'Title', { max: 140, required: true }), 'Title is required (140 characters max).'],
    [text(config.subtitle, 'Subtitle', { max: 400 }), 'Subtitle must be 400 characters or fewer.'],
    [text(config.ctaLabel, 'CTA label', { max: 60 }), 'CTA label must be 60 characters or fewer.'],
    [text(config.ctaHref, 'CTA link', { max: 300 }), 'CTA link must be 300 characters or fewer.'],
  ];
  for (const [error, message] of checks) if (error) errors.push(message);
  if (config.ctaHref && !isEmptyOrInternalLink(config.ctaHref)) {
    errors.push('CTA link must be a /path or an https:// URL.');
  }
  if (!Array.isArray(config.pages) || config.pages.length === 0) {
    errors.push('Pick at least one page where batch cards should appear.');
  }
  if (!Array.isArray(config.accentCycle) || config.accentCycle.length === 0) {
    errors.push('Choose at least one accent colour for the card colour cycle.');
  }
  if (config.maxItems < 1 || config.maxItems > 12) errors.push('Maximum cards must be between 1 and 12.');
  return result(errors);
}

export function validateAnimations(config: AnimationStudioConfig): ValidationResult {
  const errors: string[] = [];
  if (!Array.isArray(config.layers)) return result(['Animation layers must be a list.']);
  if (config.layers.length > 12) errors.push('A maximum of 12 animation layers can be stored.');
  // The API accepts a 512 KiB JSON body. Authored strings can expand when JSON
  // escapes quotes, backslashes or multi-byte characters, so enforce an
  // aggregate encoded-size budget before the admin hits Publish.
  try {
    const payloadBytes = new TextEncoder().encode(JSON.stringify(config)).byteLength;
    if (payloadBytes > 450 * 1024) {
      errors.push('Combined animation settings are too large to publish (450 KiB JSON limit). Shorten the code or split it across fewer layers.');
    }
  } catch {
    errors.push('Animation settings could not be serialized. Remove unsupported values and retry.');
  }
  config.layers.forEach((layer, index) => {
    const label = `Animation ${index + 1}${layer.name ? ` (${layer.name})` : ''}`;
    if (!layer.pages?.length) errors.push(`${label}: choose at least one page.`);
    if (!layer.html?.trim() && !layer.css?.trim() && !layer.js?.trim()) {
      errors.push(`${label}: add HTML, CSS or JS so there is something to show.`);
    }
    if (layer.html.length > 12000) errors.push(`${label}: HTML is too long (12,000 characters max).`);
    if (layer.css.length > 12000) errors.push(`${label}: CSS is too long (12,000 characters max).`);
    if (layer.js.length > 12000) errors.push(`${label}: JS is too long (12,000 characters max).`);
    if (layer.delayMs < 0 || layer.delayMs > 120000) errors.push(`${label}: delay must be 0–120,000 ms.`);
    if (layer.durationMs < 0 || layer.durationMs > 600000) {
      errors.push(`${label}: auto-hide duration must be 0–600,000 ms.`);
    }
    if (layer.reward.href && !isEmptyOrInternalLink(layer.reward.href)) {
      errors.push(`${label}: reward link must be a /path or an https:// URL.`);
    }
    if (layer.startAt && !parseSchedule(layer.startAt)) errors.push(`${label}: start date is invalid.`);
    if (layer.endAt && !parseSchedule(layer.endAt)) errors.push(`${label}: end date is invalid.`);
    const start = layer.startAt ? parseSchedule(layer.startAt) : null;
    const end = layer.endAt ? parseSchedule(layer.endAt) : null;
    if (start !== null && end !== null && start >= end) {
      errors.push(`${label}: end date must be after the start date.`);
    }
  });
  return result(errors);
}

export function validateSettingValue(key: SiteSettingKey, value: unknown): ValidationResult {
  try {
    return validateSettingValueUnsafe(key, value);
  } catch {
    // Imported JSON and stale drafts must never crash the admin UI.
    return result(['This settings payload is malformed. Check required fields and array shapes.']);
  }
}

function validateSettingValueUnsafe(key: SiteSettingKey, value: unknown): ValidationResult {
  switch (key) {
    case 'theme':
      return validateTheme(value as ThemeConfig);
    case 'login':
      return validateLogin(value as LoginConfig);
    case 'homepage':
      return validateHomepage(value as HomepageConfig);
    case 'navigation':
      return validateNavigation(value as NavigationConfig);
    case 'footer':
      return validateFooter(value as FooterConfig);
    case 'banners':
      return validateBanners(value as BannersConfig);
    case 'popups':
      return validatePopups(value as PopupsConfig);
    case 'testimonials':
      return validateTestimonials(value as TestimonialsConfig);
    case 'challenges':
      return validateChallenges(value as ChallengesConfig);
    case 'features':
      return validateFeatures(value as FeatureFlags);
    case 'seo':
      return validateSeo(value as SeoConfig);
    case 'media':
      return validateMedia(value as MediaConfig);
    case 'batchStudio':
      return validateBatchStudio(value as BatchShowcaseConfig);
    case 'animations':
      return validateAnimations(value as AnimationStudioConfig);
    default:
      if (isScreenSettingKey(key)) return validateScreen(key, value);
      return result(['Unknown settings key.']);
  }
}

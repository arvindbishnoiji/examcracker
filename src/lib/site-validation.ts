import type {
  BannersConfig,
  ChallengesConfig,
  FeatureFlags,
  FooterConfig,
  HomepageConfig,
  LoginConfig,
  MediaConfig,
  NavigationConfig,
  PopupsConfig,
  SeoConfig,
  SiteSettingKey,
  TestimonialsConfig,
  ThemeConfig,
} from '@/types';
import { isSafeHttpUrl, isValidInternalDeepLink } from './validation';
import { isHexColor } from './theme';
import { parseSchedule } from './site-config';

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
  }
  if (text(homepage.greetingTemplate, 'Greeting template', { max: 120, required: true })) {
    errors.push('Greeting template is required (120 characters max).');
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
    default:
      return result(['Unknown settings key.']);
  }
}

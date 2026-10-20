import type {
  AudienceTarget,
  Banner,
  BannersConfig,
  ChallengeChecklistItem,
  ChallengesConfig,
  FeatureFlags,
  FooterConfig,
  FooterLinkColumn,
  HomeSectionConfig,
  HomeSectionType,
  HomepageConfig,
  LibraryItem,
  LinkItem,
  LoginConfig,
  MediaAsset,
  MediaConfig,
  NavigationConfig,
  NavigationLink,
  NoticePopup,
  PopupsConfig,
  PublicSiteConfig,
  SectionLayout,
  SeoConfig,
  SiteConfig,
  SiteSettingKey,
  StudyChallenge,
  Testimonial,
  TestimonialsConfig,
  ThemeConfig,
  ThemePresetId,
} from '@/types';
import { isSafeHttpUrl } from './validation';
import { isHexColor, normalizeHex } from './theme';

export const SITE_SETTING_KEYS: SiteSettingKey[] = [
  'theme',
  'login',
  'homepage',
  'navigation',
  'footer',
  'banners',
  'popups',
  'testimonials',
  'challenges',
  'features',
  'seo',
  'media',
];

export function isSiteSettingKey(value: string): value is SiteSettingKey {
  return (SITE_SETTING_KEYS as string[]).includes(value);
}

export const HOME_SECTION_TYPES: HomeSectionType[] = [
  'hero',
  'goal',
  'upcoming_tests',
  'live_tests',
  'events',
  'featured_batches',
  'featured_series',
  'continue_learning',
  'popular_lectures',
  'subject_shortcuts',
  'study_progress',
  'announcements',
  'challenges',
  'leaderboard_preview',
  'quick_links',
  'promo',
  'custom',
  'testimonials',
];

export const HOME_SECTION_LABELS: Record<HomeSectionType, string> = {
  hero: 'Hero banners',
  goal: "Today's goal",
  upcoming_tests: 'Upcoming tests',
  live_tests: 'Live tests',
  events: 'Upcoming events',
  featured_batches: 'Featured batches',
  featured_series: 'Featured series',
  continue_learning: 'Continue learning',
  popular_lectures: 'Popular lectures',
  subject_shortcuts: 'Subject shortcuts',
  study_progress: 'Study progress',
  announcements: 'Announcements',
  challenges: 'Study challenges',
  leaderboard_preview: 'Leaderboard preview',
  quick_links: 'Quick links',
  promo: 'Promotional card',
  custom: 'Custom text / image',
  testimonials: 'Testimonials',
};

export const AUDIENCE_TARGETS: Array<{ value: AudienceTarget; label: string }> = [
  { value: 'all', label: 'All students' },
  { value: 'JEE', label: 'JEE (all classes)' },
  { value: 'NEET', label: 'NEET (all classes)' },
  { value: 'JEE-11', label: 'JEE · Class 11' },
  { value: 'JEE-12', label: 'JEE · Class 12' },
  { value: 'NEET-11', label: 'NEET · Class 11' },
  { value: 'NEET-12', label: 'NEET · Class 12' },
];

export function makeId(prefix = 'ec'): string {
  const random =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 10)
      : Math.random().toString(36).slice(2, 12);
  return `${prefix}-${random}`;
}

export const DEFAULT_THEME: ThemeConfig = {
  preset: 'modern',
  brandName: 'Exam Cracker',
  tagline: 'JEE • NEET • Class 11 & 12',
  logoText: 'EC',
  logoUrl: '',
  faviconUrl: '',
  primaryColor: '#2563eb',
  secondaryColor: '#0f172a',
  accentColor: '#f59e0b',
  backgroundColor: '#f7f8fc',
  surfaceColor: '#ffffff',
  textColor: '#0f172a',
  mode: 'light',
  fontPreset: 'modern',
  headingStyle: 'tight',
  radius: 18,
  buttonShape: 'rounded',
  cardStyle: 'elevated',
  shadow: 'soft',
  pageWidth: 'standard',
  density: 'comfortable',
  stickyHeader: true,
  headerStyle: 'light',
  animation: 'subtle',
  showBottomNav: true,
  emptyStateTitle: 'Nothing here yet',
  emptyStateBody: 'New content will appear here as soon as your admin publishes it.',
};

export const DEFAULT_LOGIN: LoginConfig = {
  logoUrl: '',
  title: 'Welcome back',
  subtitle: 'Sign in to continue your JEE / NEET preparation.',
  welcomeMessage: 'Your lectures, tests and progress are waiting.',
  backgroundType: 'gradient',
  backgroundColor: '#f7f8fc',
  gradientFrom: '#eff6ff',
  gradientTo: '#fdf4ff',
  backgroundImageUrl: '',
  heroImageUrl: '',
  heroTitle: 'Crack JEE & NEET with focused lectures and real tests',
  heroSubtitle:
    'A personalised dashboard, chapter-wise lectures, timed tests and live doubt chat — filtered for your exam and class.',
  highlights: [
    'Email and Google sign-in secured by Firebase',
    'Personalised JEE / NEET content for Class 11 and 12',
    'Server-scored tests with answer keys hidden until submission',
  ],
  layout: 'split',
  cardAlign: 'center',
  cardWidth: 'standard',
  emailLabel: 'Email',
  passwordLabel: 'Password',
  emailHelp: 'Use the email address linked to your Exam Cracker account.',
  passwordHelp: 'Passwords are handled by Firebase and never stored in this app.',
  showGoogle: true,
  showSignup: true,
  forgotPasswordText: 'Forgot password?',
  forgotPasswordHelp: 'We will email a secure reset link from Firebase.',
  bannerEnabled: true,
  bannerTitle: 'First time here?',
  bannerBody:
    'After signing in you will choose your name, JEE or NEET, and Class 11 or 12. That unlocks your personalised content.',
  bannerCtaLabel: '',
  bannerCtaHref: '',
  footerText: 'By continuing you agree to the platform terms. Never share your batch access codes.',
  footerLinks: [],
  termsUrl: '',
  privacyUrl: '',
  mobileImagePosition: 'top',
  showTestimonials: true,
  showOnboardingNote: true,
};

const DEFAULT_HOME_SECTIONS: HomeSectionConfig[] = [
  {
    id: 'home-hero',
    type: 'hero',
    title: 'Build your rank, one focused day at a time.',
    subtitle:
      'Fresh lectures, timed tests and a study plan that follows your JEE / NEET syllabus.',
    visible: true,
    audience: 'all',
    limit: 5,
    layout: 'carousel',
    ctaLabel: 'Explore lectures',
    ctaHref: '/lectures',
    imageUrl: '',
    body: '',
    accent: '',
  },
  {
    id: 'home-goal',
    type: 'goal',
    title: "Today's Goal",
    subtitle: 'A single, achievable target picked by your mentor.',
    visible: true,
    audience: 'all',
    limit: 3,
    layout: 'grid',
    ctaLabel: '',
    ctaHref: '',
    imageUrl: '',
    body: '',
    accent: '',
  },
  {
    id: 'home-progress',
    type: 'study_progress',
    title: 'Your study pulse',
    subtitle: 'Live progress from your real attempts and watch time.',
    visible: true,
    audience: 'all',
    limit: 4,
    layout: 'grid',
    ctaLabel: '',
    ctaHref: '',
    imageUrl: '',
    body: '',
    accent: '',
  },
  {
    id: 'home-live-tests',
    type: 'live_tests',
    title: 'Live tests',
    subtitle: 'Timed, server-scored and ready right now.',
    visible: true,
    audience: 'all',
    limit: 3,
    layout: 'grid',
    ctaLabel: 'All tests',
    ctaHref: '/tests',
    imageUrl: '',
    body: '',
    accent: '',
  },
  {
    id: 'home-upcoming-tests',
    type: 'upcoming_tests',
    title: 'Upcoming tests',
    subtitle: 'Put these on your calendar before the week fills up.',
    visible: true,
    audience: 'all',
    limit: 3,
    layout: 'grid',
    ctaLabel: 'Test calendar',
    ctaHref: '/tests',
    imageUrl: '',
    body: '',
    accent: '',
  },
  {
    id: 'home-events',
    type: 'events',
    title: 'Events & campaigns',
    subtitle: 'Marathons, doubt sessions and result announcements.',
    visible: true,
    audience: 'all',
    limit: 4,
    layout: 'grid',
    ctaLabel: 'Event calendar',
    ctaHref: '/events',
    imageUrl: '',
    body: '',
    accent: '',
  },
  {
    id: 'home-continue',
    type: 'continue_learning',
    title: 'Continue learning',
    subtitle: 'Pick up where you left off.',
    visible: true,
    audience: 'all',
    limit: 6,
    layout: 'grid',
    ctaLabel: 'My lectures',
    ctaHref: '/lectures',
    imageUrl: '',
    body: '',
    accent: '',
  },
  {
    id: 'home-batches',
    type: 'featured_batches',
    title: 'Featured batches',
    subtitle: 'Structured programmes with lectures, notes and tests.',
    visible: true,
    audience: 'all',
    limit: 3,
    layout: 'grid',
    ctaLabel: 'Browse batches',
    ctaHref: '/lectures',
    imageUrl: '',
    body: '',
    accent: '',
  },
  {
    id: 'home-challenges',
    type: 'challenges',
    title: 'Study challenges',
    subtitle: 'Short, focused sprints that keep momentum high.',
    visible: true,
    audience: 'all',
    limit: 3,
    layout: 'grid',
    ctaLabel: 'All challenges',
    ctaHref: '/challenges',
    imageUrl: '',
    body: '',
    accent: '',
  },
  {
    id: 'home-announcements',
    type: 'announcements',
    title: 'Announcements',
    subtitle: 'The latest notes from your mentors.',
    visible: true,
    audience: 'all',
    limit: 3,
    layout: 'list',
    ctaLabel: '',
    ctaHref: '',
    imageUrl: '',
    body: '',
    accent: '',
  },
  {
    id: 'home-leaderboard',
    type: 'leaderboard_preview',
    title: 'Leaderboard snapshot',
    subtitle: 'Top scores from your most recent test.',
    visible: true,
    audience: 'all',
    limit: 5,
    layout: 'list',
    ctaLabel: 'Full leaderboard',
    ctaHref: '/leaderboard',
    imageUrl: '',
    body: '',
    accent: '',
  },
  {
    id: 'home-quick-links',
    type: 'quick_links',
    title: 'Quick links',
    subtitle: '',
    visible: true,
    audience: 'all',
    limit: 8,
    layout: 'grid',
    ctaLabel: '',
    ctaHref: '',
    imageUrl: '',
    body: '',
    accent: '',
  },
  {
    id: 'home-testimonials',
    type: 'testimonials',
    title: 'Student stories',
    subtitle: 'Highlights shared by the Exam Cracker community.',
    visible: true,
    audience: 'all',
    limit: 3,
    layout: 'grid',
    ctaLabel: '',
    ctaHref: '',
    imageUrl: '',
    body: '',
    accent: '',
  },
];

export const DEFAULT_HOMEPAGE: HomepageConfig = {
  showGreeting: true,
  greetingTemplate: 'Welcome back, {name} 👋',
  showSearch: true,
  showQuickStats: true,
  sections: DEFAULT_HOME_SECTIONS,
};

export const DEFAULT_NAVIGATION: NavigationConfig = {
  headerLinks: [
    { id: 'nav-lectures', label: 'Lectures', href: '/lectures', icon: '📚', visible: true },
    { id: 'nav-tests', label: 'Tests', href: '/tests', icon: '📝', visible: true },
    { id: 'nav-leaderboard', label: 'Leaderboard', href: '/leaderboard', icon: '🏆', visible: true },
    { id: 'nav-events', label: 'Events', href: '/events', icon: '📅', visible: true },
    { id: 'nav-challenges', label: 'Challenges', href: '/challenges', icon: '🔥', visible: true },
  ],
  bottomLinks: [
    { id: 'bottom-home', label: 'Home', href: '/home', icon: '🏠', visible: true },
    { id: 'bottom-lectures', label: 'Learn', href: '/lectures', icon: '▶️', visible: true },
    { id: 'bottom-tests', label: 'Tests', href: '/tests', icon: '📝', visible: true },
    { id: 'bottom-leaderboard', label: 'Board', href: '/leaderboard', icon: '🏆', visible: true },
    { id: 'bottom-profile', label: 'Profile', href: '/profile', icon: '👤', visible: true },
  ],
  showSearch: true,
  ctaLabel: 'Start learning',
  ctaHref: '/home',
  announcementBarEnabled: false,
  announcementBarText: '',
  announcementBarHref: '',
};

export const DEFAULT_FOOTER: FooterConfig = {
  show: true,
  text: 'Exam Cracker — focused JEE & NEET preparation.',
  note: 'All schedules are shown in Asia/Kolkata (IST). Content is filtered for your exam and class.',
  columns: [
    {
      id: 'footer-learn',
      title: 'Learn',
      links: [
        { id: 'footer-lectures', label: 'Lectures', href: '/lectures' },
        { id: 'footer-tests', label: 'Tests', href: '/tests' },
        { id: 'footer-events', label: 'Events', href: '/events' },
      ],
    },
    {
      id: 'footer-progress',
      title: 'Progress',
      links: [
        { id: 'footer-board', label: 'Leaderboard', href: '/leaderboard' },
        { id: 'footer-challenges', label: 'Challenges', href: '/challenges' },
        { id: 'footer-profile', label: 'My profile', href: '/profile' },
      ],
    },
    {
      id: 'footer-support',
      title: 'Support',
      links: [
        { id: 'footer-notifications', label: 'Notifications', href: '/notifications' },
        { id: 'footer-chat', label: 'Doubt chat', href: '/chat' },
      ],
    },
  ],
  socialLinks: [],
  copyright: '© Exam Cracker. Built with Firebase, Supabase and Cloudflare.',
};

export const DEFAULT_BANNERS: BannersConfig = {
  items: [],
  autoplay: true,
  rotationSeconds: 6,
  showDots: true,
  showArrows: true,
};

export const DEFAULT_POPUPS: PopupsConfig = { items: [] };
export const DEFAULT_TESTIMONIALS: TestimonialsConfig = {
  items: [],
  title: 'Student stories',
  subtitle: 'Highlights shared by the Exam Cracker community.',
};
export const DEFAULT_CHALLENGES: ChallengesConfig = { items: [] };
export const DEFAULT_MEDIA: MediaConfig = { items: [] };

export const DEFAULT_FEATURES: FeatureFlags = {
  lectures: true,
  resources: true,
  tests: true,
  leaderboard: true,
  chat: true,
  notifications: true,
  events: true,
  challenges: true,
  search: true,
  bookmarks: true,
  notes: true,
  continueLearning: true,
  recentlyViewed: true,
  testimonials: true,
  popups: true,
  googleAuth: true,
  signup: true,
  bottomNav: true,
};

export const DEFAULT_SEO: SeoConfig = {
  title: 'Exam Cracker — JEE & NEET Learning',
  description:
    'JEE and NEET coaching platform with chapter-wise lectures, timed tests, leaderboards and live doubt support.',
  keywords: ['JEE', 'NEET', 'Class 11', 'Class 12', 'lectures', 'mock tests'],
  ogImageUrl: '',
  twitterHandle: '',
  canonicalBase: '',
  robotsIndex: true,
  searchPlaceholder: 'Search lectures, tests, batches and events…',
  popularSearches: ['Kinematics', 'Organic Chemistry', 'Human Physiology', 'Calculus', 'Electrostatics'],
  enableGlobalSearch: true,
};

export const DEFAULT_SITE_CONFIG: SiteConfig = {
  theme: DEFAULT_THEME,
  login: DEFAULT_LOGIN,
  homepage: DEFAULT_HOMEPAGE,
  navigation: DEFAULT_NAVIGATION,
  footer: DEFAULT_FOOTER,
  banners: DEFAULT_BANNERS,
  popups: DEFAULT_POPUPS,
  testimonials: DEFAULT_TESTIMONIALS,
  challenges: DEFAULT_CHALLENGES,
  features: DEFAULT_FEATURES,
  seo: DEFAULT_SEO,
  media: DEFAULT_MEDIA,
};

export function defaultForSetting<K extends SiteSettingKey>(key: K): SiteConfig[K] {
  return deepClone(DEFAULT_SITE_CONFIG[key]) as SiteConfig[K];
}

export function deepClone<T>(value: T): T {
  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(value);
    } catch {
      /* fall through */
    }
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function mergeValue(base: unknown, override: unknown): unknown {
  if (override === undefined) return base;
  if (Array.isArray(override)) return override.map((item) => deepClone(item));
  if (isPlainObject(base) && isPlainObject(override)) {
    const result: Record<string, unknown> = { ...base };
    for (const [key, value] of Object.entries(override)) {
      result[key] = mergeValue(base[key], value);
    }
    return result;
  }
  if (isPlainObject(override)) return deepClone(override);
  return override;
}

export function mergeSiteConfig(partial?: PublicSiteConfig | null): SiteConfig {
  const base = deepClone(DEFAULT_SITE_CONFIG) as unknown as Record<string, unknown>;
  if (partial && typeof partial === 'object') {
    for (const key of SITE_SETTING_KEYS) {
      if (partial[key] !== undefined) {
        base[key] = mergeValue(base[key], partial[key]);
      }
    }
  }
  return sanitizeSiteConfig(base as unknown as SiteConfig);
}

// ---------------------------------------------------------------------------
// Sanitisation — the storefront must never crash because of stale or malformed
// settings written by an older release.
// ---------------------------------------------------------------------------

function asString(value: unknown, fallback: string, max = 2000): string {
  if (typeof value !== 'string') return fallback;
  return value.slice(0, max);
}

function asBool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function asNumber(value: unknown, fallback: number, min: number, max: number): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function asEnum<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

function asLink(value: unknown, index: number, fallbackId: string): LinkItem | null {
  if (!isPlainObject(value)) return null;
  const href = asString(value.href, '', 500).trim();
  const label = asString(value.label, '', 80).trim();
  if (!href || !label) return null;
  return {
    id: asString(value.id, `${fallbackId}-${index}`, 80) || `${fallbackId}-${index}`,
    label,
    href,
    external: asBool(value.external, /^https?:\/\//i.test(href)),
  };
}

function sanitizeTheme(value: unknown): ThemeConfig {
  const raw = isPlainObject(value) ? value : {};
  const base = DEFAULT_THEME;
  return {
    preset: asEnum<ThemePresetId>(
      raw.preset,
      ['modern', 'minimal', 'academic', 'dark-premium', 'colorful-learning'],
      base.preset
    ),
    brandName: asString(raw.brandName, base.brandName, 80) || base.brandName,
    tagline: asString(raw.tagline, base.tagline, 140),
    logoText: asString(raw.logoText, base.logoText, 6),
    logoUrl: asString(raw.logoUrl, '', 1000),
    faviconUrl: asString(raw.faviconUrl, '', 1000),
    primaryColor: isHexColor(raw.primaryColor)
      ? normalizeHex(raw.primaryColor, base.primaryColor)
      : base.primaryColor,
    secondaryColor: isHexColor(raw.secondaryColor)
      ? normalizeHex(raw.secondaryColor, base.secondaryColor)
      : base.secondaryColor,
    accentColor: isHexColor(raw.accentColor)
      ? normalizeHex(raw.accentColor, base.accentColor)
      : base.accentColor,
    backgroundColor: isHexColor(raw.backgroundColor)
      ? normalizeHex(raw.backgroundColor, base.backgroundColor)
      : base.backgroundColor,
    surfaceColor: isHexColor(raw.surfaceColor)
      ? normalizeHex(raw.surfaceColor, base.surfaceColor)
      : base.surfaceColor,
    textColor: isHexColor(raw.textColor)
      ? normalizeHex(raw.textColor, base.textColor)
      : base.textColor,
    mode: asEnum(raw.mode, ['light', 'dark', 'system'] as const, base.mode),
    fontPreset: asEnum(raw.fontPreset, ['modern', 'minimal', 'academic', 'display'] as const, base.fontPreset),
    headingStyle: asEnum(raw.headingStyle, ['tight', 'balanced', 'editorial'] as const, base.headingStyle),
    radius: asNumber(raw.radius, base.radius, 0, 32),
    buttonShape: asEnum(raw.buttonShape, ['rounded', 'pill', 'square'] as const, base.buttonShape),
    cardStyle: asEnum(raw.cardStyle, ['elevated', 'outlined', 'flat', 'glass'] as const, base.cardStyle),
    shadow: asEnum(raw.shadow, ['none', 'soft', 'strong'] as const, base.shadow),
    pageWidth: asEnum(raw.pageWidth, ['narrow', 'standard', 'wide'] as const, base.pageWidth),
    density: asEnum(raw.density, ['compact', 'comfortable', 'spacious'] as const, base.density),
    stickyHeader: asBool(raw.stickyHeader, base.stickyHeader),
    headerStyle: asEnum(raw.headerStyle, ['light', 'dark', 'transparent', 'gradient'] as const, base.headerStyle),
    animation: asEnum(raw.animation, ['none', 'subtle', 'expressive'] as const, base.animation),
    showBottomNav: asBool(raw.showBottomNav, base.showBottomNav),
    emptyStateTitle: asString(raw.emptyStateTitle, base.emptyStateTitle, 120),
    emptyStateBody: asString(raw.emptyStateBody, base.emptyStateBody, 400),
  };
}

function sanitizeLogin(value: unknown): LoginConfig {
  const raw = isPlainObject(value) ? value : {};
  const base = DEFAULT_LOGIN;
  const highlights = Array.isArray(raw.highlights)
    ? raw.highlights.map((h) => asString(h, '', 200).trim()).filter(Boolean).slice(0, 8)
    : base.highlights;
  const footerLinks = Array.isArray(raw.footerLinks)
    ? raw.footerLinks
        .map((link, index) => asLink(link, index, 'login-footer'))
        .filter((link): link is LinkItem => Boolean(link))
        .slice(0, 6)
    : base.footerLinks;
  return {
    logoUrl: asString(raw.logoUrl, base.logoUrl, 1000),
    title: asString(raw.title, base.title, 120) || base.title,
    subtitle: asString(raw.subtitle, base.subtitle, 240),
    welcomeMessage: asString(raw.welcomeMessage, base.welcomeMessage, 400),
    backgroundType: asEnum(raw.backgroundType, ['solid', 'gradient', 'image'] as const, base.backgroundType),
    backgroundColor: isHexColor(raw.backgroundColor)
      ? normalizeHex(raw.backgroundColor, base.backgroundColor)
      : base.backgroundColor,
    gradientFrom: isHexColor(raw.gradientFrom)
      ? normalizeHex(raw.gradientFrom, base.gradientFrom)
      : base.gradientFrom,
    gradientTo: isHexColor(raw.gradientTo)
      ? normalizeHex(raw.gradientTo, base.gradientTo)
      : base.gradientTo,
    backgroundImageUrl: asString(raw.backgroundImageUrl, '', 1000),
    heroImageUrl: asString(raw.heroImageUrl, '', 1000),
    heroTitle: asString(raw.heroTitle, base.heroTitle, 180),
    heroSubtitle: asString(raw.heroSubtitle, base.heroSubtitle, 500),
    highlights,
    layout: asEnum(raw.layout, ['split', 'centered', 'hero'] as const, base.layout),
    cardAlign: asEnum(raw.cardAlign, ['left', 'center', 'right'] as const, base.cardAlign),
    cardWidth: asEnum(raw.cardWidth, ['compact', 'standard', 'wide'] as const, base.cardWidth),
    emailLabel: asString(raw.emailLabel, base.emailLabel, 60) || base.emailLabel,
    passwordLabel: asString(raw.passwordLabel, base.passwordLabel, 60) || base.passwordLabel,
    emailHelp: asString(raw.emailHelp, base.emailHelp, 240),
    passwordHelp: asString(raw.passwordHelp, base.passwordHelp, 240),
    showGoogle: asBool(raw.showGoogle, base.showGoogle),
    showSignup: asBool(raw.showSignup, base.showSignup),
    forgotPasswordText: asString(raw.forgotPasswordText, base.forgotPasswordText, 80),
    forgotPasswordHelp: asString(raw.forgotPasswordHelp, base.forgotPasswordHelp, 240),
    bannerEnabled: asBool(raw.bannerEnabled, base.bannerEnabled),
    bannerTitle: asString(raw.bannerTitle, base.bannerTitle, 120),
    bannerBody: asString(raw.bannerBody, base.bannerBody, 400),
    bannerCtaLabel: asString(raw.bannerCtaLabel, base.bannerCtaLabel, 60),
    bannerCtaHref: asString(raw.bannerCtaHref, base.bannerCtaHref, 500),
    footerText: asString(raw.footerText, base.footerText, 400),
    footerLinks,
    termsUrl: asString(raw.termsUrl, base.termsUrl, 500),
    privacyUrl: asString(raw.privacyUrl, base.privacyUrl, 500),
    mobileImagePosition: asEnum(
      raw.mobileImagePosition,
      ['top', 'hidden', 'background'] as const,
      base.mobileImagePosition
    ),
    showTestimonials: asBool(raw.showTestimonials, base.showTestimonials),
    showOnboardingNote: asBool(raw.showOnboardingNote, base.showOnboardingNote),
  };
}

function sanitizeHomeSection(value: unknown, index: number): HomeSectionConfig | null {
  if (!isPlainObject(value)) return null;
  const type = asEnum<HomeSectionType>(value.type, HOME_SECTION_TYPES, 'custom');
  const id = asString(value.id, `section-${index}`, 80) || `section-${index}`;
  return {
    id,
    type,
    title: asString(value.title, '', 120),
    subtitle: asString(value.subtitle, '', 240),
    visible: asBool(value.visible, true),
    audience: asEnum<AudienceTarget>(
      value.audience,
      ['all', 'JEE', 'NEET', 'JEE-11', 'JEE-12', 'NEET-11', 'NEET-12'] as const,
      'all'
    ),
    limit: Math.round(asNumber(value.limit, 6, 1, 24)),
    layout: asEnum<SectionLayout>(
      value.layout,
      ['grid', 'carousel', 'split', 'banner', 'list'] as const,
      'grid'
    ),
    ctaLabel: asString(value.ctaLabel, '', 60),
    ctaHref: asString(value.ctaHref, '', 500),
    imageUrl: asString(value.imageUrl, '', 1000),
    body: asString(value.body, '', 1200),
    accent: isHexColor(value.accent) ? normalizeHex(value.accent, '#2563eb') : '',
    itemIds: Array.isArray(value.itemIds)
      ? value.itemIds.map((item) => asString(item, '', 80)).filter(Boolean).slice(0, 40)
      : [],
  };
}

function sanitizeHomepage(value: unknown): HomepageConfig {
  const raw = isPlainObject(value) ? value : {};
  const base = DEFAULT_HOMEPAGE;
  const sections = Array.isArray(raw.sections)
    ? raw.sections
        .map((section, index) => sanitizeHomeSection(section, index))
        .filter((section): section is HomeSectionConfig => Boolean(section))
        .slice(0, 40)
    : deepClone(base.sections);
  const seen = new Set<string>();
  for (const section of sections) {
    if (seen.has(section.id)) section.id = `${section.id}-${seen.size}`;
    seen.add(section.id);
  }
  return {
    showGreeting: asBool(raw.showGreeting, base.showGreeting),
    greetingTemplate: asString(raw.greetingTemplate, base.greetingTemplate, 120),
    showSearch: asBool(raw.showSearch, base.showSearch),
    showQuickStats: asBool(raw.showQuickStats, base.showQuickStats),
    sections,
  };
}

function sanitizeNavLinks(value: unknown, fallback: NavigationLink[], prefix: string): NavigationLink[] {
  const list = Array.isArray(value) ? value : fallback;
  return list
    .map((item, index) => {
      if (!isPlainObject(item)) return null;
      const href = asString(item.href, '', 500).trim();
      const label = asString(item.label, '', 40).trim();
      if (!href || !label) return null;
      return {
        id: asString(item.id, `${prefix}-${index}`, 80) || `${prefix}-${index}`,
        label,
        href,
        icon: asString(item.icon, '•', 8) || '•',
        visible: asBool(item.visible, true),
      };
    })
    .filter((item): item is NavigationLink => Boolean(item))
    .slice(0, 10);
}

function sanitizeNavigation(value: unknown): NavigationConfig {
  const raw = isPlainObject(value) ? value : {};
  const base = DEFAULT_NAVIGATION;
  return {
    headerLinks: sanitizeNavLinks(raw.headerLinks, base.headerLinks, 'nav'),
    bottomLinks: sanitizeNavLinks(raw.bottomLinks, base.bottomLinks, 'bottom'),
    showSearch: asBool(raw.showSearch, base.showSearch),
    ctaLabel: asString(raw.ctaLabel, base.ctaLabel, 60),
    ctaHref: asString(raw.ctaHref, base.ctaHref, 500),
    announcementBarEnabled: asBool(raw.announcementBarEnabled, base.announcementBarEnabled),
    announcementBarText: asString(raw.announcementBarText, '', 240),
    announcementBarHref: asString(raw.announcementBarHref, '', 500),
  };
}

function sanitizeFooter(value: unknown): FooterConfig {
  const raw = isPlainObject(value) ? value : {};
  const base = DEFAULT_FOOTER;
  const columns = Array.isArray(raw.columns)
    ? raw.columns
        .map((column, index): FooterLinkColumn | null => {
          if (!isPlainObject(column)) return null;
          const links = Array.isArray(column.links)
            ? column.links
                .map((link, linkIndex) => asLink(link, linkIndex, `footer-${index}`))
                .filter((link): link is LinkItem => Boolean(link))
                .slice(0, 8)
            : [];
          const title = asString(column.title, '', 60).trim();
          if (!title) return null;
          return {
            id: asString(column.id, `footer-column-${index}`, 80) || `footer-column-${index}`,
            title,
            links,
          };
        })
        .filter((column): column is FooterLinkColumn => Boolean(column))
        .slice(0, 4)
    : deepClone(base.columns);
  const socialLinks = Array.isArray(raw.socialLinks)
    ? raw.socialLinks
        .map((link, index) => asLink(link, index, 'social'))
        .filter((link): link is LinkItem => Boolean(link))
        .slice(0, 6)
    : [];
  return {
    show: asBool(raw.show, base.show),
    text: asString(raw.text, base.text, 300),
    note: asString(raw.note, base.note, 400),
    columns,
    socialLinks,
    copyright: asString(raw.copyright, base.copyright, 200),
  };
}

function sanitizeBanner(value: unknown, index: number): Banner | null {
  if (!isPlainObject(value)) return null;
  const title = asString(value.title, '', 140).trim();
  if (!title) return null;
  const placements = Array.isArray(value.placements)
    ? (value.placements.filter((p) =>
        ['home_hero', 'dashboard', 'login', 'lectures', 'tests'].includes(String(p))
      ) as Banner['placements'])
    : (['home_hero'] as Banner['placements']);
  return {
    id: asString(value.id, `banner-${index}`, 80) || `banner-${index}`,
    title,
    subtitle: asString(value.subtitle, '', 240),
    description: asString(value.description, '', 800),
    badge: asString(value.badge, '', 40),
    desktopImageUrl: asString(value.desktopImageUrl, '', 1000),
    mobileImageUrl: asString(value.mobileImageUrl, '', 1000),
    backgroundColor: isHexColor(value.backgroundColor)
      ? normalizeHex(value.backgroundColor, '#1d4ed8')
      : '#1d4ed8',
    overlay: asNumber(value.overlay, 45, 0, 90),
    textAlign: asEnum(value.textAlign, ['left', 'center', 'right'] as const, 'left'),
    ctaLabel: asString(value.ctaLabel, '', 60),
    ctaHref: asString(value.ctaHref, '', 500),
    placements: placements.length ? placements : ['home_hero'],
    audience: asEnum<AudienceTarget>(
      value.audience,
      ['all', 'JEE', 'NEET', 'JEE-11', 'JEE-12', 'NEET-11', 'NEET-12'] as const,
      'all'
    ),
    startAt: asString(value.startAt, '', 40),
    endAt: asString(value.endAt, '', 40),
    timezone: 'Asia/Kolkata',
    priority: asNumber(value.priority, 0, -100, 100),
    status: asEnum(value.status, ['draft', 'published', 'paused', 'archived'] as const, 'draft'),
    createdAt: asString(value.createdAt, new Date().toISOString(), 40),
    updatedAt: asString(value.updatedAt, new Date().toISOString(), 40),
  };
}

function sanitizeBanners(value: unknown): BannersConfig {
  const raw = isPlainObject(value) ? value : {};
  const base = DEFAULT_BANNERS;
  return {
    items: Array.isArray(raw.items)
      ? raw.items
          .map((banner, index) => sanitizeBanner(banner, index))
          .filter((banner): banner is Banner => Boolean(banner))
          .slice(0, 40)
      : [],
    autoplay: asBool(raw.autoplay, base.autoplay),
    rotationSeconds: asNumber(raw.rotationSeconds, base.rotationSeconds, 3, 20),
    showDots: asBool(raw.showDots, base.showDots),
    showArrows: asBool(raw.showArrows, base.showArrows),
  };
}

function sanitizePopup(value: unknown, index: number): NoticePopup | null {
  if (!isPlainObject(value)) return null;
  const title = asString(value.title, '', 140).trim();
  const body = asString(value.body, '', 1200).trim();
  if (!title || !body) return null;
  const placements = Array.isArray(value.placements)
    ? (value.placements.filter((p) => ['home', 'login', 'dashboard', 'all'].includes(String(p))) as NoticePopup['placements'])
    : (['home'] as NoticePopup['placements']);
  return {
    id: asString(value.id, `popup-${index}`, 80) || `popup-${index}`,
    title,
    body,
    imageUrl: asString(value.imageUrl, '', 1000),
    ctaLabel: asString(value.ctaLabel, '', 60),
    ctaHref: asString(value.ctaHref, '', 500),
    active: asBool(value.active, true),
    frequency: asEnum(value.frequency, ['once_session', 'once_day', 'once_user', 'always'] as const, 'once_day'),
    placements: placements.length ? placements : ['home'],
    audience: asEnum<AudienceTarget>(
      value.audience,
      ['all', 'JEE', 'NEET', 'JEE-11', 'JEE-12', 'NEET-11', 'NEET-12'] as const,
      'all'
    ),
    startAt: asString(value.startAt, '', 40),
    endAt: asString(value.endAt, '', 40),
    priority: asNumber(value.priority, 0, -100, 100),
    dismissible: asBool(value.dismissible, true),
    updatedAt: asString(value.updatedAt, new Date().toISOString(), 40),
  };
}

function sanitizePopups(value: unknown): PopupsConfig {
  const raw = isPlainObject(value) ? value : {};
  return {
    items: Array.isArray(raw.items)
      ? raw.items
          .map((popup, index) => sanitizePopup(popup, index))
          .filter((popup): popup is NoticePopup => Boolean(popup))
          .slice(0, 30)
      : [],
  };
}

function sanitizeTestimonials(value: unknown): TestimonialsConfig {
  const raw = isPlainObject(value) ? value : {};
  const base = DEFAULT_TESTIMONIALS;
  const items: Testimonial[] = Array.isArray(raw.items)
    ? raw.items
        .map((item, index): Testimonial | null => {
          if (!isPlainObject(item)) return null;
          const quote = asString(item.quote, '', 500).trim();
          const name = asString(item.name, '', 80).trim();
          if (!quote || !name) return null;
          return {
            id: asString(item.id, `testimonial-${index}`, 80) || `testimonial-${index}`,
            name,
            exam: asEnum(item.exam, ['JEE', 'NEET'] as const, 'JEE'),
            classLevel: asEnum(item.classLevel, ['11', '12'] as const, '12'),
            quote,
            avatarUrl: isSafeHttpUrl(asString(item.avatarUrl, '', 1000)) ? asString(item.avatarUrl, '', 1000) : '',
            result: asString(item.result, '', 80),
            rating: asNumber(item.rating, 5, 1, 5),
            featured: asBool(item.featured, false),
            active: asBool(item.active, true),
            order: asNumber(item.order, index, 0, 1000),
          };
        })
        .filter((item): item is Testimonial => Boolean(item))
        .slice(0, 40)
    : [];
  return {
    items: items.sort((a, b) => a.order - b.order),
    title: asString(raw.title, base.title, 120),
    subtitle: asString(raw.subtitle, base.subtitle, 240),
  };
}

function sanitizeChallenge(value: unknown, index: number): StudyChallenge | null {
  if (!isPlainObject(value)) return null;
  const title = asString(value.title, '', 140).trim();
  if (!title) return null;
  const checklist: ChallengeChecklistItem[] = Array.isArray(value.checklist)
    ? value.checklist
        .map((item, itemIndex) => {
          if (!isPlainObject(item)) return null;
          const label = asString(item.label, '', 140).trim();
          if (!label) return null;
          return {
            id: asString(item.id, `check-${index}-${itemIndex}`, 80) || `check-${index}-${itemIndex}`,
            label,
          };
        })
        .filter((item): item is ChallengeChecklistItem => Boolean(item))
        .slice(0, 20)
    : [];
  return {
    id: asString(value.id, `challenge-${index}`, 80) || `challenge-${index}`,
    title,
    description: asString(value.description, '', 800),
    targetType: asEnum(
      value.targetType,
      ['lectures', 'tests', 'minutes', 'checklist'] as const,
      'checklist'
    ),
    targetCount: asNumber(value.targetCount, checklist.length || 1, 1, 1000),
    checklist,
    startAt: asString(value.startAt, '', 40),
    endAt: asString(value.endAt, '', 40),
    audience: asEnum<AudienceTarget>(
      value.audience,
      ['all', 'JEE', 'NEET', 'JEE-11', 'JEE-12', 'NEET-11', 'NEET-12'] as const,
      'all'
    ),
    active: asBool(value.active, true),
    reward: asString(value.reward, '', 160),
    color: isHexColor(value.color) ? normalizeHex(value.color, '#7c3aed') : '#7c3aed',
    updatedAt: asString(value.updatedAt, new Date().toISOString(), 40),
  };
}

function sanitizeChallenges(value: unknown): ChallengesConfig {
  const raw = isPlainObject(value) ? value : {};
  return {
    items: Array.isArray(raw.items)
      ? raw.items
          .map((challenge, index) => sanitizeChallenge(challenge, index))
          .filter((challenge): challenge is StudyChallenge => Boolean(challenge))
          .slice(0, 30)
      : [],
  };
}

function sanitizeFeatures(value: unknown): FeatureFlags {
  const raw = isPlainObject(value) ? value : {};
  const result = { ...DEFAULT_FEATURES };
  for (const key of Object.keys(DEFAULT_FEATURES) as Array<keyof FeatureFlags>) {
    result[key] = asBool(raw[key], DEFAULT_FEATURES[key]);
  }
  return result;
}

function sanitizeSeo(value: unknown): SeoConfig {
  const raw = isPlainObject(value) ? value : {};
  const base = DEFAULT_SEO;
  const list = (input: unknown, fallback: string[], max: number) =>
    Array.isArray(input)
      ? input.map((item) => asString(item, '', 80).trim()).filter(Boolean).slice(0, max)
      : fallback;
  return {
    title: asString(raw.title, base.title, 120) || base.title,
    description: asString(raw.description, base.description, 400),
    keywords: list(raw.keywords, base.keywords, 20),
    ogImageUrl: asString(raw.ogImageUrl, '', 1000),
    twitterHandle: asString(raw.twitterHandle, '', 60),
    canonicalBase: asString(raw.canonicalBase, '', 300),
    robotsIndex: asBool(raw.robotsIndex, base.robotsIndex),
    searchPlaceholder: asString(raw.searchPlaceholder, base.searchPlaceholder, 120),
    popularSearches: list(raw.popularSearches, base.popularSearches, 20),
    enableGlobalSearch: asBool(raw.enableGlobalSearch, base.enableGlobalSearch),
  };
}

function sanitizeMedia(value: unknown): MediaConfig {
  const raw = isPlainObject(value) ? value : {};
  const items: MediaAsset[] = Array.isArray(raw.items)
    ? raw.items
        .map((item, index): MediaAsset | null => {
          if (!isPlainObject(item)) return null;
          const url = asString(item.url, '', 1500).trim();
          if (!url) return null;
          return {
            id: asString(item.id, `media-${index}`, 80) || `media-${index}`,
            name: asString(item.name, url.split('/').pop() || 'Asset', 140),
            url,
            type: asEnum(item.type, ['image', 'pdf', 'video', 'other'] as const, 'image'),
            tags: Array.isArray(item.tags)
              ? item.tags.map((tag) => asString(tag, '', 40).trim()).filter(Boolean).slice(0, 12)
              : [],
            notes: asString(item.notes, '', 300),
            addedAt: asString(item.addedAt, new Date().toISOString(), 40),
          };
        })
        .filter((item): item is MediaAsset => Boolean(item))
        .slice(0, 300)
    : [];
  return { items };
}

export function sanitizeSiteConfig(config: SiteConfig): SiteConfig {
  return {
    theme: sanitizeTheme(config.theme),
    login: sanitizeLogin(config.login),
    homepage: sanitizeHomepage(config.homepage),
    navigation: sanitizeNavigation(config.navigation),
    footer: sanitizeFooter(config.footer),
    banners: sanitizeBanners(config.banners),
    popups: sanitizePopups(config.popups),
    testimonials: sanitizeTestimonials(config.testimonials),
    challenges: sanitizeChallenges(config.challenges),
    features: sanitizeFeatures(config.features),
    seo: sanitizeSeo(config.seo),
    media: sanitizeMedia(config.media),
  };
}

// ---------------------------------------------------------------------------
// Audience / schedule helpers
// ---------------------------------------------------------------------------

export interface StudentAudience {
  exam?: string | null;
  classLevel?: string | null;
}

export function audienceMatches(target: AudienceTarget, student: StudentAudience | null): boolean {
  if (!target || target === 'all') return true;
  if (!student?.exam) return false;
  const exam = String(student.exam).toUpperCase();
  if (target === 'JEE' || target === 'NEET') return target === exam;
  const [targetExam, targetClass] = target.split('-');
  return targetExam === exam && targetClass === String(student.classLevel || '');
}

export function parseSchedule(value?: string | null): number | null {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? null : time;
}

export function isWithinSchedule(
  startAt?: string | null,
  endAt?: string | null,
  now = Date.now()
): boolean {
  const start = parseSchedule(startAt);
  const end = parseSchedule(endAt);
  if (start !== null && start > now) return false;
  if (end !== null && end < now) return false;
  return true;
}

export type BannerDerivedState = 'active' | 'scheduled' | 'expired' | 'draft' | 'paused' | 'archived';

export function getBannerState(banner: Banner, now = Date.now()): BannerDerivedState {
  if (banner.status !== 'published') return banner.status;
  const start = parseSchedule(banner.startAt);
  const end = parseSchedule(banner.endAt);
  if (start !== null && start > now) return 'scheduled';
  if (end !== null && end < now) return 'expired';
  return 'active';
}

export function isBannerVisible(
  banner: Banner,
  student: StudentAudience | null,
  placement: Banner['placements'][number],
  now = Date.now()
): boolean {
  if (getBannerState(banner, now) !== 'active') return false;
  if (!banner.placements.includes(placement)) return false;
  return audienceMatches(banner.audience, student);
}

export function selectBannersForPlacement(
  banners: BannersConfig,
  student: StudentAudience | null,
  placement: Banner['placements'][number],
  now = Date.now()
): Banner[] {
  return banners.items
    .filter((banner) => isBannerVisible(banner, student, placement, now))
    .sort((a, b) => b.priority - a.priority || b.updatedAt.localeCompare(a.updatedAt));
}

// ---------------------------------------------------------------------------
// Homepage sections
// ---------------------------------------------------------------------------

export function getHomeSectionsForStudent(
  homepage: HomepageConfig,
  student: StudentAudience | null
): HomeSectionConfig[] {
  return homepage.sections.filter(
    (section) => section.visible && audienceMatches(section.audience, student)
  );
}

export function moveSection(
  sections: HomeSectionConfig[],
  from: number,
  to: number
): HomeSectionConfig[] {
  if (from < 0 || from >= sections.length || to < 0 || to >= sections.length) return sections;
  const next = [...sections];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

// ---------------------------------------------------------------------------
// Popups
// ---------------------------------------------------------------------------

export type PopupFrequencyStorage = Pick<Storage, 'getItem' | 'setItem'>;

export function getPopupState(
  popup: NoticePopup,
  now = Date.now()
): 'active' | 'scheduled' | 'expired' | 'paused' {
  if (!popup.active) return 'paused';
  const start = parseSchedule(popup.startAt);
  const end = parseSchedule(popup.endAt);
  if (start !== null && start > now) return 'scheduled';
  if (end !== null && end < now) return 'expired';
  return 'active';
}

export function popupShouldDisplay(
  popup: NoticePopup,
  student: StudentAudience | null,
  placement: PopupPlacementContext,
  storage: PopupFrequencyStorage | null,
  now = Date.now()
): boolean {
  if (getPopupState(popup, now) !== 'active') return false;
  if (!popup.placements.includes(placement) && !popup.placements.includes('all')) return false;
  if (!audienceMatches(popup.audience, student)) return false;
  if (!storage) return popup.frequency === 'always';
  const seenKey = `ec_popup_seen_${popup.id}`;
  const seen = storage.getItem(seenKey);
  if (!seen) return true;
  if (popup.frequency === 'always') return true;
  if (popup.frequency === 'once_user') return false;
  if (popup.frequency === 'once_session') {
    return typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(seenKey) !== '1' : false;
  }
  if (popup.frequency === 'once_day') {
    const today = new Date(now).toISOString().slice(0, 10);
    return seen !== today;
  }
  return true;
}

export type PopupPlacementContext = 'home' | 'login' | 'dashboard';

export function markPopupSeen(
  popup: NoticePopup,
  storage: PopupFrequencyStorage,
  now = Date.now()
): void {
  const key = `ec_popup_seen_${popup.id}`;
  if (popup.frequency === 'once_day') {
    storage.setItem(key, new Date(now).toISOString().slice(0, 10));
  } else {
    storage.setItem(key, '1');
  }
  if (popup.frequency === 'once_session' && typeof sessionStorage !== 'undefined') {
    sessionStorage.setItem(key, '1');
  }
}

export function pickPopupForPlacement(
  popups: PopupsConfig,
  student: StudentAudience | null,
  placement: PopupPlacementContext,
  storage: PopupFrequencyStorage | null,
  now = Date.now()
): NoticePopup | null {
  const candidates = popups.items
    .filter((popup) => popupShouldDisplay(popup, student, placement, storage, now))
    .sort((a, b) => b.priority - a.priority);
  return candidates[0] || null;
}

// ---------------------------------------------------------------------------
// Search / personal library helpers
// ---------------------------------------------------------------------------

export function libraryKey(item: Pick<LibraryItem, 'item_type' | 'item_id'>): string {
  return `${item.item_type}:${item.item_id}`;
}

export function isLibraryItemType(value: string): value is LibraryItem['item_type'] {
  return ['bookmark', 'note', 'recent', 'challenge', 'revision'].includes(value);
}

export function presetLabel(preset: string): string {
  return preset
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function createHomeSection(type: HomeSectionType, index = 0): HomeSectionConfig {
  const titles: Partial<Record<HomeSectionType, string>> = {
    hero: 'Build your rank, one focused day at a time.',
    goal: "Today's Goal",
    upcoming_tests: 'Upcoming tests',
    live_tests: 'Live tests',
    events: 'Events & campaigns',
    featured_batches: 'Featured batches',
    featured_series: 'Featured series',
    continue_learning: 'Continue learning',
    popular_lectures: 'Popular lectures',
    subject_shortcuts: 'Subject shortcuts',
    study_progress: 'Your study pulse',
    announcements: 'Announcements',
    challenges: 'Study challenges',
    leaderboard_preview: 'Leaderboard snapshot',
    quick_links: 'Quick links',
    promo: 'A message for your students',
    custom: 'Custom section',
    testimonials: 'Student stories',
  };
  const subtitles: Partial<Record<HomeSectionType, string>> = {
    goal: 'A single, achievable target picked by your mentor.',
    study_progress: 'Live progress from real attempts and watch time.',
    live_tests: 'Timed, server-scored and ready right now.',
    upcoming_tests: 'Put these on your calendar before the week fills up.',
    events: 'Marathons, doubt sessions and result announcements.',
    continue_learning: 'Pick up where you left off.',
    featured_batches: 'Structured programmes with lectures, notes and tests.',
    featured_series: 'Focused chapter and subject collections.',
    popular_lectures: 'The latest lectures published for your class.',
    challenges: 'Short, focused sprints that keep momentum high.',
    announcements: 'The latest notes from your mentors.',
    leaderboard_preview: 'Top scores from your most recent test.',
  };
  const layouts: Partial<Record<HomeSectionType, HomeSectionConfig['layout']>> = {
    hero: 'carousel',
    goal: 'grid',
    announcements: 'list',
    leaderboard_preview: 'list',
    promo: 'banner',
    custom: 'split',
    testimonials: 'grid',
  };
  return {
    id: makeId(`section-${index}`),
    type,
    title: titles[type] || HOME_SECTION_LABELS[type],
    subtitle: subtitles[type] || '',
    visible: true,
    audience: 'all',
    limit: type === 'leaderboard_preview' ? 5 : 6,
    layout: layouts[type] || 'grid',
    ctaLabel: type === 'featured_batches' || type === 'continue_learning' ? 'View all' : '',
    ctaHref: type === 'featured_batches' || type === 'continue_learning' ? '/lectures' : type === 'events' ? '/events' : '',
    imageUrl: '',
    body: '',
    accent: '',
    itemIds: [],
  };
}

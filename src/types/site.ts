/**
 * Site configuration contracts shared by the public website and the admin
 * control centre. These values are persisted in Cloudflare D1 (`site_settings`) and
 * delivered to the browser through the public `/public/site` endpoint.
 *
 * Nothing in this file contains secrets: every field is safe to render.
 */

import type {
  ChallengesScreenConfig,
  ChatScreenConfig,
  EventsScreenConfig,
  LeaderboardScreenConfig,
  LecturePlayerScreenConfig,
  LecturesScreenConfig,
  NotificationsScreenConfig,
  OnboardingScreenConfig,
  ProfileScreenConfig,
  SearchScreenConfig,
  TestPlayerScreenConfig,
  TestsScreenConfig,
} from './screens';

export type ThemePresetId =
  | 'modern'
  | 'minimal'
  | 'academic'
  | 'dark-premium'
  | 'colorful-learning';

export type ThemeMode = 'light' | 'dark' | 'system';
export type FontPreset = 'modern' | 'minimal' | 'academic' | 'display';
export type ButtonShape = 'rounded' | 'pill' | 'square';
export type CardStyle = 'elevated' | 'outlined' | 'flat' | 'glass';
export type ShadowStrength = 'none' | 'soft' | 'strong';
export type PageWidth = 'narrow' | 'standard' | 'wide';
export type Density = 'compact' | 'comfortable' | 'spacious';
export type AnimationIntensity = 'none' | 'subtle' | 'expressive';
export type HeaderStyle = 'light' | 'dark' | 'transparent' | 'gradient';
export type HeadingStyle = 'tight' | 'balanced' | 'editorial';

export interface LinkItem {
  id: string;
  label: string;
  href: string;
  external?: boolean;
}

export interface ThemeConfig {
  preset: ThemePresetId;
  brandName: string;
  tagline: string;
  logoText: string;
  /** Optional image logo. Empty string means "use the text mark". */
  logoUrl: string;
  faviconUrl: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  surfaceColor: string;
  textColor: string;
  mode: ThemeMode;
  fontPreset: FontPreset;
  headingStyle: HeadingStyle;
  radius: number;
  buttonShape: ButtonShape;
  cardStyle: CardStyle;
  shadow: ShadowStrength;
  pageWidth: PageWidth;
  density: Density;
  stickyHeader: boolean;
  headerStyle: HeaderStyle;
  animation: AnimationIntensity;
  showBottomNav: boolean;
  emptyStateTitle: string;
  emptyStateBody: string;
}

export type LoginLayout = 'split' | 'centered' | 'hero';
export type LoginBackgroundType = 'solid' | 'gradient' | 'image';
export type LoginCardAlign = 'left' | 'center' | 'right';
export type LoginCardWidth = 'compact' | 'standard' | 'wide';

export interface LoginConfig {
  logoUrl: string;
  title: string;
  subtitle: string;
  welcomeMessage: string;
  backgroundType: LoginBackgroundType;
  backgroundColor: string;
  gradientFrom: string;
  gradientTo: string;
  backgroundImageUrl: string;
  heroImageUrl: string;
  heroTitle: string;
  heroSubtitle: string;
  highlights: string[];
  layout: LoginLayout;
  cardAlign: LoginCardAlign;
  cardWidth: LoginCardWidth;
  emailLabel: string;
  passwordLabel: string;
  emailHelp: string;
  passwordHelp: string;
  showGoogle: boolean;
  showSignup: boolean;
  forgotPasswordText: string;
  forgotPasswordHelp: string;
  bannerEnabled: boolean;
  bannerTitle: string;
  bannerBody: string;
  bannerCtaLabel: string;
  bannerCtaHref: string;
  footerText: string;
  footerLinks: LinkItem[];
  termsUrl: string;
  privacyUrl: string;
  mobileImagePosition: 'top' | 'hidden' | 'background';
  showTestimonials: boolean;
  showOnboardingNote: boolean;
}

export type HomeSectionType =
  | 'hero'
  | 'goal'
  | 'upcoming_tests'
  | 'live_tests'
  | 'events'
  | 'featured_batches'
  | 'featured_series'
  | 'continue_learning'
  | 'popular_lectures'
  | 'subject_shortcuts'
  | 'study_progress'
  | 'announcements'
  | 'challenges'
  | 'leaderboard_preview'
  | 'quick_links'
  | 'promo'
  | 'custom'
  | 'testimonials';

export type AudienceTarget =
  | 'all'
  | 'JEE'
  | 'NEET'
  | 'Dropper'
  | 'JEE-11'
  | 'JEE-12'
  | 'JEE-Dropper'
  | 'NEET-11'
  | 'NEET-12'
  | 'NEET-Dropper';

export type SectionLayout = 'grid' | 'carousel' | 'split' | 'banner' | 'list';

export interface HomeSectionConfig {
  id: string;
  type: HomeSectionType;
  title: string;
  subtitle: string;
  visible: boolean;
  audience: AudienceTarget;
  limit: number;
  layout: SectionLayout;
  ctaLabel: string;
  ctaHref: string;
  imageUrl: string;
  body: string;
  accent: string;
  /** Optional explicit ordering for featured batch/series/lecture sections. */
  itemIds?: string[];
}

export interface HomepageConfig {
  showGreeting: boolean;
  greetingTemplate: string;
  showSearch: boolean;
  showQuickStats: boolean;
  sections: HomeSectionConfig[];
}

export interface NavigationLink {
  id: string;
  label: string;
  href: string;
  icon: string;
  visible: boolean;
}

export interface NavigationConfig {
  headerLinks: NavigationLink[];
  bottomLinks: NavigationLink[];
  showSearch: boolean;
  ctaLabel: string;
  ctaHref: string;
  announcementBarEnabled: boolean;
  announcementBarText: string;
  announcementBarHref: string;
}

export interface FooterLinkColumn {
  id: string;
  title: string;
  links: LinkItem[];
}

export interface FooterConfig {
  show: boolean;
  text: string;
  note: string;
  columns: FooterLinkColumn[];
  socialLinks: LinkItem[];
  copyright: string;
}

export type BannerPlacement =
  | 'home_hero'
  | 'dashboard'
  | 'login'
  | 'lectures'
  | 'tests';

export type BannerStatus = 'draft' | 'published' | 'paused' | 'archived';

export interface Banner {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  badge: string;
  desktopImageUrl: string;
  mobileImageUrl: string;
  backgroundColor: string;
  overlay: number;
  textAlign: 'left' | 'center' | 'right';
  ctaLabel: string;
  ctaHref: string;
  placements: BannerPlacement[];
  audience: AudienceTarget;
  startAt: string;
  endAt: string;
  timezone: 'Asia/Kolkata';
  priority: number;
  status: BannerStatus;
  createdAt: string;
  updatedAt: string;
}

export interface BannersConfig {
  items: Banner[];
  autoplay: boolean;
  rotationSeconds: number;
  showDots: boolean;
  showArrows: boolean;
}

export type PopupFrequency =
  | 'once_session'
  | 'once_day'
  | 'once_user'
  | 'always';

export type PopupPlacement = 'home' | 'login' | 'dashboard' | 'all';

export interface NoticePopup {
  id: string;
  title: string;
  body: string;
  imageUrl: string;
  ctaLabel: string;
  ctaHref: string;
  active: boolean;
  frequency: PopupFrequency;
  placements: PopupPlacement[];
  audience: AudienceTarget;
  startAt: string;
  endAt: string;
  priority: number;
  dismissible: boolean;
  updatedAt: string;
}

export interface PopupsConfig {
  items: NoticePopup[];
}

export interface Testimonial {
  id: string;
  name: string;
  exam: 'JEE' | 'NEET';
  classLevel: '11' | '12' | 'Dropper';
  quote: string;
  avatarUrl: string;
  result: string;
  rating: number;
  featured: boolean;
  active: boolean;
  order: number;
}

export interface TestimonialsConfig {
  items: Testimonial[];
  title: string;
  subtitle: string;
}

export type ChallengeTargetType = 'lectures' | 'tests' | 'minutes' | 'checklist';

export interface ChallengeChecklistItem {
  id: string;
  label: string;
}

export interface StudyChallenge {
  id: string;
  title: string;
  description: string;
  targetType: ChallengeTargetType;
  targetCount: number;
  checklist: ChallengeChecklistItem[];
  startAt: string;
  endAt: string;
  audience: AudienceTarget;
  active: boolean;
  reward: string;
  color: string;
  updatedAt: string;
}

export interface ChallengesConfig {
  items: StudyChallenge[];
}

export interface FeatureFlags {
  lectures: boolean;
  resources: boolean;
  tests: boolean;
  leaderboard: boolean;
  chat: boolean;
  notifications: boolean;
  events: boolean;
  challenges: boolean;
  search: boolean;
  bookmarks: boolean;
  notes: boolean;
  continueLearning: boolean;
  recentlyViewed: boolean;
  testimonials: boolean;
  popups: boolean;
  googleAuth: boolean;
  signup: boolean;
  bottomNav: boolean;
}

export interface SeoConfig {
  title: string;
  description: string;
  keywords: string[];
  ogImageUrl: string;
  twitterHandle: string;
  canonicalBase: string;
  robotsIndex: boolean;
  searchPlaceholder: string;
  popularSearches: string[];
  enableGlobalSearch: boolean;
}

export type MediaAssetType = 'image' | 'pdf' | 'video' | 'other';

export interface MediaAsset {
  id: string;
  name: string;
  url: string;
  type: MediaAssetType;
  tags: string[];
  notes: string;
  addedAt: string;
}

export interface MediaConfig {
  items: MediaAsset[];
}

export interface SiteConfig {
  theme: ThemeConfig;
  /**
   * Login / signup presentation. Kept as a stored contract because the live
   * login screen still renders published values, but it is intentionally NOT
   * exposed in the admin screen editor.
   */
  login: LoginConfig;
  homepage: HomepageConfig;
  navigation: NavigationConfig;
  footer: FooterConfig;
  banners: BannersConfig;
  popups: PopupsConfig;
  testimonials: TestimonialsConfig;
  challenges: ChallengesConfig;
  features: FeatureFlags;
  seo: SeoConfig;
  media: MediaConfig;
  // Screen Studio documents (presentation only).
  lectures: LecturesScreenConfig;
  lecturePlayer: LecturePlayerScreenConfig;
  tests: TestsScreenConfig;
  testPlayer: TestPlayerScreenConfig;
  leaderboard: LeaderboardScreenConfig;
  profile: ProfileScreenConfig;
  eventsScreen: EventsScreenConfig;
  challengesScreen: ChallengesScreenConfig;
  chat: ChatScreenConfig;
  notifications: NotificationsScreenConfig;
  search: SearchScreenConfig;
  onboarding: OnboardingScreenConfig;
}

export type SiteSettingKey = keyof SiteConfig;

export type PublicSiteConfig = Partial<SiteConfig>;

export interface PublicSiteConfigResponse {
  config: PublicSiteConfig;
  publishedAt: Partial<Record<SiteSettingKey, string>>;
  /** True when the deployment does not yet expose the site-settings API. */
  degraded?: boolean;
}

export interface SiteSettingRow {
  key: SiteSettingKey;
  draft: unknown;
  published: unknown;
  published_at: string | null;
  updated_at: string | null;
  updated_by?: string | null;
}

export interface AdminActivityEntry {
  id: string;
  actor_email: string;
  action: string;
  target_type: string;
  target_id: string;
  summary: string;
  created_at: string;
}

export interface AdminAnalyticsResponse {
  students: {
    total: number;
    byExam: Record<string, number>;
    byClass: Record<string, number>;
    recent: Array<{
      firebase_uid: string;
      display_name: string;
      email: string | null;
      exam: string | null;
      class_level: string | null;
      created_at: string;
    }>;
  };
  content: {
    total: number;
    active: number;
    byKind: Record<string, { total: number; active: number }>;
  };
  attempts: {
    total: number;
    averagePercentage: number;
    last14Days: Array<{ date: string; count: number }>;
    topStudents: Array<{
      firebaseUid: string;
      name: string;
      avatarUrl: string | null;
      attempts: number;
      averagePercentage: number;
    }>;
  };
  subjectPerformance: Array<{
    subject: string;
    attempts: number;
    averagePercentage: number;
    correct: number;
    incorrect: number;
    unanswered: number;
  }>;
  enrollments: {
    total: number;
    byItem: Array<{
      itemId: string;
      title: string;
      kind: string;
      count: number;
    }>;
  };
  contentHealth: {
    missingThumbnails: number;
    testsWithoutQuestions: number;
    eventsMissingSchedule: number;
    inactiveContent: number;
  };
}

export interface AdminEnrollmentRow {
  id: string;
  firebase_uid: string;
  student_name: string | null;
  student_email: string | null;
  exam: string | null;
  class_level: string | null;
  item_type: 'batch' | 'series';
  item_id: string;
  item_title: string | null;
  active: boolean;
  status: 'active' | 'revoked' | 'expired';
  source: 'manual' | 'admin_bulk' | 'auto_rule' | 'access_code' | 'self_service' | 'import';
  expires_at: string | null;
  revoked_at: string | null;
  updated_at: string;
  created_at: string;
}

export interface AdminEnrollmentCounts {
  active: number;
  revoked: number;
  total: number;
}

export interface AdminEnrollmentListResponse {
  items: AdminEnrollmentRow[];
  total: number;
  page: number;
  pageSize: number;
  counts: AdminEnrollmentCounts;
  degraded?: boolean;
}

export interface EnrollmentScope {
  mode: 'selected' | 'all' | 'filter';
  targeted: number;
  eligible: number;
  skipped: number;
  crossTrack: boolean;
  requiresConfirmation: boolean;
  label: string;
  filters: { exam: 'JEE' | 'NEET' | ''; classLevel: '11' | '12' | '' };
  includeFuture: boolean;
  respectEligibility: boolean;
}

export interface EnrollmentSkippedStudent {
  uid: string;
  name?: string | null;
  reason: 'not_found' | 'ineligible_exam' | 'ineligible_class' | 'not_allowed';
}

export interface EnrollmentBulkSummary {
  targeted: number;
  eligible: number;
  created: number;
  reactivated: number;
  alreadyActive: number;
  skipped: number;
  failed: number;
  ruleSaved: boolean;
}

export interface EnrollmentBulkResult {
  summary: EnrollmentBulkSummary;
  scope?: EnrollmentScope;
  skipped?: EnrollmentSkippedStudent[];
  failures?: Array<{ uid: string; name?: string | null; reason: string }>;
  rule?: EnrollmentRule | null;
  ruleError?: string | null;
  dryRun?: boolean;
  preview?: number;
}

export interface EnrollmentRule {
  id: string;
  item_type: 'batch' | 'series';
  item_id: string;
  item_title?: string | null;
  item_active?: boolean | null;
  name: string;
  include_future: boolean;
  respect_eligibility: boolean;
  filter_exam: '' | 'JEE' | 'NEET';
  filter_class: '' | '11' | '12';
  expires_at: string | null;
  active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
  last_applied_at: string | null;
  last_applied_count: number;
}

export interface EnrollmentHistoryEvent {
  id: string;
  enrollment_id: string | null;
  firebase_uid: string;
  student_name: string | null;
  student_email: string | null;
  item_type: 'batch' | 'series';
  item_id: string;
  item_title: string | null;
  action: 'granted' | 'reactivated' | 'revoked' | 'auto_enrolled' | 'deduplicated' | 'expired';
  source: string;
  actor_email: string;
  detail: Record<string, unknown>;
  created_at: string;
}

export interface AdminStudentDirectoryResponse {
  items: Array<{
    firebase_uid: string;
    display_name: string;
    email: string | null;
    exam: string;
    class_level: string;
    avatar_url: string | null;
    created_at: string;
    updated_at: string;
  }>;
  total: number;
  page: number;
  pageSize: number;
}

export type LibraryItemType =
  | 'bookmark'
  | 'note'
  | 'recent'
  | 'challenge'
  | 'revision';

export interface LibraryItem {
  id: string;
  item_type: LibraryItemType;
  item_id: string;
  payload: Record<string, unknown>;
  updated_at: string;
}

export interface LectureNote {
  id: string;
  lectureId: string;
  lectureTitle: string;
  seconds: number;
  text: string;
  createdAt: string;
}

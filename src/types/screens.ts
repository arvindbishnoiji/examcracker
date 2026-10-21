/**
 * Per-screen presentation contracts.
 *
 * Every student-facing screen except Login / Signup has a typed, publishable
 * configuration document. These values only control *presentation* — labels,
 * headings, section visibility/order, layout, item limits and empty states.
 *
 * They can never change authentication, enrolment rules, server-side scoring,
 * answer-key protection, route protection or any other business rule.
 *
 * All documents are validated on the client (`site-validation.ts`) and again on
 * the Worker (`workers/ec-api`) before they are stored.
 */

export type ScreenLayout = 'grid' | 'list' | 'compact';
export type ScreenAnnouncementTone = 'brand' | 'info' | 'success' | 'warning';

/** Optional informational banner rendered near the top of a screen. */
export interface ScreenAnnouncement {
  enabled: boolean;
  title: string;
  body: string;
  ctaLabel: string;
  ctaHref: string;
  tone: ScreenAnnouncementTone;
}

/** A section that exists inside a screen and can be hidden or reordered. */
export interface ScreenSectionConfig {
  id: string;
  title: string;
  subtitle: string;
  visible: boolean;
}

export interface ScreenHelp {
  title: string;
  body: string;
}

/**
 * Fields shared by every manageable screen. Student pages render a safe default
 * whenever a value is missing, so a half-published document can never blank a
 * screen.
 */
export interface ScreenBaseConfig {
  pageTitle: string;
  pageSubtitle: string;
  eyebrow: string;
  showHeader: boolean;
  showSearch: boolean;
  searchPlaceholder: string;
  showFilters: boolean;
  showSort: boolean;
  layout: ScreenLayout;
  itemLimit: number;
  emptyTitle: string;
  emptyBody: string;
  noResultsTitle: string;
  noResultsBody: string;
  announcement: ScreenAnnouncement;
  sections: ScreenSectionConfig[];
  help: ScreenHelp;
}

// ---------------------------------------------------------------------------
// Lectures hub — /lectures
// ---------------------------------------------------------------------------

export interface LecturesTabLabels {
  batches: string;
  series: string;
  lectures: string;
  resources: string;
}

export interface LecturesScreenConfig extends ScreenBaseConfig {
  tabLabels: LecturesTabLabels;
  mineFilterLabel: string;
  sortNewestLabel: string;
  sortTitleLabel: string;
  enrolledCtaLabel: string;
  watchCtaLabel: string;
  accessNoteTitle: string;
  accessNoteBody: string;
}

// ---------------------------------------------------------------------------
// Lecture player — /lectures/[id]
// ---------------------------------------------------------------------------

export interface LecturePlayerScreenConfig extends ScreenBaseConfig {
  backLabel: string;
  relatedTitle: string;
  showRelated: boolean;
  showNotes: boolean;
  notesTitle: string;
  markCompleteLabel: string;
  markIncompleteLabel: string;
  saveProgressLabel: string;
  previousLabel: string;
  nextLabel: string;
  relatedEmptyTitle: string;
  relatedEmptyBody: string;
  progressNote: string;
}

// ---------------------------------------------------------------------------
// Tests hub — /tests
// ---------------------------------------------------------------------------

export interface TestsFilterLabels {
  all: string;
  live: string;
  upcoming: string;
  completed: string;
}

export interface TestsScreenConfig extends ScreenBaseConfig {
  filterLabels: TestsFilterLabels;
  sortSoonestLabel: string;
  sortTitleLabel: string;
  openCtaLabel: string;
  attemptCtaLabel: string;
  endedCtaLabel: string;
  infoTitle: string;
  infoBody: string;
}

// ---------------------------------------------------------------------------
// Test attempt / result — /tests/[id]
// ---------------------------------------------------------------------------

export interface TestPlayerScreenConfig extends ScreenBaseConfig {
  instructionsTitle: string;
  instructions: string[];
  showInstructions: boolean;
  submitLabel: string;
  submitConfirm: string;
  exitLabel: string;
  clearAnswerLabel: string;
  paletteTitle: string;
  resultTitle: string;
  reviewTitle: string;
  reviewEmpty: string;
  leaderboardCtaLabel: string;
  /** Minutes remaining at which the timer turns red. Display only. */
  timerWarningMinutes: number;
}

// ---------------------------------------------------------------------------
// Leaderboard — /leaderboard
// ---------------------------------------------------------------------------

export interface LeaderboardScreenConfig extends ScreenBaseConfig {
  selectorLabel: string;
  refreshLabel: string;
  browseCtaLabel: string;
  showTestSelector: boolean;
  showAvatars: boolean;
  showSubmittedTime: boolean;
  noTestTitle: string;
  noTestBody: string;
  noAttemptsTitle: string;
  noAttemptsBody: string;
  rankLabel: string;
  infoTitle: string;
  infoBody: string;
}

// ---------------------------------------------------------------------------
// Profile & learning analysis — /profile
// ---------------------------------------------------------------------------

export interface ProfileScreenConfig extends ScreenBaseConfig {
  heroEyebrow: string;
  askDoubtLabel: string;
  signOutLabel: string;
  editLabel: string;
  allowProfileEdit: boolean;
  showQuickStats: boolean;
  showLevel: boolean;
  showRecentAttempts: boolean;
  showLessonProgress: boolean;
  showScoreSummary: boolean;
  showQuickLinks: boolean;
  recentAttemptsTitle: string;
  lessonProgressTitle: string;
  scoreSummaryTitle: string;
  quickLinksTitle: string;
  emptyAttempts: string;
  emptyProgress: string;
  levelNote: string;
}

// ---------------------------------------------------------------------------
// Events & calendar — /events
// ---------------------------------------------------------------------------

export interface EventsFilterLabels {
  all: string;
  live: string;
  upcoming: string;
  completed: string;
  unscheduled: string;
}

export interface EventsScreenConfig extends ScreenBaseConfig {
  showCalendar: boolean;
  calendarNote: string;
  filterLabels: EventsFilterLabels;
  addToCalendarLabel: string;
  detailsCtaLabel: string;
  infoTitle: string;
  infoBody: string;
}

// ---------------------------------------------------------------------------
// Study challenges — /challenges
// ---------------------------------------------------------------------------

export interface ChallengesScreenConfig extends ScreenBaseConfig {
  joinLabel: string;
  leaveLabel: string;
  joinedLabel: string;
  endedLabel: string;
  showSchedule: boolean;
  showReward: boolean;
  showChecklist: boolean;
  checklistTitle: string;
  joinHint: string;
}

// ---------------------------------------------------------------------------
// Student chat — /chat
// ---------------------------------------------------------------------------

export interface ChatScreenConfig extends ScreenBaseConfig {
  composerPlaceholder: string;
  sendLabel: string;
  emptyTitle: string;
  emptyBody: string;
  showTimestamp: boolean;
  helpTitle: string;
  helpBody: string;
}

// ---------------------------------------------------------------------------
// Notifications — /notifications
// ---------------------------------------------------------------------------

export interface NotificationsScreenConfig extends ScreenBaseConfig {
  unreadLabel: string;
  readLabel: string;
  markReadLabel: string;
  openLabel: string;
  showUnreadOnlyToggle: boolean;
  unreadOnlyLabel: string;
  showUnreadOnlyEmptyTitle: string;
  showUnreadOnlyEmptyBody: string;
}

// ---------------------------------------------------------------------------
// Search & discovery — /search
// ---------------------------------------------------------------------------

export interface SearchScreenConfig extends ScreenBaseConfig {
  searchCtaLabel: string;
  suggestionsTitle: string;
  suggestions: string[];
  showSuggestions: boolean;
  showKindFilters: boolean;
  infoNote: string;
}

// ---------------------------------------------------------------------------
// Onboarding — /onboarding
// Required name, exam and class collection stays enforced in code.
// ---------------------------------------------------------------------------

export interface OnboardingFeature {
  id: string;
  title: string;
  text: string;
}

export interface OnboardingScreenConfig extends ScreenBaseConfig {
  brandPanelEyebrow: string;
  brandPanelTitle: string;
  brandPanelBody: string;
  showBrandPanel: boolean;
  features: OnboardingFeature[];
  formEyebrow: string;
  formTitle: string;
  nameQuestion: string;
  nameHelp: string;
  namePlaceholder: string;
  examQuestion: string;
  examHelp: string;
  classQuestion: string;
  classHelp: string;
  continueLabel: string;
  backLabel: string;
  finishLabel: string;
  finishingLabel: string;
  restoreNote: string;
  footerNote: string;
  confirmNote: string;
  requiredNotice: string;
}

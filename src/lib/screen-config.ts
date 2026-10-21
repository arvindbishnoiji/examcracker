/**
 * Screen Studio — canonical screen registry, defaults and sanitisation.
 *
 * This module is the single source of truth for:
 *  • which student screens are manageable (every screen except Login/Signup),
 *  • the optional content blocks each screen supports (visibility + order),
 *  • safe defaults used when nothing has been published,
 *  • sanitisation of stored/imported values so a malformed document can never
 *    blank or crash a student screen.
 *
 * Presentation only. Nothing here can change authentication, enrolment,
 * scoring, answer-key protection or access control.
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
  OnboardingFeature,
  ProfileScreenConfig,
  ScreenAnnouncement,
  ScreenAnnouncementTone,
  ScreenBaseConfig,
  ScreenSectionConfig,
  SearchScreenConfig,
  SiteConfig,
  TestPlayerScreenConfig,
  TestsScreenConfig,
} from '@/types';

export type ScreenKey =
  | 'lectures'
  | 'lecturePlayer'
  | 'tests'
  | 'testPlayer'
  | 'leaderboard'
  | 'profile'
  | 'eventsScreen'
  | 'challengesScreen'
  | 'chat'
  | 'notifications'
  | 'search'
  | 'onboarding';

export type ScreenGroup =
  | 'Learning'
  | 'Tests & progress'
  | 'Communication'
  | 'Discovery'
  | 'Setup';

export interface ScreenSectionDefinition {
  id: string;
  label: string;
  description: string;
  /** Required blocks are always rendered and cannot be hidden. */
  required?: boolean;
}

export interface ScreenDefinition {
  key: ScreenKey;
  slug: string;
  label: string;
  route: string;
  description: string;
  icon: string;
  group: ScreenGroup;
  sections: ScreenSectionDefinition[];
  /**
   * Screens with a strict article structure (a player, a form) support section
   * visibility but not free ordering. The editor hides the reorder controls so
   * it never promises something the screen does not honour.
   */
  reorderable?: boolean;
  /** Business logic the editor can never change, shown in the admin UI. */
  locked: string;
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export const SCREEN_DEFINITIONS: ScreenDefinition[] = [
  {
    key: 'lectures',
    slug: 'lectures',
    label: 'Lectures & batches',
    route: '/lectures',
    description: 'The learning library: batches, series, lectures and downloadable resources.',
    icon: '▶',
    group: 'Learning',
    sections: [
      { id: 'tabs', label: 'Content type tabs', description: 'Batches / series / lectures / resources switcher.', required: true },
      { id: 'filters', label: 'Search, sort and enrolment filter', description: 'Search box, sort order and “my courses only”.' },
      { id: 'catalogue', label: 'Course cards', description: 'The real content grid with enrol and access-code actions.', required: true },
      { id: 'access_note', label: '“How access works” note', description: 'Explains free, paid and access-code courses.' },
    ],
    locked: 'Enrolment, access codes, paid-course restrictions and per-lecture server access checks.',
  },
  {
    key: 'lecturePlayer',
    slug: 'lecture-player',
    label: 'Lecture player',
    route: '/lectures/[id]',
    description: 'The video lesson page with notes, progress and the next-lesson list.',
    icon: '▷',
    group: 'Learning',
    sections: [
      { id: 'video', label: 'Video player and actions', description: 'Player, mark-complete and progress controls.', required: true },
      { id: 'notes', label: 'Notes PDF panel', description: 'Embedded PDF when a lecture has notes attached.' },
      { id: 'related', label: 'Up next lessons', description: 'Sidebar list of lessons in the same course.' },
      { id: 'help', label: 'Player tip', description: 'Short note about autoplay and progress saving.' },
    ],
    reorderable: false,
    locked: 'Video source, watch-time tracking, completion saving and access to the parent course.',
  },
  {
    key: 'tests',
    slug: 'tests',
    label: 'Tests & mock exams',
    route: '/tests',
    description: 'The test catalogue with live, upcoming and completed filters.',
    icon: '✎',
    group: 'Tests & progress',
    sections: [
      { id: 'filters', label: 'Filter and search bar', description: 'Status filters, search, sort and live counters.' },
      { id: 'catalogue', label: 'Test cards', description: 'The real test grid with attempt and leaderboard links.', required: true },
      { id: 'info', label: 'Fair-attempt note', description: 'Explains server scoring and hidden answer keys.' },
    ],
    locked: 'Test scheduling, timing, server-side scoring, duplicate-attempt rules and answer-key protection.',
  },
  {
    key: 'testPlayer',
    slug: 'test-player',
    label: 'Test attempt & result',
    route: '/tests/[id]',
    description: 'The timed attempt screen, question palette and post-submission review.',
    icon: '⏱',
    group: 'Tests & progress',
    sections: [
      { id: 'instructions', label: 'Instructions panel', description: 'List of trying instructions beside the palette.' },
      { id: 'attempt', label: 'Question and palette', description: 'Question card, navigation and submit controls.', required: true },
      { id: 'warning', label: 'Submission warning', description: 'Reminder that the server calculates the official score.' },
      { id: 'review', label: 'Review and explanations', description: 'Per-question review shown after submission.' },
    ],
    reorderable: false,
    locked: 'Timer, answer storage, submission, scoring, duplicate-attempt blocking and answer-key release after submission only.',
  },
  {
    key: 'leaderboard',
    slug: 'leaderboard',
    label: 'Leaderboard',
    route: '/leaderboard',
    description: 'Per-test rankings, never a mixed global score.',
    icon: '♜',
    group: 'Tests & progress',
    sections: [
      { id: 'selector', label: 'Test selector', description: 'Choose which test ranking to view.', required: true },
      { id: 'ranking', label: 'Ranking list', description: 'Real ranks, scores and attempts.', required: true },
      { id: 'info', label: 'Privacy note', description: 'Explains that no private student data is shown.' },
    ],
    locked: 'Rankings are computed from server-scored attempts and always isolated per test.',
  },
  {
    key: 'profile',
    slug: 'profile',
    label: 'Profile & learning analysis',
    route: '/profile',
    description: 'Student identity, real statistics, attempts, lesson progress and quick links.',
    icon: '◍',
    group: 'Tests & progress',
    sections: [
      { id: 'identity', label: 'Identity card', description: 'Name, exam, class and account actions.', required: true },
      { id: 'stats', label: 'Statistics tiles', description: 'Tests taken, average, lessons and watch time.' },
      { id: 'level', label: 'Learning level', description: 'Progress indicator with explanation.' },
      { id: 'recent_attempts', label: 'Recent attempts', description: 'Latest submitted tests with marks.' },
      { id: 'lesson_progress', label: 'Lesson progress', description: 'Lectures started or completed.' },
      { id: 'score_summary', label: 'Score summary', description: 'Total marks across submitted tests.' },
      { id: 'quick_links', label: 'Quick links', description: 'Shortcuts to the main student areas.' },
    ],
    locked: 'All statistics come from real attempts and watch time. No invented levels, streaks or marks.',
  },
  {
    key: 'eventsScreen',
    slug: 'events',
    label: 'Events & calendar',
    route: '/events',
    description: 'The event calendar and event cards, including ICS download.',
    icon: '▦',
    group: 'Communication',
    sections: [
      { id: 'calendar', label: 'Month calendar', description: 'Clickable month grid with event dots.' },
      { id: 'list', label: 'Event cards', description: 'Real published events for the student’s exam and class.', required: true },
      { id: 'info', label: 'Reminder note', description: 'Explains how calendar downloads work.' },
    ],
    locked: 'Event schedules, audience targeting and publication state come from the real event records.',
  },
  {
    key: 'challengesScreen',
    slug: 'challenges',
    label: 'Study challenges',
    route: '/challenges',
    description: 'Challenge cards with checklists and join/leave actions.',
    icon: '⚡',
    group: 'Learning',
    sections: [
      { id: 'list', label: 'Challenge cards', description: 'Active challenges for the student’s audience.', required: true },
      { id: 'info', label: 'How challenges work', description: 'Short explanation of joined progress.' },
    ],
    locked: 'Challenge definitions, audience targeting and per-student checklist progress are stored data.',
  },
  {
    key: 'chat',
    slug: 'chat',
    label: 'Feedback & help',
    route: '/feedback',
    description: 'Send suggestions and report issues, then track the team response.',
    icon: '✉',
    group: 'Communication',
    sections: [
      { id: 'thread', label: 'Message thread and composer', description: 'D1-backed feedback form, inbox and response history.', required: true },
      { id: 'help', label: 'Privacy note', description: 'Explains that only the student’s own thread is visible.' },
    ],
    locked: 'Firebase-authenticated ownership checks and per-student D1 feedback isolation.',
  },
  {
    key: 'notifications',
    slug: 'notifications',
    label: 'Notifications',
    route: '/notifications',
    description: 'The in-app inbox with read and unread states.',
    icon: '◉',
    group: 'Communication',
    sections: [
      { id: 'list', label: 'Notification list', description: 'Live inbox with mark-read actions.', required: true },
      { id: 'info', label: 'Delivery note', description: 'Explains in-app delivery versus browser push.' },
    ],
    locked: 'D1 inbox ownership and read state.',
  },
  {
    key: 'search',
    slug: 'search',
    label: 'Search & discovery',
    route: '/search',
    description: 'Search across lectures, tests, batches, series, events and notices.',
    icon: '⌕',
    group: 'Discovery',
    sections: [
      { id: 'suggestions', label: 'Suggested searches', description: 'Pills shown before the student types.' },
      { id: 'kind_filters', label: 'Result type filters', description: 'Filter chips with live counts.' },
      { id: 'results', label: 'Search results', description: 'Results from real published content.', required: true },
      { id: 'info', label: 'Discovery note', description: 'Short note under the results.' },
    ],
    reorderable: false,
    locked: 'Search runs over the real content the student is allowed to see.',
  },
  {
    key: 'onboarding',
    slug: 'onboarding',
    label: 'Onboarding',
    route: '/onboarding',
    description: 'The required first-run setup: name, JEE/NEET and Class 11/12.',
    icon: '◈',
    group: 'Setup',
    sections: [],
    reorderable: false,
    locked:
      'Name, exam and class are required and validated server-side. Onboarding cannot be skipped or hidden from this editor.',
  },
];

const SCREEN_BY_KEY = new Map<ScreenKey, ScreenDefinition>(
  SCREEN_DEFINITIONS.map((definition) => [definition.key, definition])
);
const SCREEN_BY_SLUG = new Map<string, ScreenDefinition>(
  SCREEN_DEFINITIONS.map((definition) => [definition.slug, definition])
);

export const SCREEN_KEYS: ScreenKey[] = SCREEN_DEFINITIONS.map((definition) => definition.key);

export function isScreenKey(value: string): value is ScreenKey {
  return SCREEN_BY_KEY.has(value as ScreenKey);
}

export function screenDefinition(key: ScreenKey): ScreenDefinition {
  return SCREEN_BY_KEY.get(key) || SCREEN_DEFINITIONS[0];
}

export function findScreenBySlug(slug: string | null | undefined): ScreenDefinition | null {
  if (!slug) return null;
  return SCREEN_BY_SLUG.get(slug) || null;
}

export function screenHref(slug: string): string {
  return `/admin/screens/${slug}`;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function defaultAnnouncement(overrides: Partial<ScreenAnnouncement> = {}): ScreenAnnouncement {
  return {
    enabled: false,
    title: '',
    body: '',
    ctaLabel: '',
    ctaHref: '',
    tone: 'brand',
    ...overrides,
  };
}

function section(
  definition: ScreenSectionDefinition,
  overrides: Partial<ScreenSectionConfig> = {}
): ScreenSectionConfig {
  return {
    id: definition.id,
    title: definition.label,
    subtitle: '',
    visible: true,
    ...overrides,
  };
}

export function baseScreen(
  key: ScreenKey,
  config: Partial<ScreenBaseConfig> = {}
): ScreenBaseConfig {
  const definition = screenDefinition(key);
  return {
    pageTitle: definition.label,
    pageSubtitle: '',
    eyebrow: '',
    showHeader: true,
    showSearch: true,
    searchPlaceholder: 'Search…',
    showFilters: true,
    showSort: true,
    layout: 'grid',
    itemLimit: 12,
    emptyTitle: 'Nothing here yet',
    emptyBody: 'New content appears here as soon as your mentor publishes it.',
    noResultsTitle: 'No matches',
    noResultsBody: 'Try a shorter search or clear the filters.',
    announcement: defaultAnnouncement(),
    sections: definition.sections.map((item) => section(item)),
    help: { title: '', body: '' },
    ...config,
  };
}

// ---------------------------------------------------------------------------
// Defaults per screen
// ---------------------------------------------------------------------------

export const DEFAULT_LECTURES_SCREEN: LecturesScreenConfig = {
  ...baseScreen('lectures', {
    pageTitle: 'Lectures & batches',
    pageSubtitle:
      'Curated for your exam and class. Access is verified on every lesson.',
    eyebrow: 'Learning library',
    searchPlaceholder: 'Search the library…',
    emptyTitle: 'Nothing published here yet',
    emptyBody: 'New batches, series and lectures appear here as soon as your mentor publishes them.',
  }),
  tabLabels: { batches: 'Batches', series: 'Series', lectures: 'Lectures', resources: 'Resources' },
  mineFilterLabel: 'My courses only',
  sortNewestLabel: 'Newest first',
  sortTitleLabel: 'A–Z',
  enrolledCtaLabel: 'Open course',
  watchCtaLabel: 'Watch',
  accessNoteTitle: 'How access works',
  accessNoteBody:
    'Free courses can be joined directly. Paid courses and restricted batches need a mentor grant or a valid access code. Lessons belonging to a batch or series stay locked until the server confirms an active enrollment, even if you open a direct URL.',
};

export const DEFAULT_LECTURE_PLAYER_SCREEN: LecturePlayerScreenConfig = {
  ...baseScreen('lecturePlayer', {
    pageTitle: 'Lecture',
    pageSubtitle: '',
    eyebrow: 'Lesson',
    showSearch: false,
    showFilters: false,
    showSort: false,
    itemLimit: 24,
  }),
  backLabel: 'Back to lectures',
  relatedTitle: 'Up next',
  showRelated: true,
  showNotes: true,
  notesTitle: 'Lesson notes',
  markCompleteLabel: 'Mark completed',
  markIncompleteLabel: 'Mark incomplete',
  saveProgressLabel: 'Save progress',
  previousLabel: 'Previous',
  nextLabel: 'Next',
  relatedEmptyTitle: 'No other lessons yet',
  relatedEmptyBody: 'Lessons in this course appear here once they are published.',
  progressNote:
    'Autoplay may be blocked by your browser — press play to start. Watch time is saved to your account, never faked locally.',
};

export const DEFAULT_TESTS_SCREEN: TestsScreenConfig = {
  ...baseScreen('tests', {
    pageTitle: 'Tests & mock exams',
    pageSubtitle: 'Official scores are calculated on the server.',
    eyebrow: 'Test centre',
    searchPlaceholder: 'Search tests…',
    emptyTitle: 'No tests right now',
    emptyBody: 'New tests appear here as soon as your mentor publishes and schedules them.',
    noResultsTitle: 'No tests match this search',
    noResultsBody: 'Try a shorter search or switch the filter.',
  }),
  filterLabels: { all: 'All', live: 'Live', upcoming: 'Upcoming', completed: 'Completed' },
  sortSoonestLabel: 'Soonest first',
  sortTitleLabel: 'A–Z',
  openCtaLabel: 'Open test',
  attemptCtaLabel: 'Attempt now',
  endedCtaLabel: 'View paper',
  infoTitle: 'Fair, server-scored attempts',
  infoBody:
    'Answer keys are never sent to the browser before submission. Your timer and draft are saved on this device, while final scoring, duplicate-attempt rules and the leaderboard are calculated by the server.',
};

export const DEFAULT_TEST_PLAYER_SCREEN: TestPlayerScreenConfig = {
  ...baseScreen('testPlayer', {
    pageTitle: 'Test',
    pageSubtitle: '',
    eyebrow: 'Attempt',
    showSearch: false,
    showFilters: false,
    showSort: false,
    itemLimit: 0,
  }),
  instructionsTitle: 'Instructions',
  instructions: [
    'The timer follows the test schedule and is enforced by the server on submit.',
    'Answer keys and explanations stay hidden until you submit.',
    'Your in-progress answers are restored if you reload on this device.',
  ],
  showInstructions: true,
  submitLabel: 'Submit test',
  submitConfirm: 'Submit your answers? You cannot change them after submission.',
  exitLabel: 'Exit',
  clearAnswerLabel: 'Clear answer',
  paletteTitle: 'Question palette',
  resultTitle: 'Result',
  reviewTitle: 'Review & explanations',
  reviewEmpty: 'No review items were returned by the server.',
  leaderboardCtaLabel: 'View leaderboard',
  timerWarningMinutes: 5,
};

export const DEFAULT_LEADERBOARD_SCREEN: LeaderboardScreenConfig = {
  ...baseScreen('leaderboard', {
    pageTitle: 'Leaderboard',
    pageSubtitle:
      'Per-test ranking only — never a mixed global score. Select a test to see rank, name and score.',
    eyebrow: 'Rankings',
    showSearch: false,
    showSort: false,
    emptyTitle: 'No attempts yet',
    emptyBody: 'No one has submitted this test yet. Be the first to attempt it.',
  }),
  selectorLabel: 'Select a test',
  refreshLabel: 'Refresh',
  browseCtaLabel: 'Browse tests',
  showTestSelector: true,
  showAvatars: true,
  showSubmittedTime: true,
  noTestTitle: 'Select a test',
  noTestBody: 'Each leaderboard belongs to a single test. Choose one above to see its ranking.',
  noAttemptsTitle: 'No attempts yet',
  noAttemptsBody: 'No one has submitted this test yet. Be the first to attempt it.',
  rankLabel: 'Rank · Name · Score',
  infoTitle: 'Private by design',
  infoBody:
    'Only a student’s display name, score and submission time are shown. Email addresses and other private fields are never exposed.',
};

export const DEFAULT_PROFILE_SCREEN: ProfileScreenConfig = {
  ...baseScreen('profile', {
    pageTitle: 'My profile',
    pageSubtitle: 'Your real progress from submitted tests and watched lessons.',
    eyebrow: 'Student profile',
    showSearch: false,
    showFilters: false,
    showSort: false,
  }),
  heroEyebrow: 'Student profile',
  askDoubtLabel: 'Send feedback',
  signOutLabel: 'Sign out',
  editLabel: 'Edit profile',
  allowProfileEdit: true,
  showQuickStats: true,
  showLevel: true,
  showRecentAttempts: true,
  showLessonProgress: true,
  showScoreSummary: true,
  showQuickLinks: true,
  recentAttemptsTitle: 'Recent attempts',
  lessonProgressTitle: 'Lesson progress',
  scoreSummaryTitle: 'Score summary',
  quickLinksTitle: 'Quick links',
  emptyAttempts: 'No attempts yet. Take a test to build your analysis.',
  emptyProgress: 'No lesson progress yet. Start a lecture to track it.',
  levelNote:
    'An educational progress indicator based on your real test attempts and watch activity. It is not an official JEE/NEET rank.',
};

export const DEFAULT_EVENTS_SCREEN: EventsScreenConfig = {
  ...baseScreen('eventsScreen', {
    pageTitle: 'Events & calendar',
    pageSubtitle: 'Mock tests, marathons and doubt sessions. All times are IST.',
    eyebrow: 'Calendar',
    showSearch: false,
    showSort: false,
    emptyTitle: 'No events match this view',
    emptyBody: 'New events appear here as soon as an admin publishes them.',
  }),
  showCalendar: true,
  calendarNote: 'Days with events are highlighted. Select a day to filter.',
  filterLabels: {
    all: 'All',
    live: 'Live',
    upcoming: 'Upcoming',
    completed: 'Completed',
    unscheduled: 'Unscheduled',
  },
  addToCalendarLabel: 'Add to calendar',
  detailsCtaLabel: 'Register / details',
  infoTitle: 'How reminders work',
  infoBody:
    '“Add to calendar” downloads a standard ICS file you can open in Google Calendar, Apple Calendar or Outlook. Browser push reminders are not configured, so no in-app reminder is promised.',
};

export const DEFAULT_CHALLENGES_SCREEN: ChallengesScreenConfig = {
  ...baseScreen('challengesScreen', {
    pageTitle: 'Study challenges',
    pageSubtitle:
      'Short, focused sprints published by your admin. Join one, tick items and keep your streak moving.',
    eyebrow: 'Challenges',
    showSearch: false,
    showFilters: false,
    showSort: false,
    emptyTitle: 'No challenges are live right now',
    emptyBody: 'Your admin can publish a study sprint from the admin console.',
  }),
  joinLabel: 'Join challenge',
  leaveLabel: 'Leave',
  joinedLabel: 'Joined',
  endedLabel: 'Ended',
  showSchedule: true,
  showReward: true,
  showChecklist: true,
  checklistTitle: 'Checklist progress',
  joinHint: 'Join the challenge to tick items.',
};

export const DEFAULT_CHAT_SCREEN: ChatScreenConfig = {
  ...baseScreen('chat', {
    pageTitle: 'Feedback & help',
    pageSubtitle: 'Ask your mentor directly. Only your own thread is visible to you.',
    eyebrow: 'Mentor support',
    showSearch: false,
    showFilters: false,
    showSort: false,
    emptyTitle: 'No messages yet',
    emptyBody: 'Say hello to your mentor and ask your first doubt.',
  }),
  composerPlaceholder: 'Add details to your feedback…',
  sendLabel: 'Send',
  emptyTitle: 'No messages yet',
  emptyBody: 'Say hello to your mentor and ask your first doubt.',
  showTimestamp: true,
  helpTitle: 'Private by default',
  helpBody:
    'Your feedback is stored in Cloudflare D1 and is visible only to you and your mentor. Every read and write is checked against your Firebase identity.',
};

export const DEFAULT_NOTIFICATIONS_SCREEN: NotificationsScreenConfig = {
  ...baseScreen('notifications', {
    pageTitle: 'Notifications',
    pageSubtitle: 'Updates about tests, lectures and announcements from your mentor.',
    eyebrow: 'Inbox',
    showSearch: false,
    showFilters: false,
    showSort: false,
    emptyTitle: 'No notifications',
    emptyBody: 'Notifications from your admin appear here as tests, lectures, feedback responses or announcements are published.',
  }),
  unreadLabel: 'Unread',
  readLabel: 'Read',
  markReadLabel: 'Mark read',
  openLabel: 'Open',
  showUnreadOnlyToggle: true,
  unreadOnlyLabel: 'Unread only',
  showUnreadOnlyEmptyTitle: 'You are all caught up',
  showUnreadOnlyEmptyBody: 'You have read every notification. Switch the filter to see older messages.',
};

export const DEFAULT_SEARCH_SCREEN: SearchScreenConfig = {
  ...baseScreen('search', {
    pageTitle: 'Search everything',
    pageSubtitle: 'Lectures, tests, batches, series, events and notices across Exam Cracker.',
    eyebrow: 'Search',
    searchPlaceholder: 'Search lectures, subjects, tests, batches…',
    emptyTitle: 'Nothing found',
    emptyBody: 'Try a shorter query, a subject name, or clear the filters.',
    noResultsTitle: 'No matches',
    noResultsBody: 'Try a shorter query, a subject name, or clear the filters.',
    itemLimit: 48,
  }),
  searchCtaLabel: 'Search',
  suggestionsTitle: 'Try',
  suggestions: ['Mechanics', 'Organic chemistry', 'Calculus', 'Mock test', 'Batch', 'Revision'],
  showSuggestions: true,
  showKindFilters: true,
  infoNote: 'Results are limited to the content published for your exam and class.',
};

export const DEFAULT_ONBOARDING_SCREEN: OnboardingScreenConfig = {
  ...baseScreen('onboarding', {
    pageTitle: 'Complete your profile',
    pageSubtitle: 'This required setup keeps every student’s feed focused.',
    eyebrow: 'Required setup',
    showHeader: true,
    showSearch: false,
    showFilters: false,
    showSort: false,
  }),
  brandPanelEyebrow: 'Your learning path starts here',
  brandPanelTitle: 'One setup. Content that actually fits your exam.',
  brandPanelBody:
    'We personalise your dashboard, batches, lectures, tests and leaderboards using your exam and class. This required setup keeps every student’s feed focused.',
  showBrandPanel: true,
  features: [
    { id: 'goal', title: 'Today’s goal', text: 'A daily target matched to your preparation track.' },
    { id: 'batch', title: 'Your batch & lectures', text: 'Only the material you are eligible for appears.' },
    { id: 'level', title: 'Levels & leaderboards', text: 'Progress from your real test attempts and lesson activity.' },
  ],
  formEyebrow: 'Required setup',
  formTitle: 'Complete your profile',
  nameQuestion: 'What should we call you?',
  nameHelp: 'This appears on your profile, leaderboard and feedback requests.',
  namePlaceholder: 'Your full name',
  examQuestion: 'Which exam are you preparing for?',
  examHelp: 'This controls your lectures, batches, tests and leaderboard.',
  classQuestion: 'Which class are you in?',
  classHelp: 'Choose your current academic year.',
  continueLabel: 'Continue',
  backLabel: 'Back',
  finishLabel: 'Enter my dashboard',
  finishingLabel: 'Building your dashboard…',
  restoreNote: 'We restored your previous setup draft. You can change anything before finishing.',
  footerNote: 'Your exam and class choices are required to unlock personalised student content.',
  confirmNote:
    'By continuing you confirm this setup is yours. Access is verified against your signed Firebase session and enforced by the server.',
  requiredNotice: 'Required — no skip',
};

export const DEFAULT_SCREEN_CONFIGS: { [K in ScreenKey]: SiteConfig[K] } = {
  lectures: DEFAULT_LECTURES_SCREEN,
  lecturePlayer: DEFAULT_LECTURE_PLAYER_SCREEN,
  tests: DEFAULT_TESTS_SCREEN,
  testPlayer: DEFAULT_TEST_PLAYER_SCREEN,
  leaderboard: DEFAULT_LEADERBOARD_SCREEN,
  profile: DEFAULT_PROFILE_SCREEN,
  eventsScreen: DEFAULT_EVENTS_SCREEN,
  challengesScreen: DEFAULT_CHALLENGES_SCREEN,
  chat: DEFAULT_CHAT_SCREEN,
  notifications: DEFAULT_NOTIFICATIONS_SCREEN,
  search: DEFAULT_SEARCH_SCREEN,
  onboarding: DEFAULT_ONBOARDING_SCREEN,
};

// ---------------------------------------------------------------------------
// Sanitisation primitives
// ---------------------------------------------------------------------------

const TONES: ScreenAnnouncementTone[] = ['brand', 'info', 'success', 'warning'];

export function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function text(value: unknown, fallback: string, max = 400): string {
  return typeof value === 'string' ? value.slice(0, max) : fallback;
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function num(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
}

function pick<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

function stringList(value: unknown, fallback: string[], max = 8, maxLength = 120): string[] {
  if (!Array.isArray(value)) return [...fallback];
  return value
    .map((item) => (typeof item === 'string' ? item.trim().slice(0, maxLength) : ''))
    .filter(Boolean)
    .slice(0, max);
}

export function sanitizeAnnouncement(value: unknown): ScreenAnnouncement {
  const raw = isPlainRecord(value) ? value : {};
  const base = defaultAnnouncement();
  return {
    enabled: bool(raw.enabled, base.enabled),
    title: text(raw.title, '', 140),
    body: text(raw.body, '', 600),
    ctaLabel: text(raw.ctaLabel, '', 60),
    ctaHref: text(raw.ctaHref, '', 500),
    tone: pick(raw.tone, TONES, base.tone),
  };
}

/**
 * Normalises a stored section list against the screen's allowlist:
 * unknown ids are dropped, duplicates removed, required blocks forced visible,
 * and any missing block is appended in its canonical position.
 */
export function sanitizeScreenSections(
  key: ScreenKey,
  value: unknown
): ScreenSectionConfig[] {
  const definition = screenDefinition(key);
  const incoming = Array.isArray(value) ? value : [];
  const byId = new Map<string, ScreenSectionConfig>();

  for (const item of incoming) {
    if (!isPlainRecord(item)) continue;
    const id = typeof item.id === 'string' ? item.id : '';
    const sectionDef = definition.sections.find((entry) => entry.id === id);
    if (!sectionDef || byId.has(id)) continue;
    byId.set(id, {
      id,
      title: text(item.title, sectionDef.label, 120) || sectionDef.label,
      subtitle: text(item.subtitle, '', 240),
      visible: sectionDef.required ? true : bool(item.visible, true),
    });
  }

  const ordered = Array.from(byId.values());
  for (const sectionDef of definition.sections) {
    if (ordered.some((item) => item.id === sectionDef.id)) continue;
    ordered.push(section(sectionDef));
  }
  return ordered;
}

export function sanitizeScreenBase(
  key: ScreenKey,
  value: unknown
): ScreenBaseConfig {
  const definition = screenDefinition(key);
  // Fall back to the shipped default for this screen (not just the generic
  // placeholder) so a partial document never loses its helpful default copy.
  const base = DEFAULT_SCREEN_CONFIGS[key] as ScreenBaseConfig;
  const raw = isPlainRecord(value) ? value : {};
  const helpRaw = isPlainRecord(raw.help) ? raw.help : {};
  return {
    pageTitle: text(raw.pageTitle, base.pageTitle, 120) || base.pageTitle,
    pageSubtitle: text(raw.pageSubtitle, base.pageSubtitle, 300),
    eyebrow: text(raw.eyebrow, base.eyebrow, 60),
    showHeader: bool(raw.showHeader, base.showHeader),
    showSearch: bool(raw.showSearch, base.showSearch),
    searchPlaceholder: text(raw.searchPlaceholder, base.searchPlaceholder, 120),
    showFilters: bool(raw.showFilters, base.showFilters),
    showSort: bool(raw.showSort, base.showSort),
    layout: pick(raw.layout, ['grid', 'list', 'compact'] as const, base.layout),
    itemLimit: num(raw.itemLimit, base.itemLimit, 0, 48),
    emptyTitle: text(raw.emptyTitle, base.emptyTitle, 120),
    emptyBody: text(raw.emptyBody, base.emptyBody, 400),
    noResultsTitle: text(raw.noResultsTitle, base.noResultsTitle, 120),
    noResultsBody: text(raw.noResultsBody, base.noResultsBody, 400),
    announcement: sanitizeAnnouncement(raw.announcement),
    sections: sanitizeScreenSections(key, raw.sections),
    help: {
      title: text(helpRaw.title, base.help.title || definition.label, 120),
      body: text(helpRaw.body, base.help.body, 600),
    },
  };
}

function sanitizeLabels<T extends object>(value: unknown, fallback: T): T {
  const raw = isPlainRecord(value) ? value : {};
  const out: Record<string, string> = {};
  for (const [label, fallbackValue] of Object.entries(fallback)) {
    out[label] = text(raw[label], String(fallbackValue), 40) || String(fallbackValue);
  }
  return out as T;
}

// ---------------------------------------------------------------------------
// Per-screen sanitisers
// ---------------------------------------------------------------------------

export function sanitizeLecturesScreen(value: unknown): LecturesScreenConfig {
  const raw = isPlainRecord(value) ? value : {};
  const base = DEFAULT_LECTURES_SCREEN;
  return {
    ...sanitizeScreenBase('lectures', raw),
    tabLabels: sanitizeLabels(raw.tabLabels, base.tabLabels),
    mineFilterLabel: text(raw.mineFilterLabel, base.mineFilterLabel, 40) || base.mineFilterLabel,
    sortNewestLabel: text(raw.sortNewestLabel, base.sortNewestLabel, 40) || base.sortNewestLabel,
    sortTitleLabel: text(raw.sortTitleLabel, base.sortTitleLabel, 40) || base.sortTitleLabel,
    enrolledCtaLabel: text(raw.enrolledCtaLabel, base.enrolledCtaLabel, 40) || base.enrolledCtaLabel,
    watchCtaLabel: text(raw.watchCtaLabel, base.watchCtaLabel, 40) || base.watchCtaLabel,
    accessNoteTitle: text(raw.accessNoteTitle, base.accessNoteTitle, 120),
    accessNoteBody: text(raw.accessNoteBody, base.accessNoteBody, 800),
  };
}

export function sanitizeLecturePlayerScreen(value: unknown): LecturePlayerScreenConfig {
  const raw = isPlainRecord(value) ? value : {};
  const base = DEFAULT_LECTURE_PLAYER_SCREEN;
  return {
    ...sanitizeScreenBase('lecturePlayer', raw),
    backLabel: text(raw.backLabel, base.backLabel, 40) || base.backLabel,
    relatedTitle: text(raw.relatedTitle, base.relatedTitle, 60) || base.relatedTitle,
    showRelated: bool(raw.showRelated, base.showRelated),
    showNotes: bool(raw.showNotes, base.showNotes),
    notesTitle: text(raw.notesTitle, base.notesTitle, 80) || base.notesTitle,
    markCompleteLabel: text(raw.markCompleteLabel, base.markCompleteLabel, 40) || base.markCompleteLabel,
    markIncompleteLabel: text(raw.markIncompleteLabel, base.markIncompleteLabel, 40) || base.markIncompleteLabel,
    saveProgressLabel: text(raw.saveProgressLabel, base.saveProgressLabel, 40) || base.saveProgressLabel,
    previousLabel: text(raw.previousLabel, base.previousLabel, 40) || base.previousLabel,
    nextLabel: text(raw.nextLabel, base.nextLabel, 40) || base.nextLabel,
    relatedEmptyTitle: text(raw.relatedEmptyTitle, base.relatedEmptyTitle, 120),
    relatedEmptyBody: text(raw.relatedEmptyBody, base.relatedEmptyBody, 400),
    progressNote: text(raw.progressNote, base.progressNote, 600),
  };
}

export function sanitizeTestsScreen(value: unknown): TestsScreenConfig {
  const raw = isPlainRecord(value) ? value : {};
  const base = DEFAULT_TESTS_SCREEN;
  return {
    ...sanitizeScreenBase('tests', raw),
    filterLabels: sanitizeLabels(raw.filterLabels, base.filterLabels),
    sortSoonestLabel: text(raw.sortSoonestLabel, base.sortSoonestLabel, 40) || base.sortSoonestLabel,
    sortTitleLabel: text(raw.sortTitleLabel, base.sortTitleLabel, 40) || base.sortTitleLabel,
    openCtaLabel: text(raw.openCtaLabel, base.openCtaLabel, 40) || base.openCtaLabel,
    attemptCtaLabel: text(raw.attemptCtaLabel, base.attemptCtaLabel, 40) || base.attemptCtaLabel,
    endedCtaLabel: text(raw.endedCtaLabel, base.endedCtaLabel, 40) || base.endedCtaLabel,
    infoTitle: text(raw.infoTitle, base.infoTitle, 120),
    infoBody: text(raw.infoBody, base.infoBody, 800),
  };
}

export function sanitizeTestPlayerScreen(value: unknown): TestPlayerScreenConfig {
  const raw = isPlainRecord(value) ? value : {};
  const base = DEFAULT_TEST_PLAYER_SCREEN;
  return {
    ...sanitizeScreenBase('testPlayer', raw),
    instructionsTitle: text(raw.instructionsTitle, base.instructionsTitle, 80) || base.instructionsTitle,
    instructions: stringList(raw.instructions, base.instructions, 8, 240),
    showInstructions: bool(raw.showInstructions, base.showInstructions),
    submitLabel: text(raw.submitLabel, base.submitLabel, 40) || base.submitLabel,
    submitConfirm: text(raw.submitConfirm, base.submitConfirm, 240) || base.submitConfirm,
    exitLabel: text(raw.exitLabel, base.exitLabel, 40) || base.exitLabel,
    clearAnswerLabel: text(raw.clearAnswerLabel, base.clearAnswerLabel, 40) || base.clearAnswerLabel,
    paletteTitle: text(raw.paletteTitle, base.paletteTitle, 60) || base.paletteTitle,
    resultTitle: text(raw.resultTitle, base.resultTitle, 60) || base.resultTitle,
    reviewTitle: text(raw.reviewTitle, base.reviewTitle, 80) || base.reviewTitle,
    reviewEmpty: text(raw.reviewEmpty, base.reviewEmpty, 300),
    leaderboardCtaLabel: text(raw.leaderboardCtaLabel, base.leaderboardCtaLabel, 40) || base.leaderboardCtaLabel,
    timerWarningMinutes: num(raw.timerWarningMinutes, base.timerWarningMinutes, 1, 30),
  };
}

export function sanitizeLeaderboardScreen(value: unknown): LeaderboardScreenConfig {
  const raw = isPlainRecord(value) ? value : {};
  const base = DEFAULT_LEADERBOARD_SCREEN;
  return {
    ...sanitizeScreenBase('leaderboard', raw),
    selectorLabel: text(raw.selectorLabel, base.selectorLabel, 60) || base.selectorLabel,
    refreshLabel: text(raw.refreshLabel, base.refreshLabel, 40) || base.refreshLabel,
    browseCtaLabel: text(raw.browseCtaLabel, base.browseCtaLabel, 40) || base.browseCtaLabel,
    showTestSelector: bool(raw.showTestSelector, base.showTestSelector),
    showAvatars: bool(raw.showAvatars, base.showAvatars),
    showSubmittedTime: bool(raw.showSubmittedTime, base.showSubmittedTime),
    noTestTitle: text(raw.noTestTitle, base.noTestTitle, 120),
    noTestBody: text(raw.noTestBody, base.noTestBody, 400),
    noAttemptsTitle: text(raw.noAttemptsTitle, base.noAttemptsTitle, 120),
    noAttemptsBody: text(raw.noAttemptsBody, base.noAttemptsBody, 400),
    rankLabel: text(raw.rankLabel, base.rankLabel, 80) || base.rankLabel,
    infoTitle: text(raw.infoTitle, base.infoTitle, 120),
    infoBody: text(raw.infoBody, base.infoBody, 800),
  };
}

export function sanitizeProfileScreen(value: unknown): ProfileScreenConfig {
  const raw = isPlainRecord(value) ? value : {};
  const base = DEFAULT_PROFILE_SCREEN;
  return {
    ...sanitizeScreenBase('profile', raw),
    heroEyebrow: text(raw.heroEyebrow, base.heroEyebrow, 60),
    askDoubtLabel: text(raw.askDoubtLabel, base.askDoubtLabel, 40) || base.askDoubtLabel,
    signOutLabel: text(raw.signOutLabel, base.signOutLabel, 40) || base.signOutLabel,
    editLabel: text(raw.editLabel, base.editLabel, 40) || base.editLabel,
    allowProfileEdit: bool(raw.allowProfileEdit, base.allowProfileEdit),
    showQuickStats: bool(raw.showQuickStats, base.showQuickStats),
    showLevel: bool(raw.showLevel, base.showLevel),
    showRecentAttempts: bool(raw.showRecentAttempts, base.showRecentAttempts),
    showLessonProgress: bool(raw.showLessonProgress, base.showLessonProgress),
    showScoreSummary: bool(raw.showScoreSummary, base.showScoreSummary),
    showQuickLinks: bool(raw.showQuickLinks, base.showQuickLinks),
    recentAttemptsTitle: text(raw.recentAttemptsTitle, base.recentAttemptsTitle, 80) || base.recentAttemptsTitle,
    lessonProgressTitle: text(raw.lessonProgressTitle, base.lessonProgressTitle, 80) || base.lessonProgressTitle,
    scoreSummaryTitle: text(raw.scoreSummaryTitle, base.scoreSummaryTitle, 80) || base.scoreSummaryTitle,
    quickLinksTitle: text(raw.quickLinksTitle, base.quickLinksTitle, 80) || base.quickLinksTitle,
    emptyAttempts: text(raw.emptyAttempts, base.emptyAttempts, 300),
    emptyProgress: text(raw.emptyProgress, base.emptyProgress, 300),
    levelNote: text(raw.levelNote, base.levelNote, 400),
  };
}

export function sanitizeEventsScreen(value: unknown): EventsScreenConfig {
  const raw = isPlainRecord(value) ? value : {};
  const base = DEFAULT_EVENTS_SCREEN;
  return {
    ...sanitizeScreenBase('eventsScreen', raw),
    showCalendar: bool(raw.showCalendar, base.showCalendar),
    calendarNote: text(raw.calendarNote, base.calendarNote, 300),
    filterLabels: sanitizeLabels(raw.filterLabels, base.filterLabels),
    addToCalendarLabel: text(raw.addToCalendarLabel, base.addToCalendarLabel, 40) || base.addToCalendarLabel,
    detailsCtaLabel: text(raw.detailsCtaLabel, base.detailsCtaLabel, 40) || base.detailsCtaLabel,
    infoTitle: text(raw.infoTitle, base.infoTitle, 120),
    infoBody: text(raw.infoBody, base.infoBody, 800),
  };
}

export function sanitizeChallengesScreen(value: unknown): ChallengesScreenConfig {
  const raw = isPlainRecord(value) ? value : {};
  const base = DEFAULT_CHALLENGES_SCREEN;
  return {
    ...sanitizeScreenBase('challengesScreen', raw),
    joinLabel: text(raw.joinLabel, base.joinLabel, 40) || base.joinLabel,
    leaveLabel: text(raw.leaveLabel, base.leaveLabel, 40) || base.leaveLabel,
    joinedLabel: text(raw.joinedLabel, base.joinedLabel, 40) || base.joinedLabel,
    endedLabel: text(raw.endedLabel, base.endedLabel, 40) || base.endedLabel,
    showSchedule: bool(raw.showSchedule, base.showSchedule),
    showReward: bool(raw.showReward, base.showReward),
    showChecklist: bool(raw.showChecklist, base.showChecklist),
    checklistTitle: text(raw.checklistTitle, base.checklistTitle, 80) || base.checklistTitle,
    joinHint: text(raw.joinHint, base.joinHint, 200),
  };
}

export function sanitizeChatScreen(value: unknown): ChatScreenConfig {
  const raw = isPlainRecord(value) ? value : {};
  const base = DEFAULT_CHAT_SCREEN;
  return {
    ...sanitizeScreenBase('chat', raw),
    composerPlaceholder: text(raw.composerPlaceholder, base.composerPlaceholder, 120) || base.composerPlaceholder,
    sendLabel: text(raw.sendLabel, base.sendLabel, 40) || base.sendLabel,
    emptyTitle: text(raw.emptyTitle, base.emptyTitle, 120) || base.emptyTitle,
    emptyBody: text(raw.emptyBody, base.emptyBody, 400),
    showTimestamp: bool(raw.showTimestamp, base.showTimestamp),
    helpTitle: text(raw.helpTitle, base.helpTitle, 120),
    helpBody: text(raw.helpBody, base.helpBody, 600),
  };
}

export function sanitizeNotificationsScreen(value: unknown): NotificationsScreenConfig {
  const raw = isPlainRecord(value) ? value : {};
  const base = DEFAULT_NOTIFICATIONS_SCREEN;
  return {
    ...sanitizeScreenBase('notifications', raw),
    unreadLabel: text(raw.unreadLabel, base.unreadLabel, 40) || base.unreadLabel,
    readLabel: text(raw.readLabel, base.readLabel, 40) || base.readLabel,
    markReadLabel: text(raw.markReadLabel, base.markReadLabel, 40) || base.markReadLabel,
    openLabel: text(raw.openLabel, base.openLabel, 40) || base.openLabel,
    showUnreadOnlyToggle: bool(raw.showUnreadOnlyToggle, base.showUnreadOnlyToggle),
    unreadOnlyLabel: text(raw.unreadOnlyLabel, base.unreadOnlyLabel, 40) || base.unreadOnlyLabel,
    showUnreadOnlyEmptyTitle: text(raw.showUnreadOnlyEmptyTitle, base.showUnreadOnlyEmptyTitle, 120),
    showUnreadOnlyEmptyBody: text(raw.showUnreadOnlyEmptyBody, base.showUnreadOnlyEmptyBody, 300),
  };
}

export function sanitizeSearchScreen(value: unknown): SearchScreenConfig {
  const raw = isPlainRecord(value) ? value : {};
  const base = DEFAULT_SEARCH_SCREEN;
  return {
    ...sanitizeScreenBase('search', raw),
    searchCtaLabel: text(raw.searchCtaLabel, base.searchCtaLabel, 40) || base.searchCtaLabel,
    suggestionsTitle: text(raw.suggestionsTitle, base.suggestionsTitle, 40) || base.suggestionsTitle,
    suggestions: stringList(raw.suggestions, base.suggestions, 10, 60),
    showSuggestions: bool(raw.showSuggestions, base.showSuggestions),
    showKindFilters: bool(raw.showKindFilters, base.showKindFilters),
    infoNote: text(raw.infoNote, base.infoNote, 400),
  };
}

export function sanitizeOnboardingScreen(value: unknown): OnboardingScreenConfig {
  const raw = isPlainRecord(value) ? value : {};
  const base = DEFAULT_ONBOARDING_SCREEN;
  const features: OnboardingFeature[] = Array.isArray(raw.features)
    ? raw.features
        .map((item, index): OnboardingFeature | null => {
          if (!isPlainRecord(item)) return null;
          const title = text(item.title, '', 80).trim();
          const body = text(item.text, '', 240).trim();
          if (!title && !body) return null;
          return {
            id: text(item.id, `feature-${index}`, 40) || `feature-${index}`,
            title,
            text: body,
          };
        })
        .filter((item): item is OnboardingFeature => Boolean(item))
        .slice(0, 5)
    : base.features.map((item) => ({ ...item }));
  return {
    ...sanitizeScreenBase('onboarding', raw),
    brandPanelEyebrow: text(raw.brandPanelEyebrow, base.brandPanelEyebrow, 80),
    brandPanelTitle: text(raw.brandPanelTitle, base.brandPanelTitle, 180),
    brandPanelBody: text(raw.brandPanelBody, base.brandPanelBody, 600),
    showBrandPanel: bool(raw.showBrandPanel, base.showBrandPanel),
    features,
    formEyebrow: text(raw.formEyebrow, base.formEyebrow, 60),
    formTitle: text(raw.formTitle, base.formTitle, 120) || base.formTitle,
    nameQuestion: text(raw.nameQuestion, base.nameQuestion, 120) || base.nameQuestion,
    nameHelp: text(raw.nameHelp, base.nameHelp, 240),
    namePlaceholder: text(raw.namePlaceholder, base.namePlaceholder, 80),
    examQuestion: text(raw.examQuestion, base.examQuestion, 120) || base.examQuestion,
    examHelp: text(raw.examHelp, base.examHelp, 240),
    classQuestion: text(raw.classQuestion, base.classQuestion, 120) || base.classQuestion,
    classHelp: text(raw.classHelp, base.classHelp, 240),
    continueLabel: text(raw.continueLabel, base.continueLabel, 40) || base.continueLabel,
    backLabel: text(raw.backLabel, base.backLabel, 40) || base.backLabel,
    finishLabel: text(raw.finishLabel, base.finishLabel, 60) || base.finishLabel,
    finishingLabel: text(raw.finishingLabel, base.finishingLabel, 60) || base.finishingLabel,
    restoreNote: text(raw.restoreNote, base.restoreNote, 300),
    footerNote: text(raw.footerNote, base.footerNote, 300),
    confirmNote: text(raw.confirmNote, base.confirmNote, 400),
    requiredNotice: text(raw.requiredNotice, base.requiredNotice, 80),
  };
}

export const SCREEN_SANITIZERS: {
  [K in ScreenKey]: (value: unknown) => SiteConfig[K];
} = {
  lectures: sanitizeLecturesScreen,
  lecturePlayer: sanitizeLecturePlayerScreen,
  tests: sanitizeTestsScreen,
  testPlayer: sanitizeTestPlayerScreen,
  leaderboard: sanitizeLeaderboardScreen,
  profile: sanitizeProfileScreen,
  eventsScreen: sanitizeEventsScreen,
  challengesScreen: sanitizeChallengesScreen,
  chat: sanitizeChatScreen,
  notifications: sanitizeNotificationsScreen,
  search: sanitizeSearchScreen,
  onboarding: sanitizeOnboardingScreen,
};

// ---------------------------------------------------------------------------
// Runtime helpers used by student screens
// ---------------------------------------------------------------------------

/**
 * Ordered, visible section ids for a screen. Pages read this instead of
 * hard-coding their block order, so hiding/reordering in the admin panel takes
 * effect immediately.
 */
export function visibleSectionIds(key: ScreenKey, config: ScreenBaseConfig): string[] {
  const sections =
    Array.isArray(config?.sections) && config.sections.length
      ? config.sections
      : screenDefinition(key).sections.map((item) => section(item));
  return sections.filter((item) => item.visible).map((item) => item.id);
}

export function screenSectionById(
  key: ScreenKey,
  config: ScreenBaseConfig,
  id: string
): ScreenSectionConfig | null {
  const sections = Array.isArray(config?.sections) ? config.sections : [];
  const found = sections.find((item) => item.id === id);
  if (found) return found;
  const definition = screenDefinition(key).sections.find((item) => item.id === id);
  return definition ? section(definition) : null;
}

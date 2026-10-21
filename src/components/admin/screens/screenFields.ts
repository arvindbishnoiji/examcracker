'use client';

/**
 * Field descriptors for the Screen Studio editor.
 *
 * A declarative schema keeps every screen on the same, predictable editor
 * pattern (labels, help text, validation) instead of twelve bespoke forms.
 */

import type { ScreenKey } from '@/lib/screen-config';

export type ScreenFieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'select'
  | 'toggle'
  | 'stringList';

export interface ScreenField {
  /** Dotted path inside the screen document, e.g. `tabLabels.batches`. */
  path: string;
  label: string;
  help?: string;
  type?: ScreenFieldType;
  options?: Array<{ value: string; label: string }>;
  min?: number;
  max?: number;
  maxLength?: number;
  placeholder?: string;
  rows?: number;
}

export interface ScreenFieldGroup {
  id: string;
  title: string;
  description?: string;
  fields: ScreenField[];
}

const LAYOUT_OPTIONS = [
  { value: 'grid', label: 'Cards in a grid' },
  { value: 'list', label: 'Stacked list' },
  { value: 'compact', label: 'Compact grid (4 across)' },
];

const SCREEN_LABEL_GROUPS: Record<ScreenKey, ScreenFieldGroup> = {
  lectures: {
    id: 'labels',
    title: 'Labels, tabs and buttons',
    description: 'Names shown to students. Keep them short so they fit on a phone.',
    fields: [
      { path: 'tabLabels.batches', label: 'Batches tab', maxLength: 40 },
      { path: 'tabLabels.series', label: 'Series tab', maxLength: 40 },
      { path: 'tabLabels.lectures', label: 'Lectures tab', maxLength: 40 },
      { path: 'tabLabels.resources', label: 'Resources tab', maxLength: 40 },
      { path: 'mineFilterLabel', label: '“My courses only” label', maxLength: 40 },
      { path: 'sortNewestLabel', label: 'Sort: newest option', maxLength: 40 },
      { path: 'sortTitleLabel', label: 'Sort: A–Z option', maxLength: 40 },
      { path: 'enrolledCtaLabel', label: 'Button for enrolled courses', maxLength: 40 },
      { path: 'watchCtaLabel', label: 'Watch button on lecture cards', maxLength: 40 },
      { path: 'accessNoteTitle', label: 'Access note heading', maxLength: 120 },
      { path: 'accessNoteBody', label: 'Access note text', type: 'textarea', rows: 4, maxLength: 800 },
    ],
  },
  lecturePlayer: {
    id: 'labels',
    title: 'Player labels and related content',
    fields: [
      { path: 'backLabel', label: 'Back link', maxLength: 40 },
      { path: 'relatedTitle', label: '“Up next” heading', maxLength: 60 },
      { path: 'showRelated', label: 'Show the “up next” list', type: 'toggle', help: 'The lesson list beside the video.' },
      { path: 'showNotes', label: 'Show the notes panel', type: 'toggle', help: 'Only appears when a lecture has a notes PDF.' },
      { path: 'notesTitle', label: 'Notes panel heading', maxLength: 80 },
      { path: 'markCompleteLabel', label: 'Mark-complete button', maxLength: 40 },
      { path: 'markIncompleteLabel', label: 'Mark-incomplete button', maxLength: 40 },
      { path: 'saveProgressLabel', label: 'Save-progress button', maxLength: 40 },
      { path: 'previousLabel', label: 'Previous lesson button', maxLength: 40 },
      { path: 'nextLabel', label: 'Next lesson button', maxLength: 40 },
      { path: 'relatedEmptyTitle', label: 'Empty related heading', maxLength: 120 },
      { path: 'relatedEmptyBody', label: 'Empty related text', type: 'textarea', rows: 3, maxLength: 400 },
      { path: 'progressNote', label: 'Player tip', type: 'textarea', rows: 3, maxLength: 600 },
    ],
  },
  tests: {
    id: 'labels',
    title: 'Filter labels and buttons',
    fields: [
      { path: 'filterLabels.all', label: '“All” filter', maxLength: 40 },
      { path: 'filterLabels.live', label: '“Live” filter', maxLength: 40 },
      { path: 'filterLabels.upcoming', label: '“Upcoming” filter', maxLength: 40 },
      { path: 'filterLabels.completed', label: '“Completed” filter', maxLength: 40 },
      { path: 'sortSoonestLabel', label: 'Sort: soonest option', maxLength: 40 },
      { path: 'sortTitleLabel', label: 'Sort: A–Z option', maxLength: 40 },
      { path: 'openCtaLabel', label: 'Open-test button', maxLength: 40 },
      { path: 'attemptCtaLabel', label: 'Attempt-now button', maxLength: 40 },
      { path: 'endedCtaLabel', label: 'Ended-test button', maxLength: 40 },
      { path: 'infoTitle', label: 'Fairness note heading', maxLength: 120 },
      { path: 'infoBody', label: 'Fairness note text', type: 'textarea', rows: 4, maxLength: 800 },
    ],
  },
  testPlayer: {
    id: 'labels',
    title: 'Attempt labels and instructions',
    description: 'These change wording only. Timing, scoring and answer-key release stay server-controlled.',
    fields: [
      { path: 'instructionsTitle', label: 'Instructions heading', maxLength: 80 },
      { path: 'showInstructions', label: 'Show the instructions panel', type: 'toggle' },
      { path: 'instructions', label: 'Instruction lines', type: 'stringList', max: 8, help: 'Up to 8 short lines.' },
      { path: 'submitLabel', label: 'Submit button', maxLength: 40 },
      { path: 'submitConfirm', label: 'Submit confirmation question', type: 'textarea', rows: 2, maxLength: 240 },
      { path: 'exitLabel', label: 'Exit button', maxLength: 40 },
      { path: 'clearAnswerLabel', label: 'Clear-answer button', maxLength: 40 },
      { path: 'paletteTitle', label: 'Question palette heading', maxLength: 60 },
      { path: 'timerWarningMinutes', label: 'Turn the timer red with… minutes left', type: 'number', min: 1, max: 30 },
      { path: 'resultTitle', label: 'Result heading', maxLength: 60 },
      { path: 'reviewTitle', label: 'Review heading', maxLength: 80 },
      { path: 'reviewEmpty', label: 'Review empty text', type: 'textarea', rows: 2, maxLength: 300 },
      { path: 'leaderboardCtaLabel', label: 'Leaderboard button', maxLength: 40 },
    ],
  },
  leaderboard: {
    id: 'labels',
    title: 'Selector, ranking and notes',
    fields: [
      { path: 'showTestSelector', label: 'Show the test selector', type: 'toggle' },
      { path: 'selectorLabel', label: 'Selector label', maxLength: 60 },
      { path: 'refreshLabel', label: 'Refresh button', maxLength: 40 },
      { path: 'browseCtaLabel', label: 'Browse-tests button', maxLength: 40 },
      { path: 'rankLabel', label: 'Ranking column caption', maxLength: 80 },
      { path: 'showAvatars', label: 'Show student avatars', type: 'toggle' },
      { path: 'showSubmittedTime', label: 'Show submission time', type: 'toggle' },
      { path: 'noTestTitle', label: '“Choose a test” heading', maxLength: 120 },
      { path: 'noTestBody', label: '“Choose a test” text', type: 'textarea', rows: 2, maxLength: 400 },
      { path: 'noAttemptsTitle', label: '“No attempts” heading', maxLength: 120 },
      { path: 'noAttemptsBody', label: '“No attempts” text', type: 'textarea', rows: 2, maxLength: 400 },
      { path: 'infoTitle', label: 'Privacy note heading', maxLength: 120 },
      { path: 'infoBody', label: 'Privacy note text', type: 'textarea', rows: 3, maxLength: 800 },
    ],
  },
  profile: {
    id: 'labels',
    title: 'Profile labels and content blocks',
    fields: [
      { path: 'heroEyebrow', label: 'Label above the student name', maxLength: 60 },
      { path: 'askDoubtLabel', label: '“Ask a doubt” button', maxLength: 40 },
      { path: 'editLabel', label: 'Edit-profile button', maxLength: 40 },
      { path: 'allowProfileEdit', label: 'Allow students to edit their profile', type: 'toggle', help: 'Exam and class changes stay validated by the server.' },
      { path: 'signOutLabel', label: 'Sign-out button', maxLength: 40 },
      { path: 'showQuickStats', label: 'Show statistic tiles', type: 'toggle' },
      { path: 'showLevel', label: 'Show learning level', type: 'toggle' },
      { path: 'showRecentAttempts', label: 'Show recent attempts', type: 'toggle' },
      { path: 'showLessonProgress', label: 'Show lesson progress', type: 'toggle' },
      { path: 'showScoreSummary', label: 'Show score summary', type: 'toggle' },
      { path: 'showQuickLinks', label: 'Show quick links', type: 'toggle' },
      { path: 'recentAttemptsTitle', label: 'Recent attempts heading', maxLength: 80 },
      { path: 'lessonProgressTitle', label: 'Lesson progress heading', maxLength: 80 },
      { path: 'scoreSummaryTitle', label: 'Score summary heading', maxLength: 80 },
      { path: 'quickLinksTitle', label: 'Quick links heading', maxLength: 80 },
      { path: 'emptyAttempts', label: 'Empty attempts text', type: 'textarea', rows: 2, maxLength: 300 },
      { path: 'emptyProgress', label: 'Empty progress text', type: 'textarea', rows: 2, maxLength: 300 },
      { path: 'levelNote', label: 'Learning-level explanation', type: 'textarea', rows: 3, maxLength: 400 },
    ],
  },
  eventsScreen: {
    id: 'labels',
    title: 'Calendar and event labels',
    fields: [
      { path: 'showCalendar', label: 'Show the month calendar', type: 'toggle' },
      { path: 'calendarNote', label: 'Calendar helper text', type: 'textarea', rows: 2, maxLength: 300 },
      { path: 'filterLabels.all', label: '“All” filter', maxLength: 40 },
      { path: 'filterLabels.live', label: '“Live” filter', maxLength: 40 },
      { path: 'filterLabels.upcoming', label: '“Upcoming” filter', maxLength: 40 },
      { path: 'filterLabels.completed', label: '“Completed” filter', maxLength: 40 },
      { path: 'filterLabels.unscheduled', label: '“Unscheduled” filter', maxLength: 40 },
      { path: 'addToCalendarLabel', label: 'Add-to-calendar button', maxLength: 40 },
      { path: 'detailsCtaLabel', label: 'Event details button', maxLength: 40 },
      { path: 'infoTitle', label: 'Reminder note heading', maxLength: 120 },
      { path: 'infoBody', label: 'Reminder note text', type: 'textarea', rows: 3, maxLength: 800 },
    ],
  },
  challengesScreen: {
    id: 'labels',
    title: 'Challenge labels',
    fields: [
      { path: 'joinLabel', label: 'Join button', maxLength: 40 },
      { path: 'leaveLabel', label: 'Leave button', maxLength: 40 },
      { path: 'joinedLabel', label: '“Joined” badge', maxLength: 40 },
      { path: 'endedLabel', label: '“Ended” button', maxLength: 40 },
      { path: 'showSchedule', label: 'Show the challenge window', type: 'toggle' },
      { path: 'showReward', label: 'Show the reward', type: 'toggle' },
      { path: 'showChecklist', label: 'Show checklist progress', type: 'toggle' },
      { path: 'checklistTitle', label: 'Checklist heading', maxLength: 80 },
      { path: 'joinHint', label: 'Hint shown before joining', maxLength: 200 },
    ],
  },
  chat: {
    id: 'labels',
    title: 'Composer and empty state',
    fields: [
      { path: 'composerPlaceholder', label: 'Message box placeholder', maxLength: 120 },
      { path: 'sendLabel', label: 'Send button', maxLength: 40 },
      { path: 'showTimestamp', label: 'Show message timestamps', type: 'toggle' },
      { path: 'emptyTitle', label: 'Empty conversation heading', maxLength: 120 },
      { path: 'emptyBody', label: 'Empty conversation text', type: 'textarea', rows: 2, maxLength: 400 },
      { path: 'helpTitle', label: 'Privacy note heading', maxLength: 120 },
      { path: 'helpBody', label: 'Privacy note text', type: 'textarea', rows: 3, maxLength: 600 },
    ],
  },
  notifications: {
    id: 'labels',
    title: 'Inbox labels',
    fields: [
      { path: 'showUnreadOnlyToggle', label: 'Show the “unread only” filter', type: 'toggle' },
      { path: 'unreadOnlyLabel', label: '“Unread only” label', maxLength: 40 },
      { path: 'unreadLabel', label: 'Unread badge', maxLength: 40 },
      { path: 'readLabel', label: 'Read badge', maxLength: 40 },
      { path: 'markReadLabel', label: 'Mark-read button', maxLength: 40 },
      { path: 'openLabel', label: 'Open-link label', maxLength: 40 },
      { path: 'emptyTitle', label: 'Empty inbox heading', maxLength: 120 },
      { path: 'emptyBody', label: 'Empty inbox text', type: 'textarea', rows: 2, maxLength: 400 },
      { path: 'showUnreadOnlyEmptyTitle', label: 'All-caught-up heading', maxLength: 120 },
      { path: 'showUnreadOnlyEmptyBody', label: 'All-caught-up text', type: 'textarea', rows: 2, maxLength: 300 },
    ],
  },
  search: {
    id: 'labels',
    title: 'Search labels and suggestions',
    fields: [
      { path: 'searchCtaLabel', label: 'Search button', maxLength: 40 },
      { path: 'showSuggestions', label: 'Show suggested searches', type: 'toggle' },
      { path: 'suggestionsTitle', label: 'Suggestion label', maxLength: 40 },
      { path: 'suggestions', label: 'Suggested searches', type: 'stringList', help: 'Up to 10 suggestions shown before the student types.' },
      { path: 'showKindFilters', label: 'Show result-type filters', type: 'toggle' },
      { path: 'infoNote', label: 'Discovery note', type: 'textarea', rows: 2, maxLength: 400 },
    ],
  },
  onboarding: {
    id: 'labels',
    title: 'Welcome panel and questions',
    description: 'Name, exam and class always stay required — you are changing the wording, not the questions.',
    fields: [
      { path: 'brandPanelEyebrow', label: 'Label above the welcome heading', maxLength: 80 },
      { path: 'brandPanelTitle', label: 'Welcome heading', maxLength: 180 },
      { path: 'brandPanelBody', label: 'Welcome text', type: 'textarea', rows: 3, maxLength: 600 },
      { path: 'showBrandPanel', label: 'Show the welcome panel', type: 'toggle', help: 'The form still works if you hide it on smaller screens.' },
      { path: 'formEyebrow', label: 'Form label', maxLength: 60 },
      { path: 'formTitle', label: 'Form heading', maxLength: 120 },
      { path: 'nameQuestion', label: 'Name question', maxLength: 120 },
      { path: 'nameHelp', label: 'Name helper text', maxLength: 240 },
      { path: 'namePlaceholder', label: 'Name placeholder', maxLength: 80 },
      { path: 'examQuestion', label: 'Exam question', maxLength: 120 },
      { path: 'examHelp', label: 'Exam helper text', maxLength: 240 },
      { path: 'classQuestion', label: 'Class question', maxLength: 120 },
      { path: 'classHelp', label: 'Class helper text', maxLength: 240 },
      { path: 'continueLabel', label: 'Continue button', maxLength: 40 },
      { path: 'backLabel', label: 'Back button', maxLength: 40 },
      { path: 'finishLabel', label: 'Finish button', maxLength: 60 },
      { path: 'finishingLabel', label: 'Finish button while saving', maxLength: 60 },
      { path: 'restoreNote', label: 'Restored-draft note', type: 'textarea', rows: 2, maxLength: 300 },
      { path: 'requiredNotice', label: '“No skip” notice', maxLength: 80 },
      { path: 'footerNote', label: 'Footer note', type: 'textarea', rows: 2, maxLength: 300 },
      { path: 'confirmNote', label: 'Confirmation note', type: 'textarea', rows: 3, maxLength: 400 },
    ],
  },
};

interface DisplayFlags {
  search: boolean;
  filters: boolean;
  sort: boolean;
  layout: boolean;
  limit: boolean;
  limitHelp?: string;
}

const DISPLAY_FLAGS: Record<ScreenKey, DisplayFlags> = {
  lectures: { search: true, filters: true, sort: true, layout: true, limit: true },
  lecturePlayer: { search: false, filters: false, sort: false, layout: false, limit: true, limitHelp: 'Maximum lessons in the “up next” list.' },
  tests: { search: true, filters: true, sort: true, layout: true, limit: true },
  testPlayer: { search: false, filters: false, sort: false, layout: false, limit: false },
  leaderboard: { search: false, filters: false, sort: false, layout: false, limit: true, limitHelp: 'Maximum ranked students shown.' },
  profile: { search: false, filters: false, sort: false, layout: false, limit: false },
  eventsScreen: { search: false, filters: true, sort: false, layout: true, limit: true },
  challengesScreen: { search: false, filters: false, sort: false, layout: false, limit: false },
  chat: { search: false, filters: false, sort: false, layout: false, limit: false },
  notifications: { search: false, filters: false, sort: false, layout: false, limit: false },
  search: { search: false, filters: false, sort: false, layout: false, limit: false },
  onboarding: { search: false, filters: false, sort: false, layout: false, limit: false },
};

export function screenFieldGroups(key: ScreenKey): ScreenFieldGroup[] {
  const flags = DISPLAY_FLAGS[key];
  const groups: ScreenFieldGroup[] = [
    {
      id: 'headings',
      title: 'Headings and introduction',
      description: 'The words at the very top of the screen.',
      fields: [
        { path: 'pageTitle', label: 'Page heading', maxLength: 120, placeholder: 'Lectures & batches' },
        { path: 'pageSubtitle', label: 'Introduction', type: 'textarea', rows: 2, maxLength: 300 },
        { path: 'eyebrow', label: 'Small label above the heading', maxLength: 60 },
        { path: 'showHeader', label: 'Show the heading block', type: 'toggle', help: 'Turn off for a bare, content-first screen.' },
      ],
    },
  ];

  const displayFields: ScreenField[] = [];
  if (flags.search) {
    displayFields.push(
      { path: 'showSearch', label: 'Show a search box', type: 'toggle' },
      { path: 'searchPlaceholder', label: 'Search placeholder', maxLength: 120 }
    );
  }
  if (flags.filters) displayFields.push({ path: 'showFilters', label: 'Show filter controls', type: 'toggle' });
  if (flags.sort) displayFields.push({ path: 'showSort', label: 'Show the sort control', type: 'toggle' });
  if (flags.layout) {
    displayFields.push({ path: 'layout', label: 'Layout', type: 'select', options: LAYOUT_OPTIONS });
  }
  if (flags.limit) {
    displayFields.push({
      path: 'itemLimit',
      label: 'Maximum items shown',
      type: 'number',
      min: 0,
      max: 48,
      help: flags.limitHelp || 'Use 0 to show everything the student can access.',
    });
  }
  if (displayFields.length) {
    groups.push({
      id: 'display',
      title: 'Display options',
      description: 'Control density and which controls students see.',
      fields: displayFields,
    });
  }

  groups.push(SCREEN_LABEL_GROUPS[key]);

  groups.push({
    id: 'empty',
    title: 'Empty states',
    description: 'Shown when there is genuinely nothing to list — never fake content.',
    fields: [
      { path: 'emptyTitle', label: 'Empty heading', maxLength: 120 },
      { path: 'emptyBody', label: 'Empty text', type: 'textarea', rows: 2, maxLength: 400 },
      { path: 'noResultsTitle', label: '“No search results” heading', maxLength: 120 },
      { path: 'noResultsBody', label: '“No search results” text', type: 'textarea', rows: 2, maxLength: 400 },
    ],
  });

  groups.push({
    id: 'help',
    title: 'Help note',
    description: 'Optional explanation at the bottom of the screen.',
    fields: [
      { path: 'help.title', label: 'Help heading', maxLength: 120 },
      { path: 'help.body', label: 'Help text', type: 'textarea', rows: 3, maxLength: 600 },
    ],
  });

  return groups;
}

export function announcementGroup(): ScreenFieldGroup {
  return {
    id: 'announcement',
    title: 'Informational banner',
    description: 'A single targeted message at the top of this screen.',
    fields: [
      { path: 'announcement.enabled', label: 'Show the banner', type: 'toggle' },
      { path: 'announcement.title', label: 'Banner heading', maxLength: 140 },
      { path: 'announcement.body', label: 'Banner message', type: 'textarea', rows: 2, maxLength: 600 },
      { path: 'announcement.ctaLabel', label: 'Button label', maxLength: 60, help: 'Leave empty to show no button.' },
      { path: 'announcement.ctaHref', label: 'Button destination', maxLength: 500, placeholder: '/tests', help: 'Internal route such as /tests, or an https:// link.' },
      {
        path: 'announcement.tone',
        label: 'Banner tone',
        type: 'select',
        options: [
          { value: 'brand', label: 'Brand' },
          { value: 'info', label: 'Informational' },
          { value: 'success', label: 'Positive' },
          { value: 'warning', label: 'Attention' },
        ],
      },
    ],
  };
}

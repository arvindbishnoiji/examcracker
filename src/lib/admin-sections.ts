export type AdminSectionGroup =
  | 'Overview'
  | 'Screen Studio'
  | 'Learning Content'
  | 'Tests & Performance'
  | 'Students & Access'
  | 'Communication'
  | 'Website Settings'
  | 'System';

export interface AdminSectionMeta {
  slug: string;
  label: string;
  group: AdminSectionGroup;
  icon: string;
  description: string;
  keywords: string[];
}

export const ADMIN_SECTIONS: AdminSectionMeta[] = [
  {
    slug: 'overview',
    label: 'Overview',
    group: 'Overview',
    icon: '◈',
    description: 'Live counts, content health, recent activity and quick actions.',
    keywords: ['dashboard', 'home', 'stats', 'activity', 'quick actions'],
  },
  {
    slug: 'screens',
    label: 'Student screens',
    group: 'Screen Studio',
    icon: '▭',
    description: 'Edit the headings, labels, sections and messages of every student screen.',
    keywords: ['screen studio', 'page builder', 'screens', 'layout', 'copy', 'headings', 'sections'],
  },
  {
    slug: 'homepage',
    label: 'Home page sections',
    group: 'Screen Studio',
    icon: '▤',
    description: 'Add, hide, reorder and target every student homepage section.',
    keywords: ['home', 'sections', 'builder', 'hero', 'layout', 'order'],
  },
  {
    slug: 'batch-studio',
    label: 'Batch Studio',
    group: 'Screen Studio',
    icon: '▣',
    description: 'Design batches visually: image link, name, schedule, audience, pages, colour, motion and reward.',
    keywords: ['batch', 'studio', 'image', 'schedule', 'audience', 'reward', 'colour', 'animation', 'course card'],
  },
  {
    slug: 'animation-studio',
    label: 'Animation Studio',
    group: 'Screen Studio',
    icon: '✦',
    description: 'Author HTML/CSS/JS animation layers per page with triggers, timing, frequency and rewards.',
    keywords: ['animation', 'motion', 'html', 'css', 'js', 'confetti', 'overlay', 'reward', 'index.html', 'experience'],
  },
  {
    slug: 'goals',
    label: "Today's goals",
    group: 'Learning Content',
    icon: '◎',
    description: 'Daily targets with IST schedules, calls to action and audience targeting.',
    keywords: ['goal', 'daily', 'target', 'todo'],
  },
  {
    slug: 'batches',
    label: 'Batches',
    group: 'Learning Content',
    icon: '▣',
    description: 'Structured programmes, access codes, instructors and features.',
    keywords: ['batch', 'course', 'programme', 'enrollment'],
  },
  {
    slug: 'series',
    label: 'Series',
    group: 'Learning Content',
    icon: '▥',
    description: 'Chapter and subject series with access codes and ordering.',
    keywords: ['series', 'playlist', 'course', 'collection'],
  },
  {
    slug: 'subjects',
    label: 'Subjects',
    group: 'Learning Content',
    icon: '◫',
    description: 'Subject catalogue, exam/class applicability and batch or series assignments.',
    keywords: ['subject', 'chapter', 'physics', 'chemistry', 'biology', 'assign', 'course subjects'],
  },
  {
    slug: 'lectures',
    label: 'Lectures & resources',
    group: 'Learning Content',
    icon: '▶',
    description: 'Lectures, notes PDFs, resources and the preserved playlist importer.',
    keywords: ['lecture', 'video', 'resource', 'pdf', 'youtube', 'playlist'],
  },
  {
    slug: 'challenges',
    label: 'Study challenges',
    group: 'Learning Content',
    icon: '⚡',
    description: 'Short study sprints with checklists and student tracking.',
    keywords: ['challenge', 'sprint', 'streak', 'habit'],
  },
  {
    slug: 'campaigns',
    label: 'Revision campaigns',
    group: 'Learning Content',
    icon: '◫',
    description: 'Revision marathons grouped from scheduled events.',
    keywords: ['campaign', 'revision', 'marathon', 'event'],
  },
  {
    slug: 'tests',
    label: 'Tests & question banks',
    group: 'Tests & Performance',
    icon: '✎',
    description: 'Schedules, marks, live state and validated JSON question banks.',
    keywords: ['test', 'question', 'bank', 'mock', 'exam', 'json'],
  },
  {
    slug: 'leaderboards',
    label: 'Leaderboards',
    group: 'Tests & Performance',
    icon: '♜',
    description: 'Inspect per-test rankings and participation.',
    keywords: ['leaderboard', 'rank', 'scores', 'test'],
  },
  {
    slug: 'analytics',
    label: 'Student analytics',
    group: 'Tests & Performance',
    icon: '▧',
    description: 'Real attempt trends, subject performance and top learners.',
    keywords: ['analytics', 'performance', 'charts', 'subject', 'scores'],
  },
  {
    slug: 'students',
    label: 'Students & enrollments',
    group: 'Students & Access',
    icon: '◍',
    description: 'Search students, inspect profiles and manage batch access.',
    keywords: ['student', 'enrollment', 'batch', 'access code', 'users'],
  },
  {
    slug: 'badges',
    label: 'Badges & achievements',
    group: 'Students & Access',
    icon: '🏅',
    description: 'Create achievement badges, grant verified awards and review preserved award history.',
    keywords: ['badge', 'achievement', 'verified', 'award', 'revoke', 'recognition'],
  },
  {
    slug: 'announcements',
    label: 'Announcements',
    group: 'Communication',
    icon: '◔',
    description: 'Scheduled notices targeted by exam and class.',
    keywords: ['announcement', 'notice', 'news', 'schedule'],
  },
  {
    slug: 'events',
    label: 'Events & calendar',
    group: 'Communication',
    icon: '▦',
    description: 'Mock tests, marathons, doubt sessions and result announcements.',
    keywords: ['event', 'calendar', 'campaign', 'schedule', 'marathon'],
  },
  {
    slug: 'notifications',
    label: 'Notifications',
    group: 'Communication',
    icon: '◉',
    description: 'Send in-app notifications to targeted students, stored in Cloudflare D1.',
    keywords: ['notification', 'broadcast', 'push', 'inbox'],
  },
  {
    slug: 'feedback',
    label: 'Student feedback',
    group: 'Communication',
    icon: '✉',
    description: 'Review student feedback and reply to reports, suggestions and issues.',
    keywords: ['feedback', 'suggestion', 'issue', 'student response', 'reply', 'communication'],
  },
  {
    slug: 'appearance',
    label: 'Website appearance',
    group: 'Website Settings',
    icon: '◐',
    description: 'Brand colours, typography, layout, radius, density and theme presets.',
    keywords: ['theme', 'colors', 'colours', 'brand', 'dark mode', 'fonts', 'radius'],
  },
  {
    slug: 'navigation',
    label: 'Navigation & menu',
    group: 'Website Settings',
    icon: '☰',
    description: 'Header links, bottom navigation labels, ordering and announcement bar.',
    keywords: ['nav', 'menu', 'header', 'bottom nav', 'links'],
  },
  {
    slug: 'footer',
    label: 'Footer',
    group: 'Website Settings',
    icon: '▥',
    description: 'Footer copy, link columns, social links and copyright.',
    keywords: ['footer', 'links', 'copyright', 'social'],
  },
  {
    slug: 'banners',
    label: 'Banners & hero slides',
    group: 'Website Settings',
    icon: '▰',
    description: 'Scheduled, targeted hero banners with desktop and mobile artwork.',
    keywords: ['banner', 'carousel', 'hero', 'slide', 'campaign', 'image'],
  },
  {
    slug: 'popups',
    label: 'Popup & notice manager',
    group: 'Website Settings',
    icon: '❐',
    description: 'Frequency-controlled announcements for login, home and dashboard.',
    keywords: ['popup', 'notice', 'modal', 'frequency', 'dismiss'],
  },
  {
    slug: 'testimonials',
    label: 'Testimonials & highlights',
    group: 'Website Settings',
    icon: '❝',
    description: 'Curate student stories for login and homepage sections.',
    keywords: ['testimonial', 'social proof', 'reviews', 'stories'],
  },
  {
    slug: 'media',
    label: 'Media library',
    group: 'Website Settings',
    icon: '▧',
    description: 'Reusable image, PDF and video URLs with tags and usage.',
    keywords: ['media', 'images', 'assets', 'library', 'pdf'],
  },
  {
    slug: 'search',
    label: 'SEO & discovery',
    group: 'Website Settings',
    icon: '⌕',
    description: 'SEO metadata, search placeholder and popular searches.',
    keywords: ['seo', 'search', 'meta', 'og', 'keywords'],
  },
  {
    slug: 'feature-toggles',
    label: 'Feature toggles',
    group: 'Website Settings',
    icon: '◫',
    description: 'Show or hide student-facing capabilities without deleting data.',
    keywords: ['features', 'toggles', 'visibility', 'flags'],
  },
  {
    slug: 'scheduling',
    label: 'Content scheduling',
    group: 'System',
    icon: '◷',
    description: 'One timeline for banners, events, goals, tests and announcements.',
    keywords: ['schedule', 'timeline', 'calendar', 'publish'],
  },
  {
    slug: 'reports',
    label: 'Activity reports',
    group: 'System',
    icon: '▤',
    description: 'Audit trail of admin writes and exportable summaries.',
    keywords: ['reports', 'audit', 'activity', 'log', 'export'],
  },
  {
    slug: 'import-export',
    label: 'Import / export',
    group: 'System',
    icon: '⇅',
    description: 'Back up settings and content; validate imports before writing.',
    keywords: ['import', 'export', 'backup', 'json', 'csv'],
  },
  {
    slug: 'preferences',
    label: 'Admin preferences',
    group: 'System',
    icon: '⚙',
    description: 'Sidebar, density and default landing preferences for this browser.',
    keywords: ['preferences', 'settings', 'sidebar', 'density'],
  },
  {
    slug: 'health',
    label: 'System & content health',
    group: 'System',
    icon: '✚',
    description: 'Missing metadata, broken links, empty tests and inactive content.',
    keywords: ['health', 'errors', 'metadata', 'broken', 'quality'],
  },
  {
    slug: 'classic',
    label: 'Classic content tools',
    group: 'System',
    icon: '⌘',
    description: 'The original admin console, including the preserved playlist importer.',
    keywords: ['classic', 'legacy', 'playlist', 'import', 'youtube'],
  },
];

export const ADMIN_GROUPS: AdminSectionGroup[] = [
  'Overview',
  'Screen Studio',
  'Learning Content',
  'Tests & Performance',
  'Students & Access',
  'Communication',
  'Website Settings',
  'System',
];

/**
 * Login / Signup are deliberately absent from this registry. Their presentation
 * stays code-managed so authentication can never be broken by a CMS edit. The
 * stored `login` settings key is still consumed by the sign-in screen for
 * backwards compatibility, but there is no editable admin entry for it.
 */
export function findAdminSection(slug: string | null | undefined): AdminSectionMeta | null {
  if (!slug) return null;
  return ADMIN_SECTIONS.find((section) => section.slug === slug) || null;
}

export function searchAdminSections(query: string): AdminSectionMeta[] {
  const q = query.trim().toLowerCase();
  if (!q) return ADMIN_SECTIONS;
  return ADMIN_SECTIONS.filter((section) => {
    const haystack = [section.label, section.group, section.description, ...section.keywords]
      .join(' ')
      .toLowerCase();
    return haystack.includes(q);
  });
}

export function adminSectionHref(slug: string): string {
  return slug === 'overview' ? '/admin' : `/admin/${slug}`;
}

export type AdminSectionGroup =
  | 'Command centre'
  | 'Design studio'
  | 'Learning'
  | 'Students'
  | 'Growth'
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
    group: 'Command centre',
    icon: '◈',
    description: 'Live counts, content health, recent activity and quick actions.',
    keywords: ['dashboard', 'home', 'stats', 'activity', 'quick actions'],
  },
  {
    slug: 'appearance',
    label: 'Website Appearance',
    group: 'Design studio',
    icon: '◐',
    description: 'Brand colours, typography, layout, radius, density and theme presets.',
    keywords: ['theme', 'colors', 'colours', 'brand', 'dark mode', 'fonts', 'radius'],
  },
  {
    slug: 'login',
    label: 'Login Page Designer',
    group: 'Design studio',
    icon: '⇥',
    description: 'Design the sign-in experience without altering authentication.',
    keywords: ['login', 'sign in', 'auth', 'hero', 'layout', 'google'],
  },
  {
    slug: 'homepage',
    label: 'Home Page Builder',
    group: 'Design studio',
    icon: '▤',
    description: 'Add, hide, reorder and target every student homepage section.',
    keywords: ['home', 'sections', 'builder', 'hero', 'layout', 'order'],
  },
  {
    slug: 'banners',
    label: 'Banners & Hero Slides',
    group: 'Design studio',
    icon: '▰',
    description: 'Scheduled, targeted hero banners with desktop and mobile artwork.',
    keywords: ['banner', 'carousel', 'hero', 'slide', 'campaign', 'image'],
  },
  {
    slug: 'popups',
    label: 'Popup & Notice Manager',
    group: 'Design studio',
    icon: '❐',
    description: 'Frequency-controlled announcements for login, home and dashboard.',
    keywords: ['popup', 'notice', 'modal', 'frequency', 'dismiss'],
  },
  {
    slug: 'navigation',
    label: 'Navigation & Menu',
    group: 'Design studio',
    icon: '☰',
    description: 'Header links, bottom navigation labels, ordering and announcement bar.',
    keywords: ['nav', 'menu', 'header', 'bottom nav', 'links'],
  },
  {
    slug: 'footer',
    label: 'Footer Manager',
    group: 'Design studio',
    icon: '▥',
    description: 'Footer copy, link columns, social links and copyright.',
    keywords: ['footer', 'links', 'copyright', 'social'],
  },
  {
    slug: 'testimonials',
    label: 'Testimonials & Highlights',
    group: 'Growth',
    icon: '❝',
    description: 'Curate student stories for login and homepage sections.',
    keywords: ['testimonial', 'social proof', 'reviews', 'stories'],
  },
  {
    slug: 'events',
    label: 'Events & Calendar',
    group: 'Learning',
    icon: '▦',
    description: 'Mock tests, marathons, doubt sessions and result announcements.',
    keywords: ['event', 'calendar', 'campaign', 'schedule', 'marathon'],
  },
  {
    slug: 'announcements',
    label: 'Announcements',
    group: 'Learning',
    icon: '◔',
    description: 'Scheduled notices targeted by exam and class.',
    keywords: ['announcement', 'notice', 'news', 'schedule'],
  },
  {
    slug: 'goals',
    label: "Today's Goals",
    group: 'Learning',
    icon: '◎',
    description: 'Daily targets with IST schedules, CTAs and audience targeting.',
    keywords: ['goal', 'daily', 'target', 'todo'],
  },
  {
    slug: 'batches',
    label: 'Batches',
    group: 'Learning',
    icon: '▣',
    description: 'Structured programmes, access codes, instructors and features.',
    keywords: ['batch', 'course', 'programme', 'enrollment'],
  },
  {
    slug: 'series',
    label: 'Series',
    group: 'Learning',
    icon: '▤',
    description: 'Chapter and subject series with access codes and ordering.',
    keywords: ['series', 'playlist', 'course', 'collection'],
  },
  {
    slug: 'lectures',
    label: 'Lectures & Resources',
    group: 'Learning',
    icon: '▶',
    description: 'Lectures, notes PDFs, resources and the preserved playlist importer.',
    keywords: ['lecture', 'video', 'resource', 'pdf', 'youtube', 'playlist'],
  },
  {
    slug: 'tests',
    label: 'Tests & Question Banks',
    group: 'Learning',
    icon: '✎',
    description: 'Schedules, marks, live state and validated JSON question banks.',
    keywords: ['test', 'question', 'bank', 'mock', 'exam', 'json'],
  },
  {
    slug: 'challenges',
    label: 'Study Challenges',
    group: 'Learning',
    icon: '⚡',
    description: 'Short study sprints with checklists and student tracking.',
    keywords: ['challenge', 'sprint', 'streak', 'habit'],
  },
  {
    slug: 'campaigns',
    label: 'Revision Campaigns',
    group: 'Learning',
    icon: '◈',
    description: 'Revision marathons grouped from scheduled events.',
    keywords: ['campaign', 'revision', 'marathon', 'event'],
  },
  {
    slug: 'students',
    label: 'Students & Enrollments',
    group: 'Students',
    icon: '◍',
    description: 'Search students, inspect profiles and manage batch access.',
    keywords: ['student', 'enrollment', 'batch', 'access code', 'users'],
  },
  {
    slug: 'analytics',
    label: 'Student Analytics',
    group: 'Students',
    icon: '▧',
    description: 'Real attempt trends, subject performance and top learners.',
    keywords: ['analytics', 'performance', 'charts', 'subject', 'scores'],
  },
  {
    slug: 'leaderboards',
    label: 'Leaderboards',
    group: 'Students',
    icon: '♜',
    description: 'Inspect per-test rankings and participation.',
    keywords: ['leaderboard', 'rank', 'scores', 'test'],
  },
  {
    slug: 'notifications',
    label: 'Notifications',
    group: 'Growth',
    icon: '◉',
    description: 'Send in-app notifications to targeted students via Firestore.',
    keywords: ['notification', 'broadcast', 'push', 'inbox'],
  },
  {
    slug: 'media',
    label: 'Media Library',
    group: 'Design studio',
    icon: '▧',
    description: 'Reusable image, PDF and video URLs with tags and usage.',
    keywords: ['media', 'images', 'assets', 'library', 'pdf'],
  },
  {
    slug: 'search',
    label: 'Search & Discoverability',
    group: 'Growth',
    icon: '⌕',
    description: 'SEO metadata, search placeholder and popular searches.',
    keywords: ['seo', 'search', 'meta', 'og', 'keywords'],
  },
  {
    slug: 'scheduling',
    label: 'Content Scheduling',
    group: 'System',
    icon: '◷',
    description: 'One timeline for banners, events, goals, tests and announcements.',
    keywords: ['schedule', 'timeline', 'calendar', 'publish'],
  },
  {
    slug: 'reports',
    label: 'Activity Reports',
    group: 'System',
    icon: '▤',
    description: 'Audit trail of admin writes and exportable summaries.',
    keywords: ['reports', 'audit', 'activity', 'log', 'export'],
  },
  {
    slug: 'feature-toggles',
    label: 'Feature Toggles',
    group: 'System',
    icon: '◫',
    description: 'Show or hide student-facing capabilities without deleting data.',
    keywords: ['features', 'toggles', 'visibility', 'flags'],
  },
  {
    slug: 'import-export',
    label: 'Import / Export',
    group: 'System',
    icon: '⇅',
    description: 'Back up settings and content; validate imports before writing.',
    keywords: ['import', 'export', 'backup', 'json', 'csv'],
  },
  {
    slug: 'preferences',
    label: 'Admin Preferences',
    group: 'System',
    icon: '⚙',
    description: 'Sidebar, density and default landing preferences for this browser.',
    keywords: ['preferences', 'settings', 'sidebar', 'density'],
  },
  {
    slug: 'health',
    label: 'System & Content Health',
    group: 'System',
    icon: '✚',
    description: 'Missing metadata, broken links, empty tests and inactive content.',
    keywords: ['health', 'errors', 'metadata', 'broken', 'quality'],
  },
  {
    slug: 'classic',
    label: 'Classic Content Tools',
    group: 'System',
    icon: '⌘',
    description: 'The original admin console, including the preserved playlist importer.',
    keywords: ['classic', 'legacy', 'playlist', 'import', 'youtube'],
  },
];

export const ADMIN_GROUPS: AdminSectionGroup[] = [
  'Command centre',
  'Design studio',
  'Learning',
  'Students',
  'Growth',
  'System',
];

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

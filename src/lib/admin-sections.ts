export type AdminSectionGroup =
  | 'Dashboard'
  | 'Courses & Content'
  | 'Tests & Ranks'
  | 'Students & Badges'
  | 'Website & Design';

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
    label: 'Dashboard Overview',
    group: 'Dashboard',
    icon: '◈',
    description: 'Platform summary, 5-step academy setup guide, and quick actions.',
    keywords: ['dashboard', 'home', 'stats', 'quick actions', 'overview'],
  },
  {
    slug: 'analytics',
    label: 'Student Analytics',
    group: 'Dashboard',
    icon: '▧',
    description: 'Real test attempt trends, subject accuracy, and top performers.',
    keywords: ['analytics', 'performance', 'charts', 'subject', 'scores'],
  },
  {
    slug: 'subjects',
    label: 'Subjects',
    group: 'Courses & Content',
    icon: '◫',
    description: 'Create Physics, Chemistry, Maths & Biology subjects and assign them to courses.',
    keywords: ['subject', 'chapter', 'physics', 'chemistry', 'biology', 'assign', 'course subjects'],
  },
  {
    slug: 'batches',
    label: 'Batches & Card Studio',
    group: 'Courses & Content',
    icon: '▣',
    description: 'Manage full batches, access codes, subjects, and visual batch cards in one place.',
    keywords: ['batch', 'studio', 'course', 'programme', 'enrollment', 'card'],
  },
  {
    slug: 'series',
    label: 'Chapter Series',
    group: 'Courses & Content',
    icon: '▥',
    description: 'Topic-wise series with ordered lectures, notes, and access control.',
    keywords: ['series', 'playlist', 'course', 'collection'],
  },
  {
    slug: 'lectures',
    label: 'Lectures & PDF Notes',
    group: 'Courses & Content',
    icon: '▶',
    description: 'Video lectures, PDF study notes, and one-click YouTube playlist import.',
    keywords: ['lecture', 'video', 'resource', 'pdf', 'youtube', 'playlist'],
  },
  {
    slug: 'goals',
    label: 'Daily Study Goals',
    group: 'Courses & Content',
    icon: '◎',
    description: 'Daily targets with IST schedules and direct study links.',
    keywords: ['goal', 'daily', 'target', 'todo'],
  },
  {
    slug: 'challenges',
    label: 'Study Challenges',
    group: 'Courses & Content',
    icon: '⚡',
    description: 'Streak sprints and milestone challenges for students.',
    keywords: ['challenge', 'sprint', 'streak', 'habit'],
  },
  {
    slug: 'tests',
    label: 'Mock Tests & Questions',
    group: 'Tests & Ranks',
    icon: '✎',
    description: 'Create NTA-style timed tests, schedules, negative marking, and question banks.',
    keywords: ['test', 'question', 'bank', 'mock', 'exam', 'json'],
  },
  {
    slug: 'leaderboards',
    label: 'Test Leaderboards',
    group: 'Tests & Ranks',
    icon: '♜',
    description: 'Inspect student rankings and scores across every test.',
    keywords: ['leaderboard', 'rank', 'scores', 'test'],
  },
  {
    slug: 'students',
    label: 'Students & Enrollments',
    group: 'Students & Badges',
    icon: '◍',
    description: 'Search students, view profiles, and grant or revoke batch access.',
    keywords: ['student', 'enrollment', 'batch', 'access code', 'users'],
  },
  {
    slug: 'badges',
    label: 'Badges & Rewards',
    group: 'Students & Badges',
    icon: '🏅',
    description: 'Upload badge images, write Kaise Milega rules, add custom code animations, and award students.',
    keywords: ['badge', 'achievement', 'verified', 'award', 'animation', 'kaise milega', 'recognition'],
  },
  {
    slug: 'announcements',
    label: 'Announcements',
    group: 'Students & Badges',
    icon: '◔',
    description: 'Post notices targeted to JEE, NEET, Class 11, Class 12, or Dropper students.',
    keywords: ['announcement', 'notice', 'news', 'schedule'],
  },
  {
    slug: 'events',
    label: 'Events & Marathons',
    group: 'Students & Badges',
    icon: '▦',
    description: 'Schedule revision marathons, doubt sessions, and live test events.',
    keywords: ['event', 'calendar', 'campaign', 'schedule', 'marathon', 'revision'],
  },
  {
    slug: 'notifications',
    label: 'Push Notifications',
    group: 'Students & Badges',
    icon: '◉',
    description: 'Send in-app alerts directly to targeted student cohorts.',
    keywords: ['notification', 'broadcast', 'push', 'inbox'],
  },
  {
    slug: 'feedback',
    label: 'Student Doubts & Support',
    group: 'Students & Badges',
    icon: '✉',
    description: 'Read student doubts/feedback and reply in threads.',
    keywords: ['feedback', 'doubt', 'suggestion', 'issue', 'reply', 'communication'],
  },
  {
    slug: 'appearance',
    label: 'Theme & Brand Colours',
    group: 'Website & Design',
    icon: '◐',
    description: 'Brand name, logo, colours, dark/light theme presets, and layout style.',
    keywords: ['theme', 'colors', 'colours', 'brand', 'dark mode', 'fonts', 'radius'],
  },
  {
    slug: 'homepage',
    label: 'Home Screen Builder',
    group: 'Website & Design',
    icon: '▤',
    description: 'Customise the student home hero, welcome message, and section order.',
    keywords: ['home', 'sections', 'builder', 'hero', 'layout', 'order'],
  },
  {
    slug: 'screens',
    label: 'App Screens Studio',
    group: 'Website & Design',
    icon: '▭',
    description: 'Edit titles, tabs, labels, and empty states of student pages.',
    keywords: ['screen studio', 'page builder', 'screens', 'layout', 'copy', 'headings'],
  },
  {
    slug: 'banners',
    label: 'Hero Banners',
    group: 'Website & Design',
    icon: '▰',
    description: 'Promotional carousel banners with desktop/mobile artwork.',
    keywords: ['banner', 'carousel', 'hero', 'slide', 'campaign', 'image'],
  },
  {
    slug: 'popups',
    label: 'Popup Notices',
    group: 'Website & Design',
    icon: '❐',
    description: 'Scheduled announcement popups for home and dashboard screens.',
    keywords: ['popup', 'notice', 'modal', 'frequency', 'dismiss'],
  },
  {
    slug: 'animation-studio',
    label: 'Page Animations',
    group: 'Website & Design',
    icon: '✦',
    description: 'Custom HTML/CSS/JS celebration and spotlight effects for pages.',
    keywords: ['animation', 'motion', 'html', 'css', 'js', 'confetti', 'overlay'],
  },
  {
    slug: 'testimonials',
    label: 'Student Stories',
    group: 'Website & Design',
    icon: '❝',
    description: 'Topper quotes and results shown on login and home screens.',
    keywords: ['testimonial', 'social proof', 'reviews', 'stories'],
  },
  {
    slug: 'navigation',
    label: 'Menus & Bottom Nav',
    group: 'Website & Design',
    icon: '☰',
    description: 'Configure top navigation links, bottom mobile tabs, and top ribbon.',
    keywords: ['nav', 'menu', 'header', 'bottom nav', 'links'],
  },
  {
    slug: 'footer',
    label: 'Website Footer',
    group: 'Website & Design',
    icon: '▥',
    description: 'Footer columns, support links, and copyright text.',
    keywords: ['footer', 'links', 'copyright', 'social'],
  },
  {
    slug: 'media',
    label: 'Media Library',
    group: 'Website & Design',
    icon: '▧',
    description: 'Reusable image, PDF, and video links.',
    keywords: ['media', 'images', 'assets', 'library', 'pdf'],
  },
  {
    slug: 'search',
    label: 'SEO & Search',
    group: 'Website & Design',
    icon: '⌕',
    description: 'Website title, meta description, and popular search tags.',
    keywords: ['seo', 'search', 'meta', 'og', 'keywords'],
  },
  {
    slug: 'feature-toggles',
    label: 'Feature Switches',
    group: 'Website & Design',
    icon: '◫',
    description: 'Enable or hide student modules in one click without losing data.',
    keywords: ['features', 'toggles', 'visibility', 'flags'],
  },
  {
    slug: 'health',
    label: 'Content Quality Check',
    group: 'Website & Design',
    icon: '✚',
    description: 'Detect tests missing questions, missing thumbnails, or unscheduled events.',
    keywords: ['health', 'errors', 'metadata', 'broken', 'quality'],
  },
  {
    slug: 'import-export',
    label: 'Backup & Restore',
    group: 'Website & Design',
    icon: '⇅',
    description: 'Export or import validated JSON backups of website settings.',
    keywords: ['import', 'export', 'backup', 'json'],
  },
  {
    slug: 'preferences',
    label: 'Admin Preferences',
    group: 'Website & Design',
    icon: '⚙',
    description: 'Sidebar width, table density, and default landing workspace.',
    keywords: ['preferences', 'settings', 'sidebar', 'density'],
  },
];

export const ADMIN_GROUPS: AdminSectionGroup[] = [
  'Dashboard',
  'Courses & Content',
  'Tests & Ranks',
  'Students & Badges',
  'Website & Design',
];

/**
 * Login / Signup are deliberately absent from this registry. Their presentation
 * stays code-managed so authentication can never be broken by a CMS edit.
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

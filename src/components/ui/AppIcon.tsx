import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  ArrowDownUp,
  BarChart3,
  Bell,
  BellRing,
  BookOpen,
  CalendarClock,
  CalendarDays,
  ClipboardCheck,
  ClipboardList,
  Compass,
  FileQuestion,
  FolderOpen,
  Image as ImageIcon,
  Layers,
  LayoutDashboard,
  LayoutTemplate,
  MonitorSmartphone,
  ListVideo,
  Megaphone,
  Menu,
  MessageSquareWarning,
  MessagesSquare,
  Palette,
  PanelBottom,
  PlayCircle,
  Quote,
  RefreshCw,
  ScrollText,
  Search,
  Settings2,
  SlidersHorizontal,
  Sparkles,
  Target,
  Terminal,
  ToggleLeft,
  Trophy,
  UserRound,
  Users,
  Zap,
} from 'lucide-react';

const NAV_ICONS: Record<string, LucideIcon> = {
  '/home': LayoutDashboard,
  '/lectures': PlayCircle,
  '/tests': ClipboardCheck,
  '/leaderboard': Trophy,
  '/profile': UserRound,
  '/chat': MessagesSquare,
  '/notifications': Bell,
  '/events': CalendarDays,
  '/challenges': Zap,
  '/search': Search,
  '/admin': Settings2,
};

export function NavIcon({
  href,
  fallback,
  size = 18,
  className = '',
  strokeWidth = 2,
}: {
  href: string;
  fallback?: string;
  size?: number;
  className?: string;
  strokeWidth?: number;
}) {
  const path = href.split('?')[0].replace(/\/+$/, '') || '/';
  const Icon = NAV_ICONS[path];
  if (Icon) return <Icon size={size} className={className} strokeWidth={strokeWidth} aria-hidden />;
  return (
    <span className={className} aria-hidden>
      {fallback || '•'}
    </span>
  );
}

const ADMIN_ICONS: Record<string, LucideIcon> = {
  overview: LayoutDashboard,
  screens: MonitorSmartphone,
  appearance: Palette,
  homepage: LayoutTemplate,
  banners: ImageIcon,
  popups: MessageSquareWarning,
  navigation: Menu,
  footer: PanelBottom,
  testimonials: Quote,
  events: CalendarDays,
  announcements: Megaphone,
  goals: Target,
  batches: Layers,
  series: ListVideo,
  lectures: PlayCircle,
  tests: FileQuestion,
  challenges: Zap,
  campaigns: RefreshCw,
  students: Users,
  analytics: BarChart3,
  leaderboards: Trophy,
  notifications: BellRing,
  chat: MessagesSquare,
  media: FolderOpen,
  search: Search,
  scheduling: CalendarClock,
  reports: ScrollText,
  'feature-toggles': ToggleLeft,
  'import-export': ArrowDownUp,
  preferences: SlidersHorizontal,
  health: Activity,
  classic: Terminal,
};

export function AdminSectionIcon({
  slug,
  size = 16,
  className = '',
  strokeWidth = 1.9,
}: {
  slug: string;
  size?: number;
  className?: string;
  strokeWidth?: number;
}) {
  const Icon = ADMIN_ICONS[slug];
  if (!Icon) return <Compass size={size} className={className} strokeWidth={strokeWidth} aria-hidden />;
  return <Icon size={size} className={className} strokeWidth={strokeWidth} aria-hidden />;
}

export { BookOpen, Sparkles, Search, Settings2 };

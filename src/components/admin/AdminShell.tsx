'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { HelpCircle, Sparkles, X } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useSiteConfig } from '@/context/SiteConfigContext';
import { useToast } from '@/hooks/useToast';
import {
  ADMIN_GROUPS,
  ADMIN_SECTIONS,
  adminSectionHref,
  findAdminSection,
  searchAdminSections,
  type AdminSectionMeta,
} from '@/lib/admin-sections';
import { readAdminPreferences, writeAdminPreferences } from '@/lib/admin-prefs';
import { AdminSectionIcon } from '@/components/ui/AppIcon';

const QUICK_ACTIONS: Array<{ label: string; href: string; hint: string; icon: string }> = [
  { label: 'Create or award an animated badge', href: '/admin/badges', hint: 'Students & Badges', icon: '🏅' },
  { label: 'Create a batch & assign subjects', href: '/admin/batches', hint: 'Courses & Content', icon: '▣' },
  { label: 'Upload lectures or YouTube playlist', href: '/admin/lectures', hint: 'Courses & Content', icon: '▶' },
  { label: 'Create a mock test', href: '/admin/tests', hint: 'Tests & Ranks', icon: '✎' },
  { label: 'Edit Home Screen sections', href: '/admin/homepage', hint: 'Website & Design', icon: '▤' },
  { label: 'Add a promotional hero banner', href: '/admin/banners', hint: 'Website & Design', icon: '▰' },
  { label: 'Send student announcement', href: '/admin/announcements', hint: 'Students & Badges', icon: '◔' },
  { label: 'View student analytics', href: '/admin/analytics', hint: 'Dashboard', icon: '▧' },
];

const ADMIN_GUIDE_CARDS = [
  {
    title: '1. Subjects → Batches → Lectures',
    body: 'First create Subjects (Physics, Chemistry, Maths, Biology). Then open Batches or Series, click Manage, assign subjects, and add ordered video lectures or PDF notes.',
    href: '/admin/batches',
    cta: 'Open Batches',
  },
  {
    title: '2. Animated Badges & Kaise Milega',
    body: 'Open Badges & Rewards to upload any PNG/JPG/WebP image, name your badge, write Kaise Milega rules (manual or automatic unlock!), and choose a preset or custom CSS/JS animation.',
    href: '/admin/badges',
    cta: 'Open Badge Studio',
  },
  {
    title: '3. Mock Tests & Leaderboards',
    body: 'Create timed NTA-pattern tests with positive/negative marking. Student attempts automatically populate rankings and subject analytics.',
    href: '/admin/tests',
    cta: 'Open Mock Tests',
  },
  {
    title: '4. Theme & Home Screen Customisation',
    body: 'Change brand colours, theme presets, banners, and student screen headings anytime under Website & Design.',
    href: '/admin/appearance',
    cta: 'Open Theme Studio',
  },
];

function isActive(pathname: string | null, slug: string): boolean {
  if (!pathname) return false;
  if (slug === 'overview') return pathname === '/admin';
  return pathname === `/admin/${slug}` || pathname.startsWith(`/admin/${slug}/`);
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const { user, isAdmin, initializing, signOut } = useAuth();
  const { config } = useSiteConfig();
  const { push } = useToast();
  const pathname = usePathname();
  const router = useRouter();

  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [navQuery, setNavQuery] = useState('');
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState('');
  const [compact, setCompact] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const paletteInputRef = useRef<HTMLInputElement | null>(null);

  const activeSlug = pathname === '/admin' ? 'overview' : pathname?.split('/')[2] || 'overview';
  const activeSection = findAdminSection(activeSlug);
  const isNestedPage = Boolean(pathname && pathname.split('/').filter(Boolean).length > 2);

  useEffect(() => {
    const prefs = readAdminPreferences();
    setCollapsed(prefs.sidebarCollapsed);
    setCompact(prefs.compactTables);
    setReduceMotion(prefs.reduceAdminMotion);
    const onPrefs = () => {
      const next = readAdminPreferences();
      setCollapsed(next.sidebarCollapsed);
      setCompact(next.compactTables);
      setReduceMotion(next.reduceAdminMotion);
    };
    window.addEventListener('ec-admin-prefs-changed', onPrefs);
    return () => window.removeEventListener('ec-admin-prefs-changed', onPrefs);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
    setPaletteOpen(false);
    setPaletteQuery('');
  }, [pathname]);

  useEffect(() => {
    if (activeSection) {
      document.title = `${activeSection.label} · Admin — ${config.theme.brandName}`;
    }
  }, [activeSection, config.theme.brandName]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      }
      if (event.key === 'Escape') {
        setGuideOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (paletteOpen) {
      setPaletteQuery('');
      window.setTimeout(() => paletteInputRef.current?.focus(), 30);
    }
  }, [paletteOpen]);

  const filteredSections = useMemo(() => {
    if (!navQuery.trim()) return ADMIN_SECTIONS;
    return searchAdminSections(navQuery);
  }, [navQuery]);

  const paletteResults = useMemo(() => searchAdminSections(paletteQuery).slice(0, 10), [paletteQuery]);
  const quickResults = useMemo(() => {
    const q = paletteQuery.trim().toLowerCase();
    if (!q) return QUICK_ACTIONS;
    return QUICK_ACTIONS.filter((action) => `${action.label} ${action.hint}`.toLowerCase().includes(q));
  }, [paletteQuery]);

  function toggleCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
    const prefs = readAdminPreferences();
    writeAdminPreferences({ ...prefs, sidebarCollapsed: next });
  }

  function navigate(href: string) {
    setPaletteOpen(false);
    setPaletteQuery('');
    router.push(href);
  }

  if (initializing) {
    return (
      <div className="min-h-screen grid place-items-center" style={{ background: 'var(--ec-bg)' }}>
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
          <p className="text-sm text-ink-500 mt-3">Loading your admin console…</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen grid place-items-center px-4" style={{ background: 'var(--ec-bg)' }}>
        <div className="ec-card max-w-md w-full p-8 text-center">
          <div className="mx-auto h-12 w-12 rounded-2xl bg-brand-600 text-white grid place-items-center text-xl">🔐</div>
          <h1 className="text-xl font-bold mt-4">Admin sign-in required</h1>
          <p className="text-sm text-ink-500 mt-1">
            Sign in with your administrator account to manage courses, badges, tests, and website settings.
          </p>
          <Link href="/login" className="mt-5 inline-flex px-4 py-2.5 bg-brand-600 text-white rounded-button text-sm font-semibold">
            Go to sign in
          </Link>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen grid place-items-center px-4" style={{ background: 'var(--ec-bg)' }}>
        <div className="ec-card max-w-lg w-full p-8 text-center">
          <div className="mx-auto h-12 w-12 rounded-2xl bg-red-100 text-red-700 grid place-items-center text-xl">⛔</div>
          <h1 className="text-xl font-bold mt-4">Admin access denied</h1>
          <p className="text-sm text-ink-500 mt-1">
            You are signed in as <strong>{user.email}</strong>. Only verified administrators can open this workspace.
          </p>
          <div className="flex flex-wrap gap-2 justify-center mt-5">
            <Link href="/home" className="px-4 py-2.5 border border-ink-200 rounded-button text-sm font-semibold">
              Go to student home
            </Link>
            <button
              type="button"
              onClick={() => {
                void signOut();
                push('Signed out', 'success');
              }}
              className="px-4 py-2.5 bg-ink-900 text-white rounded-button text-sm font-semibold"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    );
  }

  const sidebarWidth = collapsed ? 'w-[80px]' : 'w-[264px]';

  return (
    <div
      className={`min-h-screen ${compact ? 'text-[13px]' : ''}`}
      style={{ background: '#f6f7fb' }}
      data-ec-admin-motion={reduceMotion ? 'reduced' : 'full'}
      data-ec-compact={compact ? 'true' : 'false'}
    >
      {/* Mobile drawer */}
      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-slate-950/45 backdrop-blur-xs" onClick={() => setMobileOpen(false)} />
          <aside className="relative z-10 flex h-full w-[min(290px,86vw)] flex-col overflow-y-auto border-r border-slate-200 bg-white shadow-2xl">
            <SidebarContent
              collapsed={false}
              pathname={pathname}
              query={navQuery}
              onQuery={setNavQuery}
              sections={filteredSections}
              onCollapse={null}
              onNavigate={() => setMobileOpen(false)}
              onSignOut={() => {
                void signOut();
              }}
              brand={config.theme.brandName}
              logoText={config.theme.logoText}
              email={user.email || ''}
            />
          </aside>
        </div>
      ) : null}

      {/* Desktop sidebar */}
      <aside
        className={`hidden lg:flex fixed inset-y-0 left-0 z-40 ${sidebarWidth} transition-[width] duration-200 border-r border-slate-200/90 bg-white flex-col`}
      >
        <SidebarContent
          collapsed={collapsed}
          pathname={pathname}
          query={navQuery}
          onQuery={setNavQuery}
          sections={filteredSections}
          onCollapse={toggleCollapsed}
          onNavigate={() => undefined}
          onSignOut={() => {
            void signOut();
          }}
          brand={config.theme.brandName}
          logoText={config.theme.logoText}
          email={user.email || ''}
        />
      </aside>

      <div className={`${collapsed ? 'lg:pl-[80px]' : 'lg:pl-[264px]'} transition-[padding] duration-200`}>
        <header className="sticky top-0 z-30 border-b border-slate-200/90 bg-white/95 backdrop-blur-md">
          <div className="flex h-14 items-center justify-between gap-2 px-3 sm:px-5">
            <div className="flex min-w-0 items-center gap-2.5">
              <button
                type="button"
                onClick={() => setMobileOpen(true)}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 lg:hidden"
                aria-label="Open admin navigation"
              >
                ☰
              </button>
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-brand-700">
                  {activeSection?.group || 'Admin Studio'}
                </p>
                <p className="truncate text-sm font-extrabold text-slate-900">
                  {activeSection?.label || 'Dashboard Overview'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2">
              <button
                type="button"
                onClick={() => setPaletteOpen(true)}
                className="hidden sm:flex items-center gap-2 h-9 px-3 rounded-xl border border-slate-200 bg-slate-50/80 text-xs text-slate-500 hover:bg-slate-100 min-w-[180px]"
              >
                <span>⌕</span>
                <span className="flex-1 text-left">Jump to any tool…</span>
                <kbd className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-semibold">
                  ⌘K
                </kbd>
              </button>
              <button
                type="button"
                onClick={() => setPaletteOpen(true)}
                className="grid h-9 w-9 place-items-center rounded-xl border border-slate-200 text-slate-600 sm:hidden"
                aria-label="Search admin"
              >
                ⌕
              </button>
              <button
                type="button"
                onClick={() => setGuideOpen(true)}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-brand-200 bg-brand-50 px-2.5 text-xs font-bold text-brand-700 hover:bg-brand-100"
              >
                <HelpCircle size={14} /> <span className="hidden xs:inline sm:inline">Guide</span>
              </button>
              <Link
                href="/home"
                target="_blank"
                className="hidden md:inline-flex h-9 items-center rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Student App ↗
              </Link>
              <div
                className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-600 text-xs font-bold text-white"
                title={user.email || ''}
              >
                {(user.email || 'A').slice(0, 1).toUpperCase()}
              </div>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-[1480px] px-3.5 py-5 sm:px-6 sm:py-6 lg:px-7">
          {isNestedPage && activeSection ? (
            <nav aria-label="Breadcrumb" className="mb-3 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
              <Link href="/admin" className="font-medium hover:text-slate-900">
                Dashboard
              </Link>
              <span aria-hidden>/</span>
              <Link href={adminSectionHref(activeSection.slug)} className="font-semibold text-slate-800">
                {activeSection.label}
              </Link>
            </nav>
          ) : null}
          {children}
        </main>
      </div>

      {/* Admin Quick Guide Modal */}
      {guideOpen ? (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-xs"
          onClick={() => setGuideOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Admin Console Guide"
            className="ec-card relative max-h-[85vh] w-full max-w-2xl overflow-y-auto p-5 sm:p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-ink-100 pb-4">
              <div>
                <p className="inline-flex items-center gap-1 text-[11px] font-extrabold uppercase tracking-[0.14em] text-brand-700">
                  <Sparkles size={12} /> Admin Quick Guide
                </p>
                <h2 className="mt-1 text-lg font-extrabold text-ink-900 sm:text-xl">
                  How Everything Works in 4 Simple Steps
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setGuideOpen(false)}
                aria-label="Close guide"
                className="grid h-8 w-8 place-items-center rounded-lg border border-ink-200 text-ink-500 hover:bg-ink-50"
              >
                <X size={15} />
              </button>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {ADMIN_GUIDE_CARDS.map((card) => (
                <div key={card.title} className="rounded-2xl border border-ink-100 bg-ink-50/50 p-4 flex flex-col justify-between">
                  <div>
                    <h3 className="text-sm font-extrabold text-ink-900">{card.title}</h3>
                    <p className="mt-1.5 text-xs leading-relaxed text-ink-600">{card.body}</p>
                  </div>
                  <Link
                    href={card.href}
                    onClick={() => setGuideOpen(false)}
                    className="mt-3 inline-flex items-center text-xs font-bold text-brand-700 hover:underline"
                  >
                    {card.cta} →
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {/* Command palette */}
      {paletteOpen ? (
        <div className="fixed inset-0 z-[100]">
          <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-xs" onClick={() => setPaletteOpen(false)} />
          <div className="relative mx-auto mt-[8vh] w-[min(680px,94vw)] ec-card shadow-2xl overflow-hidden">
            <div className="flex items-center gap-2 border-b border-ink-100 px-4">
              <span className="text-ink-400">⌕</span>
              <input
                ref={paletteInputRef}
                value={paletteQuery}
                onChange={(event) => setPaletteQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') setPaletteOpen(false);
                  if (event.key === 'Enter') {
                    const target = paletteResults[0]
                      ? adminSectionHref(paletteResults[0].slug)
                      : quickResults[0]?.href;
                    if (target) navigate(target);
                  }
                }}
                placeholder="Search sections, badges, batches, tests, settings…"
                className="flex-1 border-0 bg-transparent py-3.5 text-sm text-ink-900 outline-none placeholder:text-ink-400"
              />
              <kbd className="rounded border border-ink-200 bg-ink-100 px-1.5 py-0.5 text-[10px] font-semibold text-ink-500">
                ESC
              </kbd>
            </div>
            <div className="max-h-[60vh] overflow-y-auto p-2">
              {quickResults.length > 0 ? (
                <div className="mb-2">
                  <p className="ec-admin-label px-2 py-1.5">Quick actions</p>
                  {quickResults.map((action) => (
                    <button
                      key={action.href}
                      type="button"
                      onClick={() => navigate(action.href)}
                      className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left hover:bg-ink-50"
                    >
                      <span className="grid h-7 w-7 place-items-center rounded-lg bg-brand-50 text-xs text-brand-700">
                        <AdminSectionIcon slug={action.href.split('/').pop() || ''} size={14} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{action.label}</span>
                        <span className="block text-[10px] text-ink-500">{action.hint}</span>
                      </span>
                      <span className="text-[10px] text-ink-400">↵</span>
                    </button>
                  ))}
                </div>
              ) : null}
              {paletteResults.length > 0 ? (
                <div>
                  <p className="ec-admin-label px-2 py-1.5">Sections</p>
                  {paletteResults.map((section) => (
                    <button
                      key={section.slug}
                      type="button"
                      onClick={() => navigate(adminSectionHref(section.slug))}
                      className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left hover:bg-ink-50"
                    >
                      <span className="grid h-7 w-7 place-items-center rounded-lg bg-ink-100 text-xs text-ink-700">
                        <AdminSectionIcon slug={section.slug} size={14} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{section.label}</span>
                        <span className="block truncate text-[10px] text-ink-500">{section.description}</span>
                      </span>
                      <span className="text-[10px] text-ink-400">{section.group}</span>
                    </button>
                  ))}
                </div>
              ) : null}
              {paletteResults.length === 0 && quickResults.length === 0 ? (
                <div className="py-8 text-center text-sm text-ink-500">No tool matches “{paletteQuery}”.</div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SidebarContent({
  collapsed,
  pathname,
  query,
  onQuery,
  sections,
  onCollapse,
  onNavigate,
  onSignOut,
  brand,
  logoText,
  email,
}: {
  collapsed: boolean;
  pathname: string | null;
  query: string;
  onQuery: (next: string) => void;
  sections: AdminSectionMeta[];
  onCollapse: (() => void) | null;
  onNavigate: () => void;
  onSignOut: () => void;
  brand: string;
  logoText: string;
  email: string;
}) {
  const grouped = ADMIN_GROUPS.map((group) => ({
    group,
    items: sections.filter((section) => section.group === group),
  })).filter((entry) => entry.items.length > 0);

  return (
    <>
      <div className={`px-3 pt-4 pb-3 flex items-center ${collapsed ? 'justify-center' : 'justify-between'} gap-2`}>
        <Link href="/admin" className="flex items-center gap-2.5 min-w-0" onClick={onNavigate}>
          <span
            className="h-9 w-9 shrink-0 rounded-xl grid place-items-center text-sm font-extrabold shadow-sm"
            style={{
              background: 'linear-gradient(135deg, var(--ec-brand), var(--ec-secondary))',
              color: 'var(--ec-on-brand)',
            }}
          >
            {logoText || 'EC'}
          </span>
          {!collapsed ? (
            <span className="min-w-0">
              <span className="block text-sm font-extrabold text-slate-900 truncate">{brand}</span>
              <span className="block text-[10px] font-bold uppercase tracking-[0.14em] text-brand-700">
                Admin Studio
              </span>
            </span>
          ) : null}
        </Link>
        {onCollapse && !collapsed ? (
          <button
            type="button"
            onClick={onCollapse}
            className="h-7 w-7 rounded-lg text-slate-500 hover:bg-slate-100 grid place-items-center text-xs"
            aria-label="Collapse sidebar"
            title="Collapse sidebar"
          >
            ⟪
          </button>
        ) : null}
      </div>

      {collapsed && onCollapse ? (
        <button
          type="button"
          onClick={onCollapse}
          className="mx-auto mb-2 h-7 w-7 rounded-lg text-slate-500 hover:bg-slate-100 grid place-items-center text-xs"
          aria-label="Expand sidebar"
          title="Expand sidebar"
        >
          ⟫
        </button>
      ) : null}

      {!collapsed ? (
        <div className="px-3 pb-2.5">
          <div className="relative">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs">⌕</span>
            <input
              value={query}
              onChange={(event) => onQuery(event.target.value)}
              placeholder="Search tools…"
              className="ec-field !py-2 !pl-7 text-xs"
            />
          </div>
        </div>
      ) : null}

      <nav className={`flex-1 overflow-y-auto pb-3 ${collapsed ? 'px-2' : 'px-2.5'} space-y-4`}>
        {grouped.map((group) => (
          <div key={group.group}>
            {!collapsed ? <p className="ec-admin-label px-2 mb-1.5">{group.group}</p> : null}
            <div className="space-y-0.5">
              {group.items.map((section) => {
                const active = isActive(pathname, section.slug);
                return (
                  <Link
                    key={section.slug}
                    href={adminSectionHref(section.slug)}
                    data-active={active}
                    title={collapsed ? section.label : section.description}
                    onClick={onNavigate}
                    className={`ec-admin-link ${collapsed ? 'justify-center px-0' : ''}`}
                  >
                    <span className="w-4 text-center shrink-0 grid place-items-center">
                      <AdminSectionIcon slug={section.slug} size={15} />
                    </span>
                    {!collapsed ? <span className="truncate">{section.label}</span> : null}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
        {grouped.length === 0 && !collapsed ? (
          <p className="text-xs text-slate-500 px-2 py-4 text-center">No tool matches this search.</p>
        ) : null}
      </nav>

      <div className={`border-t border-slate-100 p-3 space-y-1 ${collapsed ? 'text-center' : ''}`}>
        {!collapsed ? (
          <>
            <Link href="/home" target="_blank" className="ec-admin-link" onClick={onNavigate}>
              <span className="text-sm leading-none w-4 text-center">↗</span>
              <span>Open Student App</span>
            </Link>
            <button type="button" onClick={onSignOut} className="ec-admin-link w-full text-left">
              <span className="text-sm leading-none w-4 text-center">⏻</span>
              <span>Sign out</span>
            </button>
            <p className="text-[10px] text-slate-400 px-2 pt-1 truncate" title={email}>
              {email}
            </p>
          </>
        ) : (
          <Link href="/home" target="_blank" className="ec-admin-link justify-center px-0" title="Open Student App">
            ↗
          </Link>
        )}
      </div>
    </>
  );
}

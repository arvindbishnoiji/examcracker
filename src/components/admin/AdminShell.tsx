'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
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
  { label: 'Edit a student screen', href: '/admin/screens', hint: 'Screen Studio', icon: '▭' },
  { label: 'Create a banner', href: '/admin/banners', hint: 'Website settings', icon: '▰' },
  { label: 'Create an event', href: '/admin/events', hint: 'Communication', icon: '▦' },
  { label: 'Create a test', href: '/admin/tests', hint: 'Tests & performance', icon: '✎' },
  { label: 'Post an announcement', href: '/admin/announcements', hint: 'Communication', icon: '◔' },
  { label: 'Inspect student analytics', href: '/admin/analytics', hint: 'Tests & performance', icon: '▧' },
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
          <p className="text-sm text-ink-500 mt-3">Loading your control centre…</p>
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
            Sign in with the administrator account. Access is verified again by the Supabase Edge Function.
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
            You are signed in as <strong>{user.email}</strong>. The admin console is limited to the verified
            administrator. The API rejects non-admin tokens as well.
          </p>
          <div className="flex flex-wrap gap-2 justify-center mt-5">
            <Link href="/home" className="px-4 py-2.5 border border-ink-200 rounded-button text-sm font-semibold">
              Go to dashboard
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

  const sidebarWidth = collapsed ? 'w-[84px]' : 'w-[272px]';

  return (
    <div
      className={`min-h-screen ${compact ? 'text-[13px]' : ''}`}
      style={{ background: 'var(--ec-bg)' }}
      data-ec-admin-motion={reduceMotion ? 'reduced' : 'full'}
      data-ec-compact={compact ? 'true' : 'false'}
    >
      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/45 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="relative z-10 h-full w-[286px] ec-admin-sidebar border-r border-ink-100 overflow-y-auto">
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
      )}

      {/* Desktop sidebar */}
      <aside
        className={`hidden lg:flex fixed inset-y-0 left-0 z-40 ${sidebarWidth} transition-[width] duration-200 ec-admin-sidebar border-r border-ink-100 flex-col`}
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

      <div className={`${collapsed ? 'lg:pl-[84px]' : 'lg:pl-[272px]'} transition-[padding] duration-200`}>
        <header className="sticky top-0 z-30 border-b border-ink-100 bg-[var(--ec-surface)]/85 backdrop-blur-xl">
          <div className="h-14 px-3 sm:px-5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <button
                type="button"
                onClick={() => setMobileOpen(true)}
                className="lg:hidden h-9 w-9 rounded-xl border border-ink-200 grid place-items-center text-ink-600"
                aria-label="Open admin navigation"
              >
                ☰
              </button>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-500">
                  {activeSection?.group || 'Admin'}
                </p>
                <p className="text-sm font-bold truncate">{activeSection?.label || 'Control centre'}</p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2">
              <button
                type="button"
                onClick={() => setPaletteOpen(true)}
                className="hidden sm:flex items-center gap-2 h-9 px-3 rounded-xl border border-ink-200 bg-ink-50/60 text-xs text-ink-500 hover:bg-ink-50 min-w-[190px]"
              >
                <span>⌕</span>
                <span className="flex-1 text-left">Search admin…</span>
                <kbd className="text-[10px] font-semibold bg-[var(--ec-surface)] border border-ink-200 rounded px-1.5 py-0.5">
                  ⌘K
                </kbd>
              </button>
              <button
                type="button"
                onClick={() => setPaletteOpen(true)}
                className="sm:hidden h-9 w-9 rounded-xl border border-ink-200 grid place-items-center"
                aria-label="Search admin"
              >
                ⌕
              </button>
              <Link
                href="/home"
                target="_blank"
                className="h-9 px-2.5 hidden md:inline-flex items-center rounded-xl text-xs font-semibold border border-ink-200 hover:bg-ink-50"
              >
                View site ↗
              </Link>
              <div
                className="h-8 w-8 rounded-full bg-brand-600 text-white grid place-items-center text-xs font-bold"
                title={user.email || ''}
              >
                {(user.email || 'A').slice(0, 1).toUpperCase()}
              </div>
            </div>
          </div>
        </header>

        <main className="px-3 sm:px-5 lg:px-7 py-5 sm:py-7 max-w-[1560px] mx-auto">
          {isNestedPage && activeSection ? (
            <nav aria-label="Breadcrumb" className="mb-3 flex flex-wrap items-center gap-1 text-[11px] text-ink-500">
              <Link href="/admin" className="hover:text-ink-800">Admin</Link>
              <span aria-hidden>/</span>
              <Link href={adminSectionHref(activeSection.slug)} className="hover:text-ink-800">
                {activeSection.label}
              </Link>
            </nav>
          ) : null}
          {children}
        </main>
      </div>

      {/* Command palette */}
      {paletteOpen && (
        <div className="fixed inset-0 z-[100]">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setPaletteOpen(false)} />
          <div className="relative mx-auto mt-[8vh] w-[min(720px,94vw)] ec-card shadow-2xl overflow-hidden">
            <div className="flex items-center gap-2 px-4 border-b border-ink-100">
              <span className="text-ink-400">⌕</span>
              <input
                ref={paletteInputRef}
                value={paletteQuery}
                onChange={(event) => setPaletteQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') setPaletteOpen(false);
                  if (event.key === 'Enter') {
                    const target = paletteResults[0] ? adminSectionHref(paletteResults[0].slug) : quickResults[0]?.href;
                    if (target) navigate(target);
                  }
                }}
                placeholder="Search sections, settings and actions…"
                className="flex-1 bg-transparent border-0 py-4 text-sm outline-none text-ink-900 placeholder:text-ink-400"
              />
              <kbd className="text-[10px] font-semibold bg-ink-100 border border-ink-200 rounded px-1.5 py-0.5 text-ink-500">
                ESC
              </kbd>
            </div>
            <div className="max-h-[60vh] overflow-y-auto p-2">
              {quickResults.length > 0 && (
                <div className="mb-2">
                  <p className="ec-admin-label px-2 py-1.5">Quick actions</p>
                  {quickResults.map((action) => (
                    <button
                      key={action.href}
                      type="button"
                      onClick={() => navigate(action.href)}
                      className="w-full flex items-center gap-3 px-2.5 py-2 rounded-xl hover:bg-ink-50 text-left"
                    >
                      <span className="h-7 w-7 rounded-lg bg-brand-50 text-brand-700 grid place-items-center text-xs">
                        <AdminSectionIcon slug={action.href.split('/').pop() || ''} size={14} />
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-medium truncate">{action.label}</span>
                        <span className="block text-[10px] text-ink-500">{action.hint}</span>
                      </span>
                      <span className="text-[10px] text-ink-400">↵</span>
                    </button>
                  ))}
                </div>
              )}
              {paletteResults.length > 0 && (
                <div>
                  <p className="ec-admin-label px-2 py-1.5">Sections</p>
                  {paletteResults.map((section) => (
                    <button
                      key={section.slug}
                      type="button"
                      onClick={() => navigate(adminSectionHref(section.slug))}
                      className="w-full flex items-center gap-3 px-2.5 py-2 rounded-xl hover:bg-ink-50 text-left"
                    >
                      <span className="h-7 w-7 rounded-lg bg-ink-100 text-ink-700 grid place-items-center text-xs">
                        <AdminSectionIcon slug={section.slug} size={14} />
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-medium truncate">{section.label}</span>
                        <span className="block text-[10px] text-ink-500 truncate">{section.description}</span>
                      </span>
                      <span className="text-[10px] text-ink-400">{section.group}</span>
                    </button>
                  ))}
                </div>
              )}
              {paletteResults.length === 0 && quickResults.length === 0 && (
                <div className="text-center py-8 text-sm text-ink-500">
                  No section matches “{paletteQuery}”.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
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
          {!collapsed && (
            <span className="min-w-0">
              <span className="block text-sm font-bold truncate">{brand}</span>
              <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-500">
                Admin studio
              </span>
            </span>
          )}
        </Link>
        {onCollapse && !collapsed && (
          <button
            type="button"
            onClick={onCollapse}
            className="h-7 w-7 rounded-lg text-ink-500 hover:bg-ink-100 grid place-items-center text-xs"
            aria-label="Collapse sidebar"
            title="Collapse sidebar"
          >
            ⟪
          </button>
        )}
      </div>
      {collapsed && onCollapse && (
        <button
          type="button"
          onClick={onCollapse}
          className="mx-auto mb-2 h-7 w-7 rounded-lg text-ink-500 hover:bg-ink-100 grid place-items-center text-xs"
          aria-label="Expand sidebar"
          title="Expand sidebar"
        >
          ⟫
        </button>
      )}

      {!collapsed && (
        <div className="px-3 pb-2">
          <div className="relative">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-400 text-xs">⌕</span>
            <input
              value={query}
              onChange={(event) => onQuery(event.target.value)}
              placeholder="Filter navigation…"
              className="ec-field !py-2 !pl-7 text-xs"
            />
          </div>
        </div>
      )}

      <nav className={`flex-1 overflow-y-auto pb-3 ${collapsed ? 'px-2' : 'px-2.5'} space-y-3`}>
        {grouped.map((group) => (
          <div key={group.group}>
            {!collapsed && <p className="ec-admin-label px-2 mb-1">{group.group}</p>}
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
                    {!collapsed && <span className="truncate">{section.label}</span>}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
        {grouped.length === 0 && !collapsed && (
          <p className="text-xs text-ink-500 px-2 py-4 text-center">No section matches this filter.</p>
        )}
      </nav>

      <div className={`border-t border-ink-100 p-3 space-y-1 ${collapsed ? 'text-center' : ''}`}>
        {!collapsed ? (
          <>
            <Link
              href="/home"
              target="_blank"
              className="ec-admin-link"
              onClick={onNavigate}
            >
              <span className="text-sm leading-none w-4 text-center">↗</span>
              <span>View student site</span>
            </Link>
            <button type="button" onClick={onSignOut} className="ec-admin-link w-full text-left">
              <span className="text-sm leading-none w-4 text-center">⏻</span>
              <span>Sign out</span>
            </button>
            <p className="text-[10px] text-ink-400 px-2 pt-1 truncate" title={email}>
              {email}
            </p>
            <p className="text-[9px] text-ink-400 px-2">Admin console · v3</p>
          </>
        ) : (
          <Link href="/home" target="_blank" className="ec-admin-link justify-center px-0" title="View student site">
            ↗
          </Link>
        )}
      </div>
    </>
  );
}

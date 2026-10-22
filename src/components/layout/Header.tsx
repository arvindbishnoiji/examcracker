'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useSiteConfig } from '@/context/SiteConfigContext';
import { isActivePath, isRouteEnabled } from '@/lib/navigation';
import { formatClassLevel, isSafeHttpUrl } from '@/lib/validation';
import { NavIcon } from '@/components/ui/AppIcon';
import { Bell, LayoutDashboard, LogOut, Search } from 'lucide-react';
import { ProfileImage } from '@/components/student/ProfileImage';

/**
 * Floating navigation island (2026 pattern): the brand + links + actions live in
 * one glass bar that hovers over the page instead of a full-width band. The
 * announcement strip stays a separate, quieter line above it.
 */
export function Header({ showNav = true }: { showNav?: boolean }) {
  const { user, profile, signOut, isAdmin } = useAuth();
  const { config } = useSiteConfig();
  const { theme, navigation, features } = config;
  const pathname = usePathname();

  if (!showNav) return null;

  const headerLinks = navigation.headerLinks
    .filter((link) => link.visible && isRouteEnabled(link.href, features))
    .slice(0, 4);

  const logo = isSafeHttpUrl(theme.logoUrl) ? (
    <img src={theme.logoUrl} alt={theme.brandName} className="h-8 w-8 rounded-[11px] object-cover" />
  ) : (
    <span
      className="grid h-8 w-8 place-items-center rounded-[11px] text-[0.72rem] font-black text-white shadow-[0_10px_24px_-12px_rgba(76,29,149,0.9)]"
      style={{ background: 'var(--ec-grad-aurora)' }}
    >
      {theme.logoText || 'EC'}
    </span>
  );

  return (
    <>
      {navigation.announcementBarEnabled && navigation.announcementBarText && (
        <div className="text-[0.72rem] text-white" style={{ background: 'var(--ec-grad-aurora)' }}>
          <div className="ec-main flex items-center justify-center gap-2 !py-1.5 !pb-1.5 text-center">
            <span className="opacity-95">{navigation.announcementBarText}</span>
            {navigation.announcementBarHref && (
              <Link href={navigation.announcementBarHref} className="whitespace-nowrap font-bold underline">
                Learn more
              </Link>
            )}
          </div>
        </div>
      )}

      <div className={`z-40 px-3 pt-2.5 sm:px-4 ${theme.stickyHeader ? 'sticky top-0' : 'relative'}`}>
        <header className="ec-nav-island mx-auto flex h-[58px] w-full max-w-[1240px] items-center justify-between gap-2 px-2.5 sm:px-3">
          <Link
            href={user ? (profile ? '/home' : '/onboarding') : '/login'}
            className="flex min-w-0 items-center gap-2 rounded-full py-1 pl-1 pr-2 transition hover:bg-black/[0.04]"
            aria-label={theme.brandName}
          >
            {logo}
            <span className="flex min-w-0 flex-col leading-none">
              <span className="truncate text-[0.9rem] font-extrabold tracking-[-0.02em]">{theme.brandName}</span>
              {theme.tagline && (
                <span className="mt-0.5 hidden max-w-[190px] truncate text-[0.58rem] font-semibold uppercase tracking-[0.12em] text-ink-400 sm:block">
                  {theme.tagline}
                </span>
              )}
            </span>
          </Link>

          <nav className="hidden items-center gap-0.5 md:flex" aria-label="Primary">
            {user &&
              headerLinks.map((link) => (
                <Link
                  key={link.id}
                  href={link.href}
                  className="ec-nav-link inline-flex items-center gap-1.5"
                  data-active={isActivePath(pathname, link.href)}
                >
                  <NavIcon href={link.href} fallback={link.icon} size={14} className="opacity-80" />
                  {link.label}
                </Link>
              ))}
          </nav>

          <div className="flex items-center gap-1">
            {user && navigation.showSearch && features.search && (
              <Link
                href="/search"
                className="grid h-9 w-9 place-items-center rounded-full text-ink-500 transition hover:bg-black/5 hover:text-ink-800"
                aria-label="Search"
              >
                <Search size={17} />
              </Link>
            )}
            {user && features.notifications && (
              <Link
                href="/notifications"
                className="relative grid h-9 w-9 place-items-center rounded-full text-ink-500 transition hover:bg-black/5 hover:text-ink-800"
                aria-label="Notifications"
              >
                <Bell size={17} />
                <span className="absolute right-2 top-1.5 h-1.5 w-1.5 rounded-full bg-[var(--dx-lime)] ring-2 ring-[var(--ec-surface)]" />
              </Link>
            )}
            {user && (
              <Link href="/profile" className="ml-0.5 grid place-items-center rounded-full p-0.5 ring-1 ring-black/5" aria-label="Profile">
                <ProfileImage
                  src={profile?.avatar_url}
                  name={profile?.display_name || user.displayName || 'Student'}
                  className="h-8 w-8"
                  textClassName="text-[10px]"
                />
              </Link>
            )}
            {user && (
              <div className="ml-1 hidden items-center gap-1.5 border-l border-ink-100 pl-2 lg:flex">
                <div className="max-w-[150px] text-right">
                  <p className="truncate text-[0.76rem] font-bold leading-none">
                    {profile?.display_name || user.displayName || user.email}
                  </p>
                  <p className="mt-0.5 truncate text-[0.62rem] font-semibold text-ink-400">
                    {profile ? `${profile.exam} · ${formatClassLevel(profile.class_level)}` : user.email}
                  </p>
                </div>
                {isAdmin && (
                  <Link href="/admin" className="ec-nav-cta">
                    <LayoutDashboard size={13} /> Admin
                  </Link>
                )}
                <button
                  type="button"
                  onClick={signOut}
                  className="grid h-9 w-9 place-items-center rounded-full text-ink-400 transition hover:bg-black/5 hover:text-ink-800"
                  aria-label="Sign out"
                >
                  <LogOut size={16} />
                </button>
              </div>
            )}
            {user && isAdmin && (
              <Link href="/admin" className="ec-nav-cta lg:hidden">
                Admin
              </Link>
            )}
            {!user && (
              <Link href="/login" className="ec-nav-cta">
                Sign in
              </Link>
            )}
          </div>
        </header>
      </div>
    </>
  );
}

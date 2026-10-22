'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useSiteConfig } from '@/context/SiteConfigContext';
import { Button } from '@/components/ui/Button';
import { isActivePath, isRouteEnabled } from '@/lib/navigation';
import { formatClassLevel, isSafeHttpUrl } from '@/lib/validation';
import { NavIcon } from '@/components/ui/AppIcon';
import { Bell, LogOut, Search } from 'lucide-react';
import { ProfileImage } from '@/components/student/ProfileImage';

export function Header({ showNav = true }: { showNav?: boolean }) {
  const { user, profile, signOut, isAdmin } = useAuth();
  const { config } = useSiteConfig();
  const { theme, navigation, features } = config;
  const pathname = usePathname();

  if (!showNav) return null;

  const headerLinks = navigation.headerLinks.filter(
    (link) => link.visible && isRouteEnabled(link.href, features)
  );
  const logo = isSafeHttpUrl(theme.logoUrl) ? (
    <img src={theme.logoUrl} alt={theme.brandName} className="h-8 w-8 rounded-xl object-cover" />
  ) : (
    <span
      className="grid h-9 w-9 place-items-center rounded-[14px] text-[0.82rem] font-black text-white shadow-[0_10px_24px_-12px_rgba(76,29,149,0.9)]"
      style={{ background: 'var(--ec-grad-aurora)' }}
    >
      {theme.logoText || 'EC'}
    </span>
  );

  return (
    <>
      {navigation.announcementBarEnabled && navigation.announcementBarText && (
        <div className="text-white text-xs sm:text-sm" style={{ background: 'var(--ec-grad-aurora)' }}>
          <div className="ec-main !py-2 !pb-2 flex items-center justify-center gap-2 text-center">
            <span className="opacity-95">{navigation.announcementBarText}</span>
            {navigation.announcementBarHref && (
              <Link href={navigation.announcementBarHref} className="underline font-semibold whitespace-nowrap">
                Learn more
              </Link>
            )}
          </div>
        </div>
      )}
      <header
        className={`ec-header z-40 border-b ${theme.stickyHeader ? 'sticky top-0' : 'relative'} ${
          theme.headerStyle === 'dark' ? 'border-transparent' : ''
        }`}
      >
        <div className="ec-main !py-0 !pb-0 flex items-center justify-between h-14 sm:h-16 gap-3">
          <Link
            href={user ? (profile ? '/home' : '/onboarding') : '/login'}
            className="flex items-center gap-2 min-w-0"
            aria-label={theme.brandName}
          >
            {logo}
            <span className="font-bold truncate">{theme.brandName}</span>
            {theme.tagline && (
              <span className="hidden lg:inline text-xs bg-brand-50 text-brand-700 px-2 py-0.5 rounded-full border border-brand-100 max-w-[220px] truncate">
                {theme.tagline}
              </span>
            )}
          </Link>

          <div className="flex items-center gap-1 sm:gap-1.5">
            {user && navigation.showSearch && features.search && (
              <Link
                href="/search"
                className="p-2 rounded-xl text-current opacity-80 hover:bg-black/5"
                aria-label="Search"
              >
                <Search size={19} />
              </Link>
            )}
            {user &&
              headerLinks.map((link) => (
                <Link
                  key={link.id}
                  href={link.href}
                  className="ec-nav-link hidden md:inline-flex items-center gap-1.5"
                  data-active={isActivePath(pathname, link.href)}
                >
                  <NavIcon href={link.href} fallback={link.icon} size={15} className="opacity-80" />
                  {link.label}
                </Link>
              ))}
            {user && features.notifications && (
              <Link
                href="/notifications"
                className={`relative p-2 rounded-xl text-current opacity-75 hover:bg-black/5 ${
                  isActivePath(pathname, '/notifications') ? 'bg-black/5' : ''
                }`}
                aria-label="Notifications"
              >
                <Bell size={19} />
              </Link>
            )}
            {user && (
              <Link
                href="/profile"
                className={`p-2 rounded-xl text-current opacity-75 hover:bg-black/5 ${
                  isActivePath(pathname, '/profile') ? 'bg-black/5' : ''
                }`}
                aria-label="Profile"
              >
                <ProfileImage
                  src={profile?.avatar_url}
                  name={profile?.display_name || user.displayName || 'Student'}
                  className="h-8 w-8 border border-white/70 shadow-sm"
                  textClassName="text-[10px]"
                />
              </Link>
            )}
            {user && (
              <div className="hidden lg:flex items-center gap-2 pl-2 border-l border-ink-100/70">
                <div className="text-right max-w-[170px]">
                  <p className="text-sm font-semibold leading-none truncate">
                    {profile?.display_name || user.displayName || user.email}
                  </p>
                  <p className="text-[11px] text-current opacity-70 truncate">
                    {profile ? `${profile.exam} • ${formatClassLevel(profile.class_level)}` : user.email}
                  </p>
                </div>
                {isAdmin && (
                  <Link
                    href="/admin"
                    className="px-2.5 py-1.5 bg-ink-900 text-white text-[11px] font-semibold rounded-full whitespace-nowrap"
                  >
                    Admin
                  </Link>
                )}
                <Button variant="ghost" size="sm" onClick={signOut} className="text-current" aria-label="Sign out">
                  <LogOut size={14} className="mr-1.5" /> Sign out
                </Button>
              </div>
            )}
            {user && (
              <div className="lg:hidden flex items-center gap-1">
                {isAdmin && (
                  <Link href="/admin" className="px-2.5 py-1.5 bg-ink-900 text-white text-[11px] rounded-full">
                    Admin
                  </Link>
                )}
              </div>
            )}
            {!user && (
              <Link
                href="/login"
                className="px-4 py-2 bg-brand-600 text-white text-sm font-semibold rounded-button"
              >
                Sign in
              </Link>
            )}
          </div>
        </div>
      </header>
    </>
  );
}

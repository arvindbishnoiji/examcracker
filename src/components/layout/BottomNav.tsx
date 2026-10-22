'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useSiteConfig } from '@/context/SiteConfigContext';
import { isActivePath, isRouteEnabled } from '@/lib/navigation';
import { NavIcon } from '@/components/ui/AppIcon';
import { Settings2 } from 'lucide-react';
import { identityGradient, pageIdentity, pageKeyFromPath } from '@/lib/page-identity';

export function BottomNav() {
  const pathname = usePathname();
  const { isAdmin } = useAuth();
  const { config } = useSiteConfig();

  if (
    pathname?.startsWith('/admin') ||
    pathname === '/login' ||
    pathname === '/onboarding' ||
    pathname === '/'
  ) {
    return null;
  }
  if (!config.theme.showBottomNav || !config.features.bottomNav) return null;

  const items = config.navigation.bottomLinks.filter(
    (item) => item.visible && isRouteEnabled(item.href, config.features)
  );

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-30 border-t border-ink-100 md:hidden ec-fade-in"
      style={{ background: 'var(--ec-nav-bg)', backdropFilter: 'blur(18px)' }}
    >
      <div className="flex items-center justify-between gap-0.5 px-1.5 py-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
        {items.map((item) => {
          const active = isActivePath(pathname, item.href);
          const targetKey = pageKeyFromPath(item.href);
          const identity = targetKey ? pageIdentity(targetKey) : null;
          return (
            <Link
              key={item.id}
              href={item.href}
              className={`relative flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-2xl px-1 py-1.5 transition ${
                active ? 'text-white shadow-[0_10px_22px_-12px_rgba(15,10,40,0.9)]' : 'text-ink-500 hover:text-ink-700'
              }`}
              style={active && identity ? { background: identityGradient(identity) } : undefined}
            >
              <NavIcon href={item.href} fallback={item.icon} size={19} strokeWidth={active ? 2.4 : 1.9} />
              <span className={`max-w-[68px] truncate text-[0.68rem] ${active ? 'font-extrabold' : 'font-medium'}`}>{item.label}</span>
            </Link>
          );
        })}
        {isAdmin && (
          <Link
            href="/admin"
            className={`flex min-w-0 flex-1 flex-col items-center gap-0.5 px-1 py-1 rounded-xl ${
              pathname?.startsWith('/admin') ? 'text-brand-600 bg-brand-50' : 'text-ink-500'
            }`}
          >
            <Settings2 size={19} strokeWidth={pathname?.startsWith('/admin') ? 2.4 : 1.9} />
            <span className="text-[10.5px] font-medium">Admin</span>
          </Link>
        )}
      </div>
    </nav>
  );
}

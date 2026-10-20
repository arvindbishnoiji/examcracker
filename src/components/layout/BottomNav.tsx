'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

const items = [
  { href: '/home', label: 'Home', icon: '🏠' },
  { href: '/lectures', label: 'Lectures', icon: '▶️' },
  { href: '/tests', label: 'Tests', icon: '📝' },
  { href: '/leaderboard', label: 'Board', icon: '🏆' },
  { href: '/profile', label: 'Profile', icon: '👤' },
];

export function BottomNav(){
  const pathname = usePathname();
  const { isAdmin } = useAuth();
  // hide on admin and auth pages
  if(pathname?.startsWith('/admin') || pathname === '/login' || pathname === '/onboarding' || pathname === '/') return null;
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-ink-100 md:hidden">
      <div className="flex items-center justify-around px-2 py-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
        {items.map(i=>{
          const active = pathname === i.href || (i.href !== '/home' && pathname?.startsWith(i.href));
          return (
            <Link key={i.href} href={i.href} className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl ${active?'text-brand-600 bg-brand-50':'text-ink-500'}`}>
              <span className="text-[18px] leading-none">{i.icon}</span>
              <span className="text-[11px] font-medium">{i.label}</span>
            </Link>
          );
        })}
        {isAdmin && (
          <Link href="/admin" className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl ${pathname?.startsWith('/admin')?'text-brand-600 bg-brand-50':'text-ink-500'}`}>
            <span className="text-[18px] leading-none">⚙️</span>
            <span className="text-[11px] font-medium">Admin</span>
          </Link>
        )}
      </div>
    </nav>
  );
}

import Link from 'next/link';
import { Compass, Home, LogIn } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-4 py-16 text-center">
      <span className="grid h-14 w-14 place-items-center rounded-2xl bg-brand-50 text-brand-700">
        <Compass size={26} />
      </span>
      <p className="ec-eyebrow mt-4">404 · Off the syllabus</p>
      <h1 className="mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl">We could not find that page</h1>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-ink-500">
        The link may be outdated, or this page is private to a course you are not enrolled in. Check the address or head
        back to your dashboard.
      </p>
      <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
        <Link
          href="/home"
          className="ec-btn inline-flex items-center gap-1.5 bg-brand-600 px-4 py-2.5 text-sm font-bold text-white"
        >
          <Home size={15} /> Go to dashboard
        </Link>
        <Link
          href="/login"
          className="ec-btn inline-flex items-center gap-1.5 border border-ink-200 bg-[var(--ec-surface)] px-4 py-2.5 text-sm font-semibold"
        >
          <LogIn size={15} /> Sign in
        </Link>
      </div>
    </div>
  );
}

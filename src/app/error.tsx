'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Log only the digest-level message; never surface stack traces or tokens.
    console.error('[ExamCracker] Unhandled page error', error.digest || error.message);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-4 py-16 text-center">
      <span className="grid h-14 w-14 place-items-center rounded-2xl bg-amber-50 text-amber-700">
        <AlertTriangle size={26} />
      </span>
      <p className="ec-eyebrow mt-4">Something broke</p>
      <h1 className="mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl">This screen could not load</h1>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-ink-500">
        Your data is safe. Retry the screen — if it keeps failing, sign out and back in, then contact your mentor.
      </p>
      <button
        type="button"
        onClick={reset}
        className="ec-btn mt-5 inline-flex items-center gap-1.5 bg-brand-600 px-4 py-2.5 text-sm font-bold text-white"
      >
        <RefreshCw size={15} /> Try again
      </button>
    </div>
  );
}

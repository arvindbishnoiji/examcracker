'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { NoticePopup } from '@/types';
import { markPopupSeen, pickPopupForPlacement, type PopupPlacementContext, type StudentAudience } from '@/lib/site-config';
import { isSafeHttpUrl, isValidInternalDeepLink } from '@/lib/validation';
import { useSiteConfig } from '@/context/SiteConfigContext';

/**
 * Renders the single highest-priority eligible popup for a placement.
 * Eligibility uses real schedule, audience and browser frequency rules.
 * Dismissal is recorded locally — no analytics are invented.
 */
export function PopupHost({
  placement,
  student,
}: {
  placement: PopupPlacementContext;
  student: StudentAudience | null;
}) {
  const { config } = useSiteConfig();
  const [popup, setPopup] = useState<NoticePopup | null>(null);

  const studentExam = student?.exam || null;
  const studentClass = student?.classLevel || null;

  useEffect(() => {
    if (!config.features.popups) {
      setPopup(null);
      return;
    }
    const storage = typeof window !== 'undefined' ? window.localStorage : null;
    const audience = studentExam || studentClass ? { exam: studentExam, classLevel: studentClass } : null;
    setPopup(pickPopupForPlacement(config.popups, audience, placement, storage));
  }, [config.popups, config.features.popups, placement, studentExam, studentClass]);

  if (!popup) return null;

  function close() {
    if (popup) {
      if (typeof window !== 'undefined') markPopupSeen(popup, window.localStorage);
      setPopup(null);
    }
  }

  const ctaValid = isValidInternalDeepLink(popup.ctaHref) || isSafeHttpUrl(popup.ctaHref);

  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-3 sm:p-6" role="dialog" aria-modal="true" aria-label={popup.title}>
      <button type="button" aria-label="Close popup" onClick={close} className="absolute inset-0 bg-ink-900/50 backdrop-blur-[2px]" />
      <div className="relative w-full max-w-md rounded-[var(--ec-radius)] bg-[var(--ec-surface)] shadow-2xl overflow-hidden">
        {isSafeHttpUrl(popup.imageUrl) && (
          <img src={popup.imageUrl} alt="" className="w-full h-36 object-cover" loading="lazy" />
        )}
        <div className="p-5">
          {popup.dismissible && (
            <button type="button" onClick={close} className="absolute top-3 right-3 h-8 w-8 rounded-full bg-ink-900/60 text-white text-sm grid place-items-center" aria-label="Dismiss">
              ✕
            </button>
          )}
          <p className="text-base font-extrabold leading-tight pr-8">{popup.title}</p>
          <p className="text-sm text-ink-600 mt-2 whitespace-pre-line">{popup.body}</p>
          <div className="mt-4 flex items-center gap-2">
            {popup.ctaLabel && ctaValid && (
              isValidInternalDeepLink(popup.ctaHref) ? (
                <Link href={popup.ctaHref} onClick={close} className="ec-btn px-4 py-2 text-sm font-bold bg-[var(--ec-brand)] text-[var(--ec-on-brand)]">
                  {popup.ctaLabel}
                </Link>
              ) : (
                <a href={popup.ctaHref} target="_blank" rel="noopener noreferrer" onClick={close} className="ec-btn px-4 py-2 text-sm font-bold bg-[var(--ec-brand)] text-[var(--ec-on-brand)]">
                  {popup.ctaLabel}
                </a>
              )
            )}
            <button type="button" onClick={close} className="ec-btn px-4 py-2 text-sm font-semibold border border-ink-200">
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

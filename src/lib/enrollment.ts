import type { CourseCatalogItem, Enrollment } from '@/types';

/**
 * UI-facing enrollment helpers. The authoritative eligibility, paid-access and
 * expiry rules live in `src/lib/enrollment-core.ts` and in the Worker; the
 * server re-checks every enrollment. These helpers only render labels/status.
 */

export function isPaidCourse(item: Pick<CourseCatalogItem, 'metadata'>): boolean {
  const meta = (item.metadata || {}) as Record<string, unknown>;
  if (meta.isFree === true) return false;
  if (meta.paid === true || meta.requiresPayment === true) return true;
  const price = Number(meta.price ?? meta.amount ?? meta.fee ?? 0);
  if (Number.isFinite(price) && price > 0) return true;
  return meta.isFree === false;
}

export function coursePriceLabel(item: Pick<CourseCatalogItem, 'metadata'>): string {
  if (!isPaidCourse(item)) return 'Free';
  const meta = (item.metadata || {}) as Record<string, unknown>;
  const amount = Number(meta.price ?? meta.amount ?? meta.fee ?? 0);
  const currency = String(meta.currency || 'INR').toUpperCase();
  if (Number.isFinite(amount) && amount > 0) {
    return `${currency === 'INR' ? '₹' : `${currency} `}${amount.toLocaleString('en-IN')}`;
  }
  return 'Paid';
}

export function enrollmentIsCurrent(row: Pick<Enrollment, 'active' | 'status' | 'expires_at'>, now = Date.now()): boolean {
  if (!row.active) return false;
  if (row.status && row.status !== 'active') return false;
  if (row.expires_at) {
    const expires = new Date(row.expires_at).getTime();
    if (Number.isFinite(expires) && expires <= now) return false;
  }
  return true;
}

export function activeEnrollmentKeys(enrollments: Enrollment[] | undefined, now = Date.now()): Set<string> {
  const keys = new Set<string>();
  for (const row of enrollments || []) {
    if (!row.item_type || !row.item_id) continue;
    if (!enrollmentIsCurrent(row, now)) continue;
    keys.add(`${row.item_type}:${row.item_id}`);
  }
  return keys;
}

export function accessLabelForCourse(item: CourseCatalogItem): string {
  if (item.hasAccessCode) return 'Access code';
  return isPaidCourse(item) ? coursePriceLabel(item) : 'Free';
}

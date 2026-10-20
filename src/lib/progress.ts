/**
 * Real-activity helpers used by the student dashboard.
 * Everything here is derived from rows the server actually returned; the UI
 * must never fabricate streaks, ranks or progress.
 */

const IST = 'Asia/Kolkata';

export function dateKeyInZone(value: string | number | Date, timeZone = IST): string | null {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);
    const year = parts.find((part) => part.type === 'year')?.value;
    const month = parts.find((part) => part.type === 'month')?.value;
    const day = parts.find((part) => part.type === 'day')?.value;
    if (!year || !month || !day) return null;
    return `${year}-${month}-${day}`;
  } catch {
    return null;
  }
}

function shiftDay(key: string, delta: number): string {
  const [year, month, day] = key.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
}

/**
 * Counts consecutive days of genuine activity ending today (or yesterday, so a
 * streak is not shown as broken before the student has started today's work).
 * Dates must come from real attempt/submission timestamps.
 */
export function activityStreak(
  timestamps: Array<string | number | Date | null | undefined>,
  now: Date | number = new Date(),
  timeZone = IST
): number {
  const days = new Set<string>();
  for (const timestamp of timestamps) {
    if (timestamp === null || timestamp === undefined) continue;
    const key = dateKeyInZone(timestamp, timeZone);
    if (key) days.add(key);
  }
  if (!days.size) return 0;
  const today = dateKeyInZone(typeof now === 'number' ? now : now, timeZone);
  if (!today) return 0;
  let cursor = days.has(today) ? today : shiftDay(today, -1);
  let streak = 0;
  while (days.has(cursor)) {
    streak += 1;
    cursor = shiftDay(cursor, -1);
  }
  return streak;
}

export function sumWatchedMinutes(rows: Array<{ watched_seconds?: number | null }>): number {
  return Math.round(rows.reduce((total, row) => total + Number(row.watched_seconds || 0), 0) / 60);
}

export function percent(value: number, max: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(max) || max <= 0) return 0;
  return Math.round((value / max) * 100);
}

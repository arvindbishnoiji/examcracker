import { describe, expect, it } from 'vitest';
import { activityStreak, dateKeyInZone, percent, sumWatchedMinutes } from '@/lib/progress';

const now = new Date('2026-10-20T12:00:00+05:30'); // 2026-10-20 in IST

describe('real activity streak', () => {
  it('formats dates in IST, not the host timezone', () => {
    expect(dateKeyInZone('2026-10-19T20:30:00Z')).toBe('2026-10-20');
    expect(dateKeyInZone('2026-10-19T18:29:00Z')).toBe('2026-10-19');
    expect(dateKeyInZone('not-a-date')).toBeNull();
  });

  it('counts consecutive days ending today', () => {
    expect(
      activityStreak(
        [
          '2026-10-20T04:00:00Z',
          '2026-10-19T05:00:00Z',
          '2026-10-18T08:00:00Z',
          '2026-10-16T08:00:00Z',
        ],
        now
      )
    ).toBe(3);
  });

  it('keeps yesterday’s streak alive before activity starts today', () => {
    expect(activityStreak(['2026-10-19T05:00:00Z', '2026-10-18T05:00:00Z'], now)).toBe(2);
  });

  it('returns zero for no activity or a stale gap', () => {
    expect(activityStreak([], now)).toBe(0);
    expect(activityStreak([null, undefined, 'bad'], now)).toBe(0);
    expect(activityStreak(['2026-10-17T05:00:00Z'], now)).toBe(0);
  });

  it('does not count future dates as today', () => {
    expect(activityStreak(['2026-10-25T05:00:00Z'], now)).toBe(0);
  });
});

describe('honest dashboard metrics', () => {
  it('sums watch minutes and never divides by zero', () => {
    expect(sumWatchedMinutes([{ watched_seconds: 600 }, { watched_seconds: 300 }, {}])).toBe(15);
    expect(percent(0, 0)).toBe(0);
    expect(percent(30, 120)).toBe(25);
  });
});

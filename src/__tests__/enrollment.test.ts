import { describe, expect, it } from 'vitest';
import {
  BULK_CHUNK_SIZE,
  chunkArray,
  classMatchesItem,
  classListOf,
  enrollmentIsActive,
  enrolledItemKeys,
  examMatchesItem,
  isEligibleForItem,
  isPaidItem,
  normalizeStudentUids,
  parseBulkEnrollInput,
  priceLabel,
  resolveAudience,
  summarizeBulkResults,
  type StudentLike,
} from '../../supabase/functions/_shared/enrollment-core';

const item = {
  id: '11111111-1111-4111-8111-111111111111',
  kind: 'batch',
  title: 'JEE 2027 Dropper Batch',
  exam: 'JEE',
  classes: ['11', '12'],
  active: true,
  metadata: {},
};

const students: StudentLike[] = [
  { firebase_uid: 'u-jee-11', display_name: 'Aarav', exam: 'JEE', class_level: '11' },
  { firebase_uid: 'u-jee-12', display_name: 'Diya', exam: 'JEE', class_level: '12' },
  { firebase_uid: 'u-neet-11', display_name: 'Kabir', exam: 'NEET', class_level: '11' },
  { firebase_uid: 'u-neet-12', display_name: 'Meera', exam: 'NEET', class_level: '12' },
];

describe('enrollment eligibility', () => {
  it('matches JEE/NEET tracks and treats Both as a wildcard', () => {
    expect(examMatchesItem('JEE', 'JEE')).toBe(true);
    expect(examMatchesItem('JEE', 'NEET')).toBe(false);
    expect(examMatchesItem('Both', 'NEET')).toBe(true);
    expect(examMatchesItem('Both', '')).toBe(false);
  });

  it('matches classes only when the item explicitly includes them', () => {
    expect(classMatchesItem(['11'], '11')).toBe(true);
    expect(classMatchesItem(['11'], '12')).toBe(false);
    expect(classMatchesItem([], '11')).toBe(false);
    expect(classMatchesItem('11', '11')).toBe(false);
    expect(classListOf(['11', '12', 'bogus'])).toEqual(['11', '12']);
  });

  it('rejects a NEET student from a JEE-only batch and a class 12 student from a class 11 batch', () => {
    expect(isEligibleForItem(item, students[0])).toBe(true);
    expect(isEligibleForItem(item, students[2])).toBe(false);
    expect(isEligibleForItem({ ...item, classes: ['11'] }, students[1])).toBe(false);
    expect(isEligibleForItem({ ...item, exam: 'Both', classes: ['12'] }, students[3])).toBe(true);
  });
});

describe('paid content detection', () => {
  it('treats explicit free metadata as free and numeric prices as paid', () => {
    expect(isPaidItem({ ...item, metadata: { isFree: true, price: 499 } })).toBe(false);
    expect(isPaidItem({ ...item, metadata: { price: 499 } })).toBe(true);
    expect(isPaidItem({ ...item, metadata: { isFree: false } })).toBe(true);
    expect(isPaidItem({ ...item, metadata: { price: '0' } })).toBe(false);
    expect(priceLabel({ ...item, metadata: { price: 499 } })).toBe('₹499');
    expect(priceLabel(item)).toBe('Free');
  });
});

describe('bulk enrollment request validation', () => {
  const base = {
    itemType: 'batch',
    itemId: item.id,
    mode: 'selected',
    studentUids: ['u-jee-11'],
  };

  it('accepts a minimal selected-student request', () => {
    const parsed = parseBulkEnrollInput(base);
    expect(parsed.ok).toBe(true);
    expect(parsed.value?.respectEligibility).toBe(true);
    expect(parsed.value?.includeFuture).toBe(false);
    expect(parsed.value?.expiresAt).toBeNull();
  });

  it('rejects invalid item types, ids and empty selections', () => {
    expect(parseBulkEnrollInput({ ...base, itemType: 'lecture' }).ok).toBe(false);
    expect(parseBulkEnrollInput({ ...base, itemId: 'not-a-uuid' }).ok).toBe(false);
    expect(parseBulkEnrollInput({ ...base, studentUids: [] }).ok).toBe(false);
    expect(parseBulkEnrollInput({ ...base, mode: 'everyone' }).ok).toBe(false);
  });

  it('rejects future auto-enrollment for a hand-picked student list', () => {
    const parsed = parseBulkEnrollInput({ ...base, includeFuture: true });
    expect(parsed.ok).toBe(false);
    expect(parsed.error).toContain('Future students');
  });

  it('requires a filter when the audience mode is filter', () => {
    expect(parseBulkEnrollInput({ ...base, mode: 'filter' }).ok).toBe(false);
    expect(parseBulkEnrollInput({ ...base, mode: 'filter', exam: 'JEE' }).ok).toBe(true);
  });

  it('rejects an expiry date in the past and accepts a future one', () => {
    expect(parseBulkEnrollInput({ ...base, expiresAt: '2020-01-01T00:00:00Z' }).ok).toBe(false);
    const future = new Date(Date.now() + 86400000 * 30).toISOString();
    const parsed = parseBulkEnrollInput({ ...base, expiresAt: future });
    expect(parsed.ok).toBe(true);
    expect(parsed.value?.expiresAt).toBe(future);
  });

  it('deduplicates student ids and caps the size of the list', () => {
    expect(normalizeStudentUids(['a', 'a', 'b', '', null, 3])).toEqual(['a', 'b', '3']);
    const tooMany = Array.from({ length: 5001 }, (_, index) => `u-${index}`);
    expect(parseBulkEnrollInput({ ...base, studentUids: tooMany }).ok).toBe(false);
  });
});

describe('audience resolution', () => {
  it('enrolls only eligible students and reports the rest as skipped', () => {
    const plan = resolveAudience(
      {
        mode: 'selected',
        studentUids: ['u-jee-11', 'u-neet-11', 'missing-uid'],
        exam: '',
        classLevel: '',
        respectEligibility: true,
        includeFuture: false,
        confirmAll: false,
      },
      students,
      item
    );
    expect(plan.eligible.map((row) => row.firebase_uid)).toEqual(['u-jee-11']);
    expect(plan.skipped).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ uid: 'u-neet-11', reason: 'ineligible_exam' }),
        expect.objectContaining({ uid: 'missing-uid', reason: 'not_found' }),
      ])
    );
    expect(plan.scope.requiresConfirmation).toBe(false);
    expect(plan.scope.eligible).toBe(1);
  });

  it('supports “all eligible students” without touching other tracks', () => {
    const plan = resolveAudience(
      {
        mode: 'all',
        studentUids: [],
        exam: '',
        classLevel: '',
        respectEligibility: true,
        includeFuture: false,
        confirmAll: false,
      },
      students,
      item
    );
    expect(plan.eligible.map((row) => row.firebase_uid)).toEqual(['u-jee-11', 'u-jee-12']);
    expect(plan.scope.label).toContain('All exams');
    expect(plan.scope.requiresConfirmation).toBe(false);
  });

  it('supports a filtered audience by exam and class', () => {
    const plan = resolveAudience(
      {
        mode: 'filter',
        studentUids: [],
        exam: 'NEET',
        classLevel: '12',
        respectEligibility: true,
        includeFuture: true,
        confirmAll: false,
      },
      students,
      { ...item, exam: 'Both' }
    );
    expect(plan.eligible.map((row) => row.firebase_uid)).toEqual(['u-neet-12']);
    expect(plan.scope.includeFuture).toBe(true);
  });

  it('requires explicit confirmation when eligibility is overridden for a wide audience', () => {
    const plan = resolveAudience(
      {
        mode: 'all',
        studentUids: [],
        exam: '',
        classLevel: '',
        respectEligibility: false,
        includeFuture: false,
        confirmAll: false,
      },
      students,
      item
    );
    expect(plan.eligible).toHaveLength(4);
    expect(plan.scope.requiresConfirmation).toBe(true);
    expect(plan.scope.crossTrack).toBe(true);
  });

  it('does not require wide-scope confirmation for a hand-picked override', () => {
    const plan = resolveAudience(
      {
        mode: 'selected',
        studentUids: ['u-neet-12'],
        exam: '',
        classLevel: '',
        respectEligibility: false,
        includeFuture: false,
        confirmAll: false,
      },
      students,
      item
    );
    expect(plan.eligible).toHaveLength(1);
    expect(plan.scope.requiresConfirmation).toBe(false);
  });
});

describe('enrollment status and access', () => {
  const now = new Date('2026-10-20T10:00:00Z').getTime();

  it('honours revoked status, flags and expiry dates', () => {
    expect(enrollmentIsActive({ active: true, status: 'active' }, now)).toBe(true);
    expect(enrollmentIsActive({ active: false, status: 'active' }, now)).toBe(false);
    expect(enrollmentIsActive({ active: true, status: 'revoked' }, now)).toBe(false);
    expect(enrollmentIsActive({ active: true, status: 'active', revoked_at: '2026-01-01T00:00:00Z' }, now)).toBe(false);
    expect(enrollmentIsActive({ active: true, status: 'active', expires_at: '2026-10-21T00:00:00Z' }, now)).toBe(true);
    expect(enrollmentIsActive({ active: true, status: 'active', expires_at: '2026-10-19T00:00:00Z' }, now)).toBe(false);
  });

  it('builds the set of course keys the student can open', () => {
    const keys = enrolledItemKeys(
      [
        { item_type: 'batch', item_id: 'a', active: true, status: 'active' },
        { item_type: 'series', item_id: 'b', active: true, status: 'revoked' },
        { item_type: 'series', item_id: 'c', active: true, status: 'active', expires_at: '2026-01-01T00:00:00Z' },
      ],
      now
    );
    expect(Array.from(keys)).toEqual(['batch:a']);
  });
});

describe('batch processing helpers', () => {
  it('chunks students without dropping or duplicating any', () => {
    const list = Array.from({ length: 123 }, (_, index) => index);
    const chunks = chunkArray(list, BULK_CHUNK_SIZE);
    expect(chunks).toHaveLength(3);
    expect(chunks.flat()).toEqual(list);
    expect(chunks[0]).toHaveLength(BULK_CHUNK_SIZE);
  });

  it('summarises bulk results so the admin can see real counts', () => {
    const summary = summarizeBulkResults({
      targeted: 100,
      eligible: 84,
      skipped: 16,
      created: 60,
      reactivated: 10,
      alreadyActive: 12,
      failed: 2,
      ruleSaved: true,
    });
    expect(summary).toEqual({
      targeted: 100,
      eligible: 84,
      skipped: 16,
      created: 60,
      reactivated: 10,
      alreadyActive: 12,
      failed: 2,
      ruleSaved: true,
    });
  });
});

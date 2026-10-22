import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleApiRequest } from '../../workers/ec-api/src/index.js';
import { onRequest as onPagesApiRequest } from '../../cloudflare-pages/pages-api-entry.mjs';
import { buildSubjectQueue } from '../lib/lecture-queue';
import { classMatchesItem, isEligibleForItem } from '../lib/enrollment-core';
import type { CourseCatalogItem } from '../types';

interface SqliteStatement {
  all: (...args: unknown[]) => Row[];
  get: (...args: unknown[]) => Row | undefined;
  run: (...args: unknown[]) => unknown;
}
interface SqliteDb {
  exec: (sql: string) => void;
  prepare: (sql: string) => SqliteStatement;
}
type Row = Record<string, unknown>;

const nodeRequire = createRequire(import.meta.url);
const { DatabaseSync } = nodeRequire('node:sqlite') as {
  DatabaseSync: new (path: string) => SqliteDb;
};

function migration(name: string): string {
  return readFileSync(resolve(process.cwd(), 'migrations', name), 'utf8');
}

function d1(db: SqliteDb) {
  return {
    prepare(sql: string) {
      let params: unknown[] = [];
      const api = {
        bind(...values: unknown[]) {
          params = values;
          return api;
        },
        async all() {
          return { success: true, results: db.prepare(sql).all(...params) };
        },
        async first() {
          return db.prepare(sql).get(...params) ?? null;
        },
        async run() {
          db.prepare(sql).run(...params);
          return { success: true, meta: { changes: 1 } };
        },
      };
      return api;
    },
    async batch(statements: Array<{ run: () => Promise<unknown> }>) {
      const results = [];
      for (const statement of statements) results.push(await statement.run());
      return results;
    },
    exec(sql: string) {
      db.exec(sql);
    },
  };
}

let db: SqliteDb;
let env: { DB: ReturnType<typeof d1>; [key: string]: unknown };
let privateKey: CryptoKey;
let jwk: JsonWebKey;
let privateKeyPem = '';
const PEM_BEGIN = ['-----BEGIN', 'PRIVATE', 'KEY-----'].join(' ');
const PEM_END = ['-----END', 'PRIVATE', 'KEY-----'].join(' ');

const b64url = (value: Uint8Array | string) =>
  Buffer.from(typeof value === 'string' ? value : value).toString('base64url');

async function tokenFor(claims: Record<string, unknown>, kid = 'test-kid') {
  const header = b64url(JSON.stringify({ alg: 'RS256', kid, typ: 'JWT' }));
  const nowSeconds = Math.floor(Date.now() / 1000);
  const payload = b64url(
    JSON.stringify({
      aud: 'darvo1',
      iss: 'https://securetoken.google.com/darvo1',
      iat: nowSeconds,
      exp: nowSeconds + 3600,
      sub: claims.sub || claims.user_id,
      ...claims,
    })
  );
  const signature = await crypto.subtle.sign(
    { name: 'RSASSA-PKCS1-v1_5' },
    privateKey,
    new TextEncoder().encode(`${header}.${payload}`)
  );
  return `${header}.${payload}.${b64url(new Uint8Array(signature))}`;
}

function request(path: string, init: RequestInit & { token?: string } = {}) {
  const headers = new Headers(init.headers);
  if (init.token) headers.set('Authorization', `Bearer ${init.token}`);
  return new Request(`https://api.test/api/ec${path}`, { ...init, headers });
}

async function body(response: Response): Promise<Record<string, any>> {
  return response.json() as Promise<Record<string, any>>;
}

function seedMultiCohortCatalogue(targetDb: SqliteDb) {
  // Deliberately apply 0001 + 0002 ONLY (omitting 0004) in one test and 0001..0004 here
  targetDb.exec(migration('0001_initial_schema.sql'));
  targetDb.exec(migration('0002_subjects_and_drive_files.sql'));
  targetDb.exec(migration('0004_dropper_class_and_queue_indexes.sql'));

  const insertStudent = targetDb.prepare(
    `INSERT INTO student_profiles (firebase_uid,display_name,email,exam,class_level,created_at,updated_at)
     VALUES (?,?,?,?,?,?,?)`
  );
  insertStudent.run('jee-11', 'Aarav 11', 'jee11@test.dev', 'JEE', '11', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z');
  insertStudent.run('jee-12', 'Diya 12', 'jee12@test.dev', 'JEE', '12', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z');
  insertStudent.run('jee-drop', 'Karan Dropper', 'jeedrop@test.dev', 'JEE', 'Dropper', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z');
  insertStudent.run('neet-drop', 'Meera NEET Dropper', 'neetdrop@test.dev', 'NEET', 'Dropper', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z');

  const insertCourse = targetDb.prepare(
    `INSERT INTO course_catalog (id,kind,title,description,exam,classes,active,access_code,metadata,parent_id,subject_id,sort_order,created_at,updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  );

  // Batches across Class 11, Class 12, Dropper, and NEET
  insertCourse.run('batch-jee-11', 'batch', 'JEE Class 11 Foundation', '', 'JEE', '["11"]', 1, null, '{}', null, null, 1, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z');
  insertCourse.run('batch-jee-12', 'batch', 'JEE Class 12 Target', '', 'JEE', '["12"]', 1, null, '{}', null, null, 2, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z');
  insertCourse.run('batch-jee-drop', 'batch', 'JEE Repeater Rank Booster', '', 'JEE', '["Dropper"]', 1, null, '{}', null, null, 3, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z');
  insertCourse.run('batch-neet-11', 'batch', 'NEET Class 11 Bio Mastery', '', 'NEET', '["11"]', 1, null, '{}', null, null, 4, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z');
  insertCourse.run('batch-neet-drop', 'batch', 'NEET Dropper Complete', '', 'NEET', '["Dropper"]', 1, null, '{}', null, null, 5, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z');
  insertCourse.run('batch-disabled', 'batch', 'Disabled Batch', '', 'JEE', '["11","12","Dropper"]', 0, null, '{}', null, null, 6, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z');

  // Subjects inside batch-jee-11: Physics, Chemistry, and an Archived subject
  const insertSubject = targetDb.prepare(
    `INSERT INTO subjects (id,name,description,exam,classes,active,archived,sort_order,created_at,updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?)`
  );
  insertSubject.run('subj-jee-phy', 'Physics', '', 'JEE', '["11","12","Dropper"]', 1, 0, 1, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z');
  insertSubject.run('subj-jee-chem', 'Chemistry', '', 'JEE', '["11","12","Dropper"]', 1, 0, 2, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z');
  insertSubject.run('subj-jee-arch', 'Archived Maths', '', 'JEE', '["11","12","Dropper"]', 0, 1, 3, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z');
  insertSubject.run('subj-neet-bio', 'Biology', '', 'NEET', '["11","12","Dropper"]', 1, 0, 1, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z');
  insertSubject.run('subj-neet-phy', 'NEET Physics', '', 'NEET', '["11","12","Dropper"]', 1, 0, 2, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z');

  const assignSubject = targetDb.prepare(
    `INSERT INTO course_subjects (course_id,subject_id,sort_order,created_at) VALUES (?,?,?,?)`
  );
  assignSubject.run('batch-jee-11', 'subj-jee-phy', 1, '2026-01-01T00:00:00Z');
  assignSubject.run('batch-jee-11', 'subj-jee-chem', 2, '2026-01-01T00:00:00Z');
  assignSubject.run('batch-jee-11', 'subj-jee-arch', 3, '2026-01-01T00:00:00Z');
  assignSubject.run('batch-neet-11', 'subj-neet-bio', 1, '2026-01-01T00:00:00Z');
  assignSubject.run('batch-neet-11', 'subj-neet-phy', 2, '2026-01-01T00:00:00Z');

  // Enroll jee-11 and jee-drop in batch-jee-11; enroll neet-drop in batch-neet-11
  const enroll = targetDb.prepare(
    `INSERT INTO enrollments (id,firebase_uid,item_type,item_id,active,status,source,created_at,updated_at)
     VALUES (?,?,?,?,1,'active','manual',?,?)`
  );
  enroll.run('enr-1', 'jee-11', 'batch', 'batch-jee-11', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z');
  enroll.run('enr-2', 'jee-drop', 'batch', 'batch-jee-11', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z');
  enroll.run('enr-3', 'neet-drop', 'batch', 'batch-neet-11', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z');

  // Physics lectures (out-of-creation-order sort_order to verify strict sort_order ordering)
  insertCourse.run(
    'lec-phy-2', 'lecture', 'Kinematics 02 - Projectile Motion', '', 'JEE', '["11"]', 1, null,
    JSON.stringify({ videoId: 'phyvid00002', duration: '52:10' }), 'batch-jee-11', 'subj-jee-phy', 2,
    '2026-01-02T00:00:00Z', '2026-01-02T00:00:00Z'
  );
  insertCourse.run(
    'lec-phy-1', 'lecture', 'Kinematics 01 - Vectors & 1D', '', 'JEE', '["11"]', 1, null,
    JSON.stringify({ videoId: 'phyvid00001', duration: '45:00' }), 'batch-jee-11', 'subj-jee-phy', 1,
    '2026-01-03T00:00:00Z', '2026-01-03T00:00:00Z'
  );
  insertCourse.run(
    'lec-phy-disabled', 'lecture', 'Kinematics Draft Hidden', '', 'JEE', '["11"]', 0, null,
    JSON.stringify({ videoId: 'phyvid00099' }), 'batch-jee-11', 'subj-jee-phy', 3,
    '2026-01-04T00:00:00Z', '2026-01-04T00:00:00Z'
  );

  // Chemistry lecture whose title contains "Physics" (title-text trap — must NEVER appear in Physics queue!)
  insertCourse.run(
    'lec-chem-trap', 'lecture', 'Quantum Physics & Atomic Structure in Chemistry', '', 'JEE', '["11"]', 1, null,
    JSON.stringify({ videoId: 'chemvid0001' }), 'batch-jee-11', 'subj-jee-chem', 1,
    '2026-01-02T00:00:00Z', '2026-01-02T00:00:00Z'
  );

  // Unassigned lecture in same batch (subject_id = null — must NEVER leak into Physics queue)
  insertCourse.run(
    'lec-unassigned', 'lecture', 'Orientation Session', '', 'JEE', '["11"]', 1, null,
    JSON.stringify({ videoId: 'orient00001', isPreview: true }), 'batch-jee-11', null, 1,
    '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'
  );

  // Lecture under archived subject & disabled parent batch
  insertCourse.run(
    'lec-archived-subj', 'lecture', 'Sets & Relations', '', 'JEE', '["11"]', 1, null,
    JSON.stringify({ videoId: 'archvid0001', isPreview: true }), 'batch-jee-11', 'subj-jee-arch', 1,
    '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'
  );
  insertCourse.run(
    'lec-disabled-parent', 'lecture', 'Orphan Active Lecture', '', 'JEE', '["11"]', 1, null,
    JSON.stringify({ videoId: 'dispar00001', isPreview: true }), 'batch-disabled', null, 1,
    '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'
  );

  // NEET Biology & NEET Physics lectures
  insertCourse.run(
    'lec-bio-1', 'lecture', 'Cell: The Unit of Life 01', '', 'NEET', '["11"]', 1, null,
    JSON.stringify({ videoId: 'biovid00001' }), 'batch-neet-11', 'subj-neet-bio', 1,
    '2026-01-02T00:00:00Z', '2026-01-02T00:00:00Z'
  );
  insertCourse.run(
    'lec-bio-2', 'lecture', 'Cell Cycle & Division 02', '', 'NEET', '["11"]', 1, null,
    JSON.stringify({ videoId: 'biovid00002' }), 'batch-neet-11', 'subj-neet-bio', 2,
    '2026-01-03T00:00:00Z', '2026-01-03T00:00:00Z'
  );
  insertCourse.run(
    'lec-neet-phy-1', 'lecture', 'Units & Measurements for NEET', '', 'NEET', '["11"]', 1, null,
    JSON.stringify({ videoId: 'neetphy0001' }), 'batch-neet-11', 'subj-neet-phy', 1,
    '2026-01-02T00:00:00Z', '2026-01-02T00:00:00Z'
  );

  // Lesson progress for jee-11 on lec-phy-1
  targetDb
    .prepare(
      `INSERT INTO lesson_progress (id,firebase_uid,lecture_id,watched_seconds,completed,updated_at)
       VALUES (?,?,?,?,?,?)`
    )
    .run('lp-1', 'jee-11', 'lec-phy-1', 420, 0, '2026-01-05T00:00:00Z');

  // Tests for Class 11, Class 12, and Dropper
  const sampleQ = JSON.stringify({
    durationMinutes: 30,
    marksPerQuestion: 4,
    negativeMarks: 1,
    questions: [
      {
        id: 'q1',
        type: 'single-choice',
        text: '2 + 2 = ?',
        options: [
          { id: 'A', text: '3' },
          { id: 'B', text: '4' },
        ],
        correctAnswer: 'B',
        marks: 4,
        negativeMarks: 1,
      },
    ],
  });
  insertCourse.run('test-jee-11', 'test', 'JEE 11 Mock', '', 'JEE', '["11"]', 1, null, sampleQ, null, null, 1, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z');
  insertCourse.run('test-jee-12', 'test', 'JEE 12 Mock', '', 'JEE', '["12"]', 1, null, sampleQ, null, null, 2, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z');
  insertCourse.run('test-jee-drop', 'test', 'JEE Dropper Grand Test', '', 'JEE', '["Dropper"]', 1, null, sampleQ, null, null, 3, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z');
}

beforeAll(async () => {
  const pair = (await crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['sign', 'verify']
  )) as CryptoKeyPair;
  privateKey = pair.privateKey;
  jwk = await crypto.subtle.exportKey('jwk', pair.publicKey);
  const pkcs8 = new Uint8Array(await crypto.subtle.exportKey('pkcs8', pair.privateKey));
  privateKeyPem = `${PEM_BEGIN}\n${Buffer.from(pkcs8).toString('base64').replace(/(.{64})/g, '$1\n')}\n${PEM_END}\n`;
});

beforeEach(() => {
  db = new DatabaseSync(':memory:');
  seedMultiCohortCatalogue(db);
  env = { DB: d1(db) };
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('service_accounts/v1/jwk')) {
        return Response.json({ keys: [{ ...jwk, kid: 'test-kid', alg: 'RS256', use: 'sig' }] });
      }
      throw new Error(`Unexpected network request in test: ${url}`);
    })
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Scenarios 1 & 2: Subject-only Up Next queue filtering & Autoplay next-lecture selection', () => {
  it('queues ONLY eligible JEE Physics lectures ordered by sort_order, ignoring Chemistry title-text traps, unassigned, and disabled items', async () => {
    const token = await tokenFor({ user_id: 'jee-11', email: 'jee11@test.dev' });
    const res = await handleApiRequest(request('/content/lec-phy-1', { token }), env as any);
    expect(res.status).toBe(200);
    const data = await body(res);

    expect(data.subject).toEqual({ id: 'subj-jee-phy', name: 'Physics' });
    expect(data.progress).toMatchObject({ watchedSeconds: 420, completed: false });

    const queueIds = (data.subjectQueue as any[]).map((item) => item.id);
    expect(queueIds).toEqual(['lec-phy-1', 'lec-phy-2']);
    expect(queueIds).not.toContain('lec-chem-trap');
    expect(queueIds).not.toContain('lec-unassigned');
    expect(queueIds).not.toContain('lec-phy-disabled');

    expect(data.queueMeta).toMatchObject({
      subjectId: 'subj-jee-phy',
      subjectName: 'Physics',
      parentId: 'batch-jee-11',
      totalInSubject: 2,
      currentIndex: 0,
      previousLectureId: null,
      nextLectureId: 'lec-phy-2',
    });

    // Hydrates progress into queue items
    expect(data.subjectQueue[0].progress.watchedSeconds).toBe(420);
  });

  it('queues ONLY NEET Biology lectures when watching NEET Biology and stops autoplay cleanly at the final lecture', async () => {
    const token = await tokenFor({ user_id: 'neet-drop', email: 'neetdrop@test.dev' });
    const resFirst = await handleApiRequest(request('/content/lec-bio-1', { token }), env as any);
    const dataFirst = await body(resFirst);
    expect((dataFirst.subjectQueue as any[]).map((x) => x.id)).toEqual(['lec-bio-1', 'lec-bio-2']);
    expect(dataFirst.queueMeta.nextLectureId).toBe('lec-bio-2');

    const resLast = await handleApiRequest(request('/content/lec-bio-2', { token }), env as any);
    const dataLast = await body(resLast);
    expect(dataLast.queueMeta.previousLectureId).toBe('lec-bio-1');
    expect(dataLast.queueMeta.nextLectureId).toBeNull();

    // Pure client queue builder also enforces strict subject isolation and stops at end of subject
    const clientQueue = buildSubjectQueue(
      dataLast.item as CourseCatalogItem,
      [
        ...(dataLast.subjectQueue as any[]),
        {
          ...(dataLast.item as CourseCatalogItem),
          id: 'lec-neet-phy-1',
          title: 'Biology-named Physics Lecture',
          subjectId: 'subj-neet-phy',
        },
      ],
      { student: { exam: 'NEET', classLevel: 'Dropper' } }
    );
    expect(clientQueue.queue.map((x) => x.id)).toEqual(['lec-bio-1', 'lec-bio-2']);
    expect(clientQueue.next).toBeNull();
    expect(clientQueue.upNext).toHaveLength(0);
  });

  it('returns an empty Up Next queue when a lecture has no subjectId rather than mixing unrelated lectures', async () => {
    const token = await tokenFor({ user_id: 'jee-11', email: 'jee11@test.dev' });
    const res = await handleApiRequest(request('/content/lec-unassigned', { token }), env as any);
    expect(res.status).toBe(200);
    const data = await body(res);
    expect(data.subjectQueue).toEqual([]);
    expect(data.queueMeta).toMatchObject({
      subjectId: null,
      nextLectureId: null,
      reason: 'missing_subject',
    });
  });
});

describe('Scenarios 3, 4, 5 & 6: Class 11, Class 12, and Dropper visibility + persistence rules', () => {
  it('enforces Class 11 rules: sees only Class 11 JEE content and blocks Class 12 & Dropper items', async () => {
    const token = await tokenFor({ user_id: 'jee-11', email: 'jee11@test.dev' });
    const boot = await body(await handleApiRequest(request('/bootstrap', { token }), env as any));
    const batchIds = (boot.content as any[]).filter((c) => c.kind === 'batch').map((c) => c.id);
    expect(batchIds).toEqual(['batch-jee-11']);

    const testsRes = await body(await handleApiRequest(request('/tests', { token }), env as any));
    expect((testsRes.items as any[]).map((t) => t.id)).toEqual(['test-jee-11']);

    const forbidden12 = await handleApiRequest(request('/catalog/tree?parentId=batch-jee-12', { token }), env as any);
    expect(forbidden12.status).toBe(403);
    const forbiddenDrop = await handleApiRequest(request('/catalog/tree?parentId=batch-jee-drop', { token }), env as any);
    expect(forbiddenDrop.status).toBe(403);
  });

  it('enforces Class 12 rules: sees only Class 12 JEE content and blocks Class 11 & Dropper items', async () => {
    const token = await tokenFor({ user_id: 'jee-12', email: 'jee12@test.dev' });
    const boot = await body(await handleApiRequest(request('/bootstrap', { token }), env as any));
    const batchIds = (boot.content as any[]).filter((c) => c.kind === 'batch').map((c) => c.id);
    expect(batchIds).toEqual(['batch-jee-12']);

    const testsRes = await body(await handleApiRequest(request('/tests', { token }), env as any));
    expect((testsRes.items as any[]).map((t) => t.id)).toEqual(['test-jee-12']);

    const forbidden11 = await handleApiRequest(request('/catalog/tree?parentId=batch-jee-11', { token }), env as any);
    expect(forbidden11.status).toBe(403);
    const forbiddenDrop = await handleApiRequest(request('/catalog/tree?parentId=batch-jee-drop', { token }), env as any);
    expect(forbiddenDrop.status).toBe(403);
  });

  it('enforces Dropper rules: accesses JEE Class 11, Class 12, and Dropper content without duplicates and blocks NEET', async () => {
    const token = await tokenFor({ user_id: 'jee-drop', email: 'jeedrop@test.dev' });
    const boot = await body(await handleApiRequest(request('/bootstrap', { token }), env as any));
    const batchIds = (boot.content as any[]).filter((c) => c.kind === 'batch').map((c) => c.id);
    expect(batchIds).toEqual(['batch-jee-11', 'batch-jee-12', 'batch-jee-drop']);
    // Never duplicated
    expect(new Set(batchIds).size).toBe(batchIds.length);
    // Never leaks NEET
    expect(batchIds).not.toContain('batch-neet-11');
    expect(batchIds).not.toContain('batch-neet-drop');

    // Dropper sees all 3 JEE tests (11, 12, Dropper)
    const testsRes = await body(await handleApiRequest(request('/tests', { token }), env as any));
    expect((testsRes.items as any[]).map((t) => t.id).sort()).toEqual([
      'test-jee-11',
      'test-jee-12',
      'test-jee-drop',
    ]);

    // Dropper can open Class 11 batch tree AND Class 12 batch tree on JEE track, but gets 403 on NEET batch
    const tree11 = await handleApiRequest(request('/catalog/tree?parentId=batch-jee-11', { token }), env as any);
    expect(tree11.status).toBe(200);
    const tree12 = await handleApiRequest(request('/catalog/tree?parentId=batch-jee-12', { token }), env as any);
    expect(tree12.status).toBe(200);
    const treeNeet = await handleApiRequest(request('/catalog/tree?parentId=batch-neet-drop', { token }), env as any);
    expect(treeNeet.status).toBe(403);

    // Pure enrollment helper agrees with backend Dropper rules
    expect(classMatchesItem(['11'], 'Dropper')).toBe(true);
    expect(classMatchesItem(['12'], 'Dropper')).toBe(true);
    expect(classMatchesItem(['Dropper'], 'Dropper')).toBe(true);
    expect(classMatchesItem(['Dropper'], '11')).toBe(false);
    expect(
      isEligibleForItem(
        { id: 'batch-jee-11', kind: 'batch', exam: 'JEE', classes: ['11'], active: true },
        { firebase_uid: 'jee-drop', exam: 'JEE', class_level: 'Dropper' }
      )
    ).toBe(true);
  });

  it('persists 11, 12, and Dropper in POST/PATCH /profile, upgrades legacy D1 constraints automatically, and records Dropper leaderboard attempts', async () => {
    // Start with a legacy 0001+0002 database (before 0004) to verify automatic runtime upgrade!
    const legacyDb = new DatabaseSync(':memory:');
    legacyDb.exec(migration('0001_initial_schema.sql'));
    legacyDb.exec(migration('0002_subjects_and_drive_files.sql'));
    legacyDb
      .prepare(
        `INSERT INTO course_catalog (id,kind,title,description,exam,classes,active,metadata,created_at,updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?)`
      )
      .run(
        'test-drop-live',
        'test',
        'Dropper Live Mock',
        '',
        'NEET',
        '["12"]',
        1,
        JSON.stringify({
          durationMinutes: 15,
          questions: [
            {
              id: 'q1',
              type: 'single-choice',
              text: 'Powerhouse of the cell?',
              options: [
                { id: 'A', text: 'Mitochondria' },
                { id: 'B', text: 'Ribosome' },
              ],
              correctAnswer: 'A',
              marks: 4,
              negativeMarks: 1,
            },
          ],
        }),
        '2026-01-01T00:00:00Z',
        '2026-01-01T00:00:00Z'
      );

    const legacyEnv = { DB: d1(legacyDb) };
    const newStudentToken = await tokenFor({ user_id: 'fresh-dropper', email: 'fresh@test.dev' });

    // Onboarding as Dropper triggers ensureDropperSchemaUpgrade transparently
    const createRes = await handleApiRequest(
      request('/profile', {
        method: 'POST',
        token: newStudentToken,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: 'Ishaan Verma', exam: 'NEET', classLevel: 'dropper' }),
      }),
      legacyEnv as any
    );
    expect(createRes.status).toBe(200);
    const createdProfile = (await body(createRes)).profile;
    expect(createdProfile).toMatchObject({
      firebase_uid: 'fresh-dropper',
      exam: 'NEET',
      class_level: 'Dropper',
    });

    // Dropper student submits Class 12 NEET test and appears on leaderboard with classLevel='Dropper'
    const submitRes = await handleApiRequest(
      request('/tests/test-drop-live/submit', {
        method: 'POST',
        token: newStudentToken,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: { q1: 'A' } }),
      }),
      legacyEnv as any
    );
    expect(submitRes.status).toBe(200);

    const lbRes = await handleApiRequest(
      request('/leaderboard?testId=test-drop-live', { token: newStudentToken }),
      legacyEnv as any
    );
    expect(lbRes.status).toBe(200);
    const lbData = await body(lbRes);
    expect(lbData.items[0]).toMatchObject({
      firebaseUid: 'fresh-dropper',
      classLevel: 'Dropper',
      score: 4,
    });
  });
});

describe('Scenarios 7 & 8: Admin lecture creation, parent audience inheritance & hidden/mismatched exclusion', () => {
  it('aligns admin-created lectures with parent batch & subject audience and exposes them only in the selected batch & subject', async () => {
    const adminToken = await tokenFor({
      user_id: 'admin-uid',
      email: 'arvinddarabishnoi@gmail.com',
      email_verified: true,
    });
    const neetDropToken = await tokenFor({ user_id: 'neet-drop', email: 'neetdrop@test.dev' });

    // Assign Biology subject to batch-neet-drop
    const assignRes = await handleApiRequest(
      request('/admin/course-subjects', {
        method: 'POST',
        token: adminToken,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseId: 'batch-neet-drop', subjectIds: ['subj-neet-bio'] }),
      }),
      env as any
    );
    expect(assignRes.status).toBe(200);

    // 1. Explicitly mismatched exam/classes on a parent batch is rejected with 400 so broken relationships never save
    const mismatchedRes = await handleApiRequest(
      request('/admin/content', {
        method: 'POST',
        token: adminToken,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'lecture',
          title: 'Mismatched Lecture',
          exam: 'JEE',
          classes: ['11'],
          active: true,
          parentId: 'batch-neet-drop',
          subjectId: 'subj-neet-bio',
          sortOrder: 1,
          metadata: { videoId: 'dQw4w9WgXcQ', isPreview: true },
        }),
      }),
      env as any
    );
    expect(mismatchedRes.status).toBe(400);

    // 2. Creating lecture with parentId + subjectId inherits NEET + ['Dropper'] automatically from parent & subject
    const createLecRes = await handleApiRequest(
      request('/admin/content', {
        method: 'POST',
        token: adminToken,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'lecture',
          title: 'Genetics & Evolution 01',
          description: 'Mendelian inheritance',
          active: true,
          parentId: 'batch-neet-drop',
          subjectId: 'subj-neet-bio',
          sortOrder: 1,
          metadata: {
            youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
            videoId: 'dQw4w9WgXcQ',
            isPreview: true,
          },
        }),
      }),
      env as any
    );
    expect(createLecRes.status).toBe(201);
    const createdLecture = (await body(createLecRes)).item;
    // Automatically aligned to parent batch-neet-drop (NEET, ['Dropper'])!
    expect(createdLecture.exam).toBe('NEET');
    expect(createdLecture.classes).toEqual(['Dropper']);
    expect(createdLecture.parentId).toBe('batch-neet-drop');
    expect(createdLecture.subjectId).toBe('subj-neet-bio');

    // Visible in batch-neet-drop under Biology, and NOT in batch-neet-11
    const dropTree = await body(
      await handleApiRequest(request('/catalog/tree?parentId=batch-neet-drop', { token: neetDropToken }), env as any)
    );
    expect(dropTree.subjects[0].id).toBe('subj-neet-bio');
    expect(dropTree.subjects[0].lectures.map((l: any) => l.id)).toEqual([createdLecture.id]);

    const otherTree = await body(
      await handleApiRequest(request('/catalog/tree?parentId=batch-neet-11', { token: neetDropToken }), env as any)
    );
    const otherIds = otherTree.subjects.flatMap((s: any) => s.lectures.map((l: any) => l.id));
    expect(otherIds).not.toContain(createdLecture.id);
  });

  it('excludes disabled lectures, archived-subject lectures, and disabled-parent lectures from student views', async () => {
    const token = await tokenFor({ user_id: 'jee-11', email: 'jee11@test.dev' });

    const disabledRes = await handleApiRequest(request('/content/lec-phy-disabled', { token }), env as any);
    expect(disabledRes.status).toBe(404);

    const archivedSubjRes = await handleApiRequest(request('/content/lec-archived-subj', { token }), env as any);
    expect(archivedSubjRes.status).toBe(404);

    const disabledParentRes = await handleApiRequest(request('/content/lec-disabled-parent', { token }), env as any);
    expect([403, 404]).toContain(disabledParentRes.status);

    const boot = await body(await handleApiRequest(request('/bootstrap', { token }), env as any));
    const allIds = (boot.content as any[]).map((c) => c.id);
    expect(allIds).not.toContain('lec-phy-disabled');
    expect(allIds).not.toContain('lec-archived-subj');
    expect(allIds).not.toContain('lec-disabled-parent');
  });
});

describe('Scenarios 10 & 13: Protected Drive status route & Pages-to-Worker Drive delegation', () => {
  it('enforces auth & admin role on GET /admin/drive/status and returns sanitized folder probe diagnostics', async () => {
    const unauth = await handleApiRequest(request('/admin/drive/status'), env as any);
    expect(unauth.status).toBe(401);

    const studentToken = await tokenFor({ user_id: 'jee-11', email: 'jee11@test.dev' });
    const forbidden = await handleApiRequest(request('/admin/drive/status', { token: studentToken }), env as any);
    expect(forbidden.status).toBe(403);

    const adminToken = await tokenFor({
      user_id: 'admin-uid',
      email: 'arvinddarabishnoi@gmail.com',
      email_verified: true,
    });
    const driveEnv = {
      ...env,
      GOOGLE_SERVICE_ACCOUNT_JSON: JSON.stringify({
        client_email: 'drive-bot@darvo1.iam.gserviceaccount.com',
        private_key: privateKeyPem,
      }),
      GOOGLE_DRIVE_FOLDER_ID: '1sSYE5cAY6jjAgzOYTgCQNOR1xxotc_I8',
    };
    const okRes = await handleApiRequest(request('/admin/drive/status', { token: adminToken }), driveEnv as any);
    expect(okRes.status).toBe(200);
    const statusPayload = await body(okRes);
    expect(statusPayload.status).toMatchObject({
      configured: true,
      folderId: '1sSYE5cAY6jjAgzOYTgCQNOR1xxotc_I8',
      serviceAccountEmail: 'drive-bot@darvo1.iam.gserviceaccount.com',
    });
    expect(JSON.stringify(statusPayload)).not.toContain('BEGIN');
  });

  it('delegates Drive upload, status, and binary file routes from Cloudflare Pages to EXAM_CRACKER_WEB when Pages lacks Drive secrets', async () => {
    const delegatedCalls: string[] = [];
    const pagesEnv = {
      DB: d1(db),
      EXAM_CRACKER_WEB: {
        fetch: vi.fn(async (req: Request) => {
          delegatedCalls.push(new URL(req.url).pathname);
          return Response.json({ delegated: true });
        }),
      },
    };

    for (const route of [
      '/admin/drive/status',
      '/admin/drive/upload',
      '/drive/profile-photo',
      '/files/file-123',
    ]) {
      const res = await onPagesApiRequest({ request: request(route), env: pagesEnv });
      expect(res.status).toBe(200);
      expect(await body(res)).toEqual({ delegated: true });
    }
    expect(delegatedCalls).toEqual([
      '/api/ec/admin/drive/status',
      '/api/ec/admin/drive/upload',
      '/api/ec/drive/profile-photo',
      '/api/ec/files/file-123',
    ]);
  });
});

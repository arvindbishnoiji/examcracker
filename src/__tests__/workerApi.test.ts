import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleApiRequest } from '../../workers/ec-api/src/index.js';
import { onRequest as onPagesApiRequest } from '../../cloudflare-pages/pages-api-entry.mjs';

/**
 * Worker API integration tests against a real SQLite database.
 *
 * D1 is SQLite, so the Worker runs unchanged against an in-memory database with
 * the production migration files applied. Firebase token *signatures* are real:
 * a generated RSA key stands in for Google's JWKS, which lets us prove that a
 * forged admin token is rejected.
 */

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
let env: { DB: ReturnType<typeof d1> };
let privateKey: CryptoKey;
let otherPrivateKey: CryptoKey;
let jwk: JsonWebKey;
let privateKeyPem = '';
// Split so repository credential scanners do not flag this generated fixture.
const PEM_BEGIN = ['-----BEGIN', 'PRIVATE', 'KEY-----'].join(' ');
const PEM_END = ['-----END', 'PRIVATE', 'KEY-----'].join(' ');

const b64url = (value: Uint8Array | string) =>
  Buffer.from(typeof value === 'string' ? value : value).toString('base64url');

async function makeKeyPair() {
  const pair = await crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['sign', 'verify']
  );
  return pair;
}

async function tokenFor(
  claims: Record<string, unknown>,
  key: CryptoKey = privateKey,
  kid = 'test-kid'
) {
  const header = b64url(JSON.stringify({ alg: 'RS256', kid, typ: 'JWT' }));
  const nowSeconds = Math.floor(Date.now() / 1000);
  const payload = b64url(
    JSON.stringify({
      aud: 'darvo1',
      iss: 'https://securetoken.google.com/darvo1',
      iat: nowSeconds,
      exp: nowSeconds + 3600,
      ...claims,
    })
  );
  const signature = await crypto.subtle.sign(
    { name: 'RSASSA-PKCS1-v1_5' },
    key,
    new TextEncoder().encode(`${header}.${payload}`)
  );
  return `${header}.${payload}.${b64url(new Uint8Array(signature))}`;
}

function request(path: string, init: RequestInit & { token?: string } = {}) {
  const headers = new Headers(init.headers);
  if (init.token) headers.set('Authorization', `Bearer ${init.token}`);
  return new Request(`https://api.test/api/ec${path}`, { ...init, headers });
}

async function body(response: Response): Promise<Record<string, unknown>> {
  return response.json() as Promise<Record<string, unknown>>;
}

function seed() {
  db.exec(migration('0001_initial_schema.sql'));
  db.exec(migration('0002_subjects_and_drive_files.sql'));

  db.prepare(
    `INSERT INTO student_profiles (firebase_uid,display_name,email,exam,class_level,created_at,updated_at)
     VALUES (?,?,?,?,?,?,?)`
  ).run('student-1', 'Asha Verma', 'asha@example.com', 'JEE', '11', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z');
  db.prepare(
    `INSERT INTO student_profiles (firebase_uid,display_name,email,exam,class_level,created_at,updated_at)
     VALUES (?,?,?,?,?,?,?)`
  ).run('student-2', 'Ravi Kumar', 'ravi@example.com', 'NEET', '12', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z');

  db.prepare(
    `INSERT INTO course_catalog (id,kind,title,description,exam,classes,active,access_code,metadata,created_at,updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`
  ).run('batch-1', 'batch', 'JEE Physics 2027', 'Physics batch', 'JEE', '["11"]', 1, null, '{}', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z');

  db.prepare(
    `INSERT INTO subjects (id,name,description,exam,classes,active,archived,sort_order,created_at,updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?)`
  ).run('subject-1', 'Physics', 'Mechanics and more', 'JEE', '["11"]', 1, 0, 1, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z');
  db.prepare(
    `INSERT INTO course_subjects (course_id,subject_id,sort_order,created_at) VALUES (?,?,?,?)`
  ).run('batch-1', 'subject-1', 1, '2026-01-01T00:00:00.000Z');

  const insertLecture = db.prepare(
    `INSERT INTO course_catalog
       (id,kind,title,description,exam,classes,active,access_code,metadata,parent_id,subject_id,sort_order,created_at,updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  );
  insertLecture.run(
    'lecture-preview', 'lecture', 'Preview: Kinematics', '', 'JEE', '["11"]', 1, null,
    JSON.stringify({ isPreview: true, videoId: 'preview1' }), 'batch-1', 'subject-1', 1,
    '2026-01-02T00:00:00.000Z', '2026-01-02T00:00:00.000Z'
  );
  insertLecture.run(
    'lecture-paid', 'lecture', 'Paid: Laws of Motion', '', 'JEE', '["11"]', 1, null,
    JSON.stringify({ videoId: 'paid1' }), 'batch-1', 'subject-1', 2,
    '2026-01-03T00:00:00.000Z', '2026-01-03T00:00:00.000Z'
  );

  db.prepare(
    `INSERT INTO course_catalog (id,kind,title,description,exam,classes,active,access_code,metadata,created_at,updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`
  ).run(
    'test-1', 'test', 'Weekly Test 1', '', 'JEE', '["11"]', 1, null,
    JSON.stringify({
      durationMinutes: 30,
      questions: [
        { id: 'q1', text: 'What is 2 + 2?', options: ['3', '4', '5', '6'], correctAnswer: 1, marks: 4, negativeMarks: 1 },
        { id: 'q2', text: 'Unit of force?', options: ['Joule', 'Newton', 'Watt', 'Pascal'], answer: 1, explanation: 'Newton is the SI unit.' },
      ],
    }),
    '2026-01-04T00:00:00.000Z',
    '2026-01-04T00:00:00.000Z'
  );

  db.prepare(
    `INSERT INTO drive_files (id,drive_file_id,owner_uid,uploader_uid,purpose,course_id,mime_type,display_name,size_bytes,status,visibility,created_at,updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).run(
    'file-private', 'drive-id-1', 'student-2', 'student-2', 'pdf', 'batch-1', 'application/pdf',
    'Physics Notes.pdf', 2048, 'active', 'authenticated', '2026-01-05T00:00:00.000Z', '2026-01-05T00:00:00.000Z'
  );

  db.prepare(
    `INSERT INTO site_settings (key,draft,published,published_at,updated_at)
     VALUES (?,?,?,?,?)`
  ).run(
    'footer',
    JSON.stringify({ copyright: 'Draft copy' }),
    JSON.stringify({ copyright: 'Published copy' }),
    '2026-01-06T00:00:00.000Z',
    '2026-01-06T00:00:00.000Z'
  );
}

beforeAll(async () => {
  const pair = (await makeKeyPair()) as CryptoKeyPair;
  privateKey = pair.privateKey;
  jwk = await crypto.subtle.exportKey('jwk', pair.publicKey);
  const pkcs8 = new Uint8Array(await crypto.subtle.exportKey('pkcs8', pair.privateKey));
  privateKeyPem = `${PEM_BEGIN}\n${Buffer.from(pkcs8).toString('base64').replace(/(.{64})/g, '$1\n')}\n${PEM_END}\n`;
  const other = (await makeKeyPair()) as CryptoKeyPair;
  otherPrivateKey = other.privateKey;
});

beforeEach(() => {
  db = new DatabaseSync(':memory:');
  seed();
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

describe('public Worker routes', () => {
  it('reports D1 and Drive storage from /health', async () => {
    const response = await handleApiRequest(request('/health'), env);
    expect(response.status).toBe(200);
    const payload = await body(response);
    expect(payload).toMatchObject({
      ok: true,
      storage: 'cloudflare-d1',
      files: 'google-drive',
      firebaseProjectId: 'darvo1',
    });
    expect(Number(payload.tables)).toBeGreaterThanOrEqual(19);
  });

  it('serves only published settings from /public/site', async () => {
    const response = await handleApiRequest(request('/public/site'), env);
    const payload = await body(response);
    expect((payload.config as Record<string, Record<string, unknown>>).footer.copyright).toBe('Published copy');
    expect(JSON.stringify(payload)).not.toContain('Draft copy');
  });

  it('rejects a foreign origin before touching D1', async () => {
    const response = await handleApiRequest(
      request('/health', { headers: { Origin: 'https://evil.example' } }),
      env
    );
    expect(response.status).toBe(403);
  });

  it('allows the production Pages origin', async () => {
    const response = await handleApiRequest(
      request('/health', { headers: { Origin: 'https://examcrack.pages.dev' } }),
      env
    );
    expect(response.status).toBe(200);
    expect(await body(response)).toMatchObject({ ok: true });
  });

  it('routes Pages API requests directly to D1 and keeps Firebase admin authorization', async () => {
    const health = await onPagesApiRequest({ request: request('/health'), env });
    expect(health.status).toBe(200);
    expect(await body(health)).toMatchObject({ storage: 'cloudflare-d1' });

    const admin = await tokenFor({ sub: 'admin-1', email: 'arvinddarabishnoi@gmail.com' });
    const authorized = await onPagesApiRequest({ request: request('/admin/subjects', { token: admin }), env });
    expect(authorized.status).toBe(200);
    expect((await body(authorized)).items).toEqual([
      expect.objectContaining({ id: 'subject-1', name: 'Physics' }),
    ]);

    const student = await tokenFor({ sub: 'student-1', email: 'asha@example.com' });
    const forbidden = await onPagesApiRequest({ request: request('/admin/subjects', { token: student }), env });
    expect(forbidden.status).toBe(403);
  });

  it('fails closed when the Pages D1 binding is missing', async () => {
    const response = await onPagesApiRequest({ request: request('/health'), env: {} });
    expect(response.status).toBe(503);
    expect(await body(response)).toMatchObject({ error: expect.stringContaining('D1 database is not bound') });
  });

  it('fails closed when the canonical Worker D1 binding is missing', async () => {
    const response = await handleApiRequest(request('/health'), {} as never);
    expect(response.status).toBe(503);
    expect(await body(response)).toMatchObject({ error: expect.stringContaining('D1 binding') });
  });
});

describe('Firebase token verification', () => {
  it('requires a bearer token for student routes', async () => {
    const response = await handleApiRequest(request('/profile'), env);
    expect(response.status).toBe(401);
    expect(await body(response)).toMatchObject({ error: 'Sign-in required.' });
  });

  it('returns the signed-in student profile', async () => {
    const token = await tokenFor({ sub: 'student-1', email: 'asha@example.com' });
    const response = await handleApiRequest(request('/profile', { token }), env);
    expect(response.status).toBe(200);
    const payload = await body(response);
    expect(payload.profile).toMatchObject({
      firebase_uid: 'student-1',
      display_name: 'Asha Verma',
      exam: 'JEE',
      class_level: '11',
    });
  });

  it('rejects a forged token even when it claims the admin email', async () => {
    const forged = await tokenFor(
      { sub: 'attacker', email: 'arvinddarabishnoi@gmail.com' },
      otherPrivateKey
    );
    const response = await handleApiRequest(request('/admin/subjects', { token: forged }), env);
    expect(response.status).toBe(401);
    expect(await body(response)).toMatchObject({ error: 'Firebase session signature is invalid.' });
  });

  it('rejects an expired token', async () => {
    const nowSeconds = Math.floor(Date.now() / 1000);
    const header = b64url(JSON.stringify({ alg: 'RS256', kid: 'test-kid' }));
    const payload = b64url(
      JSON.stringify({
        aud: 'darvo1',
        iss: 'https://securetoken.google.com/darvo1',
        sub: 'student-1',
        iat: nowSeconds - 7200,
        exp: nowSeconds - 3600,
      })
    );
    const signature = await crypto.subtle.sign(
      { name: 'RSASSA-PKCS1-v1_5' },
      privateKey,
      new TextEncoder().encode(`${header}.${payload}`)
    );
    const response = await handleApiRequest(
      request('/profile', { token: `${header}.${payload}.${b64url(new Uint8Array(signature))}` }),
      env
    );
    expect(response.status).toBe(401);
    expect(await body(response)).toMatchObject({ error: 'Firebase session is invalid or expired.' });
  });

  it('forbids a verified non-admin from admin routes', async () => {
    const token = await tokenFor({ sub: 'student-1', email: 'asha@example.com' });
    const response = await handleApiRequest(request('/admin/subjects', { token }), env);
    expect(response.status).toBe(403);
    expect(await body(response)).toMatchObject({
      error: 'Admin access is restricted to the configured administrator email.',
    });
  });

  it('allows the verified administrator', async () => {
    const token = await tokenFor({ sub: 'admin-1', email: 'arvinddarabishnoi@gmail.com' });
    const response = await handleApiRequest(request('/admin/subjects', { token }), env);
    expect(response.status).toBe(200);
    const payload = await body(response);
    expect(payload.items).toEqual([
      expect.objectContaining({ id: 'subject-1', name: 'Physics', assignmentCount: 1, lectureCount: 2 }),
    ]);
  });
});

describe('subject hierarchy and access control', () => {
  it('hides a paid lecture title from an unenrolled student in /bootstrap', async () => {
    const token = await tokenFor({ sub: 'student-1', email: 'asha@example.com' });
    const response = await handleApiRequest(request('/bootstrap', { token }), env);
    expect(response.status).toBe(200);
    const payload = await body(response);
    const serialised = JSON.stringify(payload);
    expect(serialised).toContain('Preview: Kinematics');
    expect(serialised).not.toContain('Paid: Laws of Motion');
  });

  it('shows the full subject tree after enrollment', async () => {
    db.prepare(
      `INSERT INTO enrollments (id,firebase_uid,item_type,item_id,active,status,source,created_at,updated_at)
       VALUES (?,?,?,?,?,?,?,?,?)`
    ).run('enr-1', 'student-1', 'batch', 'batch-1', 1, 'active', 'access_code', 'now', 'now');

    const token = await tokenFor({ sub: 'student-1', email: 'asha@example.com' });
    const treeResponse = await handleApiRequest(
      request('/catalog/tree?parentId=batch-1', { token }),
      env
    );
    expect(treeResponse.status).toBe(200);
    const tree = await body(treeResponse);
    expect(tree.enrolled).toBe(true);
    expect(tree.locked).toBe(false);
    const subjects = tree.subjects as Array<Record<string, unknown>>;
    expect(subjects).toHaveLength(1);
    expect(subjects[0]).toMatchObject({ id: 'subject-1', name: 'Physics' });
    expect((subjects[0].lectures as unknown[]).length).toBe(2);
  });

  it('hides descendants when their parent batch is disabled, including previews and direct links', async () => {
    const admin = await tokenFor({ sub: 'admin-1', email: 'arvinddarabishnoi@gmail.com' });
    const student = await tokenFor({ sub: 'student-1', email: 'asha@example.com' });
    db.prepare(
      `INSERT INTO enrollments (id,firebase_uid,item_type,item_id,active,status,source,created_at,updated_at)
       VALUES (?,?,?,?,?,?,?,?,?)`
    ).run('enr-disabled-parent', 'student-1', 'batch', 'batch-1', 1, 'active', 'self_service', 'now', 'now');

    const before = await handleApiRequest(request('/content?kind=lecture', { token: student }), env);
    expect(JSON.stringify(await body(before))).toContain('Preview: Kinematics');

    const disabled = await handleApiRequest(request('/admin/content/batch-1', { method: 'DELETE', token: admin }), env);
    expect(disabled.status).toBe(200);
    expect((await body(disabled)).disabled).toBe(true);

    const tree = await handleApiRequest(request('/catalog/tree?parentId=batch-1', { token: student }), env);
    expect(tree.status).toBe(404);
    const catalogue = await handleApiRequest(request('/content?kind=lecture', { token: student }), env);
    expect(JSON.stringify(await body(catalogue))).not.toContain('Preview: Kinematics');
    const direct = await handleApiRequest(request('/content/lecture-preview', { token: student }), env);
    expect(direct.status).toBe(403);

    const restored = await handleApiRequest(
      request('/admin/content/batch-1', {
        method: 'PATCH', token: admin,
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ active: true }),
      }),
      env
    );
    expect(restored.status).toBe(200);
    const after = await handleApiRequest(request('/catalog/tree?parentId=batch-1', { token: student }), env);
    expect(JSON.stringify(await body(after))).toContain('Preview: Kinematics');
  });

  it('denies a Drive PDF belonging to a course the student is not enrolled in', async () => {
    const token = await tokenFor({ sub: 'student-1', email: 'asha@example.com' });
    const response = await handleApiRequest(request('/files/file-private', { token }), env);
    expect(response.status).toBe(403);
    expect(await body(response)).toMatchObject({
      error: 'You do not have access to this file.',
    });
  });

  it('scopes subjects to the admin assignment API and rejects unknown courses', async () => {
    const token = await tokenFor({ sub: 'admin-1', email: 'arvinddarabishnoi@gmail.com' });
    const response = await handleApiRequest(
      request('/admin/course-subjects', {
        method: 'POST',
        token,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseId: 'missing-course', subjectIds: ['subject-1'] }),
      }),
      env
    );
    expect(response.status).toBe(404);
  });
});

describe('tests and hidden answer keys', () => {
  it('never returns answer keys to a student before submission', async () => {
    const token = await tokenFor({ sub: 'student-1', email: 'asha@example.com' });
    const response = await handleApiRequest(request('/tests/test-1', { token }), env);
    expect(response.status).toBe(200);
    const payload = await body(response);
    const serialised = JSON.stringify(payload);
    expect(serialised).toContain('What is 2 + 2?');
    expect(serialised).not.toContain('correctAnswer');
    expect(serialised).not.toContain('explanation');
    expect(serialised).not.toContain('"answer"');
  });

  it('scores submissions on the server and ignores any client score', async () => {
    const token = await tokenFor({ sub: 'student-1', email: 'asha@example.com' });
    const response = await handleApiRequest(
      request('/tests/test-1/submit', {
        method: 'POST',
        token,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: { q1: 1, q2: 1 }, score: 9999, maxScore: 9999 }),
      }),
      env
    );
    expect(response.status).toBe(200);
    const payload = await body(response);
    expect(payload.result).toMatchObject({ score: 8, maxScore: 8, correct: 2, incorrect: 0, unanswered: 0 });
    const saved = db.prepare('SELECT score, max_score FROM exam_attempts WHERE firebase_uid=?').get('student-1');
    expect(Number(saved?.score)).toBe(8);
    expect(Number(saved?.max_score)).toBe(8);
  });

  it('rejects a second submission with 409', async () => {
    const token = await tokenFor({ sub: 'student-1', email: 'asha@example.com' });
    const submit = () =>
      handleApiRequest(
        request('/tests/test-1/submit', {
          method: 'POST',
          token,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ answers: { q1: 1 } }),
        }),
        env
      );
    expect((await submit()).status).toBe(200);
    expect((await submit()).status).toBe(409);
  });
});

describe('feedback ownership', () => {
  async function submitAs(token: string, message = 'The test timer is not saving.') {
    return handleApiRequest(
      request('/feedback', {
        method: 'POST',
        token,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject: 'Test timer', category: 'technical', message }),
      }),
      env
    );
  }

  it('stores a student thread and blocks other students from reading it', async () => {
    const asha = await tokenFor({ sub: 'student-1', email: 'asha@example.com' });
    const ravi = await tokenFor({ sub: 'student-2', email: 'ravi@example.com' });

    const created = await submitAs(asha);
    expect(created.status).toBe(201);
    const createdPayload = await body(created);
    const threadId = String((createdPayload.item as Row).id);
    expect(threadId).toBeTruthy();

    const own = await handleApiRequest(request(`/feedback/${threadId}`, { token: asha }), env);
    expect(own.status).toBe(200);
    expect(JSON.stringify(await body(own))).toContain('The test timer is not saving.');

    const foreign = await handleApiRequest(request(`/feedback/${threadId}`, { token: ravi }), env);
    expect(foreign.status).toBe(404);

    const foreignReply = await handleApiRequest(
      request(`/feedback/${threadId}/messages`, {
        method: 'POST',
        token: ravi,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'hijack' }),
      }),
      env
    );
    expect(foreignReply.status).toBe(404);
  });

  it('lets only the admin list, reply and resolve, with a student follow-up reopening', async () => {
    const asha = await tokenFor({ sub: 'student-1', email: 'asha@example.com' });
    const admin = await tokenFor({ sub: 'admin-1', email: 'arvinddarabishnoi@gmail.com' });

    const created = await submitAs(asha);
    const payload = await body(created);
    const threadId = String((payload.item as Row).id);

    const forbiddenList = await handleApiRequest(request('/admin/feedback', { token: asha }), env);
    expect(forbiddenList.status).toBe(403);

    const list = await handleApiRequest(request('/admin/feedback', { token: admin }), env);
    expect(list.status).toBe(200);
    expect(JSON.stringify(await body(list))).toContain('Test timer');

    const reply = await handleApiRequest(
      request(`/admin/feedback/${threadId}/reply`, {
        method: 'POST',
        token: admin,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'We have fixed the autosave.' }),
      }),
      env
    );
    expect(reply.status).toBe(200);
    expect(JSON.stringify(await body(reply))).toContain('We have fixed the autosave.');

    const resolve = await handleApiRequest(
      request(`/admin/feedback/${threadId}`, {
        method: 'PATCH',
        token: admin,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'resolved' }),
      }),
      env
    );
    expect(resolve.status).toBe(200);
    const resolved = await body(resolve);
    expect((resolved.item as Row).status).toBe('resolved');
    expect((resolved.item as Row).resolved_at).toBeTruthy();

    const followUp = await handleApiRequest(
      request(`/feedback/${threadId}/messages`, {
        method: 'POST',
        token: asha,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'It happened again today.' }),
      }),
      env
    );
    expect(followUp.status).toBe(201);
    const thread = db.prepare('SELECT status, resolved_at FROM feedback_threads WHERE id=?').get(threadId);
    expect(thread?.status).toBe('open');
    expect(thread?.resolved_at).toBeNull();
  });
});

describe('admin subject and hierarchy validation', () => {
  const adminToken = async () => tokenFor({ sub: 'admin-1', email: 'arvinddarabishnoi@gmail.com' });

  function jsonPost(path: string, token: string, payload: unknown) {
    return handleApiRequest(
      request(path, {
        method: 'POST',
        token,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }),
      env
    );
  }

  it('creates a subject, rejects duplicates and archives it', async () => {
    const token = await adminToken();
    const created = await jsonPost('/admin/subjects', token, {
      name: 'Chemistry',
      description: 'Physical, organic and inorganic',
      exam: 'JEE',
      classes: ['11', '12'],
      active: true,
    });
    expect(created.status).toBe(201);
    const subject = (await body(created)).item as Row;
    expect(subject).toMatchObject({ name: 'Chemistry', exam: 'JEE', active: true, archived: false });

    const duplicate = await jsonPost('/admin/subjects', token, {
      name: ' chemistry ',
      exam: 'JEE',
      classes: ['11'],
    });
    expect(duplicate.status).toBe(409);

    const archived = await handleApiRequest(
      request(`/admin/subjects/${String(subject.id)}`, { method: 'DELETE', token }),
      env
    );
    expect(archived.status).toBe(200);
    const archivedRow = (await body(archived)).item as Row;
    expect(archivedRow).toMatchObject({ archived: true, active: false });
  });

  it('rejects a lecture whose subject is not assigned to its parent course', async () => {
    const token = await adminToken();
    const response = await jsonPost('/admin/content', token, {
      kind: 'lecture',
      title: 'Unassigned lecture',
      exam: 'JEE',
      classes: ['11'],
      active: true,
      parentId: 'batch-1',
      subjectId: 'not-assigned',
      metadata: {},
    });
    expect(response.status).toBe(400);
    expect(await body(response)).toMatchObject({
      error: 'This subject is not assigned to the selected batch or series.',
    });
  });

  it('requires a selected subject for a lecture inside a batch or series', async () => {
    const token = await adminToken();
    const response = await jsonPost('/admin/content', token, {
      kind: 'lecture',
      title: 'Missing subject lecture',
      exam: 'JEE',
      classes: ['11'],
      active: true,
      parentId: 'batch-1',
      metadata: {},
    });
    expect(response.status).toBe(400);
    expect(await body(response)).toMatchObject({
      error: 'Choose a subject assigned to the selected batch or series.',
    });
    expect(db.prepare("SELECT COUNT(*) AS n FROM course_catalog WHERE title='Missing subject lecture'").get()).toMatchObject({ n: 0 });
  });

  it('refuses to remove a subject that still has lectures (409 SUBJECT_IN_USE)', async () => {
    const token = await adminToken();
    const response = await handleApiRequest(
      request('/admin/course-subjects/batch-1/subject-1', { method: 'DELETE', token }),
      env
    );
    expect(response.status).toBe(409);
    const payload = await body(response);
    expect(payload.error).toBe('SUBJECT_IN_USE');
    expect(Array.isArray(payload.usage)).toBe(true);
  });

  it('guards permanent course deletion and permits an empty disabled course to be removed', async () => {
    const admin = await adminToken();
    db.prepare("UPDATE course_catalog SET active=0 WHERE id='batch-1'").run();
    const blocked = await handleApiRequest(
      request('/admin/content/batch-1?permanent=1', { method: 'DELETE', token: admin }), env
    );
    expect(blocked.status).toBe(409);
    const blockedPayload = await body(blocked);
    expect(blockedPayload.error).toBe('CONTENT_HAS_DEPENDENCIES');
    expect(blockedPayload.dependencies).toMatchObject({ childContent: 2, subjectAssignments: 1 });
    expect(db.prepare("SELECT COUNT(*) AS n FROM course_catalog WHERE id='batch-1'").get()).toMatchObject({ n: 1 });

    const student = await tokenFor({ sub: 'student-1', email: 'asha@example.com' });
    const forbidden = await handleApiRequest(
      request('/admin/content/batch-1?permanent=1', { method: 'DELETE', token: student }), env
    );
    expect(forbidden.status).toBe(403);

    const created = await handleApiRequest(
      request('/admin/content', {
        method: 'POST', token: admin, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'series', title: 'Empty test series', exam: 'JEE', classes: ['11'], active: true, metadata: {} }),
      }), env
    );
    expect(created.status).toBe(201);
    const id = String(((await body(created)).item as Row).id);
    const cannotDeleteWhileActive = await handleApiRequest(
      request(`/admin/content/${id}?permanent=1`, { method: 'DELETE', token: admin }), env
    );
    expect(cannotDeleteWhileActive.status).toBe(409);
    const disabled = await handleApiRequest(
      request(`/admin/content/${id}`, { method: 'DELETE', token: admin }), env
    );
    expect(disabled.status).toBe(200);
    const deleted = await handleApiRequest(
      request(`/admin/content/${id}?permanent=1`, { method: 'DELETE', token: admin }), env
    );
    expect(deleted.status).toBe(200);
    expect(await body(deleted)).toMatchObject({ deleted: true, id, title: 'Empty test series' });
    expect(db.prepare('SELECT id FROM course_catalog WHERE id=?').get(id)).toBeUndefined();
  });

  it('creates a lecture with a valid parent/subject pair and lists it in the tree', async () => {
    const token = await adminToken();
    const created = await jsonPost('/admin/content', token, {
      kind: 'lecture',
      title: 'Work and Energy',
      description: 'New lecture',
      exam: 'JEE',
      classes: ['11'],
      active: true,
      parentId: 'batch-1',
      subjectId: 'subject-1',
      sortOrder: 3,
      metadata: { videoId: 'work1' },
    });
    expect(created.status).toBe(201);
    const item = (await body(created)).item as Row;
    expect(item).toMatchObject({ parentId: 'batch-1', subjectId: 'subject-1' });
    expect(item.subjectName).toBe('Physics');

    db.prepare(
      `INSERT INTO enrollments (id,firebase_uid,item_type,item_id,active,status,source,created_at,updated_at)
       VALUES (?,?,?,?,?,?,?,?,?)`
    ).run('enr-2', 'student-1', 'batch', 'batch-1', 1, 'active', 'self_service', 'now', 'now');
    const student = await tokenFor({ sub: 'student-1', email: 'asha@example.com' });
    const tree = await handleApiRequest(request('/catalog/tree?parentId=batch-1', { token: student }), env);
    const treePayload = await body(tree);
    const lectureTitles = ((treePayload.subjects as Row[])[0].lectures as Row[]).map((row) => row.title);
    expect(lectureTitles).toContain('Work and Energy');
  });

  it('persists content edits and hides/restores disabled lessons for enrolled students', async () => {
    const admin = await tokenFor({ sub: 'admin-1', email: 'arvinddarabishnoi@gmail.com' });
    const create = await handleApiRequest(
      request('/admin/content', {
        method: 'POST',
        token: admin,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'lecture', title: 'Lifecycle lesson', description: 'Original', exam: 'JEE',
          classes: ['11'], active: true, parentId: 'batch-1', subjectId: 'subject-1',
          sortOrder: 8, metadata: { videoId: 'lifecycle-video' },
        }),
      }),
      env
    );
    expect(create.status).toBe(201);
    const created = (await body(create)).item as Row;
    const id = String(created.id);
    expect(created).toMatchObject({ parentId: 'batch-1', subjectId: 'subject-1', sortOrder: 8 });

    const update = await handleApiRequest(
      request(`/admin/content/${id}`, {
        method: 'PATCH', token: admin,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'lecture', title: 'Lifecycle lesson edited', description: 'Saved in D1', exam: 'JEE',
          classes: ['11'], active: true, parentId: 'batch-1', subjectId: 'subject-1',
          sortOrder: 4, metadata: { videoId: 'lifecycle-video' },
        }),
      }),
      env
    );
    expect(update.status).toBe(200);

    db.prepare(
      `INSERT INTO enrollments (id,firebase_uid,item_type,item_id,active,status,source,created_at,updated_at)
       VALUES (?,?,?,?,?,?,?,?,?)`
    ).run('enr-lifecycle', 'student-1', 'batch', 'batch-1', 1, 'active', 'self_service', 'now', 'now');
    const student = await tokenFor({ sub: 'student-1', email: 'asha@example.com' });

    const disabled = await handleApiRequest(
      request(`/admin/content/${id}`, { method: 'DELETE', token: admin }), env
    );
    expect(disabled.status).toBe(200);
    let treeResponse = await handleApiRequest(request('/catalog/tree?parentId=batch-1', { token: student }), env);
    let tree = await body(treeResponse);
    expect(JSON.stringify(tree)).not.toContain('Lifecycle lesson edited');

    const restore = await handleApiRequest(
      request(`/admin/content/${id}`, {
        method: 'PATCH', token: admin,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: true }),
      }),
      env
    );
    expect(restore.status).toBe(200);
    treeResponse = await handleApiRequest(request('/catalog/tree?parentId=batch-1', { token: student }), env);
    tree = await body(treeResponse);
    expect(JSON.stringify(tree)).toContain('Lifecycle lesson edited');

    const listed = await handleApiRequest(
      request(`/admin/content?kind=lecture&parentId=batch-1&subjectId=subject-1`, { token: admin }), env
    );
    const listedItems = (await body(listed)).items as Row[];
    expect(listedItems.find((item) => item.id === id)).toMatchObject({
      title: 'Lifecycle lesson edited', active: true, sortOrder: 4,
    });
  });
});

describe('profile photo upload end to end', () => {
  const PNG_BYTES = new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
    0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
  ]);

  function driveEnv() {
    return {
      ...env,
      GOOGLE_SERVICE_ACCOUNT_JSON: JSON.stringify({
        client_email: 'drive@test-project.iam.gserviceaccount.com',
        private_key: privateKeyPem,
      }),
      GOOGLE_DRIVE_FOLDER_ID: 'folder-1',
    };
  }

  function stubDrive(options: { failInsert?: boolean } = {}) {
    const calls: string[] = [];
    const impl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push(`${init?.method || 'GET'} ${url}`);
      if (url.includes('service_accounts/v1/jwk')) {
        return Response.json({ keys: [{ ...jwk, kid: 'test-kid', alg: 'RS256', use: 'sig' }] });
      }
      if (url.startsWith('https://oauth2.googleapis.com/token')) {
        return Response.json({ access_token: 'drive-token', expires_in: 3600 });
      }
      if (url.includes('/upload/drive/v3/files')) {
        return Response.json({ id: 'drive-photo-1', name: 'photo.png', mimeType: 'image/png', size: String(PNG_BYTES.length) });
      }
      if (url.includes('/drive/v3/files/') && (init?.method || 'GET') === 'DELETE') {
        return new Response(null, { status: 204 });
      }
      throw new Error(`Unexpected network request in test: ${url}`);
    });
    vi.stubGlobal('fetch', impl);
    return { calls, impl };
  }

  function uploadRequest(token: string, mimeType = 'image/png', bytes: Uint8Array = PNG_BYTES) {
    const form = new FormData();
    form.append('file', new Blob([bytes as unknown as BlobPart], { type: mimeType }), 'photo.png');
    return handleApiRequest(
      request('/drive/profile-photo', { method: 'POST', token, body: form }),
      driveEnv()
    );
  }

  it('rejects content whose signature is not an image', async () => {
    stubDrive();
    const token = await tokenFor({ sub: 'student-1', email: 'asha@example.com' });
    const response = await uploadRequest(token, 'image/png', new TextEncoder().encode('not an image'));
    expect(response.status).toBe(415);
  });

  it('rejects a photo larger than 5 MB', async () => {
    stubDrive();
    const token = await tokenFor({ sub: 'student-1', email: 'asha@example.com' });
    const tooLarge = new Uint8Array(5 * 1024 * 1024 + 1);
    tooLarge.set(PNG_BYTES, 0);
    const response = await uploadRequest(token, 'image/png', tooLarge);
    expect(response.status).toBe(413);
  });

  it('derives ownership from the token and updates the profile', async () => {
    const { calls } = stubDrive();
    const token = await tokenFor({ sub: 'student-1', email: 'asha@example.com' });
    const response = await uploadRequest(token);
    expect(response.status).toBe(201);
    const payload = await body(response);
    expect(payload.file).toMatchObject({ purpose: 'profile_photo', mimeType: 'image/png', status: 'active' });
    expect(payload.profile).toMatchObject({ firebase_uid: 'student-1' });
    expect(String((payload.profile as Row).avatar_url)).toMatch(/^\/api\/ec\/files\//);

    const row = db.prepare('SELECT owner_uid, uploader_uid, drive_file_id, visibility FROM drive_files WHERE purpose=?').get('profile_photo');
    expect(row).toMatchObject({
      owner_uid: 'student-1',
      uploader_uid: 'student-1',
      drive_file_id: 'drive-photo-1',
      visibility: 'authenticated',
    });
    expect(calls.some((call) => call.includes('/upload/drive/v3/files'))).toBe(true);

    const profile = await handleApiRequest(request('/profile', { token }), env);
    expect(JSON.stringify(await body(profile))).toContain('/api/ec/files/');
  });

  it('deletes the Drive file when the D1 write fails (no orphan left behind)', async () => {
    const { calls } = stubDrive();
    const token = await tokenFor({ sub: 'student-1', email: 'asha@example.com' });
    const failingDb = {
      ...env.DB,
      prepare(sql: string) {
        if (sql.includes('INSERT INTO drive_files')) {
          return {
            bind() { return this; },
            async all() { return { success: true, results: [] }; },
            async first() { return null; },
            async run() { throw new Error('D1 write failed'); },
          };
        }
        return env.DB.prepare(sql);
      },
    };
    const form = new FormData();
    form.append('file', new Blob([PNG_BYTES as unknown as BlobPart], { type: 'image/png' }), 'photo.png');
    const response = await handleApiRequest(
      request('/drive/profile-photo', { method: 'POST', token, body: form }),
      { ...driveEnv(), DB: failingDb }
    );
    expect(response.status).toBe(500);
    expect(await body(response)).toMatchObject({ error: expect.stringContaining('could not be saved') });
    expect(calls.some((call) => call.startsWith('DELETE') && call.includes('/drive/v3/files/'))).toBe(true);
    // Only the seeded PDF remains; the failed upload left no metadata row.
    expect(db.prepare("SELECT COUNT(*) AS n FROM drive_files WHERE purpose='profile_photo'").get()?.n).toBe(0);
  });

  it('returns an actionable 503 when Drive credentials are absent', async () => {
    stubDrive();
    const token = await tokenFor({ sub: 'student-1', email: 'asha@example.com' });
    const form = new FormData();
    form.append('file', new Blob([PNG_BYTES as unknown as BlobPart], { type: 'image/png' }), 'photo.png');
    const response = await handleApiRequest(
      request('/drive/profile-photo', { method: 'POST', token, body: form }),
      env
    );
    expect(response.status).toBe(503);
    expect(await body(response)).toMatchObject({
      error: expect.stringMatching(/Google Drive/),
    });
  });
});

describe('admin directory and analytics', () => {
  const adminToken = async () => tokenFor({ sub: 'admin-1', email: 'arvinddarabishnoi@gmail.com' });

  it('lists students with pagination metadata', async () => {
    const response = await handleApiRequest(request('/admin/students', { token: await adminToken() }), env);
    expect(response.status).toBe(200);
    const payload = await body(response);
    expect(payload.total).toBe(2);
    expect((payload.items as Row[]).map((row) => row.display_name).sort()).toEqual(['Asha Verma', 'Ravi Kumar']);
  });

  it('returns real analytics without fabricated series', async () => {
    const response = await handleApiRequest(request('/admin/analytics', { token: await adminToken() }), env);
    expect(response.status).toBe(200);
    const payload = await body(response);
    expect(payload.students).toMatchObject({ total: 2, byExam: { JEE: 1, NEET: 1 } });
    expect(payload.content).toMatchObject({ total: 4, active: 4 });
    expect((payload.attempts as Row).last14Days).toHaveLength(14);
    expect(Array.isArray((payload.attempts as Row).topStudents)).toBe(true);
    expect(payload.subjectPerformance).toEqual([]);
    expect(payload.contentHealth).toMatchObject({ testsWithoutQuestions: 0 });
  });
});

describe('admin PDF upload and private viewing', () => {
  const PDF_BYTES = new TextEncoder().encode('%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF\n');
  const adminToken = () => tokenFor({ sub: 'admin-1', email: 'arvinddarabishnoi@gmail.com' });

  function driveEnv() {
    return {
      ...env,
      GOOGLE_SERVICE_ACCOUNT_JSON: JSON.stringify({
        client_email: 'drive@test-project.iam.gserviceaccount.com',
        private_key: privateKeyPem,
      }),
      GOOGLE_DRIVE_FOLDER_ID: 'folder-1',
    };
  }

  function stubDrive(returnedId = 'drive-pdf-1') {
    const calls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        calls.push(`${init?.method || 'GET'} ${url}`);
        if (url.includes('service_accounts/v1/jwk')) {
          return Response.json({ keys: [{ ...jwk, kid: 'test-kid', alg: 'RS256', use: 'sig' }] });
        }
        if (url.startsWith('https://oauth2.googleapis.com/token')) {
          return Response.json({ access_token: 'drive-token', expires_in: 3600 });
        }
        if (url.includes('/upload/drive/v3/files')) {
          return Response.json({ id: returnedId, name: 'notes.pdf', mimeType: 'application/pdf', size: String(PDF_BYTES.length) });
        }
        if (url.includes(`/drive/v3/files/${returnedId}`) && url.includes('alt=media')) {
          return new Response(PDF_BYTES as unknown as BlobPart, { status: 200, headers: { 'content-type': 'application/pdf' } });
        }
        if (url.includes('/drive/v3/files/') && (init?.method || 'GET') === 'DELETE') {
          return new Response(null, { status: 204 });
        }
        throw new Error(`Unexpected network request in test: ${url}`);
      })
    );
    return { calls };
  }

  function pdfForm(bytes: Uint8Array = PDF_BYTES) {
    const form = new FormData();
    form.append('file', new Blob([bytes as unknown as BlobPart], { type: 'application/pdf' }), 'notes.pdf');
    form.append('courseId', 'batch-1');
    return form;
  }

  async function upload(token: string, bytes?: Uint8Array) {
    return handleApiRequest(
      request('/admin/drive/upload', { method: 'POST', token, body: pdfForm(bytes) }),
      driveEnv()
    );
  }

  it('rejects a PDF-typed upload whose signature is not a PDF', async () => {
    stubDrive();
    const response = await upload(await adminToken(), new TextEncoder().encode('just text'));
    expect(response.status).toBe(415);
    expect(await body(response)).toMatchObject({ error: expect.stringContaining('PDF') });
  });

  it('refuses PDF uploads from students', async () => {
    stubDrive();
    const response = await upload(await tokenFor({ sub: 'student-1', email: 'asha@example.com' }));
    expect(response.status).toBe(403);
  });

  it('stores Drive metadata only, then serves the PDF to an enrolled student and blocks others', async () => {
    stubDrive();
    const response = await upload(await adminToken());
    expect(response.status).toBe(201);
    const payload = await body(response);
    const file = payload.file as Row;
    expect(file).toMatchObject({ purpose: 'pdf', mimeType: 'application/pdf', courseId: 'batch-1' });
    expect(JSON.stringify(file)).not.toMatch(/drive\.google\.com|anyone/i);

    const stored = db.prepare('SELECT owner_uid, uploader_uid, drive_file_id, visibility FROM drive_files WHERE id=?').get(String(file.id));
    expect(stored).toMatchObject({ owner_uid: null, uploader_uid: 'admin-1', drive_file_id: 'drive-pdf-1', visibility: 'course' });

    db.prepare(
      `INSERT OR REPLACE INTO enrollments (id,firebase_uid,item_type,item_id,active,status,source,created_at,updated_at)
       VALUES (?,?,?,?,?,?,?,?,?)`
    ).run('enr-pdf', 'student-1', 'batch', 'batch-1', 1, 'active', 'manual', 'now', 'now');

    const enrolled = await handleApiRequest(
      request(`/files/${encodeURIComponent(String(file.id))}`, { token: await tokenFor({ sub: 'student-1', email: 'asha@example.com' }) }),
      driveEnv()
    );
    expect(enrolled.status).toBe(200);
    expect(enrolled.headers.get('content-type')).toContain('application/pdf');
    expect(await enrolled.text()).toContain('%PDF-1.7');

    const outsider = await handleApiRequest(
      request(`/files/${encodeURIComponent(String(file.id))}`, { token: await tokenFor({ sub: 'student-2', email: 'ravi@example.com' }) }),
      driveEnv()
    );
    expect(outsider.status).toBe(403);
    expect(await body(outsider)).toMatchObject({ error: 'You do not have access to this file.' });

    const anonymous = await handleApiRequest(request(`/files/${encodeURIComponent(String(file.id))}`), driveEnv());
    expect(anonymous.status).toBe(401);
  });

  it('never returns a public Drive URL in the file listing', async () => {
    stubDrive();
    db.prepare(
      `INSERT OR REPLACE INTO enrollments (id,firebase_uid,item_type,item_id,active,status,source,created_at,updated_at)
       VALUES (?,?,?,?,?,?,?,?,?)`
    ).run('enr-list', 'student-1', 'batch', 'batch-1', 1, 'active', 'manual', 'now', 'now');
    const enrolled = await handleApiRequest(
      request('/files?courseId=batch-1', { token: await tokenFor({ sub: 'student-1', email: 'asha@example.com' }) }),
      driveEnv()
    );
    expect(enrolled.status).toBe(200);
    const payload = await body(enrolled);
    expect(JSON.stringify(payload)).not.toMatch(/drive\.google\.com|usercontent\.google/);
    expect((payload.items as Row[]).every((item) => String(item.downloadUrl || '').startsWith('/api/ec/files/'))).toBe(true);
  });
});

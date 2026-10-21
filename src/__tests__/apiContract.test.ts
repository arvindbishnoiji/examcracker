import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Architecture and security contract tests.
 *
 * These read the real source files and assert properties that are easy to
 * regress: retired backends staying retired, authorisation living on the
 * server, answer keys never leaving the server and Drive files staying private.
 */

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');
const worker = () => read('workers/ec-api/src/index.js');
const clientApi = () => read('src/lib/api.ts');

describe('final architecture', () => {
  it('has no Supabase runtime, source directory or dependency', () => {
    expect(read('package.json')).not.toMatch(/@supabase|supabase-js/i);
    expect(() => read('supabase/functions/exam-cracker-api/index.ts')).toThrow();
    expect(clientApi()).not.toMatch(/supabase/i);
    expect(worker()).not.toMatch(/createClient|SUPABASE_URL|SERVICE_ROLE/i);
    expect(worker()).toContain('Cloudflare D1');
    expect(worker()).toContain('Google Drive');
  });

  it('keeps Firebase Authentication as the identity source', () => {
    expect(worker()).toContain('FIREBASE_PROJECT_ID');
    expect(worker()).toContain('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com');
    expect(read('src/lib/firebase.ts')).toContain('getFirebaseAuth');
  });

  it('talks to the Worker through the same-origin /api/ec proxy', () => {
    expect(read('src/lib/config.ts')).toMatch(/apiBaseUrl:\s*'\/api\/ec'/);
    const proxy = read('src/app/api/ec/[...path]/route.ts');
    expect(proxy).toContain('handleApiRequest');
    expect(proxy).not.toMatch(/https?:\/\//);
  });

  it('keeps the YouTube metadata Worker separate from the D1 API Worker', () => {
    expect(read('workers/ec-content-api/wrangler.toml')).toContain('ec-content-api');
    expect(worker()).not.toContain('youtube/v3');
  });
});

describe('authorisation is derived from the verified Firebase token', () => {
  it('compares the verified email against the configured administrator', () => {
    const source = worker();
    expect(source).toContain('ADMIN_EMAIL');
    expect(source).toContain('function requireAdmin');
    expect(source).toMatch(/user\.email\s*===\s*ADMIN_EMAIL/);
  });

  it('never trusts a role, admin flag or score supplied by the client', () => {
    const source = worker();
    expect(source).not.toMatch(/body\.isAdmin|payload\.isAdmin|body\.role\b/);
    expect(source).not.toMatch(/body\.score|payload\.score|body\.firebase_uid/);
  });

  it('derives file ownership from the token, not from the request body', () => {
    const source = worker();
    const upload = source.slice(source.indexOf('path === "/drive/profile-photo" && method === "POST"'));
    const block = upload.slice(0, upload.indexOf('Google Drive: authorized file reading'));
    expect(block).toMatch(/user\.uid/);
    expect(block).not.toMatch(/body\.(uid|ownerUid|owner_uid)/);
  });

  it('checks file authorisation before contacting Google Drive', () => {
    const source = worker();
    const start = source.indexOf('if (segments[0] === "files" && segments.length === 2');
    const block = source.slice(start, start + 1200);
    expect(block.indexOf('authorizedFileRow')).toBeGreaterThan(-1);
    expect(block.indexOf('authorizedFileRow')).toBeLessThan(block.indexOf('downloadDriveFile'));
  });
});

describe('client/server route contract', () => {
  const routes = [
    '/bootstrap',
    '/catalog/tree',
    '/subjects',
    '/content',
    '/files',
    '/drive/profile-photo',
    '/feedback',
    '/tests',
    '/analysis',
    '/admin/subjects',
    '/admin/course-subjects',
    '/admin/drive/upload',
    '/admin/drive/files',
    '/admin/analytics',
    '/admin/feedback',
  ];

  it.each(routes)('implements %s in the Worker', (route) => {
    expect(worker()).toContain(`"${route}`);
  });

  it.each(routes)('is reachable from src/lib/api.ts for %s', (route) => {
    expect(clientApi()).toContain(route);
  });

  it('serves protected files only through an authenticated blob fetch', () => {
    const source = clientApi();
    expect(source).toContain('fetchAuthorizedBlob');
    expect(source).toContain('Authorization: `Bearer ${bearer}`');
    // A Drive file id must never be exposed as a public URL in the browser.
    expect(source).not.toMatch(/drive\.google\.com/);
    expect(source).not.toMatch(/alt=media/);
  });

  it('scores on the server and strips answer keys from student payloads', () => {
    const source = worker();
    expect(source).toContain('function redactQuestion');
    for (const key of ['"answer"', '"correctAnswer"', '"explanation"']) {
      expect(source).toContain(key);
    }
    // Both the question-bank payload and the attempt payload must redact.
    expect(source.match(/redactQuestion/g)?.length || 0).toBeGreaterThanOrEqual(2);
    // The browser client must never reference an answer key field.
    expect(clientApi()).not.toMatch(/correctAnswer|answerKey|answer_key/);
  });
});

describe('Chat is retired in favour of Feedback', () => {
  it('redirects /chat to /feedback', () => {
    const page = read('src/app/chat/page.tsx');
    expect(page).toContain("redirect('/feedback')");
  });

  it('has no chat API routes in the Worker', () => {
    expect(worker()).not.toMatch(/"\/chat/);
  });
});

describe('admin console includes the new subject workspace', () => {
  it('registers the subjects section and renders it', () => {
    expect(read('src/lib/admin-sections.ts')).toContain("slug: 'subjects'");
    expect(read('src/app/admin/[section]/page.tsx')).toContain('SubjectsSection');
  });
});

// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { handleApiRequest } from '../../workers/ec-api/src/index.js';
import { ADMIN_SECTIONS } from '../lib/admin-sections';
import {
  BADGE_CODE_TEMPLATES,
  compileScopedBadgeCss,
  describeBadgeCriteria,
} from '../lib/badge-animations';
import { AnimatedBadge, BadgeShowcaseSection } from '../components/student/AnimatedBadge';
import { StudentStudyHub } from '../components/student/StudentStudyHub';
import { ImageField } from '../components/admin/ImageField';
import { ToastProvider } from '../hooks/useToast';
import { validateQuestionsJson } from '../lib/validation';
import { validateSettingValue } from '../lib/site-validation';
import { DEFAULT_SITE_CONFIG } from '../lib/site-config';

vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) =>
    React.createElement('a', { href, ...rest }, children),
}));

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

const nodeRequire = createRequire(import.meta.url);
const { DatabaseSync } = nodeRequire('node:sqlite') as {
  DatabaseSync: new (path: string) => {
    exec: (sql: string) => void;
    prepare: (sql: string) => {
      all: (...args: unknown[]) => Record<string, unknown>[];
      get: (...args: unknown[]) => Record<string, unknown> | undefined;
      run: (...args: unknown[]) => unknown;
    };
  };
};

let mounted: Array<{ unmount: () => void }> = [];

afterEach(() => {
  for (const m of mounted) m.unmount();
  mounted = [];
  vi.unstubAllGlobals();
});

function createD1Binding(db: ReturnType<typeof DatabaseSync.prototype.constructor>) {
  return {
    prepare(sql: string) {
      let params: unknown[] = [];
      const stmt = {
        bind(...values: unknown[]) {
          params = values;
          return stmt;
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
      return stmt;
    },
    async batch(statements: Array<{ run: () => Promise<unknown> }>) {
      const out = [];
      for (const s of statements) out.push(await s.run());
      return out;
    },
    exec(sql: string) {
      db.exec(sql);
    },
  };
}

describe('Badge Studio (image upload + Kaise Milega + custom animations + auto-unlock)', () => {
  it('accepts uploaded PNG/WebP data URLs, custom code animations, and auto-unlocks milestones in /my/badges', async () => {
    const db = new DatabaseSync(':memory:');
    for (const file of ['0001_initial_schema.sql', '0002_subjects_and_drive_files.sql', '0005_badges.sql', '0006_badge_animations_and_rules.sql']) {
      db.exec(readFileSync(resolve(process.cwd(), 'migrations', file), 'utf8'));
    }
    db.prepare(
      'INSERT INTO student_profiles (firebase_uid,display_name,email,exam,class_level) VALUES (?,?,?,?,?)'
    ).run('stu-1', 'Karan Bishnoi', 'karan@example.com', 'JEE', '12');

    const pair = (await crypto.subtle.generateKey(
      { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
      true,
      ['sign', 'verify']
    )) as CryptoKeyPair;
    const jwk = await crypto.subtle.exportKey('jwk', pair.publicKey);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ keys: [{ ...jwk, kid: 'k1', alg: 'RS256', use: 'sig' }] }))
    );

    const sign = async (claims: Record<string, unknown>) => {
      const now = Math.floor(Date.now() / 1000);
      const h = Buffer.from(JSON.stringify({ alg: 'RS256', kid: 'k1', typ: 'JWT' })).toString('base64url');
      const p = Buffer.from(
        JSON.stringify({ aud: 'darvo1', iss: 'https://securetoken.google.com/darvo1', iat: now, exp: now + 3600, ...claims })
      ).toString('base64url');
      const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', pair.privateKey, new TextEncoder().encode(`${h}.${p}`));
      return `${h}.${p}.${Buffer.from(new Uint8Array(sig)).toString('base64url')}`;
    };

    const adminToken = await sign({ sub: 'admin-uid', email: 'arvinddarabishnoi@gmail.com' });
    const stuToken = await sign({ sub: 'stu-1', email: 'karan@example.com' });
    const env = { DB: createD1Binding(db) };

    const samplePngDataUrl =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

    // Rejects SVG data URLs to prevent script injection
    const badSvg = await handleApiRequest(
      new Request('https://api.test/api/ec/admin/badges', {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Unsafe SVG',
          category: 'achievement',
          rarity: 'rare',
          imageUrl: 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=',
        }),
      }),
      env
    );
    expect(badSvg.status).toBe(400);

    // Accepts uploaded PNG image + Kaise Milega criteria + custom animation code + auto unlock rule
    const createRes = await handleApiRequest(
      new Request('https://api.test/api/ec/admin/badges', {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Physics Maharathi',
          description: 'Mastered Mechanics',
          criteria: 'Complete 2 Physics lectures with full attention',
          category: 'course_completion',
          rarity: 'legendary',
          imageUrl: samplePngDataUrl,
          animationPreset: 'custom',
          animationCode: BADGE_CODE_TEMPLATES[0].code,
          autoRule: { type: 'lectures_completed', target: 2 },
        }),
      }),
      env
    );
    expect(createRes.status).toBe(201);

    // Before completing 2 lectures: student sees locked badge in catalogue with progress 50%
    db.prepare(
      'INSERT INTO lesson_progress (id,firebase_uid,lecture_id,watched_seconds,completed) VALUES (?,?,?,?,?)'
    ).run('lp-1', 'stu-1', 'lec-1', 900, 1);

    const beforeUnlock = await (
      await handleApiRequest(
        new Request('https://api.test/api/ec/my/badges', { headers: { Authorization: `Bearer ${stuToken}` } }),
        env
      )
    ).json();
    expect(beforeUnlock.items).toHaveLength(0);
    expect(beforeUnlock.catalogue[0]).toMatchObject({
      title: 'Physics Maharathi',
      earned: false,
      currentValue: 1,
      targetValue: 2,
      progressPercent: 50,
    });

    // After completing 2nd lecture: badge unlocks automatically!
    db.prepare(
      'INSERT INTO lesson_progress (id,firebase_uid,lecture_id,watched_seconds,completed) VALUES (?,?,?,?,?)'
    ).run('lp-2', 'stu-1', 'lec-2', 1200, 1);

    const afterUnlock = await (
      await handleApiRequest(
        new Request('https://api.test/api/ec/my/badges', { headers: { Authorization: `Bearer ${stuToken}` } }),
        env
      )
    ).json();
    expect(afterUnlock.items).toHaveLength(1);
    expect(afterUnlock.items[0].title).toBe('Physics Maharathi');
    expect(afterUnlock.items[0].image_url).toBe(samplePngDataUrl);
  });

  it('scopes custom badge CSS keyframes cleanly and renders AnimatedBadge + BadgeShowcaseSection + StudentStudyHub', () => {
    const scoped = compileScopedBadgeCss(BADGE_CODE_TEMPLATES[0].code, 'testscope');
    expect(scoped).toContain('[data-badge-scope="testscope"] .badge-wrap');
    expect(scoped).toContain('@keyframes testscope-topperFloat');

    const html = renderToString(
      <AnimatedBadge
        badge={{
          title: 'Mock Topper',
          rarity: 'epic',
          category: 'test_performance',
          animation_preset: 'custom',
          animation_code: BADGE_CODE_TEMPLATES[1].code,
        }}
        size="lg"
      />
    );
    expect(html).toContain('ec-badge-emblem');
    expect(describeBadgeCriteria({ criteria: '', auto_rule: { type: 'lectures_completed', target: 5 } })).toContain('5 lectures');

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => {
      root.render(
        <div>
          <StudentStudyHub
            uid="stu-1"
            exam="JEE"
            enrolledCount={2}
            liveTestsCount={1}
            totalTestsCount={4}
            earnedBadgesCount={1}
            streak={5}
          />
          <BadgeShowcaseSection
            earnedBadges={[]}
            catalogue={[
              {
                id: 'b1',
                title: '7-Day Streak Star',
                description: 'Consistent ranker',
                criteria: 'Complete 7 lectures',
                category: 'consistency',
                rarity: 'rare',
                image_url: '',
                animation_preset: 'flame',
                animation_code: '',
                auto_rule: { type: 'lectures_completed', target: 7 },
                active: true,
                sort_order: 0,
                earned: false,
                awarded_at: null,
                reason: '',
                currentValue: 4,
                targetValue: 7,
                progressPercent: 57,
              },
            ]}
          />
        </div>
      );
    });
    mounted.push({
      unmount: () => {
        act(() => root.unmount());
        container.remove();
      },
    });
    expect(container.textContent).toContain('Focus Study Timer');
    expect(container.textContent).toContain("Today's Ranker Study Plan");
    expect(container.textContent).toContain('7-Day Streak Star');
  });

  it('removes activity history and duplicate admin navigation sections from Admin Console', () => {
    const slugs = ADMIN_SECTIONS.map((s) => s.slug);
    expect(slugs).not.toContain('reports');
    expect(slugs).not.toContain('classic');
    expect(slugs).not.toContain('campaigns');
    expect(slugs).not.toContain('scheduling');
    expect(slugs).not.toContain('batch-studio');
    expect(slugs).toEqual(expect.arrayContaining(['overview', 'subjects', 'batches', 'badges', 'tests', 'appearance']));
  });

  it('uploads images to Google Drive via /admin/drive/upload-image, serves them at /media/:id without leaking Drive file IDs, and accepts them across every image URL validator', async () => {
    const db = new DatabaseSync(':memory:');
    for (const file of [
      '0001_initial_schema.sql',
      '0002_subjects_and_drive_files.sql',
      '0005_badges.sql',
      '0006_badge_animations_and_rules.sql',
      '0007_drive_media_assets.sql',
    ]) {
      db.exec(readFileSync(resolve(process.cwd(), 'migrations', file), 'utf8'));
    }

    const pair = (await crypto.subtle.generateKey(
      { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
      true,
      ['sign', 'verify']
    )) as CryptoKeyPair;
    const jwk = await crypto.subtle.exportKey('jwk', pair.publicKey);
    const pkcs8 = new Uint8Array(await crypto.subtle.exportKey('pkcs8', pair.privateKey));
    const pem = `${['-----BEGIN', 'PRIVATE', 'KEY-----'].join(' ')}\n${Buffer.from(pkcs8).toString('base64')}\n${['-----END', 'PRIVATE', 'KEY-----'].join(' ')}`;

    const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('service_accounts/v1/jwk')) {
          return Response.json({ keys: [{ ...jwk, kid: 'k-drive', alg: 'RS256', use: 'sig' }] });
        }
        if (url.startsWith('https://oauth2.googleapis.com/token')) {
          return Response.json({ access_token: 'mock-drive-token', expires_in: 3600 });
        }
        if (url.includes('/upload/drive/v3/files')) {
          return Response.json({
            id: 'SECRET_GOOGLE_DRIVE_FILE_ID_999',
            name: 'uploaded.png',
            mimeType: 'image/png',
            size: pngBytes.length,
          });
        }
        if (url.includes('/drive/v3/files/SECRET_GOOGLE_DRIVE_FILE_ID_999')) {
          return new Response(pngBytes, { status: 200, headers: { 'Content-Type': 'image/png' } });
        }
        throw new Error(`Unexpected fetch: ${url}`);
      })
    );

    const sign = async (claims: Record<string, unknown>) => {
      const now = Math.floor(Date.now() / 1000);
      const h = Buffer.from(JSON.stringify({ alg: 'RS256', kid: 'k-drive', typ: 'JWT' })).toString('base64url');
      const p = Buffer.from(
        JSON.stringify({ aud: 'darvo1', iss: 'https://securetoken.google.com/darvo1', iat: now, exp: now + 3600, ...claims })
      ).toString('base64url');
      const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', pair.privateKey, new TextEncoder().encode(`${h}.${p}`));
      return `${h}.${p}.${Buffer.from(new Uint8Array(sig)).toString('base64url')}`;
    };

    const adminToken = await sign({ sub: 'admin-uid', email: 'arvinddarabishnoi@gmail.com' });
    const stuToken = await sign({ sub: 'stu-uid', email: 'student@example.com' });
    const env = {
      DB: createD1Binding(db),
      GOOGLE_SERVICE_ACCOUNT_JSON: JSON.stringify({
        client_email: 'drive-bot@darvo1.iam.gserviceaccount.com',
        private_key: pem,
      }),
      GOOGLE_DRIVE_FOLDER_ID: '1FolderIdForSiteAssetsXYZ',
    };

    const makeMultipart = (fileBytes: Uint8Array, filename: string, mime: string, extra?: Record<string, string>) => {
      const boundary = 'ecTestBoundary789';
      const enc = new TextEncoder();
      const parts: Uint8Array[] = [];
      for (const [k, v] of Object.entries(extra || {})) {
        parts.push(enc.encode(`--${boundary}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`));
      }
      parts.push(
        enc.encode(
          `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: ${mime}\r\n\r\n`
        ),
        fileBytes,
        enc.encode(`\r\n--${boundary}--\r\n`)
      );
      const total = parts.reduce((sum, p) => sum + p.length, 0);
      const body = new Uint8Array(total);
      let offset = 0;
      for (const p of parts) {
        body.set(p, offset);
        offset += p.length;
      }
      return { body, contentType: `multipart/form-data; boundary=${boundary}` };
    };

    // Non-admin rejected
    const deniedMp = makeMultipart(pngBytes, 'banner.png', 'image/png');
    const deniedRes = await handleApiRequest(
      new Request('https://api.test/api/ec/admin/drive/upload-image', {
        method: 'POST',
        headers: { Authorization: `Bearer ${stuToken}`, 'Content-Type': deniedMp.contentType },
        body: deniedMp.body,
      }),
      env
    );
    expect(deniedRes.status).toBe(403);

    // Non-image binary rejected with 415
    const fakeMp = makeMultipart(new TextEncoder().encode('<html>not an image</html>'), 'fake.png', 'image/png');
    const fakeRes = await handleApiRequest(
      new Request('https://api.test/api/ec/admin/drive/upload-image', {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': fakeMp.contentType },
        body: fakeMp.body,
      }),
      env
    );
    expect(fakeRes.status).toBe(415);

    // Genuine PNG uploaded to Google Drive -> returns /api/ec/media/<id> (never raw Drive ID!)
    const validMp = makeMultipart(pngBytes, 'hero-banner.png', 'image/png', { context: 'banner_desktop' });
    const uploadRes = await handleApiRequest(
      new Request('https://api.test/api/ec/admin/drive/upload-image', {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': validMp.contentType },
        body: validMp.body,
      }),
      env
    );
    expect(uploadRes.status).toBe(201);
    const uploadedPayload = await uploadRes.json();
    const mediaUrl = String(uploadedPayload.item.url);
    expect(mediaUrl).toMatch(/^\/api\/ec\/media\/[A-Za-z0-9_-]+$/);
    expect(mediaUrl).not.toContain('SECRET_GOOGLE_DRIVE_FILE_ID_999');

    // Public GET /api/ec/media/:id streams the image bytes directly for <img> tags without bearer auth
    const streamRes = await handleApiRequest(new Request(`https://api.test${mediaUrl}`), env);
    expect(streamRes.status).toBe(200);
    expect(streamRes.headers.get('Content-Type')).toBe('image/png');
    expect(new Uint8Array(await streamRes.arrayBuffer())).toEqual(pngBytes);

    // Every site/badge/question validator accepts /api/ec/media/<id> seamlessly
    expect(
      validateSettingValue('theme', { ...DEFAULT_SITE_CONFIG.theme, logoUrl: mediaUrl, faviconUrl: mediaUrl }).ok
    ).toBe(true);
    expect(
      validateQuestionsJson(
        JSON.stringify([
          {
            id: 'q1',
            text: 'Find equivalent capacitance:',
            imageUrl: mediaUrl,
            options: [
              { id: 'A', text: '2C' },
              { id: 'B', text: '4C' },
            ],
            correctAnswer: 'A',
          },
        ])
      ).valid
    ).toBe(true);

    // ImageField renders both URL input AND Google Drive Upload button
    const fieldHtml = renderToString(
      <ToastProvider>
        <ImageField label="Desktop Banner" value={mediaUrl} onChange={() => undefined} />
      </ToastProvider>
    );
    expect(fieldHtml).toContain('Google Drive');
    expect(fieldHtml).toContain('OR');
  });
});

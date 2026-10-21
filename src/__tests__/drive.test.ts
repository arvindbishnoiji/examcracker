import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  clearDriveTokenCache,
  deleteDriveFile,
  downloadDriveFile,
  getDriveAccessToken,
  uploadDriveFile,
} from '../../workers/ec-api/src/drive.js';

/**
 * Google Drive integration tests.
 *
 * Every test injects a fake fetch, so no credential or network request ever
 * leaves the test process. The RSA key below is generated at runtime and exists
 * only in memory.
 */

type FetchCall = { url: string; init: RequestInit };

function stubFetch(handler: (call: FetchCall) => Response | Promise<Response>) {
  const calls: FetchCall[] = [];
  const impl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const call = { url: String(input), init: init || {} };
    calls.push(call);
    return handler(call);
  });
  return { impl: impl as unknown as typeof fetch, calls };
}

function tokenResponse(token = 'test-access-token', expiresIn = 3600) {
  return new Response(JSON.stringify({ access_token: token, expires_in: expiresIn, token_type: 'Bearer' }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

const FOLDER = 'folder_1234567890';

function envWith(overrides: Record<string, unknown> = {}) {
  return {
    GOOGLE_SERVICE_ACCOUNT_JSON: JSON.stringify({
      client_email: 'exam-cracker@test-project.iam.gserviceaccount.com',
      private_key: PRIVATE_KEY_PEM,
    }),
    GOOGLE_DRIVE_FOLDER_ID: FOLDER,
    ...overrides,
  };
}

let PRIVATE_KEY_PEM = '';

beforeAll(async () => {
  const pair = await crypto.subtle.generateKey(
    {
      name: 'RSASSA-PKCS1-v1_5',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['sign', 'verify']
  );
  const pkcs8 = new Uint8Array(await crypto.subtle.exportKey('pkcs8', pair.privateKey));
  let binary = '';
  for (const byte of pkcs8) binary += String.fromCharCode(byte);
  const base64 = btoa(binary).replace(/(.{64})/g, '$1\n');
  PRIVATE_KEY_PEM = `-----BEGIN PRIVATE KEY-----\n${base64}\n-----END PRIVATE KEY-----\n`;
});

afterEach(() => {
  clearDriveTokenCache();
});

describe('Google Drive configuration errors', () => {
  it('returns an actionable 503 when the service-account secret is missing', async () => {
    await expect(getDriveAccessToken({})).rejects.toMatchObject({
      status: 503,
      message: expect.stringContaining('GOOGLE_SERVICE_ACCOUNT_JSON'),
    });
  });

  it('returns a 503 when the secret is not valid JSON', async () => {
    await expect(
      getDriveAccessToken({ GOOGLE_SERVICE_ACCOUNT_JSON: '{not-json' })
    ).rejects.toMatchObject({
      status: 503,
      message: expect.stringContaining('invalid'),
    });
  });

  it('requires client_email and private_key, never fabricating credentials', async () => {
    await expect(
      getDriveAccessToken({
        GOOGLE_SERVICE_ACCOUNT_JSON: JSON.stringify({ client_email: 'a@b.c' }),
      })
    ).rejects.toMatchObject({
      status: 503,
      message: expect.stringContaining('client_email'),
    });
  });

  it('refuses to upload before a destination folder is configured', async () => {
    const { impl } = stubFetch(() => tokenResponse());
    await expect(
      uploadDriveFile(
        {
          GOOGLE_SERVICE_ACCOUNT_JSON: JSON.stringify({
            client_email: 'a@b.c',
            private_key: PRIVATE_KEY_PEM,
          }),
        },
        { bytes: new Uint8Array([1, 2, 3]), mimeType: 'application/pdf', name: 'x.pdf', purpose: 'pdf', fetchImpl: impl }
      )
    ).rejects.toMatchObject({
      status: 503,
      message: expect.stringContaining('GOOGLE_DRIVE_FOLDER_ID'),
    });
  });
});

describe('Google Drive authentication', () => {
  it('exchanges a signed RS256 assertion for an access token', async () => {
    const { impl, calls } = stubFetch(() => tokenResponse('token-one'));
    const token = await getDriveAccessToken(envWith(), impl);
    expect(token).toBe('token-one');

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('https://oauth2.googleapis.com/token');
    expect(calls[0].init.method).toBe('POST');
    const body = String(calls[0].init.body);
    expect(body).toContain('grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer');

    const assertion = new URLSearchParams(body).get('assertion') || '';
    const [header, claims, signature] = assertion.split('.');
    expect(signature).toBeTruthy();
    const decodedHeader = JSON.parse(Buffer.from(header, 'base64url').toString('utf8'));
    const decodedClaims = JSON.parse(Buffer.from(claims, 'base64url').toString('utf8'));
    expect(decodedHeader.alg).toBe('RS256');
    expect(decodedClaims.iss).toBe('exam-cracker@test-project.iam.gserviceaccount.com');
    expect(decodedClaims.scope).toBe('https://www.googleapis.com/auth/drive');
    expect(decodedClaims.exp - decodedClaims.iat).toBe(3600);
  });

  it('reuses the cached token across calls instead of re-authenticating', async () => {
    const { impl, calls } = stubFetch(() => tokenResponse('cached'));
    const env = envWith();
    expect(await getDriveAccessToken(env, impl)).toBe('cached');
    expect(await getDriveAccessToken(env, impl)).toBe('cached');
    expect(calls).toHaveLength(1);
  });

  it('maps a Google auth rejection to a 502 without leaking the assertion', async () => {
    const { impl } = stubFetch(() => new Response('invalid_grant', { status: 400 }));
    const error = await getDriveAccessToken(envWith(), impl).catch((caught) => caught);
    expect(error.status).toBe(502);
    expect(error.message).toContain('Google HTTP 400');
    expect(error.message).not.toContain('PRIVATE KEY');
  });
});

describe('Google Drive upload', () => {
  it('uploads raw bytes as multipart and returns the Drive file id', async () => {
    const { impl, calls } = stubFetch((call) => {
      if (call.url.startsWith('https://oauth2.googleapis.com/token')) return tokenResponse();
      return new Response(JSON.stringify({ id: 'drive-file-1', name: 'notes.pdf', mimeType: 'application/pdf', size: '1234' }), {
        status: 200,
      });
    });

    const result = await uploadDriveFile(envWith(), {
      bytes: new Uint8Array([37, 80, 68, 70]),
      mimeType: 'application/pdf',
      name: 'notes.pdf',
      purpose: 'pdf',
      fetchImpl: impl,
    });

    expect(result).toMatchObject({ id: 'drive-file-1', name: 'notes.pdf', mimeType: 'application/pdf' });
    const uploadCall = calls.find((call) => call.url.includes('/upload/drive/v3/files'));
    expect(uploadCall).toBeTruthy();
    expect(uploadCall?.url).toContain('uploadType=multipart');
    expect(uploadCall?.url).toContain('supportsAllDrives=true');
    const headers = uploadCall?.init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer test-access-token');
    const body = uploadCall?.init.body as Uint8Array;
    expect(new TextDecoder().decode(body)).toContain(`"parents":["${FOLDER}"]`);
    expect(String(uploadCall?.init.headers && (uploadCall?.init.headers as Record<string, string>)['Content-Type'])).toContain(
      'multipart/related; boundary='
    );
  });

  it('uses the purpose-specific folder when configured', async () => {
    const { impl, calls } = stubFetch((call) => {
      if (call.url.startsWith('https://oauth2.googleapis.com/token')) return tokenResponse();
      return new Response(JSON.stringify({ id: 'photo-1', name: 'p.png', mimeType: 'image/png' }), { status: 200 });
    });
    await uploadDriveFile(envWith({ GOOGLE_DRIVE_PROFILE_FOLDER_ID: 'photo-folder' }), {
      bytes: new Uint8Array([1]),
      mimeType: 'image/png',
      name: 'p.png',
      purpose: 'profile_photo',
      fetchImpl: impl,
    });
    const uploadCall = calls.find((call) => call.url.includes('/upload/'));
    expect(new TextDecoder().decode(uploadCall?.init.body as Uint8Array)).toContain('"parents":["photo-folder"]');
  });

  it('reports a Google upload failure and never claims the file was saved', async () => {
    const { impl } = stubFetch((call) => {
      if (call.url.startsWith('https://oauth2.googleapis.com/token')) return tokenResponse();
      return new Response('quota exceeded', { status: 403 });
    });
    await expect(
      uploadDriveFile(envWith(), {
        bytes: new Uint8Array([1, 2]),
        mimeType: 'application/pdf',
        name: 'x.pdf',
        purpose: 'pdf',
        fetchImpl: impl,
      })
    ).rejects.toMatchObject({ status: 502, message: expect.stringContaining('not saved') });
  });

  it('rejects empty byte arrays before contacting Google', async () => {
    const { impl, calls } = stubFetch(() => tokenResponse());
    await expect(
      uploadDriveFile(envWith(), {
        bytes: new Uint8Array(),
        mimeType: 'application/pdf',
        name: 'x.pdf',
        purpose: 'pdf',
        fetchImpl: impl,
      })
    ).rejects.toMatchObject({ status: 400 });
    expect(calls).toHaveLength(0);
  });
});

describe('Google Drive private reads and cleanup', () => {
  it('downloads with alt=media and forwards the authorized stream', async () => {
    const { impl, calls } = stubFetch((call) => {
      if (call.url.startsWith('https://oauth2.googleapis.com/token')) return tokenResponse();
      return new Response('PDF-BYTES', { status: 200, headers: { 'Content-Type': 'application/pdf' } });
    });
    const response = await downloadDriveFile(envWith(), 'drive/file id', impl);
    expect(await response.text()).toBe('PDF-BYTES');
    const downloadCall = calls.find((call) => call.url.includes('/drive/v3/files/'));
    expect(downloadCall?.url).toContain('/drive/v3/files/drive%2Ffile%20id?alt=media');
    expect(downloadCall?.url).toContain('supportsAllDrives=true');
    expect((downloadCall?.init.headers as Record<string, string>).Authorization).toBe('Bearer test-access-token');
  });

  it('maps a Drive read failure to a 502', async () => {
    const { impl } = stubFetch((call) => {
      if (call.url.startsWith('https://oauth2.googleapis.com/token')) return tokenResponse();
      return new Response('not found', { status: 404 });
    });
    await expect(downloadDriveFile(envWith(), 'missing', impl)).rejects.toMatchObject({
      status: 502,
      message: expect.stringContaining('404'),
    });
  });

  it('treats an already-missing Drive file as deleted and network errors as false', async () => {
    const { impl } = stubFetch((call) => {
      if (call.url.startsWith('https://oauth2.googleapis.com/token')) return tokenResponse();
      return new Response(null, { status: 404 });
    });
    expect(await deleteDriveFile(envWith(), 'gone', impl)).toBe(true);

    const failing = vi.fn(async () => {
      throw new Error('offline');
    }) as unknown as typeof fetch;
    expect(await deleteDriveFile(envWith(), 'gone', failing)).toBe(false);
  });
});

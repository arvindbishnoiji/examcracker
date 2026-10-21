/**
 * Google Drive server-side integration for the Exam Cracker Worker.
 *
 * The service account is read only from server-side Worker secrets:
 *   GOOGLE_SERVICE_ACCOUNT_JSON  (secret)
 *   GOOGLE_DRIVE_FOLDER_ID       (var or secret)
 *   GOOGLE_DRIVE_PROFILE_FOLDER_ID / GOOGLE_DRIVE_PDF_FOLDER_ID (optional)
 *
 * Nothing in this module writes credentials, access tokens or file bytes to
 * logs. Files are never shared publicly: the Worker verifies a Firebase ID
 * token and proxies authorized reads from Drive.
 */

const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const DRIVE_UPLOAD_ENDPOINT = "https://www.googleapis.com/upload/drive/v3/files";
const DRIVE_FILES_ENDPOINT = "https://www.googleapis.com/drive/v3/files";
const DEFAULT_SCOPE = "https://www.googleapis.com/auth/drive";
const TOKEN_SAFETY_WINDOW_MS = 60 * 1000;

/** Access tokens are cached per isolate and per service account/scope. */
const tokenCache = new Map();

function httpError(message, status = 500) {
  return Object.assign(new Error(message), { status });
}

function serviceAccount(env) {
  const raw = env && env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (typeof raw !== "string" || !raw.trim()) {
    throw httpError(
      "Google Drive is not configured. Set the GOOGLE_SERVICE_ACCOUNT_JSON Worker secret.",
      503
    );
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw httpError(
      "Google Drive credentials are invalid. The GOOGLE_SERVICE_ACCOUNT_JSON secret must contain the service-account JSON object.",
      503
    );
  }
  const clientEmail = parsed && typeof parsed.client_email === "string" ? parsed.client_email.trim() : "";
  const privateKey = parsed && typeof parsed.private_key === "string" ? parsed.private_key : "";
  if (!clientEmail || !privateKey.includes("PRIVATE KEY")) {
    throw httpError(
      "Google Drive credentials are incomplete. GOOGLE_SERVICE_ACCOUNT_JSON needs client_email and private_key.",
      503
    );
  }
  return { clientEmail, privateKey: privateKey.replace(/\\n/g, "\n") };
}

function folderFor(env, purpose) {
  const specific =
    purpose === "profile_photo"
      ? env.GOOGLE_DRIVE_PROFILE_FOLDER_ID
      : purpose === "pdf"
        ? env.GOOGLE_DRIVE_PDF_FOLDER_ID
        : "";
  const folderId = String(specific || env.GOOGLE_DRIVE_FOLDER_ID || "").trim();
  if (!folderId || /\s/.test(folderId)) {
    throw httpError(
      "Google Drive destination folder is not configured. Set GOOGLE_DRIVE_FOLDER_ID (or a purpose-specific folder ID).",
      503
    );
  }
  return folderId;
}

function scopeFor(env) {
  const scope = String(env.GOOGLE_DRIVE_SCOPE || DEFAULT_SCOPE).trim();
  return scope || DEFAULT_SCOPE;
}

function toUint8(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function base64url(bytes) {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64urlText(value) {
  return base64url(new TextEncoder().encode(value));
}

function pemToPkcs8(pem) {
  const body = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s+/g, "");
  if (!body) throw httpError("Google Drive credentials are invalid.", 503);
  return toUint8(body);
}

async function signedAssertion(env) {
  const { clientEmail, privateKey } = serviceAccount(env);
  const nowSeconds = Math.floor(Date.now() / 1000);
  const header = base64urlText(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64urlText(
    JSON.stringify({
      iss: clientEmail,
      scope: scopeFor(env),
      aud: TOKEN_ENDPOINT,
      iat: nowSeconds,
      exp: nowSeconds + 3600,
    })
  );
  const unsigned = `${header}.${claims}`;
  let key;
  try {
    key = await crypto.subtle.importKey(
      "pkcs8",
      pemToPkcs8(privateKey),
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["sign"]
    );
  } catch {
    throw httpError("Google Drive credentials are invalid. The service-account private key could not be read.", 503);
  }
  const signature = await crypto.subtle.sign(
    { name: "RSASSA-PKCS1-v1_5" },
    key,
    new TextEncoder().encode(unsigned)
  );
  return `${unsigned}.${base64url(new Uint8Array(signature))}`;
}

export function clearDriveTokenCache() {
  tokenCache.clear();
}

/** Returns a cached OAuth access token or exchanges a signed JWT for one. */
export async function getDriveAccessToken(env, fetchImpl = fetch) {
  const { clientEmail } = serviceAccount(env);
  const scope = scopeFor(env);
  const cacheKey = `${clientEmail}|${scope}`;
  const cached = tokenCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now() + TOKEN_SAFETY_WINDOW_MS) {
    return cached.token;
  }

  const assertion = await signedAssertion(env);
  const body = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion,
  });
  let response;
  try {
    response = await fetchImpl(TOKEN_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: body.toString(),
    });
  } catch {
    throw httpError("Google Drive authentication could not reach Google. Please retry.", 502);
  }
  if (!response.ok) {
    throw httpError(`Google Drive authentication failed (Google HTTP ${response.status}).`, 502);
  }
  const payload = await response.json().catch(() => null);
  const token = payload && typeof payload.access_token === "string" ? payload.access_token : "";
  const expiresIn = Number(payload && payload.expires_in);
  if (!token) throw httpError("Google Drive authentication returned no access token.", 502);
  const lifetimeMs = Number.isFinite(expiresIn) && expiresIn > 0 ? expiresIn * 1000 : 50 * 60 * 1000;
  tokenCache.set(cacheKey, { token, expiresAt: Date.now() + lifetimeMs });
  return token;
}

/**
 * Uploads bytes with the Drive v3 multipart/related upload endpoint.
 * The bytes are never converted to Base64 or written to D1.
 */
export async function uploadDriveFile(
  env,
  { bytes, mimeType, name, purpose, fetchImpl = fetch }
) {
  if (!(bytes instanceof Uint8Array) || bytes.length === 0) {
    throw httpError("The selected file is empty.", 400);
  }
  const folderId = folderFor(env, purpose);
  const token = await getDriveAccessToken(env, fetchImpl);

  const boundary = `examcracker_${crypto.randomUUID().replace(/-/g, "")}`;
  const metadata = JSON.stringify({ name, mimeType, parents: [folderId] });
  const encoder = new TextEncoder();
  const head = encoder.encode(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n` +
      `--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`
  );
  const tail = encoder.encode(`\r\n--${boundary}--\r\n`);
  const body = new Uint8Array(head.length + bytes.length + tail.length);
  body.set(head, 0);
  body.set(bytes, head.length);
  body.set(tail, head.length + bytes.length);

  const url =
    `${DRIVE_UPLOAD_ENDPOINT}?uploadType=multipart&supportsAllDrives=true` +
    `&fields=id,name,mimeType,size`;
  let response;
  try {
    response = await fetchImpl(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
        Accept: "application/json",
      },
      body,
    });
  } catch {
    throw httpError("Google Drive upload could not reach Google. The file was not saved.", 502);
  }
  if (!response.ok) {
    throw httpError(`Google Drive upload failed (Google HTTP ${response.status}). The file was not saved.`, 502);
  }
  const payload = await response.json().catch(() => null);
  const id = payload && typeof payload.id === "string" ? payload.id : "";
  if (!id) throw httpError("Google Drive did not confirm the uploaded file.", 502);
  return {
    id,
    name: payload.name || name,
    mimeType: payload.mimeType || mimeType,
    size: Number(payload.size) || bytes.length,
  };
}

/** Downloads file bytes from Drive with the service account's credentials. */
export async function downloadDriveFile(env, driveFileId, fetchImpl = fetch) {
  const token = await getDriveAccessToken(env, fetchImpl);
  const url = `${DRIVE_FILES_ENDPOINT}/${encodeURIComponent(driveFileId)}?alt=media&supportsAllDrives=true`;
  let response;
  try {
    response = await fetchImpl(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: "*/*" },
    });
  } catch {
    throw httpError("Google Drive could not be reached while reading this file.", 502);
  }
  if (!response.ok) {
    throw httpError(`This file could not be read from Google Drive (Google HTTP ${response.status}).`, 502);
  }
  return response;
}

/**
 * Deletes a Drive file. A missing file is treated as already deleted.
 * Never used for user-facing authorization, only cleanup/replacement.
 */
export async function deleteDriveFile(env, driveFileId, fetchImpl = fetch) {
  const token = await getDriveAccessToken(env, fetchImpl);
  const url = `${DRIVE_FILES_ENDPOINT}/${encodeURIComponent(driveFileId)}?supportsAllDrives=true`;
  let response;
  try {
    response = await fetchImpl(url, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    return false;
  }
  return response.ok || response.status === 404;
}

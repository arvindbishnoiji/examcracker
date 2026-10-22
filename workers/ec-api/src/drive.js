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

import { inspectAppsScriptDriveStatus, isAppsScriptDriveConfigured, uploadViaAppsScript } from "./apps-script-drive.js";

const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const DRIVE_UPLOAD_ENDPOINT = "https://www.googleapis.com/upload/drive/v3/files";
const DRIVE_FILES_ENDPOINT = "https://www.googleapis.com/drive/v3/files";
const DRIVE_FOLDER_MIME = "application/vnd.google-apps.folder";
const DEFAULT_SCOPE = "https://www.googleapis.com/auth/drive";
const TOKEN_SAFETY_WINDOW_MS = 60 * 1000;

/** Access tokens are cached per isolate and per service account/scope. */
const tokenCache = new Map();

function httpError(message, status = 500, extra = {}) {
  return Object.assign(new Error(message), { status, ...extra });
}

/**
 * Extracts a clean Google Drive folder ID from either a raw ID or a full Drive
 * folder URL (e.g. https://drive.google.com/drive/folders/1sSYE5cAY6jjAgzOYTgCQNOR1xxotc_I8?usp=sharing),
 * stripping accidental surrounding quotes or whitespace.
 */
export function normalizeDriveFolderId(rawValue) {
  if (typeof rawValue !== "string") return "";
  let cleaned = rawValue.trim().replace(/^["']+|["']+$/g, "").trim();
  if (!cleaned) return "";

  const folderPathMatch = cleaned.match(/\/folders\/([A-Za-z0-9_-]{3,160})(?:[/?#]|$)/i);
  if (folderPathMatch) {
    cleaned = folderPathMatch[1];
  } else if (/^https?:\/\//i.test(cleaned)) {
    try {
      const parsedUrl = new URL(cleaned);
      const idParam = parsedUrl.searchParams.get("id") || "";
      if (/^[A-Za-z0-9_-]{3,160}$/.test(idParam)) {
        cleaned = idParam;
      } else {
        return "";
      }
    } catch {
      return "";
    }
  }

  if (!/^[A-Za-z0-9_-]{3,160}$/.test(cleaned)) {
    return "";
  }
  return cleaned;
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
  const impersonateEmail = String((env && env.GOOGLE_DRIVE_IMPERSONATE_EMAIL) || "").trim();
  if (impersonateEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(impersonateEmail)) {
    throw httpError(
      "Google Drive delegation email is invalid. Set GOOGLE_DRIVE_IMPERSONATE_EMAIL to a valid Google Workspace user email or leave it unset.",
      503
    );
  }
  return {
    clientEmail,
    privateKey: privateKey.replace(/\\n/g, "\n"),
    impersonateEmail,
  };
}

function folderFor(env, purpose) {
  const specificRaw =
    purpose === "profile_photo"
      ? env && env.GOOGLE_DRIVE_PROFILE_FOLDER_ID
      : purpose === "pdf"
        ? env && env.GOOGLE_DRIVE_PDF_FOLDER_ID
        : "";
  const chosenRaw = String(specificRaw || (env && env.GOOGLE_DRIVE_FOLDER_ID) || "").trim();
  const folderId = normalizeDriveFolderId(chosenRaw);
  if (!folderId) {
    throw httpError(
      chosenRaw
        ? "Google Drive destination folder ID is malformed. Set GOOGLE_DRIVE_FOLDER_ID to the Drive folder ID (not an invalid URL)."
        : "Google Drive destination folder is not configured. Set GOOGLE_DRIVE_FOLDER_ID (or a purpose-specific folder ID).",
      503
    );
  }
  return folderId;
}

function scopeFor(env) {
  const scope = String((env && env.GOOGLE_DRIVE_SCOPE) || DEFAULT_SCOPE).trim();
  return scope || DEFAULT_SCOPE;
}

function isRestrictedDriveFileScope(scope) {
  return /(?:^|\s)https:\/\/www\.googleapis\.com\/auth\/drive\.file(?:\s|$)/.test(scope) &&
    !/(?:^|\s)https:\/\/www\.googleapis\.com\/auth\/drive(?:\s|$)/.test(scope);
}

/**
 * Safely extracts structured error details from a Google API error response
 * without ever echoing credentials, tokens, or raw HTML stack traces.
 */
function parseGoogleDriveError(rawText) {
  if (typeof rawText !== "string" || !rawText.trim()) {
    return { reason: "", message: "" };
  }
  try {
    const parsed = JSON.parse(rawText);
    const errObj = parsed && typeof parsed.error === "object" ? parsed.error : null;
    if (!errObj) {
      return { reason: "", message: "" };
    }
    const firstErr = Array.isArray(errObj.errors) && errObj.errors[0] ? errObj.errors[0] : {};
    const reason = typeof firstErr.reason === "string" ? firstErr.reason.trim().slice(0, 80) : "";
    const message = typeof errObj.message === "string"
      ? errObj.message.replace(/[\r\n]+/g, " ").trim().slice(0, 220)
      : "";
    return { reason, message };
  } catch {
    return { reason: "", message: "" };
  }
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
  const { clientEmail, privateKey, impersonateEmail } = serviceAccount(env);
  const nowSeconds = Math.floor(Date.now() / 1000);
  const header = base64urlText(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64urlText(
    JSON.stringify({
      iss: clientEmail,
      ...(impersonateEmail ? { sub: impersonateEmail } : {}),
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
  const { clientEmail, impersonateEmail } = serviceAccount(env);
  const scope = scopeFor(env);
  const cacheKey = `${clientEmail}|${impersonateEmail || "service-account"}|${scope}`;
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
 * Queries metadata for a configured Drive folder to pinpoint 404 / 403 causes
 * (unshared folder, trashed folder, non-folder file ID, or read-only role).
 */
export async function probeDriveFolder(env, folderId, token, fetchImpl = fetch) {
  const cleanId = normalizeDriveFolderId(folderId);
  if (!cleanId) {
    return {
      ok: false,
      httpStatus: 400,
      code: "INVALID_FOLDER_ID",
      detail: "Configured GOOGLE_DRIVE_FOLDER_ID is empty or malformed.",
    };
  }
  const authToken = token || (await getDriveAccessToken(env, fetchImpl));
  const url =
    `${DRIVE_FILES_ENDPOINT}/${encodeURIComponent(cleanId)}` +
    `?supportsAllDrives=true&fields=id,name,mimeType,trashed,driveId,capabilities(canAddChildren)`;
  const response = await fetchImpl(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${authToken}`,
      Accept: "application/json",
    },
  });
  if (!response.ok) {
    const raw = await response.text().catch(() => "");
    const parsed = parseGoogleDriveError(raw);
    const scope = scopeFor(env);
    if (response.status === 404) {
      return {
        ok: false,
        httpStatus: 404,
        code: isRestrictedDriveFileScope(scope) ? "RESTRICTED_OAUTH_SCOPE" : "FOLDER_NOT_FOUND_OR_UNSHARED",
        reason: parsed.reason || "notFound",
        detail: isRestrictedDriveFileScope(scope)
          ? "GOOGLE_DRIVE_SCOPE is set to drive.file, which hides folders shared with the service account. Remove GOOGLE_DRIVE_SCOPE or set it to https://www.googleapis.com/auth/drive."
          : `Google Drive could not find folder "${cleanId}" for this service account. Share the folder with the service account email as Editor (or Content Manager on a Shared Drive) and verify GOOGLE_DRIVE_FOLDER_ID.`,
      };
    }
    return {
      ok: false,
      httpStatus: response.status,
      code: "FOLDER_ACCESS_DENIED",
      reason: parsed.reason || "forbidden",
      detail:
        parsed.message ||
        `Google Drive rejected folder access (Google HTTP ${response.status}). Grant the service account Editor / Content Manager access to folder "${cleanId}".`,
    };
  }

  const meta = await response.json().catch(() => null);
  if (!meta || typeof meta.id !== "string") {
    return {
      ok: false,
      httpStatus: 502,
      code: "INVALID_DRIVE_RESPONSE",
      detail: "Google Drive returned an empty metadata response for the configured folder.",
    };
  }
  if (meta.mimeType && meta.mimeType !== DRIVE_FOLDER_MIME) {
    return {
      ok: false,
      httpStatus: 400,
      code: "NOT_A_FOLDER",
      folderName: meta.name || "",
      mimeType: meta.mimeType,
      detail: `GOOGLE_DRIVE_FOLDER_ID ("${cleanId}") points to a file (${meta.mimeType}), not a Google Drive folder.`,
    };
  }
  if (meta.trashed === true) {
    return {
      ok: false,
      httpStatus: 400,
      code: "FOLDER_TRASHED",
      folderName: meta.name || "",
      detail: `Google Drive folder "${meta.name || cleanId}" is in Trash. Restore it in Google Drive or update GOOGLE_DRIVE_FOLDER_ID.`,
    };
  }
  const canAddChildren =
    meta.capabilities && typeof meta.capabilities.canAddChildren === "boolean"
      ? meta.capabilities.canAddChildren
      : true;
  if (!canAddChildren) {
    return {
      ok: false,
      httpStatus: 403,
      code: "READ_ONLY_FOLDER_PERMISSION",
      folderName: meta.name || "",
      detail: `The service account only has Viewer/Commenter access to folder "${meta.name || cleanId}". Change its Google Drive sharing role to Editor (or Content Manager on a Shared Drive).`,
    };
  }

  return {
    ok: true,
    httpStatus: 200,
    code: "READY",
    folderId: meta.id,
    folderName: meta.name || "",
    sharedDrive: Boolean(meta.driveId),
    canAddChildren: true,
  };
}

function buildUploadFailureMessage(status, folderId, env, parsedError, probeResult) {
  const scope = scopeFor(env);
  if (probeResult && !probeResult.ok && probeResult.detail) {
    return `Google Drive upload failed (Google HTTP ${status}): ${probeResult.detail} The file was not saved.`;
  }
  if (status === 404) {
    if (isRestrictedDriveFileScope(scope)) {
      return (
        `Google Drive upload failed (Google HTTP 404): GOOGLE_DRIVE_SCOPE uses drive.file, ` +
        `so the service account cannot see shared folder "${folderId}". Use https://www.googleapis.com/auth/drive. The file was not saved.`
      );
    }
    return (
      `Google Drive upload failed (Google HTTP 404): Target folder "${folderId}" was not found or has not been shared ` +
      `with the configured service account as Editor / Content Manager. The file was not saved.`
    );
  }
  if (status === 403) {
    if (parsedError.reason === "storageQuotaExceeded" || /storage quota/i.test(parsedError.message)) {
      return (
        `Google Drive upload failed (Google HTTP 403): Service account storage quota exceeded. ` +
        `Use a Google Shared Drive folder (recommended) or verify workspace delegation. The file was not saved.`
      );
    }
    if (parsedError.reason === "accessNotConfigured" || /has not been used in project/i.test(parsedError.message)) {
      return (
        `Google Drive upload failed (Google HTTP 403): Enable the Google Drive API in the Google Cloud project ` +
        `that owns the service account. The file was not saved.`
      );
    }
    if (parsedError.reason === "insufficientFilePermissions") {
      return (
        `Google Drive upload failed (Google HTTP 403): The service account lacks Editor / Content Manager permission ` +
        `on folder "${folderId}". The file was not saved.`
      );
    }
  }
  const suffix = parsedError.reason ? ` [${parsedError.reason}]` : "";
  return `Google Drive upload failed (Google HTTP ${status}${suffix}). The file was not saved.`;
}

/**
 * Inspects server-side Google Drive configuration for the admin health panel.
 * Never returns private keys, tokens, or raw secret JSON.
 */
export async function inspectDriveStatus(env, { probe = false, fetchImpl = fetch } = {}) {
  const defaultFolderId = normalizeDriveFolderId(String((env && env.GOOGLE_DRIVE_FOLDER_ID) || ""));
  const pdfFolderId = normalizeDriveFolderId(String((env && env.GOOGLE_DRIVE_PDF_FOLDER_ID) || ""));
  const profileFolderId = normalizeDriveFolderId(String((env && env.GOOGLE_DRIVE_PROFILE_FOLDER_ID) || ""));
  const effectivePdfFolder = pdfFolderId || defaultFolderId;
  const effectiveProfileFolder = profileFolderId || defaultFolderId;
  const scope = scopeFor(env);
  const scopeWarning = isRestrictedDriveFileScope(scope)
    ? "GOOGLE_DRIVE_SCOPE is set to drive.file; use https://www.googleapis.com/auth/drive so shared folders are visible."
    : null;

  let accountInfo = null;
  let credentialError = null;
  try {
    const { clientEmail } = serviceAccount(env);
    accountInfo = { clientEmail };
  } catch (err) {
    credentialError = err instanceof Error ? err.message : "Service account is not configured.";
  }

  const appsScriptConfigured = isAppsScriptDriveConfigured(env);
  const configured = Boolean(
    (appsScriptConfigured || accountInfo) &&
      (defaultFolderId || (pdfFolderId && profileFolderId)) &&
      (appsScriptConfigured || !scopeWarning)
  );
  const result = {
    configured,
    serviceAccountConfigured: Boolean(accountInfo),
    uploadMode: appsScriptConfigured ? "personal-gmail-apps-script" : "service-account",
    appsScriptConfigured,
    serviceAccountEmail: accountInfo ? accountInfo.clientEmail : null,
    workspaceDelegationConfigured: Boolean(
      String((env && env.GOOGLE_DRIVE_IMPERSONATE_EMAIL) || "").trim()
    ),
    impersonatedUserEmail: String((env && env.GOOGLE_DRIVE_IMPERSONATE_EMAIL) || "").trim() || null,
    folderIdConfigured: Boolean(defaultFolderId || pdfFolderId || profileFolderId),
    folderId: defaultFolderId || null,
    pdfFolderId: effectivePdfFolder || null,
    profileFolderId: effectiveProfileFolder || null,
    scope,
    scopeWarning,
    credentialError,
    probe: null,
  };

  if (probe && appsScriptConfigured && effectivePdfFolder) {
    result.probe = await inspectAppsScriptDriveStatus(env, effectivePdfFolder, fetchImpl);
  } else if (probe && accountInfo && effectivePdfFolder) {
    try {
      const token = await getDriveAccessToken(env, fetchImpl);
      result.probe = await probeDriveFolder(env, effectivePdfFolder, token, fetchImpl);
    } catch (err) {
      result.probe = {
        ok: false,
        httpStatus: err && typeof err.status === "number" ? err.status : 502,
        code: "AUTH_OR_NETWORK_ERROR",
        detail: err instanceof Error ? err.message : "Could not verify Google Drive folder.",
      };
    }
  }

  return result;
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
  // Personal Gmail uploads must be created by the account owner through Apps Script;
  // service-account uploads to personal My Drive fail with storageQuotaExceeded.
  if (env?.GOOGLE_APPS_SCRIPT_URL || env?.GOOGLE_APPS_SCRIPT_SHARED_SECRET) {
    return uploadViaAppsScript(env, { bytes, mimeType, name, purpose, folderId, fetchImpl });
  }
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
    const rawError = await response.text().catch(() => "");
    const parsedError = parseGoogleDriveError(rawError);
    let probeResult = null;
    if (response.status === 404 || response.status === 403) {
      try {
        probeResult = await probeDriveFolder(env, folderId, token, fetchImpl);
      } catch {
        probeResult = null;
      }
    }
    throw httpError(
      buildUploadFailureMessage(response.status, folderId, env, parsedError, probeResult),
      502,
      {
        driveHttpStatus: response.status,
        driveReason: (probeResult && probeResult.code) || parsedError.reason || undefined,
      }
    );
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
    const rawError = await response.text().catch(() => "");
    const parsedError = parseGoogleDriveError(rawError);
    const detail =
      response.status === 404
        ? " The file was not found in Google Drive or the service account no longer has access to it."
        : parsedError.reason
          ? ` [${parsedError.reason}]`
          : "";
    throw httpError(`This file could not be read from Google Drive (Google HTTP ${response.status}).${detail}`, 502);
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

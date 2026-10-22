/**
 * Google Apps Script bridge for uploads owned by a personal Gmail account.
 *
 * Apps Script executes as the Drive owner, so new files consume the owner's
 * My Drive quota instead of a service account's nonexistent personal quota.
 * The endpoint URL and shared secret must remain server-side secrets.
 */
import { normalizeDriveFolderId } from "./drive.js";

const MAX_SCRIPT_UPLOAD_BYTES = 20 * 1024 * 1024;

function httpError(message, status = 502) {
  return Object.assign(new Error(message), { status });
}

function scriptConfig(env) {
  const url = String(env?.GOOGLE_APPS_SCRIPT_URL || "").trim();
  const secret = String(env?.GOOGLE_APPS_SCRIPT_SHARED_SECRET || "").trim();
  if (!url || !secret) {
    throw httpError(
      "Personal Gmail upload is not configured. Set GOOGLE_APPS_SCRIPT_URL and GOOGLE_APPS_SCRIPT_SHARED_SECRET as Cloudflare secrets.",
      503,
    );
  }
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw httpError("GOOGLE_APPS_SCRIPT_URL is invalid.", 503);
  }
  if (
    parsed.protocol !== "https:" ||
    parsed.hostname !== "script.google.com" ||
    !parsed.pathname.includes("/macros/s/") ||
    !parsed.pathname.endsWith("/exec")
  ) {
    throw httpError("GOOGLE_APPS_SCRIPT_URL must be a deployed https://script.google.com/macros/s/.../exec URL.", 503);
  }
  return { url: parsed.toString(), secret };
}

async function postToScript(env, payload, fetchImpl = fetch) {
  const config = scriptConfig(env);
  let response;
  try {
    response = await fetchImpl(config.url, {
      method: "POST",
      redirect: "manual",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ ...payload, secret: config.secret }),
    });
    // Apps Script ContentService commonly redirects its response to a
    // one-time script.googleusercontent.com URL. Follow that response as GET
    // only after the POST has executed, rather than resending the upload.
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers?.get?.("location");
      if (!location) throw httpError("Google Apps Script returned a redirect without a response URL.");
      const redirected = new URL(location, config.url);
      if (redirected.protocol !== "https:" || !/\.googleusercontent\.com$/i.test(redirected.hostname)) {
        throw httpError("Google Apps Script returned an unexpected response redirect.");
      }
      response = await fetchImpl(redirected.toString(), {
        method: "GET",
        headers: { Accept: "application/json" },
      });
    }
  } catch (error) {
    if (error && typeof error.status === "number") throw error;
    throw httpError("Google Apps Script upload service could not be reached. Please retry.");
  }
  const raw = await response.text().catch(() => "");
  let result;
  try {
    result = JSON.parse(raw);
  } catch {
    throw httpError("Google Apps Script returned an invalid response. Check that the Web App is deployed and accessible.");
  }
  if (!response.ok || result?.status !== "success") {
    const message = typeof result?.message === "string" ? result.message.slice(0, 300) : "";
    throw httpError(message || `Google Apps Script rejected the request (HTTP ${response.status}).`);
  }
  return result;
}

function toBase64(bytes) {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}

export function isAppsScriptDriveConfigured(env) {
  try {
    scriptConfig(env);
    return true;
  } catch {
    return false;
  }
}

export async function uploadViaAppsScript(
  env,
  { bytes, mimeType, name, purpose, folderId, fetchImpl = fetch },
) {
  if (!(bytes instanceof Uint8Array) || bytes.length === 0) {
    throw httpError("The selected file is empty.", 400);
  }
  if (bytes.length > MAX_SCRIPT_UPLOAD_BYTES) {
    throw httpError("This file is too large for the personal Gmail upload route (maximum 20 MB).", 413);
  }
  const cleanFolderId = normalizeDriveFolderId(folderId);
  if (!cleanFolderId) throw httpError("Google Drive destination folder ID is invalid.", 503);
  const result = await postToScript(env, {
    action: "upload",
    folderId: cleanFolderId,
    fileName: String(name || "upload").slice(0, 180),
    fileType: String(mimeType || "application/octet-stream").slice(0, 120),
    purpose: String(purpose || "file").slice(0, 40),
    base64Data: toBase64(bytes),
  }, fetchImpl);
  const id = typeof result.fileId === "string" ? result.fileId : "";
  if (!id) throw httpError("Google Apps Script did not confirm the uploaded file ID.");
  return {
    id,
    name: typeof result.fileName === "string" ? result.fileName : name,
    mimeType: typeof result.fileType === "string" ? result.fileType : mimeType,
    size: Number(result.sizeBytes) || bytes.length,
  };
}

export async function inspectAppsScriptDriveStatus(env, folderId, fetchImpl = fetch) {
  const cleanFolderId = normalizeDriveFolderId(folderId);
  if (!cleanFolderId) {
    return { ok: false, httpStatus: 400, code: "INVALID_FOLDER_ID", detail: "GOOGLE_DRIVE_FOLDER_ID is empty or malformed." };
  }
  try {
    const result = await postToScript(env, { action: "status", folderId: cleanFolderId }, fetchImpl);
    return {
      ok: true,
      httpStatus: 200,
      code: "READY",
      folderId: cleanFolderId,
      folderName: typeof result.folderName === "string" ? result.folderName : "",
      canAddChildren: result.canAddChildren === true,
      storageMode: "personal-gmail-apps-script",
    };
  } catch (error) {
    return {
      ok: false,
      httpStatus: Number(error?.status) || 502,
      code: "APPS_SCRIPT_ERROR",
      detail: error instanceof Error ? error.message : "Could not verify Apps Script folder access.",
    };
  }
}

/**
 * Pages API entry point.
 *
 * Use the Pages D1 binding directly when it exists. Older or incompletely
 * configured Pages environments may still only have the EXAM_CRACKER_WEB
 * service binding, which is already needed for dynamic Next.js page rendering.
 * Falling back to that authenticated Worker keeps signup/profile/bootstrap
 * requests — and Google Drive uploads/downloads when Drive secrets are stored
 * only on the Worker — working seamlessly.
 */
import { handleApiRequest } from "../workers/ec-api/src/index.js";

const jsonError = (error, detail) =>
  Response.json(
    { error, ...(detail ? { detail } : {}) },
    {
      status: 503,
      headers: {
        "cache-control": "no-store",
        "content-type": "application/json; charset=utf-8",
        "x-content-type-options": "nosniff",
      },
    },
  );

function requestApiPath(request) {
  try {
    return new URL(request.url).pathname.replace(/^\/api\/ec(?=\/|$)/, "") || "/";
  } catch {
    return "/";
  }
}

function isDriveBinaryOrStatusRoute(request) {
  const pathname = requestApiPath(request);
  return (
    pathname.startsWith("/drive/") ||
    pathname.startsWith("/admin/drive/") ||
    /^\/files\/[^/]+$/.test(pathname)
  );
}

function hasLocalServiceAccountCredentials(env) {
  return (
    typeof env?.GOOGLE_SERVICE_ACCOUNT_JSON === "string" &&
    Boolean(env.GOOGLE_SERVICE_ACCOUNT_JSON.trim())
  );
}

function hasLocalAppsScriptCredentials(env) {
  return (
    typeof env?.GOOGLE_APPS_SCRIPT_URL === "string" &&
    Boolean(env.GOOGLE_APPS_SCRIPT_URL.trim()) &&
    typeof env?.GOOGLE_APPS_SCRIPT_SHARED_SECRET === "string" &&
    Boolean(env.GOOGLE_APPS_SCRIPT_SHARED_SECRET.trim())
  );
}

function isAppsScriptUploadRoute(request) {
  if (request.method.toUpperCase() !== "POST") return false;
  const pathname = requestApiPath(request);
  return pathname === "/drive/profile-photo" || pathname === "/admin/drive/upload";
}

export async function onRequest({ request, env }) {
  const hasWorkerBinding = Boolean(
    env?.EXAM_CRACKER_WEB && typeof env.EXAM_CRACKER_WEB.fetch === "function"
  );

  // If Google Drive secrets live on exam-cracker-web rather than Pages env,
  // delegate Drive upload/download/status routes to the Worker before failing 503.
  // Apps Script only creates new files; downloads, delete/cleanup and status
  // still need the service account. Do not let local Apps Script upload
  // secrets accidentally make those other routes bypass a Worker that has
  // GOOGLE_SERVICE_ACCOUNT_JSON configured.
  const canUploadViaLocalAppsScript =
    hasLocalAppsScriptCredentials(env) && isAppsScriptUploadRoute(request);
  if (
    hasWorkerBinding &&
    isDriveBinaryOrStatusRoute(request) &&
    !hasLocalServiceAccountCredentials(env) &&
    !canUploadViaLocalAppsScript
  ) {
    try {
      return await env.EXAM_CRACKER_WEB.fetch(request);
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Backend Worker request failed.";
      return jsonError("Exam Cracker backend Worker is temporarily unavailable.", detail);
    }
  }

  if (env?.DB && typeof env.DB.prepare === "function") {
    return handleApiRequest(request, env);
  }

  // Compatibility path: do not allow missing Pages D1 configuration to strand
  // users after Firebase Auth succeeds. The Worker independently verifies the
  // Firebase ID token and uses its own configured D1 binding.
  if (hasWorkerBinding) {
    try {
      return await env.EXAM_CRACKER_WEB.fetch(request);
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Backend Worker request failed.";
      return jsonError("Exam Cracker backend Worker is temporarily unavailable.", detail);
    }
  }

  return jsonError(
    "Exam Cracker database is not configured for this deployment.",
    "Bind D1 database exam-cracker-db as DB, or configure the EXAM_CRACKER_WEB service binding to exam-cracker-web, then redeploy Pages.",
  );
}

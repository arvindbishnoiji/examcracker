/**
 * Pages API entry point.
 *
 * Use the Pages D1 binding directly when it exists. Older or incompletely
 * configured Pages environments may still only have the EXAM_CRACKER_WEB
 * service binding, which is already needed for dynamic Next.js page rendering.
 * Falling back to that authenticated Worker keeps signup/profile/bootstrap
 * requests working while the direct DB binding is configured.
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

export async function onRequest({ request, env }) {
  if (env?.DB && typeof env.DB.prepare === "function") {
    return handleApiRequest(request, env);
  }

  // Compatibility path: do not allow missing Pages D1 configuration to strand
  // users after Firebase Auth succeeds. The Worker independently verifies the
  // Firebase ID token and uses its own configured D1 binding.
  if (env?.EXAM_CRACKER_WEB && typeof env.EXAM_CRACKER_WEB.fetch === "function") {
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

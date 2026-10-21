/**
 * Production API entry point: run the authenticated API in a Pages Function
 * against the Pages D1 binding instead of forwarding every API request to
 * the separate exam-cracker-web Worker.
 *
 * The build script copies workers/ec-api/src/{index,drive}.js into _shared.
 * Keep the canonical implementation under workers/ec-api/src so local
 * Next.js development and the deployed Pages Function use the same handler.
 */
import { handleApiRequest } from "../../_shared/ec-api/index.js";

export async function onRequest({ request, env }) {
  if (!env?.DB || typeof env.DB.prepare !== "function") {
    return Response.json(
      {
        error: "Exam Cracker D1 database is not bound to this Pages Function.",
        detail: "Add the D1 binding named DB for exam-cracker-db, then redeploy Pages.",
      },
      {
        status: 503,
        headers: {
          "cache-control": "no-store",
          "content-type": "application/json; charset=utf-8",
          "x-content-type-options": "nosniff",
        },
      },
    );
  }

  try {
    return await handleApiRequest(request, env);
  } catch {
    return Response.json(
      { error: "Exam Cracker API is temporarily unavailable." },
      {
        status: 500,
        headers: {
          "cache-control": "no-store",
          "content-type": "application/json; charset=utf-8",
          "x-content-type-options": "nosniff",
        },
      },
    );
  }
}

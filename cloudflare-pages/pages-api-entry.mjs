/**
 * Direct-D1 Pages Function entry point.
 *
 * Build step bundles this module and the canonical authenticated API handler
 * into functions/api/ec/[[path]].js. The browser must never access D1 directly.
 */
import { handleApiRequest } from "../workers/ec-api/src/index.js";

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

  return handleApiRequest(request, env);
}

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { handleApiRequest } from "../../../../../workers/ec-api/src/index.js";

export const dynamic = "force-dynamic";

type ApiBindings = {
  DB?: {
    prepare: (...args: any[]) => any;
  };
  EXAM_CRACKER_WEB?: {
    fetch: (request: Request) => Promise<Response>;
  };
};

async function dispatch(request: Request): Promise<Response> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const bindings = env as unknown as ApiBindings;

    // Prefer the direct D1 path. Some existing Pages environments still lack
    // the DB binding while their EXAM_CRACKER_WEB service binding is configured.
    // In that case, proxy only as a compatibility fallback so sign-up/profile
    // requests do not fail until the Pages DB binding is configured.
    if (bindings.DB && typeof bindings.DB.prepare === "function") {
      return await handleApiRequest(request, bindings as ApiBindings & { DB: NonNullable<ApiBindings["DB"]> });
    }

    if (bindings.EXAM_CRACKER_WEB && typeof bindings.EXAM_CRACKER_WEB.fetch === "function") {
      return await bindings.EXAM_CRACKER_WEB.fetch(request);
    }

    return Response.json(
      {
        error: "Exam Cracker database is not configured for this deployment.",
        detail: "Bind D1 database exam-cracker-db as DB in Cloudflare Pages Production and Preview settings.",
      },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "D1 API is unavailable.";
    return Response.json(
      { error: "Exam Cracker D1 API is unavailable.", detail: message },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}

export const GET = dispatch;
export const POST = dispatch;
export const PATCH = dispatch;
export const DELETE = dispatch;
export const OPTIONS = dispatch;

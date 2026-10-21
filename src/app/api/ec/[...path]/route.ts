import { getCloudflareContext } from "@opennextjs/cloudflare";
import { handleApiRequest } from "../../../../../workers/ec-api/src/index.js";

export const dynamic = "force-dynamic";

async function dispatch(request: Request): Promise<Response> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    return await handleApiRequest(request, env as unknown as { DB: any });
  } catch (error) {
    // Fail closed: never pretend a write succeeded when the D1 binding is absent.
    const message = error instanceof Error ? error.message : "D1 API is unavailable.";
    return Response.json({ error: "Exam Cracker D1 API is unavailable.", detail: message }, { status: 503 });
  }
}

export const GET = dispatch;
export const POST = dispatch;
export const PATCH = dispatch;
export const DELETE = dispatch;
export const OPTIONS = dispatch;

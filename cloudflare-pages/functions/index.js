/**
 * Explicit root route for Cloudflare Pages.
 * Most request paths are handled by [[path]].js; this guarantees "/" is
 * proxied as well, regardless of optional catch-all root matching behavior.
 */
export async function onRequest({ request, env }) {
  const upstream = env?.EXAM_CRACKER_WEB;

  if (!upstream || typeof upstream.fetch !== "function") {
    return new Response(
      "Exam Cracker Pages is not connected to its backend Worker. Configure the EXAM_CRACKER_WEB service binding to exam-cracker-web, then redeploy.",
      {
        status: 503,
        headers: {
          "content-type": "text/plain; charset=utf-8",
          "cache-control": "no-store",
        },
      },
    );
  }

  try {
    return await upstream.fetch(request);
  } catch {
    return new Response("Exam Cracker backend is temporarily unavailable.", {
      status: 502,
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  }
}

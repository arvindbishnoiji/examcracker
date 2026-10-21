/**
 * Cloudflare Pages front door for Exam Cracker.
 *
 * Keep the full Next.js runtime on the existing OpenNext Worker; forwarding
 * the original Request preserves the requested *.pages.dev origin, URL path,
 * query string, HTTP method, headers, and streaming request body.
 *
 * Pages project binding required:
 *   Variable name: EXAM_CRACKER_WEB
 *   Service: exam-cracker-web
 */
export async function onRequest({ request, env }) {
  const upstream = env?.EXAM_CRACKER_WEB;

  if (!upstream || typeof upstream.fetch !== "function") {
    return new Response(
      "Exam Cracker Pages is not connected to its backend Worker. Add the EXAM_CRACKER_WEB service binding to the exam-cracker-web Worker, then redeploy.",
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

/**
 * Cloudflare Pages front door for Exam Cracker.
 *
 * Forward the original request to the existing OpenNext Worker so dynamic
 * Next.js routes keep working while examcrack.pages.dev remains the public URL.
 *
 * Required service binding:
 *   EXAM_CRACKER_WEB -> exam-cracker-web
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

# Exam Cracker on Cloudflare Pages

This directory is a **Pages front door**, not a static export of the Next.js app. Exam Cracker has dynamic lecture/test routes, so the full app continues running on the existing OpenNext Worker `exam-cracker-web`. The Pages Function forwards each request through a Cloudflare service binding and keeps the visitor on `examcrack.pages.dev`.

## Cloudflare Pages project settings

Import `arvindbishnoiji/examcracker` as a **Pages** project:

- **Project name:** `examcrack`
- **Framework preset:** `None`
- **Build command:** `echo "Exam Cracker Pages proxy ready"`
- **Build output directory:** `public`
- **Root directory (advanced):** `cloudflare-pages`

Do not choose **Next.js (Static HTML Export)**. Static export would not safely preserve the app's dynamic lecture/test routes and runtime behavior.

## Service binding

The included `wrangler.toml` defines `EXAM_CRACKER_WEB` → Worker `exam-cracker-web`. Make sure this Wrangler file is being used as the Pages project's configuration source of truth. If the dashboard project is not using the file, manually add the same **Service binding** under **Workers & Pages → examcrack → Settings → Functions → Bindings** for Production (and Preview if needed), then redeploy.

The backend Worker must already be deployed. The repository's deployment workflow requires configured GitHub Actions secrets and variables.

## Auth/API origin setup

The production origin `https://examcrack.pages.dev` is included in `supabase/functions/ec-site-api/index.ts` as a default allowed origin. The Pages front door forwards the visitor's original `Origin` header to the upstream Worker, so the site API must allow this exact origin for CORS preflight and settings writes.

- Add `examcrack.pages.dev` to Firebase Authentication → Settings → Authorized domains.
- `ALLOWED_ORIGINS` is additive and is only needed for other custom/preview origins; preserve existing values when updating that secret.
- The Supabase source change must be deployed separately to activate the allowlist fix. The website deployment workflow does not deploy Supabase functions.
- Public website URL: `https://examcrack.pages.dev`. The internal `exam-cracker-web` Worker is reached through the Pages `EXAM_CRACKER_WEB` service binding and must not expose a separate workers.dev URL.
- The separate `ec-content-api` media proxy remains unchanged.

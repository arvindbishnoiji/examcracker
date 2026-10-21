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

The production origin `https://examcrack.pages.dev` is in the Worker's `ALLOWED_ORIGINS`
set (`workers/ec-api/src/index.js`). The Pages front door forwards the visitor's
original `Origin` header to the upstream Worker, so that Worker must allow this
exact origin for CORS preflight and API writes.

- Add `examcrack.pages.dev` to Firebase Authentication → Settings → Authorized domains.
- To allow another custom/preview origin, edit the `ALLOWED_ORIGINS` set in the
  Worker and redeploy it with `wrangler deploy`.
- Public website URL: `https://examcrack.pages.dev`. The internal `exam-cracker-web`
  Worker is reached through the Pages `EXAM_CRACKER_WEB` service binding and must
  not expose a separate workers.dev URL (`workers_dev = false`).
- The Worker also needs the D1 binding and the Google Drive secrets described in
  `GOOGLE_DRIVE_SETUP.md`; Pages does not manage those.
- The separate `ec-content-api` media proxy remains unchanged.

# Exam Cracker on Cloudflare Pages

This directory is a **Pages front door**, not a static export of the Next.js app. Exam Cracker's dynamic lecture/test routes and D1 API run on the OpenNext Worker `exam-cracker-web`. The Pages Functions forward requests through a Cloudflare service binding so the visitor stays on `examcrack.pages.dev`.

## Cloudflare Pages project settings

The Pages project should use:

- **Project name:** `examcrack`
- **Framework preset:** `None`
- **Build command:** `echo "Exam Cracker Pages proxy ready"`
- **Build output directory:** `public`
- **Root directory (advanced):** `cloudflare-pages`

Do not choose **Next.js (Static HTML Export)**. Static export would not safely preserve the app's dynamic lecture/test routes and runtime behavior.

## Required dashboard service binding

The Pages project intentionally has **no `cloudflare-pages/wrangler.toml`** so environment variables and bindings can be managed from the Cloudflare dashboard.

Open **Workers & Pages → examcrack → Settings → Functions → Bindings** and add/verify this **Service binding** for **Production** (and Preview if it is used):

- **Variable name:** `EXAM_CRACKER_WEB`
- **Service:** `exam-cracker-web`

Save settings and redeploy Pages. Both `cloudflare-pages/functions/index.js` and `cloudflare-pages/functions/[[path]].js` return HTTP 503 with an explicit message if this binding is missing. Do not assume the binding exists until it has been verified in the dashboard.

The backend Worker must also be deployed. The root `wrangler.toml` configures that Worker and its D1 database binding `DB`; that is separate from the Pages service binding. The Worker additionally needs the remote D1 migrations and Google Drive secrets described in `D1_MIGRATION_RUNBOOK.md` and `GOOGLE_DRIVE_SETUP.md`.

## Auth/API origin setup

The Worker allows the production origin `https://examcrack.pages.dev`. Add `examcrack.pages.dev` to Firebase Authentication → Settings → Authorized domains. The Pages front door forwards requests to the Worker, which verifies Firebase ID tokens and enforces admin authorization server-side.

To allow another custom/preview origin, update the `ALLOWED_ORIGINS` set in `workers/ec-api/src/index.js` and redeploy the Worker.

- Public website URL: `https://examcrack.pages.dev`.
- The internal `exam-cracker-web` Worker is reached through the Pages `EXAM_CRACKER_WEB` service binding and should not expose a separate workers.dev URL (`workers_dev = false`).
- The separate `ec-content-api` media proxy remains unchanged.

## Environment variable distinction

Values prefixed with `NEXT_PUBLIC_*` used by the Next.js browser bundle are build-time values supplied to GitHub Actions in `.github/workflows/deploy.yml`. Adding them only to Cloudflare Pages runtime variables does not rewrite an already-built Next.js bundle. Private Google service-account credentials belong only in encrypted secrets on the `exam-cracker-web` Worker, never in `NEXT_PUBLIC_*` or this repository.

# Exam Cracker on Cloudflare Pages

This directory is a **Pages front door**, not a static export of the Next.js app. Exam Cracker uses dynamic Next.js routes, so the full app continues to run on the existing OpenNext Worker, `exam-cracker-web`. The Pages Function forwards requests to that Worker through a Cloudflare service binding, retaining the public `examcrack.pages.dev` origin.

## Cloudflare Pages project settings

Create/import the `arvindbishnoiji/examcracker` repository as a **Pages** project:

- **Project name:** `examcrack`
- **Framework preset:** `None`
- **Build command:** `echo "Exam Cracker Pages proxy ready"`
- **Build output directory:** `public`
- **Root directory (advanced):** `cloudflare-pages`

Do not choose Next.js Static HTML Export for this project: this folder proxies to the dynamic app instead of trying to export its dynamic lecture/test routes as static files.

## Service binding

The included `wrangler.toml` declares the Pages service binding `EXAM_CRACKER_WEB` → Worker `exam-cracker-web`. When the Pages project uses this Wrangler file as its configuration source of truth, the binding is versioned with the code. If the dashboard project is not using the Wrangler configuration, add the same binding manually at **Workers & Pages → examcrack → Settings → Functions → Bindings** for Production (and Preview if needed), then redeploy.

The backend Worker must already have been deployed. The repository's existing deploy workflow expects the GitHub Actions Cloudflare credentials to be configured.

## Auth/API origin setup

After `https://examcrack.pages.dev` is live:

- Add `examcrack.pages.dev` to Firebase Authentication → Settings → Authorized domains.
- Add `https://examcrack.pages.dev` to the Supabase Edge Function's `ALLOWED_ORIGINS` secret, preserving any existing allowed origins.

The separate `ec-content-api` media proxy remains unchanged.

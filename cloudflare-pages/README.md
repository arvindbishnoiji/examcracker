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

## Required service binding

After the Pages project is created:

1. Open **Workers & Pages → examcrack → Settings → Functions → Bindings**.
2. Add a **Service binding** for the **Production** environment (and Preview too if preview deployments should work).
3. Set **Variable name** to `EXAM_CRACKER_WEB`.
4. Select Worker **`exam-cracker-web`**.
5. Save and redeploy the Pages project.

The backend Worker must already have been deployed. The repository's existing deploy workflow expects the GitHub Actions Cloudflare credentials to be configured.

## Auth/API origin setup

After `https://examcrack.pages.dev` is live:

- Add `examcrack.pages.dev` to Firebase Authentication → Settings → Authorized domains.
- Add `https://examcrack.pages.dev` to the Supabase Edge Function's `ALLOWED_ORIGINS` secret, preserving any existing allowed origins.

The separate `ec-content-api` media proxy remains unchanged.

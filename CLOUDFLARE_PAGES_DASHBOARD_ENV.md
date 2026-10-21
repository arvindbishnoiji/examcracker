# Cloudflare Pages: dashboard-managed settings

The Pages project `examcrack` uses the `cloudflare-pages/` repository directory. Production API requests under `/api/ec/*` run in a Pages Function and access D1 through the `DB` binding. Dynamic Next.js page HTML still uses the `exam-cracker-web` service binding.

## Required dashboard configuration after this change

1. Open Cloudflare Dashboard → **Workers & Pages** → **examcrack** → **Settings**.
2. Under **Builds & deployments**, confirm:
   - Framework preset: `None`
   - Root directory: `cloudflare-pages`
   - Build command: `bash build.sh`
   - Build output directory: `public`
3. Under **Bindings**, add a **D1 database binding** for both Production and Preview environments as needed:
   - Variable name: `DB`
   - Database: `exam-cracker-db`
   - Database ID: `dbf2375d-a302-443f-83bf-df59e1d98177`
4. Under **Bindings**, keep/add the **Service** binding for dynamic Next.js page rendering:
   - Variable name: `EXAM_CRACKER_WEB`
   - Service: `exam-cracker-web`
5. Under **Variables and Secrets**, configure the server-only Google Drive values for the Pages Function, for Production (and Preview if used):
   - Secret: `GOOGLE_SERVICE_ACCOUNT_JSON`
   - Secret or encrypted variable: `GOOGLE_DRIVE_FOLDER_ID`
   - Optional existing values, only when configured: `GOOGLE_DRIVE_PROFILE_FOLDER_ID`, `GOOGLE_DRIVE_PDF_FOLDER_ID`, `GOOGLE_DRIVE_SCOPE`, `GOOGLE_DRIVE_MAX_PROFILE_PHOTO_MB`, `GOOGLE_DRIVE_MAX_PDF_MB`
6. Save settings and redeploy Pages so all bindings/secrets are active.

**Important:** Worker secrets are not automatically shared with Pages Functions. The Google Drive secret(s) used for protected profile-photo/PDF storage must be separately configured for Pages. Never commit the service-account JSON or put it in any `NEXT_PUBLIC_*` variable.

## Pages runtime settings vs. Next.js build settings

- The `DB` binding is runtime-only and is used by the Pages Function; the browser never connects to D1 directly.
- `EXAM_CRACKER_WEB` is still required for dynamic Next.js HTML and other server routes. The `/api/ec/*` API route no longer sends API calls through that service binding.
- Values prefixed with `NEXT_PUBLIC_` are embedded in browser JavaScript at build time when GitHub Actions runs `npm run build` / `npm run build:cloudflare`. Adding them only to Pages runtime settings does not change an already-built JavaScript bundle. Configure any custom public build values in GitHub Actions Variables/Secrets too.
- Pages Function requests still count against the Workers Free daily request allowance. Static assets excluded through `_routes.json` remain free and unlimited.

# Exam Cracker on Cloudflare Pages

This directory is the **public Pages front door** for Exam Cracker. Static assets are served directly from Pages. Production `/api/ec/*` requests run in a Pages Function and use the D1 binding `DB` directly. Other dynamic Next.js page HTML continues to use the OpenNext backend Worker `exam-cracker-web`.

## Cloudflare Pages build settings

Configure the Pages project `examcracker` in **Workers & Pages → examcracker → Settings → Builds & deployments**:

- **Framework preset:** `None`
- **Root directory:** `cloudflare-pages`
- **Build command:** `bash build.sh`
- **Build output directory:** `public`

The build script moves to the repository root, installs dependencies, runs `npm run build:cloudflare`, bundles `pages-api-entry.mjs` and the canonical API handler into a self-contained `functions/api/ec/[[path]].js`, then stages generated `.open-next/assets` files into the Pages output. It generates `_routes.json` so hashed JS/CSS and ordinary public images are served as static Pages assets. The more-specific API route handles requests directly with D1; the root catch-all remains for dynamic Next.js pages.

**Important:** the current source `public/_routes.json` intentionally remains a catch-all template for compatibility with the old `echo` build. The new build script replaces it *inside the build output* after staging assets. Therefore, the quota-saving behavior starts only after the Cloudflare Pages build command has been changed to `bash build.sh` and a new deployment succeeds.

Do not choose **Next.js (Static HTML Export)**. Dynamic lecture/test routes and server API handlers require the OpenNext backend.

## Environment variables

Set any custom **build-time public** values under Cloudflare Pages → Settings → Variables and Secrets, for Production and Preview as applicable. The build script has the existing project defaults, and dashboard variables override those defaults:

- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` (optional)
- `NEXT_PUBLIC_CLOUDFLARE_MEDIA_PROXY_URL`
- `NEXT_PUBLIC_ADMIN_EMAIL` (defaults to `arvinddarabishnoi@gmail.com`)
- `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED` (defaults to `true`)
- `NEXT_PUBLIC_SITE_URL` (defaults to `https://examcracker.pages.dev`)

All `NEXT_PUBLIC_*` values are embedded in browser JS at build time. **Never put private credentials, Google service-account JSON, or Cloudflare API tokens in these variables.** The backend Worker build also uses public config while rendering Next.js responses; if you override Firebase/media values, keep the same values in GitHub Actions repository Variables for its Worker deployment build.

## Direct D1 binding: Pages API → D1

Configure this binding for **Production and Preview** under **Workers & Pages → examcracker → Settings → Bindings → Add → D1 database**:

- **Variable name:** `DB`
- **Database:** `exam-cracker-db`
- **Database ID:** `dbf2375d-a302-443f-83bf-df59e1d98177`

Save the binding and redeploy Pages. The application must never connect to D1 from browser JavaScript; the Pages Function is the server-side boundary and verifies Firebase ID tokens before protected reads/writes.

Profile photos and PDFs still use private Google Drive in the shared API handler. Add the existing server-side secrets under the Pages project's **Settings → Variables and Secrets** for Production (and Preview if needed): `GOOGLE_SERVICE_ACCOUNT_JSON` and `GOOGLE_DRIVE_FOLDER_ID`. Add optional `GOOGLE_DRIVE_PROFILE_FOLDER_ID`, `GOOGLE_DRIVE_PDF_FOLDER_ID`, `GOOGLE_DRIVE_SCOPE`, `GOOGLE_DRIVE_MAX_PROFILE_PHOTO_MB`, and `GOOGLE_DRIVE_MAX_PDF_MB` only if those are configured in the current Worker. Keep these as server-only secrets/variables, never `NEXT_PUBLIC_*`. The existing Worker secrets do not automatically transfer to Pages.

## Service binding: Pages → backend Worker (still needed for page rendering)

Dynamic Next.js HTML still needs the OpenNext backend Worker. In **Workers & Pages → examcracker → Settings → Bindings**, keep:

- **Type:** Service
- **Variable name:** `EXAM_CRACKER_WEB`
- **Service:** `exam-cracker-web`

Add it to Production and Preview as needed, save, and redeploy. The root and catch-all Pages Function routes use this service binding for requests that are not static assets or `/api/ec/*` API calls.

## What uses Worker requests?

- **Static files** (hashed `/_next/static/*`, icons, fonts, and public images) are served directly by Pages and do not invoke Functions.
- **`/api/ec/*` requests** are handled by a Pages Function and access D1 directly. They no longer make an additional service-binding call to `exam-cracker-web`.
- **Dynamic page HTML and other Next.js server routes** still use `exam-cracker-web` through the service binding.
- Pages Function requests count toward the Workers Free request allowance. This removes the extra API-to-Worker hop; it does **not** make dynamic API requests unlimited.

## Backend resources

The root `wrangler.toml` continues to configure `exam-cracker-web` and its own D1 binding `DB` for server-rendered Next.js responses and local/backend fallback. Keep remote D1 migrations applied before deployment. The Google Drive secrets need to be configured for the Pages Function too, because a Pages binding cannot read another Worker's secrets. The separate `ec-content-api` YouTube metadata proxy remains unchanged.

The public origin `https://examcracker.pages.dev` must be listed in Firebase Authentication → Authorized domains. The separate `ec-content-api` media proxy remains unchanged.

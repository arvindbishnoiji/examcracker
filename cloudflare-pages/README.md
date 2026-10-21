# Exam Cracker on Cloudflare Pages

This directory is the **public Pages front door** for Exam Cracker. Next.js dynamic pages and the authenticated D1 API continue to run on the OpenNext backend Worker `exam-cracker-web`; Pages forwards only requests that require server execution.

## Cloudflare Pages build settings

Configure the Pages project `examcrack` in **Workers & Pages → examcrack → Settings → Builds & deployments**:

- **Framework preset:** `None`
- **Root directory:** `cloudflare-pages`
- **Build command:** `bash build.sh`
- **Build output directory:** `public`

The build script moves to the repository root, installs dependencies, runs `npm run build:cloudflare`, then copies the generated `.open-next/assets` files into the Pages output. It generates the deployed `_routes.json` so hashed JS/CSS and ordinary public images are served as static Pages assets instead of being forwarded to the backend.

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
- `NEXT_PUBLIC_SITE_URL` (defaults to `https://examcrack.pages.dev`)

All `NEXT_PUBLIC_*` values are embedded in browser JS at build time. **Never put private credentials, Google service-account JSON, or Cloudflare API tokens in these variables.** The backend Worker build also uses public config while rendering Next.js responses; if you override Firebase/media values, keep the same values in GitHub Actions repository Variables for its Worker deployment build.

## Service binding: Pages → backend Worker

Because there is no `cloudflare-pages/wrangler.toml`, configure this binding in the Cloudflare dashboard under **Settings → Functions → Bindings**:

- **Type:** Service
- **Variable name:** `EXAM_CRACKER_WEB`
- **Service:** `exam-cracker-web`

Add it to Production and Preview as needed, save, and redeploy. Both Pages Function routes return HTTP 503 with a clear error if this binding is missing.

## What uses Worker requests?

- **Static files** (hashed `/_next/static/*`, icons, fonts, and public images) are copied into Pages output and excluded from Function routing. These are served as static assets and do not invoke the Pages Function or backend Worker.
- **Dynamic page HTML and `/api/ec/*` requests** still use `exam-cracker-web` through the service binding. Those requests are required for server rendering, authentication, admin operations and D1 access, so they still consume backend/Function requests.
- Cloudflare Pages Functions requests count toward the Workers Free request allowance. Static assets are free and unlimited; Pages is not a way to make dynamic backend requests unlimited.

## Backend resources

The root `wrangler.toml` configures the backend Worker and its D1 binding `DB` to `exam-cracker-db`. The backend also requires successful remote D1 migrations. Profile-photo/PDF storage uses the encrypted Worker secrets `GOOGLE_SERVICE_ACCOUNT_JSON` and `GOOGLE_DRIVE_FOLDER_ID`; these remain on `exam-cracker-web`, not in Pages variables.

The public origin `https://examcrack.pages.dev` must be listed in Firebase Authentication → Authorized domains. The separate `ec-content-api` media proxy remains unchanged.

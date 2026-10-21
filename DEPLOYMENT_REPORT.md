# Cloudflare deployment engineering report

## Architecture and deployment target

Exam Cracker is a Next.js 15 App Router application. Authentication and most page interactions are browser-driven Firebase/Supabase integrations, but the build includes dynamic App Router routes (`/admin/[section]`, `/lectures/[id]`, `/tests/[id]`) rendered on demand. The application also relies on Next request handling and runtime route fallback/deep-link refresh behavior. It is therefore deployed as **Cloudflare Workers using `@opennextjs/cloudflare`**, not Pages static export. Static export would require enumerating dynamic content IDs and would change route/deep-link behavior; it is not a safe feature-preserving conversion.

The website Worker (`wrangler.toml`, `custom-worker.mjs`) remains separate from the media metadata/thumbnail proxy (`workers/ec-content-api`). The latter serves `/health`, `/video`, `/playlist`, and `/thumbnail` and does not require a YouTube Data API key. Supabase Edge Functions remain the trusted API boundary for database operations; Firebase Auth tokens are verified there. The browser admin check is only UI gating; administrative API authorization is performed by the Supabase function.

## Root causes fixed

- `@opennextjs/cloudflare` imports `esbuild`, but `esbuild` was not declared in the lockfile. CI worked around this using an unpinned, lockfile-bypassing install. Added `esbuild` as a dev dependency and removed that non-reproducible workaround.
- CI/deploy allowed `npm install` fallback after `npm ci`, which could mutate dependency resolution and conceal lockfile drift. Workflows now use strict `npm ci`.
- CI's lint step swallowed failures (`|| true`-style fallback logic). It now invokes the declared lint script directly.
- Public configuration included real project defaults in application code, `.env.example`, and the deploy workflow. The app now defaults absent settings to blank rather than silently binding builds to a particular Firebase/Supabase deployment; `.env.example` contains placeholders only. The deployment workflow sources client config from explicitly documented GitHub variables/secrets and fails early when required values are missing.
- Deployment checks used an assumed media Worker hostname and did not health-check the website. Health checks now use explicitly configured deployment URLs.
- Added a single, documented OpenNext build command. The current installed Next.js version reports itself unsupported by the Next.js team in the OpenNext builder; this repository currently uses the builder's explicit `--dangerouslyUseUnsupportedNextVersion` escape hatch so the existing Next 15 feature set can be built. This is a temporary compatibility exception, not a claim that unsupported Next is an ideal long-term production version. Upgrade to a currently supported Next.js release and remove the flag before treating this as a fully supportable long-term baseline.

## Changed files

- `package.json`, `package-lock.json`: declare `esbuild`; add `build:cloudflare`.
- `src/lib/config.ts`: remove project-specific fallback values, emit a clear missing-setting warning, and avoid silently using a different backend.
- `.env.example`: placeholders for public client config and documented optional settings.
- `.github/workflows/ci.yml`: reproducible install, direct lint, OpenNext build command.
- `.github/workflows/deploy.yml`: required-config validation, config injection, both Worker deploys and configurable health checks.
- `README.md`: environment and Cloudflare deployment setup guidance.
- `DEPLOYMENT_REPORT.md`: this report.

## Verification performed

- `npm ci` — passed (audit reported 36 dependency advisories: 14 moderate, 20 high, 2 critical; no automatic bulk upgrade was applied).
- `npm run typecheck` — passed.
- `npm run lint` — passed with existing warnings for raw `<img>` elements and one React hook dependency warning.
- `npm test -- --reporter=verbose` — passed, 5 test files / 57 tests.
- `npm run build` — passed; Next output shows all current routes, including three dynamic server-rendered routes.
- `npm run build:cloudflare` — passed with the documented unsupported-version escape hatch.
- The first unmodified OpenNext build failed because `esbuild` was absent; after adding the declared dependency, it reached Next's unsupported-version gate, and then completed with the explicit flag.

No remote Cloudflare deployment, Firebase login, Supabase database/function request, or real-browser end-to-end flow was run. Tests/build do not prove external credentials, backend rules, provider configuration, actual deployed deep links, or media upstream availability.

## Required deployment settings

GitHub Actions **secrets**:

- `CLOUDFLARE_API_TOKEN`: token with Workers deployment permissions.
- `CLOUDFLARE_ACCOUNT_ID`: account identifier.
- `NEXT_PUBLIC_FIREBASE_API_KEY`: browser-visible Firebase Web App config; put in Actions secret as requested, restrict its API/referrer use in Google Cloud.
- Optional `NEXT_PUBLIC_FIREBASE_VAPID_KEY` for web push.

GitHub Actions **repository variables** (public configuration, embedded into the client bundle):

- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`, `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`, `NEXT_PUBLIC_FIREBASE_APP_ID`.
- Optional `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID`.
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SUPABASE_FUNCTION_URL`, `NEXT_PUBLIC_SUPABASE_SITE_FUNCTION_URL`.
- `NEXT_PUBLIC_CLOUDFLARE_MEDIA_PROXY_URL`.
- `CLOUDFLARE_WEB_HEALTH_URL`: actual deployed website `/login` URL for post-deploy health check.

Never supply a Supabase service-role key to Next.js, `NEXT_PUBLIC_*`, GitHub build environment, or the browser. Configure Supabase service credentials only as Supabase Edge Function secrets. Confirm the Supabase migrations are applied and RLS/function authorization policies remain enabled.

## Manual checks still required

1. Configure GitHub secrets/variables above; check `wrangler.toml` account and Worker names against the intended Cloudflare account.
2. Firebase Console: enable Email/Password and (if used) Google providers; add the deployed website/custom domain to Authorized domains; verify reset/redirect behavior and deploy the included Firestore rules. Keep `arvinddarabishnoi@gmail.com` as the admin identity; do not rely on UI email checks as authorization.
3. Supabase: apply reviewed migrations, deploy both Edge Functions, configure their private service-role and Firebase verification settings, allowed origins, and test admin/student policies with real accounts.
4. Run deployment workflow; then test unauthenticated redirects, sign-in/onboarding, protected route refresh/deep links including dynamic IDs, admin rejection for non-admins, student dashboard/test/leaderboard/profile, and playlist/video/thumbnail proxy with public and unavailable videos.
5. Review dependency audit advisories and upgrade Next.js/OpenNext and other affected packages on a dedicated compatibility change. Remove `--dangerouslyUseUnsupportedNextVersion` after moving to a release supported by both Next.js and OpenNext.

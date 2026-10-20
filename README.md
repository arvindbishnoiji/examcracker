# Exam Cracker — blank-repository implementation

This repository is the clean target for building Exam Cracker as a Next.js App Router web application. It intentionally starts without a frontend. Read MASTER_PROMPT.md first and implement the complete app here; do not reference or depend on the iio repository.

## Prepared service files
- `.env.example`: public web configuration values for Firebase, Supabase and the Cloudflare media Worker.
- `firebase.json` and `firestore.rules`: Firebase/Firestore configuration and access rules; inspect and validate before deployment.
- `google-services.json`: Firebase Android client config for future native packaging only; not a web config or Admin SDK credential.
- `supabase/functions/exam-cracker-api/index.ts`: existing Supabase Edge Function source. Its deployed endpoint is https://kncbvcozpcrfvxdbkbtf.supabase.co/functions/v1/exam-cracker-api.
- `supabase/migrations/20261017000000_ec_query_indexes.sql`: existing query-index migration. Do not blindly re-run destructive migrations or weaken RLS.
- `workers/ec-content-api/src/index.js` and `workers/ec-content-api/wrangler.toml`: existing YouTube metadata/playlist proxy. Public endpoint: https://ec-content-api.arvinddara0290.workers.dev. Keep this Worker separate from the website deployment.

## Required setup
1. Copy `.env.example` to `.env.local`.
2. Build the entire Next.js frontend and tests in this repo.
3. Verify the existing Supabase function and Worker response shapes before wiring the UI.
4. Enable Firebase Email/Password and Google providers in Firebase Console; verify the configured admin user exists.
5. Configure `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` as GitHub Actions secrets/variables before automatic deployment. Never commit these.
6. Check GitHub Actions results before reporting a build or deployment successful.

Never commit Supabase service-role/secret keys, Firebase Admin private keys or Cloudflare API tokens. The browser may use only the Firebase web config and Supabase publishable key in `.env.example`. All privileged data operations must be authorized server-side through the Firebase-token-verifying Supabase Edge Function.

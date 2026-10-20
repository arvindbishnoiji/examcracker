# Exam Cracker — blank-repository implementation

This is the clean target repository for building Exam Cracker as a Next.js App Router web application. The student/admin frontend is not yet implemented. Read [MASTER_PROMPT.md](./MASTER_PROMPT.md) first.

## Repository contents
- `MASTER_PROMPT.md`: full implementation specification for the AI coding agent.
- `.env.example`: public browser config for Firebase, Supabase and Cloudflare media Worker.
- `firebase.json`, `firestore.rules`, `google-services.json`: Firebase project/rules and Android client config (not a web config or Admin SDK credential).
- `supabase/functions/exam-cracker-api/index.ts`: existing Supabase Edge Function source.
- `supabase/migrations/20261017000000_ec_query_indexes.sql`: existing database index migration.
- `workers/ec-content-api/src/index.js` and `workers/ec-content-api/wrangler.toml`: existing YouTube metadata/playlist proxy, kept separate from the website Worker.
- `reference/iio/`: curated reference copies of the existing app's core types, API client, Firebase/Firestore helpers, media proxy, validation/date helpers and tests. Use as a guide for data contracts and behaviour; adapt to Next.js rather than blindly importing Vite-specific code.

## Known services
- Firebase project: `darvo1`
- Supabase function: https://kncbvcozpcrfvxdbkbtf.supabase.co/functions/v1/exam-cracker-api
- Cloudflare media Worker: https://ec-content-api.arvinddara0290.workers.dev

## Required next steps
1. Copy `.env.example` to `.env.local`.
2. Implement the complete Next.js frontend, API integration and tests described in MASTER_PROMPT.md.
3. Verify the existing Supabase function and Cloudflare Worker response shapes before wiring UI.
4. Enable Firebase Email/Password and Google providers in Firebase Console; verify admin user `arvinddarabishnoi@gmail.com` exists.
5. Configure `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` as GitHub Actions secrets/variables before deployment.
6. Run CI and inspect actual results before claiming the build or deployment succeeded.

Never commit Supabase service-role/secret keys, Firebase Admin private keys or Cloudflare API tokens. The browser may use only the Firebase web config and Supabase publishable key in `.env.example`. All privileged relational operations must be authorized through the Firebase-token-verifying Supabase Edge Function.

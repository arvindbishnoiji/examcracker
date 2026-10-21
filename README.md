# Exam Cracker

JEE/NEET learning web app for Class 11 and 12 using Next.js App Router, TypeScript, Tailwind CSS, Firebase Authentication and Cloudflare D1.

## Target architecture

- Firebase project: `darvo1`. Use Firebase Auth for signup, login, password reset and enabled sign-in providers.
- Structured app data is stored in Cloudflare D1 via the authenticated same-origin `/api/ec/*` API.
- Cloudflare Worker `exam-cracker-web` is compute/API runtime; it is not the database.
- D1 binding: `DB`; database name: `exam-cracker-db`; database ID supplied by the owner: `dbf2375d-a302-443f-83bf-df59e1d98177`.
- The separate `ec-content-api` Worker remains the YouTube video/playlist metadata proxy.
- Student chat has been replaced by Feedback; feedback threads/replies are designed for D1.

Supabase is no longer part of the intended app runtime, and no Supabase-to-D1 data copy is planned because the owner has not populated Supabase. Old documentation/function-source files may remain in the repository pending final cleanup, but new runtime code must not call Supabase or use Firestore for application data.

## Local setup

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Configure only the Firebase web-app public configuration and existing Cloudflare media proxy URL in `.env.local`. Do not add Cloudflare API tokens or Firebase Admin keys to `NEXT_PUBLIC_*` variables. Do not add Supabase variables.

## D1 schema setup

First verify the authenticated Cloudflare account and database identity; don't create a duplicate.

```bash
npx wrangler whoami
npx wrangler d1 list
npx wrangler d1 migrations list exam-cracker-db --remote
npx wrangler d1 migrations apply exam-cracker-db --remote
npx wrangler d1 execute exam-cracker-db --remote --command="SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
```

Only apply migrations when the list confirms ID `dbf2375d-a302-443f-83bf-df59e1d98177`. Applying SQL creates schema only; it does not populate the database or guarantee the app APIs are fully cut over. The Cloudflare connector was unavailable during this preparation, so remote D1 migration/health has not yet been verified from ChatGPT.

## Checks

```bash
npm run typecheck
npm test
npm run lint
npm run build
npm run build:cloudflare
```

Production must not be switched over until typecheck, tests, build, migration validation, actual D1 health checks, feedback ownership checks and the student/admin routes pass.

## Important paths

- `src/app/`: student/admin Next.js routes
- `src/lib/api.ts`: same-origin application API client
- `src/app/api/ec/[...path]/route.ts`: same-origin Worker API route
- `workers/ec-api/src/index.js`: authenticated D1 API logic
- `migrations/0001_initial_schema.sql`: initial D1 schema
- `D1_MIGRATION_RUNBOOK.md`: D1 provisioning and safe rollout steps
- `workers/ec-content-api/`: separate YouTube metadata proxy

Admin identity check is enforced server-side for `arvinddarabishnoi@gmail.com`. Firebase passwords and privileged secrets must never be stored in D1 or committed to Git.

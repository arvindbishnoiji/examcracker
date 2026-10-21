# Exam Cracker — D1 Setup and Safe Rollout

## Target database

- Database name: `exam-cracker-db`
- Owner-provided database ID: `dbf2375d-a302-443f-83bf-df59e1d98177`
- Worker: `exam-cracker-web`
- D1 binding: `DB`
- Migration: `migrations/0001_initial_schema.sql`
- Firebase Auth project: `darvo1`
- Admin email: `arvinddarabishnoi@gmail.com`

The owner confirmed that Supabase has no data to migrate. **Do not export/import Supabase rows.** The goal is to use D1 for new application data and keep Firebase Authentication for identity.

The supplied database name and ID have not been independently verified by the Cloudflare connector in this session. No claim is made that the remote schema has already been applied.

## Apply and verify schema

From the repo, authenticate to the correct Cloudflare account and verify the database before applying anything:

```bash
npm ci
npx wrangler whoami
npx wrangler d1 list
npx wrangler d1 migrations list exam-cracker-db --remote
npx wrangler d1 migrations apply exam-cracker-db --remote
npx wrangler d1 execute exam-cracker-db --remote --command="SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
```

Stop if the database list does not contain ID `dbf2375d-a302-443f-83bf-df59e1d98177`. Do not create a duplicate. Never commit a Cloudflare API token; use Wrangler's authenticated login or GitHub Actions secrets.

## Intended runtime

Browser Firebase Auth ID token → same-origin `/api/ec/*` → server token verification/admin authorization → D1 `DB`.

The Worker is only the compute/API layer; records must be persisted to D1. Firebase passwords stay in Firebase Auth. The separate `ec-content-api` Worker is retained only for video/playlist metadata.

The student Chat/Doubt feature is being replaced by Feedback. Feedback tickets, messages/replies and statuses are stored in `feedback_threads` and `feedback_messages` in D1. The compatibility file `src/lib/firestore.ts` now sends these and notification requests to the same-origin D1 API; it must not perform Firestore writes.

## Current limitations and cutover gate

A draft PR adds the D1 binding/schema, D1 API implementation and feedback UI, but this is not the same as proving the production app is cut over. Confirm:
1. CI typecheck, unit tests, lint and both builds pass on the latest PR commit.
2. `npx wrangler d1 migrations apply exam-cracker-db --local` applies cleanly in CI/local.
3. The remote database ID, tables and D1 health endpoint are verified with Wrangler.
4. Every student/admin client route used by the app has a matching D1 handler and correct response shape.
5. Feedback privacy is tested (student A cannot fetch student B's feedback; only configured admin can list/reply).
6. New profile/content/test/settings/notification writes are confirmed persisted to D1.
7. The app has no active Supabase calls or Firestore application-data writes.
8. Mobile/desktop pages and login/signup/onboarding are smoke-tested.

No Supabase or Firestore application-data records are to be transferred. Keep old source directories only as clearly unused historical reference until the final cleanup is reviewed; don't deploy an incomplete cutover or delete any unrelated Firebase Auth configuration.

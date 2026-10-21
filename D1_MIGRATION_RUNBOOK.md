# Exam Cracker — D1 Setup and Safe Rollout

## Target database

- Database name: `exam-cracker-db`
- Owner-provided database ID: `dbf2375d-a302-443f-83bf-df59e1d98177`
- Worker: `exam-cracker-web`
- D1 binding: `DB`
- Migrations: `migrations/0001_initial_schema.sql`,
  `migrations/0002_subjects_and_drive_files.sql`, and any later additive files
- Firebase Auth project: `darvo1`
- Admin email: `arvinddarabishnoi@gmail.com`
- File storage: Google Drive (see `GOOGLE_DRIVE_SETUP.md`)

## No Supabase data migration is required

The owner confirmed that Supabase was never populated. **Do not export, transform or
import Supabase rows.** There is no source-data copy step. The Supabase Edge
Functions, migrations and `_shared` sources have been removed from this repository;
only future D1 writes matter.

The supplied database name and ID have not been independently verified from this
repository. No claim is made that the remote schema has been applied.

## Firestore cutover prerequisite (separate from Supabase)

The statement above only confirms that **Supabase** had no source rows. It does **not** verify that the old Firebase **Firestore** collections are empty. The current `main` app uses Firestore for student chat threads/messages (`studentThreads/{uid}/messages`), per-student notifications (`users/{uid}/notifications`), broadcasts (`broadcasts`) and push-token records (`fcmTokens/{uid}/tokens`). This PR removes those Firestore-backed app flows and introduces D1-backed feedback, notifications, broadcasts and push-token tables, but it does not export or import existing Firestore documents.

**Before production cutover:** verify the old collections contain no records that must be retained. If any are needed, take a Firestore export/backup and plan, implement and validate a migration into the matching D1 tables before switching traffic. Compare record counts and preserve message/notification IDs, timestamps, read/unread state and relevant student UIDs. Do not delete or disable the old Firestore data until the new app is verified and any required records are migrated. This repository cannot verify remote Firestore contents, so this check remains an owner-run prerequisite.

## Validate locally first (no Cloudflare account needed)

```bash
npm ci
npx wrangler d1 migrations apply exam-cracker-db --local
npx wrangler d1 execute exam-cracker-db --local \
  --command="SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
```

CI runs the equivalent check and asserts that `student_profiles`, `course_catalog`,
`site_settings`, `feedback_threads`, `feedback_messages`, `notifications`,
`subjects`, `course_subjects` and `drive_files` exist. `npm test` also applies both
migration files to an in-memory SQLite database and verifies the JSON backfill and
constraints.

Migrations are additive and single-use. Never re-apply `0002`; D1 records applied
migration names, so do not delete that bookkeeping table.

## Apply and verify the remote schema

Run these yourself with an authenticated Wrangler session:

```bash
npx wrangler whoami
npx wrangler d1 list
npx wrangler d1 migrations list exam-cracker-db --remote
npx wrangler d1 migrations apply exam-cracker-db --remote
npx wrangler d1 execute exam-cracker-db --remote \
  --command="SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
```

Stop if the database list does not contain ID `dbf2375d-a302-443f-83bf-df59e1d98177`.
Do not create a duplicate database. Never commit a Cloudflare API token; use
Wrangler's authenticated login or GitHub Actions secrets.

The deploy workflow already refuses to run remote migrations unless
`EXPECTED_D1_DATABASE_ID` / `EXPECTED_D1_DATABASE_NAME` match the returned database.

## Configure Google Drive

Required Worker secrets are documented with exact commands in
[GOOGLE_DRIVE_SETUP.md](GOOGLE_DRIVE_SETUP.md). Until they are set, photo/PDF routes
return explicit 503 configuration errors; they do not silently fail or fake success.

## Intended runtime

Browser Firebase ID token → same-origin `/api/ec/*` → Worker token verification and
authorisation → D1 `DB`, with file bytes in Google Drive and metadata in
`drive_files`.

Firebase passwords stay in Firebase Auth. The separate `ec-content-api` Worker is
retained only for video/playlist metadata.

Feedback (replacing Chat) is stored in `feedback_threads` / `feedback_messages`, with
server-enforced student ownership and an admin-only inbox.

## Cutover gate

Do not claim the production app is cut over until:

1. CI typecheck, unit tests, lint and both builds pass on the PR commit.
2. `wrangler d1 migrations apply --local` applies cleanly (CI + local).
3. The remote database ID, tables and health endpoint are verified with Wrangler.
4. Every student/admin client route used by `src/lib/api.ts` has a matching D1
   handler and response shape.
5. Ownership is tested: student A cannot read student B's feedback, files, progress
   or attempts; only the configured admin can list/reply.
6. Profile/content/test/settings/notification writes are confirmed persisted to D1.
7. Google Drive uploads/reads work with the owner's real secrets (photos and PDFs),
   and unauthorised reads return 403.
8. There are no remaining Supabase calls, Firestore application-data writes or
   public Drive links.
9. Mobile/desktop pages and login/signup/onboarding are smoke-tested.

Never deploy an incomplete cutover. Do not delete unrelated Firebase Auth
configuration while cleaning up retired services.

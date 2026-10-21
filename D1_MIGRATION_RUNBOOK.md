# Exam Cracker — Cloudflare D1 Setup and Cutover Runbook

## Target configuration

- D1 database name: `exam-cracker-db`
- D1 database ID supplied by the owner: `dbf2375d-a302-443f-83bf-df59e1d98177`
- Wrangler configuration: root `wrangler.toml`
- D1 binding: `DB`
- Migrations directory: `migrations/`
- Firebase project: `darvo1`
- Admin email: `arvinddarabishnoi@gmail.com`

The name and ID are owner-provided. This document does not claim the remote schema or data migration has already been applied.

## Apply the schema

Run these commands in the repository on a machine authenticated to the correct Cloudflare account. Do not put the Cloudflare API token in source code or commit it.

```bash
npm ci
npx wrangler whoami
npx wrangler d1 list
npx wrangler d1 migrations list exam-cracker-db --remote
npx wrangler d1 migrations apply exam-cracker-db --remote
npx wrangler d1 execute exam-cracker-db --remote --command="SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
```

If `npx wrangler d1 list` does not show the supplied database ID, stop and confirm the authenticated account instead of creating a duplicate database.

## Important: not yet a production cutover

This branch sets the Worker binding and adds a D1-compatible schema baseline. Existing production API code still depends on Supabase Edge Functions for relational data, and some messaging/notification data still uses Firestore. Those live paths must be converted before the app can be said to run fully on D1.

Before cutover:
1. Back up and inventory every Supabase table and every Firestore app-data collection.
2. Add a repeatable, resumable importer using secrets kept outside Git.
3. Preserve IDs, Firebase UIDs, JSON fields, timestamps and relationships.
4. Compare source and D1 row counts and verify imported values.
5. Replace Supabase Edge Function calls with authenticated server-side D1 repositories/APIs.
6. Replace Firestore application-data access with D1, retaining Firebase Authentication.
7. Run typecheck, tests, lint, production build and Cloudflare build.
8. Deploy only after all migration-integrity checks pass.

Never store passwords or private credentials in D1. Never delete source data during the first pass. Keep a backup and documented rollback until the new application is verified in production.

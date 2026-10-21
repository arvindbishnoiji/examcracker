# Exam Cracker

JEE/NEET learning app for Class 11 and 12 (Next.js App Router, TypeScript,
Tailwind CSS) built on:

**Firebase Authentication → Cloudflare Worker API → Cloudflare D1 → Google Drive (files)**

There is no Supabase or Firestore runtime. Files are never stored in D1 and never
outside Google Drive.

## Architecture

| Layer | Responsibility |
| --- | --- |
| Firebase Auth (`darvo1`) | Signup, sign-in, password reset, Google sign-in. Firebase UID is the identity key. Passwords never touch D1. |
| Browser | Calls only the same-origin `/api/ec/*` API with a Firebase ID token. |
| `src/app/api/ec/[...path]/route.ts` | Proxies to the Worker inside the same OpenNext deployment and fails closed with 503 when the D1 binding is absent. |
| `workers/ec-api/src/index.js` | Verifies Firebase ID tokens (JWKS), enforces admin/ownership rules, validates bodies, scores tests on the server, and reads/writes D1 with parameterized SQL. |
| Cloudflare D1 (`DB`) | All structured data: profiles, catalogue, subjects, progress, attempts, enrollments, feedback, notifications, settings, audit log, Drive metadata. |
| Google Drive | Profile photos and course PDFs, accessed only by the Worker service account. Private; no public links. |
| `ec-content-api` Worker | Separate YouTube video/playlist metadata proxy. Unchanged. |

- D1 binding `DB`, database `exam-cracker-db`, ID `dbf2375d-a302-443f-83bf-df59e1d98177`.
- Admin email `arvinddarabishnoi@gmail.com`, enforced by the Worker on every admin
  request. Email verification is not a required admin login condition.
- `/chat` redirects to `/feedback`. Feedback threads, replies and status live in D1
  with server-enforced ownership.

## Local setup

```bash
npm ci
cp .env.example .env.local   # Firebase web config + media proxy URL
npm run dev
```

`next dev` has no Cloudflare bindings, so `/api/ec/*` returns a clear 503. To run
the full stack locally:

```bash
npx wrangler d1 migrations apply exam-cracker-db --local
# create .dev.vars with the Worker secrets you need (never commit it)
npm run build:cloudflare
npx wrangler dev --local
```

Configure only public Firebase values in `.env.local`. Never put Cloudflare tokens,
Firebase Admin keys, the service-account JSON or Drive folder ids in
`NEXT_PUBLIC_*`. See [GOOGLE_DRIVE_SETUP.md](GOOGLE_DRIVE_SETUP.md).

## D1 schema

Versioned, additive migrations in `migrations/`:

- `0001_initial_schema.sql` — profiles, catalogue, progress, attempts, enrollments,
  events/rules, announcements, settings, activity, library, feedback,
  notifications, push tokens, broadcasts.
- `0002_subjects_and_drive_files.sql` — `subjects`, `course_subjects`, hierarchy
  columns (`parent_id`, `subject_id`, `sort_order`) with a JSON backfill,
  `drive_files`, `student_profiles.avatar_file_id`, `feedback_threads.resolved_at`.

Validate locally before touching the remote database:

```bash
npx wrangler d1 migrations apply exam-cracker-db --local
```

Then, after verifying the account and database id:

```bash
npx wrangler whoami
npx wrangler d1 list
npx wrangler d1 migrations list exam-cracker-db --remote
npx wrangler d1 migrations apply exam-cracker-db --remote
npx wrangler d1 execute exam-cracker-db --remote --command="SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
```

Stop if the database list does not contain ID `dbf2375d-a302-443f-83bf-df59e1d98177`.
Do not create a duplicate. Remote migrations and Worker secrets are owner-run
actions; the repository cannot verify them by itself.

## Checks

```bash
npm ci
npm run typecheck
npm test
npm run lint
npm run build
npm run build:cloudflare
```

CI additionally applies both migrations to a local D1 database, checks the required
tables and scans `src/` for retired Supabase code and server credentials.

## Feature map

**Student** — onboarding (name → JEE/NEET → Class 11/12), home, batches/series,
lecture player, subjects filter, Drive PDF viewer, tests/attempts/results,
leaderboard, profile with photo upload and analysis, events, challenges,
notifications, search, library, feedback.

**Admin** — overview, Screen Studio, homepage builder, goals, batches, series,
**subjects and assignments**, lectures (with parent → subject cascade and Drive PDF
upload), tests, analytics, leaderboards, students/enrollments, announcements,
events, notifications, feedback inbox, appearance/navigation/footer/banners/
popups/testimonials/media/SEO/toggles, scheduling, reports, health, import/export,
preferences and the preserved classic console with the YouTube playlist importer.

## Important paths

- `src/app/` — student and admin routes
- `src/lib/api.ts` — typed same-origin API client (including authenticated blob
  downloads and upload progress)
- `src/lib/enrollment-core.ts` — pure eligibility/bulk-enrollment rules used by the
  console and tests
- `src/components/student/ProfileAvatar.tsx` — preview, progress, cancel/retry
  profile photo control
- `workers/ec-api/src/index.js` — Worker API
- `workers/ec-api/src/drive.js` — Google Drive service-account auth, upload,
  download and delete
- `migrations/` — D1 schema
- `D1_MIGRATION_RUNBOOK.md` — rollout steps
- `GOOGLE_DRIVE_SETUP.md` — Drive, service account and secret setup
- `cloudflare-pages/` — Pages front door and service binding
- `MASTER_PROMPT.md` — authoritative engineering brief

No production deployment, remote D1 migration, merge or secret configuration is
performed by committing to this repository.

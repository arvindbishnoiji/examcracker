# Exam Cracker

JEE/NEET learning app for Class 11 and 12 (Next.js App Router, TypeScript,
Tailwind CSS) built on:

**Firebase Authentication → Cloudflare API / Worker → Cloudflare D1 → Google Drive (files)**

There is no Supabase or Firestore runtime. Files are never stored in D1. They remain in private Google Drive folders; personal Gmail uploads can use a server-side Google Apps Script bridge, while the service account remains responsible for authenticated file reads and cleanup.

## Architecture

| Layer | Responsibility |
| --- | --- |
| Firebase Auth (`darvo1`) | Signup, sign-in, password reset, Google sign-in. Firebase UID is the identity key. Passwords never touch D1. |
| Browser | Calls only the same-origin `/api/ec/*` API with a Firebase ID token. |
| `src/app/api/ec/[...path]/route.ts` | Proxies to the Worker inside the same OpenNext deployment and fails closed with 503 when the D1 binding is absent. |
| `workers/ec-api/src/index.js` | Verifies Firebase ID tokens (JWKS), enforces admin/ownership rules, validates bodies, scores tests on the server, and reads/writes D1 with parameterized SQL. |
| Cloudflare D1 (`DB`) | All structured data: profiles, catalogue, subjects, progress, attempts, enrollments, feedback, notifications, settings, audit log, Drive metadata. |
| Google Drive | Private profile photos and course PDFs, with metadata in D1. The service account handles authenticated reads/cleanup; uploads use it on supported Shared Drives or the owner-run Apps Script bridge for personal Gmail My Drive. No public file links. |
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
- `0003_seed_starter_catalogue.sql` — starter course records (insert-if-absent).
- `0004_dropper_class_and_queue_indexes.sql` — supports Dropper class and adds
  course queue indexes.
- `0005_badges.sql` — badge definitions, active student awards, idempotency index,
  and immutable grant/revocation history. Apply all migrations in sequence; this
  migration is additive and does not rewrite existing student or course data.

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
events, notifications, feedback inbox, **badge definitions/manual awards/revocation
history**, appearance/navigation/footer/banners/popups/testimonials/media/SEO/toggles,
scheduling, reports, health, import/export, preferences and the preserved classic
console with the YouTube playlist importer.

## Achievement badges (initial release)

The searchable admin console has a **Badges & achievements** section. It supports
creating/editing definitions, rarity/category, HTTPS image references, display
order, manual student search and award, duplicate-award protection, reasoned
revocation, award history and a server-derived blue verified mark. Students see
their awarded gallery at `/profile`. The Worker independently authorizes all admin
writes and records changes in `admin_activity` plus badge award history.

Image binaries are not uploaded for badges in this release: existing Drive files
are private student/course assets, so reusing them for public profile display
would be unsafe. Automatic/scheduled rules are also not exposed because the repo
has no supported background scheduler/verified award-rule engine. No AI provider
is configured. These capabilities should be added only with an explicitly designed
public badge-asset path, trusted rule signals and server-side provider setup.


## Experience Studio (batches + animations)

Two new admin workspaces ship with the Aurora 2026 UI refresh:

**Batch Studio — `/admin/batch-studio`**
- Create a real D1 batch (name, description, exam, class levels, access code) and
  design its student card in one screen: cover image URL, hero image, badge,
  mentor, feature chips, seats, priority, start/end schedule (IST), the pages it
  appears on (`home`, `lectures`, `tests`, `dashboard`, `events`), its accent
  colour, entrance motion and completion reward (badge, XP, certificate,
  discount, cash, bonus access).
- The **Section design** tab edits the published `batchStudio` site setting:
  headline, sub-headline, layout (`spotlight`, `tile`, `wide`, `minimal`),
  countdown/reward/feature/seat visibility, maximum cards and the colour cycle.
- Batches that are unpublished or outside their schedule never reach students;
  each card only shows to the exam/classes it targets.

**Animation Studio — `/admin/animation-studio`**
- Author per-page animation layers in raw HTML + CSS + JS (the “index.html”
  workflow), starting from a template (confetti reward, marquee ribbon, snow
  focus, corner offer, countdown bar, cursor spotlight) or from a blank layer.
- Choose pages, audience, trigger (page load, delay, scroll, exit intent, idle,
  schedule), delay, auto-hide duration, frequency, surface (overlay, banner,
  corner, floating), backdrop, dismissibility and an optional claimable reward.
- Layers are validated before publishing and rendered inside a sandboxed iframe
  (`allow-scripts`, unique origin) so authored JS cannot read student data or
  the parent document. `respectReducedMotion` and a global kill switch are built
  in, and publishing is draft → publish through D1 like every other setting.

`/design-preview` is a noindex internal style guide that renders sample batches
and a sample animation layer so the design can be reviewed without signing in.

## Important paths

- `src/app/` — student and admin routes
- `src/lib/api.ts` — typed same-origin API client (including authenticated blob
  downloads and upload progress)
- `src/lib/enrollment-core.ts` — pure eligibility/bulk-enrollment rules used by the
  console and tests
- `src/components/student/ProfileAvatar.tsx` — preview, progress, cancel/retry
  profile photo control
- `workers/ec-api/src/index.js` — Worker API
- `workers/ec-api/src/drive.js` — server-side Google Drive upload/read/delete integration
- `workers/ec-api/src/apps-script-drive.js` — personal Gmail Apps Script upload bridge
- `cloudflare-pages/apps-script-drive-bridge.gs` — deployable Apps Script source
- `migrations/` — D1 schema
- `D1_MIGRATION_RUNBOOK.md` — rollout steps
- `GOOGLE_DRIVE_SETUP.md` — Drive, service account and secret setup
- `cloudflare-pages/` — Pages front door and service binding
- `MASTER_PROMPT.md` — authoritative engineering brief

No production deployment, remote D1 migration, merge or secret configuration is
performed by committing to this repository.

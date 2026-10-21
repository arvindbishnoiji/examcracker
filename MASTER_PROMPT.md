# Exam Cracker — Authoritative Engineering Brief

**Final architecture: Firebase Authentication → Cloudflare Worker API → Cloudflare
D1 (structured data) → Google Drive (profile photos and PDFs).**

This supersedes every older instruction that mentions Supabase as the runtime
database or Firestore as the chat/notification store. Supabase and Firestore are
retired from application runtime and their source, dependencies, environment
variables, CI checks and documentation have been removed. Do not re-introduce
either service.

## Product and target architecture

Repository: `arvindbishnoiji/examcracker`  
Product: JEE/NEET, Class 11/12 preparation web app.  
Framework: existing Next.js App Router + React + TypeScript + Tailwind CSS. Do not
replace it with a static HTML file or a second parallel app.

- Firebase project: `darvo1`; admin email `arvinddarabishnoi@gmail.com`.
- Cloudflare website Worker: `exam-cracker-web`.
- D1: database `exam-cracker-db`, owner-provided ID
  `dbf2375d-a302-443f-83bf-df59e1d98177`, binding `DB`.
- Google Drive: owner's private folder; Worker service account; metadata in D1.
- YouTube metadata Worker stays separate:
  `https://ec-content-api.arvinddara0290.workers.dev`.

### Only these runtime roles

- **Firebase Authentication** — email/password signup/login, password reset and
  Google sign-in when enabled. Firebase UID is the identity key. Never store
  passwords or credential hashes in D1. Never replace Firebase Auth with custom
  auth. Email verification must not be a mandatory admin login condition.
- **Cloudflare Worker + D1** — every structured app read/write. The Worker is API
  compute only, never a database. Worker memory, arrays, localStorage, KV or
  browser storage must never masquerade as the database.
- **Google Drive** — profile photos and course PDFs only. Files are private; the
  Worker is the only reader. Do not use Firebase Storage, browser-direct Drive
  uploads, public “anyone with the link” permissions, R2, or D1 blob columns.
- **Cloudflare media Worker** — YouTube URL/playlist metadata only.

The browser obtains a Firebase ID token and calls the same-origin `/api/ec/*` API.
The server verifies the token signature, audience, issuer, expiry and UID, then
authorises and persists with parameterized SQL. `wrangler.toml` must expose the D1
binding to the OpenNext Worker.

## Google Drive requirements

Server-only configuration:

- `GOOGLE_SERVICE_ACCOUNT_JSON` (Worker secret) with `client_email` and
  `private_key`
- `GOOGLE_DRIVE_FOLDER_ID` (Worker secret/var)
- optional `GOOGLE_DRIVE_PROFILE_FOLDER_ID`, `GOOGLE_DRIVE_PDF_FOLDER_ID`,
  `GOOGLE_DRIVE_SCOPE`
- optional size caps `GOOGLE_DRIVE_MAX_PROFILE_PHOTO_MB` (default 5),
  `GOOGLE_DRIVE_MAX_PDF_MB` (default 20)

Implementation rules:

- Worker-compatible Web Crypto RS256 JWT → Google OAuth token endpoint
  (`urn:ietf:params:oauth:grant-type:jwt-bearer`), with a per-isolate token cache
  and a safety window. No Node/Express server, no `googleapis` SDK, no
  `credentials.json` in production.
- Upload raw bytes (multipart/related), never Base64 in D1.
- Validate MIME type **and** magic signature (`JPEG`, `PNG`, `WebP`, `PDF`) and size
  before uploading.
- Store only Drive file id, MIME type, display name, size, owner, uploader,
  purpose, course/subject and status in `drive_files`.
- Ownership is derived from the verified token. The browser never supplies
  `ownerUid`, `uploaderUid`, a Drive id for reads, or an access decision.
- Student profile-photo upload; admin-only PDF upload.
- Authenticated Blob/object-URL viewing only — never a public Drive URL.
- Handle Drive-success/D1-failure orphans, replacement deletes, and a cleanup tool.
- Missing or invalid credentials return an explicit, actionable 503. Never return a
  fake upload confirmation.
- Setup, secret commands, local development and troubleshooting:
  `GOOGLE_DRIVE_SETUP.md`.

## Data model and D1 migrations

Versioned additive migrations in `migrations/`. `0001_initial_schema.sql` contains
`student_profiles`, `course_catalog`, `lesson_progress`, `exam_attempts`,
`enrollments`, `enrollment_events`, `enrollment_rules`, `announcements`,
`site_settings` (separate `draft`/`published` JSON text), `admin_activity`,
`student_library`, `feedback_threads`, `feedback_messages`, `notifications`,
`push_tokens`, `broadcasts`. `0002_subjects_and_drive_files.sql` adds `subjects`,
`course_subjects`, `course_catalog.parent_id/subject_id/sort_order` (with a
JSON-metadata backfill), `drive_files`, `student_profiles.avatar_file_id`,
`feedback_threads.resolved_at` and admin indexes.

Use D1-compatible SQLite syntax. JSON is stored as JSON text and validated at the
API boundary. Timestamps are UTC ISO strings. Use useful indexes and uniqueness
constraints, prepared statements, bound values and bounded batch writes.

The database name and ID above were supplied by the owner, but remote account
identity, schema application and live health must be verified before claiming
provisioning is complete. Never invent Cloudflare results. If the Cloudflare API
connector is unavailable, make the config/schema changes and provide the exact
authenticated Wrangler commands.

## API and security

- Verify Firebase token signature, audience `darvo1`, issuer
  `https://securetoken.google.com/darvo1`, expiry and UID on the server.
- Re-check admin authorization server-side against the normalized token email.
- Students read/write only their own profile, progress, attempts, library,
  notifications and feedback threads. Admin routes are server-protected, not merely
  hidden.
- Hidden answer keys before submission; server-side scoring and attempt persistence.
  Never trust client-provided score, rank, role, UID or authorization flag.
- Validate bodies and lengths, bound list sizes, use parameterized SQL, return
  helpful errors and log admin writes to `admin_activity`.
- No D1 credentials, Cloudflare API tokens, Firebase Admin keys or service-account
  JSON in source, browser bundles, URLs, logs or Git. No secrets in `NEXT_PUBLIC_*`.
- A missing D1 binding returns a clear 503; never pretend a save succeeded.

## Subjects and content hierarchy

`Batch / Series → Subject → Lectures & Resources`.

- Admin CRUD for subjects: name, description, exam applicability (JEE/NEET/Both),
  classes (11/12), active/archived, sort order.
- Assign subjects to batches/series (`course_subjects`). Surface usage: assignments,
  lecture counts, search and filtering.
- Lecture/resource editor: parent batch/series → subject cascade, where only
  subjects assigned to that parent are selectable. The Worker re-validates the pair
  and rejects mismatched subjects.
- Removing a subject that still has lectures must fail with `409 SUBJECT_IN_USE`
  and usage details unless explicitly forced; never silently detach content.
- Students browse batches/series, see subject groups, filter by subject, and get
  meaningful empty states for courses without subjects or lectures.
- Bootstrap/home feeds must not leak paid lecture titles to unenrolled students.

## Student experience

Preserve existing routes and real behaviour: login/signup, required onboarding
(name → JEE/NEET → Class 11/12), home, lectures, batches/series, lecture player,
tests, results, per-test leaderboards, profile/analysis, events, challenges,
notifications, search and personal library.

- Home shows the admin-set Today's Goal, real upcoming/live tests, events, learning
  progress and shortcuts. No invented stats or demo content.
- `/chat` redirects to `/feedback`. Students submit category + subject + details,
  see their own history, status, replies and can add follow-ups. Admins have a D1
  inbox to reply, resolve and reopen. Ownership is server-enforced.
- Profile photo: preview, upload progress, cancel, retry, initials/default avatar,
  immediate update and persistence after reload.
- Notifications and broadcasts are D1-backed with private per-user access. Firebase
  Cloud Messaging may deliver them; D1 remains the source of truth.

## Admin experience

Maintain and redesign existing admin routes. Protect every admin API by verified
Firebase identity and the configured email. Preserve:

- content CRUD for goals, batches, series, lectures/resources, events and tests;
- **subjects and course assignments**, including usage/search/filter views;
- question banks, scheduling and results/analytics;
- student directory and enrollment grants/revocations;
- announcements and notifications;
- appearance, navigation, banners, popups, testimonials, media URLs, feature
  toggles and Screen Studio draft/publish;
- D1 audit activity and the feedback inbox;
- Drive PDF upload/list/delete and orphan cleanup;
- the preserved classic console including the YouTube playlist importer.

Auth screens stay code-managed. Presentation settings cannot alter authentication,
access control, test timing/scoring or expose hidden answers. Metrics must be real.

## UI quality target

A polished, premium Indian exam-prep product: calm indigo/navy foundation, clean
surfaces, restrained status colours, excellent Hindi/English typography, clear
hierarchy, consistent spacing/radii/focus states, reusable components and honest
empty/loading/error states. No fake charts, upload confirmations or dead buttons.

Mobile-first for narrow phones: accessible thumb-friendly controls, safe-area
support, no horizontal overflow, and thoughtful tablet/desktop layouts. Admin has a
desktop sidebar and usable mobile drawer. Respect keyboard navigation, contrast and
reduced motion. Every visible action must work or be explicitly disabled.

## Build, test and completion rules

Run and report:

- `npm ci`
- `npm run typecheck`
- `npm test`
- `npm run lint`
- `npm run build`
- `npm run build:cloudflare`
- local D1 migration validation (`wrangler d1 migrations apply --local`)

Required test coverage includes:

- verified-token admin checks and ownership boundaries;
- subjects CRUD and lecture parent/subject filtering;
- Google Drive with a mocked fetch: missing/invalid credentials, MIME and size
  rejection, token-derived ownership, Drive-success/D1-failure handling, private
  reads, PDF upload/view;
- D1 migrations 0001 → 0002 applying to a fresh SQLite database, backfill and
  constraints;
- hidden answer keys and server-side scoring;
- feedback ownership and status transitions;
- enrollment eligibility/access.

Do not deploy production, merge to `main`, apply remote migrations, configure remote
secrets or claim success while required checks fail. The website is deployed through
the existing Cloudflare Pages front door and `exam-cracker-web` Worker; preserve that
arrangement and the media metadata Worker.

## Truthful final report

Report the branch/PR, actual CI results, local migration validation, schema changes,
UI screens changed, and remaining blockers. Explicitly distinguish:

- code completed in the repository;
- remote Worker secret configuration that only the owner can perform;
- remote D1 migration and deployment that have not been run.

Never present owner-run commands as executed work.

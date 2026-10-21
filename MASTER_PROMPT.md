# Exam Cracker — Authoritative Engineering Prompt

**This document supersedes all older instructions in this repository that mention Supabase as the runtime database or Firestore as the student chat/notification database. Do not re-introduce either service into application runtime.**

## Product and target architecture

Repository: `arvindbishnoiji/examcracker`  
Product: JEE/NEET, Class 11/12 preparation web app.  
Framework: existing Next.js App Router + React + TypeScript + Tailwind CSS. Do not replace with a single HTML file or a second parallel app.  
Firebase project: `darvo1`.  
Admin email: `arvinddarabishnoi@gmail.com`.  
Cloudflare website Worker: `exam-cracker-web`.  
D1 database: `exam-cracker-db`, owner-provided ID `dbf2375d-a302-443f-83bf-df59e1d98177`, binding `DB`.  
Media metadata Worker remains separate: `https://ec-content-api.arvinddara0290.workers.dev`.

### Only these runtime roles

- **Firebase Authentication**: email/password signup/login, password reset and Google sign-in when enabled. Firebase UID is the identity key. Never store passwords or credential hashes in D1.
- **Cloudflare Worker + D1**: all structured application data and every app read/write. The Worker is API compute only, not a database. Store application records in the bound D1 database.
- **Cloudflare media Worker**: YouTube URL/playlist metadata only; keep its existing name and URL.
- Do not send runtime requests to Supabase. Do not use Firestore to persist student data, chat, feedback or notifications. Do not add new Supabase/Firestore features.

The browser obtains a Firebase ID token and calls the same-origin `/api/ec/*` API. The server verifies the token and authorization, then uses D1 with parameterized SQL. The D1 binding must be available to the OpenNext/Next.js Worker through root `wrangler.toml`.

## Scope requested

1. Retire Supabase as an application runtime dependency; remove Supabase environment requirements, keys, URLs, SDK imports, active Edge Function calls, and Supabase-specific deployment validation. No source-data copy is required: the owner confirms they have not populated the Supabase database and wants only future writes to D1.
2. Keep Firebase Auth and existing auth flows intact.
3. Store new course/catalogue, student profile, onboarding, goals, progress, tests, attempts/results, enrollment/access, announcements, site settings, admin activity, personal library, notifications, push-token metadata, broadcasts and feedback data in D1.
4. Replace the student-facing Chat/Doubt chat item with **Feedback**. Students submit categorized feedback with a subject and details, track its status and receive replies. The admin workspace has a secure feedback inbox to review/reply/resolve items.
5. Redesign all student and admin screens to a consistent premium, responsive UI. Do not create a disconnected mockup or static HTML template.

## Data model and D1 migrations

Keep versioned SQLite/D1 migrations under `migrations/`. The initial migration should include:
- `student_profiles`
- `course_catalog`
- `lesson_progress`
- `exam_attempts`
- `enrollments`, `enrollment_events`, `enrollment_rules`
- `announcements`
- `site_settings` with separate JSON-text `draft` and `published` values
- `admin_activity`
- `student_library`
- `feedback_threads` and `feedback_messages`
- `notifications` and `push_tokens`
- `broadcasts`

Use D1-compatible SQLite syntax. Store structured JSON as JSON text and parse/validate it at the API boundary. Keep timestamps consistently UTC ISO strings. Use useful indexes and uniqueness constraints. Use prepared statements, bound values and bounded batch writes. Don't place large images, PDFs or videos in D1; store their URL/metadata (evaluate R2 only if real file upload/storage is required).

The database name and ID above were supplied by the owner, but remote account identity, schema application and live health must be verified before claiming provisioning is complete. Never invent Cloudflare results. If the Cloudflare API connector is unavailable, make the config/schema changes and provide the exact authenticated Wrangler command required.

## API and security

- Verify the Firebase token signature, audience `darvo1`, issuer `https://securetoken.google.com/darvo1`, expiry and UID on the server.
- Re-check admin authorization server-side against the normalized token email `arvinddarabishnoi@gmail.com`. Email verification must not become a mandatory admin login condition unless the owner explicitly changes that requirement.
- Students can only read/write their own profile, progress, attempt results, library, notifications and feedback threads. Admin-only list/reply/status routes must be protected on the server, not only hidden in the UI.
- Keep test answer keys hidden before submission; calculate score and persist attempts server-side. Never trust client-provided score/rank/role.
- Validate request bodies and length, paginate bounded lists, use parameterized SQL, preserve helpful errors, and log admin changes to D1.
- No D1 credentials, Cloudflare API tokens, Firebase Admin private keys or service-account files in source, browser bundles or Git.
- A missing D1 binding must return a clear server error; never pretend a save succeeded.

## Student experience

Preserve existing routes and real feature behavior, including login/signup, required onboarding (name → JEE/NEET → Class 11/12), home, lectures, batches/series, lecture player, tests, results, per-test leaderboards, profile/analysis, events, challenges, notifications, search and personal library.

Home should prominently show the admin-set Today's Goal, real upcoming/live tests, events, learning progress and useful shortcuts. Do not invent stats or demo content.

Replace `/chat` with a redirect to `/feedback`. The Feedback page should offer category, subject and details, show a user's own feedback history, status, team replies and an option to add follow-up details. Admins can review items, reply and resolve/reopen them. Persist all feedback and replies in D1 using Firebase-authenticated APIs.

Notifications and broadcasts must use D1-backed APIs, with private per-user access. Firebase Cloud Messaging may be used only for delivery when properly configured; D1 remains the structured source of truth.

## Admin experience

Maintain and redesign the existing admin routes and sections. Protect all admin APIs by verified Firebase identity and configured email. Preserve:
- content CRUD for goals, batches, series, lectures/resources, events and tests;
- question/test scheduling and results/analytics;
- student directory and enrollment grants/revocations;
- announcements and notifications;
- website appearance, navigation, banners, popups, testimonials, media URLs, feature toggles and Screen Studio draft/publish;
- D1-based audit activity and feedback inbox.

Keep auth screens code-managed. Presentation settings cannot alter authentication, access control, test timing/scoring or expose hidden answers. Use real database-backed metrics only.

## UI quality target

Deliver a polished, premium Indian exam-prep product: calm indigo/navy foundation, clean surfaces, restrained status colors, excellent typography for Hindi and English, clear hierarchy, consistent spacing/radii/focus states, reusable components and thoughtful empty/loading/error states. Avoid clutter, fake charts, excessive gradients and decorative art unrelated to the learning task.

Design mobile-first for narrow phones; use accessible, thumb-friendly controls, safe-area support, no horizontal overflow, and appropriate tablet/desktop layouts. Admin should have a proper desktop sidebar and usable mobile drawer. Respect keyboard navigation, contrast and reduced-motion preferences. Every visible action must work or be explicitly disabled.

## Build, test and completion rules

Run:
- `npm ci`
- `npm run typecheck`
- `npm test`
- `npm run lint` (or document script incompatibility)
- `npm run build`
- `npm run build:cloudflare`

Add tests for Firebase-token/admin checks, feedback ownership, D1 schema/repositories, SQL binding, enrollment access, test scoring/key protection, site settings draft/publish and error handling. Validate the migration against a disposable local D1 database before applying remotely. Do not deploy production, merge to `main`, or claim success while required checks fail.

The website is deployed through Cloudflare Pages' existing front door and `exam-cracker-web` Worker; preserve this arrangement. Do not rename or break the media metadata Worker.

## Truthful final report

Report the branch/PR, actual CI result, table schema validation, D1 remote binding/application/health-check evidence, UI screens changed, and any remaining blockers. Explicitly distinguish code prepared from remote D1 schema applied and live deployment. Do not claim a production-ready migration if the API contract or checks remain incomplete.

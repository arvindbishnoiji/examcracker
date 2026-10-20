# Delivery report — Exam Cracker improvements

Date: 2026-10-20
Branch: `arena/40a03224-examcracker`
Pull request: [#18](https://github.com/arvindbishnoiji/examcracker/pull/18)
Implementation commit: `5ca357f` (documentation/assets follow-up commit appended below it)
Repository: [arvindbishnoiji/examcracker](https://github.com/arvindbishnoiji/examcracker)

> **Deployment status: NOT deployed.** No Supabase function, migration, Cloudflare
> Worker or website deployment was run from this sandbox. Everything below is
> verified locally unless explicitly marked otherwise.

---

## 1. What was implemented

### 1.1 Enrollment system (high priority)

**Database model** — `supabase/migrations/20261021000000_ec_enrollment_system.sql` (idempotent, review-only so far):

- Adds `status`, `source`, `granted_by`, `expires_at`, `revoked_at`, `updated_at` to `enrollments` with safe defaults and backfill.
- `CHECK` constraints for `status` and `source` (added only if absent).
- Archives duplicate `(firebase_uid, item_type, item_id)` rows into `enrollment_events` **before** deleting them, then creates a unique index.
- `enrollment_events` audit table (grant, reactivate, revoke, restore, deduplicated, auto_rule).
- `enrollment_rules` for "all current and future eligible students", with optional exam/class filters, expiry and last-run counters.
- `ec_sync_enrollment_state()` trigger keeps legacy `active` and new `status`/`revoked_at` consistent, and stamps `updated_at`.
- Indexes for item+status, student+status+expiry, event history, active rules, and profile exam/class scanning.
- RLS enabled with **no public policies**; access is service-role only (same posture as the existing tables).

**Server** — `supabase/functions/ec-site-api/index.ts` (admin) and `supabase/functions/exam-cracker-api/index.ts` (student):

| Capability | Endpoint |
| --- | --- |
| Paginated enrichment/search | `GET /admin/enrollments?page&pageSize&status&itemId&itemType&query&item` |
| Single grant (409 `INELIGIBLE`, optional override) | `POST /admin/enrollments` |
| Bulk grant selected / all / filtered, dry-run, 409 confirmation | `POST /admin/enrollments/bulk` |
| Bulk soft revoke (`confirm: "REVOKE"`) | `POST /admin/enrollments/bulk-revoke` |
| Soft revoke / restore | `DELETE /admin/enrollments/:id`, `POST /admin/enrollments/:id/restore` |
| Audit history | `GET /admin/enrollments/history` |
| Future rules | `GET /admin/enrollment-rules`, `PATCH /admin/enrollment-rules/:id`, `DELETE /admin/enrollment-rules/:id` |
| Self-service enrollment | `POST /enrollments` (paid → **402**, access code, expiry) |

- Bulk operations are **batched** (50 rows per write), validate `≤5000` students, dedupe UIDs server-side, tolerate per-row failures, and return `{targeted, eligible, created, reactivated, alreadyActive, skipped, failed}`.
- Wide audiences require an explicit `confirmScope`; `dryRun` returns counts and a sample of skipped students without writing.
- Auto-enrollment runs when a student profile is first created; failures never block signup.
- Admin routes verify the Firebase ID token and compare the lowercased email to `ADMIN_EMAIL` (env-overridable). A client-side `isAdmin` flag is never trusted.
- Added best-effort per-isolate rate limits (15 self-enrolments/min, 12 bulk calls/5 min) and request-size limits (512 KB).

**Admin UI** — `src/components/admin/sections/EnrollmentConsole.tsx`, routed at `/admin/students`:

- Student directory with search, exam/class filters, pagination, multi-select.
- Enrollment records with active/revoked counts, status filters, bulk revoke, restore.
- Enroll modal: course picker, audience (selected / all eligible / filtered), eligibility override, expiry, "include future eligible students", dry-run preview, explicit scope confirmation.
- Auto-enrollment rules panel and real audit history.

### 1.2 Authentication and onboarding

- **Mandatory 4-step onboarding** (`src/app/onboarding/page.tsx`): name (2–80 chars) → JEE/NEET → Class 11/12 → confirm. No skip or drop controls; draft persisted in `localStorage['ec-onboarding-draft-v1']`; session and server errors have retry/sign-out paths.
- **Single route gate** (`src/components/auth/StudentGate.tsx` + pure `src/lib/auth-gate.ts`) wraps all student routes through `AppChrome`. Typing a URL cannot bypass onboarding.
- **Bootstrap state machine** in `AuthContext`: `idle | loading | ready | error`. A failed profile request shows a retry screen instead of pretending the profile is missing — this fixes the previous risk of pushing returning students into onboarding and overwriting their exam/class.
- Root redirect and login use `postAuthDestination`, so returning students go straight to `/home`, admins to `/admin`, new students to onboarding.
- Password reset and Firebase duplicate-account error mapping were already present and were preserved; Google sign-in, persistence and sign-out continue to use the existing code.

### 1.3 Student experience

- **Home** (`src/app/home/page.tsx`): premium hero with real exam/class/enrolled counts, real day streak derived from attempt timestamps and lesson updates, next or live test, continue-learning CTA, today's goal, and a progress card. **The fabricated streak formula was removed.**
- **Lectures** (`src/app/lectures/page.tsx`): batches / series / lectures / resources tabs, search, A–Z or newest sorting, "my courses only", price/access-code badges, safe thumbnails, skeletons, empty and error states.
- **Tests** (`src/app/tests/page.tsx`): live/upcoming/completed filters with counts, search, sorting, server-scored disclaimers, per-test leaderboard links.
- **Profile** (`src/app/profile/page.tsx`): real attempts, lesson progress, score summary, level shown as an educational indicator (explicitly not a rank claim).
- **Navigation**: Lucide `NavIcon` and `AdminSectionIcon` replace emoji in the header, bottom nav and admin shell. Added a notifications shortcut.
- **Design layer**: `ec-hero-panel`, `ec-card-interactive`, `ec-stat-tile`, `ec-level-badge`, `ec-progress-lg`, `ec-avatar`, `ec-live-dot`, `ec-toast`, `ec-skeleton`, plus reduced-motion guards.

### 1.4 SEO, assets, indexing and headers

- Root metadata: `metadataBase`, title template, canonical (`/login`), Open Graph, Twitter card, icons, manifest, locale `en_IN`.
- `src/app/robots.ts`: only `/` and `/login` allowed; all private areas disallowed.
- `src/app/sitemap.ts`: **only `/login`** — student/admin routes are intentionally absent.
- `src/app/manifest.ts`: installable manifest with 192/512/maskable icons.
- `src/app/not-found.tsx`, `src/app/error.tsx`, `src/app/global-error.tsx`.
- `/admin` layout sets `robots: noindex, nofollow`; `next.config.mjs` adds `X-Robots-Tag` for every private route plus `nosniff`, `Referrer-Policy`, `X-Frame-Options`, `Permissions-Policy` on all responses.
- JSON-LD is limited to truthful `EducationalOrganization` and `WebSite` entries (no ratings, prices, rankings or student data).
- Original `public/og-cover.png` (1200×630) and PWA icons generated in-repo; licences recorded in `ASSET_LICENSES.md`.

### 1.5 Preserved importer

`workers/ec-content-api/src/index.js` and `src/lib/mediaProxy.ts` were **not** rewritten. No thumbnail fix is claimed. The admin legacy console that hosts the importer remains available under `/admin/classic`.

---

## 2. Verification (local, this checkout)

| Check | Result |
| --- | --- |
| `npm run typecheck` (`tsc --noEmit`) | **Clean** |
| `npm test` (Vitest) | **57/57 passed**, 5 files |
| `npm run lint` | **0 errors**; existing `<img>` and one hook-deps warning |
| `npm run build` | **Success**, 20 routes |
| `npx @opennextjs/cloudflare build` | **Success**, `.open-next/worker.js` generated |
| Secret scan (CI rule over `src/`) | **Clean** |
| SSR smoke test (`/`, `/login`, `/home`, `/onboarding`, `/lectures`, `/tests`, `/profile`, `/admin`, `/admin/students`, `/robots.txt`, `/sitemap.xml`, `/manifest.webmanifest`, unknown path) | 200/404 as expected; robots and sitemap content inspected |
| Edge Function syntax (`typescript.transpileModule`) | **Syntax OK** for both functions after every patch |

New tests:

- `src/__tests__/enrollment.test.ts` (19) — eligibility, paid detection, bulk request validation, audience resolution, confirmation for wide overrides, duplicate-safe summaries.
- `src/__tests__/authGate.test.ts` (11) — mandatory onboarding, no redirect loop, failed bootstrap not treated as missing profile.
- `src/__tests__/progress.test.ts` (6) — IST date bucketing, streak edge cases, honest metric helpers.

**Not verified:** live Edge Function execution, SQL execution, browser E2E, real Firebase/Supabase calls, CI status on GitHub (the PR was just opened), and deployment. No Supabase credentials or Deno runtime exist in this sandbox.

---

## 3. Files changed (high level)

**New**

- `supabase/functions/_shared/enrollment-core.ts`
- `supabase/migrations/20261021000000_ec_enrollment_system.sql`
- `src/components/admin/sections/EnrollmentConsole.tsx`
- `src/components/auth/StudentGate.tsx`
- `src/lib/auth-gate.ts`, `src/lib/enrollment.ts`, `src/lib/progress.ts`, `src/lib/site-url.ts`
- `src/components/ui/AppIcon.tsx`
- `src/app/robots.ts`, `sitemap.ts`, `manifest.ts`, `not-found.tsx`, `error.tsx`, `global-error.tsx`, `login/layout.tsx`
- `public/og-cover.png`, `public/icons/*`, `public/apple-touch-icon.png`
- `src/__tests__/enrollment.test.ts`, `authGate.test.ts`, `progress.test.ts`
- `ASSET_LICENSES.md`, `DELIVERY_REPORT.md`

**Modified**

- Edge functions `exam-cracker-api/index.ts`, `ec-site-api/index.ts` (enrollment, auth, validation, CORS, rate limits, safe errors).
- `src/context/AuthContext.tsx`, `src/components/layout/{AppChrome,Header,BottomNav}.tsx`, `src/components/admin/{AdminShell.tsx,sections/DataSections.tsx}`, `src/app/admin/{layout.tsx,[section]/page.tsx}`.
- Pages: `layout.tsx`, `page.tsx`, `home`, `login`, `onboarding`, `lectures`, `tests`, `profile`.
- `src/lib/api.ts`, `src/types/{index,site}.ts`, `src/app/globals.css`, `next.config.mjs`, `README.md`, `package.json`, `package-lock.json`.
- `public/manifest.json` replaced by `src/app/manifest.ts`.

---

## 4. Manual steps required before this works in production

1. **Review and apply the SQL migration** in the Supabase project `kncbvcozpcrfvxdbkbtf` (SQL editor or `supabase db push`). It is idempotent. Recommended pre-check:
   ```sql
   select firebase_uid, item_type, item_id, count(*)
   from public.enrollments
   group by 1,2,3 having count(*) > 1;
   ```
   Duplicates are archived to `enrollment_events` before removal. **Until this runs, admin enrollment pages that need the new columns will fail.**
2. **Deploy both Edge Functions** (the gateway must not require a Supabase JWT, because the functions verify Firebase tokens themselves):
   ```bash
   supabase functions deploy exam-cracker-api ec-site-api \
     --project-ref kncbvcozpcrfvxdbkbtf --no-verify-jwt
   ```
3. **Optional secrets:** `ALLOWED_ORIGINS` (comma-separated) when a custom domain is added; `ADMIN_EMAIL` if the admin address changes. Do **not** set `DEBUG_API_ERRORS` in production.
4. **Rebuild/redeploy the site** after merge. The existing `deploy.yml` deploys on any push to `main`; merging this PR therefore triggers production deployment — review first.
5. **Smoke test with real accounts:** new user → onboarding → free enrolment; paid item → 402; admin dry-run → scope confirmation → bulk grant; revoke → restore; create a new eligible account and confirm the rule applies.

---

## 5. Remaining issues, blockers and deferred work

- **Not deployed.** PR #18 is open; merging it will auto-deploy via `.github/workflows/deploy.yml`.
- **Migration unapplied.** No database changes were executed anywhere.
- **No live API test.** Bulk endpoints, trigger and RLS were reviewed and syntax-checked, not executed against Postgres. A staging run is required before relying on the unique-index dedupe.
- **Playlist importer / thumbnails:** intentionally untouched per instruction. Any existing thumbnail issue remains; this report does not claim otherwise.
- **No CSP.** A strict Content-Security-Policy needs an allowlist audit of Firebase, YouTube embeds and Supabase endpoints; adding it unverified could break sign-in. Security headers were added without CSP.
- **Rate limiting is per-isolate** and best-effort; a global quota needs Cloudflare/WAF or a shared store.
- **`/admin` client-side routing** still relies on `AdminShell` plus server-side admin checks on every API call. There is no server-rendered middleware check; no admin data is exposed without an authorized token.
- **Existing warnings:** `<img>` usage (Cloudflare `images.unoptimized`), one `useMemo` dependency warning in the enrollment console. None are errors.
- **No E2E browser tests** were added because no browser is available in this sandbox; route gating and pure logic are unit-tested instead.
- **Admin "Overview" metrics** were not re-audited in depth this round; they come from `/admin/overview` and existing analytics endpoints.

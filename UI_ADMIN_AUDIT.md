# Exam Cracker — UI/Admin Audit (Pass 1)

Inspection of the repository on branch `arena/1e423bd0-examcracker` (from `main` commit `ae38c99`). All checks were green at inspection time: `npm run typecheck`, `npm test` (57 tests), `npm run lint`, `npm run build`, `npm run build:cloudflare`.

## What already works

- Next.js App Router student app with Firebase Auth + Supabase Edge Functions (`exam-cracker-api` and dedicated `ec-site-api`).
- Persisted site configuration: `site_settings` table with `draft`/`published` columns per key; `/public/site` endpoint serves published values; `SiteConfigContext` merges published values over typed defaults and applies theme tokens to `:root`.
- Admin console at `/admin` with shell, command palette (⌘K), searchable sidebar, toast feedback, publish bars with draft/published/reset states, per-key validation in `src/lib/site-validation.ts` and mirrored server-side in the Edge Function.
- Manageable screens today: theme (`appearance`), login (`login` designer), homepage (`homepage` builder), navigation, footer, banners, popups, testimonials, challenges, feature toggles, SEO/search, media library.
- Student screens: home, lectures/batches/series/resources, lecture player, tests, test attempt/result, leaderboard, profile/analysis, events/calendar, challenges, chat, notifications, search, onboarding, login.
- Auth gate (`resolveRouteGate`) enforces onboarding; admin routes verified server-side by email. Login/signup/password-reset/Google flow intact.
- Reusable admin primitives: `Field`, `Toggle`, `Segmented`, `ColorField`, `Panel`, `StatCard`, `Banner`, `Modal`, `ConfirmDialog`, `SettingsPublishBar`, `PreviewFrame` (mobile/desktop), `useSettingWorkspace` (draft/save/publish/reset/reload with beforeunload warning).

## Audit findings — gaps and weaknesses

### 1. Most student screens have no admin screen configuration
The following student-facing screens are visible to students but have no dedicated admin screen settings key, so headings, copy, section visibility, ordering, layout, limits, labels, CTAs and empty states cannot be changed without a code change:

| Screen | Route | Status |
|---|---|---|
| Lectures hub | /lectures | No screen config (tabs, filters, copy hard-coded) |
| Lecture player | /lectures/[id] | No screen config |
| Tests hub | /tests | No screen config |
| Test attempt/result | /tests/[id] | No screen config |
| Leaderboard | /leaderboard | No screen config |
| Profile & analysis | /profile | No screen config |
| Events & calendar | /events | No screen config (events *content* is manageable, not the page) |
| Study challenges | /challenges | `config.challenges.items` manageable, but page presentation is not |
| Student chat | /chat | No screen config |
| Notifications | /notifications | No screen config |
| Search & discovery | /search | No screen config |
| Onboarding | /onboarding | No screen config (mandatory name/exam/class enforcement must stay) |

`SITE_SETTING_KEYS` currently = `theme, login, homepage, navigation, footer, banners, popups, testimonials, challenges, features, seo, media`. The Edge Function's allowlist matches exactly. No migration is needed to add keys (additive jsonb table).

### 2. Admin navigation mixes concerns and includes the retired-by-design Login Page Designer
- Sidebar groups are `Command centre / Design studio / Learning / Students / Growth / System`, which does not match the requested predictable groups (`Overview / Screen Studio / Learning Content / Tests & Performance / Students & Access / Communication / Website Settings / System`).
- The `login` section ("Login Page Designer") is still in editable admin navigation. Requirement: login/signup must stay outside the admin screen editor; the designer should be retired from navigation.
- No single "Screen Studio" entry point that lets an admin pick a student screen, edit it, preview mobile/desktop, and publish.

### 3. Previews are wireframes, not the real component system
`HomepageBuilderSection` previews with a `HomeWireframe` mock, not the actual homepage section components. Requirement: preview should use the same layout and component rules as the student page wherever practical.

### 4. Inconsistent student-page shell quality
- Headings exist on most pages, but typography/spacing/cards are hand-rolled per route; no shared page shell (page header + container + empty state pattern) across student screens.
- Some pages (`/notifications`, `/chat`) are sparse and do not use the theme's empty-state title/body.
- No consistent "safe default on load failure" pattern — some pages show raw errors.

### 5. Outdated documentation
`MASTER_PROMPT.md` claims the repository is empty and identifies the old `iio` repository as the target. `README.md` still references the old setup in places. These must be corrected.

## Pass 2 implementation plan

1. **Extend the typed screen-config model** (additive, no breaking changes):
   - New keys: `lectures`, `lecturePlayer`, `tests`, `testPlayer`, `leaderboard`, `profile`, `eventsScreen`, `challengesScreen`, `chat`, `notifications`, `search`, `onboarding`.
   - Add types/defaults/sanitizers in `src/types/site.ts` + `src/lib/site-config.ts`, validation in `src/lib/site-validation.ts`, mirror allowlist + validation in `supabase/functions/ec-site-api/index.ts`.
   - Existing saved settings and consumers are untouched (new keys default to built-in defaults).

2. **Build the Screen Studio** (`/admin/screens` + `/admin/screens/[screen]`):
   - Screen selector with recognisable student page names.
   - Per-screen editor reusing `Field`/`Toggle`/`Segmented`/`ColorField` and `SettingsPublishBar`.
   - Real-component preview (mobile/desktop) rendered inside `PreviewFrame`.
   - Draft/published status, save draft, publish to students, reset, reload, unsaved-change warning.

3. **Retire Login Page Designer** from admin navigation (keep the `login` settings key and component contract intact so the login page still renders published login copy; route `/admin/login` no longer reaches the designer).

4. **Wire student pages** to consume published screen config (titles, subtitles, visibility, labels, empty states), keeping business logic (enrolment, scoring, timers, progress, auth) server-enforced and untouched.

5. **Improve shared student shell**: consistent page headings, container widths, empty states, skeleton/loading states; respect reduced motion; 320px+ mobile widths.

6. **Tests**: vitest tests for new validation/sanitization functions; update `MASTER_PROMPT.md`.

## Verification baseline (all green before changes)
- `npm run typecheck` — pass
- `npm test` — 57 tests pass
- `npm run lint` — pass (pre-existing `next/image` warnings only)
- `npm run build` — pass
- `npm run build:cloudflare` — pass

---

# Pass 2 — Implementation (completed)

## Persistent per-screen configuration

- New typed contracts in `src/types/screens.ts`: `ScreenBaseConfig` + 12 screen documents (`lectures`, `lecturePlayer`, `tests`, `testPlayer`, `leaderboard`, `profile`, `eventsScreen`, `challengesScreen`, `chat`, `notifications`, `search`, `onboarding`). `SiteConfig` (and therefore `SiteSettingKey`) now includes them.
- One settings key per screen in the existing `site_settings` table (`draft` / `published` columns). **No database migration was required** — the table is a keyed jsonb store and the new keys are additive. Existing rows and consumers are untouched.
- `src/lib/screen-config.ts` is the registry + defaults + sanitiser: allowlisted section ids, required-section protection, bounded lengths, safe link handling and safe fallbacks for stale/malformed documents.
- Client validation in `src/lib/site-validation.ts` (`validateScreen`), mirrored server-side in `supabase/functions/ec-site-api` (`SCREEN_SETTING_KEYS`, `SCREEN_SECTIONS`, `validateScreenDraft`) with an automated drift test.
- `/public/site` already returns every published key; `SiteConfigContext` merges published values over the shipped defaults, so students always get a usable screen even if a setting is missing or the network fails.

## Admin control centre

- New **Screen Studio**: `/admin/screens` (selector with per-screen publish status) and `/admin/screens/[screen]` (editor).
- Editor pattern: Content → Display → Sections → Empty & help → Banner, plus a reusing `SettingsPublishBar` (save draft, publish to students, reset defaults, reload), validation feedback, discard confirmation, unsaved-change warning and a real-component preview with mobile/desktop modes.
- Sidebar regrouped to Overview / Screen Studio / Learning content / Tests & performance / Students & access / Communication / Website settings / System, with searchable navigation, ⌘K palette, quick actions and breadcrumbs on nested pages.
- **Login Page Designer removed** from the registry and route (`/admin/login` now explains that authentication is code-managed). Its stored `login` contract is retained so the live sign-in screen keeps working.
- Added a Doubt-chat console under Communication that reuses the preserved legacy Firestore chat implementation.
- Home page hero headline/description/CTA are now actually rendered from the hero section document (previously stored but unused).

## Student screens

- Every manageable screen now renders through shared `src/components/student/ScreenScaffold.tsx` primitives (heading, announcement banner, section wrapper, help note, empty state, layout class), so admin configuration and the preview cannot drift.
- Sections are hidden/ordered as published (where ordering is supported), labels/limits/search/filters/empty states come from the published document, and business logic is untouched.
- Quality fixes: consistent headings, real empty/loading/error states, accessible labels, safer ICS download origin, initials avatars instead of a third-party avatar service, a real profile-edit flow using the existing `POST /profile`, and removal of developer-facing copy from student screens.
- Login and Signup remain code-managed and were not modified functionally.

# Pass 3 — Verification actually run

| Check | Result |
|---|---|
| `npm ci` | pass |
| `npm run typecheck` | pass |
| `npm test` | pass — 69 tests (7 files), including 12 new Screen Studio tests |
| `npm run lint` | pass (only pre-existing `next/image` and one pre-existing hooks warnings) |
| `npm run build` | pass (21/21 pages) |
| `npm run build:cloudflare` | pass (OpenNext bundle written) |
| Production server smoke test | `/`, `/login`, `/admin`, `/admin/screens`, `/admin/login`, `/admin/homepage`, `/onboarding` all returned HTTP 200 with rendered HTML |
| Browser screenshot / visual check | **not executed** — Chromium could not be downloaded in this sandbox. See limitations. |

# Pass 4–5 — Critical review and fixes applied

Defects found during the independent review and corrected:

1. Section ordering was configurable but not honoured on Profile/Search/Challenges → Profile now renders strictly in order; Search/Challenges honour visibility; screens with a fixed reading order (players, onboarding, search) now say so and hide the reorder arrows, so the editor never promises something the page does not do.
2. Screen-specific "help" copy did not render on the test player → now rendered in both attempt and result views.
3. Hidden hero sections could still leak copy into the home greeting panel → the panel now uses the audience-filtered, visible section list.
4. Duplicate help note on the chat screen → single governed block.
5. Validation limits differed between the editor and the defaults (search item limit) → aligned and covered by tests.
6. Unused imports/dead helper exports cleaned; `vitest` now uses the automatic JSX runtime so component render tests match Next.js.

# Remaining limitations

- **Browser-based visual verification was not possible** in this environment (Playwright browser download blocked). Layout was verified by production build, server-rendered HTML smoke tests and component render tests, not by screenshots.
- The updated `ec-site-api` Edge Function must be **deployed by the owner** before the admin can save the new screen keys. Until then the editor shows the real server error and student screens keep their built-in defaults (no false "saved" state).
- Client-side navigation away from an edited screen relies on the visible unsaved-changes warning, the discard confirmation and the screen-switch confirmation; the browser-level `beforeunload` guard only covers reload/close.
- `/admin/screens` status cards compare draft and published JSON; a draft saved with identical content is shown as "Published".

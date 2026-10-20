# Exam Cracker — Next.js Web App

**JEE & NEET coaching web app** built with **Next.js App Router + TypeScript + Tailwind CSS**, connected to the existing **Firebase (darvo1)**, **Supabase Edge Function** and **Cloudflare ec-content-api Worker**. Mobile-first design with bottom nav, admin dashboard, YouTube playlist import (no Data API key) and real-time Firestore chat.

- **App name:** Exam Cracker
- **Firebase project:** `darvo1` (web API key `AIzaSyDuvN6q4ybHc6rLTHlYdhSs5_rzvc8nhTA`)
- **Supabase project ref:** `kncbvcozpcrfvxdbkbtf` — Edge Function `exam-cracker-api`
- **Cloudflare Worker (media proxy):** `https://ec-content-api.arvinddara0290.workers.dev` (separate from website Worker)
- **Website Worker:** `exam-cracker-web` (see `wrangler.toml` @ root)
- **Admin email (server-verified):** `arvinddarabishnoi@gmail.com`
- **Android appId (preserved for future wrapper):** `com.darvo.ec` (no Capacitor build in this web deliverable)

---

## Quick start

```bash
cp .env.example .env.local   # edit if needed — defaults already correct for darvo1
npm ci
npm run dev                  # http://localhost:3000
npm run build                # production build must pass
npm test                     # Vitest suite (date, validation, playlist paging, admin gate)
npm run typecheck
```

`.env.local` is git-ignored. Never commit `.env`, service-role keys, Firebase Admin JSON or Cloudflare API tokens.

### Public env vars (NEXT_PUBLIC_* — browser-safe)

| Var | Default | Notes |
|-----|---------|-------|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | `AIzaSy...nhTA` | darvo1 web key |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | `darvo1.firebaseapp.com` | |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | `darvo1` | |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | `darvo1.firebasestorage.app` | |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | `283467136948` | |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | `1:283467136948:web:...f7ce1` | |
| `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` | `G-FMV79YMHBC` | optional |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://kncbvcozpcrfvxdbkbtf.supabase.co` | |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_...` | **publishable only** — never service-role |
| `NEXT_PUBLIC_SUPABASE_FUNCTION_URL` | `…/functions/v1/exam-cracker-api` | no trailing slash |
| `NEXT_PUBLIC_CLOUDFLARE_MEDIA_PROXY_URL` | `https://ec-content-api...workers.dev` | |
| `NEXT_PUBLIC_ADMIN_EMAIL` | `arvinddarabishnoi@gmail.com` | UI hint; server checks token |
| `NEXT_PUBLIC_FIREBASE_VAPID_KEY` | *(empty)* | set after Firebase Console → Project settings → Cloud Messaging → Web Push cert |

All browser requests to Supabase send:

```
Authorization: Bearer <Firebase ID token>
apikey: <publishable key>
Content-Type: application/json
```

See `src/lib/api.ts` for full contract.

---

## Routes

| Route | Access | Description |
|-------|--------|-------------|
| `/` | public | Redirects to `/login`, `/onboarding` or `/home` based on session |
| `/login` | public | Email/password + Google (popup on desktop, redirect on mobile), reset |
| `/onboarding` | auth | Name + JEE/NEET + Class 11/12 → `POST /profile` |
| `/home` | auth | Today’s Goal, banners/events carousel, live/upcoming tests, batches, announcements |
| `/lectures` | auth | All/My Batches, Series, Lectures, Resources; access-code enrolment |
| `/lectures/[id]` | auth | YouTube player, next/prev, PDF, progress `POST /progress` (debounced) |
| `/tests` | auth | Live/upcoming/completed filter |
| `/tests/[id]` | auth | Timed attempt, draft restore, `POST /tests/:id/submit` (server scores) |
| `/leaderboard` | auth | Per-test rank (never mixed) `GET /leaderboard?testId=` |
| `/profile` | auth | `GET /analysis`, learning level, watched time |
| `/chat` | auth | Realtime own thread `studentThreads/{uid}/messages` |
| `/notifications` | auth | `users/{uid}/notifications` inbox |
| `/admin` | admin only | Overview, Goals, Batches, Lectures+playlist, Series, Tests+JSON, Events, Announcements, Students, Chat |

Schedules rendered in **Asia/Kolkata (IST)**; stored as UTC ISO in Supabase.

---

## Data flow (no secrets in browser)

```
Browser (NEXT_PUBLIC_*) ─Firebase Auth (ID token)─► Supabase Edge Function exam-cracker-api
                      ─Firestore (chat/notifs, RLS via rules)─► Firebase Firestore
                      ─Cloudflare ec-content-api (/video, /playlist + cursor)─► YouTube pages
```

- **RLS stays strict:** tables deny anon/auth direct access; only Edge Function with service-role (server side) reads/writes.
- **Writes:** `POST /enrollments` (access_code checked), `POST /progress`, `POST /tests/:id/submit`, admin CRUD `POST/PATCH/DELETE /admin/*`.
- **Worker:** `workers/ec-content-api/src/index.js` + `workers/ec-content-api/wrangler.toml` **must stay** `ec-content-api`. Website is **separate** `wrangler.toml` → `exam-cracker-web`.

---

## Cloudflare deployment

### Prereq (one-time, owner)

1. **Cloudflare account:** ID `93f8cbbe79e248f8d1db9fccc586f0c3` already in `wrangler.toml`.
2. **GitHub Actions secrets:**
   - `CLOUDFLARE_API_TOKEN` — Workers deploy permission
   - `CLOUDFLARE_ACCOUNT_ID` — `93f8cbbe79e248f8d1db9fccc586f0c3`
3. **Firebase Console (darvo1):**
   - Authentication → Sign-in method: enable **Email/Password** + **Google**.
   - Create user `arvinddarabishnoi@gmail.com` (admin must pre-exist).
   - Authentication → Settings → Authorized domains: add deployed Worker domain.
   - Firestore: ensure database exists (Native mode) and deploy `firestore.rules`.
   - Cloud Messaging → Web Push certificates → generate VAPID key → set `NEXT_PUBLIC_FIREBASE_VAPID_KEY` (optional; in-app notifs work without it).

### Local check

```bash
npm run build
npx @opennextjs/cloudflare build  # produces .open-next/
npx wrangler deploy --dry-run     # validate wrangler.toml
```

### CI vs Deploy

- **`ci.yml`** runs on every push/PR: `npm ci` → typecheck → lint → `vitest` → `next build` → secret-scan → worker-config check.
- **`deploy.yml`** runs only on `main` push: build + `npx @opennextjs/cloudflare build` + `wrangler deploy` (needs secrets).

> Deployment is only claimed complete when `deploy.yml` succeeds and URL is verified. No fake “live” claim.

Deployment guide: <https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/> (vinext beta; OpenNext is fallback documented there).

---

## Admin usage

- Sign in as `arvinddarabishnoi@gmail.com` (email match is also checked server-side via token).
- **Goals:** text, start/end (IST → UTC), CTA/deepLink, priority, active.
- **Batches/Series:** title, thumbnail, instructor, features, exam/classes, access_code.
- **Lectures:** batch/series parent, single YouTube URL → “Auto-fill” via `/video`, or **playlist URL → Import** (follows `nextCursor`, dedup by `videoId`, select/edit, set target + exam/class, save). All via `firestore.rules` + Supabase API.
- **Tests:** title, subject, schedule, duration, marks, JSON question bank — paste/upload → **Validate** → preview → save as `kind=test` with `metadata.questions`. Keys hidden until submit.
- **Events/Banners:** multiple image URLs, schedule, deepLink.
- **Announcements:** audience All/JEE/NEET, scheduled_at, active.

---

## Tests & quality

- `src/lib/date.ts` — IST ↔ UTC, schedule active, countdown.
- `src/lib/validation.ts` — `validateQuestionsJson`, safe URLs, deep links, exam/class filter.
- `src/lib/mediaProxy.ts` — `extractYoutubeVideoId/PlaylistId`, `importFullYoutubePlaylist` (cursor + dedup).
- `src/__tests__/examCracker.test.ts` — covers all above + admin email gate.
- `npm audit` — fix high/critical or document exception.
- Accessibility: semantic forms, focus rings, keyboard nav, safe-area, no `dangerouslySetInnerHTML` for user URLs.

---

## Firestore rules

Deployed from `firestore.rules` (project `darvo1`):

- `studentThreads/{uid}` — read/create/update by own uid or admin; delete admin only.
- `studentThreads/{uid}/messages/{id}` — create enforces `senderRole == 'student'` for students, `admin` for admin email.
- `users/{uid}/notifications/{id}` — create admin only; update allows student to mark read.
- `fcmTokens/{uid}/tokens/{id}` — per-uid write.
- `broadcasts/{id}` — read if `active==true` by any signed-in; write admin.

Tighten further if needed; never add public allow-all.

---

## What’s implemented vs manual steps

| Area | Status |
|------|--------|
| Next.js routes + responsive UI + skeletons/empty/error/toasts | ✅ |
| Firebase Auth (email+Google, popup+redirect, reset, persistence) | ✅ (client-only, window guards) |
| Supabase Edge Function wiring (all routes, token + apikey, error handling) | ✅ |
| Onboarding `POST /profile` | ✅ |
| Home (goals, events, tests, announcements) | ✅ |
| Batches/Series/lectures/resources browse + enrolment | ✅ |
| Lecture player (YouTube embed, prev/next, PDF, debounced progress) | ✅ |
| Tests (filter, timer, draft, submit, result, review, leaderboard) | ✅ |
| Analysis/Profile | ✅ |
| Firestore chat + notifications (live, rules, FCM optional) | ✅ |
| Admin tabs (goals/batches/lectures/playlist/series/tests/events/announcements/students/chat) | ✅ |
| Workers separation (web vs ec-content-api) | ✅ |
| CI workflow | ✅ |
| Deploy workflow | ✅ (requires owner to add secrets) |
| Manual Firebase enable (Email/Google, admin user, Firestore init, authorized domains, VAPID) | ⚠️ owner must do (see above) |
| Real Cloudflare deployment | ⚠️ runs when secrets set on `main` push |
| APK/Capacitor | ⏸️ intentionally not built for this web task; scaffolding preserved if any |

---

## FAQ

**Why not use service-role in browser?** RLS denies it; Edge Function verifies Firebase token itself (verify_jwt disabled by design). Publishable key is not a permission grant.

**Do we need YouTube Data API key?** No. `ec-content-api` scrapes public oEmbed/playlist pages. Private/blocked/region-locked content may fail — UI shows error + manual add.

**Can students see other students’ chats?** No — rules + thread scoping enforce per-uid access; admin only sees all.

---

Built for `arvindbishnoiji/examcracker` branch `arena/0752c1a5-examcracker`. See `MASTER_PROMPT.md` for full spec.

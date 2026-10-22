# Exam Cracker repository audit (2026-10-22)

This audit reflects the current D1/Drive implementation on `arena/706d3508-examcracker`, not the historical architecture described in older audit notes.

## Architecture and dependencies

- Next.js 15 App Router + React 18 + TypeScript + Tailwind 3; no component framework dependency. `lucide-react` supplies icons.
- Firebase Authentication is the identity provider. The browser calls same-origin `/api/ec/*`; the Next route proxies to `workers/ec-api/src/index.js`.
- The Worker verifies Firebase ID-token signatures, checks the configured administrator email (`arvinddarabishnoi@gmail.com`), and uses parameterized D1 SQL. D1 is the structured application store.
- Google Drive holds private files. D1 `drive_files` contains references/metadata only. Profile and PDF uploads use the existing Drive/Apps Script integration. The separate YouTube content proxy remains independent.
- OpenNext/Cloudflare configuration is in `open-next.config.ts`, `wrangler.toml`, `custom-worker.mjs`, and `cloudflare-pages/`. Migrations are additive SQL in `migrations/`.
- Automated coverage is Vitest (`src/__tests__`, Worker tests, migration tests); CI also checks typecheck/lint/build/migrations and deploy workflows are GitHub Actions.

## Feature map and current state

Student routes include onboarding, home, lectures and lecture player, tests and attempts, leaderboard, profile/analysis, events, challenges, search, notifications, library, and feedback. The shared student shell/screen configuration and loading/error patterns already exist. Home/profile use real recorded lesson and exam data; profile analysis measures watch progress. Existing courses, test scoring, enrollment, upload and authorization flows should be retained.

Admin is one `/admin` application, not a second dashboard. `AdminShell` already provides a collapsible responsive sidebar, searchable navigation, keyboard command palette, breadcrumbs, quick actions and reduced-motion preferences. Admin settings use draft/publish workflows. Existing sections cover overview, screen/homepage studios, batches/subjects/lectures/tests, student access, communication, analytics, health/reports, Drive operations, settings, import/export and legacy playlist tooling. The overview reads real D1 counts, attempts, activity and content-health checks.

## UX issues and locations

- Admin information architecture and global search are already implemented in `src/lib/admin-sections.ts` and `src/components/admin/AdminShell.tsx`, but several newly requested capabilities (badges, measurable request telemetry, AI operations) have no corresponding section yet. The overview cannot show these until the underlying data exists.
- The student profile at `src/app/profile/page.tsx` has real analysis and settings, but no achievement gallery or server-backed verification state. Existing `badge` references in Batch Studio are display copy only; they do not award credentials.
- Some admin inbox/data panels use fixed-interval refresh (for example `FeedbackSection` every 15 seconds). This can be paused while a browser tab is hidden and should be reviewed before increasing polling elsewhere.
- `workers/ec-api/src/index.js` exposes existing admin activity and analytics, but activity is a bounded recent list rather than a complete searchable, paginated audit report. Current metrics are domain aggregates, not per-endpoint request telemetry.
- Home/dashboard, student screen scaffolding, accessible UI primitives and mobile admin navigation already exist; work should extend those rather than replace the app shell or introduce a duplicate UI.

## Storage, requests, and security

- Storage-heavy assets are private Drive profile photos and PDFs. `drive_files` records MIME type, size and purpose; actual provider-wide quota is not measured. A public-display badge asset mechanism is not currently present.
- High-frequency request candidates include dashboard bootstrap/analytics requests, test/profile reads, and the 15-second feedback inbox polling. Existing authenticated GETs are not publicly cached. No trustworthy D1 endpoint request-volume/latency aggregation currently exists.
- Admin routes are grouped below the Worker `segments[0] === "admin"` gate and require the verified administrator email. Student profile writes accept only display name/exam/class; user-submitted verification state is not accepted. Keep all new admin actions under the Worker gate, not just hidden in the UI.
- Existing audit writes use `admin_activity`; do not place secrets, tokens or private file bodies in metadata. New award/revoke writes can reuse this table and preserve history.

## Prioritized implementation plan

1. Preserve the working app and improve student achievement clarity with a server-authorized badge record, manual award/revoke history, profile gallery and verification mark.
2. Keep badge authoring/award actions in the existing admin shell and enforce every authorization and duplicate-prevention rule in the Worker.
3. Expand operational reports only where the repository has trustworthy data; distinguish Drive metadata estimates from provider quota and instrumented endpoint telemetry from Cloudflare billing data.
4. Add image upload/public serving only after designing a safe public-display storage path; the current Drive purpose model intentionally supports private profile/PDF files, not public achievement assets.
5. Introduce automatic/scheduled badge awards only when reliable recorded signals and a production scheduler exist. There is currently no demonstrated background scheduler or configured AI provider; UI must say so rather than simulate execution.
6. Add tests and additive migrations; run local checks. Remote D1 migration, secret setup and deployment remain owner-controlled.

## Scope of this implementation stage

This PR implements the first coherent slice: normalized badge definitions, idempotent manual awards and revocation history, server-authorized badge APIs, admin badge management, student achievement display, and audit entries. Image binary upload/public hosting, automatic/scheduled rules, endpoint telemetry, a full audit-report workspace, and AI provider execution remain explicitly out of scope until their necessary storage/scheduler/telemetry/provider infrastructure is configured.

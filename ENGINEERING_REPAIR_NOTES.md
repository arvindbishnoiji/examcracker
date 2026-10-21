# Exam Cracker engineering repair notes

## Findings and fixes

- **Pages API routing:** the existing Pages catch-all was forwarding API requests through `EXAM_CRACKER_WEB`. Added a more-specific `/api/ec/*` Pages Function that invokes the canonical authenticated worker handler against the Pages `DB` binding. The build now bundles that handler into a self-contained Pages Function. Non-API dynamic page rendering still uses the Worker service binding; static assets stay excluded from Function routing.
- **Subject hierarchy visibility:** server validation accepted a lecture/resource with a parent batch/series and no `subject_id`; the admin form even offered “Unassigned”. Those rows were persisted in D1 but grouped under the student tree’s General bucket instead of the subject the admin expected. A parent-scoped lecture/resource now requires a subject assigned to that exact parent. Manual entry and playlist import both require a subject, and playlist items retain the selected parent, subject and order.
- **Admin lifecycle:** disabled entries were fetched in the admin catalog, but the content browser exposed only a Disable action. Added explicit Restore actions and state, exam, class and search filters for batch/series and lecture lists. Successful create/edit/restore flows await the server reload rather than relying on optimistic UI state.
- **Profile editing:** the existing private Drive upload flow already verified image contents server-side, persisted file references in D1, and supported progress/cancel/retry. Added a square crop preview with zoom, rotation, reset/cancel and confirmation before the edited JPEG is uploaded. Private-file authorization and object-URL cleanup remain in place.

No schema changes were needed; no migration was added.

## PR #34 / Pages build investigation

PR #34 is open on its own feature branch. Its latest observed checks are **CI success** and **Cloudflare Pages deployment success** (latest preview commit `d56d882`; run `39645182551`). The preview status reported a successful deployment and a branch-preview URL.

The earlier CI run `39645159183` failed before typecheck/tests/build, at **Validate Cloudflare Pages proxy**. The failing revision (`eea86c8`) had changed the build to use `pages-api-entry.mjs` and esbuild, while the CI validation still required the old `workers/ec-api/src/index.js`/`drive.js` copy strings in `build.sh`. That stale assertion was updated to validate the generated standalone bundle; latest CI passed. Several intermediate Pages preview checks also reported “Build failed”; their GitHub check summaries expose only that status, not the underlying Cloudflare log text. The latest preview passed, and this branch independently completed `bash cloudflare-pages/build.sh` locally. Do not treat either result as proof that dashboard bindings/secrets are configured.

## Verification performed in this workspace

- `npm ci` — passed (npm reported 36 existing dependency audit findings: 14 moderate, 20 high, 2 critical).
- `npm run typecheck` — passed.
- `npm run lint` — passed with existing `<img>`/hook warnings and the existing Next.js lint deprecation notice.
- `npm test -- --reporter=dot` — passed: 176 tests across 12 files, including D1-backed SQLite integration tests for direct Pages routing, Firebase administrator authorization, mandatory parent/subject association, persisted edit/order, student visibility, disable and restore.
- `npm run build` — passed.
- `npm run build:cloudflare` — passed.
- `bash cloudflare-pages/build.sh` — passed; produced a self-contained Pages API bundle and staged static files with 26 route exclusions. Generated output was removed from the working tree afterward.

The integration suite applies the checked-in migrations to an in-memory SQLite database and exercises the real API handler. It does not mutate production D1. A real administrator/student production end-to-end session and photo upload were not performed because no test accounts or safe remote D1 environment are available here.

## Cloudflare configuration still requiring dashboard verification

In **Workers & Pages → `examcrack` → Settings** configure for Production (and Preview where applicable):

1. **Builds & deployments:** Framework preset `None`; root directory `cloudflare-pages`; build command `bash build.sh`; output directory `public`.
2. **D1 binding:** variable `DB` → database `exam-cracker-db` (ID `dbf2375d-a302-443f-83bf-df59e1d98177`).
3. **Service binding:** variable `EXAM_CRACKER_WEB` → Worker `exam-cracker-web` for dynamic Next.js page HTML/server routes.
4. **Server-only Drive values:** configure `GOOGLE_SERVICE_ACCOUNT_JSON` and `GOOGLE_DRIVE_FOLDER_ID` as Pages secrets/variables if Google Drive remains enabled. Worker secrets are not inherited by Pages Functions. Do not use `NEXT_PUBLIC_*` for these values.

These settings were not inspected or changed through Cloudflare dashboard access during this work. Apply the binding/secrets, save and redeploy before claiming that the production Pages API is D1-backed. Confirm the same Pages build settings and binding set for Preview if preview workflows need Drive/API access.

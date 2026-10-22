# Google Drive setup (profile photos and PDFs)

Exam Cracker stores structured data in Cloudflare D1 and **files** in Google Drive.
Drive is never called from the browser: the Worker authenticates with a service
account, uploads with server-side credentials, verifies folder access before
creating files, and streams downloads only after verifying the caller's Firebase
ID token and course enrollment rights.

| What | Where |
| --- | --- |
| File bytes (profile photos, course PDFs) | Google Drive folder (`1sSYE5cAY6jjAgzOYTgCQNOR1xxotc_I8` or purpose override) |
| File metadata (Drive id, MIME type, size, owner, course, status) | D1 `drive_files` |
| Credentials | Worker secrets only (`GOOGLE_SERVICE_ACCOUNT_JSON`, `GOOGLE_DRIVE_FOLDER_ID`; optional `GOOGLE_DRIVE_IMPERSONATE_EMAIL` for Workspace domain-wide delegation) |
| Pages front-door delegation | `cloudflare-pages/pages-api-entry.mjs` forwards `/drive/*`, `/admin/drive/*`, `/files/:id` to `EXAM_CRACKER_WEB` when Pages lacks `GOOGLE_SERVICE_ACCOUNT_JSON` |
| Admin live diagnostics | `GET /api/ec/admin/drive/status?probe=1` (**Admin → Media & Files → Verify Drive Folder**) |
| Browser access | `GET /api/ec/files/:id` with a Firebase `Authorization: Bearer` header |

Files are **not** shared with “anyone with the link”. The target folder stays
private; the Worker service account is the only reader/writer.

---

## Why `Google Drive upload failed (Google HTTP 404). The file was not saved.` happens

Google Drive API v3 (`files.get` / `upload/drive/v3/files?supportsAllDrives=true`)
returns **HTTP 404 (`notFound`)** in four situations:

1. **Folder not shared with the service account (most common):** Google Drive
   deliberately returns `404 File not found` instead of `403` when a service
   account (`client_email` inside `GOOGLE_SERVICE_ACCOUNT_JSON`) has not been
   granted **Editor** access to a private Drive folder, so private folder IDs
   cannot be enumerated.
2. **Full folder URL pasted instead of raw folder ID:** e.g.
   `https://drive.google.com/drive/folders/1sSYE5cAY6jjAgzOYTgCQNOR1xxotc_I8?usp=sharing`
   (now automatically normalized server-side by `normalizeDriveFolderId`, while
   plain IDs remain recommended).
3. **Deleted, trashed, or file-ID mismatch:** the ID points to a trashed folder
   or a regular file rather than `application/vnd.google-apps.folder` (now
   pre-checked before upload by `probeDriveFolder`).
4. **Split Pages / Worker secret scope:** Cloudflare Pages Functions handled
   `/api/ec/*` without `GOOGLE_SERVICE_ACCOUNT_JSON` or a different
   `GOOGLE_DRIVE_FOLDER_ID`. `cloudflare-pages/pages-api-entry.mjs` now
   delegates all Drive status, upload, cleanup, and file-stream routes directly
   to the `EXAM_CRACKER_WEB` Worker service binding whenever Pages does not
   hold `GOOGLE_SERVICE_ACCOUNT_JSON` locally.

---


## Why uploads can fail with HTTP 403 `storageQuotaExceeded`

This is a Google account/storage ownership limitation, not a retryable upload bug. A Google service account does not get a normal personal Drive storage quota. Sharing a folder in an individual's **My Drive** with the service account does not transfer storage ownership, so uploads can fail even when the folder is shared correctly.

Choose one of these supported setups:

1. **Recommended — Shared Drive:** create a folder inside a Google Workspace Shared Drive, add the service account email as **Content manager** (or a role allowed to add files), and set `GOOGLE_DRIVE_FOLDER_ID` to that folder ID. The Shared Drive must belong to a Workspace organization that supports Shared Drives; a regular personal Gmail Drive cannot create one.
2. **Workspace domain-wide delegation:** only if you control a Google Workspace organization. Enable domain-wide delegation for the service account in Google Cloud, authorize the Drive scope `https://www.googleapis.com/auth/drive` in the Workspace Admin console, then set the Worker variable/secret `GOOGLE_DRIVE_IMPERSONATE_EMAIL` to the Workspace user whose Drive storage should own the files. That user's storage quota and policies apply. Do not set this option for a personal Gmail account or unless the Workspace administrator has explicitly authorized it.

After changing the setup, use **Admin → Media & Files → Verify Drive Folder**, then upload a small test file. Keep all Google credentials as Worker secrets/variables; never put them in client code or commit them to GitHub. A code deployment alone cannot create a Shared Drive, add the service account to it, or grant Workspace domain-wide delegation.

## 1. Enable the Drive API & create a Service Account

1. Open <https://console.cloud.google.com/> and select the Google Cloud project
   that owns your service account.
2. Go to **APIs & Services → Library**, search for **Google Drive API**, open it
   and click **Enable**.
3. Go to **IAM & Admin → Service accounts → Create service account** (or select
   your existing Drive service account).
   - Name example: `exam-cracker-drive`
4. Open the service account → **Keys → Add key → Create new key → JSON**.
   Download the JSON file containing `client_email` and `private_key`.
   Treat this file as a password: never commit it, never put it in `.env*` or
   `NEXT_PUBLIC_*`, and delete the local file after uploading the Worker secret.

## 2. Share folder `1sSYE5cAY6jjAgzOYTgCQNOR1xxotc_I8` with the Service Account

1. Open the target folder in Google Drive:
   `https://drive.google.com/drive/folders/1sSYE5cAY6jjAgzOYTgCQNOR1xxotc_I8`
2. Click **Share** → paste the service account `client_email`
   (`<service-account>@<project>.iam.gserviceaccount.com`) → choose role
   **Editor** → click **Share**.
   - **Editor** (or **Content manager** / **Organizer** on a Shared Drive) is
     required for uploads and orphan cleanup.
   - Keep **General access** set to **Restricted** (never “Anyone with the link”).
3. If you do not remember which `client_email` is currently configured on
   Cloudflare, sign in to the app as Admin and open **Admin → Media & Files**
   (or open the Add Lecture modal) — the **Google Drive Private Storage** card
   displays the configured `serviceAccountEmail` and masked folder ID without
   exposing any secret key material.

## 3. Store secrets on the Cloudflare Worker (`exam-cracker-web`)

Run these from an authenticated terminal. Never place `GOOGLE_DRIVE_FOLDER_ID`
under `[vars]` in `wrangler.toml` if it already exists as a Worker secret
(Cloudflare rejects duplicate var/secret names during deploy).

```bash
npx wrangler whoami

# 1. Store the service-account JSON on one line
npx wrangler secret put GOOGLE_SERVICE_ACCOUNT_JSON --name exam-cracker-web

# 2. Set the target Drive folder ID: 1sSYE5cAY6jjAgzOYTgCQNOR1xxotc_I8
printf "1sSYE5cAY6jjAgzOYTgCQNOR1xxotc_I8" | npx wrangler secret put GOOGLE_DRIVE_FOLDER_ID --name exam-cracker-web
```

Optional purpose-specific overrides (if set, each folder must also be shared
with the same service account as **Editor**; otherwise remove stale overrides so
`GOOGLE_DRIVE_FOLDER_ID` is used):

```bash
npx wrangler secret list --name exam-cracker-web
# Optional overrides:
# npx wrangler secret put GOOGLE_DRIVE_PROFILE_FOLDER_ID --name exam-cracker-web
# npx wrangler secret put GOOGLE_DRIVE_PDF_FOLDER_ID --name exam-cracker-web
```

Verify immediately after updating secrets:
1. Open **Admin → Media & Files** (or **Lectures → + Add Lecture**).
2. Click **Verify Drive Folder**.
3. Confirm the green status pill reports folder access and write capability (`canAddChildren: true`).

## 4. Local development

`next dev` has no Cloudflare bindings, so `/api/ec/*` returns an explicit 503.
To run the real Worker + D1 locally:

```bash
npm ci
npx wrangler d1 migrations apply exam-cracker-db --local

# .dev.vars is git-ignored. Never commit it.
cat > .dev.vars <<'EOF'
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account","client_email":"...","private_key":"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"}
GOOGLE_DRIVE_FOLDER_ID=1sSYE5cAY6jjAgzOYTgCQNOR1xxotc_I8
EOF

npm run build:cloudflare
npx wrangler dev --local
```

Use a separate test folder when experimenting locally so test uploads do not
mix with student production files.

## 5. Security & validation guarantees

- **Folder preflight (`probeDriveFolder`)** — verifies folder existence,
  `application/vnd.google-apps.folder` MIME type, non-trashed state, and
  `capabilities.canAddChildren` (`supportsAllDrives=true`) before uploading
  bytes, returning actionable guidance with the exact `client_email` when `404`
  or `403` occurs.
- **Profile photos** — JPEG/PNG/WebP only, max 5 MB, magic-byte signature
  verified. Supersedes prior photo rows cleanly.
- **Course PDFs** — Admin only, `%PDF-` signature verified, max 20 MB, linked
  to `courseId`. Streamed only to admins or students enrolled in that course.
- **No public Drive links** — `src/lib/api.ts` streams files exclusively via
  authenticated `/api/ec/files/:id` with `Cache-Control: private, max-age=60`
  and `X-Content-Type-Options: nosniff`.


## Personal Gmail My Drive uploads with Google Apps Script (recommended for this folder)

For a **personal @gmail.com My Drive**, use the Apps Script bridge instead of service-account uploads. Apps Script runs as the Google account that owns the script and creates files in that account's Drive quota. Exam Cracker still authenticates users with Firebase, checks admin/profile permissions, stores metadata in D1, and serves files through its authenticated API. The service account may remain configured for private reads/deletes; share the target folder with its service-account email as Editor so it can access files created by Apps Script.

### 1. Create the Apps Script bridge

1. While signed into the personal Gmail account that owns the target folder, open <https://script.google.com/> and create a project.
2. Paste the contents of [`cloudflare-pages/apps-script-drive-bridge.gs`](cloudflare-pages/apps-script-drive-bridge.gs) into the editor.
3. In **Project Settings → Script properties**, add:
   - `EXAM_CRACKER_SHARED_SECRET`: a long random secret (at least 32 random characters).
   - `EXAM_CRACKER_FOLDER_ID`: the exact personal My Drive folder ID.
4. Click **Deploy → New deployment → Web app**:
   - **Execute as:** Me (the account that owns the folder).
   - **Who has access:** Anyone.
   - Deploy, authorize Drive access, and copy the `https://script.google.com/macros/s/.../exec` URL.
5. If you change the script code later, create a new version under **Deploy → Manage deployments → Edit → New version**.

The Web App must be publicly reachable because Cloudflare calls it server-to-server. The shared secret is checked before any Drive operation; the script also rejects every folder except the configured folder. Keep the secret private, rotate it if exposed, and do not place it in the URL or frontend.

### 2. Add these Cloudflare secrets

Add both secrets to the **Cloudflare Pages project `examcrack` → Settings → Variables and Secrets → Production** (and Preview only if you intend to test previews):

| Secret name | Value |
| --- | --- |
| `GOOGLE_APPS_SCRIPT_URL` | The deployed Apps Script Web App URL ending in `/exec` |
| `GOOGLE_APPS_SCRIPT_SHARED_SECRET` | The exact same random secret as Script Property `EXAM_CRACKER_SHARED_SECRET` |

Keep `GOOGLE_DRIVE_FOLDER_ID` set to your folder ID. If `GOOGLE_DRIVE_PROFILE_FOLDER_ID` or `GOOGLE_DRIVE_PDF_FOLDER_ID` overrides are set, either unset them or set them to the same folder ID configured in `EXAM_CRACKER_FOLDER_ID`; the bridge intentionally allowlists one folder. Do **not** paste the service-account JSON, shared secret, or Apps Script URL into site HTML, a public environment variable, or GitHub. Save the Cloudflare secrets and redeploy the Pages project.

If the folder is shared with the existing service account, retain `GOOGLE_SERVICE_ACCOUNT_JSON` on the runtime that handles authenticated file downloads and cleanup. The upload bridge only changes how new file bytes are created; it does not bypass Exam Cracker's Firebase auth, D1 ownership/access checks, or private download routes. Do not remove the service-account credentials until a separate read/delete migration has been implemented.

### 3. Verify before real uploads

Sign in as the configured admin and use **Admin → Media & Files → Verify Drive Folder**. The status should show the Apps Script personal Gmail backend ready. Upload one small image and confirm it appears in the intended My Drive folder. A code change alone cannot create your Apps Script deployment or configure secrets, so no successful live upload can be claimed until these owner-controlled steps are complete.

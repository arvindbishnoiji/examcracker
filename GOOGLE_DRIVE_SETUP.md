# Google Drive setup (profile photos and PDFs)

Exam Cracker stores structured data in Cloudflare D1 and **files** in Google Drive.
Drive is never called from the browser: the Worker authenticates with a service
account, uploads with server-side credentials and streams downloads only after it
has verified the caller's Firebase ID token and access rights.

| What | Where |
| --- | --- |
| File bytes (profile photos, course PDFs) | Google Drive folder owned by the owner |
| File metadata (Drive id, MIME type, size, owner, course, status) | D1 `drive_files` |
| Credentials | Worker secrets only (`GOOGLE_SERVICE_ACCOUNT_JSON`, `GOOGLE_DRIVE_FOLDER_ID`) |
| Browser access | `GET /api/ec/files/:id` with a Firebase `Authorization: Bearer` header |

Files are **not** shared with “anyone with the link”. The service account folder
stays private; the Worker is the only reader.

---

## 1. Enable the Drive API

1. Open <https://console.cloud.google.com/> and select (or create) the project you
   want to own the files. This can be the same project as Firebase `darvo1` or a
   separate one — it only needs the Drive API.
2. Go to **APIs & Services → Library**, search for **Google Drive API**, open it
   and click **Enable**.
3. Go to **IAM & Admin → Service accounts → Create service account**.
   - Name: `exam-cracker-drive`
   - No project-level IAM role is required. Drive access is granted by sharing a
     folder with this account (step 2).
4. Open the new service account → **Keys → Add key → Create new key → JSON**.
   Download the JSON file. It contains `client_email` and `private_key`.
   Treat this file as a password: never commit it, never paste it into chat, and
   delete the local copy once the secret is stored in Cloudflare.

## 2. Create and share the Drive folder

1. In Google Drive create a folder, e.g. **Exam Cracker Uploads**.
2. Right-click → **Share** → paste the service-account `client_email`
   (`exam-cracker-drive@<project>.iam.gserviceaccount.com`) → role **Editor**.
   - Editor is required for uploads and deletions by the cleanup tool.
   - Do **not** enable “Anyone with the link”.
3. Copy the folder id from the URL:
   `https://drive.google.com/drive/folders/`**`1AbCdEfGhIjKlMnOpQrStUvWxYz`**

Optional: create separate folders for photos and PDFs and share each one with the
same service account. Purpose-specific ids override the general folder.

## 3. Store the secrets in the Worker

Run these **yourself** from the repository root with an authenticated Wrangler
session. They are interactive: Wrangler prompts for the value and stores it as an
encrypted Worker secret, not in `wrangler.toml`.

```bash
npx wrangler whoami                     # confirm the correct Cloudflare account
npx wrangler secret put GOOGLE_SERVICE_ACCOUNT_JSON --name exam-cracker-web
# paste the entire JSON object from the downloaded key file on one line, press Enter

npx wrangler secret put GOOGLE_DRIVE_FOLDER_ID --name exam-cracker-web
# paste the folder id from step 2
```

Optional purpose-specific folders (otherwise `GOOGLE_DRIVE_FOLDER_ID` is used):

```bash
npx wrangler secret put GOOGLE_DRIVE_PROFILE_FOLDER_ID --name exam-cracker-web
npx wrangler secret put GOOGLE_DRIVE_PDF_FOLDER_ID --name exam-cracker-web
```

Optional scope override (default `https://www.googleapis.com/auth/drive`):

```bash
npx wrangler secret put GOOGLE_DRIVE_SCOPE --name exam-cracker-web
```

List what is configured **without revealing values**:

```bash
npx wrangler secret list --name exam-cracker-web
```

Deploy the Worker after changing secrets so new isolates pick them up.

> A shared drive (`supportsAllDrives=true`) works as long as the service account is
> a member of that shared drive with edit access.

## 4. Local development

`next dev` has no Cloudflare bindings, so `/api/ec/*` returns a clear 503. To run
the real API locally:

```bash
npm ci
npx wrangler d1 migrations apply exam-cracker-db --local

# .dev.vars is git-ignored. Never commit it.
cat > .dev.vars <<'EOF'
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account","client_email":"…","private_key":"-----BEGIN PRIVATE KEY-----\n…\n-----END PRIVATE KEY-----\n"}
GOOGLE_DRIVE_FOLDER_ID=your-folder-id
EOF

npm run build:cloudflare
npx wrangler dev --local        # serves the built OpenNext bundle with D1 + secrets
```

Use a **separate** Drive folder for local testing so test uploads do not mix with
real student files.

## 5. What the app enforces

- **Profile photos** — student only, JPEG/PNG/WebP, max 5 MB
  (`GOOGLE_DRIVE_MAX_PROFILE_PHOTO_MB`), magic-byte sniffing rejects renamed files.
  A successful replacement supersedes the old row and best-effort deletes the old
  Drive file; the profile is updated immediately.
- **PDFs** — admin only, PDF only, max 20 MB (`GOOGLE_DRIVE_MAX_PDF_MB`), required
  `courseId`, validated signature. Students can list and open PDFs only for a
  course they are enrolled in (admins can access all).
- **Orphans** — if Drive accepts the upload but the D1 write fails, the Worker
  deletes the Drive file; if that also fails the row is marked `orphan` and the
  admin cleanup tool (`POST /api/ec/admin/drive/cleanup`) reconciles it.
- **Privacy** — downloads require a token. The API sets
  `Cache-Control: private, max-age=60`, `X-Content-Type-Options: nosniff`,
  `X-Frame-Options: SAMEORIGIN` and a restrictive CSP sandbox.

## 6. Troubleshooting

| Message / symptom | Cause | Fix |
| --- | --- | --- |
| `Google Drive is not configured. Set the GOOGLE_SERVICE_ACCOUNT_JSON Worker secret.` | Secret missing or Worker not redeployed | `wrangler secret put …`, then deploy |
| `Google Drive credentials are invalid. The GOOGLE_SERVICE_ACCOUNT_JSON secret must contain the service-account JSON object.` | Pasted only the key, or invalid JSON | Paste the complete JSON; re-create the key if necessary |
| `… needs client_email and private_key.` | Wrong JSON (e.g. OAuth client id) | Use a **service account** key |
| `Google Drive destination folder is not configured…` | Folder id missing or contains spaces | Set `GOOGLE_DRIVE_FOLDER_ID` |
| `Google Drive authentication failed (Google HTTP 400/401)` | Clock skew, revoked key, or Drive API not enabled | Check the system clock, re-create the key, enable the API |
| `Google Drive upload failed (Google HTTP 403)` | Folder not shared with the service account, or storage quota | Share folder as **Editor**; check Drive storage |
| `Google Drive upload failed (Google HTTP 404)` | Folder id wrong / folder deleted | Re-copy the id from the folder URL |
| `This file could not be read from Google Drive (Google HTTP 404)` | File deleted outside the app | Admin cleanup marks the row `deleted` |
| Photo uploads succeed but images do not render | The browser is requesting the file without a token | Use the built-in `ProfileAvatar` / authenticated blob fetch; never hot-link Drive |

Rotating a key: create a new JSON key, update the secret, deploy, then delete the
old key in Google Cloud. Rotating the key invalidates cached tokens automatically
because the token cache key includes the service-account email and scope.

## 7. What this guide does not do

No Drive API call, secret upload or remote deployment is performed by the code in
this repository on its own. Until the owner runs the commands above, photo/PDF
uploads return the explicit 503 configuration errors listed above — they never
report a fake success.

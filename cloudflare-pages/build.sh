#!/usr/bin/env bash
set -euo pipefail

# Cloudflare Pages project root is cloudflare-pages/, while Next.js and
# OpenNext are built from the repository root.
PAGES_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$PAGES_DIR/.." && pwd)"

cd "$REPO_ROOT"

# Keep these defaults aligned with .github/workflows/deploy.yml. Cloudflare
# Pages dashboard build variables override them when the owner configures a
# custom Firebase project or media proxy. NEXT_PUBLIC_* values are public.
export NEXT_PUBLIC_FIREBASE_API_KEY="${NEXT_PUBLIC_FIREBASE_API_KEY:-AIzaSyA1fiEviIdG5_yi7AcyxC3m9sec-AdkOfU}"
export NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="${NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN:-darvo1.firebaseapp.com}"
export NEXT_PUBLIC_FIREBASE_PROJECT_ID="${NEXT_PUBLIC_FIREBASE_PROJECT_ID:-darvo1}"
export NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="${NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET:-darvo1.firebasestorage.app}"
export NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="${NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID:-283467136948}"
export NEXT_PUBLIC_FIREBASE_APP_ID="${NEXT_PUBLIC_FIREBASE_APP_ID:-1:283467136948:web:c66fd594827909eb3f7ce1}"
export NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID="${NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID:-G-FMV79YMHBC}"
export NEXT_PUBLIC_CLOUDFLARE_MEDIA_PROXY_URL="${NEXT_PUBLIC_CLOUDFLARE_MEDIA_PROXY_URL:-https://ec-content-api.arvinddara0290.workers.dev}"
export NEXT_PUBLIC_ADMIN_EMAIL="${NEXT_PUBLIC_ADMIN_EMAIL:-arvinddarabishnoi@gmail.com}"
export NEXT_PUBLIC_GOOGLE_AUTH_ENABLED="${NEXT_PUBLIC_GOOGLE_AUTH_ENABLED:-true}"
export NEXT_PUBLIC_SITE_URL="${NEXT_PUBLIC_SITE_URL:-https://examcrack.pages.dev}"

echo "Building Exam Cracker Next.js app and OpenNext assets from $REPO_ROOT"
npm ci
npm run build:cloudflare

# Pages Functions run the same canonical D1 API handler as local Next.js,
# but production API requests bind directly to D1 rather than calling the
# exam-cracker-web service binding. Copy it into Functions' deployable bundle.
echo "Preparing the direct-D1 Pages API handler"
SHARED_API_DIR="$PAGES_DIR/functions/_shared/ec-api"
mkdir -p "$SHARED_API_DIR"
cp "$REPO_ROOT/workers/ec-api/src/index.js" "$SHARED_API_DIR/index.js"
cp "$REPO_ROOT/workers/ec-api/src/drive.js" "$SHARED_API_DIR/drive.js"

echo "Staging static assets for Cloudflare Pages"
node "$PAGES_DIR/stage-assets.mjs"

echo "Pages output is ready at $PAGES_DIR/public"

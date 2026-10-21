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
export NEXT_PUBLIC_SITE_URL="${NEXT_PUBLIC_SITE_URL:-https://examcracker.pages.dev}"

echo "Building Exam Cracker Next.js app and OpenNext assets from $REPO_ROOT"
npm ci
npm run build:cloudflare

# Produce one self-contained Pages Function bundle so Pages deployment does
# not need to resolve generated helper files outside its entry-point bundle.
# This is the same canonical handler used by local Next.js, now called with
# the Pages D1 binding directly instead of the EXAM_CRACKER_WEB service hop.
echo "Bundling the direct-D1 Pages API handler"
npx esbuild "$PAGES_DIR/pages-api-entry.mjs" \
  --bundle --format=esm --platform=browser --target=es2022 \
  --outfile="$PAGES_DIR/functions/api/ec/[[path]].js"
node --check "$PAGES_DIR/functions/api/ec/[[path]].js"

echo "Staging static assets for Cloudflare Pages"
node "$PAGES_DIR/stage-assets.mjs"

echo "Pages output is ready at $PAGES_DIR/public"

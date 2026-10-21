import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const pagesDir = fileURLToPath(new URL(".", import.meta.url));
const repoRoot = resolve(pagesDir, "..");
const assetsDir = join(repoRoot, ".open-next", "assets");
const outputDir = join(pagesDir, "public");

if (!existsSync(assetsDir)) {
  throw new Error(
    "OpenNext static assets are missing. Run `npm run build:cloudflare` from the repository root before staging Pages."
  );
}
if (!existsSync(join(assetsDir, "_next", "static"))) {
  throw new Error(
    "The OpenNext asset output has no _next/static directory; refusing to deploy Pages without client JS/CSS."
  );
}

mkdirSync(outputDir, { recursive: true });
// This directory contains generated public assets for the same OpenNext build
// that is deployed to the backend Worker. Re-stage it on every clean Pages build.
cpSync(assetsDir, outputDir, { recursive: true, force: true });

// Pages Functions are intentionally skipped for hashed framework assets and
// ordinary public files. Those assets now exist in the Pages output directory,
// so these exclusions save both the Pages Function invocation and the backend
// Worker invocation that the old catch-all proxy caused.
const routes = {
  version: 1,
  include: ["/*"],
  exclude: [
    "/_next/static/*",
    "/favicon.ico",
    "/apple-touch-icon.png",
    "/icons/*",
    "/images/*",
    "/fonts/*",
    "/media/*",
    "/videos/*",
    "/robots.txt",
    "/manifest.json",
    "/site.webmanifest",
    "/*.ico",
    "/*.svg",
    "/*.png",
    "/*.jpg",
    "/*.jpeg",
    "/*.webp",
    "/*.avif",
    "/*.gif",
    "/*.woff",
    "/*.woff2",
    "/*.ttf",
    "/*.eot",
    "/*.css",
    "/*.js",
    "/*.map"
  ]
};

writeFileSync(join(outputDir, "_routes.json"), JSON.stringify(routes, null, 2) + "\n");

let fileCount = 0;
let totalBytes = 0;
function walk(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      walk(path);
    } else if (entry.isFile()) {
      fileCount += 1;
      totalBytes += statSync(path).size;
    }
  }
}
walk(outputDir);

const requiredStaticPath = join(outputDir, "_next", "static");
if (!existsSync(requiredStaticPath)) {
  throw new Error("Staging failed: the Pages output is missing /_next/static assets.");
}
console.log(
  `Staged ${fileCount} Pages files (${(totalBytes / (1024 * 1024)).toFixed(2)} MiB) and excluded ${routes.exclude.length} static path patterns from Pages Functions.`
);
console.log(`Pages output directory: ${relative(repoRoot, outputDir).split(sep).join("/")}`);

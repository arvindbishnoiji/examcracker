# Asset licenses

This project uses only lightweight, license-recorded assets. No copyrighted anime
characters, logos, screenshots or scraped artwork are bundled.

| Asset | Source | License | Notes |
| --- | --- | --- | --- |
| Icon set (`lucide-react@0.468.0`) | https://lucide.dev | ISC | Rendering only through `src/components/ui/AppIcon.tsx`; no attribution required, recorded here for provenance. |
| `public/og-cover.png` | Generated in-repo | Original work, project-owned | Built from geometric shapes and text with ImageMagick; no third-party imagery. |
| `public/icons/icon-192.png`, `public/icons/icon-512.png`, `public/apple-touch-icon.png` | Generated in-repo | Original work, project-owned | Brand mark "EC" drawn as vector shapes, rasterised in-repo. |
| `public/favicon.ico` | Existing project asset | Project-owned | Unchanged from the original repository. |
| DejaVu Sans / DejaVu Sans Bold | System font used at image-generation time | Bitstream Vera / DejaVu license (permissive) | Only raster pixels are shipped; the font files are **not** redistributed. |

## Rules for future assets

1. Prefer Lucide (already a dependency) over new icon packs.
2. Any new raster art must be original or carry a recorded permissive license in this file.
3. Do not download "anime" art from search engines or fan wikis.
4. Keep images optimised; the app sets `images.unoptimized` for Cloudflare compatibility, so file size matters.
5. Honour `prefers-reduced-motion` for every new animation (see `src/app/globals.css`).

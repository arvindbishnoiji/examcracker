# Cloudflare Pages: dashboard-managed environment variables

The Pages project `examcrack` uses the GitHub directory `cloudflare-pages/`. Its Wrangler file has intentionally been removed so that **Cloudflare Pages dashboard settings** can manage environment variables and bindings.

## Required dashboard check after this change is deployed

1. Open Cloudflare Dashboard → **Workers & Pages** → **examcrack** → **Settings**.
2. Confirm the Pages build settings still use the existing repository and output directory. The previous Wrangler config used `pages_build_output_dir = "./public"`; if the dashboard output directory is blank, set it to `public` (with `cloudflare-pages` as the project root directory, if that is how the project is configured).
3. Under **Bindings**, add a **Service** binding for both Production and Preview environments as needed:
   - Variable name: `EXAM_CRACKER_WEB`
   - Service: `exam-cracker-web`
4. Under **Variables and Secrets**, add the non-secret values the Pages Function actually needs. Add secret values as encrypted secrets, not plain-text variables.
5. Save the settings and trigger a new Pages deployment so the binding and variables are available to the deployment.

## Important distinction: Pages vs. the app's Next.js build

- This change only unlocks dashboard-managed configuration for the **Pages project**.
- Values prefixed with `NEXT_PUBLIC_` that are referenced by the Next.js frontend are inlined when GitHub Actions runs `npm run build` / `npm run build:cloudflare`. Adding those values only to the Pages runtime settings does **not** rewrite the already-built JavaScript bundle. Configure those at build time in the repository's GitHub Actions Variables/Secrets if they are needed by the frontend.
- Server-only Google Drive credentials belong on the `exam-cracker-web` Worker as encrypted Worker secrets (for example, `GOOGLE_SERVICE_ACCOUNT_JSON`). Do not store private keys or service-account JSON in Pages variables, `NEXT_PUBLIC_*`, or the repository.

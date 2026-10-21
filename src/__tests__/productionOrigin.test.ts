import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const readRepoFile = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('production Pages origin and deployment guardrails', () => {
  it('allows the production Pages origin in the site API CORS allowlist', () => {
    const source = readRepoFile('supabase/functions/ec-site-api/index.ts');
    const match = source.match(/const DEFAULT_ALLOWED_ORIGINS = \[([\s\S]*?)\];/);
    expect(match?.[1]).toContain('"https://examcrack.pages.dev"');
  });

  it('does not expose the upstream website Worker through workers.dev', () => {
    expect(readRepoFile('wrangler.toml')).toMatch(/^workers_dev = false$/m);
  });

  it('keeps deployments manual and verifies the canonical Pages URL', () => {
    const workflow = readRepoFile('.github/workflows/deploy.yml');
    expect(workflow).toContain('workflow_dispatch:');
    expect(workflow.includes('\n  push:')).toBe(false);
    expect(workflow).toContain('https://examcrack.pages.dev/login');
    expect(workflow).not.toContain('Deploy Cloudflare media proxy (ec-content-api)');
    expect(workflow).not.toContain('wrangler.dev/login');
  });

  it('uses Pages as the canonical origin by default', () => {
    expect(readRepoFile('src/lib/site-url.ts')).toContain("const FALLBACK_SITE_URL = 'https://examcrack.pages.dev';");
  });
});

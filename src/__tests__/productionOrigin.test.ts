import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const readRepoFile = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('production Pages origin and deployment guardrails', () => {
  it('allows the production Pages origin in the site API CORS allowlist', () => {
    const source = readRepoFile('workers/ec-api/src/index.js');
    const match = source.match(/const ALLOWED_ORIGINS = new Set\(\[([\s\S]*?)\]\);/);
    expect(match?.[1]).toContain('"https://examcrack.pages.dev"');
  });

  it('accepts HTTPS deployment and branch previews for the Exam Cracker Pages project', () => {
    const source = readRepoFile('workers/ec-api/src/index.js');
    expect(source).toContain('hostname.endsWith(".examcrack.pages.dev")');
    expect(source).toContain('parsed.protocol === "https:"');
    expect(source).toContain('return fail("Origin not allowed.", 403)');
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

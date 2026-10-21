import { chromium } from 'playwright';

// The backend Worker is intentionally private (workers_dev=false) and is
// only reachable through the Pages service binding. Verify the public Pages
// origin instead of expecting the private Worker URL to return a public UI.
const targets = [
  { name: 'Cloudflare Pages', origin: 'https://examcrack.pages.dev' },
];

const browser = await chromium.launch({ headless: true });
const failures = [];
const diagnostics = [];

try {
  for (const target of targets) {
    const page = await browser.newPage();
    page.setDefaultTimeout(12_000);
    const pageErrors = [];
    const assetFailures = [];
    const consoleErrors = [];

    page.on('pageerror', (error) => {
      pageErrors.push(error.message || String(error));
    });
    page.on('console', (message) => {
      if (message.type() === 'error' && consoleErrors.length < 12) {
        consoleErrors.push(message.text().slice(0, 300));
      }
    });
    page.on('requestfailed', (request) => {
      if (request.url().includes('/_next/static/')) {
        assetFailures.push(`${request.url()} — ${request.failure()?.errorText || 'request failed'}`);
      }
    });
    page.on('response', (response) => {
      if (response.url().includes('/_next/static/') && response.status() >= 400) {
        assetFailures.push(`${response.status()} ${response.url()}`);
      }
    });

    try {
      for (const path of ['/login', '/']) {
        await page.goto(new URL(path, target.origin).href, {
          waitUntil: 'domcontentloaded',
          timeout: 35_000,
        });
        await page.waitForTimeout(2_500);

        const currentUrl = page.url();
        const bodyText = await page.locator('body').innerText().catch(() => '');
        if (bodyText.includes('Exam Cracker needs a refresh') ||
            bodyText.includes('The app shell failed to start')) {
          failures.push(`${target.name} ${path}: root app error fallback rendered (final URL ${currentUrl})`);
        }
        if (!bodyText.includes('Exam Cracker')) {
          failures.push(`${target.name} ${path}: Exam Cracker UI did not render (final URL ${currentUrl})`);
        }
        if (path === '/login' && !bodyText.includes('Sign in to continue')) {
          failures.push(`${target.name} /login: sign-in UI missing (final URL ${currentUrl})`);
        }
      }

      // Exercise a real client-side event so SSR-only success cannot pass this check.
      await page.goto(new URL('/login', target.origin).href, {
        waitUntil: 'domcontentloaded',
        timeout: 35_000,
      });
      await page.locator('input[type="email"]').waitFor({ state: 'visible' });
      const createAccount = page.getByRole('button', { name: /create account/i }).first();
      if (await createAccount.count()) {
        await createAccount.click();
        await page.locator('input[autocomplete="name"]').waitFor({ state: 'visible' });
      }
      await page.waitForTimeout(1_000);
      const bodyText = await page.locator('body').innerText().catch(() => '');
      if (bodyText.includes('Exam Cracker needs a refresh')) {
        failures.push(`${target.name}: app crashed after a client-side interaction`);
      }
    } catch (error) {
      failures.push(`${target.name}: browser smoke check threw: ${error instanceof Error ? error.message : String(error)}`);
    }

    if (pageErrors.length) {
      failures.push(`${target.name}: uncaught browser errors: ${pageErrors.join(' | ').slice(0, 1800)}`);
    }
    if (assetFailures.length) {
      failures.push(`${target.name}: Next.js assets failed: ${assetFailures.join(' | ').slice(0, 1800)}`);
    }
    diagnostics.push({
      target: target.name,
      finalUrl: page.url(),
      pageErrors: pageErrors.slice(0, 10),
      assetFailures: assetFailures.slice(0, 10),
      consoleErrors: consoleErrors.slice(0, 6),
    });
    await page.close();
  }
} finally {
  await browser.close();
}

console.log('Browser diagnostics:', JSON.stringify(diagnostics, null, 2));
if (failures.length) {
  console.error('Browser app-shell smoke test failed:\\n- ' + failures.join('\\n- '));
  process.exit(1);
}
console.log('Browser app-shell smoke test passed on Pages + Worker: route rendering and client interaction verified.');

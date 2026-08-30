import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { execFileSync, spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const releaseApiUrl = 'https://api.github.com/repos/B-Divyesh/sf-agent-change-recovery/releases/latest';
const billingCatalogUrl = 'https://api.sociobot.in/api/v1/products';
const checkoutUrl = 'https://api.sociobot.in/api/v1/products/agent-change-recovery/checkout';
const corsHeaders = { 'access-control-allow-origin': '*' };
const appVersion = (JSON.parse(readFileSync('package.json', 'utf8')) as { version: string }).version;
const releaseTag = `v${appVersion}`;
const releasePage = 'https://github.com/B-Divyesh/sf-agent-change-recovery/releases';
const completeReleaseAssets = [
  { name: `Change.Recovery.Ledger_${appVersion}_amd64.AppImage`, browser_download_url: 'https://example.test/linux.AppImage' },
  { name: `Change.Recovery.Ledger_${appVersion}_amd64.deb`, browser_download_url: 'https://example.test/linux.deb' },
  { name: `Change.Recovery.Ledger-${appVersion}-1.x86_64.rpm`, browser_download_url: 'https://example.test/linux.rpm' },
  { name: `Change.Recovery.Ledger_${appVersion}_aarch64.dmg`, browser_download_url: 'https://example.test/macos-arm64.dmg' },
  { name: `Change.Recovery.Ledger_${appVersion}_x64.dmg`, browser_download_url: 'https://example.test/macos-x64.dmg' },
  { name: `Change.Recovery.Ledger_${appVersion}_x64_en-US.msi`, browser_download_url: 'https://example.test/windows.msi' },
  { name: 'SHA256SUMS', browser_download_url: 'https://example.test/SHA256SUMS' },
  { name: 'latest.json', browser_download_url: 'https://example.test/latest.json' }
];

test.beforeEach(async ({ context }) => {
  await context.addInitScript(() => {
    // Playwright runs init scripts on every navigation. Keep reloads realistic:
    // each test context starts clean, while state set by the app survives a reload.
    if (!sessionStorage.getItem('acr-test-storage-cleared')) {
      localStorage.clear();
      sessionStorage.setItem('acr-test-storage-cleared', 'true');
    }
  });
  // Landing pages resolve current downloads at runtime. Keep non-release tests
  // hermetic so GitHub rate limiting cannot produce a browser resource error.
  await context.route(releaseApiUrl, route => route.fulfill({ json: {
    tag_name: releaseTag,
    assets: completeReleaseAssets
  } }));
  await context.route(billingCatalogUrl, route => route.fulfill({ json: { data: [] }, headers: corsHeaders }));
});

test('@claim:selective-reversal reverses one selected file and keeps the others', async ({ page }) => {
  await page.goto('/demo');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Inspect the failed session change');
  await page.getByLabel('src/editor/autosave.ts').check();
  await page.getByRole('button', { name: 'Reverse 2 selected files' }).click();
  await expect(page.getByRole('dialog')).toContainText('Other files in this agent turn stay unchanged.');
  await page.getByRole('button', { name: 'Create checkpoint and reverse' }).click();
  await expect(page.getByRole('status').last()).toContainText('2 files were reversed');
  await page.getByRole('button', { name: /Refactor session refresh/ }).click();
  await expect(page.getByText('src/auth/session.ts — restored')).toBeVisible();
  await expect(page.getByText('src/editor/autosave.ts — restored')).toBeVisible();
  await expect(page.getByText('src/account/profile.ts', { exact: true })).toBeVisible();
});

test('query demo entry opens the isolated sample in one request', async ({ page }) => {
  await page.goto('/?demo=1');
  await expect(page).toHaveURL(/\?demo=1$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Inspect the failed session change');
  await expect(page.getByText('Demo — sample data, nothing is saved')).toBeVisible();
});

test('exports selected demo changes as a patch', async ({ page }) => {
  await page.goto('/demo');
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export selected patch' }).click();
  const download = await downloadEvent;
  const stream = await download.createReadStream();
  let content = '';
  for await (const chunk of stream) content += chunk.toString();
  expect(download.suggestedFilename()).toBe('recovery-cp-3.patch');
  expect(content).toContain('diff --git a/src/auth/session.ts b/src/auth/session.ts');
  expect(content).toContain('@@ -1,2 +1,3 @@');
  expect(content).not.toContain('src/account/profile.ts');
  const fixture = mkdtempSync(join(tmpdir(), 'acr-patch-'));
  mkdirSync(join(fixture, 'src/auth'), { recursive: true });
  writeFileSync(join(fixture, 'src/auth/session.ts'), ' const token = await renewOnce()\n refreshQueue.current = null\n');
  expect(() => execFileSync('patch', ['--batch', '--dry-run', '-p1', '-d', fixture], { input: content })).not.toThrow();
  await expect(page.getByRole('status').last()).toContainText('Nothing was run');
});

test('@claim:demo-isolation resets only demo namespaced data', async ({ page }) => {
  await page.goto('/demo');
  await page.evaluate(() => localStorage.setItem('real:sentinel', 'keep'));
  await page.getByLabel('src/editor/autosave.ts').check();
  await page.getByRole('button', { name: 'Reverse 2 selected files' }).click();
  await page.getByRole('button', { name: 'Create checkpoint and reverse' }).click();
  const keys = await page.evaluate(() => Object.keys(localStorage));
  expect(keys.some(key => key.startsWith('demo:'))).toBe(true);
  await page.getByRole('button', { name: 'Reset demo' }).click();
  expect(await page.evaluate(() => localStorage.getItem('real:sentinel'))).toBe('keep');
  expect(await page.evaluate(() => Object.keys(localStorage).filter(key => key.startsWith('demo:')))).toEqual([]);
  await page.getByLabel('src/editor/autosave.ts').check();
  await page.getByRole('button', { name: 'Reverse 2 selected files' }).click();
  await page.getByRole('button', { name: 'Create checkpoint and reverse' }).click();
  await page.getByRole('button', { name: 'Start for real' }).click();
  await expect(page).toHaveURL(/\/app$/);
  expect(await page.evaluate(() => Object.keys(localStorage).filter(key => key.startsWith('demo:')))).toEqual([]);
  expect(await page.evaluate(() => localStorage.getItem('real:sentinel'))).toBe('keep');
  await expect(page.locator('#app-download-button')).toBeVisible();
});

test('demo recovery makes no cross-origin requests', async ({ page }) => {
  const origins = new Set<string>();
  page.on('request', request => origins.add(new URL(request.url()).origin));
  await page.goto('/demo');
  await page.getByRole('button', { name: 'Export selected patch' }).click();
  await page.getByRole('button', { name: 'Reverse 1 selected file' }).click();
  await page.getByRole('button', { name: 'Create checkpoint and reverse' }).click();
  expect([...origins]).toEqual(['http://127.0.0.1:4173']);
});

test('@claim:offline-reload reloads the sample ledger offline', async ({ page, context }) => {
  await page.goto('/demo');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Inspect the failed session change');
  await expect(page.getByText('You are offline. Saved ledgers and the demo still work.')).toBeVisible();
});

test('@claim:pro-license restores an issued Sociobot license without exposing an unpublished checkout', async ({ page }) => {
  const requests: string[] = [];
  await page.route('https://api.sociobot.in/api/v1/products/agent-change-recovery/verify?license=sbk-test-license', route => {
    requests.push(route.request().url());
    return route.fulfill({ json: { valid: true, reason: 'ok', expires_at: null } });
  });
  await page.goto('/?license=sbk-test-license');
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText('Pro license active on this device.')).toBeVisible();
  await expect(page.getByText('Pro checkout is being enabled')).toBeVisible();
  await expect(page.getByRole('link', { name: /subscribe to pro/i })).toHaveCount(0);
  expect(requests).toEqual(['https://api.sociobot.in/api/v1/products/agent-change-recovery/verify?license=sbk-test-license']);
  expect(await page.evaluate(() => localStorage.getItem('sb_license:agent-change-recovery'))).toBe('sbk-test-license');
  await page.evaluate(() => localStorage.clear());
  await page.goto('/');
  await page.getByLabel('Have a license? Paste it').fill('sbk-test-license');
  await page.getByRole('button', { name: 'Restore license' }).click();
  await expect(page.getByText('Pro license active on this device.')).toBeVisible();
  expect(requests).toHaveLength(2);
});

test('@claim:pro-price checkout availability shows the published $15 monthly price without opening payment', async ({ page, context }) => {
  let listed = false;
  let checkoutRequests = 0;
  await context.route(billingCatalogUrl, route => route.fulfill({ json: {
    data: listed ? [{
      slug: 'agent-change-recovery',
      checkout_url: checkoutUrl,
      price_minor: 1500,
      currency: 'USD'
    }] : []
  }, headers: corsHeaders }));
  await context.route(checkoutUrl, route => { checkoutRequests += 1; return route.abort(); });
  await page.goto('/');
  await expect(page.getByText('Pro checkout is being enabled')).toBeVisible();
  await expect(page.getByRole('link', { name: /subscribe to pro/i })).toHaveCount(0);
  await expect(page.locator('#pro-price')).toBeHidden();
  listed = true;
  await page.reload();
  await expect(page.getByRole('link', { name: /subscribe to pro/i })).toHaveAttribute('href', checkoutUrl);
  await expect(page.locator('#pro-price')).toContainText('$15');
  expect(checkoutRequests).toBe(0);
});

test('packaged Tauri billing uses native commands when browser CORS is unavailable', async ({ page, context }) => {
  await context.addInitScript(({ checkout }) => {
    const calls: { command: string; args: unknown }[] = [];
    (window as typeof window & { isTauri: boolean; __nativeBillingCalls: typeof calls }).isTauri = true;
    (window as typeof window & { __nativeBillingCalls: typeof calls }).__nativeBillingCalls = calls;
    (window as typeof window & { __TAURI_INTERNALS__: { invoke: (command: string, args: unknown) => Promise<unknown> } }).__TAURI_INTERNALS__ = {
      invoke: async (command, args) => {
        calls.push({ command, args });
        if (command === 'get_product_listing') return {
          slug: 'agent-change-recovery',
          checkout_url: checkout,
          price_minor: 1500,
          currency: 'USD'
        };
        if (command === 'verify_license') return { valid: true, reason: 'ok', expires_at: null };
        throw new Error(`Unexpected native command: ${command}`);
      }
    };
  }, { checkout: checkoutUrl });
  const browserBillingRequests: string[] = [];
  page.on('request', request => {
    if (request.url().startsWith('https://api.sociobot.in/api/v1/')) browserBillingRequests.push(request.url());
  });

  await page.goto('/?license=sbk-native-recorded');
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText('Pro license active on this device.')).toBeVisible();
  await expect(page.getByRole('link', { name: /subscribe to pro/i })).toHaveAttribute('href', checkoutUrl);
  await expect(page.locator('#pro-price')).toContainText('$15');
  expect(browserBillingRequests).toEqual([]);
  const calls = await page.evaluate(() => (window as typeof window & { __nativeBillingCalls: { command: string; args: unknown }[] }).__nativeBillingCalls);
  expect(calls.some(call => call.command === 'get_product_listing')).toBe(true);
  expect(calls.filter(call => call.command === 'verify_license')).toEqual([{
    command: 'verify_license',
    args: { license: 'sbk-native-recorded' }
  }]);
});

test('@claim:retention-tiers exposes 2 and 7 free checkpoints and 30 and 90 Pro checkpoints', async ({ page }) => {
  await page.goto('/app');
  const freeOptions = await page.locator('#retention option').evaluateAll(options => options.map(option => ({
    value: (option as HTMLOptionElement).value,
    label: option.textContent,
    disabled: (option as HTMLOptionElement).disabled
  })));
  expect(freeOptions).toEqual([
    { value: '2', label: 'Keep 2 checkpoints', disabled: false },
    { value: '7', label: 'Keep 7 checkpoints', disabled: false },
    { value: '30', label: 'Keep 30 checkpoints (Pro)', disabled: true },
    { value: '90', label: 'Keep 90 checkpoints (Pro)', disabled: true }
  ]);

  await page.evaluate(() => {
    localStorage.setItem('sb_license:agent-change-recovery', 'sbk-cached-pro');
    localStorage.setItem('sb_license:agent-change-recovery:verification', JSON.stringify({
      checkedAt: Date.now(),
      verdict: { valid: true, reason: 'ok', expires_at: null }
    }));
  });
  await page.reload();
  const proOptions = await page.locator('#retention option').evaluateAll(options => options.map(option => ({
    value: (option as HTMLOptionElement).value,
    disabled: (option as HTMLOptionElement).disabled
  })));
  expect(proOptions).toEqual([
    { value: '2', disabled: false },
    { value: '7', disabled: false },
    { value: '30', disabled: false },
    { value: '90', disabled: false }
  ]);
});

test('@claim:license-daily-verification checks a saved license once per day', async ({ page }) => {
  let requests = 0;
  await page.route('https://api.sociobot.in/api/v1/products/agent-change-recovery/verify?license=sbk-daily-license', route => {
    requests += 1;
    return route.fulfill({ json: { valid: true, reason: 'ok', expires_at: null } });
  });
  await page.goto('/?license=sbk-daily-license');
  await expect(page.getByText('Pro license active on this device.')).toBeVisible();
  await page.reload();
  await expect(page.getByText('Pro license active on this device.')).toBeVisible();
  await page.waitForTimeout(250);
  expect(requests).toBe(1);
});

test('service worker installs the shipped shell, updates its cache, and keeps the demo offline', async ({ page, context }) => {
  await page.goto('/demo');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  const installed = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.getRegistration();
    await registration?.update();
    const keys = await caches.keys();
    const cache = await caches.open('recovery-ledger-v9');
    return {
      active: registration?.active?.state,
      script: registration?.active?.scriptURL,
      keys,
      cachedDemo: Boolean(await cache.match('/demo')),
      cachedShell: Boolean(await cache.match('/')),
    };
  });
  expect(installed.active).toBe('activated');
  expect(installed.script).toContain('/sw.js');
  expect(installed.keys).toContain('recovery-ledger-v9');
  expect(installed.cachedDemo).toBe(true);
  expect(installed.cachedShell).toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Inspect the failed session change');
});

test('@claim:platform-download selects exact assets for Linux, macOS, and Windows', async ({ browser }) => {
  for (const [userAgent, expected] of [
    ['Mozilla/5.0 (X11; Linux x86_64)', 'https://example.test/linux.AppImage'],
    ['Mozilla/5.0 (Macintosh; Intel Mac OS X)', 'https://example.test/macos-x64.dmg'],
    ['Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'https://example.test/windows.msi']
  ]) {
    const context = await browser.newContext({ userAgent });
    const page = await context.newPage();
    await page.route(releaseApiUrl, route => route.fulfill({ json: { tag_name: releaseTag, assets: completeReleaseAssets } }));
    await page.route(billingCatalogUrl, route => route.fulfill({ json: { data: [] }, headers: corsHeaders }));
    await page.goto('/');
    await expect(page.locator('#download-button')).toHaveAttribute('href', expected);
    if (userAgent.includes('Macintosh')) {
      await expect(page.locator('[data-macos-downloads]')).toBeVisible();
      await expect(page.locator('[data-macos-arm]')).toHaveAttribute('href', 'https://example.test/macos-arm64.dmg');
      await expect(page.locator('[data-macos-intel]')).toHaveAttribute('href', 'https://example.test/macos-x64.dmg');
    }
    await context.close();
  }
  const staleContext = await browser.newContext({ userAgent: 'Mozilla/5.0 (X11; Linux x86_64)' });
  const stalePage = await staleContext.newPage();
  await stalePage.route(releaseApiUrl, route => route.fulfill({ json: { tag_name: 'v0.0.0-stale', assets: completeReleaseAssets } }));
  await stalePage.route(billingCatalogUrl, route => route.fulfill({ json: { data: [] }, headers: corsHeaders }));
  await stalePage.goto('/');
  await expect(stalePage.locator('#download-button')).toHaveAttribute('href', releasePage);
  await expect(stalePage.locator('#download-button')).toHaveText('View release page');
  await expect(stalePage.locator('#download-status')).toContainText('is being published');
  await staleContext.close();
});

test('Apple silicon Mac visitors receive the ARM build and can still choose Intel', async ({ browser }) => {
  const context = await browser.newContext({ userAgent: 'Mozilla/5.0 (Macintosh; ARM64 Mac OS X)' });
  const page = await context.newPage();
  await page.route(releaseApiUrl, route => route.fulfill({ json: { tag_name: releaseTag, assets: completeReleaseAssets } }));
  await page.route(billingCatalogUrl, route => route.fulfill({ json: { data: [] }, headers: corsHeaders }));
  await page.goto('/');
  await expect(page.locator('#download-button')).toHaveAttribute('href', 'https://example.test/macos-arm64.dmg');
  await expect(page.locator('[data-macos-intel]')).toHaveAttribute('href', 'https://example.test/macos-x64.dmg');
  await context.close();
});

test('@claim:release-request-privacy requests only the disclosed GitHub and Sociobot APIs before purchase', async ({ page }) => {
  const origins = new Set<string>();
  page.on('request', request => origins.add(new URL(request.url()).origin));
  await page.route(releaseApiUrl, route => route.fulfill({ json: { tag_name: releaseTag, assets: completeReleaseAssets } }));
  await page.route(billingCatalogUrl, route => route.fulfill({ json: { data: [{
    slug: 'agent-change-recovery', checkout_url: checkoutUrl, price_minor: 1500, currency: 'USD'
  }] }, headers: corsHeaders }));
  await page.goto('/');
  await expect(page.locator('#download-status')).not.toHaveText('Checking published releases…');
  expect([...origins].sort()).toEqual(['http://127.0.0.1:4173', 'https://api.github.com', 'https://api.sociobot.in']);
  await expect(page.getByRole('link', { name: /subscribe to pro/i })).toHaveAttribute('href', checkoutUrl);
});

for (const path of ['/', '/demo', '/app', '/privacy', '/terms', '/missing-sheet']) {
  test(`accessible page ${path}`, async ({ page }) => {
    await page.goto(path);
    await expect(page.locator('main')).toHaveCount(1);
    await expect(page.locator('h1')).toHaveCount(1);
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations.filter(item => ['serious', 'critical'].includes(item.impact ?? ''))).toEqual([]);
  });
}

test('mobile demo keeps the recovery controls reachable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/demo');
  await expect(page.getByRole('button', { name: 'Reverse 1 selected file' })).toBeVisible();
  await page.getByRole('button', { name: 'Reverse 1 selected file' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test('mobile landing has no horizontal overflow at 390px', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect.poll(() => page.locator('.hero-art').evaluate(node => getComputedStyle(node).marginInlineStart)).toBe('0px');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test('mobile first screen shows the action result and all three facts', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.locator('.action-note')).toBeInViewport();
  for (const text of ['Project files are encrypted locally.', 'The demo works offline after one visit.', 'Pro checkout is not available yet.']) await expect(page.getByText(text, { exact: true })).toBeInViewport();
});

test('mobile links and controls meet the 44px touch-target baseline', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Menu' }).click();
  const skip = page.locator('.skip-link');
  await skip.focus();
  const targets = await page.locator('.skip-link, .brand, .site-nav a, .footer-links a, .preview-detail .button.small').evaluateAll(nodes =>
    nodes.map(node => {
      const box = node.getBoundingClientRect();
      return { text: node.textContent?.trim(), width: box.width, height: box.height };
    })
  );
  expect(targets).not.toEqual([]);
  for (const target of targets) {
    expect(target.width, `${target.text} must be at least 44px wide`).toBeGreaterThanOrEqual(44);
    expect(target.height, `${target.text} must be at least 44px high`).toBeGreaterThanOrEqual(44);
  }
});

test('mobile selected-file diff summary meets the 44px touch-target baseline', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/demo');
  const summary = page.locator('details.intent > summary');
  const box = await summary.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.width).toBeGreaterThanOrEqual(44);
  expect(box!.height).toBeGreaterThanOrEqual(44);
  await summary.click();
  await expect(page.locator('details.intent .diff')).toBeVisible();
});

test('reverse dialog traps focus and restores it to its trigger', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/demo');
  const trigger = page.getByRole('button', { name: 'Reverse 1 selected file' });
  await trigger.focus();
  await trigger.press('Enter');
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Keep files' })).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(page.getByRole('button', { name: 'Create checkpoint and reverse' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test('built security policy keeps frame ancestry in the response header only without console resource failures', async ({ page }) => {
  const errors: string[] = [];
  const releaseRequests: string[] = [];
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.route(releaseApiUrl, route => {
    releaseRequests.push(route.request().url());
    return route.fulfill({ json: {
      tag_name: releaseTag,
      assets: completeReleaseAssets
    } });
  });
  await page.goto('/', { waitUntil: 'networkidle' });
  expect(readFileSync('index.html', 'utf8')).not.toMatch(/frame-ancestors/);
  const config = JSON.parse(readFileSync('public/staticwebapp.config.json', 'utf8')) as { globalHeaders: Record<string, string> };
  expect(config.globalHeaders['Content-Security-Policy']).toContain("frame-ancestors 'none'");
  expect(releaseRequests).toEqual([releaseApiUrl]);
  await expect(page.locator('#download-status')).toContainText(releaseTag);
  expect(errors).toEqual([]);
});

test('static deployment serves public files before the styled real 404 fallback', async ({ page }) => {
  const config = JSON.parse(readFileSync('public/staticwebapp.config.json', 'utf8')) as {
    routes: { route: string; statusCode?: number; rewrite?: string; headers?: Record<string, string> }[];
    responseOverrides: Record<string, { rewrite?: string }>;
  };
  expect(config.routes.some(route => route.route === '/' && route.rewrite === '/index.html')).toBe(true);
  expect(config.routes.some(route => route.route === '/*')).toBe(false);
  expect(config.routes.find(route => route.route === '/assets/*')?.headers?.['Cache-Control']).toContain('immutable');
  expect(config.responseOverrides['404']).toEqual({ rewrite: '/404.html' });
  for (const file of ['/favicon.svg', '/apple-touch-icon.png', '/robots.txt', '/sitemap.xml', '/404.css', '/404.js']) {
    expect(existsSync(`dist/site${file}`), `${file} must be published`).toBe(true);
    const response = await page.goto(file);
    expect(response?.status(), `${file} must be served`).toBe(200);
  }
});

test('every route has its own title and history navigation works', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Privacy' }).first().click();
  await expect(page).toHaveTitle('Privacy — Change Recovery Ledger');
  await page.goBack();
  await expect(page).toHaveTitle('Change Recovery Ledger — Reverse agent changes');
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
  await expect(page.locator('h1')).toBeInViewport();
});

test('route metadata updates title, canonical, Open Graph, and Twitter fields', async ({ page }) => {
  await page.goto('/privacy');
  await expect(page).toHaveTitle('Privacy — Change Recovery Ledger');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://agent-change-recovery.sociobot.in/privacy');
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content', 'Privacy — Change Recovery Ledger');
  await expect(page.locator('meta[name="twitter:title"]')).toHaveAttribute('content', 'Privacy — Change Recovery Ledger');
  const notFound = readFileSync('public/404.html', 'utf8');
  for (const fragment of ['<header', '<footer', 'name="description"', 'rel="canonical"', 'property="og:title"', 'apple-touch-icon']) expect(notFound).toContain(fragment);
});

test('@claim:windows-installer verifies a checksum before starting the installer', () => {
  const source = readFileSync('public/install.ps1', 'utf8');
  expect(source).toContain('Get-FileHash');
  expect(source).toContain('Start-Process');
  expect(source.indexOf('Get-FileHash')).toBeLessThan(source.indexOf('Start-Process'));
});

test('@claim:unsigned-macos keeps macOS packaging unsigned until credentials are configured', () => {
  const source = readFileSync('.github/workflows/release.yml', 'utf8');
  expect(source).toContain('macos-latest');
  expect(source).not.toMatch(/APPLE_CERTIFICATE|APPLE_SIGNING_IDENTITY|notar/i);
});

test('@claim:release-platforms declares macOS, Windows, Linux, checksums, and manifest publishing', () => {
  const source = readFileSync('.github/workflows/release.yml', 'utf8');
  expect(source).toContain('macos-latest');
  expect(source).toContain('windows-latest');
  expect(source).toContain('ubuntu-22.04');
  expect(source).toContain('SHA256SUMS');
  expect(source).toContain('latest.json');
  expect(source).toContain('Verify published release identity');
  expect(source).toContain('scripts/verify-release.py');
});

test('@claim:release-candidate-identity rejects a stale release and validates a complete tagged release', () => {
  const sandbox = mkdtempSync(join(tmpdir(), 'acr-release-identity-'));
  const assetDirectory = join(sandbox, 'assets');
  const releasePath = join(sandbox, 'release.json');
  const commit = '0123456789abcdef0123456789abcdef01234567';
  const desktopAssets = [
    `Change.Recovery.Ledger_${appVersion}_aarch64.dmg`,
    `Change.Recovery.Ledger_${appVersion}_x64.dmg`,
    `Change.Recovery.Ledger_${appVersion}_amd64.AppImage`,
    `Change.Recovery.Ledger_${appVersion}_amd64.deb`,
    `Change.Recovery.Ledger-${appVersion}-1.x86_64.rpm`,
    `Change.Recovery.Ledger_${appVersion}_x64_en-US.msi`
  ];
  mkdirSync(assetDirectory);
  try {
    for (const [index, name] of desktopAssets.entries()) writeFileSync(join(assetDirectory, name), `asset ${index}\n`);
    const sums = desktopAssets.map(name => `${execFileSync('sha256sum', [join(assetDirectory, name)], { encoding: 'utf8' }).split(/\s+/)[0]}  ${name}`).join('\n');
    writeFileSync(join(assetDirectory, 'SHA256SUMS'), `${sums}\n`);
    writeFileSync(join(assetDirectory, 'latest.json'), JSON.stringify({
      version: appVersion,
      tag: releaseTag,
      assets: desktopAssets.map(name => ({ name, url: `https://github.com/example/repo/releases/download/${releaseTag}/${name}` }))
    }));
    writeFileSync(releasePath, JSON.stringify({
      tagName: releaseTag,
      targetCommitish: commit,
      assets: [...desktopAssets, 'SHA256SUMS', 'latest.json'].map(name => ({ name }))
    }));
    const valid = spawnSync('python3', ['scripts/verify-release.py', releaseTag, commit, releasePath, assetDirectory], { encoding: 'utf8' });
    expect(valid.status, valid.stderr).toBe(0);
    expect(valid.stdout).toContain(`release verified: ${releaseTag}`);

    writeFileSync(releasePath, JSON.stringify({ tagName: 'v0.0.0-stale', targetCommitish: commit, assets: [...desktopAssets, 'SHA256SUMS', 'latest.json'].map(name => ({ name })) }));
    const stale = spawnSync('python3', ['scripts/verify-release.py', releaseTag, commit, releasePath, assetDirectory], { encoding: 'utf8' });
    expect(stale.status).not.toBe(0);
    expect(stale.stderr).toContain('does not match');
  } finally {
    rmSync(sandbox, { recursive: true, force: true });
  }
});

test('Linux AppImage packaging installs its required tool and verifies the generated asset', () => {
  const workflow = readFileSync('.github/workflows/release.yml', 'utf8');
  const helper = readFileSync('scripts/prepare-linuxdeploy-plugin.mjs', 'utf8');
  const smoke = readFileSync('scripts/smoke-appimage.sh', 'utf8');
  expect(workflow).toContain('file libwebkit2gtk-4.1-dev');
  expect(workflow).toContain('Prepare the pinned Linuxdeploy GTK helper');
  expect(workflow).toContain('Verify Linux installers');
  expect(workflow).toContain('runs-on: ubuntu-24.04');
  expect(workflow).toContain('libegl1 libgles2 libfuse2 xvfb');
  expect(workflow).toContain('scripts/smoke-appimage.sh');
  expect(workflow).not.toContain('GITHUB_REF_NAME');
  expect(workflow).toContain('bundle/appimage/*.AppImage');
  expect(helper).toContain('cb379f9b0733e9ad9f8bd78f8c2fa038aef2478523bb7d4c8e64ff6a1ea3501a');
  expect(helper).toContain('ln $verbose -s -f');
  expect(helper).toContain('GSETTINGS_BACKEND=memory');
  expect(helper).toContain('giomoduledir');
  expect(helper).toContain('bundled GIO library still references host modules');
  expect(smoke).toContain("undefined symbol|Failed to load module|error while loading shared libraries");
});

test('@claim:linux-installer verifies, installs, and makes the AppImage executable', async () => {
  test.skip(process.platform !== 'linux', 'the shipped Linux installer is exercised on Linux');
  const sandbox = mkdtempSync(join(tmpdir(), 'acr-install-'));
  const mockBin = join(sandbox, 'bin');
  const installedBin = join(sandbox, 'installed-bin');
  const asset = join(sandbox, 'Change.Recovery.Ledger_0.1.2_amd64.AppImage');
  const file = 'Change.Recovery.Ledger_0.1.2_amd64.AppImage';
  mkdirSync(mockBin);
  writeFileSync(asset, '#!/bin/sh\nprintf "ledger mock\\n"\n');
  const checksum = execFileSync('sha256sum', [asset], { encoding: 'utf8' }).split(/\s+/)[0];
  const curl = join(mockBin, 'curl');
  writeFileSync(curl, `#!/bin/sh
set -eu
output=""
next=""
last=""
for argument in "$@"; do
  if [ "$next" = "yes" ]; then output="$argument"; next=""; continue; fi
  if [ "$argument" = "-o" ]; then next="yes"; continue; fi
  last="$argument"
done
case "$last" in
  *releases/latest) printf '%s' '{"assets":[{"name":"${file}","browser_download_url":"https://example.test/${file}"},{"name":"SHA256SUMS","browser_download_url":"https://example.test/SHA256SUMS"}]}' ;;
  *SHA256SUMS) printf '%s  %s\\n' '${checksum}' '${file}' ;;
  *${file}) cp "$MOCK_ASSET" "$output" ;;
  *) exit 1 ;;
esac
`);
  chmodSync(curl, 0o755);
  try {
    const output = execFileSync('/bin/sh', ['public/install.sh'], {
      cwd: process.cwd(),
      encoding: 'utf8',
      env: { ...process.env, PATH: `${mockBin}:${process.env.PATH}`, XDG_BIN_HOME: installedBin, MOCK_ASSET: asset }
    });
    const target = join(installedBin, 'change-recovery-ledger');
    expect(output).toContain(`Installed and verified Change Recovery Ledger at ${target}`);
    expect(existsSync(target)).toBe(true);
    expect(statSync(target).mode & 0o111).not.toBe(0);
    expect(execFileSync(target, { encoding: 'utf8' })).toBe('ledger mock\n');
  } finally {
    rmSync(sandbox, { recursive: true, force: true });
  }
});

test('macOS installer selects the Intel disk image instead of the first ARM asset', () => {
  const sandbox = mkdtempSync(join(tmpdir(), 'acr-macos-install-'));
  const mockBin = join(sandbox, 'bin');
  const asset = join(sandbox, 'Change.Recovery.Ledger_0.1.2_x64.dmg');
  const file = 'Change.Recovery.Ledger_0.1.2_x64.dmg';
  mkdirSync(mockBin);
  writeFileSync(asset, 'verified Intel Mac disk image');
  const checksum = execFileSync('sha256sum', [asset], { encoding: 'utf8' }).split(/\s+/)[0];
  const uname = join(mockBin, 'uname');
  writeFileSync(uname, `#!/bin/sh
case "$1" in
  -s) printf '%s\\n' Darwin ;;
  -m) printf '%s\\n' x86_64 ;;
esac
`);
  const curl = join(mockBin, 'curl');
  writeFileSync(curl, `#!/bin/sh
set -eu
output=""
next=""
last=""
for argument in "$@"; do
  if [ "$next" = "yes" ]; then output="$argument"; next=""; continue; fi
  if [ "$argument" = "-o" ]; then next="yes"; continue; fi
  last="$argument"
done
case "$last" in
  *releases/latest) printf '%s' '{"assets":[{"name":"Change.Recovery.Ledger_0.1.2_aarch64.dmg","browser_download_url":"https://example.test/arm.dmg"},{"name":"${file}","browser_download_url":"https://example.test/${file}"},{"name":"SHA256SUMS","browser_download_url":"https://example.test/SHA256SUMS"}]}' ;;
  *SHA256SUMS) printf '%s  %s\\n' '${checksum}' '${file}' ;;
  *${file}) cp "$MOCK_ASSET" "$output" ;;
  *) exit 1 ;;
esac
`);
  chmodSync(uname, 0o755);
  chmodSync(curl, 0o755);
  try {
    const output = execFileSync('/bin/sh', ['public/install.sh'], {
      cwd: process.cwd(),
      encoding: 'utf8',
      env: { ...process.env, PATH: `${mockBin}:${process.env.PATH}`, TMPDIR: sandbox, MOCK_ASSET: asset }
    });
    expect(output).toContain(`Downloaded and verified ${file}`);
    expect(output).not.toContain('aarch64');
  } finally {
    rmSync(sandbox, { recursive: true, force: true });
  }
});

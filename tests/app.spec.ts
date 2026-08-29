import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { execFileSync } from 'node:child_process';
import { chmodSync, existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const releaseApiUrl = 'https://api.github.com/repos/B-Divyesh/sf-agent-change-recovery/releases/latest';

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
    tag_name: 'v0.1.5-test',
    assets: [{
      name: 'Change.Recovery.Ledger_0.1.5-test_amd64.AppImage',
      browser_download_url: 'https://example.test/Change.Recovery.Ledger_0.1.5-test_amd64.AppImage'
    }]
  } }));
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

test('@claim:patch-export exports selected changes as a patch', async ({ page }) => {
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

test('@claim:pro-license restores a Sociobot license and shows the documented subscription', async ({ page }) => {
  const requests: string[] = [];
  await page.route('https://api.sociobot.in/api/v1/products/agent-change-recovery/verify?license=sbk-test-license', route => {
    requests.push(route.request().url());
    return route.fulfill({ json: { valid: true, reason: 'ok', expires_at: null } });
  });
  await page.goto('/?license=sbk-test-license');
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText('Pro license active on this device.')).toBeVisible();
  await expect(page.getByRole('link', { name: /subscribe to pro/i })).toHaveAttribute('href', 'https://api.sociobot.in/api/v1/products/agent-change-recovery/checkout');
  await expect(page.locator('.price')).toContainText('$15');
  expect(requests).toEqual(['https://api.sociobot.in/api/v1/products/agent-change-recovery/verify?license=sbk-test-license']);
  expect(await page.evaluate(() => localStorage.getItem('sb_license:agent-change-recovery'))).toBe('sbk-test-license');
  await page.evaluate(() => localStorage.clear());
  await page.goto('/');
  await page.getByLabel('Have a license? Paste it').fill('sbk-test-license');
  await page.getByRole('button', { name: 'Restore license' }).click();
  await expect(page.getByText('Pro license active on this device.')).toBeVisible();
  expect(requests).toHaveLength(2);
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
    const cache = await caches.open('recovery-ledger-v5');
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
  expect(installed.keys).toContain('recovery-ledger-v5');
  expect(installed.cachedDemo).toBe(true);
  expect(installed.cachedShell).toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Inspect the failed session change');
});

test('@claim:platform-download selects exact assets for Linux, macOS, and Windows', async ({ browser }) => {
  const assets = [
    { name: 'Change.Recovery.Ledger_0.1.2_amd64.AppImage', browser_download_url: 'https://example.test/linux.AppImage' },
    { name: 'Change.Recovery.Ledger_0.1.2_x64.dmg', browser_download_url: 'https://example.test/macos.dmg' },
    { name: 'Change.Recovery.Ledger_0.1.2_x64-setup.exe', browser_download_url: 'https://example.test/windows.exe' }
  ];
  for (const [userAgent, expected] of [
    ['Mozilla/5.0 (X11; Linux x86_64)', 'https://example.test/linux.AppImage'],
    ['Mozilla/5.0 (Macintosh; Intel Mac OS X)', 'https://example.test/macos.dmg'],
    ['Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'https://example.test/windows.exe']
  ]) {
    const context = await browser.newContext({ userAgent });
    const page = await context.newPage();
    await page.route(releaseApiUrl, route => route.fulfill({ json: { tag_name: 'v0.1.2', assets } }));
    await page.goto('/');
    await expect(page.locator('#download-button')).toHaveAttribute('href', expected);
    await context.close();
  }
});

test('@claim:release-request-privacy requests only the disclosed GitHub release API', async ({ page }) => {
  const origins = new Set<string>();
  page.on('request', request => origins.add(new URL(request.url()).origin));
  await page.route(releaseApiUrl, route => route.fulfill({ json: { tag_name: 'v0.1.2', assets: [] } }));
  await page.goto('/');
  await expect(page.locator('#download-status')).not.toHaveText('Checking published releases…');
  expect([...origins].sort()).toEqual(['http://127.0.0.1:4173', 'https://api.github.com']);
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
  for (const text of ['Project files are encrypted locally.', 'The demo works offline after one visit.', 'Pro costs $15 per developer each month.']) await expect(page.getByText(text, { exact: true })).toBeInViewport();
});

test('mobile links and controls meet the 44px touch-target baseline', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Menu' }).click();
  const targets = await page.locator('.brand, .site-nav a, .footer-links a, .preview-detail .button.small').evaluateAll(nodes =>
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
      tag_name: 'v0.1.5-test',
      assets: [{
        name: 'Change.Recovery.Ledger_0.1.5-test_amd64.AppImage',
        browser_download_url: 'https://example.test/Change.Recovery.Ledger_0.1.5-test_amd64.AppImage'
      }]
    } });
  });
  await page.goto('/', { waitUntil: 'networkidle' });
  expect(readFileSync('index.html', 'utf8')).not.toMatch(/frame-ancestors/);
  const config = JSON.parse(readFileSync('public/staticwebapp.config.json', 'utf8')) as { globalHeaders: Record<string, string> };
  expect(config.globalHeaders['Content-Security-Policy']).toContain("frame-ancestors 'none'");
  expect(releaseRequests).toEqual([releaseApiUrl]);
  await expect(page.locator('#download-status')).toContainText('v0.1.5-test');
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

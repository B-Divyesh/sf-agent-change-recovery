import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { execFileSync } from 'node:child_process';
import { chmodSync, existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test.beforeEach(async ({ context }) => {
  await context.addInitScript(() => localStorage.clear());
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

test('service worker installs the shipped shell, updates its cache, and keeps the demo offline', async ({ page, context }) => {
  await page.goto('/demo');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  const installed = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.getRegistration();
    await registration?.update();
    const keys = await caches.keys();
    const cache = await caches.open('recovery-ledger-v4');
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
  expect(installed.keys).toContain('recovery-ledger-v4');
  expect(installed.cachedDemo).toBe(true);
  expect(installed.cachedShell).toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Inspect the failed session change');
});

test('@claim:price shows the exact Pro price without exposing an unpublished checkout', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.price')).toContainText('$15');
  await expect(page.getByText('Pro checkout is being enabled')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Buy Pro' })).toHaveCount(0);
});

test('checkout resolver only accepts the exact published Sociobot endpoint', () => {
  const source = readFileSync('src/main.ts', 'utf8');
  expect(source).toContain("checkout?.origin !== 'https://api.sociobot.in'");
  expect(source).toContain("checkout.pathname !== `/api/v1/products/${slug}/checkout`");
  expect(source).toContain("product.price_minor !== 1500");
});

test('@claim:free-safety-and-patch-export keeps safety and patch export available without a license', async ({ page }) => {
  await page.goto('/demo');
  await expect(page.getByRole('button', { name: 'Reverse 1 selected file' })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Export selected patch' })).toBeEnabled();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export selected patch' }).click();
  await download;
  await page.getByRole('button', { name: 'Reverse 1 selected file' }).click();
  await page.getByRole('button', { name: 'Create checkpoint and reverse' }).click();
  await expect(page.getByRole('status').last()).toContainText('file was reversed');
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

test('built security policy keeps frame ancestry in the response header only', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto('/');
  expect(readFileSync('index.html', 'utf8')).not.toMatch(/frame-ancestors/);
  const config = JSON.parse(readFileSync('public/staticwebapp.config.json', 'utf8')) as { globalHeaders: Record<string, string> };
  expect(config.globalHeaders['Content-Security-Policy']).toContain("frame-ancestors 'none'");
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

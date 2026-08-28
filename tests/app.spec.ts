import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
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

test('@claim:local-privacy demo recovery makes no cross-origin requests', async ({ page }) => {
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

test('@claim:price shows the exact Pro price and checkout', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.price')).toContainText('$15');
  await expect(page.getByRole('link', { name: 'Buy Pro' })).toHaveAttribute('href', 'https://api.sociobot.in/api/v1/products/agent-change-recovery/checkout');
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

test('static deployment config has a real 404 and immutable hashed assets', () => {
  const config = JSON.parse(readFileSync('public/staticwebapp.config.json', 'utf8')) as { routes: { route: string; statusCode?: number; headers?: Record<string, string> }[] };
  expect(config.routes.some(route => route.route === '/*' && route.statusCode === 404)).toBe(true);
  expect(config.routes.find(route => route.route === '/assets/*')?.headers?.['Cache-Control']).toContain('immutable');
});

test('every route has its own title and history navigation works', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Privacy' }).first().click();
  await expect(page).toHaveTitle('Privacy — Change Recovery Ledger');
  await page.goBack();
  await expect(page).toHaveTitle('Change Recovery Ledger — Reverse agent changes');
});

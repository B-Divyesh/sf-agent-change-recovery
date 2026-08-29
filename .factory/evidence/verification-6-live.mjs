import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const origin = 'https://agent-change-recovery.sociobot.in';
const routes = ['/', '/demo', '/app', '/privacy', '/terms', '/missing-sheet'];
const browser = await chromium.launch({ headless: true });
const report = { generatedAt: new Date().toISOString(), routes: [], demo: {}, pwa: {} };

for (const viewport of [{ name: 'desktop', width: 1440, height: 900 }, { name: 'mobile', width: 390, height: 844 }]) {
  for (const route of routes) {
    const context = await browser.newContext({ viewport, serviceWorkers: 'block' });
    const page = await context.newPage();
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
    page.on('pageerror', error => pageErrors.push(String(error)));
    const response = await page.goto(`${origin}${route}`, { waitUntil: 'networkidle' });
    const axe = await new AxeBuilder({ page }).analyze();
    const data = await page.evaluate(() => {
      const visible = element => {
        const box = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return box.width > 0 && box.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
      };
      return {
        title: document.title,
        lang: document.documentElement.lang,
        h1: [...document.querySelectorAll('h1')].map(node => node.textContent?.trim()),
        mains: document.querySelectorAll('main').length,
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        missingAlts: [...document.querySelectorAll('img')].filter(image => !image.hasAttribute('alt')).length,
        targetsUnder44: [...document.querySelectorAll('a[href],button,input,select,textarea')]
          .filter(visible)
          .map(element => {
            const box = element.getBoundingClientRect();
            return { text: element.getAttribute('aria-label') || element.textContent?.trim() || element.getAttribute('placeholder'), tag: element.tagName, width: Math.round(box.width * 10) / 10, height: Math.round(box.height * 10) / 10 };
          })
          .filter(target => target.width < 44 || target.height < 44)
      };
    });
    report.routes.push({ viewport: viewport.name, route, status: response?.status(), ...data, seriousCritical: axe.violations.filter(item => ['serious', 'critical'].includes(item.impact ?? '')).map(item => ({ id: item.id, impact: item.impact, nodes: item.nodes.length })), allAxeViolations: axe.violations.map(item => ({ id: item.id, impact: item.impact, nodes: item.nodes.length })), consoleErrors, pageErrors });
    await context.close();
  }
}

{
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true, serviceWorkers: 'block' });
  await context.addInitScript(() => localStorage.clear());
  const page = await context.newPage();
  const requests = [];
  const consoleErrors = [];
  const pageErrors = [];
  page.on('request', request => requests.push(request.url()));
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('pageerror', error => pageErrors.push(String(error)));
  await page.goto(`${origin}/demo`, { waitUntil: 'networkidle' });
  const banner = await page.getByLabel('Demo mode').innerText();
  const initialCheckpointCount = await page.locator('[data-checkpoint]').count();
  const initialFileCount = await page.locator('input[data-file]').count();
  const session = page.getByLabel('src/auth/session.ts');
  await session.uncheck();
  const zeroState = {
    reverseDisabled: await page.getByRole('button', { name: 'Reverse selected files' }).isDisabled(),
    exportDisabled: await page.getByRole('button', { name: 'Export selected patch' }).isDisabled()
  };
  await session.check();
  await page.getByLabel('src/editor/autosave.ts').check();
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export selected patch' }).click();
  const download = await downloadEvent;
  await download.saveAs('/tmp/acr-live-selected.patch');
  const patchName = download.suggestedFilename();
  const reverse = page.getByRole('button', { name: 'Reverse 2 selected files' });
  await reverse.focus();
  await reverse.press('Enter');
  const dialogText = await page.getByRole('dialog').innerText();
  const initialDialogFocus = await page.evaluate(() => document.activeElement?.textContent?.trim());
  await page.keyboard.press('Shift+Tab');
  const wrappedDialogFocus = await page.evaluate(() => document.activeElement?.textContent?.trim());
  await page.keyboard.press('Escape');
  const escapeRestoredFocus = await page.evaluate(() => document.activeElement?.textContent?.trim());
  await reverse.press('Enter');
  await page.getByRole('button', { name: 'Create checkpoint and reverse' }).click();
  const status = await page.getByRole('status').last().innerText();
  await page.getByRole('button', { name: /Refactor session refresh/ }).click();
  const restored = await page.locator('.file-check').allTextContents();
  await page.evaluate(() => localStorage.setItem('real:sentinel', 'keep'));
  const storageBeforeReset = await page.evaluate(() => Object.keys(localStorage).sort());
  await page.getByRole('button', { name: 'Reset demo' }).click();
  const storageAfterReset = await page.evaluate(() => Object.fromEntries(Object.entries(localStorage)));
  await page.getByRole('link', { name: 'Start for real' }).click();
  const realPageHeading = await page.getByRole('heading', { level: 1 }).innerText();
  await page.goto(`${origin}/`);
  await page.getByRole('button', { name: 'Verify license' }).click();
  const emptyLicenseError = await page.locator('#license-status').innerText();
  await page.getByLabel('Have a license?').fill('definitely-invalid-token');
  await page.getByRole('button', { name: 'Verify license' }).click();
  await page.waitForFunction(() => !document.querySelector('#license-status')?.textContent?.includes('Checking'));
  const invalidLicenseResult = await page.locator('#license-status').innerText();
  const invalidTokenStored = await page.evaluate(() => localStorage.getItem('sb_license:agent-change-recovery'));
  await page.goto(`${origin}/demo`);
  await page.locator('#main').focus();
  await page.keyboard.press('Tab');
  await page.locator('.skip-link').focus();
  await page.keyboard.press('Enter');
  const skipFocused = await page.evaluate(() => document.activeElement?.id);
  await page.getByRole('button', { name: 'Reverse 1 selected file' }).focus();
  const focusStyle = await page.getByRole('button', { name: 'Reverse 1 selected file' }).evaluate(element => { const style = getComputedStyle(element); return { outline: style.outline, outlineColor: style.outlineColor, outlineWidth: style.outlineWidth }; });
  const reducedContext = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', serviceWorkers: 'block' });
  const reducedPage = await reducedContext.newPage();
  await reducedPage.goto(`${origin}/demo`);
  const reducedMotion = await reducedPage.locator('[data-checkpoint]').first().evaluate(element => { const style = getComputedStyle(element); return { animationName: style.animationName, animationDuration: style.animationDuration, transitionDuration: style.transitionDuration, scrollBehavior: getComputedStyle(document.documentElement).scrollBehavior }; });
  await reducedContext.close();
  report.demo = { banner, initialCheckpointCount, initialFileCount, zeroState, patchName, dialogText, initialDialogFocus, wrappedDialogFocus, escapeRestoredFocus, status, restored, storageBeforeReset, storageAfterReset, realPageHeading, emptyLicenseError, invalidLicenseResult, invalidTokenStored, skipFocused, focusStyle, reducedMotion, requestOrigins: [...new Set(requests.map(url => new URL(url).origin))], requests, consoleErrors, pageErrors };
  await context.close();
}

{
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('pageerror', error => pageErrors.push(String(error)));
  await page.goto(`${origin}/demo`);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
  const installed = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.getRegistration();
    await registration?.update();
    const keys = await caches.keys();
    const cache = await caches.open('recovery-ledger-v4');
    return { active: registration?.active?.state, script: registration?.active?.scriptURL, waiting: Boolean(registration?.waiting), installing: Boolean(registration?.installing), keys, cachedDemo: Boolean(await cache.match('/demo')), cachedShell: Boolean(await cache.match('/')) };
  });
  await context.setOffline(true);
  await page.reload();
  report.pwa = { installed, offlineHeading: await page.getByRole('heading', { level: 1 }).innerText(), offlineNotice: await page.getByText('You are offline. Saved ledgers and the demo still work.').innerText(), consoleErrors, pageErrors };
  await context.close();
}

await browser.close();
console.log(JSON.stringify(report, null, 2));

import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const origin = process.argv[2] ?? 'https://agent-change-recovery.sociobot.in';
const output = '.factory/evidence';
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const result = { origin, checkedAt: new Date().toISOString(), routes: [], consoleErrors: [], demoOrigins: [] };

try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true, reducedMotion: 'reduce' });
  const page = await context.newPage();
  page.on('console', message => { if (message.type() === 'error' && !message.text().includes('404')) result.consoleErrors.push(message.text()); });
  page.on('pageerror', error => result.consoleErrors.push(error.message));

  await page.goto(`${origin}/`, { waitUntil: 'networkidle' });
  await page.screenshot({ path: `${output}/polish-2-live-landing-mobile.png`, fullPage: true });
  result.firstScreen = await page.evaluate(() => ({
    h1: document.querySelector('h1')?.textContent?.trim(),
    action: document.querySelector('.hero-actions a')?.textContent?.trim(),
    factsBottom: Math.round(document.querySelector('.facts')?.getBoundingClientRect().bottom ?? 9999),
    viewportHeight: innerHeight,
    scrollWidth: document.documentElement.scrollWidth,
    viewportWidth: innerWidth,
    merchantLanguage: document.body.innerText.toLowerCase().includes('merchant of record'),
    macLabels: [...document.querySelectorAll('[data-macos-downloads] a')].map(node => node.textContent?.trim())
  }));
  result.download = {
    href: await page.locator('#download-button').getAttribute('href'),
    status: await page.locator('#download-status').textContent()
  };
  if (result.firstScreen.factsBottom > result.firstScreen.viewportHeight || result.firstScreen.scrollWidth > result.firstScreen.viewportWidth || result.firstScreen.merchantLanguage) throw new Error('First-screen/mobile/copy acceptance failed.');
  if (!result.firstScreen.macLabels.every(label => label?.startsWith('Download for '))) throw new Error('Mac controls do not name their result.');
  if (!result.download.href?.includes('/releases/download/v0.1.12/') || !result.download.status?.includes('v0.1.12')) throw new Error('Landing download does not resolve to the candidate release.');

  await page.getByRole('link', { name: 'Privacy' }).first().click();
  await page.goBack();
  await page.waitForTimeout(300);
  result.history = await page.evaluate(() => ({ scrollY, headingFocused: document.activeElement === document.querySelector('h1'), headingTop: Math.round(document.querySelector('h1')?.getBoundingClientRect().top ?? -1) }));
  if (result.history.scrollY !== 0 || !result.history.headingFocused || result.history.headingTop < 0) throw new Error(`History focus restoration failed: ${JSON.stringify(result.history)}`);

  await page.evaluate(() => localStorage.setItem('real:polish-2-sentinel', 'keep'));
  const demoRequests = [];
  page.on('request', request => demoRequests.push(request.url()));
  await page.getByRole('link', { name: 'Try it with sample data' }).click();
  await page.screenshot({ path: `${output}/polish-2-live-demo-mobile.png`, fullPage: true });
  const demo = {
    url: page.url(),
    banner: await page.getByText('Demo — sample data, nothing is saved').isVisible(),
    checkpoints: await page.locator('[data-checkpoint]').count(),
    heading: await page.locator('h1').textContent()
  };
  await page.getByRole('button', { name: 'Reset demo' }).click();
  demo.resetKeys = await page.evaluate(() => Object.keys(localStorage).filter(key => key.startsWith('demo:')));
  demo.sentinelAfterReset = await page.evaluate(() => localStorage.getItem('real:polish-2-sentinel'));
  await page.getByLabel('src/editor/autosave.ts').check();
  await page.getByRole('button', { name: 'Reverse 2 selected files' }).click();
  await page.getByRole('button', { name: 'Create checkpoint and reverse' }).click();
  await page.getByRole('button', { name: 'Start for real' }).click();
  demo.exitKeys = await page.evaluate(() => Object.keys(localStorage).filter(key => key.startsWith('demo:')));
  demo.sentinelAfterExit = await page.evaluate(() => localStorage.getItem('real:polish-2-sentinel'));
  demo.downloadVisible = await page.locator('#app-download-button').isVisible();
  result.demo = demo;
  result.demoOrigins = [...new Set(demoRequests.map(url => new URL(url).origin))];
  if (!demo.banner || demo.checkpoints !== 4 || demo.resetKeys.length || demo.exitKeys.length || demo.sentinelAfterExit !== 'keep' || !demo.downloadVisible) throw new Error('Demo isolation acceptance failed.');

  for (const path of ['/', '/demo', '/app', '/privacy', '/terms', '/missing-sheet']) {
    const response = await page.goto(`${origin}${path}`, { waitUntil: 'networkidle' });
    const axe = await new AxeBuilder({ page }).analyze();
    const route = await page.evaluate(({ path, status, violations }) => ({
      path, status, title: document.title, lang: document.documentElement.lang,
      mainCount: document.querySelectorAll('main').length,
      h1Count: document.querySelectorAll('h1').length,
      headerLinks: [...document.querySelectorAll('header a')].map(node => node.getAttribute('href')),
      footerLinks: [...document.querySelectorAll('footer a')].map(node => node.getAttribute('href')),
      build: document.querySelector('footer small')?.textContent,
      seriousAxe: violations
    }), { path, status: response?.status(), violations: axe.violations.filter(item => ['serious', 'critical'].includes(item.impact ?? '')).map(item => item.id) });
    if (route.lang !== 'en' || route.mainCount !== 1 || route.h1Count !== 1 || route.seriousAxe.length) throw new Error(`Structure failed on ${path}.`);
    result.routes.push(route);
  }
  const home = result.routes.find(route => route.path === '/');
  const missing = result.routes.find(route => route.path === '/missing-sheet');
  if (missing.status !== 404 || JSON.stringify(home.headerLinks) !== JSON.stringify(missing.headerLinks) || JSON.stringify(home.footerLinks) !== JSON.stringify(missing.footerLinks) || home.build !== missing.build) throw new Error('404 shared shell acceptance failed.');
  await page.screenshot({ path: `${output}/polish-2-live-404-mobile.png`, fullPage: true });
  if (result.consoleErrors.length) throw new Error(`Console errors: ${result.consoleErrors.join('; ')}`);

  const privacyContext = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  const privacyPage = await privacyContext.newPage();
  const privacyRequests = [];
  privacyPage.on('request', request => privacyRequests.push(request.url()));
  await privacyPage.goto(`${origin}/?demo=1`, { waitUntil: 'networkidle' });
  await privacyPage.getByRole('button', { name: 'Export selected patch' }).click();
  await privacyPage.getByRole('button', { name: 'Reverse 1 selected file' }).click();
  await privacyPage.getByRole('button', { name: 'Create checkpoint and reverse' }).click();
  result.demoOrigins = [...new Set(privacyRequests.map(url => new URL(url).origin))];
  if (JSON.stringify(result.demoOrigins) !== JSON.stringify([origin])) throw new Error(`Demo contacted unexpected origins: ${result.demoOrigins.join(', ')}`);
  await privacyContext.close();

  const offlineContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const offlinePage = await offlineContext.newPage();
  await offlinePage.goto(`${origin}/?demo=1`, { waitUntil: 'networkidle' });
  await offlinePage.evaluate(() => navigator.serviceWorker.ready);
  await offlinePage.reload({ waitUntil: 'networkidle' });
  await offlineContext.setOffline(true);
  await offlinePage.reload({ waitUntil: 'domcontentloaded' });
  result.offline = await offlinePage.evaluate(() => ({
    title: document.title,
    heading: document.querySelector('h1')?.textContent?.trim(),
    banner: document.querySelector('.demo-banner')?.textContent?.includes('nothing is saved'),
    notice: document.querySelector('.offline-notice')?.textContent?.trim(),
    controlled: Boolean(navigator.serviceWorker.controller)
  }));
  if (!result.offline.controlled || !result.offline.banner || result.offline.heading !== 'Inspect the failed session change') throw new Error('Cold offline demo reload failed.');
  await offlineContext.close();

  writeFileSync(`${output}/polish-2-live.json`, `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify(result, null, 2));
  await context.close();
} finally {
  await browser.close();
}

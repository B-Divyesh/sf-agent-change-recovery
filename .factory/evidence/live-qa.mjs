import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const origin = 'https://agent-change-recovery.sociobot.in';
const browser = await chromium.launch({ headless: true });

async function auditRoutes() {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  const requests = [];
  page.on('console', message => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });
  page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
  page.on('request', request => requests.push(request.url()));
  const routes = [];
  for (const path of ['/', '/demo', '/app', '/privacy', '/terms', '/missing-sheet']) {
    const response = await page.goto(origin + path, { waitUntil: 'networkidle' });
    const axe = await new AxeBuilder({ page }).analyze();
    routes.push(await page.evaluate(({ path, status, serious, headers }) => ({
      path,
      status,
      headers,
      title: document.title,
      lang: document.documentElement.lang,
      mains: document.querySelectorAll('main').length,
      h1s: [...document.querySelectorAll('h1')].map(node => node.textContent?.trim()),
      imagesWithoutAlt: [...document.images].filter(image => !image.hasAttribute('alt')).map(image => image.src),
      serious,
    }), {
      path,
      status: response?.status(),
      headers: response ? await response.allHeaders() : {},
      serious: axe.violations.filter(item => ['serious', 'critical'].includes(item.impact ?? '')).map(item => ({ id: item.id, impact: item.impact, nodes: item.nodes.length })),
    }));
  }
  await context.close();
  return { routes, errors, origins: [...new Set(requests.map(url => new URL(url).origin))] };
}

async function demoFlow() {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  const page = await context.newPage();
  const errors = [];
  const requests = [];
  page.on('console', message => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });
  page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
  page.on('request', request => requests.push(request.url()));
  await page.goto(origin + '/demo', { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.setItem('real:sentinel', 'keep'));
  await page.getByLabel('src/auth/session.ts').uncheck();
  const zeroDisabled = await Promise.all([
    page.getByRole('button', { name: 'Reverse selected files' }).isDisabled(),
    page.getByRole('button', { name: 'Export selected patch' }).isDisabled(),
  ]);
  await page.getByRole('button', { name: 'Select all files' }).click();
  const selectAllLabel = await page.getByRole('button', { name: /Reverse 4 selected files/ }).textContent();
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export selected patch' }).click();
  const download = await downloadEvent;
  const downloadPath = await download.path();
  await page.getByRole('button', { name: 'Reverse 4 selected files' }).click();
  const dialogText = await page.getByRole('dialog').innerText();
  await page.getByRole('button', { name: 'Create checkpoint and reverse' }).click();
  const toast = await page.getByRole('status').last().textContent();
  await page.getByRole('button', { name: /Refactor session refresh/ }).click();
  const disabledAfterRestore = await page.locator('input[data-file]:disabled').count();
  const storedBeforeReload = await page.evaluate(() => ({ keys: Object.keys(localStorage), demo: localStorage.getItem('demo:agent-change-recovery:ledger'), sentinel: localStorage.getItem('real:sentinel') }));
  await page.reload({ waitUntil: 'networkidle' });
  const restoredAfterReload = await page.getByText(/src\/auth\/session\.ts — restored/).isVisible();
  await page.getByRole('button', { name: 'Reset demo' }).click();
  const storedAfterReset = await page.evaluate(() => ({ keys: Object.keys(localStorage), sentinel: localStorage.getItem('real:sentinel') }));
  await context.close();
  return { zeroDisabled, selectAllLabel, dialogText, toast, disabledAfterRestore, storedBeforeReload, restoredAfterReload, storedAfterReset, downloadPath, errors, origins: [...new Set(requests.map(url => new URL(url).origin))] };
}

async function keyboardAndMobile() {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const errors = [];
  page.on('console', message => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });
  page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
  await page.goto(origin + '/', { waitUntil: 'networkidle' });
  await page.screenshot({ path: '.factory/evidence/mobile-landing.png', fullPage: true });
  const landing = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    viewport: innerWidth,
    transition: getComputedStyle(document.querySelector('.button')).transitionDuration,
    scrollBehavior: getComputedStyle(document.documentElement).scrollBehavior,
    smallTargets: [...document.querySelectorAll('a,button,input,textarea,select')].filter(node => {
      const r = node.getBoundingClientRect();
      const style = getComputedStyle(node);
      return style.display !== 'none' && style.visibility !== 'hidden' && r.width > 0 && r.height > 0 && (r.width < 44 || r.height < 44);
    }).map(node => { const r = node.getBoundingClientRect(); return { text: (node.textContent || node.getAttribute('aria-label') || '').trim(), tag: node.tagName, width: Math.round(r.width), height: Math.round(r.height) }; }),
  }));
  const tabStops = [];
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press('Tab');
    tabStops.push(await page.evaluate(() => {
      const node = document.activeElement;
      const style = getComputedStyle(node);
      return { tag: node?.tagName, text: node?.textContent?.trim(), outline: style.outline, rect: node?.getBoundingClientRect().toJSON() };
    }));
  }
  await page.getByRole('button', { name: 'Menu' }).focus();
  await page.keyboard.press('Enter');
  const menuExpanded = await page.getByRole('button', { name: 'Menu' }).getAttribute('aria-expanded');
  await page.getByRole('link', { name: 'Demo' }).focus();
  await page.keyboard.press('Enter');
  await page.waitForURL('**/demo');
  await page.screenshot({ path: '.factory/evidence/mobile-demo.png', fullPage: true });
  const demo = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, viewport: innerWidth }));
  const check = page.getByLabel('src/editor/autosave.ts');
  await check.focus();
  await page.keyboard.press('Space');
  const selected = await check.isChecked();
  const trigger = page.getByRole('button', { name: 'Reverse 2 selected files' });
  await trigger.focus();
  await page.keyboard.press('Enter');
  const initialDialogFocus = await page.evaluate(() => document.activeElement?.textContent?.trim());
  await page.keyboard.press('Shift+Tab');
  const wrappedDialogFocus = await page.evaluate(() => document.activeElement?.textContent?.trim());
  await page.keyboard.press('Escape');
  const restoredFocus = await trigger.evaluate(node => node === document.activeElement);
  const liveAxe = await new AxeBuilder({ page }).analyze();
  await context.close();
  return { landing, tabStops, menuExpanded, demo, selected, initialDialogFocus, wrappedDialogFocus, restoredFocus, serious: liveAxe.violations.filter(item => ['serious', 'critical'].includes(item.impact ?? '')).map(item => item.id), errors };
}

async function pwa() {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const requests = [];
  const errors = [];
  page.on('request', request => requests.push(request.url()));
  page.on('console', message => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });
  page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
  await page.goto(origin + '/demo', { waitUntil: 'networkidle' });
  const sw = await page.evaluate(async () => {
    await new Promise(resolve => setTimeout(resolve, 3000));
    const registrations = await navigator.serviceWorker.getRegistrations();
    const registration = registrations[0];
    if (registration?.active) await registration.update();
    return {
      registrations: registrations.map(item => ({ scope: item.scope, active: item.active?.state, installing: item.installing?.state, waiting: item.waiting?.state })),
      controlled: Boolean(navigator.serviceWorker.controller),
      caches: await caches.keys(),
    };
  });
  await context.setOffline(true);
  let reloadError = null;
  try { await page.reload({ waitUntil: 'domcontentloaded', timeout: 10000 }); } catch (error) { reloadError = String(error); }
  const offline = await page.evaluate(() => ({ title: document.title, h1: document.querySelector('h1')?.textContent?.trim(), notice: document.querySelector('.offline-notice')?.textContent?.trim(), controlled: Boolean(navigator.serviceWorker.controller) })).catch(error => ({ evaluationError: String(error) }));
  await context.close();
  return { sw, reloadError, offline, origins: [...new Set(requests.map(url => new URL(url).origin))], errors };
}

try {
  const phase = process.argv[2] ?? 'all';
  const result = {};
  if (phase === 'all' || phase === 'routes') result.routeAudit = await auditRoutes();
  if (phase === 'all' || phase === 'demo') result.demoFlow = await demoFlow();
  if (phase === 'all' || phase === 'mobile') result.keyboardMobile = await keyboardAndMobile();
  if (phase === 'all' || phase === 'pwa') result.pwa = await pwa();
  console.log(JSON.stringify(result, null, 2));
} finally {
  await browser.close();
}

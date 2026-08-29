import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';

const base = 'https://agent-change-recovery.sociobot.in';
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
const page = await context.newPage();
const requests = [];
const failures = [];
const consoleErrors = [];
page.on('request', request => requests.push({ method: request.method(), url: request.url(), type: request.resourceType() }));
page.on('requestfailed', request => failures.push({ url: request.url(), error: request.failure()?.errorText }));
page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
page.on('pageerror', error => consoleErrors.push(`pageerror: ${error.message}`));

const response = await page.goto(`${base}/`, { waitUntil: 'networkidle' });
const firstRead = await page.evaluate(() => ({
  title: document.title,
  h1: document.querySelector('h1')?.textContent?.trim(),
  visible: [...document.querySelectorAll('body *')].filter(node => {
    const box = node.getBoundingClientRect();
    return box.width > 0 && box.height > 0 && getComputedStyle(node).visibility !== 'hidden';
  }).map(node => node.textContent?.trim()).filter(Boolean).slice(0, 50),
  h1Count: document.querySelectorAll('h1').length,
  mainCount: document.querySelectorAll('main').length,
  lang: document.documentElement.lang,
  demoButton: [...document.querySelectorAll('a,button')].find(node => node.textContent?.trim() === 'Try it with sample data')?.outerHTML
}));
const landingAxe = await new AxeBuilder({ page }).analyze();

await page.getByRole('link', { name: 'Try it with sample data' }).click();
await page.waitForLoadState('networkidle');
const demoBefore = await page.getByRole('heading', { level: 1 }).textContent();
const beforeSelected = await page.locator('input[type=checkbox]:checked').count();
await page.getByRole('button', { name: 'Reverse 1 selected file' }).click();
const dialogText = await page.getByRole('dialog').textContent();
await page.getByRole('button', { name: 'Create checkpoint and reverse' }).click();
const recoveryToast = await page.getByRole('status').last().textContent();
await page.getByLabel('src/editor/autosave.ts').check();
const downloadPromise = page.waitForEvent('download');
await page.getByRole('button', { name: 'Export selected patch' }).click();
const download = await downloadPromise;
const patch = await (await download.createReadStream()).toArray?.();
const demoAxe = await new AxeBuilder({ page }).analyze();

console.log(JSON.stringify({
  landing: { status: response?.status(), headers: response?.headers(), firstRead, axe: landingAxe.violations.map(v => ({ id: v.id, impact: v.impact })) },
  demo: { heading: demoBefore, initialSelected: beforeSelected, dialogText, recoveryToast, download: download.suggestedFilename(), patchBytes: patch ? Buffer.concat(patch).length : null, axe: demoAxe.violations.map(v => ({ id: v.id, impact: v.impact })) },
  requests, failures, consoleErrors
}, null, 2));
await browser.close();

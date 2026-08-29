import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();
const errors = [];
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
await page.goto('https://agent-change-recovery.sociobot.in/demo', { waitUntil: 'networkidle' });
await page.evaluate(() => navigator.serviceWorker.ready);
await page.reload({ waitUntil: 'networkidle' });
const beforeOffline = await page.evaluate(async () => {
  const registration = await navigator.serviceWorker.getRegistration();
  const keys = await caches.keys();
  return { controller: Boolean(navigator.serviceWorker.controller), active: registration?.active?.state, script: registration?.active?.scriptURL, keys };
});
await context.setOffline(true);
await page.reload({ waitUntil: 'domcontentloaded' });
const offline = { heading: await page.getByRole('heading', { level: 1 }).textContent(), notice: await page.getByRole('status').first().textContent() };
console.log(JSON.stringify({ beforeOffline, offline, errors }, null, 2));
await browser.close();

import { chromium } from '@playwright/test';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 820 }, deviceScaleFactor: 1 });
await page.goto('http://127.0.0.1:4173/demo');
await page.locator('.ledger').screenshot({ path: 'assets/src/walkthrough-1.png' });
await page.getByLabel('src/editor/autosave.ts').check();
await page.getByRole('button', { name: 'Reverse 2 selected files' }).click();
await page.locator('.dialog').screenshot({ path: 'assets/src/walkthrough-2.png' });
await page.getByRole('button', { name: 'Create checkpoint and reverse' }).click();
await page.locator('.ledger').screenshot({ path: 'assets/src/walkthrough-3.png' });
await browser.close();

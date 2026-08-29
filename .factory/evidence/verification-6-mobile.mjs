import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
const page = await context.newPage();
const errors = [];
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
page.on('pageerror', error => errors.push(error.message));
await page.goto('https://agent-change-recovery.sociobot.in/', { waitUntil: 'networkidle' });
await page.keyboard.press('Tab');
const skip = await page.evaluate(() => ({
  active: document.activeElement?.textContent?.trim(),
  outline: getComputedStyle(document.activeElement).outline,
  offset: getComputedStyle(document.activeElement).outlineOffset,
  width: document.documentElement.scrollWidth,
  clientWidth: document.documentElement.clientWidth,
  reducedDuration: getComputedStyle(document.querySelector('.hero-art')).transitionDuration
}));
await page.keyboard.press('Enter');
const focusedMain = await page.evaluate(() => document.activeElement?.id);
await page.getByRole('button', { name: 'Menu' }).click();
const menuState = await page.getByRole('button', { name: 'Menu' }).getAttribute('aria-expanded');
const landingAxe = await new AxeBuilder({ page }).analyze();
await page.getByRole('link', { name: 'Demo' }).click();
await page.getByRole('button', { name: 'Reverse 1 selected file' }).focus();
const focusStyle = await page.evaluate(() => ({
  outline: getComputedStyle(document.activeElement).outline,
  boxShadow: getComputedStyle(document.activeElement).boxShadow,
  color: getComputedStyle(document.activeElement).outlineColor
}));
await page.keyboard.press('Enter');
const initialFocus = await page.evaluate(() => document.activeElement?.textContent?.trim());
await page.keyboard.press('Shift+Tab');
const wrappedFocus = await page.evaluate(() => document.activeElement?.textContent?.trim());
await page.keyboard.press('Escape');
await page.waitForTimeout(50);
const restoredFocus = await page.evaluate(() => document.activeElement?.textContent?.trim());
const demoWidth = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth }));
const demoAxe = await new AxeBuilder({ page }).analyze();
console.log(JSON.stringify({ skip, focusedMain, menuState, focusStyle, initialFocus, wrappedFocus, restoredFocus, demoWidth,
  axe: { landing: landingAxe.violations.map(v => ({ id: v.id, impact: v.impact })), demo: demoAxe.violations.map(v => ({ id: v.id, impact: v.impact })) }, errors }, null, 2));
await browser.close();

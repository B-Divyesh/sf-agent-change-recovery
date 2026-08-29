#!/usr/bin/env bash
set -euo pipefail

url="${1:?usage: scripts/verify-url.sh https://example.test/}"
node --input-type=module - "$url" <<'NODE'
import { chromium } from 'playwright';

const url = process.argv[2];
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const errors = [];
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
page.on('pageerror', error => errors.push(error.message));
await page.goto(url, { waitUntil: 'networkidle' });
const checks = await page.evaluate(() => ({
  title: document.title,
  lang: document.documentElement.lang,
  mains: document.querySelectorAll('main').length,
  h1s: document.querySelectorAll('h1').length,
  missingAlt: [...document.images].filter(image => !image.hasAttribute('alt')).map(image => image.src)
}));
await browser.close();
if (!checks.title || !checks.lang || checks.mains !== 1 || checks.h1s !== 1 || checks.missingAlt.length || errors.length) {
  console.error(JSON.stringify({ checks, errors }, null, 2));
  process.exit(1);
}
console.log(`PASS ${url}: title/lang/main/h1/alt/console`);
NODE

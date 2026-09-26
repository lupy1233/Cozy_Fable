#!/usr/bin/env node
// Capturi REALE din aplicatia Cozy Home (frontend Next.js pornit pe :3000, fara backend).
// Salveaza PNG-uri pe care scenele HTML le pot folosi ca "ecrane de telefon" reale.
//
//   node capture.mjs --url /ro --out assets/shots/landing.png [--w 430] [--h 932] [--scale 2]
//                    [--full] [--wait 1500] [--click "text=Dulap"] [--click "..."] [--scroll 600]
//                    [--hide ".cookie-banner"] [--dark]
//
// Implicit: viewport de telefon 430x932 @2x (iPhone 14 Pro Max-ish), doar zona vizibila.
// --click accepta selectori Playwright (text=, role=, css) si se aplica in ordine, cu pauza.

import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';

const argv = process.argv.slice(2);
const args = { click: [], hide: [] };
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (!a.startsWith('--')) continue;
  const k = a.slice(2);
  const v = argv[i + 1];
  if (v === undefined || v.startsWith('--')) { args[k] = true; continue; }
  if (k === 'click' || k === 'hide') args[k].push(v); else args[k] = v;
  i++;
}
const base = process.env.APP_URL || 'http://localhost:3000';
const url = args.url?.startsWith('http') ? args.url : base + (args.url || '/ro');
const out = resolve(args.out || 'assets/shots/shot.png');
mkdirSync(dirname(out), { recursive: true });

const browser = await chromium.launch({ args: ['--hide-scrollbars'] });
const ctx = await browser.newContext({
  viewport: { width: Number(args.w ?? 430), height: Number(args.h ?? 932) },
  deviceScaleFactor: Number(args.scale ?? 2),
  isMobile: Number(args.w ?? 430) < 800,
  hasTouch: Number(args.w ?? 430) < 800,
  locale: 'ro-RO',
  colorScheme: args.dark ? 'dark' : 'light',
});
const page = await ctx.newPage();
page.on('pageerror', (e) => console.error('[pageerror]', e.message));
await page.goto(url, { waitUntil: 'networkidle', timeout: 120000 }).catch(async () => {
  await page.goto(url, { waitUntil: 'load', timeout: 120000 });
});
await page.evaluate(() => document.fonts.ready);
for (const sel of args.hide) await page.locator(sel).evaluateAll((els) => els.forEach((e) => (e.style.visibility = 'hidden'))).catch(() => {});
for (const sel of args.click) {
  await page.locator(sel).first().click({ timeout: 15000 });
  await page.waitForTimeout(700);
}
if (args.scroll) { await page.mouse.wheel(0, Number(args.scroll)); await page.waitForTimeout(600); }
await page.waitForTimeout(Number(args.wait ?? 1200));
await page.screenshot({ path: out, type: 'png', fullPage: Boolean(args.full) });
console.log('salvat', out);
await browser.close();

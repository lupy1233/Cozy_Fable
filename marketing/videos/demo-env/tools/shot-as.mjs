#!/usr/bin/env node
// Captura (varianta lui capture.mjs cu login optional + pinii locali in loc de CDN):
//   node demo-env/tools/shot-as.mjs --as owner.a@demo.ro --url /ro/marketplace --out assets/shots/x.png
//   node demo-env/tools/shot-as.mjs --url /ro --out assets/shots/landing.png      (fara --as = public)
//        [--w 430] [--h 932] [--scale 2] [--full] [--wait 1500] [--click "text=..."] [--scroll 600]
// Caile relative (--out) sunt fata de directorul curent.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { APP, contextAs, saveState } from './login.mjs';
import { routeCdnToPins } from './cdn-pins.mjs';

const argv = process.argv.slice(2);
const args = { click: [] };
for (let i = 0; i < argv.length; i++) {
  const k = argv[i].slice(2); const v = argv[i + 1];
  if (v === undefined || v.startsWith('--')) { args[k] = true; continue; }
  if (k === 'click') args.click.push(v); else args[k] = v;
  i++;
}
const w = Number(args.w ?? 430);
const out = resolve(args.out || 'shot.png');
mkdirSync(dirname(out), { recursive: true });
const browser = await chromium.launch({ args: ['--hide-scrollbars'] });
const opts = {
  viewport: { width: w, height: Number(args.h ?? 932) }, deviceScaleFactor: Number(args.scale ?? 2),
  isMobile: w < 800, hasTouch: w < 800, colorScheme: args.dark ? 'dark' : 'light',
};
const ctx = args.as ? await contextAs(browser, args.as, opts) : await browser.newContext({ locale: 'ro-RO', ...opts });
await routeCdnToPins(ctx);
const page = await ctx.newPage();
page.on('pageerror', (e) => console.error('[pageerror]', e.message));
await page.goto(args.url?.startsWith('http') ? args.url : APP + (args.url || '/ro/dashboard'), { waitUntil: 'networkidle', timeout: 120000 });
await page.evaluate(() => document.fonts.ready);
for (const sel of args.click) { await page.locator(sel).first().click({ timeout: 15000 }); await page.waitForTimeout(700); }
if (args.scroll) { await page.mouse.wheel(0, Number(args.scroll)); await page.waitForTimeout(600); }
await page.waitForTimeout(Number(args.wait ?? 1500));
await page.screenshot({ path: out, fullPage: Boolean(args.full) });
console.log('salvat', out, '→', page.url());
if (args.as) await saveState(ctx, args.as);
await browser.close();

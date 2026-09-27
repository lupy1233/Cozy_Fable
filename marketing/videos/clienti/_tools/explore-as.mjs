// Explorare cu cont demo (sesiune refolosita prin demo-env/tools/login.mjs):
//   node clienti/_tools/explore-as.mjs <email> <url> <actiuni.mjs|-> <out.png> [--full]
import { chromium } from 'playwright';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { contextAs, saveState } from '../../demo-env/tools/login.mjs';
import { routeCdnToPins } from '../../demo-env/tools/cdn-pins.mjs';
const [email, url, actions, out, ...rest] = process.argv.slice(2);
const browser = await chromium.launch({ args: ['--hide-scrollbars'] });
const ctx = await contextAs(browser, email, { viewport: { width: 430, height: 932 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: 'light' });
await routeCdnToPins(ctx);
const page = await ctx.newPage();
page.on('pageerror', (e) => console.error('[pageerror]', e.message));
await page.goto('http://localhost:3000' + url, { waitUntil: 'networkidle', timeout: 120000 });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(1000);
if (actions && actions !== '-') {
  const mod = await import(pathToFileURL(resolve(actions)).href + '?' + Date.now());
  await mod.default(page, ctx);
}
await page.waitForTimeout(500);
await page.screenshot({ path: out, fullPage: rest.includes('--full') });
console.log('URL', page.url());
await saveState(ctx, email);
await browser.close();

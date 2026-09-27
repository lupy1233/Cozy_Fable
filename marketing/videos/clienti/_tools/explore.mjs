// Unealta de explorare (nu produce asset-uri): profil persistent de browser, ruleaza un fisier
// de actiuni (export default async (page, ctx) => {}) si salveaza captura viewport-ului.
//   node clienti/_tools/explore.mjs <profil> <url|-> <actiuni.mjs|-> <out.png> [--full] [--as email]
import { chromium } from 'playwright';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const [profile, url, actions, out, ...rest] = process.argv.slice(2);
const full = rest.includes('--full');
const ctx = await chromium.launchPersistentContext(resolve(profile), {
  viewport: { width: 430, height: 932 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
  locale: 'ro-RO', colorScheme: 'light', args: ['--hide-scrollbars', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = ctx.pages()[0] || await ctx.newPage();
page.on('pageerror', (e) => console.error('[pageerror]', e.message));
if (url && url !== '-') {
  await page.goto(url.startsWith('http') ? url : 'http://localhost:3000' + url, { waitUntil: 'networkidle', timeout: 120000 });
  await page.waitForTimeout(800);
}
if (actions && actions !== '-') {
  const mod = await import(pathToFileURL(resolve(actions)).href + '?' + Date.now());
  await mod.default(page, ctx);
}
await page.waitForTimeout(600);
await page.screenshot({ path: out, fullPage: full });
console.log('URL', page.url());
await ctx.close();

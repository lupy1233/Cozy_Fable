// Utilitare comune pentru capturile Video 1 v2 (telefon 430x932 @2x, ro-RO).
export const APP = process.env.APP_URL || 'http://localhost:3000';
export const PHONE = { viewport: { width: 430, height: 932 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: 'light', locale: 'ro-RO' };
// capturile brute (@2x, ~12 MB) stau in afara repo-ului; prep-v2.py le taie in assets/shots/clienti/
import { tmpdir } from 'node:os';
export const RAW = process.env.RAW || `${tmpdir()}/cozy-clienti-raw`;
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// asteapta retea linistita + toate imaginile decodate + fonturile
export async function settle(page, extra = 700) {
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.evaluate(async () => {
    await document.fonts.ready;
    // doar imaginile vizibile (cele lazy din afara ecranului nu se incarca niciodata)
    const vis = Array.from(document.images).filter((im) => { const r = im.getBoundingClientRect(); return r.bottom > -50 && r.top < innerHeight + 50 && r.width > 0; });
    const wait = Promise.all(vis.map((im) => (im.complete ? null : new Promise((r) => { im.addEventListener('load', r); im.addEventListener('error', r); }))));
    await Promise.race([wait, new Promise((r) => setTimeout(r, 8000))]);
    await Promise.race([Promise.all(vis.map((im) => (im.decode ? im.decode().catch(() => {}) : null))), new Promise((r) => setTimeout(r, 3000))]);
  });
  await page.waitForTimeout(extra);
}
// antetul sticky devine static: captura full-page il pastreaza doar sus
export async function staticHeader(page) {
  await page.addStyleTag({ content: 'header{position:relative!important;top:auto!important}' });
}
export async function headerHeight(page) {
  return page.evaluate(() => Math.round(document.querySelector('header')?.getBoundingClientRect().height || 0));
}
// captura unei zone din pagina (coordonate de document, CSS px)
export async function shotRegion(page, file, y0, h) {
  await page.screenshot({ path: `${RAW}/${file}`, fullPage: true, clip: { x: 0, y: y0, width: 430, height: h } });
  console.log('salvat', file, `y ${y0}..${y0 + h}`);
}
export async function shotView(page, file) {
  await page.screenshot({ path: `${RAW}/${file}` });
  console.log('salvat', file, '(viewport)');
}
// pozitia (document) a unui locator: {x,y,w,h} in CSS px
export async function boxOf(loc) {
  return loc.evaluate((el) => { const r = el.getBoundingClientRect(); return { x: r.x + scrollX, y: r.y + scrollY, w: r.width, h: r.height }; });
}

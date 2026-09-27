// Scenele 11–13 — pagini reale de client (fara nicio actiune care schimba starea):
//   elena.dumitru@demo.ro  /ro/requests/1d02bcae-…/offers  (3 oferte + chat cu Atelier Nord)
//   elena.dumitru@demo.ro  /ro/requests/c95f9758-…/offers  (DELIVERED_BY_COMPANY → „Confirmă livrarea”, NU se apasa)
//   mihai.ionescu@demo.ro  /ro/requests/5dcd35ab-…/offers  (COMPLETED, recenzie 5★)
// Rulare: cd marketing/videos && node clienti/_tools/cap-requests.mjs
import { chromium } from 'playwright';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { contextAs, saveState } from '../../demo-env/tools/login.mjs';
import { APP, PHONE, RAW, settle, staticHeader, headerHeight } from './cap-lib.mjs';

mkdirSync(RAW, { recursive: true });
const metaFile = `${RAW}/requests-meta.json`;
const meta = existsSync(metaFile) ? JSON.parse(readFileSync(metaFile, 'utf8')) : {};
const browser = await chromium.launch({ args: ['--hide-scrollbars'] });
const boxes = (page, specs) => page.evaluate((specs) => {
  const out = {};
  const els = Array.from(document.querySelectorAll('main *'));
  for (const [key, sel, text, nth] of specs) {
    const list = els.filter((el) => el.matches(sel) && (!text || el.textContent.trim().startsWith(text)));
    const el = list[nth || 0];
    if (!el) { out[key] = null; continue; }
    const r = el.getBoundingClientRect();
    out[key] = { x: Math.round(r.x + scrollX), y: Math.round(r.y + scrollY), w: Math.round(r.width), h: Math.round(r.height) };
  }
  return out;
}, specs);

async function grab(email, url, file, specs, prep) {
  const ctx = await contextAs(browser, email, PHONE);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.error('[pageerror]', e.message));
  await page.goto(APP + url, { waitUntil: 'networkidle' });
  await settle(page, 1500);
  const hh = await headerHeight(page);
  await page.screenshot({ path: `${RAW}/${file.replace('.png', '-header.png')}`, clip: { x: 0, y: 0, width: 430, height: hh } });
  await staticHeader(page);
  if (prep) await prep(page);
  await page.waitForTimeout(500);
  meta[file] = { header: hh, ...(await boxes(page, specs)) };
  await page.screenshot({ path: `${RAW}/${file}`, fullPage: true });
  const emails = await page.evaluate(() => (document.body.innerText.match(/[\w.+-]+@[\w-]+\.[\w.]+/g) || []));
  console.log('salvat', file, 'emailuri vizibile:', JSON.stringify(emails));
  await saveState(ctx, email);
  await ctx.close();
}

// chatul are scroll intern: il lasam la inceputul conversatiei (primele mesaje) — nu se modifica nimic
await grab('elena.dumitru@demo.ro', '/ro/requests/1d02bcae-ce2d-4ce6-9793-40f2652b146c/offers', 's11-offers.png', [
  ['secAN', 'h2,h3,p,span', 'Atelier Nord', 0], ['secDW', 'h2,h3,p,span', 'DesignWood Studio', 0], ['secCM', 'h2,h3,p,span', 'CasaMea Mobilier', 0],
  ['accept1', 'button', 'Acceptă oferta', 0], ['accept2', 'button', 'Acceptă oferta', 1], ['accept3', 'button', 'Acceptă oferta', 2],
  ['modify1', 'button', 'Cere modificare', 0], ['pdf1', 'a,button', 'Descarcă PDF', 0], ['pdf2', 'a,button', 'Descarcă PDF', 1], ['pdf3', 'a,button', 'Descarcă PDF', 2],
]);
await grab('elena.dumitru@demo.ro', '/ro/requests/c95f9758-bf1c-45e8-af43-6969793c4c44/offers', 's13-deliv.png', [
  ['confirm', 'button', 'Confirmă livrarea', 0], ['delivCard', 'section', 'Comandă livrată', 0],
]);
await grab('mihai.ionescu@demo.ro', '/ro/requests/5dcd35ab-79e9-4455-859f-5bbea0ff1981/offers', 's13-review.png', [
  ['review', 'section', 'Recenzie', 0],
]);
writeFileSync(metaFile, JSON.stringify(meta, null, 1));
console.log(JSON.stringify(meta, null, 1));
await browser.close();

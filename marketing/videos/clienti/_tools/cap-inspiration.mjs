// Scena 2 — Caietul de idei (cont ana.popescu@demo.ro, 4 colectii).
// Lightbox-ul si alegerea colectiei se captureaza la viewport 430x760 (vezi mai jos).
// Stari: meniul Culoare deschis → filtrul Verde aplicat → lightbox (Idei asemanatoare) → alegerea colectiei.
// Pinul-tinta („Dormitor cu dulapuri albe pe tot peretele”) e salvat de seed in „Dormitor matrimonial”:
// scriptul il scoate intai din colectie si la final il salveaza la loc in aceeasi colectie (starea DB revine).
// Rulare: cd marketing/videos && node clienti/_tools/cap-inspiration.mjs
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { contextAs, saveState } from '../../demo-env/tools/login.mjs';
import { APP, PHONE, RAW, settle, staticHeader, headerHeight, shotRegion, shotView, boxOf } from './cap-lib.mjs';

const EMAIL = 'ana.popescu@demo.ro';
const PIN = 'Dormitor cu dulapuri albe pe tot peretele';
const BOARD = 'Dormitor matrimonial';
mkdirSync(RAW, { recursive: true });
const meta = {};
const browser = await chromium.launch({ args: ['--hide-scrollbars'] });
const ctx = await contextAs(browser, EMAIL, PHONE);
const page = await ctx.newPage();
page.on('pageerror', (e) => console.error('[pageerror]', e.message));
await page.goto(APP + '/ro/inspiration', { waitUntil: 'networkidle' });
await settle(page, 1200);
meta.header = await headerHeight(page);
await page.screenshot({ path: `${RAW}/s2-header.png`, clip: { x: 0, y: 0, width: 430, height: meta.header } });

// pregatire: pinul-tinta trebuie sa fie nesalvat (altfel butonul arata „Salvat”) — prin API-ul aplicatiei,
// cu sesiunea anei (acelasi apel ca „Scoate din colecție”)
const API = 'http://localhost:3001/api/v1';
const boards = await (await ctx.request.get(`${API}/inspiration/boards`)).json();
const board = boards.find((b) => b.name === BOARD);
const detail = await (await ctx.request.get(`${API}/inspiration/boards/${board.id}`)).json();
const items = detail.items || detail.photos || [];
const hit = items.find((it) => (it.photo?.title || it.title) === PIN);
meta.boardId = board.id;
meta.photoId = hit ? (hit.photo?.id || hit.photoId || hit.id) : null;
if (hit) {
  const r = await ctx.request.delete(`${API}/inspiration/boards/${board.id}/items/${meta.photoId}`);
  console.log('pin scos temporar din colectie', r.status());
}
await page.reload({ waitUntil: 'networkidle' });
await settle(page, 800);
await staticHeader(page);
await page.evaluate(() => scrollTo(0, 0));
await page.waitForTimeout(300);

// A: meniul Culoare deschis
await page.getByRole('button', { name: /Culoare/i }).first().click();
await page.waitForTimeout(900);
meta.verde = await boxOf(page.getByRole('button', { name: /^Verde$/ }).first());
meta.culoare = await boxOf(page.getByRole('button', { name: /Culoare/i }).first());
await shotRegion(page, 's2-a.png', 0, 1300);

// B: filtrul Verde aplicat, meniul inchis
await page.getByRole('button', { name: /^Verde$/ }).first().click();
await page.waitForTimeout(600);
await page.locator('button.fixed.inset-0[aria-label="Culoare"]').click({ position: { x: 420, y: 880 } });   // inchide meniul (overlay-ul)
await settle(page, 1200);
const pinImg = page.locator('img[alt]').filter({ has: page.locator('xpath=.') }).first();
meta.pin = await page.evaluate((title) => {
  const el = Array.from(document.querySelectorAll('img')).find((im) => (im.alt || '').includes(title));
  const box = (el?.closest('button,a,article,div[role=button]') || el).getBoundingClientRect();
  return { x: box.x + scrollX, y: box.y + scrollY, w: box.width, h: box.height };
}, PIN);
await shotRegion(page, 's2-b.png', 0, 1400);

// C: lightbox pe pinul-tinta (viewport, cu antetul la loc)
await page.addStyleTag({ content: 'header{position:sticky!important}' });
// modalul e dimensionat pe vh: un viewport mai scund il face sa incapa in fereastra telefonului din video
await page.setViewportSize({ width: 430, height: Number(process.env.LB_H || 760) });
await page.evaluate((y) => scrollTo(0, Math.max(0, y - 300)), meta.pin.y);
await page.waitForTimeout(400);
await page.locator(`img[alt="${PIN}"]`).first().click();
await settle(page, 1500);
const dlg = page.locator('[role=dialog], .fixed.inset-0').last();
meta.lightbox = await dlg.evaluate((el) => { const c = el.querySelector('div.relative.flex') || el; const r = c.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
meta.save = await page.getByRole('button', { name: /^Salvează$/ }).last().evaluate((el) => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
await shotView(page, 's2-c.png');

// D: alegerea colectiei
await page.getByRole('button', { name: /^Salvează$/ }).last().click();
await page.waitForTimeout(1000);
meta.board = await page.getByRole('button', { name: new RegExp(BOARD) }).first().evaluate((el) => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; }).catch(() => null);
await shotView(page, 's2-d.png');

// E: salvat in colectie (readuce starea initiala a DB-ului)
await page.getByRole('button', { name: new RegExp(BOARD) }).first().click();
await page.waitForTimeout(1500);
await shotView(page, 's2-e.png');

writeFileSync(`${RAW}/s2-meta.json`, JSON.stringify(meta, null, 1));
console.log(JSON.stringify(meta));
await saveState(ctx, EMAIL);
await browser.close();

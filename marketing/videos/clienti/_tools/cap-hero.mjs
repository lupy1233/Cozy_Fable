// Capturi reale ale mini-configuratorului din hero (/ro), pe stari succesive (@3x, doar cardul demo).
// Rulare: cd marketing/videos && node clienti/_tools/cap-hero.mjs
// Implicit: Comodă TV 220 / Alb mat / Push → Dulap → 160 cm → Furnir stejar → Mânere (hero-0..4.png).
// Afiseaza si pozitiile butoanelor (px CSS relativ la card) folosite pentru „tap”-urile din scena 2.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const base = process.env.APP_URL || 'http://localhost:3000';
const outDir = resolve('assets/shots/clienti');
mkdirSync(outDir, { recursive: true });
const W = Number(process.env.W || 430);

const browser = await chromium.launch({ args: ['--hide-scrollbars'] });
const ctx = await browser.newContext({
  viewport: { width: W, height: 932 }, deviceScaleFactor: Number(process.env.SCALE || 3), isMobile: true, hasTouch: true,
  locale: 'ro-RO', colorScheme: 'light', reducedMotion: 'reduce',
});
const page = await ctx.newPage();
page.on('pageerror', (e) => console.error('[pageerror]', e.message));
await page.goto(base + '/ro', { waitUntil: 'networkidle', timeout: 120000 });
await page.evaluate(() => document.fonts.ready);
// cardul demo: containerul cu kicker-ul "Probează configuratorul"
const card = page.locator('div.border.bg-surface', { has: page.locator('text=Probează configuratorul') }).first();
await card.scrollIntoViewIfNeeded();
await page.waitForTimeout(800);
const btn = (label) => card.locator('button', { hasText: label }).first();
const shot = async (name) => {
  await page.waitForTimeout(900);
  await card.screenshot({ path: `${outDir}/${name}.png` });
  console.log('salvat', name);
};
const DEFAULT_STEPS = [
  { name: 'hero-0', click: ['Comodă TV', '220 cm', 'Push-to-open'] },
  { name: 'hero-1', click: ['Dulap'] },
  { name: 'hero-2', click: ['160 cm'] },
  { name: 'hero-3', click: ['Furnir stejar'] },
  { name: 'hero-4', click: ['Mânere'] },
];
const steps = process.env.STEPS ? JSON.parse(process.env.STEPS) : DEFAULT_STEPS;
const box = await card.boundingBox();
console.log('card box', JSON.stringify(box));
const rel = async (label) => {
  const b = await btn(label).boundingBox();
  return { label, x: +(b.x - box.x).toFixed(1), y: +(b.y - box.y).toFixed(1), w: +b.width.toFixed(1), h: +b.height.toFixed(1) };
};
for (const s of steps) {
  for (const c of s.click) { await btn(c).click(); await page.waitForTimeout(300); }
  await shot(s.name);
}
// pozitiile butoanelor (px CSS relativ la card) — pentru „tap”-urile din scena 2
const labels = ['Dulap', 'Bibliotecă', 'Comodă TV', '160 cm', '240 cm', 'Alb mat', 'Furnir stejar', 'Verde salvie', 'Mânere', 'Push-to-open', 'Uși glisante'];
const out = [];
for (const l of labels) out.push(await rel(l).catch(() => ({ label: l, missing: true })));
console.log(JSON.stringify(out));
// reperele sectiunilor (titlurile intrebarilor + cartusul spec)
const marks = await card.evaluate((el) => {
  const r0 = el.getBoundingClientRect();
  return Array.from(el.querySelectorAll('p.label, svg')).slice(0, 12).map((n) => {
    const r = n.getBoundingClientRect();
    return { tag: n.tagName, text: (n.textContent || '').trim().slice(0, 30), y: +(r.top - r0.top).toFixed(1), h: +r.height.toFixed(1), x: +(r.left - r0.left).toFixed(1), w: +r.width.toFixed(1) };
  });
});
console.log(JSON.stringify(marks));
await browser.close();

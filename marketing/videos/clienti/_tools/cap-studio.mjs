// Capturi reale din Studio 3D (/ro/studio): editorul de piesa „Dulap” in mai multe stari
// (latime 120 → 180, 2 → 3 coloane, usi inchise/deschise, finisaje).
// Rulare: cd marketing/videos && node clienti/_tools/cap-studio.mjs
// Iesire: assets/shots/clienti/_studio/*.png (materie prima); apoi clienti/_tools/prep-assets.sh le taie
// in assets/shots/clienti/studio-*.png si sterge folderul intermediar. Capturile sunt reproductibile bit cu bit.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const base = process.env.APP_URL || 'http://localhost:3000';
const outDir = resolve(process.env.OUT || 'assets/shots/clienti/_studio');
mkdirSync(outDir, { recursive: true });
const SCALE = Number(process.env.SCALE || 2);
// pozitiile usilor (fractii din cutia canvas-ului), pentru deschidere prin click
const DOORS = JSON.parse(process.env.DOORS || '[[0.345,0.31],[0.459,0.31],[0.586,0.31]]');

const browser = await chromium.launch({ args: ['--hide-scrollbars'] });
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 }, deviceScaleFactor: SCALE, locale: 'ro-RO', colorScheme: 'light',
});
const page = await ctx.newPage();
page.on('pageerror', (e) => console.error('[pageerror]', e.message));
await page.goto(base + '/ro/studio', { waitUntil: 'networkidle', timeout: 120000 });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(1500);
await page.getByText('Descopăr singur').click();
await page.waitForTimeout(800);
await page.getByRole('button', { name: /Piesă nouă/ }).first().click();
await page.waitForTimeout(1000);
const dialog = page.locator('[role=dialog]').last();
await dialog.getByRole('button', { name: /^Dulap$/ }).first().click();
await page.waitForTimeout(4000);

const modeFields = () => dialog.getByRole('button', { name: 'Câmpuri clasice' }).click();
const mode3d = async () => { await dialog.getByRole('button', { name: 'Configurează în 3D' }).click(); await page.waitForTimeout(3500); };
const setWidth = async (cm) => {
  const inp = dialog.locator('input[type=number]').first();
  await inp.fill(String(cm));
  await inp.press('Enter');
  await page.waitForTimeout(500);
};
const colStep = async (label) => {
  const row = dialog.locator('div.flex.items-center.gap-3', { has: page.locator('span', { hasText: /^Coloane$/ }) }).first();
  await row.getByRole('button', { name: label }).click();
  await page.waitForTimeout(400);
};
// fields mode: coloana ci are un bloc cu "Coloana N"; primul <select> = tipul zonei 0, al doilea = interiorul
const setZone = async (ci, zi, type, fill) => {
  const block = dialog.locator('div.rounded-lg.border', { has: page.locator('span', { hasText: new RegExp(`^Coloana ${ci + 1}$`) }) }).first();
  // zona 0 (nu e sertar) are primele doua <select>-uri ale blocului: tipul si interiorul
  const selects = block.locator('select');
  await selects.nth(0).selectOption(type);
  await page.waitForTimeout(300);
  if (fill) { await selects.nth(1).selectOption(fill); await page.waitForTimeout(300); }
};
const canvasBox = async () => dialog.locator('canvas').first().boundingBox();
const shot = async (name) => {
  await page.mouse.move(5, 5);
  await page.waitForTimeout(1200);
  await dialog.locator('canvas').first().screenshot({ path: `${outDir}/${name}.png` });
  console.log('salvat', name);
};
// curata selectia zonei active (conturul portocaliu) direct din starea React — doar pentru captura
const clearSelection = () => page.evaluate(() => {
  const el = document.querySelector('[role=dialog] canvas');
  let key = el && Object.keys(el).find((k) => k.startsWith('__reactFiber$'));
  let node = el;
  while (node && !key) { node = node.parentElement; key = node && Object.keys(node).find((k) => k.startsWith('__reactFiber$')); }
  let f = node && node[key];
  let n = 0;
  while (f) {
    let h = f.memoizedState;
    while (h && typeof h === 'object' && 'next' in h) {
      const s = h.memoizedState;
      if (s && typeof s === 'object' && 'col' in s && 'zone' in s && h.queue && h.queue.dispatch) { h.queue.dispatch(null); n++; }
      h = h.next;
    }
    f = f.return;
  }
  return n;
});

// fronturi cu maner (ca in scena 2: „Mânere”)
await dialog.getByRole('button', { name: 'Cu mâner' }).first().click();
await page.waitForTimeout(500);
// A — 120 cm, 2 coloane, usi batante peste sertare
await modeFields();
await page.waitForTimeout(600);
await setWidth(120);
await colStep('Mai puține');
await setZone(0, 0, 'DOOR', 'HANGING');
await setZone(1, 0, 'DOOR', 'SHELVES');
for (const w of [120, 140, 160]) {
  await setWidth(w);
  await mode3d();
  await shot(`w${w}-c2`);
  await modeFields();
  await page.waitForTimeout(400);
}
// 3 coloane
await colStep('Mai multe');
await setZone(0, 0, 'DOOR', 'HANGING');
await setZone(1, 0, 'DOOR', 'SHELVES');
await setZone(2, 0, 'DOOR', 'HANGING');
for (const w of [160, 170, 180]) {
  await setWidth(w);
  await mode3d();
  await shot(`w${w}-c3`);
  await modeFields();
  await page.waitForTimeout(400);
}
await mode3d();
const box = await canvasBox();
console.log('canvas box', JSON.stringify(box));
if (DOORS.length) {
  for (const [fx, fy] of DOORS) {
    await page.mouse.click(box.x + fx * box.width, box.y + fy * box.height);
    await page.waitForTimeout(900);
  }
  await page.waitForTimeout(1500);
  console.log('cleared', await clearSelection());
  await shot('w180-c3-open');
  for (const fin of (process.env.FINISHES || 'Nuc,Verde salvie').split(',')) {
    await dialog.locator(`button[title="${fin}"]`).first().click();
    await page.waitForTimeout(600);
    await clearSelection();
    await shot(`w180-c3-open-${fin.replace(/\s+/g, '-').toLowerCase()}`);
  }
}
await browser.close();

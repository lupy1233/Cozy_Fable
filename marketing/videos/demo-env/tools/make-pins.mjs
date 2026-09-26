#!/usr/bin/env node
// Genereaza imaginile inlocuitoare pentru galeria de inspiratie din Studio 3D
// (configuratorul real de piese, WebGL headless). Cate o randare PER POZA din DB,
// derivata din atributele ei (camera → tip de corp, culori → finisaj, sisteme →
// manere/push/glisante), ca filtrele galeriei sa ramana credibile.
//
//   node tools/make-pins.mjs [--only <slug>] [--limit N]
// Necesita: frontend pe :3000, Postgres cu seed-ul de inspiratie. Scrie PNG-uri
// brute in data/pins-raw/<slug>.png + data/pins-raw/manifest.json; decuparea pe
// aspect ratio (3:4 / 1:1 / 4:3 / 2:3) o face tools/crop-pins.py → pins/<slug>.jpg.
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const rawDir = join(here, '..', 'data', 'pins-raw');
mkdirSync(rawDir, { recursive: true });
const argv = process.argv.slice(2);
const only = argv.includes('--only') ? argv[argv.indexOf('--only') + 1] : null;
const limit = argv.includes('--limit') ? Number(argv[argv.indexOf('--limit') + 1]) : Infinity;
const APP = process.env.APP_URL || 'http://localhost:3000';

// slug stabil = numele fisierului din URL-ul original (CDN) sau din URL-ul local
export const slugOf = (url) =>
  decodeURIComponent(url.split('/').pop()).replace(/\.[a-z0-9]+$/i, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const sql = `select coalesce(json_agg(json_build_object('title',title,'room',room_type,'colors',colors,
  'materials',materials,'systems',systems,'featured',featured,'url',image_url) order by created_at),'[]')
  from inspiration_photos where deleted_at is null and image_url is not null`;
const rows = JSON.parse(execFileSync('psql', ['-h', 'localhost', '-U', 'marketplace', '-d', 'marketplace', '-tAc', sql],
  { env: { ...process.env, PGPASSWORD: 'marketplace' } }).toString());

const hash = (s) => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };
const pick = (arr, h) => arr[h % arr.length];
const lerp = (a, b, h) => Math.round(a + ((h % 1000) / 1000) * (b - a));

const KIND_LABEL = { BOOKCASE: 'Bibliotecă', WARDROBE: 'Dulap', TV_UNIT: 'Comodă TV', SHOE_CABINET: 'Pantofar', DRESSER: 'Comodă', NIGHTSTAND: 'Noptieră', DESK: 'Birou' };
const FINISH = { WHITE: 'Alb', BEIGE: 'Crem', NATURAL_WOOD: 'Stejar', BROWN: 'Nuc', GRAY: 'Gri', BLACK: 'Negru', GREEN: 'Verde salvie', BLUE: 'Albastru', RED: 'Teracotă', YELLOW: 'Crem' };
// dimensiuni "frumoase" per tip (cm): [w min,max],[h min,max],[d min,max] — in limitele configuratorului
const DIMS = {
  BOOKCASE: [[90, 260], [180, 260], [30, 40]], WARDROBE: [[120, 300], [220, 270], [55, 65]],
  TV_UNIT: [[160, 300], [40, 60], [38, 45]], SHOE_CABINET: [[70, 130], [90, 160], [28, 35]],
  DRESSER: [[100, 200], [75, 95], [45, 55]], NIGHTSTAND: [[40, 60], [45, 60], [35, 45]], DESK: [[110, 180], [74, 76], [60, 70]],
};

function kindFor(p, h) {
  const t = p.title.toLowerCase();
  if (/noptier/.test(t)) return 'NIGHTSTAND';
  if (/bibliotec|rafturi|nise/.test(t)) return 'BOOKCASE';
  if (/\btv\b|media/.test(t)) return 'TV_UNIT';
  if (/birou|training|lounge|tabla/.test(t)) return 'DESK';
  if (/comoda/.test(t)) return 'DRESSER';
  if (/cuier|bancuta|pantof/.test(t)) return 'SHOE_CABINET';
  if (/dulap|dressing|vitrina|walk-in/.test(t)) return 'WARDROBE';
  switch (p.room) {
    case 'KITCHEN': return pick(['DRESSER', 'DRESSER', 'WARDROBE'], h);
    case 'BATHROOM': return pick(['DRESSER', 'NIGHTSTAND'], h);
    case 'BEDROOM': return pick(['WARDROBE', 'NIGHTSTAND', 'DRESSER'], h);
    case 'LIVING': return pick(['TV_UNIT', 'BOOKCASE'], h);
    case 'OFFICE': return 'DESK';
    case 'HALLWAY': return pick(['SHOE_CABINET', 'WARDROBE'], h);
    case 'PANTRY': return 'BOOKCASE';
    case 'DRESSING': return 'WARDROBE';
    default: return 'DRESSER';
  }
}

function specFor(p) {
  const slug = slugOf(p.url);
  const h = hash(slug);
  const kind = kindFor(p, h);
  const color = p.colors.find((c) => FINISH[c]) ?? 'NATURAL_WOOD';
  const [wr, hr, dr] = DIMS[kind];
  const aspects = {
    WARDROBE: ['3:4', '2:3', '1:1'], BOOKCASE: ['3:4', '2:3', '4:5'], SHOE_CABINET: ['3:4', '1:1', '4:5'],
    NIGHTSTAND: ['1:1', '3:4', '4:5'], TV_UNIT: ['4:3', '1:1', '3:2'], DRESSER: ['4:3', '1:1', '3:4'], DESK: ['4:3', '1:1', '3:4'],
  }[kind];
  return {
    slug, title: p.title, room: p.room, kind, finish: FINISH[color],
    handle: p.systems.includes('MANER'), sliding: kind === 'WARDROBE' && p.systems.includes('GLISANTE'),
    legs: kind === 'DRESSER' && (h >>> 3) % 2 === 1,
    w: lerp(wr[0], wr[1], h), hgt: lerp(hr[0], hr[1], h >>> 5), d: lerp(dr[0], dr[1], h >>> 9),
    cols: (h >>> 11) % 3, // 0 = implicit, 1 = +1 coloana, 2 = -1 coloana
    dx: ((h >>> 13) % 2 ? 1 : -1) * lerp(6, 40, h >>> 15), dy: lerp(-6, 12, h >>> 17),
    aspect: p.featured ? '3:4' : pick(aspects, h >>> 19), featured: p.featured,
  };
}

let specs = rows.map(specFor);
if (only) specs = specs.filter((s) => s.slug === only);
specs = specs.slice(0, limit);
const order = Object.keys(KIND_LABEL);
specs.sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));
console.log(`[pins] ${specs.length} randari`, Object.fromEntries(order.map((k) => [k, specs.filter((s) => s.kind === k).length])));

const browser = await chromium.launch({ args: ['--hide-scrollbars'] });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 3, locale: 'ro-RO' });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.error('[pageerror]', e.message));
page.on('dialog', (d) => { console.log('[dialog]', d.message()); d.accept(); });
await page.goto(`${APP}/ro/studio`, { waitUntil: 'networkidle', timeout: 180000 });
await page.getByText('Descopăr singur').first().click({ timeout: 8000 }).catch(() => {});
await page.waitForTimeout(800);

const dlg = page.locator('[role=dialog]');
let openKind = null;
async function openEditor(kind) {
  if (openKind === kind) return;
  if (openKind) { await dlg.getByRole('button', { name: 'Renunță' }).click(); await page.waitForTimeout(500); }
  await page.getByRole('button', { name: 'Piesă nouă' }).first().click();
  await page.waitForTimeout(500);
  await dlg.getByRole('button', { name: KIND_LABEL[kind], exact: true }).click();
  await dlg.locator('canvas').first().waitFor({ timeout: 60000 });
  await page.waitForTimeout(3500);
  openKind = kind;
}
async function setNum(i, v) {
  const inp = dlg.locator('input[type=number]').nth(i);
  await inp.fill(String(v));
  await inp.press('Enter');
}
const clickIf = (name) => dlg.getByRole('button', { name, exact: true }).first().click({ timeout: 2000 }).catch(() => {});

const manifest = [];
for (const s of specs) {
  try {
    const dbg = async (tag) => { if (process.env.DEBUG_PINS) await page.screenshot({ path: `${process.env.DEBUG_PINS}/${tag}.png` }); };
    if (process.env.DEBUG_PINS) console.log(JSON.stringify(s));
    const fresh = openKind !== s.kind;
    await openEditor(s.kind);
    if (!fresh) { await clickIf('De la capăt'); await page.waitForTimeout(400); }
    await dbg('a-open');
    await setNum(0, s.w); await setNum(1, s.hgt); await setNum(2, s.d);
    await dbg('b-dims');
    if (s.cols === 1) await clickIf('Mai multe');
    if (s.cols === 2) await clickIf('Mai puține');
    await clickIf(s.finish);
    await clickIf(s.handle ? 'Cu mâner' : 'Push (fără mâner)');
    if (s.kind === 'WARDROBE') await clickIf(s.sliding ? 'Glisante' : 'Batante');
    if (s.kind === 'DRESSER') await clickIf(s.legs ? 'Pe picioare' : 'Cu soclu');
    await page.waitForTimeout(900);
    await dbg('c-opts');
    // rotire orbitala: tragem dintr-un colt gol al canvasului (un click pe model ar selecta o zona)
    const box = await dlg.locator('canvas').first().boundingBox();
    // start jos-centru (sub model) si miscarea ramane in canvas: un pointerdown in afara
    // dialogului (pe overlay) l-ar inchide
    const x0 = box.x + box.width * 0.5 - s.dx / 2, y0 = box.y + box.height * 0.955 - Math.max(0, s.dy);
    await page.mouse.move(x0, y0);
    await page.mouse.down();
    await page.mouse.move(x0 + s.dx, y0 + s.dy, { steps: 12 });
    await page.mouse.up();
    await page.waitForTimeout(900);
    const file = join(rawDir, `${s.slug}.png`);
    await dlg.locator('canvas').first().screenshot({ path: file });
    // readuce camera aproximativ inapoi (rotirile se cumuleaza intre piese)
    await page.mouse.move(x0 + s.dx, y0 + s.dy);
    await page.mouse.down();
    await page.mouse.move(x0, y0, { steps: 12 });
    await page.mouse.up();
    manifest.push(s);
    console.log(`[pins] ok ${s.kind.padEnd(12)} ${s.finish.padEnd(12)} ${s.aspect} ${s.slug}`);
  } catch (e) {
    console.error(`[pins] FAIL ${s.slug}: ${e.message.split('\n')[0]}`);
    await page.screenshot({ path: join(rawDir, `_fail-${s.slug}.png`), timeout: 60000 }).catch(() => {});
    openKind = null;
    await page.goto(`${APP}/ro/studio`, { waitUntil: 'networkidle' }).catch(() => {});
  }
}
writeFileSync(join(rawDir, 'manifest.json'), JSON.stringify(manifest, null, 1));
await browser.close();
console.log(`[pins] gata: ${manifest.length}/${specs.length} → ${rawDir}`);

import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Fixture-only browser capture. All backend requests are intercepted as guest;
// no account or application source writes. Screenshots are native browser output.
const root = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(path.join(root, 'apps/frontend/package.json'));
const { chromium } = require('@playwright/test');
const { PIECE3D_KINDS, defaultPieceConfig, normalizePieceConfig, studioDraftDataSchema, buildPanels } = require('@marketplace/shared');
const base = JSON.parse(await readFile(path.join(root, 'docs/implementation/house-demo-fixture.json'), 'utf8'));
const output = process.env.GALLERY_OUTPUT ? path.resolve(process.env.GALLERY_OUTPUT) : path.join(root, 'docs/implementation/screenshots/furniture-gallery');
await mkdir(output, { recursive: true });
const url = process.env.STUDIO_URL ?? 'http://127.0.0.1:3100/en/studio';
const browser = await chromium.launch({ headless: true });
const captures = [];
const cases = process.env.GALLERY_CATALOG_VARIANTS ? [
  ['SIDEBOARD', 'sideboard-drawers-walnut', { finish: 'NUC', legs: true, frontStyle: 'HANDLE', columns: [{ zones: [{ type: 'DOOR', fill: 'SHELVES', count: 1 }] }, { zones: [{ type: 'DRAWERS', count: 3 }] }, { zones: [{ type: 'OPEN', fill: 'SHELVES', count: 1 }] }] }],
  ['WALL_CABINET', 'wall-cabinet-sage', { finish: 'VERDE_SALVIE', frontStyle: 'HANDLE' }],
  ['BATHROOM_VANITY', 'vanity-double-open', { widthM: 1.6, finish: 'NUC', vanity: { mounting: 'FLOOR', basins: 'DOUBLE', storage: 'DRAWERS', handles: 'HANDLE', countertop: 'DARK' } }],
  ['ENTRYWAY', 'entryway-doors-mirror', { finish: 'CREM', entryway: { hooks: 3, mirror: 'LEFT', upperShelf: true, upholsteredSeat: true, shoeStorage: 'DOORS' } }],
  ['SOFA', 'sofa-chaise-boucle', { widthM: 2.5, sofa: { seats: 3, layout: 'CHAISE_LEFT', bodyDepthM: 1, arms: 'WIDE', cushions: 'SPLIT', chaiseDepthM: 1.7 }, upholstery: { fabric: 'BOUCLE', color: '#648277', firmness: 'SOFT', base: 'WALNUT' } }],
  ['ARMCHAIR', 'armchair-velvet', { armchair: { arms: 'WIDE' }, upholstery: { fabric: 'VELVET', color: '#924d36', firmness: 'FIRM', base: 'BLACK' } }],
  ['OTTOMAN', 'ottoman-round-storage', { ottoman: { shape: 'ROUND', storage: true }, upholstery: { fabric: 'BOUCLE', color: '#648277', firmness: 'SOFT', base: 'PLINTH' } }],
] : process.env.GALLERY_VARIANTS ? [
  ['BED', 'bed-upholstered', { bed: { mattressSize: 'K_180', storage: 'LIFT_UP', upholstered: true } }],
  ['BED', 'bed-single-drawers', { finish: 'NUC', bed: { mattressSize: 'S_90', storage: 'DRAWERS', upholstered: false } }],
  ['TABLE', 'table-round-walnut', { finish: 'NUC', table: { type: 'DINING', shape: 'ROUND', seats: 'SIX' } }],
  ['TABLE', 'table-extendable', { table: { type: 'DINING', shape: 'EXTENDABLE', seats: 'SIX' } }],
  ['BENCH', 'bench-storage-linen', { finish: 'VERDE_SALVIE', bench: { style: 'WITH_STORAGE', upholsteredSeat: true } }],
  ['BENCH', 'bench-shoe-space', { finish: 'NUC', bench: { style: 'WITH_SHOE_SPACE', upholsteredSeat: false } }],
  ['DRESSER', 'dresser-walnut-handles', { finish: 'NUC', frontStyle: 'HANDLE', legs: true }],
  ['WARDROBE', 'wardrobe-sage-handles', { finish: 'VERDE_SALVIE', frontStyle: 'HANDLE' }],
  ['NIGHTSTAND', 'nightstand-black', { finish: 'NEGRU', frontStyle: 'HANDLE' }],
  ['BOOKCASE', 'bookcase-white', { finish: 'ALB' }],
] : PIECE3D_KINDS.filter((kind) => !process.env.GALLERY_KINDS || process.env.GALLERY_KINDS.split(',').includes(kind)).map((kind) => [kind, kind.toLowerCase(), {}]);
try {
  for (const [kind, label, overrides] of cases.filter(([kind]) => !process.env.GALLERY_KINDS || process.env.GALLERY_KINDS.split(',').includes(kind))) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 1 });
    try {
      const page = await context.newPage();
      page.setDefaultTimeout(45_000);
      const pageErrors = [], apiRequests = [];
      page.on('pageerror', (error) => pageErrors.push(error.message));
      page.on('console', (message) => { if (message.type() === 'error' && /WebGL|THREE|GL_INVALID|Shader Error/.test(message.text())) pageErrors.push(message.text()); });
      await page.route('**/api/v1/**', (route) => {
        apiRequests.push({ method: route.request().method(), path: new URL(route.request().url()).pathname });
        return route.fulfill({ status: 401, contentType: 'application/json', body: '{"error":{"code":"UNAUTHORIZED","message":"Guest fixture"}}' });
      });
      const config = normalizePieceConfig(kind, { ...defaultPieceConfig(kind), ...overrides });
      const fixture = { version: 3, activeSceneId: 'gallery', pieces: { furniture: { id: 'furniture', name: kind, kind, config, updatedAt: 0 } }, scenes: [{ ...base.scenes[0], id: 'gallery', name: 'Visual review', openings: [], placements: [{ id: 'placement', pieceId: 'furniture', x: 0, z: 0, rotation: 0 }] }], house: { version: 1, floors: [{ id: 'ground', name: '1' }], roomTransforms: { gallery: { floorId: 'ground', x: 0, z: 0, rotation: 0 } }, connections: [] } };
      studioDraftDataSchema.parse(fixture);
      await page.addInitScript((data) => {
        localStorage.setItem('mm_studio_v3', JSON.stringify({ version: 3, state: { ...data, tutorialSeen: true, accountDraft: null, panelPos: null } }));
        for (const Constructor of [window.WebGLRenderingContext, window.WebGL2RenderingContext].filter(Boolean)) {
          for (const method of ['drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced']) {
            const original = Constructor.prototype[method];
            if (original) Constructor.prototype[method] = function (...args) {
              this.canvas.dataset.drawCalls = String(Number(this.canvas.dataset.drawCalls ?? 0) + 1);
              return original.apply(this, args);
            };
          }
        }
      }, fixture);
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
      await page.waitForFunction(() => [...document.querySelectorAll('canvas')].some((element) => Number(element.dataset.drawCalls) > 0));
      await page.getByRole('button', { name: 'Furniture', exact: true }).click();
      await page.getByRole('button', { name: 'Edit', exact: true }).first().click();
      const dialog = page.getByRole('dialog', { name: 'Edit piece', exact: true });
      const canvas = dialog.locator('canvas');
      await canvas.waitFor();
      await page.waitForFunction(() => [...document.querySelectorAll('[role="dialog"] canvas')].some((element) => Number(element.dataset.drawCalls) > 0));
      await canvas.scrollIntoViewIfNeeded();
      if (process.env.GALLERY_CATALOG_VARIANTS && ['BATHROOM_VANITY', 'OTTOMAN'].includes(kind)) await dialog.getByRole('button', { name: 'Open storage', exact: true }).click();
      await page.waitForTimeout(1200);
      const filename = `${label}.png`;
      await canvas.screenshot({ path: path.join(output, filename) });
      captures.push({ kind, label, filename, dimensionsM: { width: config.widthM, height: config.heightM, depth: config.depthM }, panels: buildPanels(config, kind).length, canvas: await canvas.boundingBox(), pageErrors, apiRequests });
      console.log(`Captured ${kind}: ${captures.at(-1).panels} panels, ${pageErrors.length} page errors`);
    } finally { await context.close(); }
  }
  const cards = await Promise.all(captures.map(async ({ label, filename, dimensionsM }) => `<figure><img src="data:image/png;base64,${(await readFile(path.join(output, filename))).toString('base64')}" alt="${label}"><figcaption><b>${label.replaceAll('-', ' ').replaceAll('_', ' ')}</b><span>${dimensionsM.width} × ${dimensionsM.height} × ${dimensionsM.depth} m</span></figcaption></figure>`));
  const heading = process.env.GALLERY_VARIANTS || process.env.GALLERY_CATALOG_VARIANTS ? 'Showroom furniture · finishes and configurations' : `Showroom furniture · ${captures.length} types`;
  const html = `<!doctype html><html lang="en"><meta charset="utf-8"><title>${heading}</title><style>*{box-sizing:border-box}body{margin:0;padding:28px;background:#efeae2;color:#392c24;font:15px system-ui}h1{font:600 27px Georgia;margin:0 0 7px}p{margin:0 0 22px;color:#74675c}.grid{display:grid;grid-template-columns:1fr 1fr;gap:18px}figure{margin:0;border:1px solid #d9cdbf;border-radius:12px;overflow:hidden;background:#faf8f4}img{display:block;width:100%;height:270px;object-fit:contain;background:#faf8f4}figcaption{display:flex;justify-content:space-between;align-items:center;padding:12px 16px;border-top:1px solid #e5dbcf;font-size:13px}span{color:#74675c;font-size:12px}</style><h1>${heading}</h1><p>Native application WebGL captures · isolated guest fixtures · desktop Chromium</p><div class="grid">${cards.join('')}</div></html>`;
  await writeFile(path.join(output, 'contact-sheet.html'), html);
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 }, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: 'load' });
  await page.screenshot({ path: path.join(output, 'contact-sheet.png'), fullPage: true });
  await writeFile(path.join(output, 'capture-results.json'), JSON.stringify({ capturedAt: new Date().toISOString(), url, mode: `headless desktop Chromium; ${process.env.GALLERY_VARIANTS ? 'variant' : 'default'} single-piece editor; all APIs intercepted`, captures }, null, 2));
  console.log(`Contact sheet: ${path.join(output, 'contact-sheet.png')}`);
  if (captures.some((capture) => capture.pageErrors.length > 0)) process.exitCode = 1;
} finally { await browser.close(); }

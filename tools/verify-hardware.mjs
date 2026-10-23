// Verificare vizuala a feroneriei GLB (manere, picioare, balamale) pe
// /ro/dev/piece-3d si /ro/studio (pagini fara cont; API-ul e interceptat ca
// oaspete). Ruleaza Edge headless pe GPU (GTX 1070 via ANGLE d3d11) si
// salveaza capturi + results.json cu statusul GLB/Draco, instantele si erorile.
//   node tools/verify-hardware.mjs apps/frontend <output-dir> [base-url]
import { createRequire } from 'node:module';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';

const [frontendRoot, outputDir, baseUrl = 'http://localhost:3000'] = process.argv.slice(2);
if (!frontendRoot || !outputDir) throw new Error('usage: node tools/verify-hardware.mjs <frontend-root> <output-dir> [base-url]');
const require = createRequire(path.join(path.resolve(frontendRoot), 'package.json'));
const { chromium } = require('@playwright/test');
const { defaultPieceConfig, normalizePieceConfig, studioDraftDataSchema } = require('@marketplace/shared');
const repoRoot = path.resolve(frontendRoot, '../..');
await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({
  // Edge-ul din sistem: nu cere descarcarea Chromium-ului Playwright
  channel: process.env.PW_CHANNEL ?? 'msedge',
  headless: true,
  args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-webgl'],
});
const results = { baseUrl, renderer: null, pages: [], errors: [], failedResponses: [], assetResponses: [], pageErrors: [] };

const initScript = () => {
  for (const Constructor of [window.WebGLRenderingContext, window.WebGL2RenderingContext].filter(Boolean)) {
    for (const method of ['drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced']) {
      const original = Constructor.prototype[method];
      if (original) Constructor.prototype[method] = function (...args) {
        this.canvas.dataset.drawCalls = String(Number(this.canvas.dataset.drawCalls ?? 0) + 1);
        return original.apply(this, args);
      };
    }
  }
};

async function openPage(context, url, { blockAssets = false, studioFixture = null } = {}) {
  const page = await context.newPage();
  page.setDefaultTimeout(60_000);
  page.on('pageerror', (error) => results.pageErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') results.pageErrors.push(`${message.type()}: ${message.text()}`);
  });
  page.on('response', (response) => {
    const u = response.url().replace(baseUrl, '');
    if (/\/3d\/hardware\.glb|\/draco\//.test(u)) results.assetResponses.push({ url: u, status: response.status(), type: response.headers()['content-type'] });
    if (response.status() >= 400) results.failedResponses.push({ url: u, status: response.status() });
  });
  await page.route('**/api/v1/**', (route) => route.fulfill({ status: 401, contentType: 'application/json', body: '{"error":{"code":"UNAUTHORIZED","message":"Guest fixture"}}' }));
  if (blockAssets) await page.route('**/3d/hardware.glb', (route) => route.abort());
  await page.addInitScript(initScript);
  if (studioFixture) await page.addInitScript((data) => {
    localStorage.setItem('mm_studio_v3', JSON.stringify({ version: 3, state: { ...data, tutorialSeen: true, accountDraft: null, panelPos: null } }));
  }, studioFixture);
  await page.goto(`${baseUrl}${url}`, { waitUntil: 'domcontentloaded', timeout: 120_000 });
  await waitForFrame(page);
  return page;
}

async function waitForFrame(page) {
  await page.evaluate(() => document.querySelectorAll('canvas').forEach((element) => { element.dataset.drawCalls = '0'; }));
  await page.waitForFunction(() => [...document.querySelectorAll('canvas')].some((element) => Number(element.dataset.drawCalls) > 0));
}

async function selectKind(page, kind) {
  for (let attempt = 0; attempt < 3; attempt++) {
    await page.getByRole('button', { name: kind, exact: true }).click();
    const active = await page.waitForFunction((k) => [...document.querySelectorAll('button')].some((b) => b.textContent === k && b.className.includes('border-walnut')), kind, { timeout: 3_000 }).then(() => true, () => false);
    if (active) break;
  }
  await waitForFrame(page);
}

async function settle(page) {
  await page.evaluate(() => { window.__hardwareInstances = {}; });
  await page.waitForFunction(() => window.__hardwareAssets?.status === 'ready' || window.__hardwareAssets?.status === 'error');
  // asteapta un cadru cu instante sincronizate (sau renunta: fallback)
  await page.waitForFunction(() => Object.values(window.__hardwareInstances ?? {}).some((v) => v > 0), null, { timeout: 3_000 }).catch(() => null);
  await page.waitForTimeout(400);
}

async function selectHandleStyle(page, style, { legs = false } = {}) {
  if (legs) await page.getByRole('button', { name: 'Pe picioare', exact: true }).click();
  await page.getByRole('button', { name: 'Cu mâner', exact: true }).click();
  await page.getByRole('button', { name: style, exact: true }).click();
  await settle(page);
}

async function readState(page) {
  return page.evaluate(() => ({
    assets: window.__hardwareAssets, instances: window.__hardwareInstances,
    config: (() => { try { return JSON.parse(document.querySelector('pre')?.textContent ?? 'null'); } catch { return null; } })(),
  }));
}

async function record(label, extra, canvas, state) {
  const file = `${label}.png`;
  await canvas.screenshot({ path: path.join(outputDir, file) });
  results.pages.push({ label, file, ...extra, ...state });
  console.log(`Captured ${label}: assets=${state.assets?.status} instances=${JSON.stringify(state.instances)}`);
}

function studioFixture(base, pieces) {
  const placements = pieces.map((piece, i) => ({ id: `placement-${i}`, pieceId: piece.id, x: piece.x, z: piece.z ?? 0, rotation: piece.rotation ?? 0 }));
  const fixture = {
    version: 3, activeSceneId: 'gallery',
    pieces: Object.fromEntries(pieces.map((piece) => [piece.id, { id: piece.id, name: piece.kind, kind: piece.kind, config: piece.config, updatedAt: 0 }])),
    scenes: [{ ...base.scenes[0], id: 'gallery', name: 'Visual review', openings: [], placements }],
    house: { version: 1, floors: [{ id: 'ground', name: '1' }], roomTransforms: { gallery: { floorId: 'ground', x: 0, z: 0, rotation: 0 } }, connections: [] },
  };
  studioDraftDataSchema.parse(fixture);
  return fixture;
}

try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 1 });
  const page = await openPage(context, '/ro/dev/piece-3d');
  results.renderer = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
    if (!gl) return 'no-webgl';
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    return info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
  });
  console.log('WebGL renderer:', results.renderer);
  const canvas = () => page.locator('main canvas').first();

  // picioare + buton pe comoda; apoi celelalte stiluri (picioarele raman in config)
  await selectKind(page, 'DRESSER');
  await selectHandleStyle(page, 'Buton', { legs: true });
  await record('dresser-legs-knob', { kind: 'DRESSER', style: 'Buton', legs: true }, canvas(), await readState(page));
  for (const [kind, style, label] of [['DRESSER', 'Scoică', 'dresser-legs-shell'], ['DRESSER', 'Profil', 'dresser-legs-profile'], ['WARDROBE', 'Bară', 'wardrobe-bar'], ['NIGHTSTAND', 'Scoică', 'nightstand-shell']]) {
    await selectKind(page, kind);
    await selectHandleStyle(page, style);
    await record(label, { kind, style }, canvas(), await readState(page));
  }

  // usi: balamalele (cupa + brat + butuc) stau pe spatele usii si se rotesc cu ea
  await selectKind(page, 'SHOE_CABINET');
  await selectHandleStyle(page, 'Bară');
  await record('shoe-cabinet-bar', { kind: 'SHOE_CABINET', style: 'Bară' }, canvas(), await readState(page));
  let box = await canvas().boundingBox();
  await page.mouse.click(box.x + box.width * 0.42, box.y + box.height * 0.5);
  await page.waitForTimeout(900);
  await record('shoe-cabinet-door-open', { kind: 'SHOE_CABINET', style: 'Bară', open: true }, canvas(), await readState(page));

  // bufet pe picioare cu usi: picioare + manere + balamale in aceeasi piesa
  await selectKind(page, 'SIDEBOARD');
  await selectHandleStyle(page, 'Buton', { legs: true });
  box = await canvas().boundingBox();
  await page.mouse.click(box.x + box.width * 0.36, box.y + box.height * 0.55);
  await page.waitForTimeout(900);
  await record('sideboard-legs-door-open', { kind: 'SIDEBOARD', style: 'Buton', open: true, legs: true }, canvas(), await readState(page));

  // canapea: picioarele conice din catalog (finisajul picioarelor, scalate la 10 cm)
  await selectKind(page, 'SOFA');
  await settle(page);
  await record('sofa-legs', { kind: 'SOFA', legs: true }, canvas(), await readState(page));

  // un sertar deschis: butoanele urmeaza sertarul, picioarele raman pe loc
  await selectKind(page, 'DRESSER');
  await selectHandleStyle(page, 'Buton');
  box = await canvas().boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.55);
  await page.waitForTimeout(900);
  await record('dresser-legs-knob-open', { kind: 'DRESSER', style: 'Buton', open: true, legs: true }, canvas(), await readState(page));

  // snapshotul PNG de publicare (debounce 800 ms pe pagina de dev)
  await page.waitForTimeout(1500);
  const snapshot = await page.evaluate(() => window.__piece3dSnapshot ?? null);
  if (snapshot) {
    await writeFile(path.join(outputDir, 'dresser-legs-knob-snapshot.png'), Buffer.from(snapshot.split(',')[1], 'base64'));
    results.pages.push({ label: 'dresser-legs-knob-snapshot', file: 'dresser-legs-knob-snapshot.png', kind: 'DRESSER', style: 'Buton', snapshot: true });
    console.log('Captured dresser-legs-knob-snapshot (publish PNG)');
  }

  // viewerul read-only al firmelor (PieceViewer3dDialog) foloseste acelasi PieceCanvas
  await page.getByRole('button', { name: 'Deschide viewerul read-only (U4)', exact: true }).click();
  const dialogCanvas = page.locator('[role="dialog"] canvas').first();
  await dialogCanvas.waitFor();
  await page.waitForFunction(() => [...document.querySelectorAll('[role="dialog"] canvas')].some((element) => Number(element.dataset.drawCalls) > 0));
  await page.waitForTimeout(600);
  await record('viewer-dresser-legs-knob', { kind: 'DRESSER', style: 'Buton', viewer: true }, dialogCanvas, await readState(page));
  await page.keyboard.press('Escape');
  await context.close();

  // Studio: doua piese in camera, fiecare cu providerul ei de instante (finisaje diferite)
  const base = JSON.parse(await readFile(path.join(repoRoot, 'docs/implementation/house-demo-fixture.json'), 'utf8'));
  const dresser = normalizePieceConfig('DRESSER', { ...defaultPieceConfig('DRESSER'), legs: true, frontStyle: 'HANDLE', handleStyle: 'KNOB', finish: 'NUC' });
  const nightstand = normalizePieceConfig('NIGHTSTAND', { ...defaultPieceConfig('NIGHTSTAND'), frontStyle: 'HANDLE', handleStyle: 'SHELL' });
  const fixture = studioFixture(base, [
    { id: 'dresser', kind: 'DRESSER', config: dresser, x: -0.9, z: -1.2 },
    { id: 'nightstand', kind: 'NIGHTSTAND', config: nightstand, x: 0.9, z: -1.2 },
  ]);
  const studioContext = await browser.newContext({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 1 });
  const studio = await openPage(studioContext, '/ro/studio', { studioFixture: fixture });
  await settle(studio);
  // peretii intregi ascund piesele cand camera e in afara camerei: comuta
  // modul peretilor, roteste camera spre o vedere de sus si apropie
  await studio.getByRole('button', { name: 'Pereți întregi', exact: true }).click().catch(() => null);
  const roomCanvas = studio.locator('canvas').first();
  const roomBox = await roomCanvas.boundingBox();
  await studio.mouse.move(roomBox.x + roomBox.width / 2, roomBox.y + roomBox.height * 0.3);
  await studio.mouse.down();
  await studio.mouse.move(roomBox.x + roomBox.width / 2 + 140, roomBox.y + roomBox.height * 0.3 + 260, { steps: 12 });
  await studio.mouse.up();
  await studio.mouse.move(roomBox.x + roomBox.width / 2, roomBox.y + roomBox.height / 2);
  await studio.mouse.wheel(0, -500);
  await studio.waitForTimeout(800);
  await waitForFrame(studio);
  await studio.waitForTimeout(300);
  await record('studio-room', { studio: true, pieces: ['DRESSER legs+knob NUC', 'NIGHTSTAND shell'] }, roomCanvas, await readState(studio));
  await studioContext.close();

  // fallback: GLB-ul blocat → primitivele istorice (bare, cilindri, picioare conice procedurale)
  const fallbackContext = await browser.newContext({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 1 });
  const fallbackPage = await openPage(fallbackContext, '/ro/dev/piece-3d', { blockAssets: true });
  await selectKind(fallbackPage, 'DRESSER');
  await selectHandleStyle(fallbackPage, 'Scoică', { legs: true });
  await record('dresser-legs-shell-fallback', { kind: 'DRESSER', style: 'Scoică', fallback: true, legs: true }, fallbackPage.locator('main canvas').first(), await readState(fallbackPage));
  await fallbackContext.close();
} catch (error) {
  results.errors.push(String(error?.stack ?? error));
  console.error(error);
} finally {
  await writeFile(path.join(outputDir, 'results.json'), JSON.stringify(results, null, 2));
  const cards = await Promise.all(results.pages.map(async ({ label, file, instances, assets, snapshot, viewer, fallback, studio }) => {
    const note = snapshot ? 'snapshot PNG publicare' : Object.entries(instances ?? {}).filter(([, v]) => v > 0).map(([k, v]) => `${k}×${v}`).join(' · ') || `fără instanțe (${assets?.status ?? '?'}) → primitive`;
    const tag = viewer ? ' (viewer firmă)' : fallback ? ' (GLB blocat)' : studio ? ' (Studio)' : '';
    return `<figure><img src="data:image/png;base64,${(await readFile(path.join(outputDir, file))).toString('base64')}" alt="${label}"><figcaption><b>${label.replaceAll('-', ' ')}${tag}</b><span>${note}</span></figcaption></figure>`;
  }));
  const html = `<!doctype html><html lang="ro"><meta charset="utf-8"><title>Feronerie GLB · prototip</title><style>*{box-sizing:border-box}body{margin:0;padding:28px;background:#efeae2;color:#392c24;font:15px system-ui}h1{font:600 27px Georgia;margin:0 0 7px}p{margin:0 0 22px;color:#74675c}.grid{display:grid;grid-template-columns:1fr 1fr;gap:18px}figure{margin:0;border:1px solid #d9cdbf;border-radius:12px;overflow:hidden;background:#faf8f4}img{display:block;width:100%;height:300px;object-fit:contain;background:#faf8f4}figcaption{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:12px 16px;border-top:1px solid #e5dbcf;font-size:13px}span{color:#74675c;font-size:12px;text-align:right}</style><h1>Feronerie GLB din Blender · mânere, picioare, balamale</h1><p>Capturi WebGL native · ${results.renderer} · ${new Date().toISOString()}</p><div class="grid">${cards.join('')}</div></html>`;
  await writeFile(path.join(outputDir, 'contact-sheet.html'), html);
  const sheet = await browser.newPage({ viewport: { width: 1280, height: 1000 }, deviceScaleFactor: 1 });
  await sheet.setContent(html, { waitUntil: 'load' });
  await sheet.screenshot({ path: path.join(outputDir, 'contact-sheet.png'), fullPage: true });
  await browser.close();
  console.log('asset responses:', JSON.stringify(results.assetResponses));
  console.log('failed responses:', JSON.stringify(results.failedResponses));
  console.log('page errors:', results.pageErrors.length ? results.pageErrors.join('\n') : 'none');
  if (results.errors.length) process.exitCode = 1;
}

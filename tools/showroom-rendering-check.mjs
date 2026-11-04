import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';

const root = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(path.join(root, 'apps/frontend/package.json'));
const { chromium } = require('@playwright/test');
const { defaultPieceConfig } = require('@marketplace/shared');
const output = path.join(root, 'docs/implementation/screenshots/rendering-regression');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
page.setDefaultTimeout(45_000);
const errors = [], warnings = [], samples = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => {
  if (/Multiple instances of Three/i.test(message.text())) warnings.push(message.text());
  if (message.type() === 'error' && /WebGL|THREE|GL_INVALID|shader/i.test(message.text())) errors.push(message.text());
});
await page.route('**/api/v1/**', route => route.fulfill({ status: 401, json: { error: { code: 'UNAUTHORIZED' } } }));
const config = defaultPieceConfig('WARDROBE');
config.widthM = 1.2;
config.heightM = 1.8;
config.columns = [{ zones: [{ type: 'DOOR', fill: 'SHELVES', count: 3 }] }, { zones: [{ type: 'DOOR', fill: 'SHELVES', count: 3 }] }];
await page.addInitScript(config => {
  const scene = { id: 'test-room', name: 'Rendering check', room: { widthM: 4, depthM: 4, wallHeightM: 2.6, wallColor: 'VAR', floorColor: 'STEJAR' }, openings: [], placements: [] };
  localStorage.setItem('mm_studio_v3', JSON.stringify({ version: 3, state: { pieces: { test: { id: 'test', name: 'Render regression wardrobe', kind: 'WARDROBE', config, updatedAt: 0 } }, scenes: [scene], activeSceneId: scene.id, tutorialSeen: true } }));
  window.__gpu = [];
  const records = new WeakMap();
  function record(gl) {
    if (!records.has(gl)) {
      const entry = { id: window.__gpu.length, textures: new Set(), buffers: new Set(), createdTextures: 0, deletedTextures: 0, createdBuffers: 0, deletedBuffers: 0, lost: false };
      records.set(gl, entry); window.__gpu.push(entry);
      gl.canvas.dataset.gpuId = entry.id;
      gl.canvas.addEventListener('webglcontextlost', () => { entry.lost = true; entry.textures.clear(); entry.buffers.clear(); });
    }
    return records.get(gl);
  }
  for (const Constructor of [WebGLRenderingContext, WebGL2RenderingContext]) {
    for (const [suffix, plural] of [['Texture', 'textures'], ['Buffer', 'buffers']]) {
      const create = Constructor.prototype[`create${suffix}`], remove = Constructor.prototype[`delete${suffix}`];
      Constructor.prototype[`create${suffix}`] = function(...args) { const value = create.apply(this, args), data = record(this); if (value) { data[plural].add(value); data[`created${suffix}s`]++; } return value; };
      Constructor.prototype[`delete${suffix}`] = function(value) { const data = record(this); if (data[plural].delete(value)) data[`deleted${suffix}s`]++; return remove.call(this, value); };
    }
  }
}, config);
const sample = async id => page.evaluate(id => { const value = window.__gpu[id]; return { ...value, textures: value.textures.size, buffers: value.buffers.size }; }, id);
try {
  await page.goto('http://127.0.0.1:3100/en/studio');
  await page.waitForFunction(() => document.querySelector('canvas')?.dataset.gpuId !== undefined);
  await page.getByRole('button', { name: 'Furniture', exact: true }).click();
  const edit = page.getByRole('button', { name: 'Edit', exact: true }).first();
  for (let mount = 0; mount < 2; mount++) {
    await edit.click();
    const dialog = page.getByRole('dialog');
    const canvas = dialog.locator('canvas');
    await canvas.waitFor({ state: 'visible' });
    await page.waitForFunction(() => document.querySelector('[role=dialog] canvas')?.dataset.gpuId !== undefined);
    const id = Number(await canvas.getAttribute('data-gpu-id'));
    for (let cycle = 0; cycle < 4; cycle++) {
      for (const finish of ['Oak', 'White', 'Walnut']) {
        await dialog.getByTitle(finish, { exact: true }).click();
        const width = dialog.getByRole('spinbutton', { name: 'Width', exact: true });
        await width.fill(finish === 'White' ? '140' : '120'); await width.blur();
        await page.waitForTimeout(350);
      }
      await page.waitForTimeout(700);
      samples.push({ mount, cycle, ...await sample(id) });
    }
    const stable = samples.filter(value => value.mount === mount && value.cycle > 0);
    assert.ok(Math.max(...stable.map(v => v.textures)) - Math.min(...stable.map(v => v.textures)) <= 2, 'Live texture count must plateau after warmup');
    assert.ok(Math.max(...stable.map(v => v.buffers)) - Math.min(...stable.map(v => v.buffers)) <= 8, 'Live buffer count must plateau after warmup');
    await canvas.scrollIntoViewIfNeeded();
    const box = await canvas.boundingBox();
    await canvas.screenshot({ path: path.join(output, `closed-door-${mount}.png`) });
    await canvas.click({ position: { x: box.width * .42, y: box.height * .48 } });
    await dialog.getByText(/^Column \d+ · zone \d+$/).waitFor({ state: 'visible' });
    await page.waitForTimeout(900);
    await canvas.screenshot({ path: path.join(output, `asymmetric-door-${mount}.png`) });
    await canvas.click({ position: { x: box.width * .42, y: box.height * .48 } });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(500);
    await canvas.screenshot({ path: path.join(output, `narrow-editor-${mount}.png`) });
    await dialog.getByRole('button', { name: 'Close', exact: true }).click();
    await page.waitForFunction(id => window.__gpu[id].lost, id, { timeout: 15_000 });
    samples.push({ mount, closed: true, ...await sample(id) });
    assert.equal(samples.at(-1).textures, 0);
    assert.equal(samples.at(-1).buffers, 0);
    await page.setViewportSize({ width: 1440, height: 1100 });
  }
  assert.deepEqual(errors, []);
  assert.deepEqual(warnings, [], 'No duplicate Three.js runtime instance warnings');
  console.log('PASS: two editor lifecycles, repeated finish/dimension edits, bounded live resources, released contexts, no WebGL shader errors.');
} finally {
  await writeFile(path.join(output, 'results.json'), JSON.stringify({ checkedAt: new Date().toISOString(), samples, errors, warnings, note: 'Native resource instrumentation, not timing benchmark. Context loss releases outstanding GPU resources; counts do not establish physical GPU byte usage.' }, null, 2));
  await browser.close();
}

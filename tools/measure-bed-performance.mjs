import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(`${repo}/apps/frontend/package.json`);
const { chromium } = require('@playwright/test');
const { defaultPieceConfig, normalizePieceConfig, buildPanels } = require('@marketplace/shared');
const output = path.resolve(process.argv[2] ?? path.join(repo, 'docs/implementation/performance/bed-cost.json'));
await mkdir(path.dirname(output), { recursive: true });
const results = [];
const cases = [
  ['default', {}],
  ['upholstered', { bed: { mattressSize: 'K_180', storage: 'LIFT_UP', upholstered: true } }],
  ['drawers', { bed: { mattressSize: 'Q_160', storage: 'DRAWERS', upholstered: false } }],
];

function instrumentation(config) {
  const scene = { id: 'bed-cost', name: 'Bed cost fixture', room: { widthM: 4, depthM: 4, wallHeightM: 2.6, wallColor: 'VAR', floorColor: 'STEJAR' }, openings: [], placements: [{ id: 'bed-placement', pieceId: 'bed', x: 0, z: 0, rotation: 0 }] };
  localStorage.setItem('mm_studio_v3', JSON.stringify({ version: 3, state: { pieces: { bed: { id: 'bed', name: 'Bed measurement', kind: 'BED', config, updatedAt: 0 } }, scenes: [scene], activeSceneId: scene.id, tutorialSeen: true, accountDraft: null, house: { version: 1, floors: [{ id: 'ground', name: 'Ground' }], roomTransforms: { 'bed-cost': { floorId: 'ground', x: 0, z: 0, rotation: 0 } }, connections: [] } } }));
  window.__bedCost = { renderers: [], contexts: [] };
  const states = new WeakMap();
  const stateFor = gl => {
    if (!states.has(gl)) {
      const debug = gl.getExtension('WEBGL_debug_renderer_info');
      const metrics = { buffers: 0, bufferBytes: 0, textures: 0, totalDraws: 0, lost: false, gpu: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER) };
      const state = { metrics, sizes: new Map(), textures: new Set(), bindings: new Map() };
      states.set(gl, state); window.__bedCost.contexts.push(metrics);
      gl.canvas.addEventListener('webglcontextlost', () => { metrics.lost = true; });
    }
    return states.get(gl);
  };
  for (const Constructor of [window.WebGLRenderingContext, window.WebGL2RenderingContext].filter(Boolean)) {
    const p = Constructor.prototype;
    for (const name of ['drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced']) {
      if (!p[name]) continue;
      const original = p[name]; p[name] = function (...args) { stateFor(this).metrics.totalDraws++; return original.apply(this, args); };
    }
    const create = p.createBuffer; p.createBuffer = function (...args) { const b = create.apply(this, args); const s = stateFor(this); if (b) { s.sizes.set(b, 0); s.metrics.buffers++; } return b; };
    const bind = p.bindBuffer; p.bindBuffer = function (target, b) { stateFor(this).bindings.set(target, b); return bind.call(this, target, b); };
    const data = p.bufferData; p.bufferData = function (target, value, ...rest) { const s = stateFor(this), b = s.bindings.get(target); if (b) { const bytes = typeof value === 'number' ? value : value?.byteLength ?? 0; s.metrics.bufferBytes += bytes - (s.sizes.get(b) ?? 0); s.sizes.set(b, bytes); } return data.call(this, target, value, ...rest); };
    const remove = p.deleteBuffer; p.deleteBuffer = function (b) { const s = stateFor(this); if (s.sizes.has(b)) { s.metrics.buffers--; s.metrics.bufferBytes -= s.sizes.get(b); s.sizes.delete(b); } return remove.call(this, b); };
    const createTexture = p.createTexture; p.createTexture = function (...args) { const t = createTexture.apply(this, args), s = stateFor(this); if (t) { s.textures.add(t); s.metrics.textures++; } return t; };
    const deleteTexture = p.deleteTexture; p.deleteTexture = function (t) { const s = stateFor(this); if (s.textures.delete(t)) s.metrics.textures--; return deleteTexture.call(this, t); };
  }
  window.__THREE_DEVTOOLS__ = new EventTarget();
  window.__THREE_DEVTOOLS__.addEventListener('observe', event => {
    const renderer = event.detail;
    if (!renderer.isWebGLRenderer) return;
    const record = { id: window.__bedCost.renderers.length, renderer, mainRenders: 0, otherRenders: 0, samples: [], state: () => stateFor(renderer.getContext()).metrics };
    window.__bedCost.renderers.push(record);
    const original = renderer.render;
    renderer.render = function (scene, camera) {
      const main = scene.isScene && camera.isPerspectiveCamera && !scene.overrideMaterial;
      const result = original.call(this, scene, camera);
      if (main) {
        record.scene = scene; record.camera = camera; record.mainRenders++;
        record.samples.push({ calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, lines: renderer.info.render.lines });
        if (record.samples.length > 120) record.samples.shift();
      } else record.otherRenders++;
      return result;
    };
  });
}

const browser = await chromium.launch({ headless: true });
try {
  for (const [label, overrides] of cases.filter(([label]) => !process.env.BED_COST_CASE || process.env.BED_COST_CASE === label)) {
    const config = normalizePieceConfig('BED', { ...defaultPieceConfig('BED'), ...overrides });
    const panels = buildPanels(config, 'BED');
    const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 1 });
    try {
      const page = await context.newPage(); page.setDefaultTimeout(60_000);
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      page.on('console', m => { if (m.type() === 'error' && /WebGL|THREE|shader/i.test(m.text())) errors.push(m.text()); });
      await page.route('**/api/v1/**', r => r.fulfill({ status: 401, json: { error: { code: 'UNAUTHORIZED', message: 'Fixture' } } }));
      await page.addInitScript(instrumentation, config);
      await page.goto('http://127.0.0.1:3100/en/studio', { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => window.__bedCost.renderers.some(r => r.camera));
      const measure = async (surface, canvas, inDialog) => {
        await canvas.scrollIntoViewIfNeeded();
        await page.waitForTimeout(1300);
        const id = await page.evaluate(inDialog => {
          const r = window.__bedCost.renderers.find(r => r.camera && r.renderer.domElement.isConnected && !!r.renderer.domElement.closest('[role=dialog]') === inDialog);
          if (!r) throw new Error('Missing renderer');
          r.renderer.shadowMap.autoUpdate = false;
          r.renderer.shadowMap.needsUpdate = false;
          r.samples = [];
          return r.id;
        }, inDialog);
        const beforeOrbit = await page.evaluate(id => ({ other: window.__bedCost.renderers[id].otherRenders }), id);
        const box = await canvas.boundingBox();
        await page.mouse.move(box.x + box.width * 0.86, box.y + box.height * 0.27);
        await page.mouse.down();
        await page.mouse.move(box.x + box.width * 0.8, box.y + box.height * 0.3, { steps: 18 });
        await page.mouse.up();
        await page.waitForTimeout(250);
        const beforeIdle = await page.evaluate(id => ({ main: window.__bedCost.renderers[id].mainRenders, other: window.__bedCost.renderers[id].otherRenders, draws: window.__bedCost.renderers[id].state().totalDraws }), id);
        await page.waitForTimeout(700);
        const measurement = await page.evaluate(({ id, beforeOrbit, beforeIdle }) => {
          const r = window.__bedCost.renderers[id];
          let meshes = 0;
          r.scene.traverse(o => { if (o.isMesh) meshes++; });
          return { samples: r.samples, meshes, gpu: { ...r.state() }, rendererMemory: { ...r.renderer.info.memory }, shaderPrograms: r.renderer.info.programs.length, idleMainRenders: r.mainRenders - beforeIdle.main, idleOtherRenders: r.otherRenders - beforeIdle.other, idleGpuDraws: r.state().totalDraws - beforeIdle.draws, extraShadowOrBlurRendersDuringOrbit: beforeIdle.other - beforeOrbit.other };
        }, { id, beforeOrbit, beforeIdle });
        const row = { label, surface, config, panels: panels.length, motionComponents: panels.filter(p => p.motion).length, ...measurement, errors: [...errors] };
        results.push(row);
        await writeFile(output, JSON.stringify({ measuredAt: new Date().toISOString(), methodology: 'Local Next dev; 1440x1100 DPR1 desktop Chromium; guest fixture; directional shadows cached for steady orbit; contact shadow settled. Draws/triangles are per renderer.info main render; GPU buffer bytes are tracked uploads, not total GPU memory. Idle window 700ms. No frame-rate claim.', results }, null, 2));
        console.log(JSON.stringify({ label, surface, samples: row.samples.length, first: row.samples[0], last: row.samples.at(-1), memory: row.rendererMemory, buffers: row.gpu.buffers, bufferBytes: row.gpu.bufferBytes, gpuTextures: row.gpu.textures, idleRenders: row.idleMainRenders, idleDraws: row.idleGpuDraws, extraPasses: row.extraShadowOrBlurRendersDuringOrbit, errors }));
      };
      await page.getByRole('button', { name: 'Wall display', exact: true }).click();
      await measure('room-overview', page.locator('canvas').first(), false);
      await page.getByRole('button', { name: 'Furniture', exact: true }).click();
      await page.getByRole('button', { name: 'Edit', exact: true }).first().click();
      const dialog = page.getByRole('dialog', { name: 'Edit piece', exact: true });
      const canvas = dialog.locator('canvas'); await canvas.waitFor();
      await page.waitForFunction(() => window.__bedCost.renderers.some(r => r.camera && r.renderer.domElement.closest('[role=dialog]')));
      await measure('detail-closed', canvas, true);
      if (label === 'drawers') {
        await dialog.getByRole('button', { name: 'Open drawers', exact: true }).click();
        await measure('detail-open', canvas, true);
      }
      if (process.env.BED_COST_LIFECYCLE === '1') {
        const resources = () => page.evaluate(() => {
          const r = window.__bedCost.renderers.find(r => r.camera && r.renderer.domElement.isConnected && r.renderer.domElement.closest('[role=dialog]'));
          const s = r.state();
          return { id: r.id, buffers: s.buffers, bufferBytes: s.bufferBytes, textures: s.textures };
        });
        const baseline = await resources(), edits = [];
        for (let cycle = 0; cycle < 2; cycle++) {
          for (const size of ['S_90', 'K_180', config.bed.mattressSize]) {
            await dialog.getByRole('combobox', { name: 'What mattress size?', exact: true }).selectOption(size);
            await page.waitForTimeout(1100);
          }
          const current = await resources();
          assert.deepEqual(current, baseline, 'Bed graphics resources grew after a resize cycle');
          edits.push(current);
        }
        await dialog.getByRole('button', { name: 'Close', exact: true }).click();
        await page.waitForFunction(id => window.__bedCost.renderers[id].state().buffers === 0, baseline.id);
        const closed = await page.evaluate(id => ({ ...window.__bedCost.renderers[id].state() }), baseline.id);
        await writeFile(output.replace(/\.json$/, `-${label}-lifecycle.json`), JSON.stringify({ baseline, edits, closed }, null, 2));
        console.log(`PASS ${label}: graphics allocations stable after six size changes; buffers released on close`);
      }
      if (errors.length) throw new Error(errors.join('\n'));
    } finally { await context.close(); }
  }
} finally { await browser.close(); }
console.log(`Saved ${output}`);

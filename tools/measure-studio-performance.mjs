import { createRequire } from 'node:module';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Rulare separata fata de build/test: NEXT dev trebuie pornit pe portul 3100.
const root = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(path.join(root, 'apps/frontend/package.json'));
const { chromium, devices } = require('@playwright/test');
const { studioDraftDataSchema, buildPanels } = require('@marketplace/shared');
const small = JSON.parse(await readFile(path.join(root, 'docs/implementation/house-demo-fixture.json'), 'utf8'));
const large = structuredClone(small);
large.scenes = Array.from({ length: 12 }, (_, i) => ({
  id: `room-${i}`, name: `Room ${i + 1}`, room: { ...small.scenes[0].room, widthM: 8, depthM: 8 }, openings: [],
  placements: Array.from({ length: i < 2 ? 5 : 4 }, (_, p) => ({ id: `placement-${i}-${p}`, pieceId: ['bed', 'table', 'bench', 'nightstand', 'nightstand'][p], x: [-2, 2, -2, 2, 0][p], z: [-2, -2, 2, 2, 2][p], rotation: 0 })),
}));
large.activeSceneId = 'room-0';
large.house.connections = [];
large.house.roomTransforms = Object.fromEntries(large.scenes.map((s, i) => [s.id, { floorId: 'ground', x: i % 4 * 8.09, z: Math.floor(i / 4) * 8.09, rotation: 0 }]));
studioDraftDataSchema.parse(small); studioDraftDataSchema.parse(large);
const output = path.join(root, 'docs/implementation/performance');
const reportName = process.env.PERF_REPORT ?? 'measurements';
await mkdir(output, { recursive: true });
await writeFile(path.join(output, 'large-house-fixture.json'), JSON.stringify(large, null, 2));

function instrumentation() {
  const metrics = window.__studioPerf = { contexts: [], frames: [], measuring: false };
  for (const Constructor of [window.WebGLRenderingContext, window.WebGL2RenderingContext].filter(Boolean)) {
    const p = Constructor.prototype, states = new WeakMap();
    const stateFor = (gl) => {
      if (!states.has(gl)) { const debug = gl.getExtension('WEBGL_debug_renderer_info'); const s = { renderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER), calls: 0, submittedVertices: 0, liveBuffers: 0, bufferBytes: 0, createdBuffers: 0, deletedBuffers: 0, liveTextures: 0, createdTextures: 0, deletedTextures: 0, lost: false }; states.set(gl, { s, sizes: new Map(), bindings: new Map(), textures: new Set() }); metrics.contexts.push(s); gl.canvas.addEventListener('webglcontextlost', () => { s.lost = true; }); }
      return states.get(gl);
    };
    for (const name of ['drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced']) {
      if (!p[name]) continue;
      const original = p[name]; p[name] = function (...args) { const { s } = stateFor(this); s.calls++; s.submittedVertices += Number(args[name.includes('Arrays') ? 2 : 1]) * (name.includes('Instanced') ? Number(args.at(-1)) : 1); return original.apply(this, args); };
    }
    const create = p.createBuffer; p.createBuffer = function (...args) { const value = create.apply(this, args), { s, sizes } = stateFor(this); if (value) { sizes.set(value, 0); s.liveBuffers++; s.createdBuffers++; } return value; };
    const bind = p.bindBuffer; p.bindBuffer = function (target, buffer) { stateFor(this).bindings.set(target, buffer); return bind.call(this, target, buffer); };
    const data = p.bufferData; p.bufferData = function (target, value, ...rest) { const { s, sizes, bindings } = stateFor(this), b = bindings.get(target); if (b) { const bytes = typeof value === 'number' ? value : value?.byteLength ?? 0; s.bufferBytes += bytes - (sizes.get(b) ?? 0); sizes.set(b, bytes); } return data.call(this, target, value, ...rest); };
    const remove = p.deleteBuffer; p.deleteBuffer = function (value) { const { s, sizes } = stateFor(this); if (sizes.has(value)) { s.liveBuffers--; s.deletedBuffers++; s.bufferBytes -= sizes.get(value); sizes.delete(value); } return remove.call(this, value); };
    const createTexture = p.createTexture; p.createTexture = function (...args) { const value = createTexture.apply(this, args), { s, textures } = stateFor(this); if (value) { textures.add(value); s.liveTextures++; s.createdTextures++; } return value; };
    const deleteTexture = p.deleteTexture; p.deleteTexture = function (value) { const { s, textures } = stateFor(this); if (textures.delete(value)) { s.liveTextures--; s.deletedTextures++; } return deleteTexture.call(this, value); };
  }
  let last = performance.now(), lastCalls = 0;
  function frame(now) { const calls = metrics.contexts.reduce((n, s) => n + s.calls, 0); if (metrics.measuring) metrics.frames.push({ ms: now - last, calls: calls - lastCalls }); last = now; lastCalls = calls; requestAnimationFrame(frame); }
  requestAnimationFrame(frame);
}

const percentile = (numbers, p) => [...numbers].sort((a, b) => a - b)[Math.min(numbers.length - 1, Math.floor(numbers.length * p))] ?? null;
const browser = await chromium.launch({ headless: true });
const results = [];
try {
  for (const [device, options] of [['desktop', { viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 }], ['mobile-emulation', devices['Pixel 7']]]) {
    if (process.env.PERF_DEVICE && device !== process.env.PERF_DEVICE) continue;
    for (const [fixtureName, fixture] of [['small-2-rooms-5-placements', small], ['large-12-rooms-50-placements', large]]) {
      if (process.env.PERF_FIXTURE && !fixtureName.startsWith(process.env.PERF_FIXTURE)) continue;
      console.log(`Starting ${device} ${fixtureName}`);
      const context = await browser.newContext(options), page = await context.newPage();
      page.setDefaultTimeout(45_000); const pageErrors = [];
      page.on('pageerror', (e) => pageErrors.push(e.message));
      await page.route('**/api/v1/**', (route) => route.fulfill({ status: 401, contentType: 'application/json', body: '{"error":{"code":"UNAUTHORIZED","message":"Guest"}}' }));
      await page.addInitScript(instrumentation);
      await page.addInitScript((data) => localStorage.setItem('mm_studio_v3', JSON.stringify({ version: 3, state: { ...data, tutorialSeen: true, accountDraft: null, panelPos: null } })), fixture);
      await page.goto(process.env.STUDIO_URL ?? 'http://127.0.0.1:3100/en/studio', { waitUntil: 'domcontentloaded', timeout: 60_000 });
      await page.getByRole('button', { name: 'Whole-house 3D cutaway', exact: true }).waitFor();
      const state = await page.evaluate(() => JSON.parse(localStorage.getItem('mm_studio_v3')).state);
      if (state.scenes.length !== fixture.scenes.length) throw new Error('Hydration fixture mismatch');
      const clickStart = Date.now();
      await page.getByRole('button', { name: 'Whole-house 3D cutaway', exact: true }).click();
      await page.locator('canvas').nth(1).waitFor();
      await page.waitForFunction(() => window.__studioPerf.contexts.filter((c) => c.calls > 0).length >= 2);
      const firstDrawMs = Date.now() - clickStart;
      await page.waitForTimeout(1500);
      const canvas = page.locator('canvas').first(); await canvas.scrollIntoViewIfNeeded();
      const box = await canvas.boundingBox();
      await page.evaluate(() => { window.__studioPerf.frames = []; window.__studioPerf.measuring = true; });
      await page.mouse.move(box.x + box.width * 0.4, box.y + box.height * 0.55); await page.mouse.down();
      for (let i = 0; i < 90; i++) { await page.mouse.move(box.x + box.width * (0.4 + 0.15 * Math.sin(i / 12)), box.y + box.height * (0.55 + 0.1 * Math.sin(i / 20))); await page.waitForTimeout(16); }
      await page.mouse.up();
      const sample = await page.evaluate(() => { const m = window.__studioPerf; m.measuring = false; return { ...m, heapBytes: performance.memory?.usedJSHeapSize ?? null, resources: performance.getEntriesByType('resource').map((r) => ({ name: r.name, transferSize: r.transferSize, decodedBodySize: r.decodedBodySize })), userAgent: navigator.userAgent, navigation: performance.getEntriesByType('navigation')[0].toJSON() }; });
      const activeFrames = sample.frames.filter((f) => f.calls > 0);
      const beforeUnmount = sample.contexts;
      await page.getByRole('button', { name: 'Floor plan', exact: true }).click(); await page.waitForTimeout(1800);
      const afterUnmount = await page.evaluate(() => window.__studioPerf.contexts);
      const row = { device, fixtureName, rooms: fixture.scenes.length, placements: fixture.scenes.reduce((n, s) => n + s.placements.length, 0), furniturePanels: fixture.scenes.reduce((n, s) => n + s.placements.reduce((a, p) => a + buildPanels(fixture.pieces[p.pieceId].config, fixture.pieces[p.pieceId].kind).length, 0), 0), firstDrawMs, observedFrames: sample.frames.length, activeFrames: activeFrames.length, activeFrameMsP50: percentile(activeFrames.map((f) => f.ms), .5), activeFrameMsP95: percentile(activeFrames.map((f) => f.ms), .95), drawCallsPerFrameP95: percentile(activeFrames.map((f) => f.calls), .95), heapBytes: sample.heapBytes, resourceTransferBytes: sample.resources.reduce((n, r) => n + r.transferSize, 0), resourceDecodedBytes: sample.resources.reduce((n, r) => n + r.decodedBodySize, 0), navigation: sample.navigation, beforeUnmount, afterUnmount, pageErrors, userAgent: sample.userAgent };
      results.push(row); console.log(JSON.stringify(row));
      await writeFile(path.join(output, `${reportName}.json`), JSON.stringify({ measuredAt: new Date().toISOString(), environment: 'Next dev server; headless Chromium; mobile viewport/touch/DPR emulation, not physical device; no CPU throttling; rAF submission cadence, not GPU timestamps', beforeBaseline: 'Unavailable: no pre-change instrumented capture', results }, null, 2));
      await context.close();
    }
  }
} finally { await browser.close(); }

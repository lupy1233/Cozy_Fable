import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';

const root = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(path.join(root, 'apps/frontend/package.json'));
const { chromium } = require('@playwright/test');
const { buildPanels, defaultPieceConfig, normalizePieceConfig } = require('@marketplace/shared');
const output = path.join(root, 'docs/implementation/screenshots/3d-mechanics');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const results = [];
let activePage;
const cases = [
  ['BED', 'bed-drawers', { bed: { mattressSize: 'Q_160', storage: 'DRAWERS', upholstered: false } }],
  ['DRESSER', 'dresser-drawers', {}],
  ['WARDROBE', 'wardrobe-sliding', { doorMode: 'SLIDING', frontStyle: 'HANDLE' }],
  ['SHOE_CABINET', 'hinged-doors', { frontStyle: 'HANDLE' }],
  ['BATHROOM_VANITY', 'vanity-drawers', {}],
  ['BATHROOM_VANITY', 'vanity-doors', { vanity: { mounting: 'WALL', basins: 'SINGLE', storage: 'DOORS', handles: 'HANDLE', countertop: 'LIGHT' } }],
  ['ENTRYWAY', 'entryway-doors', { entryway: { hooks: 4, mirror: 'RIGHT', upperShelf: true, upholsteredSeat: true, shoeStorage: 'DOORS' } }],
  ['OTTOMAN', 'ottoman-lid', { ottoman: { shape: 'ROUND', storage: true } }],
];

try {
  for (const [kind, label, override] of cases.filter(([kind]) => !process.env.MECHANICS_KIND || process.env.MECHANICS_KIND.split(',').includes(kind))) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
    const page = await context.newPage();
    activePage = page;
    page.setDefaultTimeout(60_000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error' && /THREE|WebGL|shader/i.test(message.text())) errors.push(message.text()); });
    await page.route('**/api/v1/**', route => route.fulfill({ status: 401, json: { error: { code: 'UNAUTHORIZED' } } }));
    const config = normalizePieceConfig(kind, { ...defaultPieceConfig(kind), ...override });
    const catalogStorage = ['BATHROOM_VANITY', 'ENTRYWAY', 'OTTOMAN'].includes(kind);
    await page.addInitScript(({ config, kind }) => {
      const scene = { id: 'mechanics', name: 'Mechanics', room: { widthM: 4, depthM: 4, wallHeightM: 2.6, wallColor: 'VAR', floorColor: 'STEJAR' }, openings: [], placements: [{ id: 'p1', pieceId: 'piece', x: 0, z: 0, rotation: 0 }] };
      localStorage.setItem('mm_studio_v3', JSON.stringify({ version: 3, state: { pieces: { piece: { id: 'piece', name: kind, kind, config, updatedAt: 0 } }, scenes: [scene], activeSceneId: scene.id, tutorialSeen: true,
        house: { version: 1, floors: [{ id: 'ground', name: '1' }], roomTransforms: { mechanics: { floorId: 'ground', x: 0, z: 0, rotation: 0 } }, connections: [] } } }));
      window.__renderers = [];
      window.__THREE_DEVTOOLS__ = new EventTarget();
      window.__THREE_DEVTOOLS__.addEventListener('observe', event => {
        const renderer = event.detail;
        if (!renderer.isWebGLRenderer) return;
        const record = { id: window.__renderers.length, renderer, camera: null, scene: null, samples: [] };
        window.__renderers.push(record);
        const original = renderer.render;
        renderer.render = function(scene, camera) {
          if (scene.isScene && camera.isPerspectiveCamera && !scene.overrideMaterial) {
            record.camera = camera; record.scene = scene;
            const motions = [];
            scene.traverse(object => { if (object.userData.openProgress !== undefined) motions.push({ name: object.name, progress: object.userData.openProgress, position: object.position.toArray(), rotation: object.rotation.toArray().slice(0, 3) }); });
            record.samples.push({ time: performance.now(), motions });
            if (record.samples.length > 300) record.samples.shift();
          }
          return original.call(this, scene, camera);
        };
      });
    }, { config, kind });
    await page.goto('http://127.0.0.1:3100/en/studio', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__renderers.some(r => r.camera));
    await page.getByRole('button', { name: 'Furniture', exact: true }).click();
    console.log(`${label}: studio loaded`);
    await page.getByRole('button', { name: 'Edit', exact: true }).first().click();
    const dialog = page.getByRole('dialog', { name: 'Edit piece', exact: true });
    const canvas = dialog.locator('canvas');
    await canvas.waitFor();
    console.log(`${label}: editor canvas mounted`);
    await page.waitForFunction(() => window.__renderers.some(r => r.camera && r.renderer.domElement.closest('[role=dialog]')));
    await canvas.scrollIntoViewIfNeeded();
    await page.waitForTimeout(1000);
    const pose = () => page.evaluate(() => { const r = window.__renderers.find(r => r.renderer.domElement.closest('[role=dialog]')); return { position: r.camera.position.toArray(), quaternion: r.camera.quaternion.toArray() }; });
    const settleCamera = () => page.waitForFunction(() => {
      const r = window.__renderers.find(r => r.renderer.domElement.closest('[role=dialog]'));
      const value = r.camera.position.toArray().concat(r.camera.quaternion.toArray());
      if (r.previousPose && value.every((v, i) => Math.abs(v - r.previousPose[i]) < 1e-7)) r.stableFrames = (r.stableFrames ?? 0) + 1;
      else r.stableFrames = 0;
      r.previousPose = value;
      return r.stableFrames >= 5;
    }, null, { timeout: 60_000 });
    const rotate = async () => {
      const b = await canvas.boundingBox();
      await page.mouse.move(b.x + b.width * .6, b.y + b.height * .45);
      await page.mouse.down(); await page.mouse.move(b.x + b.width * .55, b.y + b.height * .48, { steps: 16 }); await page.mouse.up();
      await settleCamera();
    };
    await rotate();
    console.log(`${label}: orbit gesture finished`);
    const before = await pose();
    if (catalogStorage) {
      if (kind === 'OTTOMAN') await dialog.getByRole('combobox', { name: 'Upholstery texture', exact: true }).selectOption('BOUCLE');
      else await dialog.getByRole('combobox', { name: 'Visual finish', exact: true }).selectOption('NUC');
      const width = dialog.getByRole('spinbutton', { name: /^Width/ });
      await width.fill(String(Math.round((config.widthM + .1) * 100))); await width.blur();
    }
    else if (kind === 'BED') await dialog.getByRole('combobox').last().selectOption('NUC');
    else {
      await dialog.getByTitle('Walnut', { exact: true }).click();
      const width = dialog.getByRole('spinbutton', { name: 'Width', exact: true });
      await width.fill(String(Math.round((config.widthM + .1) * 100))); await width.blur();
    }
    await page.waitForTimeout(600);
    const after = await pose();
    for (const key of ['position', 'quaternion']) assert.ok(before[key].every((value, index) => Math.abs(value - after[key][index]) < 1e-5), `${label} ${key} changed after configuration edit`);
    await canvas.screenshot({ path: path.join(output, `${label}-closed.png`) });
    await page.waitForTimeout(1500);
    await page.evaluate(() => { const r = window.__renderers.find(r => r.renderer.domElement.closest('[role=dialog]')); r.samples = []; });
    if (catalogStorage) await dialog.getByRole('button', { name: 'Open storage', exact: true }).click();
    else if (kind === 'BED') await dialog.getByRole('button', { name: 'Open drawers', exact: true }).click();
    else {
      // Raycast the visible model after the camera-retention gesture.
      const b = await canvas.boundingBox();
      await canvas.click({ position: { x: b.width * .5, y: b.height * .55 } });
    }
    await page.waitForTimeout(1100);
    await page.waitForFunction(() => {
      const r = window.__renderers.find(r => r.renderer.domElement.closest('[role=dialog]'));
      return r.samples.at(-1)?.motions.some(m => m.progress === 1);
    }, null, { timeout: 15_000 });
    await canvas.screenshot({ path: path.join(output, `${label}-open.png`) });
    const animation = await page.evaluate(() => { const r = window.__renderers.find(r => r.renderer.domElement.closest('[role=dialog]')); return r.samples; });
    assert.ok(animation.some(sample => sample.motions.some(m => m.progress > 0 && m.progress < 1)), `${label} has no intermediate animation frames`);
    assert.ok(animation.some(sample => sample.motions.some(m => m.progress === 1)), `${label} did not open fully`);
    if (kind === 'BED') {
      await dialog.getByRole('button', { name: 'Close drawers', exact: true }).click();
      await page.waitForTimeout(120);
      await dialog.getByRole('button', { name: 'Open drawers', exact: true }).click();
      await page.waitForTimeout(650);
      const tray = buildPanels(config, kind).find(panel => panel.motion?.key === 'bed:drawer:R:0' && panel.h === .012 && panel.surface !== 'METAL');
      assert.ok(tray, 'derived drawer tray is missing');
      const trayPoint = await page.evaluate(({ x, y, z }) => {
        const r = window.__renderers.find(r => r.renderer.domElement.closest('[role=dialog]'));
        const group = r.scene.getObjectByName('furniture-motion:bed:drawer:R:0');
        const point = group.localToWorld(group.position.clone().set(x, y, z)).project(r.camera);
        return { x: (point.x + 1) * r.renderer.domElement.clientWidth / 2, y: (1 - point.y) * r.renderer.domElement.clientHeight / 2 };
      }, tray);
      await canvas.click({ position: trayPoint });
      await page.waitForFunction(() => {
        const r = window.__renderers.find(r => r.renderer.domElement.closest('[role=dialog]'));
        return r.scene.getObjectByName('furniture-motion:bed:drawer:R:0').userData.openProgress === 0;
      });
      await canvas.screenshot({ path: path.join(output, 'bed-drawer-tray-click.png') });
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await canvas.scrollIntoViewIfNeeded();
    await page.waitForTimeout(700);
    await canvas.screenshot({ path: path.join(output, `${label}-mobile.png`) });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    if (kind === 'BED' && process.env.MECHANICS_SKIP_HOUSE !== '1') {
      await page.setViewportSize({ width: 1440, height: 1100 });
      await dialog.getByRole('button', { name: 'Close', exact: true }).click();
      const scenePoses = () => page.evaluate(() => window.__renderers.filter(r => r.camera && r.renderer.domElement.isConnected).map(r => ({ id: r.id, position: r.camera.position.toArray(), quaternion: r.camera.quaternion.toArray() })));
      await page.getByRole('button', { name: 'Room', exact: true }).click();
      const beforeRoom = await scenePoses();
      await page.getByRole('button', { name: 'Floor: NUC', exact: true }).click();
      const roomWidth = page.getByRole('complementary', { name: 'Room settings', exact: true }).getByRole('spinbutton', { name: 'Width (cm)', exact: true });
      await roomWidth.fill('450'); await roomWidth.blur();
      await page.waitForTimeout(600);
      assert.deepEqual(await scenePoses(), beforeRoom, 'Room camera changed after floor or dimension edit');
      await page.getByRole('button', { name: 'House', exact: true }).click();
      await page.getByRole('button', { name: 'Whole-house 3D', exact: true }).click();
      await page.waitForFunction(() => window.__renderers.filter(r => r.camera && r.renderer.domElement.isConnected).length === 2);
      const surface = page.locator('canvas').last();
      await surface.scrollIntoViewIfNeeded();
      const b = await surface.boundingBox();
      await page.mouse.move(b.x + b.width * .9, b.y + b.height * .25);
      await page.mouse.down(); await page.mouse.move(b.x + b.width * .85, b.y + b.height * .3, { steps: 8 }); await page.mouse.up();
      await page.waitForTimeout(600);
      const beforeScene = await scenePoses();
      await page.getByRole('button', { name: 'Expand house tools', exact: true }).click();
      const roomX = page.getByLabel('Room X position (m)', { exact: true });
      await roomX.fill('1'); await roomX.blur();
      await page.waitForTimeout(700);
      assert.deepEqual(await scenePoses(), beforeScene, 'Room/house camera changed or Canvas remounted after floor/dimension/house-position edit');
      assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('mm_studio_v3')).state.scenes[0].room.floorColor), 'NUC');
      await page.getByRole('heading', { name: 'Your house layout', exact: true }).scrollIntoViewIfNeeded();
      await page.screenshot({ path: path.join(output, 'house-floor-camera-preserved.png') });
      console.log('PASS room + house: floor, room dimensions and house layout preserve both camera objects and poses');
    }
    assert.deepEqual(errors, []);
    results.push({ kind, label, cameraPreserved: true, errors, animation });
    console.log(`PASS ${label}: camera retained; intermediate and settled motion; mobile; no rendering errors`);
    await context.close();
  }
} catch (error) {
  console.error(error);
  if (activePage && !activePage.isClosed()) {
    await activePage.screenshot({ path: path.join(output, 'failure.png'), fullPage: true });
    await writeFile(path.join(output, 'failure.txt'), await activePage.locator('body').innerText());
  }
  process.exitCode = 1;
} finally {
  const suffix = process.env.MECHANICS_KIND ? `-${process.env.MECHANICS_KIND.toLowerCase().replaceAll(',', '-')}` : '';
  await writeFile(path.join(output, `results${suffix}.json`), JSON.stringify(results, null, 2));
  await browser.close();
}

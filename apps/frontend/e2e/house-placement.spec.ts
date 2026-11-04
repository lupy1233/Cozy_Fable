import { expect, test, type Locator, type Page } from '@playwright/test';
import type { StudioDraftData } from '@marketplace/shared';
import en from '../src/messages/en.json';

const fixture: StudioDraftData = {
  version: 3,
  pieces: {},
  scenes: [
    { id: 'study', name: 'Study', room: { widthM: 2, depthM: 4, wallHeightM: 2.6, wallColor: 'VAR', floorColor: 'STEJAR' }, placements: [], openings: [] },
    { id: 'living', name: 'Living room', room: { widthM: 4, depthM: 4, wallHeightM: 2.6, wallColor: 'VAR', floorColor: 'STEJAR' }, placements: [], openings: [] },
  ],
  activeSceneId: 'study',
  house: {
    version: 1,
    floors: [{ id: 'ground', name: '1' }],
    roomTransforms: {
      study: { floorId: 'ground', x: 0, z: 0, rotation: 0 },
      living: { floorId: 'ground', x: 3.59, z: 0, rotation: 0 },
    },
    connections: [],
  },
};

async function state(page: Page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('mm_studio_v3')!).state as StudioDraftData & { cutawayWalls: boolean });
}

async function housePlan(page: Page) {
  await page.getByRole('button', { name: en.Studio.workspace.house, exact: true }).click();
  const plan = page.getByRole('group', { name: en.Studio.house.plan, exact: true });
  await expect(plan).toBeVisible();
  return plan;
}

async function worldPoint(plan: Locator, x: number, z: number) {
  return plan.evaluate((element, point) => {
    const matrix = (element as SVGSVGElement).getScreenCTM();
    if (!matrix) throw new Error('House plan has no screen transform');
    const result = new DOMPoint(point.x, point.z).matrixTransform(matrix);
    return { x: result.x, y: result.y };
  }, { x, z });
}

async function pointer(page: Page, plan: Locator, isMobile: boolean) {
  const touch = isMobile ? await page.context().newCDPSession(page) : null;
  const start = await worldPoint(plan, 0, 0);
  if (touch) await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...start, id: 1 }] });
  else { await page.mouse.move(start.x, start.y); await page.mouse.down(); }
  return {
    move: async (x: number, z: number) => {
      const position = await worldPoint(plan, x, z);
      if (touch) await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ ...position, id: 1 }] });
      else await page.mouse.move(position.x, position.y, { steps: 4 });
    },
    finish: async () => {
      if (touch) { await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await touch.detach(); }
      else await page.mouse.up();
    },
    cancel: async () => {
      if (touch) { await touch.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] }); await touch.detach(); }
      else {
        await plan.dispatchEvent('pointercancel', { pointerId: 1, pointerType: 'mouse', isPrimary: true });
        await page.mouse.up();
      }
    },
  };
}

test.beforeEach(async ({ page }) => {
  test.setTimeout(120_000);
  await page.route('**/api/v1/**', (route) => route.fulfill({ status: 401, json: { error: { code: 'UNAUTHORIZED', message: 'Guest test' } } }));
  await page.addInitScript((data) => {
    if (!localStorage.getItem('mm_studio_v3')) {
      localStorage.setItem('mm_studio_v3', JSON.stringify({ version: 3, state: { ...data, tutorialSeen: true, accountDraft: null, panelPos: null } }));
    }
  }, fixture);
  await page.goto('/en/studio', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('canvas').first()).toBeVisible({ timeout: 60_000 });
});

test('invalid room position, rotation and dimensions preserve the layout and redo', async ({ page }) => {
  await housePlan(page);
  await page.getByRole('button', { name: en.Studio.workspace.expandHouseTools, exact: true }).click();
  const z = page.getByLabel(en.Studio.house.positionZ, { exact: true });
  const x = page.getByLabel(en.Studio.house.positionX, { exact: true });
  const undo = page.getByRole('button', { name: 'Undo', exact: true });
  const redo = page.getByRole('button', { name: 'Redo', exact: true });
  await z.fill('1');
  await z.blur();
  await expect.poll(async () => (await state(page)).house!.roomTransforms.study.z).toBe(1);
  await undo.click();
  await expect(z).toHaveValue('0');
  await expect(redo).toBeEnabled();

  const baseline = await state(page);
  await x.fill('2.5');
  await x.blur();
  await expect(x).toHaveValue('0');
  expect((await state(page)).house).toEqual(baseline.house);
  await expect(undo).toBeDisabled();
  await expect(redo).toBeEnabled();

  await page.getByRole('button', { name: en.Studio.house.rotate, exact: true }).click();
  expect((await state(page)).house).toEqual(baseline.house);
  const width = page.getByLabel(en.Studio.house.roomWidth, { exact: true });
  await width.fill('3.4');
  await width.blur();
  await expect(width).toHaveValue('2');
  expect((await state(page)).scenes).toEqual(baseline.scenes);
  await expect(undo).toBeDisabled();
  await expect(redo).toBeEnabled();
  await redo.click();
  await expect(z).toHaveValue('1');
  await undo.click();
  await expect(z).toHaveValue('0');
});

test('room drag previews snap before one commit and cancellation preserves redo', async ({ page, isMobile }, info) => {
  const plan = await housePlan(page);
  const room = plan.getByRole('button', { name: 'Study', exact: true });
  const roomRect = room.locator('rect').first();
  await room.focus();
  await room.press('Enter');
  await expect(room).toBeFocused();
  expect(await room.evaluate((element) => {
    const style = getComputedStyle(element);
    return style.outlineStyle === 'none' || style.outlineWidth === '0px' || style.outlineColor === 'rgba(0, 0, 0, 0)';
  })).toBe(true);
  const focusRect = room.locator('rect[vector-effect="non-scaling-stroke"]');
  await expect(focusRect).toHaveCSS('vector-effect', 'non-scaling-stroke');
  await expect(focusRect).toHaveAttribute('stroke-width', '2');
  await page.screenshot({ path: info.outputPath('keyboard-focus.png') });
  const baseline = (await state(page)).house;
  const drag = await pointer(page, plan, isMobile);
  await drag.move(0.44, 0);
  await expect(plan.locator('[data-house-snap-point]').first()).toBeVisible();
  await expect.poll(async () => Number(await roomRect.getAttribute('x'))).toBeCloseTo(-0.5, 6);
  await page.screenshot({ path: info.outputPath('snap-preview.png') });
  expect((await state(page)).house).toEqual(baseline);
  await drag.move(2.5, 0);
  await expect(roomRect).toHaveAttribute('data-drag-blocked', 'true');
  await expect(plan.locator('..').getByRole('status')).toHaveText(en.Studio.house.moveBlocked);
  await expect(plan.locator('[data-house-snap-point]')).toHaveCount(0);
  await expect.poll(async () => Number(await roomRect.getAttribute('x'))).toBeCloseTo(-0.5, 6);
  expect((await state(page)).house).toEqual(baseline);
  if (isMobile) {
    const status = (await plan.locator('..').getByRole('status').boundingBox())!;
    const tabs = (await page.getByRole('button', { name: en.Studio.house.plan, exact: true }).boundingBox())!;
    const dock = (await page.getByRole('button', { name: en.Studio.workspace.wallMode, exact: true }).boundingBox())!;
    expect(status.y).toBeGreaterThan(tabs.y + tabs.height);
    expect(status.y + status.height).toBeLessThan(dock.y);
  }
  await page.screenshot({ path: info.outputPath('blocked-preview.png') });
  await drag.finish();
  expect(await page.evaluate(() => window.getSelection()?.toString())).toBe('');
  await expect.poll(async () => (await state(page)).house!.roomTransforms.study.x).toBeCloseTo(0.5, 6);
  await expect(plan.locator('[data-house-snap-point]')).toHaveCount(0);
  const undo = page.getByRole('button', { name: 'Undo', exact: true });
  const redo = page.getByRole('button', { name: 'Redo', exact: true });
  await undo.click();
  expect((await state(page)).house).toEqual(baseline);
  await expect(undo).toBeDisabled();
  await expect(redo).toBeEnabled();
  await redo.click();
  await expect.poll(async () => (await state(page)).house!.roomTransforms.study.x).toBeCloseTo(0.5, 6);
  await undo.click();

  const cancelled = await pointer(page, plan, isMobile);
  await cancelled.move(0, 0.8);
  await expect.poll(async () => Number(await roomRect.getAttribute('y'))).toBeCloseTo(-1.2, 6);
  await cancelled.cancel();
  await expect.poll(async () => Number(await roomRect.getAttribute('y'))).toBe(-2);
  expect((await state(page)).house).toEqual(baseline);
  await expect(undo).toBeDisabled();
  await expect(redo).toBeEnabled();
});

test('wall display preference survives both reloads and room or whole-house views', async ({ page }) => {
  const roomCanvas = page.locator('canvas').first();
  const mode = (canvas: Locator) => canvas.locator('xpath=ancestor::*[@data-wall-mode][1]');
  const toggle = page.getByRole('button', { name: en.Studio.workspace.wallMode, exact: true });
  await expect(mode(roomCanvas)).toHaveAttribute('data-wall-mode', 'full');
  await toggle.click();
  await expect(mode(roomCanvas)).toHaveAttribute('data-wall-mode', 'cutaway');
  await expect.poll(async () => (await state(page)).cutawayWalls).toBe(true);
  const originalRoomCanvas = await roomCanvas.elementHandle();
  await housePlan(page);
  await page.getByRole('button', { name: en.Studio.house['3d'], exact: true }).click();
  const houseCanvas = page.locator('canvas').nth(1);
  await expect(houseCanvas).toBeVisible({ timeout: 30_000 });
  await expect(mode(houseCanvas)).toHaveAttribute('data-wall-mode', 'cutaway');
  const originalHouseCanvas = await houseCanvas.elementHandle();
  await page.getByRole('button', { name: en.Studio.workspace.house, exact: true }).click();
  await expect(roomCanvas).toBeVisible();
  expect(await originalRoomCanvas!.evaluate((element) => element.isConnected)).toBe(true);
  await expect(mode(roomCanvas)).toHaveAttribute('data-wall-mode', 'cutaway');
  await page.getByRole('button', { name: en.Studio.workspace.house, exact: true }).click();
  await expect(houseCanvas).toBeVisible();
  expect(await originalHouseCanvas!.evaluate((element) => element.isConnected)).toBe(true);

  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(roomCanvas).toBeVisible({ timeout: 60_000 });
  await expect(mode(roomCanvas)).toHaveAttribute('data-wall-mode', 'cutaway');
  await toggle.click();
  await expect.poll(async () => (await state(page)).cutawayWalls).toBe(false);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(roomCanvas).toBeVisible({ timeout: 60_000 });
  await expect(mode(roomCanvas)).toHaveAttribute('data-wall-mode', 'full');
  await housePlan(page);
  await page.getByRole('button', { name: en.Studio.house['3d'], exact: true }).click();
  await expect(houseCanvas).toBeVisible({ timeout: 30_000 });
  await expect(mode(houseCanvas)).toHaveAttribute('data-wall-mode', 'full');
});

import { expect, test } from '@playwright/test';
import fixture from '../../../docs/implementation/house-demo-fixture.json';

test('cancelled palette drags do not add openings and expanded selection stays in the workspace', async ({ page }) => {
  test.setTimeout(120_000);
  await page.route('**/api/v1/**', (route) => route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: { code: 'UNAUTHORIZED', message: 'Guest' } }) }));
  await page.addInitScript((data) => {
    localStorage.setItem('mm_studio_v3', JSON.stringify({ version: 3, state: { ...data, tutorialSeen: true, accountDraft: null, panelPos: null } }));
  }, fixture);
  await page.goto('/en/studio', { waitUntil: 'domcontentloaded' });
  const workspace = page.getByTestId('studio-workspace');
  await expect(page.locator('canvas').first()).toBeVisible({ timeout: 60_000 });
  await page.getByRole('button', { name: 'Room', exact: true }).click();
  const opening = page.getByRole('button', { name: 'Window', exact: true });
  await opening.scrollIntoViewIfNeeded();
  const countOpenings = () => page.evaluate(() => JSON.parse(localStorage.getItem('mm_studio_v3')!).state.scenes[0].openings.length as number);
  const before = await countOpenings();
  const icon = (await opening.boundingBox())!;
  const x = icon.x + icon.width / 2, y = icon.y + icon.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 15, y, { steps: 3 });
  await page.mouse.move(x, y, { steps: 3 });
  await page.mouse.up();
  await expect.poll(countOpenings).toBe(before);
  await expect(page.getByRole('complementary', { name: 'Room settings', exact: true })).toBeVisible();
  await opening.press('Enter');
  await expect.poll(countOpenings).toBe(before + 1);

  const minimize = page.getByRole('button', { name: 'Minimize selection tools', exact: true });
  await expect(minimize).toBeVisible();
  await minimize.click();
  await expect(page.getByRole('complementary', { name: 'Room settings', exact: true })).toBeVisible();
  await opening.press('Enter');
  await expect.poll(countOpenings).toBe(before + 2);
  const expand = page.getByRole('button', { name: 'Expand selection tools', exact: true });
  await expect(expand).toBeVisible();
  if (page.viewportSize()!.width < 1024) {
    const tools = (await page.getByRole('complementary', { name: 'Room settings', exact: true }).boundingBox())!;
    const selection = (await expand.locator('../..').boundingBox())!;
    expect(tools.y + tools.height).toBeLessThan(selection.y);
  }
  await page.getByRole('button', { name: 'Hide tools', exact: true }).click();
  await page.getByRole('button', { name: 'Show tools', exact: true }).click();
  await expect(expand).toBeVisible();
  await expect(page.getByRole('complementary', { name: 'Room settings', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Minimize panel', exact: true }).click();
  const grip = page.getByRole('button', { name: /^Drag to move the panel/ });
  const gripBounds = (await grip.boundingBox())!;
  const area = (await workspace.boundingBox())!;
  await page.mouse.move(gripBounds.x + gripBounds.width / 2, gripBounds.y + gripBounds.height / 2);
  await page.mouse.down();
  await page.mouse.move(area.x + area.width - 16, area.y + area.height - 95, { steps: 8 });
  await page.mouse.up();
  await page.getByRole('button', { name: 'Expand selection tools', exact: true }).click();
  await expect(minimize).toBeVisible();
  await expect.poll(async () => {
    const panel = (await grip.locator('..').boundingBox())!;
    return panel.x + panel.width <= area.x + area.width - 2 && panel.y + panel.height <= area.y + area.height - 76;
  }).toBe(true);

  const canvas = page.locator('canvas').first();
  const originalCanvas = await canvas.elementHandle();
  const originalBounds = (await canvas.boundingBox())!;
  await page.getByRole('button', { name: 'Fullscreen', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Exit fullscreen', exact: true })).toBeVisible();
  expect(await originalCanvas!.evaluate((element) => element.isConnected)).toBe(true);
  await expect.poll(async () => (await canvas.boundingBox())!.height).toBeGreaterThan(originalBounds.height);
  await page.getByRole('button', { name: 'Exit fullscreen', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Fullscreen', exact: true })).toBeVisible();
  expect(await originalCanvas!.evaluate((element) => element.isConnected)).toBe(true);
  await expect.poll(() => canvas.boundingBox()).toEqual(originalBounds);
});

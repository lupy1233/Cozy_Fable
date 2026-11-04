import { expect, test } from '@playwright/test';

test('all furniture keeps working controls and snapshots after visual refinements', async ({ page }, info) => {
  test.setTimeout(180_000);
  page.setDefaultTimeout(15_000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error' && /WebGL|THREE|shader/i.test(message.text())) errors.push(message.text()); });
  await page.route('**/api/v1/**', route => route.fulfill({ status: 401, json: { error: { code: 'UNAUTHORIZED' } } }));
  await page.goto('/en/dev/piece-3d');
  const config = async () => JSON.parse((await page.locator('pre').textContent())!);
  const canvas = page.locator('canvas').first();
  await expect(page.locator('pre')).toContainText('widthM', { timeout: 30_000 });

  for (const kind of ['BOOKCASE', 'WARDROBE', 'TV_UNIT', 'SHOE_CABINET', 'DRESSER', 'NIGHTSTAND', 'DESK']) {
    await page.getByRole('button', { name: kind, exact: true }).press('Enter');
    await expect(canvas).toBeVisible();
    for (const label of ['Width', 'Height', 'Depth']) {
      const slider = page.getByRole('slider', { name: label, exact: true });
      for (const [key, attribute] of [['End', 'max'], ['Home', 'min']]) {
        const target = Number(await slider.getAttribute(attribute)) / 100;
        await slider.press(key);
        await expect.poll(async () => (await config())[`${label.toLowerCase()}M`]).toBeCloseTo(target, 3);
      }
    }
    await page.getByRole('button', { name: 'With handle', exact: true }).press('Enter');
    await expect.poll(async () => (await config()).frontStyle).toBe('HANDLE');
    await page.getByTitle('Walnut', { exact: true }).press('Space');
    await expect.poll(async () => (await config()).finish).toBe('NUC');
  }

  await page.getByRole('button', { name: 'BED', exact: true }).press('Enter');
  await page.getByRole('combobox', { name: 'What mattress size?', exact: true }).selectOption('S_90');
  await expect.poll(async () => (await config()).widthM).toBe(1.03);
  await page.getByRole('checkbox', { name: 'Upholstered bed?', exact: true }).press('Space');
  await expect.poll(async () => (await config()).widthM).toBe(1.12);
  await page.getByRole('combobox', { name: 'What mattress size?', exact: true }).selectOption('K_180');
  await expect.poll(async () => (await config()).widthM).toBe(2.02);
  await page.getByRole('combobox', { name: 'Storage under the bed?', exact: true }).selectOption('DRAWERS');
  await page.getByRole('combobox', { name: 'Visual finish', exact: true }).selectOption('VERDE_SALVIE');
  await page.getByRole('button', { name: 'Open drawers', exact: true }).press('Enter');
  await expect(page.getByRole('button', { name: 'Close drawers', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Close drawers', exact: true }).press('Enter');

  await page.getByRole('button', { name: 'TABLE', exact: true }).press('Enter');
  const tableChoices = page.getByRole('combobox');
  await tableChoices.nth(1).selectOption('ROUND');
  const diameter = page.getByRole('spinbutton');
  await diameter.fill('70'); await diameter.press('Tab');
  await expect.poll(async () => [(await config()).widthM, (await config()).depthM]).toEqual([.7, .7]);
  await diameter.fill('180'); await diameter.press('Tab');
  await expect.poll(async () => [(await config()).widthM, (await config()).depthM]).toEqual([1.8, 1.8]);
  await tableChoices.nth(1).selectOption('EXTENDABLE');
  await expect.poll(async () => (await config()).table.shape).toBe('EXTENDABLE');

  await page.getByRole('button', { name: 'BENCH', exact: true }).press('Enter');
  await page.getByRole('combobox').first().selectOption('WITH_SHOE_SPACE');
  const benchWidth = page.getByRole('spinbutton');
  await benchWidth.fill('60'); await benchWidth.press('Tab');
  await expect.poll(async () => (await config()).widthM).toBe(.6);
  await benchWidth.fill('200'); await benchWidth.press('Tab');
  await expect.poll(async () => (await config()).widthM).toBe(2);
  await page.getByRole('checkbox').press('Space');
  await expect.poll(async () => (await config()).bench.upholsteredSeat).toBe(true);
  await expect(page.getByRole('img', { name: 'snapshot', exact: true })).toHaveAttribute('src', /^data:image\/png;base64,/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  await canvas.screenshot({ path: `test-results/furniture-quality-${info.project.name}.png` });
  expect(errors).toEqual([]);
});

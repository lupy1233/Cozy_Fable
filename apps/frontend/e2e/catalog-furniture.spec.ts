import { expect, test } from '@playwright/test';

test('seven new pieces expose working dimension and option controls on desktop and mobile', async ({ page }) => {
  test.setTimeout(240_000);
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', e => { if (e.type() === 'error' && /WebGL|THREE|shader|MISSING_MESSAGE/.test(e.text())) errors.push(e.text()); });
  await page.route('**/api/v1/**', route => route.fulfill({ status: 401, json: { error: { code: 'UNAUTHORIZED' } } }));
  await page.goto('/en/dev/piece-3d');
  await expect(page.locator('pre')).toContainText('widthM', { timeout: 30_000 });
  const config = async () => JSON.parse((await page.locator('pre').textContent())!);
  const select = (name: string, value: string) => page.getByRole('combobox', { name, exact: true }).selectOption(value);
  for (const kind of ['SIDEBOARD', 'WALL_CABINET', 'BATHROOM_VANITY', 'ENTRYWAY', 'SOFA', 'ARMCHAIR', 'OTTOMAN']) {
    await page.getByRole('button', { name: kind, exact: true }).press('Enter');
    await expect(page.locator('canvas').first()).toBeVisible();
    for (const label of ['Width', 'Height', ...(kind === 'SOFA' ? ['Main body depth'] : ['Depth'])]) {
      const slider = page.getByRole('slider', { name: label, exact: true });
      for (const key of ['End', 'Home']) {
        await slider.press(key);
        const n = Number(await slider.getAttribute(key === 'End' ? 'max' : 'min')) / 100;
        await expect.poll(async () => label === 'Main body depth' ? (await config()).sofa.bodyDepthM : (await config())[`${label.toLowerCase()}M`]).toBeCloseTo(n, 3);
      }
    }
    if (kind === 'WALL_CABINET') {
      await page.getByRole('slider', { name: 'Height above floor (bottom of cabinet)', exact: true }).press('End');
      await expect.poll(async () => (await config()).mountingHeightM).toBe(2.2);
    }
    if (kind === 'BATHROOM_VANITY') {
      await select('Basins', 'DOUBLE'); await expect.poll(async () => (await config()).widthM).toBe(1.2);
      await select('Mounting', 'FLOOR'); await expect.poll(async () => (await config()).heightM).toBe(0.8);
      await select('Storage layout', 'DOORS'); await select('Opening style', 'HANDLE');
      await page.getByRole('button', { name: 'Open storage', exact: true }).press('Enter');
      await expect(page.getByRole('button', { name: 'Close storage', exact: true })).toBeVisible();
      await select('Countertop finish', 'DARK');
    }
    if (kind === 'ENTRYWAY') {
      await select('Coat hooks', '6'); await select('Mirror', 'LEFT'); await select('Shoe storage', 'DOORS');
      await page.getByRole('checkbox', { name: 'Upper shelf', exact: true }).press('Space');
      await expect.poll(async () => (await config()).entryway).toMatchObject({ hooks: 6, mirror: 'LEFT', shoeStorage: 'DOORS', upperShelf: false });
    }
    if (kind === 'SOFA') {
      await select('Seats', '4'); await select('Arms', 'WIDE');
      await select('Seat cushions', 'BENCH'); await select('Sofa layout', 'CHAISE_LEFT');
      await expect.poll(async () => (await config()).sofa.cushions).toBe('SPLIT');
      await page.getByRole('slider', { name: 'Overall chaise depth', exact: true }).press('End');
      await expect.poll(async () => (await config()).depthM).toBe(2);
      await select('Sofa layout', 'CHAISE_RIGHT'); await select('Sofa layout', 'STRAIGHT');
      await expect.poll(async () => (await config()).depthM).toBe(0.8);
    }
    if (kind === 'ARMCHAIR') await select('Arms', 'WIDE');
    if (kind === 'OTTOMAN') {
      await select('Shape', 'ROUND'); await expect.poll(async () => (await config()).depthM).toBe(0.4);
      await page.getByRole('checkbox', { name: 'Storage under the seat', exact: true }).press('Space');
      await page.getByRole('button', { name: 'Open storage', exact: true }).press('Enter');
    }
    if (['SOFA', 'ARMCHAIR', 'OTTOMAN'].includes(kind)) {
      await select('Upholstery texture', 'BOUCLE'); await select('Cushion firmness preference', 'SOFT'); await select('Legs / base', 'BLACK');
      await expect.poll(async () => (await config()).upholstery).toMatchObject({ fabric: 'BOUCLE', firmness: 'SOFT', base: 'BLACK' });
    }
    await expect(page.getByRole('img', { name: 'snapshot', exact: true })).toHaveAttribute('src', /^data:image\/png;base64,/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  }
  expect(errors).toEqual([]);
});

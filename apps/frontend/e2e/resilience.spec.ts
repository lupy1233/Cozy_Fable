import { expect, test } from '@playwright/test';
import fixture from '../../../docs/implementation/house-demo-fixture.json';
import en from '../src/messages/en.json';

test('quota failure is announced without deleting the saved house', async ({ page }) => {
  test.setTimeout(90_000);
  await page.route('**/api/v1/**', route => route.fulfill({ status: 401, json: { error: { code: 'UNAUTHORIZED' } } }));
  await page.addInitScript(data => {
    localStorage.setItem('mm_studio_v3', JSON.stringify({ version: 3, state: { ...data, tutorialSeen: true } }));
    const setItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key: string, value: string) {
      if (key === 'mm_studio_v3') throw new DOMException('Synthetic quota', 'QuotaExceededError');
      return setItem.call(this, key, value);
    };
  }, fixture);
  await page.goto('/en/studio');
  // uneltele casei sunt ascunse implicit: deschide planul casei si extinde panoul
  await page.getByRole('button', { name: 'House', exact: true }).click();
  await page.getByRole('button', { name: 'Expand house tools', exact: true }).click();
  const width = page.getByLabel('Door width (m)', { exact: true });
  await width.fill('1.1'); await width.blur();
  await expect(page.getByRole('alert').filter({ hasText: en.Studio.house.persistenceError })).toBeVisible();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('mm_studio_v3')!).state);
  expect(saved.scenes).toEqual(fixture.scenes);
  expect(saved.house).toEqual(fixture.house);
});

test('unavailable WebGL retains the editable house plan instead of crashing', async ({ page }) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/api/v1/**', route => route.fulfill({ status: 401, json: { error: { code: 'UNAUTHORIZED' } } }));
  await page.addInitScript(data => {
    localStorage.setItem('mm_studio_v3', JSON.stringify({ version: 3, state: { ...data, tutorialSeen: true } }));
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(this: HTMLCanvasElement, type: string, ...args: unknown[]) {
      if (/webgl|experimental-webgl/.test(type)) return null;
      return original.apply(this, [type, ...args] as never);
    } as typeof original;
  }, fixture);
  await page.goto('/en/studio');
  await expect(page.getByText(en.Studio.roomViewer.webglMissing, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'House', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your house layout', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Whole-house 3D', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Expand house tools', exact: true }).click();
  await expect(page.getByLabel('Door width (m)', { exact: true })).toBeEnabled();
  const drafts = page.getByRole('button', { name: 'My drafts', exact: true });
  await drafts.focus();
  await drafts.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'My drafts', exact: true });
  await expect(dialog).toBeVisible();
  for (let index = 0; index < 5; index++) {
    await page.keyboard.press('Tab');
    expect(await dialog.evaluate(element => element.contains(document.activeElement))).toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(drafts).toBeFocused();
  await page.setViewportSize({ width: 320, height: 720 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  expect(errors).toEqual([]);
});

test('slow failed publication prevents duplicates, focuses its error, and preserves the draft', async ({ page }) => {
  test.setTimeout(90_000);
  let publishes = 0;
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/v1/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/publish')) {
      publishes++;
      await pending;
      return route.fulfill({ status: 503, json: { error: { code: 'GENERIC', message: 'Synthetic outage' } } });
    }
    return route.fulfill({ json: path.endsWith('/auth/me') ? { user: { id: 'test-user', role: 'CLIENT', emailVerified: true } } : path.includes('/requests/drafts/') ? { id: 'test-draft', attachments: [], configuratorState: null } : [] });
  });
  await page.addInitScript(() => {
    localStorage.setItem('mm_draft_token', 'test-only-draft');
    localStorage.setItem('mm_configurator_v1', JSON.stringify({ version: 0, state: {
      phase: 'review', startMode: 'DESIGN_HELP', activeRoomIndex: 0, activeStepIndex: 0,
      roomInstances: [{ localId: 'bedroom-test', roomType: 'BEDROOM', flowVersion: 2, answers: {}, completed: false }],
      details: { budgetRange: 'UNDISCLOSED', includesPaidDesign: true, addressText: 'Synthetic address', city: 'Cluj-Napoca', county: 'Cluj', country: 'RO', contactPreferences: [{ channel: 'EMAIL', value: 'demo@example.test' }] },
      inspirationPhotoIds: [], updatedAt: Date.now(),
    } }));
  });
  await page.goto('/en/requests/new');
  await page.getByRole('button', { name: en.Configurator.resume.continue, exact: true }).click();
  const publish = page.getByRole('button', { name: en.Requests.publish, exact: true });
  await publish.click();
  await expect(publish).toBeDisabled();
  await expect(page.getByRole('status')).toBeVisible();
  expect(publishes).toBe(1);
  release();
  const error = page.getByRole('alert').filter({ hasText: en.Configurator.apiErrors.GENERIC });
  await expect(error).toBeFocused();
  await expect(publish).toBeEnabled();
  expect(publishes).toBe(1);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('mm_configurator_v1')!).state);
  expect(saved.roomInstances[0].localId).toBe('bedroom-test');
  expect(saved.details.budgetRange).toBe('UNDISCLOSED');
  expect(saved.phase).toBe('review');
});

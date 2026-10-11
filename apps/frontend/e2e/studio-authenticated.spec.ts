import { expect, test } from '@playwright/test';
import fixture from '../../../docs/implementation/house-demo-fixture.json';

// Real local authentication only; traces disabled to avoid recording session headers.
test.use({ trace: 'off' });
test('guest Studio survives real login and account draft save/load', async ({ page, baseURL }, info) => {
  test.skip(process.env.RUN_LOCAL_STUDIO_AUTH !== '1' || info.project.name !== 'desktop', 'Explicit local authenticated opt-in required');
  test.setTimeout(120_000);
  expect(['localhost', '127.0.0.1']).toContain(new URL(baseURL!).hostname);
  expect(process.env.DEMO_PASSWORD).toBeTruthy();
  await page.addInitScript((data) => {
    if (!sessionStorage.getItem('auth-fixture-seeded')) {
      localStorage.setItem('mm_studio_v3', JSON.stringify({ version: 3, state: { ...data, tutorialSeen: true, accountDraft: null, panelPos: null } }));
      sessionStorage.setItem('auth-fixture-seeded', '1');
    }
  }, fixture);
  await page.goto('/en/studio', { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('studio-workspace')).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('canvas').first()).toBeVisible({ timeout: 60_000 });
  const draftsButton = page.getByRole('button', { name: 'My drafts', exact: true });
  await draftsButton.focus();
  await expect(draftsButton).toBeFocused();
  await draftsButton.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'My drafts', exact: true });
  await expect(dialog).toBeVisible();
  const signIn = dialog.getByRole('link', { name: 'Sign in', exact: true });
  await signIn.focus();
  await expect(signIn).toBeFocused();
  await signIn.press('Enter');
  await expect(page).toHaveURL(/\/en\/login/, { timeout: 30_000 });
  await page.locator('input[type=email]').fill('ana.popescu@demo.ro');
  await page.locator('input[type=password]').fill(process.env.DEMO_PASSWORD!);
  await page.getByRole('button', { name: 'Log in', exact: true }).click();
  await expect(page).toHaveURL(/\/en\/studio(?:\?|$)/, { timeout: 20_000 });
  // E-admin-platform-2: contul demo are versiunile juridice NULL, deci dialogul de re-acceptare blocheaza pagina
  const legalDialog = page.getByRole('dialog', { name: 'We have updated our Terms and Privacy Policy' });
  if (await legalDialog.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await legalDialog.getByRole('button', { name: 'I accept the Terms and acknowledge the Privacy Policy', exact: true }).click();
    await expect(legalDialog).toBeHidden();
  }
  const state =await page.evaluate(() => JSON.parse(localStorage.getItem('mm_studio_v3')!).state);
  expect(state.scenes).toHaveLength(2);
  expect(state.house.connections).toHaveLength(1);
  expect(state.pieces.bed.kind).toBe('BED');
  const name = `Browser login acceptance ${Date.now()}`;
  await page.getByRole('button', { name: /^My drafts/ }).click();
  await page.getByLabel('Draft name', { exact: true }).fill(name);
  const savedResponse = page.waitForResponse((response) => response.url().endsWith('/api/v1/studio/drafts') && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Save as new draft', exact: true }).click();
  const saved = await savedResponse;
  expect(saved.status()).toBe(201);
  const savedData = await saved.json();
  await dialog.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('button', { name: 'House', exact: true }).click();
  await page.getByRole('button', { name: 'Expand house tools', exact: true }).click();
  const width = page.getByLabel('Door width (m)', { exact: true });
  await width.fill('1.1');
  await width.blur();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('mm_studio_v3')!).state.scenes[0].openings[0].w)).toBe(1.1);
  await page.getByRole('button', { name: /^My drafts/ }).click();
  const row = dialog.getByRole('listitem').filter({ hasText: name });
  await expect(row).toBeVisible();
  await row.getByRole('button', { name: 'Load', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  const loaded = await page.evaluate(() => JSON.parse(localStorage.getItem('mm_studio_v3')!).state);
  expect(loaded.house).toEqual(fixture.house);
  expect(loaded.scenes).toHaveLength(2);
  expect(loaded.scenes[0].openings[0].w ?? .9).toBe(.9);
  expect(loaded.pieces.bed.config.bed.mattressSize).toBe('Q_160');
  await page.screenshot({ path: '../../docs/implementation/screenshots/studio-authenticated-desktop.png', fullPage: true });
  console.info(`Local account draft retained: ${savedData.id}`);
});

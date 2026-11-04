import { expect, test, type Page } from '@playwright/test';
import { getFlow } from '../../../packages/shared/src';
import { writeFile } from 'node:fs/promises';
import { mockGuestDraft, textFor } from './helpers/guided-request';

async function startRoom(page: Page, room: string, locale: 'en' | 'ro') {
  await mockGuestDraft(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`/${locale}/requests/new`);
  const t = (key: string) => textFor(locale, `Configurator.${key}`);
  await page.getByRole('button', { name: new RegExp(`^${t('start.STANDARD.title')}`) }).click();
  await page.getByRole('button', { name: t('cart.addOne').replace('{type}', t(`rooms.type.${room}`)), exact: true }).click();
  await page.getByRole('button', { name: t('nav.startQuestions'), exact: true }).click();
}

test('bookcase retains its own grounding shadow without the neighboring TV shadow', async ({ page }, info) => {
  await startRoom(page, 'LIVING', 'en');
  const bookcase = page.locator('[data-question-id="piecesNeeded"] [data-showroom-concept="bookcase"]');
  await expect(bookcase).toBeVisible();
  const path = info.outputPath('bookcase-corrected-crop.png');
  await bookcase.screenshot({ path });
  await info.attach('bookcase-corrected-crop', { path, contentType: 'image/png' });
});

for (const locale of ['en', 'ro'] as const) {
  test(`${locale}: side-by-side appliances do not include an implied worktop`, async ({ page }, info) => {
    await startRoom(page, 'LAUNDRY', locale);
    const t = (key: string) => textFor(locale, `Configurator.flows.LAUNDRY.applianceSetup.options.SIDE_BY_SIDE.${key}`);
    const option = page.getByRole('button', { name: `${t('label')} ${t('description')}`, exact: true });
    await expect(option).toBeVisible();
    await expect(option.locator('[data-showroom-concept="side-by-side-washer-dryer"]')).toBeVisible();
    await expect(option).not.toContainText(/under worktop|sub blat|Continuous worktop|Blat continuu/);
    const path = info.outputPath(`side-by-side-${locale}.png`);
    await option.screenshot({ path });
    await info.attach('side-by-side', { path, contentType: 'image/png' });
  });
}

test('standalone sliding artwork loads through responsive image optimization', async ({ page }, info) => {
  test.setTimeout(90_000);
  const delivered = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return url.pathname === '/_next/image' && url.searchParams.get('url') === '/illustrations/options/sliding-doors.png';
  });
  await startRoom(page, 'DRESSING', 'en');
  const t = (key: string) => textFor('en', `Configurator.${key}`);
  await page.getByRole('button', { name: `${t('flows.DRESSING.layout.options.LINEAR.label')} ${t('flows.DRESSING.layout.options.LINEAR.description')}`, exact: true }).click();
  await page.getByRole('button', { name: t('nav.next'), exact: true }).click();
  const dimensionStep = getFlow('DRESSING').steps.find((step) => step.id === 'dimensions')!;
  if (dimensionStep.type !== 'dimension-group') throw new Error('Expected wardrobe dimensions');
  await page.getByRole('button', { name: 'm', exact: true }).click();
  for (const slot of dimensionStep.slots({ layout: 'LINEAR' })) {
    const label = t(slot.labelKey).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    await page.getByRole('spinbutton', { name: new RegExp(`${label}$`) }).fill(String(Math.max(slot.min, Math.min(slot.max, 2.4))));
  }
  await page.getByRole('button', { name: t('nav.next'), exact: true }).click();
  const image = page.locator('[data-option-art="sliding-doors"]');
  await image.scrollIntoViewIfNeeded();
  await expect.poll(() => image.evaluate((element: HTMLImageElement) => element.complete && element.naturalWidth > 0)).toBe(true);
  const response = await delivered;
  expect(response.ok()).toBe(true);
  const payload = await response.body();
  const contentType = response.headers()['content-type'];
  expect(contentType).toMatch(/^image\//);
  expect(payload.byteLength).toBeLessThan(300_000);
  const path = info.outputPath('sliding-art-optimized.png');
  await image.screenshot({ path });
  await info.attach('sliding-art-optimized', { path, contentType: 'image/png' });
  const metricsPath = info.outputPath('sliding-art-delivery.json');
  await writeFile(metricsPath, JSON.stringify({ deliveredBytes: payload.byteLength, contentType, optimizedWidth: new URL(response.url()).searchParams.get('w') }, null, 2));
  await info.attach('sliding-art-delivery', { path: metricsPath, contentType: 'application/json' });
});

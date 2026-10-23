import { expect, test } from '@playwright/test';
import en from '../src/messages/en.json';
import fixture from '../../../docs/implementation/house-demo-fixture.json';
import { mockGuestDraft } from './helpers/guided-request';

test('questionnaire option faces remain full-width when selected in fullscreen', async ({ page }, info) => {
  test.setTimeout(120_000);
  await mockGuestDraft(page);
  await page.addInitScript(() => {
    localStorage.setItem('mm_configurator_v1', JSON.stringify({ version: 0, state: {
      phase: 'rooms', startMode: 'STANDARD', activeRoomIndex: 0, activeStepIndex: 0,
      roomInstances: [{ localId: 'fullscreen-kitchen', roomType: 'KITCHEN', flowVersion: 2, answers: {}, completed: false }],
      details: { hasOwnProject: false }, inspirationPhotoIds: [], updatedAt: Date.now(),
    } }));
  });
  await page.goto('/en/requests/new', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: en.Configurator.resume.continue, exact: true }).click();
  const question = page.locator('[data-question-id="layout"]');
  await expect(question).toBeVisible();
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.evaluate(() => document.documentElement.requestFullscreen());
  expect(await page.evaluate(() => document.fullscreenElement === document.documentElement)).toBe(true);
  const options = question.locator('button[aria-pressed]');
  for (let i = 0; i < await options.count(); i++) {
    await options.nth(i).click();
    await expect(options.nth(i)).toHaveAttribute('aria-pressed', 'true');
    await page.screenshot({ path: `../../docs/implementation/screenshots/fullscreen-option-${info.project.name}-${i}.png` });
    const box = (await options.nth(i).boundingBox())!;
    expect(box.width).toBeGreaterThan(100);
  }
  const more = question.getByRole('button', { name: en.Configurator.info.showInfo, exact: true });
  await expect(more.first()).toBeVisible();
  if (await more.count()) {
    const card = question.locator('[data-choice-card]').first();
    const infoButton = card.getByRole('button', { name: en.Configurator.info.showInfo, exact: true });
    await infoButton.scrollIntoViewIfNeeded();
    const cardBounds = await card.boundingBox();
    await card.evaluate((element) => {
      const observer = new MutationObserver(() => {
        const face = element.querySelector('[data-choice-face="details"]');
        if (!face) return;
        const animation = face.getAnimations()[0];
        if (animation) {
          animation.pause();
          animation.currentTime = 75;
        }
        observer.disconnect();
      });
      observer.observe(element, { childList: true, subtree: true });
    });
    await infoButton.focus();
    await infoButton.press('Enter');
    const details = card.locator('[data-choice-face="details"]');
    const back = details.getByRole('button', { name: en.Configurator.info.hideInfo, exact: true });
    await expect(back).toBeFocused();
    expect(await card.boundingBox()).toEqual(cardBounds);
    expect(await details.boundingBox()).toEqual(cardBounds);
    expect(await details.evaluate((element) => element.getAnimations()[0]?.currentTime)).toBe(75);
    await expect(details).toHaveCSS('transform', 'none');
    await expect(card).toHaveCSS('perspective', 'none');
    await page.screenshot({ path: `../../docs/implementation/screenshots/fullscreen-option-flip-${info.project.name}.png` });
    await details.evaluate((element) => element.getAnimations()[0]?.play());
    await expect(details).toHaveCSS('opacity', '1');
    await page.screenshot({ path: `../../docs/implementation/screenshots/fullscreen-option-info-${info.project.name}.png` });
    await back.press('Enter');
    await expect(infoButton).toBeFocused();
    await expect(details).toBeHidden();
    await expect(options.last()).toHaveAttribute('aria-pressed', 'true');
    expect(await card.boundingBox()).toEqual(cardBounds);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await infoButton.press('Enter');
    await expect(details).toHaveCSS('animation-name', 'none');
    await expect(details).toHaveCSS('opacity', '1');
    await expect(back).toBeFocused();
  }
});

test('Studio fullscreen option selection retains its canvas and viewport bounds', async ({ page }, info) => {
  test.setTimeout(120_000);
  await page.route('**/api/v1/**', (route) => route.fulfill({ status: 401, json: { error: { code: 'UNAUTHORIZED', message: 'Guest' } } }));
  await page.addInitScript((data) => localStorage.setItem('mm_studio_v3', JSON.stringify({ version: 3, state: { ...data, tutorialSeen: true, accountDraft: null, panelPos: null } })), fixture);
  await page.goto('/en/studio', { waitUntil: 'domcontentloaded' });
  const canvas = page.locator('canvas').first();
  await expect(canvas).toBeVisible({ timeout: 60_000 });
  const original = await canvas.elementHandle();
  await page.getByRole('button', { name: 'Fullscreen', exact: true }).click();
  await page.getByRole('button', { name: 'Room', exact: true }).click();
  const bounds = await canvas.boundingBox();
  for (const name of ['Floor: FAG', 'Floor: STEJAR', 'Walls: CREM']) {
    await page.getByRole('button', { name, exact: true }).click();
    expect(await original!.evaluate((element) => element.isConnected)).toBe(true);
    expect(await canvas.boundingBox()).toEqual(bounds);
    await page.screenshot({ path: `../../docs/implementation/screenshots/fullscreen-studio-${info.project.name}-${name.replaceAll(': ', '-').toLowerCase()}.png` });
  }
});

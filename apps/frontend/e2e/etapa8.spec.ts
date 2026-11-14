import { expect, test, type Page, type Route } from '@playwright/test';
import { getFlow, type DimensionGroupStep } from '../../../packages/shared/src';
import { fillDetailsAndReview, mockGuestDraft, textFor, walkRoomQuestions } from './helpers/guided-request';

// Etapa 8, pe TELEFON (proiectul "mobile", Pixel 7), cu API simulat: bara lipita cu butonul principal,
// mesajul pe campul de dimensiune gol, aceeasi dimensiune in formular si in Sumar (cm / m),
// "Ecranul N din M" la dormitor si Fisa cererii pliata. Compararea pe carduri e in account-offers.spec.ts.

const locale = 'ro';
const t = (key: string) => textFor(locale, `Configurator.${key}`);
const tr = (key: string) => textFor(locale, `Requests.${key}`);
const escaped = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

const CLIENT = {
  id: 'client-e2e', email: 'client@example.test', name: 'Client Test', phone: null, role: 'CLIENT',
  languagePreference: 'RO', emailVerifiedAt: '2026-01-01T00:00:00.000Z', twoFactorEnabled: false, needsLegalAcceptance: false,
};

test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'Bara lipita jos si Fisa pliata exista doar pe ecrane mici');
});

// butonul principal: unul singur cu numele asta pe pagina, in bara lipita, vizibil intreg fara derulare
async function expectBarAction(page: Page, name: string) {
  await expect(page.getByRole('button', { name, exact: true }), `un singur „${name}”`).toHaveCount(1);
  const inBar = page.locator('[data-sticky-action-bar]').getByRole('button', { name, exact: true });
  await expect(inBar, `„${name}” in bara`).toHaveCount(1);
  await expect(inBar, `„${name}” in viewport`).toBeInViewport({ ratio: 1 });
}

async function startWithRoom(page: Page, roomType: string) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`/${locale}/requests/new`);
  await page.getByRole('button', { name: new RegExp(`^${escaped(t('start.STANDARD.title'))}`) }).click();
  await page.getByRole('button', { name: t('cart.addOne').replace('{type}', t(`rooms.type.${roomType}`)), exact: true }).click();
}

test('ro, phone: the main action sits in the sticky bar on every step; an empty dimension is flagged on its field and the summary shows the same value', async ({ page }) => {
  test.setTimeout(300_000);
  await mockGuestDraft(page);
  await startWithRoom(page, 'LAUNDRY');
  // cos: "Incepe" in bara
  await expectBarAction(page, t('nav.startQuestions'));
  await page.getByRole('button', { name: t('nav.startQuestions'), exact: true }).click();

  const dims = getFlow('LAUNDRY').steps.find((s) => s.id === 'dimensions') as DimensionGroupStep;
  const slots = dims.slots({});
  const typed: Record<string, string> = { runA: '245,5', ceilingHeight: '260' };
  await walkRoomQuestions(page, locale, ['LAUNDRY'], (type) => getFlow(type), undefined, {
    onScreen: async () => expectBarAction(page, t('nav.next')),
    onDimensions: async (block) => {
      await expect(block.getByRole('button', { name: 'cm', exact: true })).toHaveAttribute('aria-pressed', 'true');
      // "Continua" cu campurile goale: mesajul pe fiecare camp, focus pe primul, nimic sub bara
      await page.locator('[data-sticky-action-bar]').getByRole('button', { name: t('nav.next'), exact: true }).click();
      for (const slot of slots) {
        await expect(block.getByText(t('validation.fillField').replace('{field}', t(slot.labelKey)), { exact: true })).toBeVisible();
      }
      const first = block.getByRole('textbox', { name: new RegExp(`${escaped(t(slots[0].labelKey))}$`) });
      await expect(first).toBeFocused();
      await expect(first).toHaveAttribute('aria-invalid', 'true');
      await expect(first).toBeInViewport({ ratio: 1 });
      const bar = await page.locator('[data-sticky-action-bar]').boundingBox();
      const field = await first.boundingBox();
      expect(field!.y + field!.height, 'campul ramane deasupra barei').toBeLessThanOrEqual(bar!.y);
      // aceeasi valoare in camp, in cm, cu virgula
      const values: Record<string, number> = {};
      for (const slot of slots) {
        const input = block.getByRole('textbox', { name: new RegExp(`${escaped(t(slot.labelKey))}$`) });
        await input.fill(typed[slot.id]);
        await input.blur();
        await expect(input).toHaveValue(typed[slot.id]);
        values[slot.id] = Number(typed[slot.id].replace(',', '.')) / 100;
      }
      await expect(block.getByText(t('validation.fillField').replace('{field}', t(slots[0].labelKey)), { exact: true })).toHaveCount(0);
      return values;
    },
  });
  // fisiere: "Continua"
  await expectBarAction(page, t('nav.continue'));
  await page.getByRole('button', { name: t('nav.continue'), exact: true }).click();
  // date generale: "Spre verificare"
  await expect(page.getByRole('textbox', { name: tr('field.message'), exact: true })).toBeVisible();
  await expectBarAction(page, t('nav.toReview'));
  await fillDetailsAndReview(page, locale);

  // Sumar: aceeasi valoare ca in camp ("245,5 cm"); vizitatorul are in bara "Inapoi" + autentificarea
  const preview = page.locator('[data-review-room-preview="LAUNDRY"]');
  await expect(preview.getByText('245,5 cm', { exact: true })).toBeVisible();
  await expect(preview.getByText('260 cm', { exact: true })).toBeVisible();
  await expectBarAction(page, t('nav.back'));
  await expectBarAction(page, t('review.loginToPublish'));

  // comutatorul pe m in formular → Sumarul urmeaza unitatea
  await page.getByRole('button', { name: t('review.rooms.edit').replace('{room}', t('rooms.type.LAUNDRY')), exact: true }).click();
  const primary = page.locator('[data-sticky-action-bar]').getByRole('button', { name: new RegExp(`^(?:${escaped(t('nav.next'))}|${escaped(t('nav.toReview'))})$`) });
  const reviewHeading = page.getByRole('heading', { name: t('review.title'), exact: true });
  let switched = false;
  for (let i = 0; i < 30 && !(await reviewHeading.isVisible()); i++) {
    const dimBlock = page.locator('[data-question-id="dimensions"][data-room-type="LAUNDRY"]');
    if (!switched && await dimBlock.isVisible()) {
      await dimBlock.getByRole('button', { name: 'm', exact: true }).click();
      await expect(dimBlock.getByRole('textbox', { name: new RegExp(`${escaped(t(slots[0].labelKey))}$`) })).toHaveValue('2,455');
      switched = true;
    }
    await expect(primary).toHaveCount(1);
    await primary.click();
    await page.waitForTimeout(300);
  }
  expect(switched, 'ecranul de dimensiuni a fost gasit').toBe(true);
  await expect(reviewHeading).toBeVisible();
  await expect(preview.getByText('2,455 m', { exact: true })).toBeVisible();
  await expect(preview.getByText('2,6 m', { exact: true })).toBeVisible();
  await expect(preview.getByText('245,5 cm', { exact: true })).toHaveCount(0);

  // clientul autentificat: un singur "Publica cererea", in bara. Ce cere in plus pagina cu cont
  // (notificari etc.) primeste un raspuns gol; restul merge la simularea vizitatorului.
  await page.route('**/api/v1/**', (route) => {
    const path = new URL(route.request().url()).pathname.replace(/^.*\/api\/v1/, '');
    if (path === '/notifications/unread-count') return json(route, { count: 0 });
    if (/^\/(auth|requests\/drafts|inspiration|legal)\b/.test(path) || /estimate|coverage/.test(path)) return route.fallback();
    if (route.request().method() === 'GET') return json(route, []);
    return route.fallback();
  });
  await page.route('**/api/v1/auth/me', (route) => json(route, { user: CLIENT }));
  await page.reload();
  const resume = page.getByRole('button', { name: t('resume.continue'), exact: true });
  await expect(resume.or(reviewHeading).first()).toBeVisible({ timeout: 30_000 });
  if (await resume.isVisible()) await resume.click();
  await expect(reviewHeading).toBeVisible();
  await expectBarAction(page, tr('publish'));
  await expectBarAction(page, t('nav.back'));
});

test('ro, phone: the request sheet starts folded on the room screens and opens on tap', async ({ page }) => {
  test.setTimeout(120_000);
  await mockGuestDraft(page);
  await startWithRoom(page, 'KITCHEN');
  await page.getByRole('button', { name: t('nav.startQuestions'), exact: true }).click();
  await expect(page.locator('[data-question-id]').first()).toBeVisible();
  const sheet = page.locator('[data-sheet-collapsible]');
  await expect(sheet).toHaveCount(1);
  await expect.poll(() => sheet.evaluate((el) => (el as HTMLDetailsElement).open)).toBe(false);
  const summary = sheet.locator('summary');
  await expect(summary).toContainText(t('sheet.title'));
  await expect(sheet.getByText(t('sheet.hint'), { exact: true })).toBeHidden();
  await summary.click();
  await expect.poll(() => sheet.evaluate((el) => (el as HTMLDetailsElement).open)).toBe(true);
  await expect(sheet.getByText(t('sheet.hint'), { exact: true })).toBeVisible();
  await summary.click();
  await expect.poll(() => sheet.evaluate((el) => (el as HTMLDetailsElement).open)).toBe(false);
});

test('ro, phone: the bedroom shows "Ecranul N" until the pieces are chosen, then "Ecranul N din M" with a progress bar', async ({ page }) => {
  test.setTimeout(300_000);
  await mockGuestDraft(page);
  await startWithRoom(page, 'BEDROOM');
  await page.getByRole('button', { name: t('nav.startQuestions'), exact: true }).click();
  await expect(page.locator('[data-question-id]').first()).toBeVisible();
  const seen: { counter: string; bars: number; ids: string[] }[] = [];
  await walkRoomQuestions(page, locale, ['BEDROOM'], (type) => getFlow(type), undefined, {
    onScreen: async () => {
      seen.push({
        counter: (await page.locator('[data-screen-counter]').textContent())?.trim() ?? '',
        bars: await page.getByRole('progressbar').count(),
        ids: await page.locator('[data-question-id]').evaluateAll((els) => els.map((el) => el.getAttribute('data-question-id')!)),
      });
    },
  });
  const piecesAt = seen.findIndex((s) => s.ids.includes('piecesNeeded'));
  expect(piecesAt, 'ecranul pieselor').toBeGreaterThanOrEqual(0);
  const only = new RegExp(`^${escaped(t('nav.screenOnly')).replace('\\{current\\}', '(\\d+)')}$`);
  const of = new RegExp(`^${escaped(t('nav.screenOf')).replace('\\{current\\}', '(\\d+)').replace('\\{total\\}', '(\\d+)')}$`);
  seen.forEach((s, i) => {
    if (i <= piecesAt) {
      expect(s.counter, `ecranul ${i + 1}`).toMatch(only);
      expect(s.counter.match(only)![1]).toBe(String(i + 1));
      expect(s.bars, `fara bara de progres pe ecranul ${i + 1}`).toBe(0);
    } else {
      const m = s.counter.match(of);
      expect(m, `ecranul ${i + 1}: „${s.counter}”`).not.toBeNull();
      expect(m![1]).toBe(String(i + 1));
      expect(Number(m![2]), 'totalul = numarul de ecrane parcurse').toBe(seen.length);
      expect(s.bars, `bara de progres pe ecranul ${i + 1}`).toBe(1);
    }
  });
  expect(seen.length).toBeGreaterThan(piecesAt + 1);
});

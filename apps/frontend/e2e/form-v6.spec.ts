import { expect, test, type Page } from '@playwright/test';
import { CURRENT_FLOW_VERSION, FLOW_VERSIONS_BEFORE_ETAPA6, getFlow, type RoomType } from '../../../packages/shared/src';
import { fillDetailsAndReview, mockGuestDraft, textFor, walkRoomQuestions } from './helpers/guided-request';

// Etapa 6 — versiunea noua a formularului (material + deschidere pe un ecran).

type Snapshot = { phase?: string; roomInstances?: { roomType: string; flowVersion: number; answers: Record<string, unknown>; completed: boolean }[] };
function lastSavedDraft(page: Page) {
  const state: { snapshot?: Snapshot } = {};
  page.on('request', (request) => {
    if (request.method() === 'PATCH' && /\/api\/v1\/requests\/drafts\/[^/]+$/.test(new URL(request.url()).pathname)) state.snapshot = request.postDataJSON()?.configuratorState;
  });
  return state;
}

// ultima versiune dinainte de etapa 6 a fiecarei camere
const oldVersion = (type: RoomType) => Math.max(...FLOW_VERSIONS_BEFORE_ETAPA6[type]);
const OLD_ROOMS: RoomType[] = ['KITCHEN', 'DRESSING', 'LIVING', 'BEDROOM', 'HALLWAY'];

test('a draft with rooms on the old flow versions is edited on its own versions and reaches the summary', async ({ page }) => {
  test.setTimeout(300_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await mockGuestDraft(page);
  const saved = lastSavedDraft(page);
  await page.addInitScript((rooms) => {
    localStorage.setItem('mm_draft_token', 'local-audit-only');
    localStorage.setItem('mm_configurator_v1', JSON.stringify({ version: 6, state: {
      phase: 'rooms', startMode: 'STANDARD', activeRoomIndex: 0, activeStepIndex: 0,
      roomInstances: rooms.map(([roomType, flowVersion]) => ({ localId: `old-${roomType}`, roomType, flowVersion, answers: {}, completed: false })),
      details: {}, inspirationPhotoIds: [], updatedAt: Date.now(),
    } }));
  }, OLD_ROOMS.map((type) => [type, oldVersion(type)] as const));
  const locale = 'en';
  const t = (key: string) => textFor(locale, `Configurator.${key}`);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`/${locale}/requests/new`);
  await page.getByRole('button', { name: t('resume.continue'), exact: true }).click();
  // camerele vechi arata intrebarile versiunii lor (nu pe cele noi): nicio intrebare comuna de material
  const { questions } = await walkRoomQuestions(page, locale, OLD_ROOMS, (type) => getFlow(type, oldVersion(type)));
  for (const type of OLD_ROOMS) {
    expect([...questions.get(type)!], `${type} v${oldVersion(type)}`).not.toContain('sameFinishAll');
    expect([...questions.get(type)!], `${type} v${oldVersion(type)}`).not.toContain('materialAll');
  }
  await page.getByRole('button', { name: t('nav.continue'), exact: true }).click();
  await fillDetailsAndReview(page, locale);
  for (const type of OLD_ROOMS) await expect(page.getByRole('heading', { name: t(`rooms.type.${type}`), exact: true })).toBeVisible();
  await expect(page.getByText(t('review.roomIncomplete'), { exact: true })).toHaveCount(0);
  await expect.poll(() => saved.snapshot?.phase).toBe('review');
  // cererea veche ramane pe versiunea ei
  expect(Object.fromEntries((saved.snapshot?.roomInstances ?? []).map((room) => [room.roomType, room.flowVersion])))
    .toEqual(Object.fromEntries(OLD_ROOMS.map((type) => [type, oldVersion(type)])));
  expect((saved.snapshot?.roomInstances ?? []).every((room) => room.completed)).toBe(true);
  expect(errors).toEqual([]);
});

// Randul "Alta piesa" v2: deschiderea e obligatorie (cu iesirile exclusive), fara "Usi glisante",
// dimensiunile in centimetri intregi; ciorna se salveaza pe versiunea noua.
for (const locale of ['ro', 'en'] as const) {
  test(`${locale}: the "other piece" row v2 requires an opening and whole centimetres`, async ({ page }) => {
    test.setTimeout(180_000);
    await mockGuestDraft(page);
    const saved = lastSavedDraft(page);
    const t = (key: string) => textFor(locale, `Configurator.${key}`);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(`/${locale}/requests/new`);
    await page.getByRole('button', { name: new RegExp(`^${t('start.STANDARD.title').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`) }).click();
    await page.getByRole('tab', { name: t('cart.tabPieces') }).click();
    await page.locator('[data-cart-tile="PIECES"]').getByRole('button').click();
    await page.getByRole('button', { name: t('nav.startQuestions'), exact: true }).click();
    const step = page.locator('[data-question-id="pieces"][data-room-type="PIECES"]');
    await expect(step).toBeVisible();
    await step.getByRole('button', { name: t('pieces.add') }).click();
    const row = step.locator('[data-piece-row-version="2"]');
    await expect(row).toHaveCount(1);
    await row.getByRole('textbox', { name: t('pieces.name'), exact: true }).fill(locale === 'ro' ? 'Corp sub geam' : 'Window seat unit');
    // deschiderea: fara "Usi glisante"; Maner, Push si cele doua iesiri
    const opening = row.getByRole('group', { name: t('pieces.openingTitle') });
    await expect(opening.getByRole('checkbox', { name: t('common.systems.GLISANTE.label'), exact: true })).toHaveCount(0);
    // fara deschidere, "Continua" e respins si eroarea apare langa grupul de deschidere
    await page.getByRole('button', { name: t('nav.next'), exact: true }).click();
    await expect(row).toHaveAttribute('data-row-invalid', 'true');
    await expect(row.getByText(t('pieces.errors.opening'), { exact: true })).toBeVisible();
    // exclusiv: "Nu stiu" scoate Manerul; Manerul scoate "Nu stiu"
    const handle = opening.getByRole('checkbox', { name: t('common.systems.MANER.label'), exact: true });
    const firm = opening.getByRole('checkbox', { name: t('pieces.firmDecides'), exact: true });
    const noFronts = opening.getByRole('checkbox', { name: t('pieces.noFronts'), exact: true });
    await handle.check();
    await firm.check();
    await expect(handle).not.toBeChecked();
    await noFronts.check();
    await expect(firm).not.toBeChecked();
    await handle.check();
    await expect(noFronts).not.toBeChecked();
    await expect(handle).toBeChecked();
    // centimetri intregi: "12,5" e respins pe camp; "120" trece
    const width = row.getByRole('textbox', { name: t('pieces.width'), exact: true });
    await width.fill('12,5');
    await expect(row.getByText(t('pieces.errors.wholeCm'), { exact: true })).toBeVisible();
    await page.getByRole('button', { name: t('nav.next'), exact: true }).click();
    await expect(step).toBeVisible();
    await width.fill('120');
    await row.getByRole('textbox', { name: t('pieces.depth'), exact: true }).fill('45');
    await expect(row.getByText(t('pieces.errors.wholeCm'), { exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: t('nav.next'), exact: true }).click();
    await expect(step).toHaveCount(0);
    await expect.poll(() => saved.snapshot?.roomInstances?.[0]?.answers?.pieces, { timeout: 15_000 }).toEqual([
      expect.objectContaining({ name: locale === 'ro' ? 'Corp sub geam' : 'Window seat unit', systems: ['MANER'], widthCm: 120, depthCm: 45, quantity: 1 }),
    ]);
    const room = saved.snapshot!.roomInstances![0];
    expect(room.roomType).toBe('PIECES');
    expect(room.flowVersion).toBe(CURRENT_FLOW_VERSION.PIECES);
    expect((room.answers.pieces as Record<string, unknown>[])[0]).not.toHaveProperty('openingChoice');
  });
}

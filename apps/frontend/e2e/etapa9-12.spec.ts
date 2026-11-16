import { expect, test, type Locator, type Page, type Route } from '@playwright/test';
import { COMPANY_ROLE_PERMISSIONS, ETAPA6_FLOW_VERSION, getFlow, type AnswerMap, type DimensionGroupStep, type RoomType } from '../../../packages/shared/src';
import { fixtureAnswers } from '../../../packages/shared/src/questionnaire/firm-text.fixtures';
import ro from '../src/messages/ro.json';
import { answerCurrentScreen, dimensionInput, fillDetailsAndReview, mockGuestDraft, textFor, walkRoomQuestions } from './helpers/guided-request';

// Etapele 9–12, prin interfata, cu API simulat:
// - formularul pe versiunile etapei 10 (sloturi optionale, text nevalid, „Fără corpuri suspendate”,
//   balconul cu un raft, o ciorna pe versiunile etapei 6);
// - Back / Forward din browser in formular (etapa 12);
// - pe telefon: bara lipita si indiciul „de obicei …” pe ecranele noi.

const t = (locale: 'ro' | 'en', key: string) => textFor(locale, `Configurator.${key}`);
const escaped = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

type Snapshot = { phase?: string; roomInstances?: { roomType: string; flowVersion: number; answers: Record<string, unknown>; completed: boolean }[] };
function lastSavedDraft(page: Page) {
  const state: { snapshot?: Snapshot } = {};
  page.on('request', (request) => {
    if (request.method() === 'PATCH' && /\/api\/v1\/requests\/drafts\/[^/]+$/.test(new URL(request.url()).pathname)) state.snapshot = request.postDataJSON()?.configuratorState;
  });
  return state;
}

async function startWithRooms(page: Page, locale: 'ro' | 'en', rooms: RoomType[]) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`/${locale}/requests/new`);
  await page.getByRole('button', { name: new RegExp(`^${escaped(t(locale, 'start.STANDARD.title'))}`) }).click();
  for (const room of rooms) await page.getByRole('button', { name: t(locale, 'cart.addOne').replace('{type}', t(locale, `rooms.type.${room}`)), exact: true }).click();
  await page.getByRole('button', { name: t(locale, 'nav.startQuestions'), exact: true }).click();
}

// cardul unei camere din Sumar (lista scurta + „Vezi toate raspunsurile” deschis)
async function reviewCard(page: Page, locale: 'ro' | 'en', room: RoomType): Promise<Locator> {
  const card = page.locator(`[data-review-room-preview="${room}"]`).locator('xpath=ancestor::section[1]');
  await expect(card).toBeVisible();
  const more = card.locator('[data-review-room-more]');
  if (await more.count()) {
    await expect(more.locator('summary')).toHaveText(t(locale, 'review.rooms.allAnswers'));
    if (!(await more.evaluate((el) => (el as HTMLDetailsElement).open))) await more.locator('summary').click();
  }
  return card;
}

const firstQuestion = (page: Page) => page.locator('[data-question-id]').first().evaluate((el) => `${el.getAttribute('data-room-type')}.${el.getAttribute('data-question-id')}`);

// completeaza sloturile obligatorii (in m) si lasa goale pe cele optionale
async function fillRequiredSlots(block: Locator, locale: 'ro' | 'en', step: DimensionGroupStep, answers: AnswerMap, values: Record<string, number> = {}) {
  await block.getByRole('button', { name: 'm', exact: true }).click();
  const out: Record<string, number> = {};
  for (const slot of step.slots(answers)) {
    if (slot.optional) continue;
    const value = values[slot.id] ?? Math.min(slot.max, Math.max(slot.min, /height/i.test(slot.id) ? 2.6 : /depth/i.test(slot.id) ? 0.6 : 2.4));
    const input = dimensionInput(block, locale, slot.labelKey);
    await input.fill(locale === 'ro' ? String(value).replace('.', ',') : String(value));
    await input.blur();
    out[slot.id] = value;
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// 1. Formularul v7 (etapa 10)
// ---------------------------------------------------------------------------------------------

test('ro: a new request on the etapa 10 versions — empty optional height, invalid text, no wall cabinets, a balcony with one shelf', async ({ page }) => {
  test.setTimeout(300_000);
  const locale = 'ro';
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await mockGuestDraft(page);
  const saved = lastSavedDraft(page);
  const rooms: RoomType[] = ['KITCHEN', 'BEDROOM', 'BALCONY'];
  await startWithRooms(page, locale, rooms);
  let badTextChecked = false;
  const { questions } = await walkRoomQuestions(page, locale, rooms, (type) => getFlow(type), undefined, {
    preferred: {
      KITCHEN: { layout: 'STRAIGHT', wallCabinets: 'NO_WALL_CABINETS' },
      BEDROOM: { piecesNeeded: ['BED_FRAME', 'WARDROBE'] },
      BALCONY: { piecesNeeded: ['SHELVES'] },
    },
    onDimensions: async (block, step, answers) => {
      const room = (await block.getAttribute('data-room-type')) as RoomType;
      const dims = step as DimensionGroupStep;
      const values = await fillRequiredSlots(block, locale, dims, answers);
      if (room === 'BEDROOM' && step.id === 'dimensions') {
        // inaltimea dulapului: optionala, cu „de obicei 2,4 m”; un text nevalid opreste „Continua”
        const height = dims.slots(answers).find((slot) => slot.id === 'wardrobeHeight')!;
        expect(height.optional).toBe(true);
        const input = dimensionInput(block, locale, height.labelKey, true);
        await expect(block.locator('[data-typical-hint]')).toContainText(t(locale, 'dimensions.typicalHint').replace('{value}', '2,4 m'));
        await input.fill('abc');
        await input.blur();
        await page.getByRole('button', { name: t(locale, 'nav.next'), exact: true }).click();
        await expect(block.getByText(t(locale, 'validation.notANumber'), { exact: true }).first()).toBeVisible();
        await expect(input).toHaveAttribute('aria-invalid', 'true');
        await page.waitForTimeout(500);
        await expect(block).toBeVisible();
        expect(await firstQuestion(page)).toBe('BEDROOM.dimensions');
        // golit: golul e valid, deci „Continua” (facut de helper) trece
        await input.fill('');
        await input.blur();
        badTextChecked = true;
      }
      return values;
    },
  });
  expect(badTextChecked, 'ecranul de dimensiuni al dormitorului').toBe(true);
  // bucataria fara suspendate: pe ecranul Fronturi nu apare zona suspendatelor (dar bifa de zone exista)
  const kitchen = [...questions.get('KITCHEN')!];
  expect(kitchen).toContain('wallCabinets');
  expect(kitchen).toContain('separateFrontMaterials');
  expect(kitchen).toContain('frontMaterialBase');
  expect(kitchen).not.toContain('frontMaterialWall');
  expect(kitchen).not.toContain('openingSystemsWall');
  await page.getByRole('button', { name: t(locale, 'nav.continue'), exact: true }).click();
  await fillDetailsAndReview(page, locale);
  // dormitorul: inaltimea dulapului lasata goala → „Nu ai dat-o — o stabilești cu firma”
  const bedroom = await reviewCard(page, locale, 'BEDROOM');
  await expect(bedroom).toContainText(t(locale, 'flows.BEDROOM.dimensions.slots.wardrobeHeight'));
  await expect(bedroom).toContainText(t(locale, 'dimensions.notGiven'));
  // balconul cu un raft: latimea raftului apare in Sumar
  const balcony = await reviewCard(page, locale, 'BALCONY');
  await expect(balcony).toContainText(t(locale, 'flows.BALCONY.dimensions.slots.shelvesWidth'));
  await expect(balcony).toContainText('2,4 m');
  await expect(page.getByText(t(locale, 'review.roomIncomplete'), { exact: true })).toHaveCount(0);
  // ciorna: versiunile etapei 10, fara inaltimea dulapului si fara raspunsuri pentru suspendate
  await expect.poll(() => saved.snapshot?.phase).toBe('review');
  const byType = new Map((saved.snapshot?.roomInstances ?? []).map((room) => [room.roomType, room]));
  for (const type of rooms) expect(byType.get(type)?.flowVersion, type).toBe(getFlow(type).version);
  expect(byType.get('BEDROOM')?.answers.dimensions).not.toHaveProperty('wardrobeHeight');
  expect(byType.get('KITCHEN')?.answers).toMatchObject({ wallCabinets: 'NO_WALL_CABINETS' });
  expect(byType.get('KITCHEN')?.answers).not.toHaveProperty('frontMaterialWall');
  expect(byType.get('BALCONY')?.answers.dimensions).toMatchObject({ shelvesWidth: 2.4 });
  expect(errors).toEqual([]);
});

// o ciorna inceputa pe versiunile etapei 6 se termina pe intrebarile ei (fara ecranele noi)
const ETAPA6_ROOMS: RoomType[] = ['KITCHEN', 'BEDROOM', 'BATHROOM', 'LAUNDRY', 'BALCONY'];
test('en: a draft on the etapa 6 versions reaches the summary on its own questions', async ({ page }) => {
  test.setTimeout(300_000);
  const locale = 'en';
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await mockGuestDraft(page);
  const saved = lastSavedDraft(page);
  await page.addInitScript((rooms) => {
    localStorage.setItem('mm_draft_token', 'local-audit-only');
    localStorage.setItem('mm_configurator_v1', JSON.stringify({ version: 6, state: {
      phase: 'rooms', startMode: 'STANDARD', activeRoomIndex: 0, activeStepIndex: 0,
      roomInstances: rooms.map(([roomType, flowVersion]) => ({ localId: `e6-${roomType}`, roomType, flowVersion, answers: {}, completed: false })),
      details: {}, inspirationPhotoIds: [], updatedAt: Date.now(),
    } }));
  }, ETAPA6_ROOMS.map((type) => [type, ETAPA6_FLOW_VERSION[type]] as const));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`/${locale}/requests/new`);
  await page.getByRole('button', { name: t(locale, 'resume.continue'), exact: true }).click();
  const { questions } = await walkRoomQuestions(page, locale, ETAPA6_ROOMS, (type) => getFlow(type, ETAPA6_FLOW_VERSION[type]));
  const all = ETAPA6_ROOMS.flatMap((type) => [...questions.get(type)!].map((id) => `${type}.${id}`));
  for (const fresh of ['KITCHEN.wallCabinets', 'KITCHEN.sinkMounting', 'KITCHEN.fridgeType', 'BEDROOM.wardrobeInterior', 'BEDROOM.bedFabric', 'BATHROOM.basinType', 'LAUNDRY.washerLoading']) {
    expect(all, `${fresh} nu exista pe versiunea etapei 6`).not.toContain(fresh);
  }
  await page.getByRole('button', { name: t(locale, 'nav.continue'), exact: true }).click();
  await fillDetailsAndReview(page, locale);
  await expect(page.getByText(t(locale, 'review.roomIncomplete'), { exact: true })).toHaveCount(0);
  await expect.poll(() => saved.snapshot?.phase).toBe('review');
  expect(Object.fromEntries((saved.snapshot?.roomInstances ?? []).map((room) => [room.roomType, room.flowVersion])))
    .toEqual(Object.fromEntries(ETAPA6_ROOMS.map((type) => [type, ETAPA6_FLOW_VERSION[type]])));
  expect(errors).toEqual([]);
});

// ---------------------------------------------------------------------------------------------
// 2. Back / Forward din browser (etapa 12) — desktop + mobil
// ---------------------------------------------------------------------------------------------

test('ro: browser Back / Forward move between screens without changing the address or losing answers', async ({ page }) => {
  test.setTimeout(240_000);
  const locale = 'ro';
  await mockGuestDraft(page);
  await startWithRooms(page, locale, ['KITCHEN']);
  const url = page.url();
  const answers = new Map<RoomType, AnswerMap>();
  const preferred = { KITCHEN: { layout: 'STRAIGHT' } };
  const next = page.getByRole('button', { name: t(locale, 'nav.next'), exact: true });
  const titleFocused = () => expect(page.locator('[data-question-id]').first().locator('h2, h3').first()).toBeFocused();
  const onScreen = (id: string) => expect.poll(() => firstQuestion(page)).toBe(id);

  // ecranul 1 (forma) → ecranul 2 (dimensiuni) → ecranul 3 (fronturi)
  await onScreen('KITCHEN.layout');
  await answerCurrentScreen(page, locale, (type) => getFlow(type), answers, { preferred });
  await next.click();
  await onScreen('KITCHEN.dimensions');
  const dims = page.locator('[data-question-id="dimensions"][data-room-type="KITCHEN"]');
  const runA = dimensionInput(dims, locale, 'flows.KITCHEN.dimensions.slots.runA');
  await answerCurrentScreen(page, locale, (type) => getFlow(type), answers, { preferred });
  const runAValue = await runA.inputValue();
  expect(runAValue).not.toBe('');
  await next.click();
  await onScreen('KITCHEN.frontMaterialBase');
  await titleFocused();

  // Back din browser: ecranul de dinainte, aceeasi adresa, raspunsurile raman; focus pe titlu
  await page.goBack();
  await onScreen('KITCHEN.dimensions');
  expect(page.url()).toBe(url);
  await expect(runA).toHaveValue(runAValue);
  await titleFocused();
  // Forward: inapoi pe fronturi
  await page.goForward();
  await onScreen('KITCHEN.frontMaterialBase');
  expect(page.url()).toBe(url);

  // „Înapoi” din pagina urmat de Back din browser: doi pasi inapoi, fara bucla
  await page.getByRole('button', { name: t(locale, 'nav.back'), exact: true }).click();
  await onScreen('KITCHEN.dimensions');
  await page.goBack();
  await onScreen('KITCHEN.layout');
  const straight = page.locator('[data-question-id="layout"]').getByRole('button', { name: new RegExp(`^${escaped(t(locale, 'flows.KITCHEN.layout.options.STRAIGHT.label'))}`) });
  await expect(straight).toHaveAttribute('aria-pressed', 'true');
  await page.goForward();
  await onScreen('KITCHEN.dimensions');
  await page.goForward();
  await onScreen('KITCHEN.frontMaterialBase');

  // reincarcarea pastreaza locul; Back duce apoi la ecranul de dinainte
  await page.reload();
  const resume = page.getByRole('button', { name: t(locale, 'resume.continue'), exact: true });
  await expect(resume.or(page.locator('[data-question-id]').first()).first()).toBeVisible({ timeout: 60_000 });
  if (await resume.isVisible()) await resume.click();
  await onScreen('KITCHEN.frontMaterialBase');
  expect(page.url()).toBe(url);
  await page.goBack();
  await onScreen('KITCHEN.dimensions');
  await expect(runA).toHaveValue(runAValue);

  // Forward se opreste pe un ecran incomplet si arata mesajele lui
  await runA.fill('');
  await runA.blur();
  await page.goForward();
  await expect(dims.getByText(t(locale, 'validation.fillField').replace('{field}', t(locale, 'flows.KITCHEN.dimensions.slots.runA')), { exact: true })).toBeVisible();
  await page.waitForTimeout(1_500);
  await onScreen('KITCHEN.dimensions');
  await expect(runA).toHaveAttribute('aria-invalid', 'true');
  // completat, „Continua” merge mai departe
  await runA.fill(runAValue);
  await runA.blur();
  await next.click();
  await onScreen('KITCHEN.frontMaterialBase');
});

test('ro: browser Back from the first screen of the page leaves the form', async ({ page }) => {
  test.setTimeout(180_000);
  const locale = 'ro';
  await mockGuestDraft(page);
  await page.goto('about:blank');
  await startWithRooms(page, locale, ['KITCHEN']);
  await expect.poll(() => firstQuestion(page)).toBe('KITCHEN.layout');
  // ecranul 1 al camerei → cosul → alegerea modului → pagina de dinainte
  await page.goBack();
  await expect(page.getByRole('button', { name: t(locale, 'nav.startQuestions'), exact: true })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('button', { name: new RegExp(`^${escaped(t(locale, 'start.STANDARD.title'))}`) })).toBeVisible();
  await page.goBack();
  await expect.poll(() => page.url()).toBe('about:blank');
});

// ---------------------------------------------------------------------------------------------
// 3. Piesele 3D din formular (etapele 9–10): pagina /dev/piece-3d nu da `features`, deci comenzile
//    noi (canapea extensibila / lada, pat „Other size”, lungimea deschisa) apar doar pe pasii din formular
// ---------------------------------------------------------------------------------------------

test('en: 3D pieces — sofa bed + storage box, bed "Other size", extendable table with its extended length, Reframe', async ({ page }) => {
  test.setTimeout(300_000);
  const locale = 'en';
  const c3 = (key: string) => t(locale, `config3d.${key}`);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await mockGuestDraft(page);
  // imaginile 3D ale pieselor se urca pe ciorna (best-effort): aici urcarea e refuzata
  await page.route(/\/api\/v1\/requests\/drafts\/[^/]+\/attachments/, (route) => json(route, { error: { code: 'INTERNAL_ERROR', message: 'e2e' } }, 503));
  const saved = lastSavedDraft(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`/${locale}/requests/new`);
  await page.getByRole('button', { name: new RegExp(`^${escaped(t(locale, 'start.STANDARD.title'))}`) }).click();
  await page.getByRole('tab', { name: t(locale, 'cart.tabPieces') }).click();
  const pieces: RoomType[] = ['PIECE_SOFA', 'PIECE_BED', 'PIECE_TABLE'];
  for (const piece of pieces) await page.locator(`[data-cart-tile="${piece}"]`).getByRole('button', { name: t(locale, 'cart.addOne').replace('{type}', t(locale, `rooms.type.${piece}`)), exact: true }).click();
  await page.getByRole('button', { name: t(locale, 'nav.startQuestions'), exact: true }).click();

  const config = async (room: RoomType) => (saved.snapshot?.roomInstances ?? []).find((r) => r.roomType === room)?.answers.config3d as Record<string, Record<string, unknown>> | undefined;
  const done = new Set<string>();
  const answers = new Map<RoomType, AnswerMap>();
  for (let screen = 0; screen < 30; screen++) {
    if (await page.getByRole('heading', { name: t(locale, 'uploads.title'), exact: true }).isVisible()) break;
    await expect(page.locator('[data-question-id]').first()).toBeVisible();
    const here = await firstQuestion(page);
    const [room, id] = here.split('.') as [RoomType, string];
    if (id === 'config3d') {
      await expect(page.locator('canvas').first()).toBeVisible({ timeout: 30_000 });
      if (room === 'PIECE_SOFA') {
        await page.getByRole('checkbox', { name: c3('catalog.sleeper'), exact: true }).check();
        await page.getByRole('checkbox', { name: c3('catalog.sofaStorage'), exact: true }).check();
        await expect.poll(async () => (await config(room))?.sofa, { timeout: 15_000 }).toMatchObject({ sleeper: true, storage: true });
      }
      if (room === 'PIECE_BED') {
        const size = page.getByRole('combobox', { name: t(locale, 'flows.PIECE_BED.bedSize.title'), exact: true });
        await expect(size.locator('option', { hasText: c3('furniture.customSize') })).toHaveCount(1);
        await size.selectOption('CUSTOM');
        const width = page.getByRole('textbox', { name: new RegExp(`^${escaped(c3('furniture.mattressWidth'))}`) });
        const length = page.getByRole('textbox', { name: new RegExp(`^${escaped(c3('furniture.mattressLength'))}`) });
        await width.fill('150'); await width.press('Tab');
        await length.fill('190'); await length.press('Tab');
        await expect.poll(async () => (await config(room))?.bed?.customSize, { timeout: 15_000 }).toEqual({ widthM: 1.5, lengthM: 1.9 });
      }
      if (room === 'PIECE_TABLE') {
        await expect(page.getByRole('checkbox', { name: c3('furniture.openLengthToggle'), exact: true })).toHaveCount(0);
        await page.getByRole('checkbox', { name: t(locale, 'flows.PIECE_TABLE.shape.options.EXTENDABLE.label'), exact: true }).check();
        await page.getByRole('checkbox', { name: c3('furniture.openLengthToggle'), exact: true }).check();
        const open = page.getByRole('textbox', { name: new RegExp(`^${escaped(c3('furniture.openLength'))}`) });
        await expect(open).toBeVisible();
        const closedCm = Math.round(Number((await config(room))?.widthM ?? 1.6) * 100);
        await open.fill(String(closedCm + 50)); await open.press('Tab');
        await expect.poll(async () => (await config(room))?.table, { timeout: 15_000 }).toMatchObject({ shape: 'EXTENDABLE', openLengthM: (closedCm + 50) / 100 });
        // „I want a different height (usually 75 cm)”
        await expect(page.getByRole('checkbox', { name: c3('furniture.customHeightToggle').replace('{value}', '75 cm'), exact: true })).toBeVisible();
        // butonul „Reframe” de pe scena
        const reframe = page.getByTestId('reframe-3d');
        await expect(reframe).toHaveAccessibleName(c3('reframeLabel'));
        await reframe.click();
        await expect(page.locator('canvas').first()).toBeVisible();
      }
      done.add(room);
    } else if (getFlow(room).steps.find((step) => step.id === id)?.type === 'upload') {
      // ecranele doar cu fisiere (schita / imaginea 3D) se sar
    } else {
      await answerCurrentScreen(page, locale, (type) => getFlow(type), answers);
    }
    await page.getByRole('button', { name: new RegExp(`^(?:${escaped(t(locale, 'nav.next'))}|${escaped(t(locale, 'nav.toDetails'))})$`) }).click();
    await expect.poll(async () => (await page.locator('[data-question-id]').count()) ? firstQuestion(page) : 'uploads', { message: `Continue from ${here}` }).not.toBe(here);
  }
  expect([...done].sort()).toEqual([...pieces].sort());
  await page.getByRole('button', { name: t(locale, 'nav.continue'), exact: true }).click();
  await fillDetailsAndReview(page, locale);
  const sofa = await reviewCard(page, locale, 'PIECE_SOFA');
  await expect(sofa).toContainText(c3('chips.sofaSleeper'));
  await expect(sofa).toContainText(c3('chips.sofaStorage'));
  await expect(await reviewCard(page, locale, 'PIECE_BED')).toContainText('(other size)');
  await expect(await reviewCard(page, locale, 'PIECE_TABLE')).toContainText(c3('chips.openLength').split('{value}')[0].trim());
  expect(errors).toEqual([]);
});

// ---------------------------------------------------------------------------------------------
// 4. Pagini cu cont (API simulat)
// ---------------------------------------------------------------------------------------------

const nowIso = new Date().toISOString();
const daysFromNow = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString();
const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
const apiPath = (route: Route) => new URL(route.request().url()).pathname.replace(/^.*\/api\/v1/, '');
const accountUser = (role: 'CLIENT' | 'COMPANY_USER') => ({
  id: `${role.toLowerCase()}-e2e`, email: `${role.toLowerCase()}@example.test`, name: 'Cont Test', phone: null, role,
  languagePreference: 'RO', emailVerifiedAt: '2026-01-01T00:00:00.000Z', twoFactorEnabled: false, needsLegalAcceptance: false,
});
const sessionHint = (page: Page, role: string) => page.context().addCookies([{ name: 'mm_session', value: role, url: 'http://127.0.0.1:3100' }]);
// raspunsurile din oficiu pentru paginile cu cont; `routes` raspunde intai
async function mockAccount(page: Page, role: 'CLIENT' | 'COMPANY_USER', routes: (route: Route, path: string, method: string) => Promise<boolean> | boolean) {
  await sessionHint(page, role);
  await page.route('**/api/v1/**', async (route) => {
    const path = apiPath(route);
    const method = route.request().method();
    if (await routes(route, path, method)) return;
    if (path === '/auth/me') return json(route, { user: accountUser(role) });
    if (path.startsWith('/legal/')) return json(route, { published: false });
    if (path === '/notifications/unread-count') return json(route, { count: 0 });
    if (/^\/requests\/[^/]+\/visibility$/.test(path)) return json(route, { projectVisibleInMarketplace: false, contactHolders: [], pastContactAccess: [], coverage: 'UNKNOWN', marketplaceClosedReason: null });
    if (method !== 'GET') return json(route, {});
    return json(route, []);
  });
}

const BALCONY_ANSWERS = fixtureAnswers(getFlow('BALCONY'), 'first');
const expiredRequest = (over: Record<string, unknown> = {}) => ({
  id: 'req-e2e', status: 'EXPIRED', title: 'Balcon — Cluj-Napoca', description: 'Balcon cu rafturi, cerere expirată (e2e).', budgetRange: 'UNDISCLOSED', budgetEstimateRon: null, budgetDeclared: true,
  deadlineBucket: 'FLEXIBLE', includesPaidDesign: false, hasOwnProject: false, addressText: 'Strada Test 1', addressDetails: '', county: 'Cluj', city: 'Cluj-Napoca',
  country: 'RO', lat: null, lng: null, sizing: null, preClaimEditsUsed: 0, postClaimEditsUsed: 0, publishedAt: daysFromNow(-30),
  expiresAt: daysFromNow(-1), cancelledAt: null, repostUsed: false, createdAt: daysFromNow(-30),
  rooms: [{ id: 'room-e2e', roomType: 'BALCONY', lengthM: 2, widthM: 0.4, heightM: 2.5, items: [], answers: BALCONY_ANSWERS, flowVersion: getFlow('BALCONY').version, needsDesignHelp: false }],
  contactPreferences: [{ id: 'contact-e2e', channel: 'EMAIL', value: 'client@example.test' }], attachments: [],
  inspirationPhotoIds: [], inspirationPhotos: [], configuratorState: null, studioScenes: [],
  ...over,
});

test('ro: an expired request offers "Republică cu modificări" — the form opens filled in and saves with a single repost request', async ({ page }) => {
  test.setTimeout(240_000);
  const R = ro.Requests;
  const reposts: unknown[] = [];
  let current = expiredRequest();
  await mockAccount(page, 'CLIENT', (route, path, method) => {
    if (path === '/requests/req-e2e' && method === 'GET') return json(route, current).then(() => true);
    if (path === '/requests/req-e2e/repost-with-changes' && method === 'POST') {
      reposts.push(route.request().postDataJSON());
      current = expiredRequest({ status: 'IN_MARKETPLACE', repostUsed: true, publishedAt: nowIso, expiresAt: daysFromNow(14) });
      return json(route, current).then(() => true);
    }
    if (path.includes('/estimate')) return json(route, { minRon: 0, maxRon: 0 }).then(() => true);
    return false;
  });
  await page.goto('/ro/requests/req-e2e');
  // banda cererii expirate: doua butoane si textul nou
  await expect(page.getByText(R.repostHint, { exact: true })).toBeVisible({ timeout: 60_000 });
  await expect(page.getByRole('button', { name: R.repost, exact: true })).toBeVisible();
  const withChanges = page.getByRole('link', { name: R.repostWithChanges, exact: true });
  await expect(withChanges).toHaveAttribute('href', /\/requests\/req-e2e\/edit$/);
  await withChanges.click();
  await expect(page).toHaveURL(/\/ro\/requests\/req-e2e\/edit$/, { timeout: 60_000 });
  // formularul precompletat: mergem pana la Sumar fara sa completam nimic
  const review = page.getByRole('heading', { name: ro.Configurator.review.title, exact: true });
  const primary = page.getByRole('button', { name: new RegExp(`^(?:${[ro.Configurator.nav.startQuestions, ro.Configurator.nav.next, ro.Configurator.nav.toDetails, ro.Configurator.nav.continue, ro.Configurator.nav.toReview].map(escaped).join('|')})$`) });
  let sawDescription = false;
  for (let i = 0; i < 25 && !(await review.isVisible()); i++) {
    const description = page.getByRole('textbox', { name: R.field.message, exact: true });
    if (await description.isVisible()) {
      await expect(description).toHaveValue('Balcon cu rafturi, cerere expirată (e2e).');
      sawDescription = true;
    }
    await primary.first().click();
    await page.waitForTimeout(400);
  }
  await expect(review).toBeVisible();
  expect(sawDescription, 'Date generale precompletate').toBe(true);
  const save = page.getByRole('button', { name: ro.Configurator.review.saveRepost, exact: true });
  await expect(save).toHaveCount(1);
  await save.click();
  await expect.poll(() => reposts.length, { timeout: 30_000 }).toBe(1);
  await page.waitForTimeout(1_500);
  expect(reposts).toHaveLength(1);
});

test('ro: the client keeps the history of answered company questions on the offers page', async ({ page }) => {
  test.setTimeout(120_000);
  const L = ro.Lifecycle;
  await mockAccount(page, 'CLIENT', (route, path) => {
    if (path === '/requests/req-e2e') return json(route, expiredRequest({ status: 'IN_MARKETPLACE', expiresAt: daysFromNow(10) })).then(() => true);
    if (path === '/client/clarifications/request/req-e2e') return json(route, [
      { id: 'a1', claimSlotId: 's2', questionText: 'Pereții sunt drepți?', answerText: 'Da, sunt drepți.', status: 'ANSWERED', answeredAt: '2026-11-11T10:00:00.000Z', createdAt: '2026-11-10T10:00:00.000Z', companyName: 'B Design' },
    ]).then(() => true);
    return false;
  });
  await page.goto('/ro/requests/req-e2e/offers');
  const history = page.getByRole('heading', { name: L.clarificationHistory.title, exact: true });
  await expect(history).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText('B Design a întrebat pe 10 noiembrie 2026', { exact: true })).toBeVisible();
  await expect(page.getByText('Pereții sunt drepți?')).toBeVisible();
  await expect(page.getByText('Da, sunt drepți.')).toBeVisible();
  await expect(page.getByText('Ai răspuns pe 11 noiembrie 2026', { exact: true })).toBeVisible();
  // fara intrebare in asteptare: niciun formular de raspuns
  await expect(page.getByRole('button', { name: L.sendAnswer, exact: true })).toHaveCount(0);
});

const COMPANY = {
  id: 'co-e2e', name: 'Firma Test', cui: 'RO123', regComNumber: 'J12/1/2020', isVatPayer: true, billingEmail: null, status: 'APPROVED',
  addressText: 'Strada Firmei 1', county: 'Cluj', city: 'Cluj-Napoca', lat: 46.77, lng: 23.6, rejectedAt: null, rejectionReason: null,
  suspendedUntil: null, createdAt: '2026-01-01T00:00:00.000Z', myRole: 'OWNER', permissions: [...COMPANY_ROLE_PERMISSIONS.OWNER], members: [], locations: [], portfolio: [], offerFieldPermissions: [],
};

test('ro: the company wallet shows the credit history and cancels a pending payment after a confirmation dialog', async ({ page }) => {
  test.setTimeout(120_000);
  const B = ro.Billing;
  const cancels: string[] = [];
  const pendingOrder = {
    id: 'abcdef12-3456-4789-8abc-def012345678', orderType: 'CREDIT_PACKAGE', status: 'PENDING', planTier: null, credits: 100, baseAmountRon: 100, vatRate: 21,
    vatAmountRon: 21, totalRon: 121, invoiceSeries: null, invoiceNumber: null, invoiceLabel: null, paymentSource: null, hasStripeSession: false,
    createdAt: nowIso, confirmedAt: null, testMode: false, paymentClaimedAt: null, transferExpiresAt: daysFromNow(7),
  };
  let orders = [pendingOrder];
  const historyItem = (over: Record<string, unknown>) => ({
    id: 'i1', createdAt: '2026-11-14T08:30:00.000Z', type: 'GRANT', kind: 'OPENING_BALANCE', reason: 'OPENING_BALANCE', amount: 200, availableDelta: 200, reservedDelta: 0,
    availableAfter: 200, reservedAfter: 0, claimSlotId: null, requestId: null, requestTitle: null, ...over,
  });
  await mockAccount(page, 'COMPANY_USER', (route, path, method) => {
    if (path === '/companies/me') return json(route, COMPANY).then(() => true);
    if (path === '/billing/wallet') return json(route, { companyId: 'co-e2e', balance: 197, reserved: 3, available: 194 }).then(() => true);
    if (path === '/billing/subscription' || path === '/billing/entitlements' || path === '/penalties/me') return json(route, null).then(() => true);
    if (path === '/billing/payment-instructions') return json(route, { stripeEnabled: false, billingReady: true, stripeMode: 'live' }).then(() => true);
    if (path === '/billing/credit-history') return json(route, { nextCursor: null, items: [
      historyItem({ id: 'i3', type: 'REFUND', kind: 'REFUND', reason: 'SLA_BREACH', amount: 5, availableDelta: 5, reservedDelta: -5, availableAfter: 197, reservedAfter: 3, claimSlotId: 's1', requestId: 'r1', requestTitle: 'Bucătărie Ana' }),
      historyItem({ id: 'i1' }),
    ] }).then(() => true);
    if (path === '/billing/orders' && method === 'GET') return json(route, orders).then(() => true);
    const cancel = path.match(/^\/billing\/orders\/([^/]+)\/cancel$/);
    if (cancel && method === 'POST') {
      cancels.push(cancel[1]);
      orders = [{ ...pendingOrder, status: 'CANCELLED' }];
      return json(route, orders[0]).then(() => true);
    }
    return false;
  });
  await page.goto('/ro/marketplace/wallet');
  // fila „Istoric credite” in navigarea paginii si randurile istoricului
  await expect(page.getByRole('link', { name: B.history.title, exact: true }).first()).toBeVisible({ timeout: 60_000 });
  const rows = page.getByTestId('credit-history-row');
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).toContainText(B.history.kind.REFUND);
  await expect(rows.nth(0)).toContainText(B.history.reason.SLA_BREACH);
  await expect(rows.nth(0).getByRole('link', { name: 'Bucătărie Ana' })).toHaveAttribute('href', /\/marketplace\/claims\/s1$/);
  await expect(rows.nth(0)).toContainText('+5 disponibile');
  await expect(rows.nth(1)).toContainText(B.history.kind.OPENING_BALANCE);
  // „Anulează plata”: dialog in aplicatie; „Nu” nu trimite nimic, confirmarea trimite o singura cerere
  await page.getByRole('button', { name: B.cancelOrder.action, exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('121,00 lei · referința #ABCDEF12');
  await dialog.getByRole('button', { name: B.cancelOrder.keep, exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(cancels).toEqual([]);
  await page.getByRole('button', { name: B.cancelOrder.action, exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: B.cancelOrder.confirm, exact: true }).click();
  await expect.poll(() => cancels).toEqual([pendingOrder.id]);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: B.cancelOrder.action, exact: true })).toHaveCount(0);
});

test('ro: the company dashboard shows "Pregătește-ți firma" with "1 din 3" and links to each step', async ({ page }) => {
  test.setTimeout(120_000);
  const S = ro.Dashboard.setup;
  await mockAccount(page, 'COMPANY_USER', (route, path) => {
    if (path === '/companies/me') return json(route, COMPANY).then(() => true);
    if (path === '/companies/me/dashboard-stats') return json(route, {
      claimsTotal: 0, claimsActive: 0, claimsByStatus: {}, perMember: [], quotesSent: 0, quotesTotals: { RON: 0, EUR: 0 },
      wallet: { balance: 200, reserved: 0, available: 200 }, creditsConsumed7d: 0, creditsConsumed30d: 0, activePenaltyPoints: 0, actions: [],
      setup: { requiredDone: 1, requiredTotal: 3, complete: false, steps: [
        { key: 'PORTFOLIO', done: false, optional: false }, { key: 'LOCATIONS', done: true, optional: false }, { key: 'TEAM', done: false, optional: true },
        { key: 'BILLING_EMAIL', done: false, optional: false }, { key: 'OFFER_PERMISSIONS', done: false, optional: true },
      ] },
    }).then(() => true);
    if (path === '/billing/wallet') return json(route, { companyId: 'co-e2e', balance: 200, reserved: 0, available: 200 }).then(() => true);
    if (path === '/billing/subscription' || path === '/billing/entitlements' || path === '/penalties/me') return json(route, null).then(() => true);
    return false;
  });
  await page.goto('/ro/dashboard');
  const card = page.locator('section[aria-labelledby="company-setup-title"]');
  await expect(card.getByRole('heading', { name: S.title, exact: true })).toBeVisible({ timeout: 60_000 });
  await expect(card).toContainText(S.progress.replace('{done}', '1').replace('{total}', '3'));
  await expect(card.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '1');
  for (const [key, href] of [['PORTFOLIO', 'portfolio'], ['LOCATIONS', 'locations'], ['TEAM', 'team'], ['BILLING_EMAIL', 'profile'], ['OFFER_PERMISSIONS', 'permissions']] as const) {
    const title = S.step[key].title;
    await expect(card.getByRole('link', { name: new RegExp(`${escaped(title)}$`) })).toHaveAttribute('href', new RegExp(`/company#${href}$`));
  }
  // facut → „Vezi”; de facut → „Mergi”
  await expect(card.getByRole('link', { name: new RegExp(`^${escaped(S.review)}\\s*:\\s*${escaped(S.step.LOCATIONS.title)}$`) })).toHaveCount(1);
  await expect(card.getByRole('link', { name: new RegExp(`^${escaped(S.go)}\\s*:\\s*${escaped(S.step.PORTFOLIO.title)}$`) })).toHaveCount(1);
});

// ---------------------------------------------------------------------------------------------
// 5. Telefon: bara lipita si indiciul „de obicei …” pe ecranele noi
// ---------------------------------------------------------------------------------------------

test('ro, phone: the sticky bar stays right on the new screens and the "usually" hint keeps its row', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'Bara lipita jos exista doar pe ecrane mici');
  test.setTimeout(300_000);
  const locale = 'ro';
  await mockGuestDraft(page);
  await startWithRooms(page, locale, ['BEDROOM']);
  const seen: string[] = [];
  let hintChecked = false;
  await walkRoomQuestions(page, locale, ['BEDROOM'], (type) => getFlow(type), undefined, {
    preferred: { BEDROOM: { piecesNeeded: ['BED_FRAME', 'WARDROBE'] } },
    onScreen: async () => {
      seen.push(await firstQuestion(page));
      const name = t(locale, 'nav.next');
      await expect(page.getByRole('button', { name, exact: true })).toHaveCount(1);
      const inBar = page.locator('[data-sticky-action-bar]').getByRole('button', { name, exact: true });
      await expect(inBar).toHaveCount(1);
      await expect(inBar).toBeInViewport({ ratio: 1 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'fara derulare orizontala').toBe(true);
    },
    onDimensions: async (block, step, answers) => {
      const values = await fillRequiredSlots(block, locale, step as DimensionGroupStep, answers);
      // dimensiunile saltelei (alt ecran cu campuri) nu au sloturi optionale
      if (step.id !== 'dimensions') return values;
      const hint = block.locator('[data-typical-hint]');
      await expect(hint).toHaveCount(1);
      // „de obicei 2,4 m · 1,8–3,2 m”
      await expect(hint).toContainText(t(locale, 'dimensions.typicalHint').replace('{value}', '2,4 m'));
      const field = dimensionInput(block, locale, 'flows.BEDROOM.dimensions.slots.wardrobeHeight', true);
      const [hintBox, fieldBox] = [await hint.boundingBox(), await field.boundingBox()];
      // indiciul sta sub camp, pe un singur rand, in latimea campului
      expect(hintBox!.y).toBeGreaterThanOrEqual(fieldBox!.y + fieldBox!.height - 1);
      expect(hintBox!.height, 'un singur rand').toBeLessThan(28);
      expect(hintBox!.x + hintBox!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
      hintChecked = true;
      return values;
    },
  });
  expect(hintChecked).toBe(true);
  // ecranele noi ale etapei 10 au fost parcurse cu bara lipita
  expect(seen).toEqual(expect.arrayContaining(['BEDROOM.bedFabric', 'BEDROOM.dimensions', 'BEDROOM.wardrobeInterior']));
});

import { expect, type Locator, type Page } from '@playwright/test';
import { getFlow, ROOM_KIND, ROOM_TYPES, compareRoomTypes, visibleOptions, validateRoomAnswers, type AnswerMap, type ChoiceOption, type QuestionStep, type RoomFlow, type RoomType } from '../../../../packages/shared/src';
import en from '../../src/messages/en.json';
import ro from '../../src/messages/ro.json';

export const AUDIT_ROOM_TYPES = ROOM_TYPES.filter((type) => ROOM_KIND[type] === 'room').sort(compareRoomTypes);
export const GREEN_AUDIT_ORIGIN = 'https://app-green-production-7958.up.railway.app';
export const AUDIT_DETAILS = { description: 'Green form audit only. All ten room types and their visible questions are checked through the interface.', addressText: 'Green form audit only', city: 'Bucuresti', county: 'Bucuresti', country: 'RO', email: 'green-form-audit@example.test' };
// etapa 3: suma aleasa pe glisor in rularea EN (scara fixa 1.000–100.000 lei cand estimarea e 0)
export const AUDIT_BUDGET_RON = 12_000;
const AUDIT_BUDGET_TEXT = { en: '12,000 lei' };
const AUDIT_PNG_NAME ='green-form-audit-fixture.png';
type Locale = 'en' | 'ro';
const dictionaries = { en, ro };
export function textFor(locale: Locale, path: string): string {
  const value = path.split('.').reduce<unknown>((object, key) => (object as Record<string, unknown>)?.[key], dictionaries[locale]);
  if (typeof value !== 'string' || !value.trim()) throw new Error(`Missing ${locale} translation: ${path}`);
  return value;
}
const escaped = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// afisarea campurilor de dimensiuni: virgula in romana, punct in engleza
const decimalText = (value: number, locale: Locale) => (locale === 'ro' ? String(value).replace('.', ',') : String(value));

// Doar transportul anonim este simulat; toate raspunsurile provin din interactiuni UI.
export async function mockGuestDraft(page: Page) {
  let snapshot: unknown = null;
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    // etapa 5 (f3): vizitatorul fara sesiune primeste { user: null } pe /auth/me (401 = sesiune pierduta)
    if (path.endsWith('/auth/me')) return route.fulfill({ json: { user: null } });
    if (path.includes('/auth/')) return route.fulfill({ status: 401, json: { error: { code: 'UNAUTHORIZED', message: 'Guest audit' } } });
    if (path.endsWith('/requests/drafts') && request.method() === 'POST') return route.fulfill({ status: 201, json: { draftToken: 'local-audit-only' } });
    if (path.endsWith('/requests/drafts/local-audit-only')) {
      if (request.method() === 'PATCH') snapshot = request.postDataJSON().configuratorState;
      return route.fulfill({ json: { id: 'audit-draft', attachments: [], configuratorState: snapshot } });
    }
    // etapa 5 (a6): acoperirea zonei in Sumar; UNKNOWN = fara avertisment
    if (path.endsWith('/coverage') && request.method() === 'POST') return route.fulfill({ json: { coverage: 'UNKNOWN' } });
    if (path.includes('/estimate')) return route.fulfill({ json: { minRon: 0, maxRon: 0 } });
    if (path.includes('/inspiration')) return route.fulfill({ json: { items: [], total: 0, nextCursor: null } });
    if (path.endsWith('/legal/operator')) return route.fulfill({ json: { published: false } });
    throw new Error(`Unexpected audit request: ${request.method()} ${path.replace(/drafts\/[^/]+/, 'drafts/[redacted]')}`);
  });
}

async function auditImages(block: Locator, seen: Set<string>) {
  const images = block.locator('img');
  for (let i = 0; i < await images.count(); i++) {
    const img = images.nth(i);
    await img.scrollIntoViewIfNeeded();
    await expect.poll(() => img.evaluate((element: HTMLImageElement) => element.complete && element.naturalWidth > 0 && element.naturalHeight > 0)).toBe(true);
    seen.add(await img.getAttribute('src') ?? '');
  }
  const backgrounds = await block.locator('[style*="background-image"]').evaluateAll((elements) => elements.flatMap((element) => {
    const value = (element as HTMLElement).style.backgroundImage;
    return [...value.matchAll(/url\(["']?([^"')]+)["']?\)/g)].map((match) => match[1]);
  }));
  for (const source of backgrounds) {
    if (seen.has(source)) continue;
    const loaded = await block.evaluate(async (_element, url) => new Promise<boolean>((resolve) => {
      const image = new Image();
      const timeout = setTimeout(() => resolve(false), 10_000);
      image.onload = () => { clearTimeout(timeout); resolve(image.naturalWidth > 0 && image.naturalHeight > 0); };
      image.onerror = () => { clearTimeout(timeout); resolve(false); };
      image.src = url;
    }), source);
    expect(loaded, `Illustration ${source}`).toBe(true);
    seen.add(source);
  }
}

// etapa 6: usile batante (dulapul din dormitor / hol, dressingul) fac sa apara intrebarea despre deschidere
const preferred: Record<string, string> = {
  layout: 'U_SHAPE', wallsUsed: 'U_SHAPE', storageStyle: 'MIXED', bedSize: 'CUSTOM',
  bedStorage: 'DRAWERS', tvStyle: 'COMPLEX_UNIT', deskShape: 'U_SHAPE', nightstandsCount: 'TWO', applianceSetup: 'SIDE_BY_SIDE',
  wardrobeDoorType: 'HINGED', doorType: 'HINGED',
};
// etapa 6: "Acelasi material si aceeasi deschidere pentru toate piesele?" — "Da" in EN, "Nu" in RO
// (ambele drumuri, ca la buget); celelalte intrebari da / nu obligatorii primesc "Da"
export const SAME_FINISH_ANSWER: Record<Locale, boolean> = { en: true, ro: false };
// etapa 8: un test poate completa singur un ecran de dimensiuni (intoarce valorile in metri)
export type DimensionsHook = (block: Locator, step: QuestionStep) => Promise<Record<string, number>>;
async function answerQuestion(block: Locator, step: QuestionStep, answers: AnswerMap, locale: Locale, images: Set<string>, onDimensions?: DimensionsHook) {
  const t = (key: string) => textFor(locale, `Configurator.${key}`);
  if (step.type === 'dimension-group' && onDimensions) {
    answers[step.id] = await onDimensions(block, step);
    return;
  }
  // bifa compacta (kitchen v3): fara titlu propriu, doar eticheta bifei
  if (step.type === 'boolean' && step.toggleStyle === 'checkbox') {
    await expect(block.getByText(t(step.cardLabelKey ?? step.titleKey), { exact: true })).toBeVisible();
    await block.getByRole('checkbox').check();
    answers[step.id] = true;
    return;
  }
  await expect(block.getByRole('heading', { name: t(step.titleKey), exact: true })).toBeVisible();
  if (step.subtitleKey) await expect(block.getByText(t(step.subtitleKey), { exact: true })).toBeVisible();
  await auditImages(block, images);
  if (step.type === 'single-choice' || step.type === 'multi-choice') {
    const options = visibleOptions(step, answers);
    const optionButton = (option: ChoiceOption) => block.getByRole('button', { name: new RegExp(`^${escaped(t(option.labelKey))}${option.descriptionKey ? `(?:\\s${escaped(t(option.descriptionKey))})?` : ''}(?:\\s${escaped(t('info.recommended'))})?$`) });
    for (const option of options) {
      const button = optionButton(option);
      await expect(button).toBeVisible();
      expect(await button.locator('svg, img, [data-showroom-concept]').count(), `${step.id}.${option.value} visual`).toBeGreaterThan(0);
    }
    // etapa 6: optiunile `exclusive` ("Nu stiu — vreau recomandarea firmei", "Fara usi sau sertare")
    // nu se bifeaza impreuna cu altele; se aleg doar optiunile obisnuite
    const regular = options.filter((option) => !option.exclusive);
    const exclusive = options.filter((option) => option.exclusive);
    const chosen = step.type === 'single-choice'
      ? [options.find((option) => option.value === preferred[step.id]) ?? options.find((option) => option.value === 'ALTUL') ?? options[0]]
      : regular.slice(0, step.maxSelected ?? regular.length);
    if (step.type === 'multi-choice' && exclusive.length > 0 && chosen.length > 0) {
      // o optiune exclusiva goleste restul; o optiune obisnuita o scoate pe cea exclusiva
      await optionButton(chosen[0]).click();
      await optionButton(exclusive[0]).click();
      await expect(optionButton(exclusive[0])).toHaveAttribute('aria-pressed', 'true');
      await expect(optionButton(chosen[0])).toHaveAttribute('aria-pressed', 'false');
    }
    for (const option of chosen) await optionButton(option).click();
    if (step.type === 'multi-choice') {
      for (const option of chosen) await expect(optionButton(option)).toHaveAttribute('aria-pressed', 'true');
      for (const option of exclusive) await expect(optionButton(option)).toHaveAttribute('aria-pressed', 'false');
    }
    answers[step.id] = step.type === 'single-choice' ? chosen[0].value : chosen.map((option) => option.value);
  } else if (step.type === 'boolean') {
    // etapa 6 (M1): da / nu obligatoriu pe un ecran cu alte intrebari = perechea "Da" / "Nu", nimic ales
    const pair = block.getByRole('group', { name: t(step.titleKey), exact: true });
    if (!step.optional && await block.locator('[data-boolean-pair]').count()) {
      const yes = pair.getByRole('button', { name: t('common.boolean.yes'), exact: true });
      const no = pair.getByRole('button', { name: t('common.boolean.no'), exact: true });
      await expect(yes).toHaveAttribute('aria-pressed', 'false');
      await expect(no).toHaveAttribute('aria-pressed', 'false');
      const choice = step.id === 'sameFinishAll' ? SAME_FINISH_ANSWER[locale] : true;
      await (choice ? yes : no).click();
      await expect(yes).toHaveAttribute('aria-pressed', String(choice));
      await expect(no).toHaveAttribute('aria-pressed', String(!choice));
      answers[step.id] = choice;
      return;
    }
    await block.getByRole('button', { name: t(step.cardLabelKey ?? 'common.boolean.yes'), exact: true }).click();
    answers[step.id] = true;
  } else if (step.type === 'text') {
    answers[step.id] = 'Audit: custom material and construction details for workshop confirmation.'.slice(0, step.maxLength);
    await block.getByRole('textbox').fill(answers[step.id] as string);
  } else if (step.type === 'number') {
    answers[step.id] = Math.min(step.max, Math.max(step.min, 2));
    await block.getByRole('textbox').fill(decimalText(answers[step.id] as number, locale));
  } else if (step.type === 'dimension-group') {
    await block.getByRole('button', { name: 'm', exact: true }).click();
    const values: Record<string, number> = {};
    for (const slot of step.slots(answers)) {
      const target = /height/i.test(slot.id) ? 2.6 : /depth/i.test(slot.id) ? 0.6 : /bedCustomWidth/.test(slot.id) ? 1.8 : /bedCustomLength/.test(slot.id) ? 2 : 2.4;
      const increment = slot.step ?? 0.1;
      values[slot.id] = Math.round(Math.min(slot.max, Math.max(slot.min, Math.round(target / increment) * increment)) * 1000) / 1000;
      // campurile de dimensiuni sunt type=text + inputMode=decimal; in romana clientul scrie cu virgula
      const input = block.getByRole('textbox', { name: new RegExp(`${escaped(t(slot.labelKey))}$`) });
      await expect(input).toHaveAttribute('inputmode', 'decimal');
      await input.fill(decimalText(values[slot.id], locale));
      await input.blur();
      await expect(input).toHaveValue(decimalText(values[slot.id], locale));
    }
    answers[step.id] = values;
    if (step.id === 'bedCustomSize') await expect(block.locator('[data-dimension-figure="mattress"]')).toBeVisible();
  } else if (step.type === 'upload') {
    expect(step.optional, `${step.id} cannot be skipped`).toBe(true);
  } else throw new Error(`Unhandled room question type ${step.type}`);
}

export async function completeAllRoomRequest(page: Page, locale: Locale, origin = '', capture?: (name: string, block: Locator) => Promise<void>, uploadFixture?: () => Promise<void>) {
  const t = (key: string) => textFor(locale, `Configurator.${key}`);
  const tr = (key: string) => textFor(locale, `Requests.${key}`);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`${origin}/${locale}/requests/new`);
  await page.getByRole('button', { name: new RegExp(`^${escaped(t('start.STANDARD.title'))}`) }).click();
  for (const roomType of AUDIT_ROOM_TYPES) await page.getByRole('button', { name: t('cart.addOne').replace('{type}', t(`rooms.type.${roomType}`)), exact: true }).click();
  // etapa 2 (b8): o bifa "am nevoie de ajutor" pe fiecare camera, nebifata in "Stiu ce vreau"; modul apare pe o singura linie
  const designHelp = page.locator('[data-cart-design-help]');
  await expect(designHelp.getByRole('checkbox')).toHaveCount(AUDIT_ROOM_TYPES.length);
  await expect(designHelp.getByRole('checkbox', { checked: true })).toHaveCount(0);
  await expect(page.locator('[data-cart-mode]')).toContainText(t('start.STANDARD.title'));
  await page.getByRole('button', { name: t('nav.startQuestions'), exact: true }).click();
  const { answers, questions, images } = await walkRoomQuestions(page, locale, AUDIT_ROOM_TYPES, (type) => getFlow(type), capture);
  if (uploadFixture) await uploadFixture();
  await page.getByRole('button', { name: t('nav.continue'), exact: true }).click();
  await fillDetailsAndReview(page, locale);
  for (const type of AUDIT_ROOM_TYPES) await expect(page.getByRole('heading', { name: t(`rooms.type.${type}`), exact: true })).toBeVisible();
  await expect(page.getByText(t('review.roomIncomplete'), { exact: true })).toHaveCount(0);
  return { locale, rooms: AUDIT_ROOM_TYPES.map((type) => ({ type, version: getFlow(type).version, questions: [...questions.get(type)!], answers: answers.get(type) })), images: [...images] };
}

// Parcurge ecranele de intrebari ale camerelor pana la "Fisiere"; `flowOf` da versiunea fiecarei camere
// (cea curenta pentru camerele noi, versiunea fixata pentru o ciorna veche).
// `ownProject`: modul "Am deja un proiect" (pasii de dimensiuni se sar); `approxLength`: textul scris in
// campul "Lungime aproximativa (m)" de pe ultimul ecran al camerei, cand apare (etapa 5, d3).
// etapa 8: `onScreen` = apelat la inceputul fiecarui ecran (contor, bara lipita); `onDimensions` = vezi DimensionsHook.
export async function walkRoomQuestions(page: Page, locale: Locale, roomTypes: readonly RoomType[], flowOf: (type: RoomType) => RoomFlow, capture?: (name: string, block: Locator) => Promise<void>, opts: { ownProject?: boolean; approxLength?: string; onScreen?: (screen: number) => Promise<void>; onDimensions?: DimensionsHook } = {}) {
  const t = (key: string) => textFor(locale, `Configurator.${key}`);
  const answers = new Map<RoomType, AnswerMap>(roomTypes.map((type) => [type, {}]));
  const questions = new Map<RoomType, Set<string>>(roomTypes.map((type) => [type, new Set()]));
  const images = new Set<string>();
  for (let screen = 0; screen < 250; screen++) {
    if (await page.getByRole('heading', { name: t('uploads.title'), exact: true }).isVisible()) break;
    await expect(page.locator('[data-question-id]').first()).toBeVisible();
    const before = await page.locator('[data-question-id]').first().evaluate((element) => `${element.getAttribute('data-room-type')}.${element.getAttribute('data-question-id')}`);
    if (opts.onScreen) await opts.onScreen(screen);
    const processed = new Set<string>();
    for (let pass = 0; pass < 30; pass++) {
      const metadata = await page.locator('[data-question-id]').evaluateAll((elements) => elements.map((element) => ({ id: element.getAttribute('data-question-id')!, room: element.getAttribute('data-room-type')! })));
      const next = metadata.find((entry) => !processed.has(`${entry.room}.${entry.id}`));
      if (!next) break;
      const type = next.room as RoomType;
      const step = flowOf(type).steps.find((question) => question.id === next.id);
      if (!step) throw new Error(`Unknown question ${type}.${next.id} (flow v${flowOf(type).version})`);
      const block = page.locator(`[data-question-id="${next.id}"][data-room-type="${type}"]`);
      await answerQuestion(block, step, answers.get(type)!, locale, images, opts.onDimensions);
      if (capture && ['LIVING.piecesNeeded', 'DRESSING.interiorModules', 'BEDROOM.bedStorage', 'BEDROOM.bedCustomSize', 'LAUNDRY.applianceSetup'].includes(`${type}.${next.id}`)) await capture(`${type}-${next.id}`, block);
      processed.add(`${type}.${next.id}`);
      questions.get(type)!.add(next.id);
    }
    const approx = page.locator('[data-approx-length-field]');
    if (opts.approxLength !== undefined && await approx.isVisible()) {
      await approx.getByRole('textbox', { name: t('approxLength.label'), exact: true }).fill(opts.approxLength);
    }
    const nextButton = page.getByRole('button', { name: new RegExp(`^(?:${escaped(t('nav.next'))}|${escaped(t('nav.toDetails'))})$`) });
    await nextButton.click();
    await expect.poll(async () => {
      const first = page.locator('[data-question-id]').first();
      return await first.count() ? first.evaluate((element) => `${element.getAttribute('data-room-type')}.${element.getAttribute('data-question-id')}`) : 'uploads';
    }, { message: `Continue from ${before}` }).not.toBe(before);
  }
  await expect(page.getByRole('heading', { name: t('uploads.title'), exact: true })).toBeVisible();
  for (const type of roomTypes) {
    expect(questions.get(type)!.size, type).toBeGreaterThan(0);
    expect(validateRoomAnswers(type, answers.get(type)!, { partial: false, version: flowOf(type).version, ownProject: opts.ownProject }), `${type} validation`).toEqual({ ok: true });
  }
  return { answers, questions, images };
}

// Date generale (EN = suma pe glisor, RO = "Prefer sa nu spun") → Sumar
export async function fillDetailsAndReview(page: Page, locale: Locale) {
  const t = (key: string) => textFor(locale, `Configurator.${key}`);
  const tr = (key: string) => textFor(locale, `Requests.${key}`);
  // etapa 2 (b2): Date generale se salveaza singure in ciorna, inainte de "Continua la sumar"
  const autosaved = page.waitForRequest((request) => request.method() === 'PATCH'
    && /\/api\/v1\/requests\/drafts\/[^/]+$/.test(new URL(request.url()).pathname)
    && request.postDataJSON()?.configuratorState?.details?.description === AUDIT_DETAILS.description, { timeout: 15_000 });
  await page.getByRole('textbox', { name: tr('field.message'), exact: true }).fill(AUDIT_DETAILS.description);
  await autosaved;
  await page.getByRole('button', { name: tr('deadline.FLEXIBLE'), exact: true }).click();
  await page.getByRole('textbox', { name: tr('field.street'), exact: true }).fill(AUDIT_DETAILS.addressText);
  await page.getByRole('textbox', { name: tr('field.county'), exact: true }).fill(AUDIT_DETAILS.county);
  await page.getByRole('textbox', { name: tr('field.city'), exact: true }).fill(AUDIT_DETAILS.city);
  await page.getByRole('textbox', { name: tr('field.contactValue'), exact: true }).fill(AUDIT_DETAILS.email);
  // etapa 3 (b11): glisorul porneste fara suma; fara o alegere nu se trece la Sumar
  const budgetSlider = page.getByRole('slider', { name: tr('field.budgetRange'), exact: true });
  await expect(page.getByTestId('budget-value')).toHaveText(tr('budgetChoose'));
  await expect(budgetSlider).toHaveAttribute('data-unset', 'true');
  await page.getByRole('button', { name: t('nav.toReview'), exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: tr('validation.budgetRequired') })).toBeVisible();
  await expect(page.getByRole('heading', { name: t('review.title'), exact: true })).toHaveCount(0);
  // EN muta glisorul (suma aleasa), RO bifeaza "Prefer sa nu spun" — ambele drumuri acoperite
  const budgetText = locale === 'en' ? AUDIT_BUDGET_TEXT.en : tr('budgetView.undisclosed');
  if (locale === 'en') {
    await budgetSlider.fill(String(AUDIT_BUDGET_RON));
    await expect(page.getByTestId('budget-value')).toHaveText(AUDIT_BUDGET_TEXT.en);
  } else {
    await page.getByRole('checkbox', { name: tr('budget.UNDISCLOSED'), exact: true }).check();
    await expect(budgetSlider).toBeDisabled();
  }
  await expect(page.getByRole('alert').filter({ hasText: tr('validation.budgetRequired') })).toHaveCount(0);
  await page.getByRole('button', { name: t('nav.toReview'), exact: true }).click();
  await expect(page.getByRole('heading', { name: t('review.title'), exact: true })).toBeVisible();
  // Sumarul arata suma in lei (nu RON, nu treapta) sau "Buget nedeclarat"
  await expect(page.getByText(budgetText, { exact: true })).toBeVisible();
}

export async function uploadSyntheticAuditPng(page: Page, locale: Locale) {
  if (new URL(page.url()).origin !== GREEN_AUDIT_ORIGIN) throw new Error('Real upload audit is restricted to isolated Green.');
  const encoded = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 32;
    const context = canvas.getContext('2d')!;
    context.fillStyle = '#ba9467'; context.fillRect(0, 0, 32, 32);
    context.fillStyle = '#26342d'; context.fillRect(8, 8, 16, 16);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  const putStatuses: number[] = [];
  const onResponse = (response: import('@playwright/test').Response) => {
    if (response.request().method() === 'PUT') putStatuses.push(response.status());
  };
  page.on('response', onResponse);
  const presignResponse = page.waitForResponse((response) => response.request().method() === 'POST' && /\/api\/v1\/requests\/drafts\/[^/]+\/attachments$/.test(new URL(response.url()).pathname));
  const safeResponse = page.waitForResponse(async (response) => {
    if (!response.ok() || !/\/attachments\/[^/]+\/confirm$/.test(new URL(response.url()).pathname)) return false;
    const data = await response.json().catch(() => null);
    return data?.filename === AUDIT_PNG_NAME && data?.status === 'SAFE';
  }, { timeout: 60_000 });
  await page.locator('input[type="file"]').setInputFiles({ name: AUDIT_PNG_NAME, mimeType: 'image/png', buffer: Buffer.from(encoded, 'base64') });
  expect((await presignResponse).ok(), 'Synthetic attachment presign').toBe(true);
  await safeResponse;
  page.off('response', onResponse);
  expect(putStatuses.some((status) => status >= 200 && status < 300), 'Signed upload completed').toBe(true);
  await expect(page.getByText(AUDIT_PNG_NAME, { exact: true })).toBeVisible();
  await expect(page.getByText(textFor(locale, 'Configurator.uploads.scanning'), { exact: true })).toHaveCount(0);
  // incarcare pe rand: randul "Se incarca {nume}…" dispare, iar fisierul nu apare in lista "Nu am putut adauga"
  await expect(page.getByText(textFor(locale, 'Configurator.uploads.uploadingFile').replace('{name}', AUDIT_PNG_NAME), { exact: true })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: textFor(locale, 'Configurator.uploads.rejectedTitle'), exact: true })).toHaveCount(0);
}

export async function reloadAndPublishGreenAudit(page: Page, locale: Locale, expectedRooms: { roomType: string; answers: unknown; flowVersion: number }[], password: string) {
  if (new URL(page.url()).origin !== GREEN_AUDIT_ORIGIN) throw new Error('Publication audit is restricted to isolated Green.');
  const t = (key: string) => textFor(locale, `Configurator.${key}`);
  const savedResponse = page.waitForResponse((response) => response.request().method() === 'GET' && /\/api\/v1\/requests\/drafts\/[^/]+$/.test(new URL(response.url()).pathname));
  await page.reload();
  const saved = await savedResponse;
  expect(saved.status(), 'Reload saved draft').toBe(200);
  const savedData = await saved.json();
  expect(savedData.configuratorState.phase).toBe('review');
  expect(savedData.configuratorState.roomInstances.map(({ roomType, answers, flowVersion }: typeof expectedRooms[number]) => ({ roomType, answers, flowVersion }))).toEqual(expectedRooms);
  await page.getByRole('button', { name: t('resume.continue'), exact: true }).click();
  await expect(page.getByRole('heading', { name: t('review.title'), exact: true })).toBeVisible();
  let loginStatus: number;
  try {
    const login = await page.request.post(`${GREEN_AUDIT_ORIGIN}/api/v1/auth/login`, { data: { email: AUDIT_DETAILS.email, password } });
    loginStatus = login.status();
  } catch { throw new Error('The isolated Green audit login request failed.'); }
  expect(loginStatus, 'Synthetic Green account login').toBeLessThan(300);
  await page.reload();
  await page.getByRole('button', { name: t('resume.continue'), exact: true }).click();
  const publishedResponse = page.waitForResponse((response) => response.request().method() === 'POST' && /\/api\/v1\/requests\/drafts\/[^/]+\/publish$/.test(new URL(response.url()).pathname));
  await page.getByRole('button', { name: textFor(locale, 'Requests.publish'), exact: true }).click();
  const published = await publishedResponse;
  if (!published.ok()) {
    const failure = await published.json().catch(() => null);
    throw new Error(`Green publish failed: HTTP ${published.status()}, ${failure?.error?.code ?? 'unknown error'}`);
  }
  const result = await published.json();
  expect(result.status).toBe('IN_MARKETPLACE');
  expect(result.rooms.map((room: { roomType: string }) => room.roomType).sort()).toEqual([...AUDIT_ROOM_TYPES].sort());
  await expect(page).toHaveURL(new RegExp(`/${locale}/requests/${result.id}$`));
  const persisted = await page.request.get(`${GREEN_AUDIT_ORIGIN}/api/v1/requests/${result.id}`);
  expect(persisted.status(), 'Published request persisted').toBe(200);
  const readBack = await persisted.json();
  expect(readBack.rooms.map((room: { roomType: string }) => room.roomType).sort()).toEqual([...AUDIT_ROOM_TYPES].sort());
  expect(readBack.publishedAt).toBeTruthy();
  const attachment = readBack.attachments.find((item: { filename: string }) => item.filename === AUDIT_PNG_NAME);
  expect(attachment?.status, 'Published synthetic attachment').toBe('SAFE');
  return { id: readBack.id, status: readBack.status, publishedAt: readBack.publishedAt, roomTypes: readBack.rooms.map((room: { roomType: string }) => room.roomType), attachment: { filename: attachment.filename, mimeType: attachment.mimeType, status: attachment.status } };
}

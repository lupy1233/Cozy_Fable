import { test, expect } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { configuratorContentSchema, CURRENT_FLOW_VERSION, FLOW_VERSIONS_BEFORE_ETAPA6, type RoomType } from '../../../packages/shared/src';
import { AUDIT_BUDGET_RON, AUDIT_ROOM_TYPES, completeAllRoomRequest, GREEN_AUDIT_ORIGIN, mockGuestDraft, reloadAndPublishGreenAudit, SAME_FINISH_ANSWER, textFor, uploadSyntheticAuditPng } from './helpers/guided-request';

const realGreen = process.env.GREEN_FORM_AUDIT === '1';
if (realGreen && process.env.GREEN_BASE_URL !== GREEN_AUDIT_ORIGIN) throw new Error('GREEN_BASE_URL must exactly match the isolated app-green audit origin.');
if (realGreen && !process.env.GREEN_AUDIT_PASSWORD) throw new Error('GREEN_AUDIT_PASSWORD is required for the isolated Green publication audit.');
test.use({ trace: realGreen ? 'off' : 'retain-on-failure' });

for (const locale of ['en', 'ro'] as const) {
  test(`all ten rooms reach review through the ${locale} guided questions`, async ({ page }, testInfo) => {
    test.setTimeout(360_000);
    if (!realGreen) await mockGuestDraft(page);
    let lastSnapshot: Record<string, unknown> | undefined;
    page.on('request', (request) => {
      if (request.method() === 'PATCH' && /\/api\/v1\/requests\/drafts\/[^/]+$/.test(new URL(request.url()).pathname)) lastSnapshot = request.postDataJSON()?.configuratorState;
    });
    const audit = await completeAllRoomRequest(page, locale, realGreen ? GREEN_AUDIT_ORIGIN : '', async (name, block) => {
      const path = testInfo.outputPath(`${name}.png`);
      await block.screenshot({ path });
      await testInfo.attach(name, { path, contentType: 'image/png' });
    }, realGreen ? () => uploadSyntheticAuditPng(page, locale) : undefined);
    expect(audit.rooms).toHaveLength(10);
    const dressingPreview = page.locator('[data-review-room-preview="DRESSING"]');
    // etapa 8: modulele interioare sunt sub "Vezi toate raspunsurile" (randurile 'extra'), nu in lista scurta
    const dressingMore = dressingPreview.locator('xpath=ancestor::section[1]').locator('[data-review-room-more]');
    await expect(dressingMore.locator('summary')).toHaveText(textFor(locale, 'Configurator.review.rooms.allAnswers'));
    await dressingMore.locator('summary').click();
    await expect(dressingMore).toContainText(textFor(locale, 'Configurator.flows.DRESSING.interiorModules.options.HANGING_RODS.label'));
    await expect(dressingPreview).not.toContainText(textFor(locale, 'Configurator.flows.DRESSING.interiorModules.options.HANGING_RODS.label'));
    for (const block of [dressingPreview, dressingMore]) await expect(block).not.toContainText(/HANGING_RODS|SHOE_RACK|Material dorit:/);
    const dressingReviewPath = testInfo.outputPath('localized-dressing-review.png');
    await dressingPreview.locator('..').screenshot({ path: dressingReviewPath });
    await testInfo.attach('localized-dressing-review', { path: dressingReviewPath, contentType: 'image/png' });
    await expect.poll(() => lastSnapshot?.phase).toBe('review');
    // Artefactul pastreaza doar continutul introdus in UI, nici tokenul draftului, nici cookie-uri.
    const snapshot = lastSnapshot as { roomInstances?: { roomType: string; completed: boolean; answers: unknown; flowVersion: number }[]; details?: unknown };
    expect(snapshot.roomInstances?.filter((room) => room.completed).map((room) => room.roomType).sort()).toEqual([...AUDIT_ROOM_TYPES].sort());
    // etapa 3: ciorna pastreaza alegerea de buget facuta pe Date generale (EN = suma, RO = "Prefer sa nu spun")
    const savedDetails = snapshot.details as { budgetRange?: string; budgetEstimateRon?: number | null; budgetChosen?: boolean };
    if (locale === 'en') expect(savedDetails).toMatchObject({ budgetEstimateRon: AUDIT_BUDGET_RON, budgetChosen: true });
    else expect(savedDetails.budgetRange).toBe('UNDISCLOSED');
    // etapa 6: camerele noi pornesc pe versiunea noua (nu pe una dinainte de etapa 6)
    for (const room of snapshot.roomInstances ?? []) {
      const type = room.roomType as RoomType;
      expect(room.flowVersion, `${type} flowVersion`).toBe(CURRENT_FLOW_VERSION[type]);
      expect(FLOW_VERSIONS_BEFORE_ETAPA6[type], `${type} new version`).not.toContain(room.flowVersion);
    }
    // etapa 6: "Acelasi material si aceeasi deschidere?" — EN "Da" (ecranul comun), RO "Nu" (ecran pe fiecare piesa)
    const visited = new Map(audit.rooms.map((room) => [room.type, room.questions]));
    const savedAnswers = new Map((snapshot.roomInstances ?? []).map((room) => [room.roomType as RoomType, room.answers as Record<string, unknown>]));
    const withSameFinish = audit.rooms.filter((room) => room.questions.includes('sameFinishAll')).map((room) => room.type);
    expect(withSameFinish.length, 'rooms asking sameFinishAll').toBeGreaterThan(0);
    for (const type of withSameFinish) expect(savedAnswers.get(type)?.sameFinishAll, `${type}.sameFinishAll`).toBe(SAME_FINISH_ANSWER[locale]);
    const commonScreen = audit.rooms.filter((room) => room.questions.includes('materialAll')).map((room) => room.type);
    if (locale === 'en') expect(commonScreen.sort()).toEqual([...withSameFinish].sort());
    else expect(commonScreen).toEqual([]);
    // usile batante: tipul usilor apare, iar deschiderea dulapului / dressingului se cere
    for (const type of ['BEDROOM', 'HALLWAY'] as const) {
      expect(savedAnswers.get(type)?.wardrobeDoorType, `${type}.wardrobeDoorType`).toBe('HINGED');
      if (locale === 'ro') expect(visited.get(type), `${type} wardrobe opening`).toContain('systemsWardrobe');
      // titlurile de material pe piesa (RO: un ecran pe fiecare piesa)
      if (locale === 'ro') expect(visited.get(type), `${type} wardrobe material`).toContain('materialWardrobe');
    }
    expect(savedAnswers.get('DRESSING')?.doorType).toBe('HINGED');
    expect(visited.get('DRESSING'), 'hinged dressing opening').toContain('openingSystems');
    const content = { rooms: snapshot.roomInstances?.map(({ roomType, answers, flowVersion }) => ({ roomType, answers, flowVersion })), ...snapshot.details as object };
    expect(configuratorContentSchema.safeParse(content).success).toBe(true);
    for (const [name, value] of Object.entries({ 'all-room-question-audit': audit, 'all-room-ui-content': content })) {
      const path = testInfo.outputPath(`${name}.json`);
      await writeFile(path, JSON.stringify(value, null, 2));
      await testInfo.attach(name, { path, contentType: 'application/json' });
    }
    const reviewPath = testInfo.outputPath('all-room-review.png');
    await page.screenshot({ path: reviewPath, fullPage: true });
    await testInfo.attach('all-room-review', { path: reviewPath, contentType: 'image/png' });
    if (realGreen) {
      const result = await reloadAndPublishGreenAudit(page, locale, content.rooms!, process.env.GREEN_AUDIT_PASSWORD!);
      const path = testInfo.outputPath('green-published-request.json');
      await writeFile(path, JSON.stringify(result, null, 2));
      await testInfo.attach('green-published-request', { path, contentType: 'application/json' });
    }
  });
}

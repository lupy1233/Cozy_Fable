import { test, expect } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { configuratorContentSchema } from '../../../packages/shared/src';
import { AUDIT_ROOM_TYPES, completeAllRoomRequest, GREEN_AUDIT_ORIGIN, mockGuestDraft, reloadAndPublishGreenAudit, textFor, uploadSyntheticAuditPng } from './helpers/guided-request';

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
    await expect(dressingPreview).toContainText(textFor(locale, 'Configurator.flows.DRESSING.interiorModules.options.HANGING_RODS.label'));
    await expect(dressingPreview).not.toContainText(/HANGING_RODS|SHOE_RACK|Material dorit:/);
    const dressingReviewPath = testInfo.outputPath('localized-dressing-review.png');
    await dressingPreview.locator('..').screenshot({ path: dressingReviewPath });
    await testInfo.attach('localized-dressing-review', { path: dressingReviewPath, contentType: 'image/png' });
    await expect.poll(() => lastSnapshot?.phase).toBe('review');
    // Artefactul pastreaza doar continutul introdus in UI, nici tokenul draftului, nici cookie-uri.
    const snapshot = lastSnapshot as { roomInstances?: { roomType: string; completed: boolean; answers: unknown; flowVersion: number }[]; details?: unknown };
    expect(snapshot.roomInstances?.filter((room) => room.completed).map((room) => room.roomType).sort()).toEqual([...AUDIT_ROOM_TYPES].sort());
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

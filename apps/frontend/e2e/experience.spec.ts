import { expect, test, type Page } from '@playwright/test';
import en from '../src/messages/en.json';
import ro from '../src/messages/ro.json';

// API izolata: testele UI nu creeaza ciorne sau cereri pe un backend real.
async function mockGuestDraft(page: Page) {
  await page.route('**/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    const auth = path.includes('/auth/');
    await route.fulfill({
      status: auth ? 401 : 200,
      contentType: 'application/json',
      body: JSON.stringify(auth ? { error: { code: 'UNAUTHORIZED', message: 'Guest' } } : path.includes('/requests/drafts/') ? { id: 'test-draft', attachments: [], configuratorState: null } : []),
    });
  });
}

for (const [locale, messages] of [['en', en], ['ro', ro]] as const) {
  test(`${locale}: guest summary preserves private-budget choice and requires login`, async ({ page }, info) => {
    test.setTimeout(120_000);
    await mockGuestDraft(page);
    await page.addInitScript(() => {
      localStorage.setItem('mm_draft_token', 'test-only-draft');
      localStorage.setItem('mm_configurator_v1', JSON.stringify({ version: 0, state: {
        phase: 'review', startMode: 'DESIGN_HELP', activeRoomIndex: 0, activeStepIndex: 0,
        roomInstances: [{ localId: 'bedroom-test', roomType: 'BEDROOM', flowVersion: 2, answers: {}, completed: false }],
        details: { budgetRange: 'UNDISCLOSED', budgetEstimateRon: 12345, includesPaidDesign: true, hasOwnProject: false, addressText: 'Demo Street 1', city: 'Cluj-Napoca', county: 'Cluj', country: 'RO', contactPreferences: [{ channel: 'EMAIL', value: 'demo@example.test' }] },
        inspirationPhotoIds: [], updatedAt: Date.now(),
      } }));
    });
    await page.goto(`/${locale}/requests/new`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: messages.Configurator.resume.continue, exact: true }).click();
    await expect(page.getByRole('heading', { name: messages.Configurator.review.title })).toBeVisible();
    await expect(page.getByText(messages.Requests.budget.UNDISCLOSED, { exact: true })).toBeVisible();
    await expect(page.getByText(/12345|12,345|12\.345/)).toHaveCount(0);
    await expect(page.getByRole('button', { name: messages.Configurator.review.loginToPublish, exact: true })).toBeEnabled();
    await expect(page.getByRole('button', { name: messages.Requests.publish, exact: true })).toHaveCount(0);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(overflow).toBe(false);
    const action = page.getByRole('button', { name: messages.Configurator.review.loginToPublish, exact: true });
    const inside = await action.evaluate((button) => {
      const parent = button.parentElement!.getBoundingClientRect(), child = button.getBoundingClientRect();
      return child.left >= parent.left - 1 && child.right <= parent.right + 1;
    });
    expect(inside).toBe(true);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: `../../docs/implementation/screenshots/summary-${locale}-${info.project.name}.png`, fullPage: true });
  });
}

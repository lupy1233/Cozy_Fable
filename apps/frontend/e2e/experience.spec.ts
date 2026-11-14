import { expect, test, type Page } from '@playwright/test';
import en from '../src/messages/en.json';
import ro from '../src/messages/ro.json';

// API izolata: testele UI nu creeaza ciorne sau cereri pe un backend real.
async function mockGuestDraft(page: Page) {
  await page.route('**/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    // etapa 5 (f3): vizitatorul fara sesiune primeste { user: null } pe /auth/me (401 = sesiune pierduta)
    const auth = path.includes('/auth/') && !path.endsWith('/auth/me');
    await route.fulfill({
      status: auth ? 401 : 200,
      contentType: 'application/json',
      body: JSON.stringify(auth ? { error: { code: 'UNAUTHORIZED', message: 'Guest' } } : path.endsWith('/auth/me') ? { user: null } : path.includes('/requests/drafts/') ? { id: 'test-draft', attachments: [], configuratorState: null } : []),
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
    // etapa 3 (b11): Sumarul arata "Buget nedeclarat", nu eticheta bifei
    await expect(page.getByText(messages.Requests.budgetView.undisclosed, { exact: true })).toBeVisible();
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

// etapa 3 (b11, migrarea v6): bugetul pus din oficiu de formularul vechi (fara budgetChosen) se goleste
// si ciorna de la Sumar se intoarce la Date generale; o suma aleasa ramane si apare in lei.
for (const chosen of [false, true]) {
  test(`en: saved budget ${chosen ? 'chosen by the client stays' : 'without a choice is asked again'}`, async ({ page }) => {
    test.setTimeout(120_000);
    await mockGuestDraft(page);
    await page.addInitScript((budgetChosen) => {
      localStorage.setItem('mm_draft_token', 'test-only-draft');
      localStorage.setItem('mm_configurator_v1', JSON.stringify({ version: 5, state: {
        phase: 'review', startMode: 'DESIGN_HELP', activeRoomIndex: 0, activeStepIndex: 0,
        roomInstances: [{ localId: 'bedroom-test', roomType: 'BEDROOM', flowVersion: 2, answers: {}, completed: false, needsDesignHelp: true }],
        details: { budgetRange: 'FROM_5K_TO_15K', budgetEstimateRon: 12000, ...(budgetChosen ? { budgetChosen: true } : {}), hasOwnProject: false, addressText: 'Demo Street 1', city: 'Cluj-Napoca', county: 'Cluj', country: 'RO', contactPreferences: [{ channel: 'EMAIL', value: 'demo@example.test' }] },
        inspirationPhotoIds: [], updatedAt: Date.now(),
      } }));
    }, chosen);
    await page.goto('/en/requests/new', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: en.Configurator.resume.continue, exact: true }).click();
    if (chosen) {
      await expect(page.getByRole('heading', { name: en.Configurator.review.title })).toBeVisible();
      await expect(page.getByText('12,000 lei', { exact: true })).toBeVisible();
      await expect(page.getByText(/\bRON\b/)).toHaveCount(0);
    } else {
      await expect(page.getByTestId('budget-value')).toHaveText(en.Requests.budgetChoose);
      await expect(page.getByRole('heading', { name: en.Configurator.review.title })).toHaveCount(0);
    }
  });
}

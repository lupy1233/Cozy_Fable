import { expect, test, type Page, type Route } from '@playwright/test';
import { getFlow } from '../../../packages/shared/src';
import en from '../src/messages/en.json';
import ro from '../src/messages/ro.json';
import { fillDetailsAndReview, mockGuestDraft, textFor, walkRoomQuestions } from './helpers/guided-request';

// Etapele 4 si 5, prin interfata, cu API simulat: refuzul ofertei si tabelul de comparare,
// intoarcerea dupa o sesiune pierduta, avertismentul "nicio firma in zona" si lungimea aproximativa.

const CLIENT = {
  id: 'client-e2e', email: 'client@example.test', name: 'Client Test', phone: null, role: 'CLIENT',
  languagePreference: 'RO', emailVerifiedAt: '2026-01-01T00:00:00.000Z', twoFactorEnabled: false, needsLegalAcceptance: false,
};
const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

// --- etapa 4 (a3 + a4): tabelul "Total in lei, cu TVA" si refuzul ofertei din dialog ---
const now = new Date().toISOString();
const inDays = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString();
function version(id: string, over: Record<string, unknown>) {
  return {
    id, version: 1, isExtra: false, designFee: null, currency: 'RON', designFeeRon: null, designFeeEur: null,
    deliveryTerm: null, deliveryDate: null, warranty: null, description: 'Mobilier de bucătărie',
    validUntil: inDays(10), isExpired: false, validityExtensionsUsed: 0, extensionRequestedAt: null, createdByUserId: 'firm-user',
    sentAt: now, changeRequest: null, attachments: [], roomPrices: [],
    deliveryTermValue: 6, deliveryTermUnit: 'WEEKS', deliveryWorkingDays: 30, warrantyMonths: 24,
    includesTransport: true, includesAssembly: true, designIncludes: null, vatRatePercent: 21,
    ...over,
  };
}
function quote(id: string, claim: string, company: string, v: Record<string, unknown>, over: Record<string, unknown> = {}) {
  return {
    id, claimSlotId: claim, requestId: 'req-e2e', companyId: `co-${claim}`, companyName: company, currency: 'RON', status: 'SENT',
    extraVersionsCount: 0, versionsUsed: 1, versionLimitReached: false, eurRonRate: 5, versions: [v], consultationInvites: [],
    createdAt: now, acceptedAt: null, acceptedVersionId: null, declinedAt: null, declineReason: null, declineNote: null, changeRequests: [],
    ...over,
  };
}
// Firma A: 10.000 lei + TVA 21% = 12.100 lei; Firma B: 11.000 lei cu TVA inclus → B e "cel mai mic"
const versionA = version('v-a', { price: 10000, priceRon: 10000, priceEur: 2000, total: 10000, totalRon: 10000, totalEur: 2000, vatMode: 'VAT_EXCLUDED', priceWithVat: 12100, totalWithVat: 12100 });
const versionB = version('v-b', { price: 11000, priceRon: 11000, priceEur: 2200, total: 11000, totalRon: 11000, totalEur: 2200, vatMode: 'VAT_INCLUDED', priceWithVat: 11000, totalWithVat: 11000 });
const thread = (id: string, claim: string, company: string, createdAt: string) => ({
  id, claimSlotId: claim, requestId: 'req-e2e', companyName: company, unreadCount: 0, claimStatus: 'OFFER_SENT', readOnly: false, lastMessage: null, createdAt,
});
const request = {
  id: 'req-e2e', status: 'IN_MARKETPLACE', title: 'Bucătărie', description: '', budgetRange: 'UNDISCLOSED', budgetEstimateRon: null, budgetDeclared: false,
  deadlineBucket: null, includesPaidDesign: false, hasOwnProject: false, addressText: 'Strada Test 1', county: 'Cluj', city: 'Cluj-Napoca',
  country: 'RO', lat: null, lng: null, sizing: null, preClaimEditsUsed: 0, postClaimEditsUsed: 0, publishedAt: now,
  expiresAt: inDays(14), cancelledAt: null, repostUsed: false, createdAt: now,
  rooms: [{ id: 'room-e2e', roomType: 'KITCHEN', lengthM: 3, widthM: 0.6, heightM: 2.6, items: [], answers: {}, flowVersion: 4, needsDesignHelp: false }],
  contactPreferences: [{ id: 'contact-e2e', channel: 'EMAIL', value: 'client@example.test' }], attachments: [],
  inspirationPhotoIds: [], inspirationPhotos: [], configuratorState: null, studioScenes: [],
};

test('ro: offers table compares totals in lei with VAT and a declined offer becomes "Refuzată" with a single request', async ({ page }) => {
  test.setTimeout(120_000);
  const Q = ro.Quotes;
  let declined = false;
  const declineCalls: unknown[] = [];
  const quoteA = () => quote('q-a', 'slot-a', 'Firma Alfa', versionA, declined ? { status: 'DECLINED', declinedAt: now, declineReason: 'PRICE', declineNote: null } : {});
  const quoteB = quote('q-b', 'slot-b', 'Firma Beta', versionB);
  await page.context().addCookies([{ name: 'mm_session', value: 'CLIENT', url: 'http://127.0.0.1:3100' }]);
  await page.route('**/api/v1/**', async (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname.replace(/^.*\/api\/v1/, '');
    if (path === '/auth/me') return json(route, { user: CLIENT });
    if (path === '/requests/req-e2e') return json(route, request);
    if (path === '/client/quotes/request/req-e2e') return json(route, [quoteA(), quoteB]);
    if (path === '/client/quotes/q-a') return json(route, quoteA());
    if (path === '/client/quotes/q-a/decline' && req.method() === 'POST') {
      declineCalls.push(req.postDataJSON());
      declined = true;
      return json(route, quoteA());
    }
    if (path === '/chat/threads') return json(route, [thread('th-a', 'slot-a', 'Firma Alfa', '2026-11-10T10:00:00.000Z'), thread('th-b', 'slot-b', 'Firma Beta', '2026-11-11T10:00:00.000Z')]);
    if (/^\/chat\/threads\/[^/]+\/messages$/.test(path)) return json(route, []);
    if (/^\/chat\/threads\/[^/]+\/read$/.test(path)) return json(route, {});
    if (path === '/legal/firm-rules' || path === '/legal/operator') return json(route, { published: false });
    if (req.method() !== 'GET') return json(route, {});
    return json(route, []);
  });
  await page.goto('/ro/requests/req-e2e/offers');
  await expect(page.getByRole('heading', { name: Q.offersTitle, exact: true })).toBeVisible({ timeout: 60_000 });
  const table = page.getByRole('table');
  const totalRow = table.getByRole('row').filter({ has: page.getByRole('rowheader', { name: Q.compare.totalLeiVat, exact: true }) });
  await expect(totalRow).toBeVisible();
  const cells = totalRow.getByRole('cell');
  await expect(cells.nth(0)).toContainText(/12[.  ]?100/);
  await expect(cells.nth(0)).not.toContainText(Q.compare.lowest);
  await expect(cells.nth(1)).toContainText(/11[.  ]?000/);
  await expect(cells.nth(1)).toContainText(Q.compare.lowest);
  // firma deschisa = prima cu oferta de ales (Alfa): refuzul pleaca abia dupa confirmare, o singura data
  const offer = page.getByRole('region', { name: Q.offerFrom.replace('{company}', 'Firma Alfa') });
  await offer.getByRole('button', { name: Q.decline.open, exact: true }).click();
  const dialog = page.getByRole('dialog', { name: Q.decline.title.replace('{company}', 'Firma Alfa') });
  await expect(dialog).toBeVisible();
  expect(declineCalls).toHaveLength(0);
  await dialog.getByRole('radio', { name: Q.declineReasons.PRICE, exact: true }).check();
  await dialog.getByRole('button', { name: Q.decline.confirm, exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(offer.getByText(new RegExp(`· ${Q.status.DECLINED}`))).toBeVisible();
  await expect(offer.getByRole('button', { name: Q.decline.open, exact: true })).toHaveCount(0);
  // in tabel: Alfa ramane cu starea ei, fara insigna
  const statusRow = table.getByRole('row').filter({ has: page.getByRole('rowheader', { name: Q.compare.status, exact: true }) });
  await expect(statusRow.getByRole('cell').nth(0)).toHaveText(Q.status.DECLINED);
  expect(declineCalls).toEqual([{ reason: 'PRICE' }]);
});

// --- etapa 5 (f3): sesiune pierduta pe o pagina cu cont → login cu mesaj, apoi inapoi pe pagina ---
test('en: an expired session sends the client to login with a notice and back to the page afterwards', async ({ page }) => {
  test.setTimeout(120_000);
  let signedIn = false;
  const logins: unknown[] = [];
  await page.context().addCookies([{ name: 'mm_session', value: 'CLIENT', url: 'http://127.0.0.1:3100' }]);
  await page.route('**/api/v1/**', async (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname.replace(/^.*\/api\/v1/, '');
    if (path === '/auth/login') {
      logins.push(req.postDataJSON());
      signedIn = true;
      return json(route, { user: CLIENT });
    }
    if (path === '/auth/me') return signedIn ? json(route, { user: CLIENT }) : json(route, { error: { code: 'UNAUTHORIZED' } }, 401);
    if (path.startsWith('/auth/')) return json(route, { error: { code: 'UNAUTHORIZED' } }, 401);
    if (!signedIn) return json(route, { error: { code: 'UNAUTHORIZED' } }, 401);
    if (path === '/legal/operator') return json(route, { published: false });
    if (req.method() !== 'GET') return json(route, {});
    return json(route, []);
  });
  await page.goto('/en/requests?tab=active');
  await expect(page).toHaveURL(/\/en\/login\?/, { timeout: 60_000 });
  const url = new URL(page.url());
  expect(url.searchParams.get('reason')).toBe('expired');
  expect(url.searchParams.get('redirect')).toBe('/requests?tab=active');
  await expect(page.getByRole('status').filter({ hasText: en.Auth.sessionExpired })).toBeVisible();
  await page.getByRole('textbox', { name: en.Auth.email, exact: true }).fill('client@example.test');
  await page.getByLabel(en.Auth.password, { exact: true }).fill('test-only-password');
  await page.getByRole('button', { name: en.Auth.loginSubmit, exact: true }).click();
  await expect(page).toHaveURL(/\/en\/requests\?tab=active$/, { timeout: 60_000 });
  expect(logins).toHaveLength(1);
});

// --- etapa 5 (f3): pe formularul public, o sesiune expirata nu blocheaza ciorna ---
test('en: the request form still opens for a visitor whose session expired', async ({ page }) => {
  test.setTimeout(120_000);
  await mockGuestDraft(page);
  // sesiune expirata: /auth/me raspunde 401 (vizitatorul fara sesiune primeste { user: null })
  await page.route('**/api/v1/auth/me', (route) => json(route, { error: { code: 'UNAUTHORIZED' } }, 401));
  const t = (key: string) => textFor('en', `Configurator.${key}`);
  await page.goto('/en/requests/new');
  await expect(page.getByRole('button', { name: new RegExp(`^${t('start.STANDARD.title')}`) })).toBeVisible({ timeout: 60_000 });
  await expect(page).toHaveURL(/\/en\/requests\/new$/);
});

// --- etapa 5 (d3 + a6): "Am deja un proiect" cu lungimea aproximativa; Sumarul arata lungimea
// si avertismentul "nicio firma in zona" (raspuns simulat NONE) ---
test('ro: own project keeps the approximate length and the summary warns when no company covers the area', async ({ page }) => {
  test.setTimeout(240_000);
  const locale = 'ro';
  const t = (key: string) => textFor(locale, `Configurator.${key}`);
  await mockGuestDraft(page);
  // un fisier de proiect verificat (SAFE) pe ciorna: fara el "Am deja un proiect" nu trece de Fisiere
  let snapshot: unknown = null;
  await page.route('**/api/v1/requests/drafts/local-audit-only', async (route) => {
    if (route.request().method() === 'PATCH') snapshot = route.request().postDataJSON().configuratorState;
    return json(route, { id: 'audit-draft', configuratorState: snapshot, attachments: [{ id: 'att-project', filename: 'proiect.pdf', mimeType: 'application/pdf', sizeBytes: 2048, status: 'SAFE', downloadUrl: null, createdAt: now }] });
  });
  const coverageCalls: unknown[] = [];
  await page.route('**/api/v1/requests/drafts/local-audit-only/coverage', async (route) => {
    coverageCalls.push(route.request().postDataJSON());
    return json(route, { coverage: 'NONE' });
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`/${locale}/requests/new`);
  await page.getByRole('button', { name: new RegExp(`^${t('start.OWN_PROJECT.title').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`) }).click();
  await page.getByRole('button', { name: t('cart.addOne').replace('{type}', t('rooms.type.KITCHEN')), exact: true }).click();
  await page.getByRole('button', { name: t('nav.startQuestions'), exact: true }).click();
  await walkRoomQuestions(page, locale, ['KITCHEN'], (type) => getFlow(type), undefined, { ownProject: true, approxLength: '6,5' });
  await expect(page.getByText('proiect.pdf', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: t('nav.continue'), exact: true }).click();
  await fillDetailsAndReview(page, locale);
  await expect(page.locator('[data-review-approx-length]')).toHaveText(t('roomSpec.approxLength').replace('{m}', '6,5'));
  const warning = page.getByTestId('no-coverage-warning');
  await expect(warning).toContainText(ro.Requests.visibility.noCoverage.title);
  await expect(warning).toContainText(ro.Requests.visibility.noCoverage.reviewBody);
  expect(coverageCalls.length).toBeGreaterThan(0);
  expect((snapshot as { roomInstances: { approxLengthM?: number }[] }).roomInstances[0].approxLengthM).toBe(6.5);
});

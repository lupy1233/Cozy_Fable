import { expect, test, type Page, type Route } from '@playwright/test';
import ro from '../src/messages/ro.json';

// Etapa 7, prin interfata, cu API simulat: sesiunea pierduta pe paginile firmei (fara bucla de
// cereri), ecranul "Pagina e doar pentru …", fila "Ciorne", pagina de editare blocata,
// limita de 5.000 de caractere in conversatie si campul "Bloc, scara, apartament".

const now = new Date().toISOString();
const inDays = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString();
const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
const apiPath = (route: Route) => new URL(route.request().url()).pathname.replace(/^.*\/api\/v1/, '');
const unauthorized = (route: Route) => json(route, { error: { code: 'UNAUTHORIZED', message: 'expired' } }, 401);

const user = (role: 'CLIENT' | 'COMPANY_USER') => ({
  id: `${role.toLowerCase()}-e2e`, email: `${role.toLowerCase()}@example.test`, name: 'Cont Test', phone: null, role,
  languagePreference: 'RO', emailVerifiedAt: '2026-01-01T00:00:00.000Z', twoFactorEnabled: false, needsLegalAcceptance: false,
});
const CLIENT = user('CLIENT');
const COMPANY = user('COMPANY_USER');
const hint = (page: Page, role: string) => page.context().addCookies([{ name: 'mm_session', value: role, url: 'http://127.0.0.1:3100' }]);

const request = (over: Record<string, unknown> = {}) => ({
  id: 'req-e2e', status: 'IN_MARKETPLACE', title: 'Bucătărie', description: '', budgetRange: 'UNDISCLOSED', budgetEstimateRon: null, budgetDeclared: false,
  deadlineBucket: null, includesPaidDesign: false, hasOwnProject: false, addressText: 'Strada Test 1', county: 'Cluj', city: 'Cluj-Napoca',
  country: 'RO', lat: null, lng: null, sizing: null, preClaimEditsUsed: 0, postClaimEditsUsed: 0, publishedAt: now,
  expiresAt: inDays(14), cancelledAt: null, repostUsed: false, createdAt: now,
  rooms: [{ id: 'room-e2e', roomType: 'KITCHEN', lengthM: 3, widthM: 0.6, heightM: 2.6, items: [], answers: {}, flowVersion: 4, needsDesignHelp: false }],
  contactPreferences: [{ id: 'contact-e2e', channel: 'EMAIL', value: 'client@example.test' }], attachments: [],
  inspirationPhotoIds: [], inspirationPhotos: [], configuratorState: null, studioScenes: [],
  ...over,
});

// --- f4 / D1: sesiune pierduta pe Piata si pe Preluari → login cu intoarcere, fara bucla de cereri ---
// (a) fara cookie-uri: /auth/me → 200 { user: null }; (b) refresh nevalid: /auth/me → 401, /auth/refresh → 401
for (const [target, kind] of [
  ['/marketplace', 'staleRefresh'], ['/marketplace/claims?tab=active', 'noCookies'],
  ['/marketplace', 'noCookies'], ['/marketplace/claims?tab=active', 'staleRefresh'],
] as const) {
  test(`ro: a lost session on ${target} (${kind}) goes to login without a request loop`, async ({ page }) => {
    test.setTimeout(120_000);
    let signedIn = false;
    const calls: string[] = [];
    if (kind === 'staleRefresh') await hint(page, 'COMPANY_USER');
    await page.route('**/api/v1/**', async (route) => {
      const path = apiPath(route);
      calls.push(path);
      if (path === '/auth/login') {
        signedIn = true;
        return json(route, { user: COMPANY });
      }
      if (path === '/auth/me') return signedIn ? json(route, { user: COMPANY }) : kind === 'noCookies' ? json(route, { user: null }) : unauthorized(route);
      if (!signedIn) return unauthorized(route);
      if (path === '/legal/operator' || path === '/legal/firm-rules') return json(route, { published: false });
      if (route.request().method() !== 'GET') return json(route, {});
      return json(route, []);
    });
    // `next dev` compileaza pagina la prima cerere; o navigare client facuta chiar in timpul
    // reconstruirii (Fast Refresh) se pierde in dev. Incalzim pagina si login-ul inainte.
    for (const warm of [`/ro${target}`, '/ro/login']) expect((await page.request.get(warm)).ok()).toBe(true);
    await page.goto(`/ro${target}`);
    await expect(page).toHaveURL(/\/ro\/login\?/, { timeout: 60_000 }).catch((e) => {
      throw new Error(`${String(e)}\nAPI calls: ${calls.join(' ')}`);
    });
    const url = new URL(page.url());
    expect(url.searchParams.get('redirect')).toBe(target);
    // vizitatorul fara sesiune nu primeste mesajul "sesiunea a expirat"; cel cu indiciul de sesiune da
    expect(url.searchParams.get('reason')).toBe(kind === 'staleRefresh' ? 'expired' : null);
    if (kind === 'staleRefresh') await expect(page.getByRole('status').filter({ hasText: ro.Auth.sessionExpired })).toBeVisible();
    // lasam pagina 3 s pe login: o bucla ar trimite sute de cereri
    await page.waitForTimeout(3_000);
    expect(calls.length, calls.join(' ')).toBeLessThan(20);
    if (kind === 'staleRefresh') {
      await page.getByRole('textbox', { name: ro.Auth.email, exact: true }).fill('firma@example.test');
      await page.getByLabel(ro.Auth.password, { exact: true }).fill('test-only-password');
      await page.getByRole('button', { name: ro.Auth.loginSubmit, exact: true }).click();
      await expect.poll(() => { const u = new URL(page.url()); return `${u.pathname}${u.search}`; }, { timeout: 60_000 }).toBe(`/ro${target}`);
    }
  });
}

// --- f4: contul cu rol gresit vede "Pagina e doar pentru …", nu e mutat tacut pe Panou ---
test('ro: a company account on a client offer link sees the client-only screen and can switch account', async ({ page }) => {
  test.setTimeout(120_000);
  let loggedOut = 0;
  await hint(page, 'COMPANY_USER');
  await page.route('**/api/v1/**', async (route) => {
    const path = apiPath(route);
    if (path === '/auth/logout') {
      loggedOut += 1;
      return json(route, { loggedOut: true });
    }
    if (path === '/auth/me') return loggedOut ? json(route, { user: null }) : json(route, { user: COMPANY });
    // ca serverul: rutele clientului refuza contul de firma
    if (path.startsWith('/requests/') || path.startsWith('/client/')) return json(route, { error: { code: 'FORBIDDEN', message: 'role' } }, 403);
    if (path === '/legal/operator' || path === '/legal/firm-rules') return json(route, { published: false });
    if (route.request().method() !== 'GET') return json(route, {});
    return json(route, []);
  });
  await page.goto('/ro/requests/req-e2e/offers');
  const screen = page.getByRole('alert').filter({ hasText: ro.Access.onlyFor.CLIENT });
  await expect(screen).toBeVisible({ timeout: 60_000 });
  await expect(screen).toContainText(ro.Access.wrongAccountHint);
  await expect(page).toHaveURL(/\/ro\/requests\/req-e2e\/offers$/);
  await expect(screen.getByRole('link', { name: ro.Access.toDashboard })).toHaveAttribute('href', /\/dashboard$/);
  await screen.getByRole('button', { name: ro.Access.switchAccount, exact: true }).click();
  await expect(page).toHaveURL(/\/ro\/login\?/, { timeout: 60_000 });
  expect(new URL(page.url()).searchParams.get('redirect')).toBe('/requests/req-e2e/offers');
  expect(loggedOut).toBe(1);
});

test('ro: a client account on the marketplace sees the company-only screen', async ({ page }) => {
  test.setTimeout(120_000);
  await hint(page, 'CLIENT');
  await page.route('**/api/v1/**', async (route) => {
    const path = apiPath(route);
    if (path === '/auth/me') return json(route, { user: CLIENT });
    if (path === '/legal/operator') return json(route, { published: false });
    if (route.request().method() !== 'GET') return json(route, {});
    return json(route, []);
  });
  await page.goto('/ro/marketplace/claims');
  await expect(page.getByRole('alert').filter({ hasText: ro.Access.onlyFor.COMPANY_USER })).toBeVisible({ timeout: 60_000 });
  await expect(page).toHaveURL(/\/ro\/marketplace\/claims$/);
});

// --- d5: fila "Ciorne" din "Cererile mele" — "Sterge" cu confirmare, "Continua" cu token nou ---
test('ro: the drafts tab deletes a draft after confirmation and continues another one in the form', async ({ page }) => {
  test.setTimeout(120_000);
  const R = ro.Requests;
  let drafts = [
    { id: 'draft-1', title: 'Bucătărie nouă', city: 'Cluj-Napoca', roomTypes: ['KITCHEN', 'BATHROOM'], createdAt: now, updatedAt: now },
    { id: 'draft-2', title: '', city: '', roomTypes: ['BEDROOM'], createdAt: now, updatedAt: now },
  ];
  const deletes: string[] = [];
  const tokens: string[] = [];
  const draftReads: string[] = [];
  await hint(page, 'CLIENT');
  await page.route('**/api/v1/**', async (route) => {
    const req = route.request();
    const path = apiPath(route);
    if (path === '/auth/me') return json(route, { user: CLIENT });
    if (path === '/requests/my-drafts') return json(route, drafts);
    if (path === '/requests' && req.method() === 'GET') return json(route, []);
    const del = path.match(/^\/requests\/(draft-\d)$/);
    if (del && req.method() === 'DELETE') {
      deletes.push(del[1]);
      drafts = drafts.filter((d) => d.id !== del[1]);
      return json(route, { ok: true });
    }
    const tok = path.match(/^\/requests\/(draft-\d)\/draft-token$/);
    if (tok && req.method() === 'POST') {
      tokens.push(tok[1]);
      return json(route, { draftToken: 'token-continued' });
    }
    if (path.startsWith('/requests/drafts/token-continued')) {
      draftReads.push(`${req.method()} ${path}`);
      return json(route, { id: 'draft-1', attachments: [], configuratorState: null });
    }
    if (path.endsWith('/coverage')) return json(route, { coverage: 'UNKNOWN' });
    if (path === '/legal/operator') return json(route, { published: false });
    if (req.method() !== 'GET') return json(route, {});
    return json(route, []);
  });
  await page.goto('/ro/requests');
  await expect(page.getByRole('heading', { name: R.myRequests, exact: true })).toBeVisible({ timeout: 60_000 });
  await page.getByRole('button', { name: new RegExp(`^${R.tabs.DRAFTS}`) }).click();
  const untitled = page.getByRole('article').filter({ has: page.getByRole('heading', { name: R.drafts.untitled, exact: true }) });
  await expect(untitled).toBeVisible();
  const first = page.getByRole('article').filter({ has: page.getByRole('heading', { name: 'Bucătărie nouă', exact: true }) });
  await expect(first).toContainText('Baie');
  // "Sterge" intreaba inainte; abia confirmarea trimite DELETE
  await untitled.getByRole('button', { name: /^Șterge ciorna: / }).click();
  const dialog = page.getByRole('alertdialog').or(page.getByRole('dialog'));
  await expect(dialog).toContainText(R.drafts.deleteTitle);
  expect(deletes).toEqual([]);
  await dialog.getByRole('button', { name: R.deleteDialog.confirm, exact: true }).click();
  await expect(page.getByText(R.drafts.deleted, { exact: true }).first()).toBeVisible();
  await expect(untitled).toHaveCount(0);
  expect(deletes).toEqual(['draft-2']);
  // "Continua" cere un token nou si deschide formularul pe ciorna aleasa
  await first.getByRole('button', { name: /^Continuă ciorna: Bucătărie nouă/ }).click();
  await expect(page).toHaveURL(/\/ro\/requests\/new$/, { timeout: 60_000 });
  expect(tokens).toEqual(['draft-1']);
  expect(await page.evaluate(() => localStorage.getItem('mm_draft_token'))).toBe('token-continued');
  await expect.poll(() => draftReads.length).toBeGreaterThan(0);
  // venind din "Continua", formularul nu mai intreaba "Continui sau incepi din nou?"
  await expect(page.getByRole('button', { name: ro.Configurator.resume.continue, exact: true })).toHaveCount(0);
});

// --- e7-view: /requests/<id>/edit pe o cerere care nu mai poate fi editata ---
for (const [label, over, key] of [
  ['an accepted request', { status: 'ACCEPTED' }, 'locked'],
  ['a request with no edits left', { status: 'IN_MARKETPLACE', preClaimEditsUsed: 3 }, 'noneLeft'],
] as const) {
  test(`ro: the edit page of ${label} shows the reason and the way back, not the editor`, async ({ page }) => {
    test.setTimeout(120_000);
    await hint(page, 'CLIENT');
    await page.route('**/api/v1/**', async (route) => {
      const path = apiPath(route);
      if (path === '/auth/me') return json(route, { user: CLIENT });
      if (path === '/requests/req-e2e') return json(route, request(over));
      if (path === '/legal/operator') return json(route, { published: false });
      if (route.request().method() !== 'GET') return json(route, {});
      return json(route, []);
    });
    await page.goto('/ro/requests/req-e2e/edit');
    await expect(page.getByText(ro.Requests.edits[key], { exact: true })).toBeVisible({ timeout: 60_000 });
    await expect(page.getByRole('link', { name: `← ${ro.Requests.backToRequest}` })).toHaveAttribute('href', /\/requests\/req-e2e$/);
    // editorul nu s-a deschis: nici "Spre sumar", nici "Continua"
    await expect(page.getByRole('button', { name: ro.Configurator.nav.toReview, exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: ro.Configurator.nav.continue, exact: true })).toHaveCount(0);
  });
}

// --- g3: conversatia — peste 5.000 de caractere contorul e rosu, motivul e scris si "Trimite" e inactiv ---
test('ro: a chat message over 5,000 characters turns the counter red and disables Send', async ({ page }) => {
  test.setTimeout(120_000);
  const C = ro.Chat;
  const sent: unknown[] = [];
  const version = {
    id: 'v-a', version: 1, isExtra: false, designFee: null, currency: 'RON', designFeeRon: null, designFeeEur: null,
    deliveryTerm: null, deliveryDate: null, warranty: null, description: 'Mobilier de bucătărie',
    validUntil: inDays(10), isExpired: false, validityExtensionsUsed: 0, extensionRequestedAt: null, createdByUserId: 'firm-user',
    sentAt: now, changeRequest: null, attachments: [], roomPrices: [],
    deliveryTermValue: 6, deliveryTermUnit: 'WEEKS', deliveryWorkingDays: 30, warrantyMonths: 24,
    includesTransport: true, includesAssembly: true, designIncludes: null, vatRatePercent: 21,
    price: 10000, priceRon: 10000, priceEur: 2000, total: 10000, totalRon: 10000, totalEur: 2000, vatMode: 'VAT_EXCLUDED', priceWithVat: 12100, totalWithVat: 12100,
  };
  const quote = {
    id: 'q-a', claimSlotId: 'slot-a', requestId: 'req-e2e', companyId: 'co-a', companyName: 'Firma Alfa', currency: 'RON', status: 'SENT',
    extraVersionsCount: 0, versionsUsed: 1, versionLimitReached: false, eurRonRate: 5, versions: [version], consultationInvites: [],
    createdAt: now, acceptedAt: null, acceptedVersionId: null, declinedAt: null, declineReason: null, declineNote: null, changeRequests: [],
  };
  await hint(page, 'CLIENT');
  await page.route('**/api/v1/**', async (route) => {
    const req = route.request();
    const path = apiPath(route);
    if (path === '/auth/me') return json(route, { user: CLIENT });
    if (path === '/requests/req-e2e') return json(route, request());
    if (path === '/client/quotes/request/req-e2e') return json(route, [quote]);
    if (path === '/client/quotes/q-a') return json(route, quote);
    if (path === '/chat/threads') return json(route, [{ id: 'th-a', claimSlotId: 'slot-a', requestId: 'req-e2e', companyName: 'Firma Alfa', unreadCount: 0, claimStatus: 'OFFER_SENT', readOnly: false, lastMessage: null, createdAt: now }]);
    if (/^\/chat\/threads\/[^/]+\/messages$/.test(path)) {
      if (req.method() === 'POST') sent.push(req.postDataJSON());
      return json(route, []);
    }
    if (/^\/chat\/threads\/[^/]+\/read$/.test(path)) return json(route, {});
    if (path === '/legal/firm-rules' || path === '/legal/operator') return json(route, { published: false });
    if (req.method() !== 'GET') return json(route, {});
    return json(route, []);
  });
  await page.goto('/ro/requests/req-e2e/offers');
  const field = page.getByRole('textbox', { name: C.messageTo.replace('{name}', 'Firma Alfa') });
  await expect(field).toBeVisible({ timeout: 60_000 });
  const send = page.getByRole('button', { name: C.send, exact: true });
  await expect(send).toHaveCount(1);
  await expect(send).toBeDisabled();
  await field.fill('a'.repeat(5_000));
  const counter = page.locator('[data-chat-counter]');
  await expect(counter).toHaveText(C.counter.replace('{count}', '5.000').replace('{max}', '5.000'));
  await expect(counter).not.toHaveClass(/text-crimson/);
  await expect(send).toBeEnabled();
  await field.fill(`${'a'.repeat(5_001)}`);
  await expect(counter).toHaveText(C.counter.replace('{count}', '5.001').replace('{max}', '5.000'));
  await expect(counter).toHaveClass(/text-crimson/);
  await expect(field).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByRole('alert').filter({ hasText: C.errors.tooLong.replace('{max}', '5.000') })).toBeVisible();
  await expect(send).toBeDisabled();
  // spatiile de la capete nu se numara
  await field.fill(`  ${'a'.repeat(5_000)}  `);
  await expect(send).toBeEnabled();
  expect(sent).toEqual([]);
});

// --- b12: "Bloc, scara, apartament" ramane dupa alegerea unei sugestii si apare in Sumar
// fara "Bucuresti, Bucuresti". Google Places e inlocuit cu un widget simulat (Enter = alegerea sugestiei). ---
const FAKE_PLACES = `
window.google = { maps: {
  places: { Autocomplete: function (input) {
    var listeners = [], place = null;
    this.addListener = function (name, fn) { if (name === 'place_changed') listeners.push(fn); };
    this.setComponentRestrictions = function () {};
    this.getPlace = function () { return place; };
    input.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      // ca Google: valoarea inputului devine sugestia (blocul si apartamentul se pierd din ea)
      input.value = 'Strada Fabricii 5, București, România';
      place = { formatted_address: input.value, address_components: [
        { long_name: 'Strada Fabricii', types: ['route'] }, { long_name: '5', types: ['street_number'] },
        { long_name: 'București', types: ['locality', 'political'] },
        { long_name: 'București', types: ['administrative_area_level_1', 'political'] },
        { long_name: 'România', types: ['country', 'political'] } ] };
      listeners.forEach(function (fn) { fn(); });
    });
  } },
  Geocoder: function () { this.geocode = function (_r, cb) { cb(null, 'ZERO_RESULTS'); }; },
} };`;

test('ro: block and flat survive picking an address suggestion and the summary shows the city once', async ({ page }) => {
  test.setTimeout(120_000);
  const R = ro.Requests;
  let snapshot: { details?: Record<string, unknown> } | null = null;
  await page.route(/maps\.googleapis\.com\/maps\/api\/js/, (route) => route.fulfill({ contentType: 'text/javascript', body: FAKE_PLACES }));
  await page.route('**/api/v1/**', async (route) => {
    const req = route.request();
    const path = apiPath(route);
    if (path === '/auth/me') return json(route, { user: null });
    if (path.startsWith('/auth/')) return unauthorized(route);
    if (path === '/requests/drafts' && req.method() === 'POST') return json(route, { draftToken: 'test-only-draft' }, 201);
    if (path === '/requests/drafts/test-only-draft') {
      if (req.method() === 'PATCH') snapshot = req.postDataJSON().configuratorState;
      return json(route, { id: 'test-draft', attachments: [], configuratorState: snapshot });
    }
    if (path.endsWith('/coverage')) return json(route, { coverage: 'UNKNOWN' });
    if (path.includes('/estimate')) return json(route, { minRon: 0, maxRon: 0 });
    if (path.includes('/inspiration')) return json(route, { items: [], total: 0, nextCursor: null });
    if (path === '/legal/operator') return json(route, { published: false });
    if (req.method() !== 'GET') return json(route, {});
    return json(route, []);
  });
  await page.addInitScript(() => {
    if (sessionStorage.getItem('e2e-seeded')) return;
    sessionStorage.setItem('e2e-seeded', '1');
    localStorage.setItem('mm_draft_token', 'test-only-draft');
    localStorage.setItem('mm_configurator_v1', JSON.stringify({ version: 6, state: {
      phase: 'details', startMode: 'DESIGN_HELP', activeRoomIndex: 0, activeStepIndex: 0,
      roomInstances: [{ localId: 'bedroom-test', roomType: 'BEDROOM', flowVersion: 2, answers: {}, completed: true, needsDesignHelp: true }],
      details: { description: 'Test e2e etapa 7: adresa cu bloc si apartament.', deadlineBucket: 'FLEXIBLE', budgetRange: 'UNDISCLOSED', budgetChosen: true, includesPaidDesign: true, hasOwnProject: false, addressText: '', city: '', county: '', country: 'RO', contactPreferences: [{ channel: 'EMAIL', value: 'demo@example.test' }] },
      inspirationPhotoIds: [], updatedAt: Date.now(),
    } }));
  });
  await page.goto('/ro/requests/new', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: ro.Configurator.resume.continue, exact: true }).click({ timeout: 60_000 });
  const address = page.getByRole('textbox', { name: R.field.addressText, exact: true });
  await expect(address).toBeVisible();
  // asteptam widgetul (placeholderul de cautare apare doar cu cheia Places; widgetul se ataseaza dupa scriptul simulat)
  await expect.poll(() => page.evaluate(() => Boolean((window as { google?: unknown }).google))).toBe(true);
  await address.pressSequentially('Strada Fabricii 5 bl. A2 ap. 14');
  await address.press('Enter');
  const details = page.getByRole('textbox', { name: R.field.addressDetails });
  await expect(details).toHaveValue('bl. A2, ap. 14');
  await expect(page.getByRole('textbox', { name: R.field.county, exact: true })).toHaveValue('București');
  await expect(page.getByRole('textbox', { name: R.field.city, exact: true })).toHaveValue('București');
  // ciorna salvata pastreaza campul separat
  await expect.poll(() => snapshot?.details?.addressDetails, { timeout: 15_000 }).toBe('bl. A2, ap. 14');
  await page.getByRole('button', { name: ro.Configurator.nav.toReview, exact: true }).click();
  await expect(page.getByRole('heading', { name: ro.Configurator.review.title, exact: true })).toBeVisible();
  await expect(page.getByText('Strada Fabricii 5, bl. A2, ap. 14, București', { exact: true })).toBeVisible();
  await expect(page.getByText(/București, București/)).toHaveCount(0);
});

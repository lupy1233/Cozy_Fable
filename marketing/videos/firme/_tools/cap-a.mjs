// Faza A — capturi fara modificari de stare (owner.a = Andrei Albu, Atelier Nord).
//   node firme/_tools/cap-a.mjs [job ...]      (fara argumente = toate)
// Exceptie minora: deschiderea conversatiei necitite (job "thread") o marcheaza citita pentru owner.a.
import { open, go, shot, saveBoxes, hidePlanPrices, saveState, APP } from './cap-lib.mjs';

const only = process.argv.slice(2);
const want = (j) => only.length === 0 || only.includes(j);
const AS = 'owner.a@demo.ro';
const T = (page, s) => page.getByText(s, { exact: true });

// pagini publice
if (want('reg') || want('partners')) {
  const { browser, page } = await open(null);
  if (want('reg')) {
    await go(page, '/ro/register?role=company');
    await saveBoxes(page, 'reg', { card: page.locator('form').locator('..'), company: page.getByText('Firmă — producem mobilier la comandă'), submit: page.getByRole('button', { name: 'Creează cont' }) });
    await shot(page, 'reg', { full: true });
    // bifa de termeni (fara trimitere) — butonul „Creează cont” arata ca in fluxul real
    await page.locator('input[type="checkbox"]').first().check();
    await page.waitForTimeout(300);
    await shot(page, 'reg2', { full: true });
  }
  if (want('partners')) {
    await go(page, '/ro/partners', 2500);
    await saveBoxes(page, 'partners', { nord: page.locator('div.rounded-2xl', { hasText: 'Atelier Nord' }), verified: page.locator('div.rounded-2xl', { hasText: 'Atelier Nord' }).getByText('Firmă verificată') });
    await shot(page, 'partners', { full: true });
  }
  await browser.close();
}

const { browser, ctx, page } = await open(AS);
try {
  if (want('onb')) {
    // formularul real de onboarding: pentru owner.a raspunsul GET /companies/me e fortat la 404
    // (in DB nu exista niciun cont de firma fara firma); nimic nu se trimite.
    await page.route(/\/api\/v1\/companies\/me(\?.*)?$/, (route) => route.request().method() === 'GET'
      ? route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ code: 'NOT_FOUND', message: 'Not found' }) })
      : route.continue());
    await go(page, '/ro/company', 1500);
    await shot(page, 'onb-empty', { full: true });
    const fill = async (name, v) => { await page.locator(`input[name="${name}"]`).fill(v); };
    await fill('name', 'Atelier Nord');
    await fill('cui', 'RO38471205');
    await fill('regComNumber', 'J40/11842/2017');
    await fill('addressText', 'Str. Fabrica de Glucoză 21, Sector 2');
    await fill('county', 'București');
    await fill('city', 'București');
    await fill('lat', '44.4745');
    await fill('lng', '26.118');
    await page.locator('body').click({ position: { x: 5, y: 5 } });
    await page.waitForTimeout(400);
    await saveBoxes(page, 'onb', { title: T(page, 'Înregistrează firma'), submit: page.getByRole('button', { name: 'Trimite spre verificare' }), name: page.locator('input[name="name"]') });
    await shot(page, 'onb', { full: true });
    await page.unroute(/\/api\/v1\/companies\/me(\?.*)?$/);
  }
  if (want('company')) {
    await go(page, '/ro/company', 2000);
    await saveBoxes(page, 'company', {
      status: page.getByText('Status:', { exact: false }).first(),
      profile: T(page, 'Profil'), team: T(page, 'Echipă'), perms: T(page, 'Permisiuni pe câmpurile ofertei'),
      portfolio: T(page, 'Portofoliu'), addMember: page.getByRole('button', { name: 'Adaugă membru' }),
    });
    await shot(page, 'company', { full: true });
  }
  if (want('feed')) {
    await go(page, '/ro/marketplace', 1500);
    await saveBoxes(page, 'feed', {
      baie: page.locator('a, div').filter({ hasText: /^Mobilier baie suspendat · București/ }).last(),
      credits: page.getByText('200 credite'),
      c1: page.getByText('Mobilier baie suspendat · București').first(),
      c3: page.getByText('Bucătărie în L cu insulă · București').first(),
      c4: page.getByText('Dressing walk-in · Chiajna').first(),
      c5: page.getByText('Dormitor: dulap și noptiere · București').first(),
      mine: page.getByText('Preluată deja de firma ta', { exact: false }).first(),
    });
    await shot(page, 'feed', { full: true });
  }
  if (want('kitchen')) {
    await go(page, '/ro/marketplace/ce41d9a4-f5fe-4995-b733-c3a812dff6cc', 2500);
    await saveBoxes(page, 'kitchen', { title: page.locator('h1'), rooms: T(page, 'Camere'), preia: page.getByRole('button', { name: 'Preia' }), cost: page.getByText('Cost:', { exact: false }) });
    await shot(page, 'kitchen', { full: true });
  }
  if (want('claims')) {
    await go(page, '/ro/marketplace/claims', 1500);
    await saveBoxes(page, 'claims', { table: page.locator('table'), unread: page.locator('table span.bg-crimson').first() });
    await shot(page, 'claims', { full: true });
    // tabelul e mai lat decat telefonul: aceeasi pagina, derulata orizontal pana la etapa + SLA
    await page.evaluate(() => { const t = document.querySelector('table'); let p = t.parentElement; while (p && p.scrollWidth <= p.clientWidth) p = p.parentElement; if (p) p.scrollLeft = 330; });
    await page.waitForTimeout(400);
    await shot(page, 'claims-right', { full: true });
  }
  if (want('messages')) {
    await go(page, '/ro/marketplace/messages', 1500);
    await saveBoxes(page, 'messages', { tabTeam: page.getByRole('button', { name: 'Echipa firmei' }), ana: page.getByText('Bucătărie albă cu blat de stejar', { exact: false }).first() });
    await shot(page, 'messages', { full: true });
    await page.getByRole('button', { name: 'Echipa firmei' }).click();
    await page.waitForTimeout(1500);
    await shot(page, 'messages-team', { full: true });
  }
  if (want('wallet')) {
    await go(page, '/ro/marketplace/wallet', 1500);
    await hidePlanPrices(page);
    await page.waitForTimeout(300);
    await saveBoxes(page, 'wallet', { metrics: T(page, 'Portofel de credite'), sub: T(page, 'Abonament'), plans: T(page, 'Planuri'), buy: T(page, 'Cumpără credite'), orders: T(page, 'Comenzi și facturi') });
    await shot(page, 'wallet', { full: true });
  }
  if (want('sheet')) {
    await go(page, '/ro/marketplace/claims/861163e7-6eec-48b3-8616-6f1749840a9b', 2000);
    await shot(page, 'sheet', { full: true });
  }
  for (const [job, id] of [['v2', '6b85f005-8206-436a-9ef9-8f4a5f23c2a1'], ['exec', '34be4ac5-7736-45fa-91e2-8b2a18c4754f'], ['done', 'e797deb9-cb48-413c-a09a-bfb7696f1d0a']]) {
    if (!want(job)) continue;
    await go(page, `/ro/marketplace/claims/${id}`, 2000);
    await saveBoxes(page, job, {
      pill: page.locator('main span, span').filter({ hasText: /^(Ofertă trimisă|Finalizată|Activă)$/i }).first(),
      offerHead: page.getByText('Atelier Nord', { exact: true }).first(),
      pdf: page.getByText('Descarcă PDF').first(),
      accepted: page.getByText('Clientul a acceptat oferta.').first(),
      deliver: page.getByRole('button', { name: 'Marchează ca livrată' }),
      chat: T(page, 'Chat'), sla: T(page, 'SLA și stare'),
    });
    await shot(page, job, { full: true });
  }
  if (want('thread')) {
    await go(page, '/ro/marketplace/messages', 1500);
    await page.getByText('Bucătărie albă cu blat de stejar', { exact: false }).first().click();
    await page.waitForTimeout(2500);
    await shot(page, 'thread-ana', { full: true });
  }
} finally {
  await saveState(ctx, AS);
  await browser.close();
}

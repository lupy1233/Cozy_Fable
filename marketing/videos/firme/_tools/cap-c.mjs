// Faza C — ultimele capturi. SCHIMBA STAREA DB:
//   team : 2 mesaje reale in chatul intern „Echipa firmei” (Andrei Albu → Cristina Vlad, raspuns)
//   claim: „Preia” REAL pe Mobilier baie suspendat · Bucuresti (336fb0e8, Mica · 4 credite) → 200 → 196
//   node firme/_tools/cap-c.mjs [team] [pre] [claim] [post]
import { open, go, shot, saveBoxes, hidePlanPrices, saveState } from './cap-lib.mjs';

const only = process.argv.slice(2);
const want = (j) => only.length === 0 || only.includes(j);
const BAIE = '/ro/marketplace/336fb0e8-47b5-41d8-97d7-3ba743d4abba';

async function sendTeam(as, text) {
  const { browser, ctx, page } = await open(as);
  try {
    await go(page, '/ro/marketplace/messages', 1500);
    await page.getByRole('button', { name: 'Echipa firmei' }).click();
    await page.waitForTimeout(1500);
    const ta = page.getByPlaceholder('Scrie un mesaj…').or(page.getByPlaceholder('Scrie un mesaj...')).first();
    await ta.fill(text);
    await page.getByRole('button', { name: 'Trimite' }).last().click();
    await page.waitForTimeout(2000);
    console.log('trimis ca', as);
  } finally { await saveState(ctx, as); await browser.close(); }
}

if (want('team')) {
  await sendTeam('owner.a@demo.ro', 'Cristina, verifici stocul de MDF alb mat pentru dulapul din București?');
  await sendTeam('trusted1.a@demo.ro', 'Da, ajunge pentru tot dulapul. Programez releveul joi.');
}

const AS = 'owner.a@demo.ro';
const { browser, ctx, page } = await open(AS);
try {
  if (want('pre')) {
    await go(page, '/ro/marketplace/messages', 1500);
    await shot(page, 'messages2', { full: true });
    await page.getByRole('button', { name: 'Echipa firmei' }).click();
    await page.waitForTimeout(2000);
    await shot(page, 'messages-team2', { full: true });
    await go(page, '/ro/marketplace/claims', 1500);
    await saveBoxes(page, 'claims2', { table: page.locator('table'), unread: page.locator('table span.bg-crimson').first() });
    await shot(page, 'claims2', { full: true });
    await go(page, '/ro/company', 2000);
    await saveBoxes(page, 'company2', { team: page.getByText('Echipă', { exact: true }), perms: page.getByText('Permisiuni pe câmpurile ofertei', { exact: true }), status: page.getByText('Status:', { exact: false }).first() });
    await shot(page, 'company2', { full: true });
    await go(page, BAIE, 2500);
    await saveBoxes(page, 'baie', { title: page.locator('h1'), rooms: page.getByText('Camere', { exact: true }), preia: page.getByRole('button', { name: 'Preia' }), cost: page.getByText('Cost:', { exact: false }) });
    await shot(page, 'baie', { full: true });
  }
  if (want('claim')) {
    await go(page, BAIE, 2500);
    const btn = page.getByRole('button', { name: 'Preia' });
    await btn.scrollIntoViewIfNeeded();
    await Promise.all([
      page.waitForURL(/\/marketplace\/claims\//, { timeout: 60000 }),
      btn.click(),
    ]);
    console.log('preluat →', page.url());
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await shot(page, 'baie-claimed', { full: true });
  }
  if (want('post')) {
    await go(page, '/ro/marketplace', 1500);
    await saveBoxes(page, 'feed2', { credits: page.getByText(/\d+ credite/).first(), mine: page.getByText('Preluată deja de firma ta', { exact: false }).first(), slots: page.getByText('Sloturi 1/3').first() });
    await shot(page, 'feed2', { full: true });
    await go(page, '/ro/marketplace/wallet', 1500);
    await hidePlanPrices(page);
    await page.waitForTimeout(300);
    await saveBoxes(page, 'wallet2', { metrics: page.getByText('Portofel de credite', { exact: true }), sub: page.getByText('Abonament', { exact: true }), plans: page.getByText('Planuri', { exact: true }), buy: page.getByText('Cumpără credite', { exact: true }), stripe: page.getByText('Plată securizată cu cardul', { exact: false }) });
    await shot(page, 'wallet2', { full: true });
    await go(page, '/ro/marketplace/claims', 1500);
    await shot(page, 'claims3', { full: true });
  }
} finally {
  await saveState(ctx, AS);
  await browser.close();
}

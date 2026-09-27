// Faza D (scena 7b) — recenzia 5★ a cererii finalizate „Bucătărie verde salvie · Cluj-Napoca”
// (preluarea e797deb9 a Atelier Nord). Recenzia se vede doar in pagina clientului (mihai.ionescu):
// login NOU in context propriu, FARA a scrie data/auth/mihai… (agentul „clienti” foloseste acel fisier).
// Doar citire: nu se modifica nimic.
import { chromium } from 'playwright';
import { login } from '../../demo-env/tools/login.mjs';
import { routeCdnToPins } from '../../demo-env/tools/cdn-pins.mjs';
import { PHONE, go, shot, saveBoxes } from './cap-lib.mjs';

const browser = await chromium.launch({ args: ['--hide-scrollbars', '--lang=ro-RO'] });
try {
  const ctx = await browser.newContext(PHONE);
  await routeCdnToPins(ctx);
  const page = await ctx.newPage();
  await login(page, 'mihai.ionescu@demo.ro');
  await go(page, '/ro/requests/5dcd35ab-79e9-4455-859f-5bbea0ff1981/offers', 2500);
  await saveBoxes(page, 'review', {
    review: page.getByText('Recenzie', { exact: true }).first(),
    stars: page.getByText('★★★★★', { exact: false }).first(),
    status: page.getByText('Finalizată', { exact: false }).first(),
  });
  await shot(page, 'review', { full: true });
  // deconectare: sesiunea asta nu mai e folosita
  await ctx.request.post('http://localhost:3001/api/v1/auth/logout').catch(() => {});
} finally {
  await browser.close();
}

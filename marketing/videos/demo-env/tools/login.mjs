// Login reutilizabil pentru capturi Playwright pe mediul demo.
//
//   import { login, contextAs, DEMO_PASSWORD } from '../demo-env/tools/login.mjs';
//   const ctx = await contextAs(browser, 'elena.dumitru@demo.ro', { viewport: {...}, deviceScaleFactor: 2 });
//   const page = await ctx.newPage(); await page.goto('http://localhost:3000/ro/requests');
//
// contextAs() refoloseste sesiunea salvata in data/auth/<email>.json (cookie-uri httpOnly
// access 15 min + refresh 7 zile; frontendul reimprospateaza singur access-ul). Motiv:
// POST /auth/login e limitat la 5/min per IP — nu te loga la fiecare captura.
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const APP = process.env.APP_URL || 'http://localhost:3000';
export const DEMO_PASSWORD = process.env.DEMO_PASSWORD || 'DemoCozy2026!';
const AUTH_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'auth');

// Login prin formularul real /ro/login (etichetele nu au htmlFor → selectam dupa name).
export async function login(page, email, password = DEMO_PASSWORD, { redirect } = {}) {
  const url = `${APP}/ro/login${redirect ? `?redirect=${encodeURIComponent(redirect)}` : ''}`;
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await Promise.all([
    // fara redirect → /ro/dashboard (toate rolurile); cu ?redirect=/x → /ro/x
    page.waitForURL((u) => !u.pathname.endsWith('/login'), { timeout: 30000 }),
    page.getByRole('button', { name: 'Intră în cont' }).click(),
  ]);
  await page.waitForLoadState('networkidle');
}

const stateFile = (email) => join(AUTH_DIR, `${email}.json`);
const cookieLeft = (state, name) => {
  const c = state.cookies.find((k) => k.name === name);
  return c ? c.expires * 1000 - Date.now() : -1;
};

// Context autentificat. Ordinea: sesiune salvata cu mm_access valid (>2 min) → refolosita;
// altfel mm_refresh valid → POST /auth/refresh (roteste tokenul) ; altfel login prin formular.
// La final apeleaza saveState(ctx, email) ca rotirile facute de frontend sa nu se piarda.
// Nu folosi ACELASI cont in paralel din doua procese (rotirea refresh-ului are grace 30s).
export async function contextAs(browser, email, contextOptions = {}, { password } = {}) {
  mkdirSync(AUTH_DIR, { recursive: true });
  const file = stateFile(email);
  const base = { locale: 'ro-RO', ...contextOptions };
  if (existsSync(file)) {
    const state = JSON.parse(readFileSync(file, 'utf8'));
    if (cookieLeft(state, 'mm_access') > 120e3) return browser.newContext({ ...base, storageState: state });
    if (cookieLeft(state, 'mm_refresh') > 60e3) {
      const ctx = await browser.newContext({ ...base, storageState: state });
      const ok = await ctx.request.post('http://localhost:3001/api/v1/auth/refresh').then((r) => r.ok()).catch(() => false);
      if (ok) { await ctx.storageState({ path: file }); return ctx; }
      await ctx.close();
    }
  }
  const ctx = await browser.newContext(base);
  const page = await ctx.newPage();
  await login(page, email, password);
  await ctx.storageState({ path: file });
  await page.close();
  return ctx;
}

export async function saveState(ctx, email) {
  await ctx.storageState({ path: stateFile(email) }).catch(() => {});
}

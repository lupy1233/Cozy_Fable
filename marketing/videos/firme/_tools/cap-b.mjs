// Faza B — fisa de lucru 861163e7 (Dormitor: dulap si noptiere · Bucuresti), singura preluare pe care
// agentul "firma" are voie sa trimita oferta (DEMO-ENV §10). SCHIMBA STAREA DB:
//   1) atribuire "Se ocupa" → Cristina Vlad   2) clarificare → SLA in pauza   3) oferta Versiunea 1 (+PDF)
//   node firme/_tools/cap-b.mjs [assign] [clar] [offer] [pdf]
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { open, go, shot, saveBoxes, saveState, RAW } from './cap-lib.mjs';

const only = process.argv.slice(2);
const want = (j) => only.length === 0 || only.includes(j);
const AS = 'owner.a@demo.ro';
const URL = '/ro/marketplace/claims/861163e7-6eec-48b3-8616-6f1749840a9b';
const QUESTION = 'Bună ziua! Tavanul are 2,60 m pe toată lungimea peretelui?';

const { browser, ctx, page } = await open(AS);
const boxes = async (name) => saveBoxes(page, name, {
  select: page.locator('select').first(),
  slaLabel: page.getByText('Termen pentru ofertă (SLA)', { exact: false }).first(),
  slaPaused: page.getByText('pauză', { exact: false }).first(),
  client: page.getByText('Clientul tău', { exact: false }).first(),
  offerTitle: page.getByText('Trimite oferta', { exact: true }).first(),
  roomPrice: page.locator('input[placeholder="0"]').first(),
  total: page.getByText('Total', { exact: true }).first(),
  price: page.locator('input[name="price"]'),
  currency: page.locator('select[name="currency"]'),
  term: page.locator('input[name="deliveryTerm"]'),
  warranty: page.locator('input[name="warranty"]'),
  validity: page.locator('input[name="validityDays"]'),
  desc: page.locator('textarea[name="description"]'),
  send: page.locator('form').filter({ hasText: 'Trimite oferta' }).getByRole('button', { name: 'Trimite' }),
  chat: page.getByText('Chat', { exact: true }).first(),
  slaCard: page.getByText('SLA și stare', { exact: true }).first(),
  clarTa: page.getByPlaceholder('Ce vrei să clarifici cu clientul?'),
  clarBtn: page.getByRole('button', { name: 'Cere clarificare' }),
  question: page.getByText(QUESTION, { exact: false }).first(),
  files: page.getByText('Fișierele cererii', { exact: true }).first(),
  pdf: page.getByText('Descarcă PDF').first(),
  v1: page.getByText('Versiunea 1', { exact: false }).first(),
});

try {
  await go(page, URL, 2000);
  if (want('assign')) {
    await boxes('b0');
    await shot(page, 'b0-sheet', { full: true });
    await page.locator('select').first().selectOption({ label: 'Cristina Vlad' });
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);
    await boxes('b1');
    await shot(page, 'b1-assigned', { full: true });
  }
  if (want('clar')) {
    const ta = page.getByPlaceholder('Ce vrei să clarifici cu clientul?');
    await ta.scrollIntoViewIfNeeded();
    await ta.click();
    await ta.pressSequentially(QUESTION, { delay: 20 });
    await page.waitForTimeout(500);
    await boxes('b2');
    await shot(page, 'b2-clar-typed', { full: true });
    await page.getByRole('button', { name: 'Cere clarificare' }).click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(500);
    await boxes('b3');
    await shot(page, 'b3-clar-sent', { full: true });
  }
  if (want('offer')) {
    const room = page.locator('input[placeholder="0"]').first();
    await room.scrollIntoViewIfNeeded();
    await room.click();
    await room.pressSequentially('11800', { delay: 40 });
    await page.waitForTimeout(600);
    await boxes('b4');
    await shot(page, 'b4-price', { full: true });
    await page.locator('input[name="deliveryTerm"]').fill('5 săptămâni');
    await page.locator('input[name="warranty"]').fill('24 de luni');
    await page.locator('input[name="validityDays"]').fill('14');
    await page.locator('textarea[name="description"]').fill('Dulap cu uși glisante albe mate, 240 × 260 cm, cu bară de haine și sertare, plus două noptiere suspendate. Include transport și montaj.');
    await page.locator('textarea[name="description"]').blur();
    await page.waitForTimeout(600);
    await boxes('b5');
    await shot(page, 'b5-filled', { full: true });
    const send = page.locator('form').filter({ hasText: 'Trimite oferta' }).getByRole('button', { name: 'Trimite' });
    await send.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2500);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(500);
    await boxes('b6');
    await shot(page, 'b6-sent', { full: true });
  }
  if (want('pdf')) {
    await go(page, URL, 2000);
    const t0 = Date.now();
    const [dl] = await Promise.all([
      page.waitForEvent('download', { timeout: 90000 }).catch(() => null),
      page.getByText('Descarcă PDF').first().click(),
    ]);
    if (dl) { await dl.saveAs(join(RAW, 'offer-v1.pdf')); console.log('PDF salvat in', Date.now() - t0, 'ms'); }
    else {
      // poate se deschide intr-un tab nou / fereastra
      const pages = ctx.pages();
      console.log('fara download; pagini deschise:', pages.map((p) => p.url()));
    }
    await page.waitForTimeout(1000);
    await shot(page, 'b7-after-pdf', { full: true });
  }
} finally {
  await saveState(ctx, AS);
  await browser.close();
}

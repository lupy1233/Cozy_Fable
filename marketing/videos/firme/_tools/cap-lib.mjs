// Utilitare comune pentru capturile Video 2 (firme): Playwright, telefon 430x932,
// DPR 3 (layout identic cu @2x, doar mai multi pixeli pentru zoom-ul din video),
// sesiune refolosita prin demo-env/tools/login.mjs (limita 5 login-uri/min).
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { APP, contextAs, saveState } from '../../demo-env/tools/login.mjs';
import { routeCdnToPins } from '../../demo-env/tools/cdn-pins.mjs';

export { APP, saveState };
export const HERE = dirname(fileURLToPath(import.meta.url));
export const RAW = process.env.RAW_DIR || '/tmp/claude-0/-home-user-Cozy-Fable/af6c217d-d172-5c9e-a983-a809397375c3/scratchpad/raw';
export const DPR = Number(process.env.DPR || 3);
export const PHONE = { viewport: { width: 430, height: 932 }, deviceScaleFactor: DPR, isMobile: true, hasTouch: true, locale: 'ro-RO' };

export async function open(as) {
  const browser = await chromium.launch({ args: ['--hide-scrollbars', '--lang=ro-RO'] });
  const ctx = as ? await contextAs(browser, as, PHONE) : await browser.newContext(PHONE);
  await routeCdnToPins(ctx);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.error('[pageerror]', e.message));
  return { browser, ctx, page };
}

export async function go(page, path, wait = 1200) {
  await page.goto(path.startsWith('http') ? path : APP + path, { waitUntil: 'networkidle', timeout: 120000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(wait);
}

// Mascheaza e-mailurile de login (…@demo.ro): doar subsirul e-mailului primeste blur.
export async function maskEmails(page) {
  return page.evaluate(() => {
    const re = /[\w.+-]+@demo\.ro/gi;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const hits = [];
    while (walker.nextNode()) { const t = walker.currentNode; if (/@demo\.ro/i.test(t.textContent) && !t.parentElement?.dataset?.masked) hits.push(t); }
    for (const t of hits) {
      const frag = document.createDocumentFragment();
      let last = 0; const s = t.textContent;
      for (const m of s.matchAll(re)) {
        frag.appendChild(document.createTextNode(s.slice(last, m.index)));
        const sp = document.createElement('span');
        sp.dataset.masked = '1'; sp.textContent = m[0];
        sp.style.filter = 'blur(6px)'; sp.style.display = 'inline-block';
        frag.appendChild(sp); last = m.index + m[0].length;
      }
      frag.appendChild(document.createTextNode(s.slice(last)));
      t.parentNode.replaceChild(frag, t);
    }
    for (const inp of document.querySelectorAll('input')) if (/@demo\.ro/i.test(inp.value)) inp.style.filter = 'blur(6px)';
    return hits.length;
  });
}

// Ascunde preturile planurilor (regula PLAN: preturile Silver/Gold/Platinum nu apar in video).
export async function hidePlanPrices(page) {
  return page.evaluate(() => {
    let n = 0;
    for (const el of document.querySelectorAll('p, span, div')) {
      if (el.children.length > 2) continue;
      const tx = el.textContent || '';
      if (/(\/ 30 de zile|lei \+ TVA 21%)/.test(tx) && tx.length < 90) { el.style.display = 'none'; n++; }
    }
    return n;
  });
}

export async function shot(page, name, { full = false, clip } = {}) {
  const out = join(RAW, name + '.png');
  mkdirSync(dirname(out), { recursive: true });
  await maskEmails(page);
  await page.waitForTimeout(150);
  await page.screenshot({ path: out, fullPage: full, clip });
  const h = await page.evaluate(() => document.documentElement.scrollHeight);
  console.log('salvat', name, full ? `(pagina ${h}px)` : '');
  return out;
}

// pozitia (CSS px, relativ la document) a unui element — pentru cadrajele din video
export async function boxOf(page, locator) {
  const b = await locator.first().boundingBox({ timeout: 1500 });
  const sy = await page.evaluate(() => window.scrollY);
  return b ? { x: Math.round(b.x), y: Math.round(b.y + sy), w: Math.round(b.width), h: Math.round(b.height) } : null;
}

// salveaza cutiile (CSS px, relativ la document) ale elementelor cheie: RAW/<name>.json
import { writeFileSync } from 'node:fs';
export async function saveBoxes(page, name, map) {
  const res = {};
  for (const [k, loc] of Object.entries(map)) {
    try { res[k] = await boxOf(page, loc); } catch { res[k] = null; }
  }
  res._docH = await page.evaluate(() => document.documentElement.scrollHeight);
  writeFileSync(join(RAW, name + '.json'), JSON.stringify(res, null, 1));
  console.log('cutii', name, JSON.stringify(res));
  return res;
}

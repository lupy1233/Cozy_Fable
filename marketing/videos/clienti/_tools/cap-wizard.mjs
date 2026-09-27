// Scenele 3–9 — wizard-ul real /ro/requests/new, parcurs ca vizitator (draft anonim), apoi login
// ioana.marinescu@demo.ro doar pentru publicare (oras Cluj-Napoca, conform DEMO-ENV „Nu faceti”).
// Profil de browser persistent (PROFILE) → draftul (token + store zustand in localStorage) supravietuieste
// intre faze; fiecare faza reia de unde a ramas cea anterioara.
//   PROFILE=<dir> PHASE=1|2|3 SKETCH=<schita.jpg> node clienti/_tools/cap-wizard.mjs
//   PHASE=0: doar cosul (varianta scenei 4: tab Piese individuale → + Dulap), intr-un profil separat
//   PHASE=1: pornire → cos → intrebari Dormitor (materiale, cote) → schita camerei (upload)
//   PHASE=2: Dulap in 3D (latime, coloane, usi deschise) → material → spre date generale
//   PHASE=3: fisiere/inspiratie → date generale (buget, termen, adresa) → sumar → login ioana
//   PHASE=4: publicare (overlay prins prin intarzierea cererii de publish) → Cererile mele
import { chromium } from 'playwright';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { APP, PHONE, RAW, settle, staticHeader, headerHeight, shotRegion, shotView, boxOf } from './cap-lib.mjs';

const PHASE = Number(process.env.PHASE || 1);
const PROFILE = resolve(process.env.PROFILE || '/tmp/cozy-clienti-wizard');
const SKETCH = process.env.SKETCH ? resolve(process.env.SKETCH) : null;
mkdirSync(RAW, { recursive: true });
const metaFile = `${RAW}/wizard-meta.json`;
const meta = existsSync(metaFile) ? JSON.parse(readFileSync(metaFile, 'utf8')) : {};
const save = () => writeFileSync(metaFile, JSON.stringify(meta, null, 1));

const ctx = await chromium.launchPersistentContext(PROFILE, {
  ...PHONE, args: ['--hide-scrollbars', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = ctx.pages()[0] || (await ctx.newPage());
page.on('pageerror', (e) => console.error('[pageerror]', e.message));
const cont = async (name = 'Continuă') => { await page.getByRole('button', { name }).last().click(); await page.waitForTimeout(1300); };
const resume = async () => {
  const b = page.getByRole('button', { name: 'Continuă de unde am rămas' });
  if (await b.count()) { await b.click(); await page.waitForTimeout(900); }
};
const open = async () => {
  await page.goto(APP + '/ro/requests/new', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  await resume();
  await settle(page, 600);
};
const title = async (tag) => console.log('  pas', tag, JSON.stringify((await page.locator('main h2').allInnerTexts()).slice(0, 2)));
const card = (text) => page.locator('button[aria-pressed]').filter({ hasText: text }).first();
const top = () => page.evaluate(() => scrollTo(0, 0));

try {

if (PHASE === 0) {
  // varianta scenei 4 folosita in video: tab „Piese individuale” → „+ Dulap” (profil separat, alt draft anonim)
  await open();
  await staticHeader(page);
  await page.getByText('Știu ce vreau, dar nu am proiect').click();
  await page.waitForTimeout(1400);
  await top(); await settle(page, 500);
  meta.cart = { tabPieces: await boxOf(page.getByText('Piese individuale', { exact: true }).first()), basket: await boxOf(page.getByText('Coșul cererii tale').first()) };
  await shotRegion(page, 's4-a.png', 0, 1500);
  await page.getByText('Piese individuale', { exact: true }).first().click();
  await page.waitForTimeout(1000);
  meta.cart.addDulap = await boxOf(page.getByRole('button', { name: 'Adaugă Dulap' }));
  await shotRegion(page, 's4-b.png', 0, 1500);
  await page.getByRole('button', { name: 'Adaugă Dulap' }).click();
  await page.waitForTimeout(1000);
  await shotRegion(page, 's4-c.png', 0, 1500);
}
if (PHASE === 1) {
  await open();
  meta.header = await headerHeight(page);
  await page.screenshot({ path: `${RAW}/w-header-anon.png`, clip: { x: 0, y: 0, width: 430, height: meta.header } });
  await staticHeader(page);
  // S3 — „Cum pornim cererea?”
  meta.startStd = await boxOf(page.locator('button').filter({ hasText: 'Știu ce vreau, dar nu am proiect' }).first());
  meta.startDesign = await boxOf(page.locator('button').filter({ hasText: 'Nu știu exact ce vreau' }).first());
  await shotRegion(page, 's3-a.png', 0, 1500);
  await page.getByText('Știu ce vreau, dar nu am proiect').click();
  await page.waitForTimeout(1400);
  await top();
  await settle(page, 500);
  // S4 — cosul cererii
  meta.addDormitor = await boxOf(page.getByRole('button', { name: 'Adaugă Dormitor' }));
  meta.tabPieces = await boxOf(page.getByText('Piese individuale', { exact: true }).first());
  meta.basket = await boxOf(page.getByText('Coșul cererii tale').first());
  await shotRegion(page, 's4-a.png', 0, 1500);
  await page.getByRole('button', { name: 'Adaugă Dormitor' }).click();
  await page.waitForTimeout(1000);
  await shotRegion(page, 's4-b.png', 0, 1500);
  await page.getByText('Piese individuale', { exact: true }).first().click();
  await page.waitForTimeout(1000);
  meta.addDulap = await boxOf(page.getByRole('button', { name: 'Adaugă Dulap' }));
  await shotRegion(page, 's4-c.png', 0, 1500);
  await page.getByRole('button', { name: 'Adaugă Dulap' }).click();
  await page.waitForTimeout(1000);
  await shotRegion(page, 's4-d.png', 0, 1500);
  await page.getByRole('button', { name: 'Începe' }).click();
  await page.waitForTimeout(1500);
  // Dormitor: piese
  await card('Haine pe umerașe').click(); await page.waitForTimeout(400);
  await card('Depozitare la îndemână').click(); await page.waitForTimeout(400);
  await cont();
  await title('usi'); await card('Glisante').click(); await page.waitForTimeout(400); await cont();
  await title('noptiere'); await page.locator('button[aria-pressed]').nth(1).click(); await page.waitForTimeout(400); await cont();
  // S5b — cote pe schita
  await top(); await settle(page, 600); await title('cote');
  const inputs = page.locator('main input');
  meta.dimFigure = await page.evaluate(() => {
    const t = Array.from(document.querySelectorAll('main figcaption')).find((el) => el.textContent.includes('literele corespund'));
    let el = t; while (el && !/rounded/.test(el.className || '')) el = el.parentElement;
    const r = (el || t).getBoundingClientRect(); return { x: r.x + scrollX, y: r.y + scrollY, w: r.width, h: r.height };
  });
  meta.dimInputA = await boxOf(inputs.nth(0));
  await shotRegion(page, 's5-d0.png', 0, 1300);
  const typed = ['1', '18', '180'];
  for (let i = 0; i < typed.length; i++) {
    await inputs.nth(0).fill(typed[i]);
    await page.waitForTimeout(700);
    await shotRegion(page, `s5-d${i + 1}.png`, 0, 1300);
  }
  await inputs.nth(1).fill('45'); await page.waitForTimeout(500);
  await shotRegion(page, 's5-d4.png', 0, 1300);
  await inputs.nth(2).fill('260'); await page.waitForTimeout(700);
  await shotRegion(page, 's5-d5.png', 0, 1300);
  await cont();
  // S5a — materiale (cartonase foto) + intoarcerea cartii
  await top(); await settle(page, 800);
  const mdf = page.locator('div.h-72').filter({ hasText: 'Orice culoare RAL' }).first();
  meta.matCard = await boxOf(mdf);
  meta.matInfo = await boxOf(mdf.getByRole('button', { name: 'Vezi detalii' }));
  await shotRegion(page, 's5-m0.png', 0, 2200);
  await mdf.getByRole('button', { name: 'Vezi detalii' }).click();
  await page.waitForTimeout(1600);
  await shotRegion(page, 's5-m1.png', 0, 2200);
  await mdf.getByRole('button', { name: 'Înapoi la opțiune' }).click();
  await page.waitForTimeout(1200);
  await mdf.locator('button[aria-pressed]').click();
  await page.waitForTimeout(600);
  await shotRegion(page, 's5-m2.png', 0, 2200);
  await cont();
  // deschidere dulap, material + deschidere noptiere
  await page.locator('button[aria-pressed]').first().click(); await page.waitForTimeout(400); await cont();
  await card('Orice culoare RAL').click(); await page.waitForTimeout(400); await cont();
  await page.locator('button[aria-pressed]').first().click(); await page.waitForTimeout(400); await cont();
  // S7 — schita camerei: ghidul + upload (PUT-ul spre S3 e intarziat ca sa prindem „Se încarcă...”)
  await top(); await settle(page, 800);
  meta.dropzone = await page.evaluate(() => {
    const t = Array.from(document.querySelectorAll('main *')).find((el) => el.children.length === 0 && el.textContent.includes('Trage fișierele aici'));
    let el = t; while (el && !/dashed/.test(el.className || '')) el = el.parentElement;
    const r = (el || t).getBoundingClientRect(); return { x: r.x + scrollX, y: r.y + scrollY, w: r.width, h: r.height };
  });
  await shotRegion(page, 's7-a.png', 0, 2400);
  if (SKETCH) {
    await page.route(/localhost:9000\//, async (route) => { await new Promise((r) => setTimeout(r, 5000)); await route.continue(); });
    await page.locator('input[type=file]').first().setInputFiles(SKETCH);
    await page.waitForTimeout(1500);
    await shotRegion(page, 's7-b.png', 0, 2400);
    await page.waitForTimeout(6000);
    await settle(page, 1500);
    await page.unroute(/localhost:9000\//);
    meta.fileRow = await boxOf(page.locator('li').filter({ hasText: 'schita' }).first()).catch(() => null);
    await shotRegion(page, 's7-c.png', 0, 2400);
  }
  save();
}

if (PHASE === 2) {
  await open();
  if (await page.getByText('Ai o schiță a camerei?').count()) await cont();
  if (await page.getByText('Ce material?').count()) { await page.getByRole('button', { name: 'Înapoi' }).last().click(); await page.waitForTimeout(1500); }
  await page.waitForTimeout(3000);
  await staticHeader(page);
  await title('3d');
  const fields = async () => { await page.getByRole('button', { name: 'Câmpuri clasice' }).click(); await page.waitForTimeout(900); };
  const mode3d = async () => { await page.getByRole('button', { name: 'Configurează în 3D' }).click(); await page.waitForTimeout(3500); };
  const setWidth = async (cm) => {
    const inp = page.locator('main input[type=number]').first();
    await inp.fill(String(cm)); await inp.press('Enter'); await page.waitForTimeout(700);
  };
  const colRow = () => page.locator('main div.flex.items-center.gap-3').filter({ has: page.locator('span', { hasText: /^Coloane$/ }) }).first();
  const setZones = async (plan) => {   // plan[ci] = fill pentru zona 0 (usa)
    for (let ci = 0; ci < plan.length; ci++) {
      const sel = () => page.locator('main select');
      await sel().nth(ci * 3).selectOption('DOOR'); await page.waitForTimeout(350);
      await sel().nth(ci * 3 + 1).selectOption(plan[ci]); await page.waitForTimeout(350);
    }
  };
  const shot3d = async (name) => {
    await page.mouse.move(2, 2);
    await page.waitForTimeout(2500);
    const tg = await boxOf(page.getByRole('button', { name: 'Configurează în 3D' }));
    const cv = await boxOf(page.locator('main canvas').first());
    meta.toggle3d = tg; meta.canvas = cv;
    await shotRegion(page, name, Math.max(0, Math.round(tg.y) - 360), 1100);
    meta.region3d = Math.max(0, Math.round(tg.y) - 360);
  };
  await fields();
  await page.locator('main button[title="Stejar"]').first().click(); await page.waitForTimeout(400);
  await page.getByRole('button', { name: 'Cu mâner' }).first().click(); await page.waitForTimeout(400);
  await setWidth(120);
  await colRow().getByRole('button', { name: 'Mai puține' }).click(); await page.waitForTimeout(600);
  await setZones(['HANGING', 'SHELVES']);
  await mode3d();
  await shot3d('s6-a.png');
  await setWidth(150); await page.waitForTimeout(800);
  await shot3d('s6-b.png');
  await fields();
  await setWidth(180);
  await colRow().getByRole('button', { name: 'Mai multe' }).click(); await page.waitForTimeout(600);
  await setZones(['HANGING', 'SHELVES', 'HANGING']);
  await mode3d();
  await shot3d('s6-c.png');
  // usile: click pe fiecare usa (zona de sus a fiecarei coloane) in canvas
  const cv = await page.locator('main canvas').first().boundingBox();
  meta.canvasView = cv;
  const doors = JSON.parse(process.env.DOORS || '[[0.33,0.33],[0.5,0.33],[0.67,0.33]]');
  for (const [fx, fy] of doors) { await page.mouse.click(cv.x + fx * cv.width, cv.y + fy * cv.height); await page.waitForTimeout(900); }
  // conturul portocaliu al zonei selectate se scoate DOAR din captura: resetam starea React a zonei
  // active (acelasi procedeu ca in v1, cap-studio.mjs); aplicatia nu e modificata, usile raman deschise
  const cleared = await page.evaluate(() => {
    const el = document.querySelector('main canvas');
    let node = el, key = null;
    while (node && !key) { key = Object.keys(node).find((k) => k.startsWith('__reactFiber$')); if (!key) node = node.parentElement; }
    let f = node && node[key], n = 0;
    while (f) {
      let h = f.memoizedState;
      while (h && typeof h === 'object' && 'next' in h) {
        const st = h.memoizedState;
        if (st && typeof st === 'object' && 'col' in st && 'zone' in st && h.queue && h.queue.dispatch) { h.queue.dispatch(null); n++; }
        h = h.next;
      }
      f = f.return;
    }
    return n;
  });
  console.log('  selectie curatata', cleared);
  await page.waitForTimeout(1200);
  await shot3d('s6-d.png');
  await page.locator('main button[title="Nuc"]').first().click(); await page.waitForTimeout(800);
  await shot3d('s6-e.png');
}

if (PHASE === 3) {
  const EMAIL = 'ioana.marinescu@demo.ro';
  await open();
  await staticHeader(page);
  if (await page.getByText('Construiește-ți dulapul în 3D').count()) await cont();
  if (await page.getByText('Ce material?').count()) { await card('Orice culoare RAL').click(); await page.waitForTimeout(400); await cont(); }
  if (await page.getByText('Ai o schiță a peretelui?').count()) await cont('Spre date generale');
  await title('fisiere');
  // inspiratie: 3 poze din galerie (filtrul Dormitor din dialog)
  await page.getByRole('button', { name: 'Răsfoiește galeria' }).click();
  await page.waitForTimeout(1500);
  const dlg = page.getByRole('dialog');
  await dlg.getByRole('button', { name: 'Dormitor', exact: true }).first().click().catch(() => {});
  await page.waitForTimeout(1500);
  for (const t of ['Dormitor cu dulapuri albe pe tot peretele', 'Dormitor cu panou din șipci de lemn', 'Dormitor cu tăblie tapițată bej']) {
    await dlg.locator(`button[aria-pressed] img[alt="${t}"]`).first().click(); await page.waitForTimeout(400);
  }
  await dlg.getByRole('button', { name: 'Continuă' }).last().click();
  await page.waitForTimeout(1500);
  await settle(page, 800);
  await shotRegion(page, 's8-up.png', 0, 1400);
  await cont();
  // S8 — date generale: estimarea + sliderul + termenul
  await top(); await settle(page, 1200); await title('detalii');
  const slider = page.locator('main input[type=range]').first();
  meta.slider = await boxOf(slider);
  meta.estimate = await boxOf(page.getByText('Estimare orientativă', { exact: false }).first());
  meta.deadline13 = await boxOf(page.getByRole('button', { name: '1–3 luni' }));
  meta.budgetLabel = await boxOf(page.getByText('Buget', { exact: true }).first()).catch(() => null);
  await shotRegion(page, 's8-a.png', 0, 1500);
  await slider.focus();
  for (let i = 0; i < Number(process.env.SLIDER_STEPS || 10); i++) { await page.keyboard.press('ArrowRight'); await page.waitForTimeout(60); }
  await page.waitForTimeout(600);
  await shotRegion(page, 's8-b.png', 0, 1500);
  await page.getByRole('button', { name: '1–3 luni' }).click();
  await page.waitForTimeout(700);
  await shotRegion(page, 's8-c.png', 0, 1500);
  // adresa (Cluj-Napoca, conform DEMO-ENV) + contact fictiv
  const all = page.locator('main input');
  const n = await all.count();
  let countyIdx = -1;
  for (let i = 0; i < n; i++) if ((await all.nth(i).getAttribute('name')) === 'county') countyIdx = i;
  await all.nth(countyIdx - 1).fill('Str. Observatorului 34, ap. 7'); await page.waitForTimeout(300);
  await page.locator('input[name="county"]').fill('Cluj');
  await page.locator('input[name="city"]').fill('Cluj-Napoca');
  const c0 = page.locator('input[name="contactPreferences.0.value"]');
  if (await c0.count() && !(await c0.inputValue())) await c0.fill('ioana.m@example.com');
  await page.waitForTimeout(600);
  await shotRegion(page, 's8-d.png', 0, 2600);
  await cont('Spre sumar');
  await top(); await settle(page, 1200); await title('sumar-anonim');
  await page.screenshot({ path: `${RAW}/s9-anon.png`, fullPage: true });
  // login (o singura data) → inapoi in wizard, pe sumar
  await page.getByRole('button', { name: 'Autentifică-te pentru a publica' }).click();
  await page.waitForURL(/\/login/);
  await page.locator('input[name="email"]').fill(EMAIL);
  await page.locator('input[name="password"]').fill(process.env.DEMO_PASSWORD || 'DemoCozy2026!');
  await Promise.all([page.waitForURL((u) => !u.pathname.endsWith('/login'), { timeout: 30000 }), page.getByRole('button', { name: 'Intră în cont' }).click()]);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);
  if (!page.url().includes('/requests/new')) await page.goto(APP + '/ro/requests/new', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await resume();
  await settle(page, 1200);
  meta.headerIoana = await headerHeight(page);
  await page.evaluate(() => scrollTo(0, 0)); await page.waitForTimeout(300);
  await page.screenshot({ path: `${RAW}/w-header-ioana.png`, clip: { x: 0, y: 0, width: 430, height: meta.headerIoana } });
  await staticHeader(page);
  await title('sumar');
  meta.publish = await boxOf(page.getByRole('button', { name: 'Publică' }));
  await page.screenshot({ path: `${RAW}/s9-a.png`, fullPage: true });
  console.log('salvat s9-a.png (full)');
}
if (PHASE === 4) {
  await open();
  await title('sumar (publicare)');
  meta.publish = await boxOf(page.getByRole('button', { name: 'Publică' }));
  {
    await page.route(/\/requests\/drafts\/[^/]+\/publish/, async (route) => { await new Promise((r) => setTimeout(r, 4000)); await route.continue(); });
    await page.addStyleTag({ content: 'header{position:sticky!important}' });
    // overlay-ul e centrat in viewport: un viewport scund il aduce in zona utila a telefonului din video
    await page.setViewportSize({ width: 430, height: Number(process.env.PUB_H || 640) });
    await page.evaluate((y) => scrollTo(0, Math.max(0, y - 500)), meta.publish.y);
    await page.waitForTimeout(500);
    meta.publishView = await page.getByRole('button', { name: 'Publică' }).evaluate((el) => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, sy: scrollY }; });
    await shotView(page, 's9-b0.png');
    await page.getByRole('button', { name: 'Publică' }).click();
    await page.waitForTimeout(1200);
    await shotView(page, 's9-b.png');
    await page.waitForURL(/\/requests\/[0-9a-f-]{36}/, { timeout: 60000 });
    meta.newRequestId = page.url().match(/requests\/([0-9a-f-]{36})/)[1];
    await page.unroute(/\/requests\/drafts\/[^/]+\/publish/);
    await page.setViewportSize({ width: 430, height: 932 });
    await settle(page, 1500);
    await page.screenshot({ path: `${RAW}/s9-detail.png`, fullPage: true });
    await page.goto(APP + '/ro/requests', { waitUntil: 'networkidle' });
    await settle(page, 1500);
    await page.evaluate(() => scrollTo(0, 0));
    await page.screenshot({ path: `${RAW}/w-header-ioana2.png`, clip: { x: 0, y: 0, width: 430, height: meta.headerIoana } });
    await staticHeader(page);
    await page.screenshot({ path: `${RAW}/s10-a.png`, fullPage: true });
    console.log('publicat', meta.newRequestId);
  }
}
} catch (e) {
  console.error('EROARE', e.message.split('\n')[0]);
  await page.screenshot({ path: `${RAW}/_fail.png`, fullPage: true }).catch(() => {});
  process.exitCode = 1;
} finally {
  save();
  console.log(JSON.stringify(meta));
  await ctx.close();
}

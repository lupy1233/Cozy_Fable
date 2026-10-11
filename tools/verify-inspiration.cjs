// Verificare read-only: Green real sau frontend local cu acelasi catalog public.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const { chromium, devices } = createRequire(path.resolve(__dirname, '../apps/frontend/package.json'))('@playwright/test');

const green = 'https://app-green-production-7958.up.railway.app';
const origin = process.env.INSPIRATION_ORIGIN || green;
assert([green, 'http://127.0.0.1:3100'].includes(origin), 'Unexpected gallery target');
const local = origin !== green;
const output = path.resolve(__dirname, '../docs/implementation/screenshots', local ? 'inspiration-local' : 'inspiration-green');
fs.mkdirSync(output, { recursive: true });

async function main() {
  const response = await fetch(`${green}/api/v1/inspiration?limit=100`);
  assert.equal(response.status, 200);
  const catalog = await response.json();
  assert.equal(catalog.length, 70);
  assert(catalog.every((photo) => photo.company.name === 'Mobila Unicat' && photo.sourceUrl?.startsWith('https://www.mobilaunicat.ro/locuinta/')));
  const browser = await chromium.launch({ headless: true });
  const results = [];
  try {
    for (const locale of ['en', 'ro']) for (const mobile of [false, true]) {
      const context = await browser.newContext(mobile ? devices['Pixel 7'] : { viewport: { width: 1440, height: 1000 } });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      if (local) await page.route('**/api/v1/inspiration?*', (route) => {
        const query = new URL(route.request().url()).searchParams;
        const filtered = catalog.filter((photo) => !query.get('type') || photo.roomType === query.get('type'));
        return route.fulfill({ json: filtered.slice(Number(query.get('offset') || 0), Number(query.get('offset') || 0) + Number(query.get('limit') || 40)) });
      });
      await page.goto(`${origin}/${locale}/inspiration`, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => {
        const visible = [...document.querySelectorAll('figure img')].filter((image) => image.getBoundingClientRect().top < innerHeight);
        return visible.length > 0 && visible.every((image) => image.complete && image.naturalWidth > 0);
      });
      await page.screenshot({ path: path.join(output, `${locale}-${mobile ? 'mobile' : 'desktop'}.png`) });
      await page.getByRole('button', { name: locale === 'en' ? 'Kitchen' : 'Bucătărie', exact: true }).click();
      await page.waitForFunction(() => document.querySelectorAll('figure').length === 15);
      await page.locator('figure button').first().click();
      const dialog = page.getByRole('dialog');
      await dialog.waitFor();
      assert(await dialog.getByRole('link').filter({ hasText: locale === 'en' ? 'View project' : 'Vezi proiectul' }).count() > 0);
      await page.keyboard.press('Escape');
      assert.equal(await dialog.count(), 0);
      if (!mobile && locale === 'en' && (local || process.env.INSPIRATION_EXPECT_FALLBACK === '1')) {
        await page.route(catalog[0].imageUrl, (route) => route.abort());
        await page.goto(`${origin}/en/inspiration`, { waitUntil: 'domcontentloaded' });
        await page.getByText('Photo unavailable', { exact: true }).first().waitFor();
        await page.waitForFunction(() => [...document.querySelectorAll('figure img')]
          .filter((image) => image.getBoundingClientRect().top < innerHeight)
          .every((image) => image.complete && image.naturalWidth > 0));
        await page.screenshot({ path: path.join(output, 'image-fallback.png') });
      }
      assert.deepEqual(errors, []);
      results.push({ locale, mobile, cards: 15, lightbox: true, pageErrors: 0 });
      await context.close();
    }
  } finally { await browser.close(); }
  console.log(JSON.stringify({ origin, catalog: catalog.length, results, output }, null, 2));
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });

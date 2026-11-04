import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { ROOM_OPTION_PHOTOS } from '../src/components/configurator/illustrations';

async function contactSheet(page: Page, info: TestInfo, concepts: string[], name: string) {
  await page.setViewportSize({ width: 1280, height: 960 });
  await page.goto('/en');
  const src = (concept: string) => `/_next/image?url=${encodeURIComponent(`/illustrations/options/${concept}.png`)}&w=256&q=75`;
  const groups = Array.from({ length: Math.ceil(concepts.length / 10) }, (_, index) => concepts.slice(index * 10, (index + 1) * 10));
  const card = (concept: string) => `<figure><div class="card"><img src="${src(concept)}" alt="${concept}"></div><figcaption>${concept}</figcaption><div class="pill"><img src="${src(concept)}" alt=""><span>${concept}</span></div></figure>`;
  await page.setContent(`<!doctype html><html><head><title>Furniture option artwork audit</title><style>
    body{margin:0;padding:24px;background:#f4f0e9;color:#342b25;font:13px Arial,sans-serif}h1{font-size:24px;margin:0 0 12px}p{margin:0 0 20px}section{display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin-bottom:20px}figure{margin:0;background:white;border:1px solid #ddd1c1;border-radius:8px;overflow:hidden}.card{padding:24px 28px 8px}.card img{height:176px;width:100%}img{display:block;object-fit:contain;mix-blend-mode:multiply}figcaption{padding:10px;border-top:1px solid #eee6da;overflow-wrap:anywhere;min-height:30px}.pill{display:flex;align-items:center;gap:6px;border:1px solid #ddd1c1;border-radius:999px;margin:0 10px 12px;padding:6px 12px;min-height:36px;font-size:11px}.pill img{height:36px;width:36px;flex:none}
    </style></head><body><h1>Standalone furniture option artwork — ${concepts.length} concepts</h1><p>Card artwork: maximum 176 px high. Compact inline artwork: 36 × 36 px.</p><main>${groups.map((group) => `<section>${group.map(card).join('')}</section>`).join('')}</main></body></html>`);
  await expect.poll(() => page.locator('img').evaluateAll((images) => images.filter((image) => image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0).length), { timeout: 90_000 }).toBe(concepts.length * 2);
  const path = info.outputPath(`${name}.png`);
  await page.screenshot({ path, fullPage: true });
  await info.attach(name, { path, contentType: 'image/png' });
  if (groups.length > 1) {
    for (let index = 0; index < groups.length; index += 1) {
      const groupPath = info.outputPath(`${name}-${index + 1}.png`);
      await page.locator('section').nth(index).screenshot({ path: groupPath });
      await info.attach(`${name}-${index + 1}`, { path: groupPath, contentType: 'image/png' });
    }
  }
}

test('first generated batch loads at card and compact sizes', async ({ page }, info) => {
  test.setTimeout(120_000);
  await contactSheet(page, info, ['kitchen-layout-straight', 'kitchen-layout-l', 'kitchen-layout-u', 'dressing-layout-linear', 'sliding-doors', 'countertop-pal', 'countertop-hpl', 'countertop-quartz', 'countertop-granite'], 'first-batch-card-and-compact');
});

test('all 41 standalone concepts load at card and compact sizes', async ({ page }, info) => {
  test.setTimeout(120_000);
  const concepts = [...new Set(Object.values(ROOM_OPTION_PHOTOS).flatMap((steps) => Object.values(steps).flatMap((options) => Object.values(options).map((Photo) => Photo.displayName!.slice('OptionPhoto('.length, -1)))))].sort();
  expect(concepts).toHaveLength(41);
  await contactSheet(page, info, concepts, 'option-artwork-contact-sheet');
});

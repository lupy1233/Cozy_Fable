// Redirectioneaza in browser imaginile de pe CDN-ul partenerului (blocat in container)
// catre pinii locali: .../60c4bb3c.../<fisier> → http://localhost:8099/<slug>.jpg.
// Necesar pentru imaginile HARDCODATE in frontend (ex. sectiunea „Idei” de pe landing,
// apps/frontend/src/lib/inspiration.ts); galeria din DB e deja rescrisa.
//   import { routeCdnToPins } from './demo-env/tools/cdn-pins.mjs';
//   await routeCdnToPins(context);   // sau page
export const PINS_BASE = process.env.PINS_BASE_URL || 'http://localhost:8099';

export const slugOf = (url) => decodeURIComponent(new URL(url).pathname.split('/').pop())
  .replace(/\.[a-z0-9]+$/i, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export async function routeCdnToPins(target) {
  await target.route(/^https:\/\/cdn\.prod\.website-files\.com\//, async (route) => {
    const res = await fetch(`${PINS_BASE}/${slugOf(route.request().url())}.jpg`).catch(() => null);
    if (!res || !res.ok) return route.abort();
    await route.fulfill({ status: 200, contentType: 'image/jpeg', body: Buffer.from(await res.arrayBuffer()) });
  });
}

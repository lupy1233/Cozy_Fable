// QA ritm: la fiecare cadru (30 fps) masoara deplasarea verticala a capturilor vizibile din telefon
// (px in cadrul final) si listeaza intervalele cu viteza > 60 px/s — trebuie sa cada doar in actiuni/tranzitii.
//   node clienti/_tools/audit-motion.mjs
import { chromium } from 'playwright';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
await page.goto(pathToFileURL(resolve('clienti/index.html')).href);
await page.waitForFunction(() => window.__video);
const res = await page.evaluate(() => {
  const K = 924 / 430;
  const imgs = Array.from(document.querySelectorAll('#states .st'));
  const prev = new Map();
  const fast = [];
  for (let f = 0; f <= 2700; f++) {
    const t = (f * 1000) / 30;
    window.__video.seek(t);
    for (const st of imgs) {
      const o = parseFloat(st.style.opacity || '0');
      const m = /translate\([-\d.]+px,\s*([-\d.]+)px\)/.exec(st.firstElementChild.style.transform || '');
      const y = m ? parseFloat(m[1]) : 0;
      if (o > 0.02 && prev.has(st.id)) {
        const v = Math.abs(y - prev.get(st.id)) * K * 30;
        if (v > 60.5) fast.push([+(t / 1000).toFixed(2), st.id, Math.round(v)]);
      }
      prev.set(st.id, y);
    }
  }
  // grupare pe intervale
  const out = [];
  for (const [t, id, v] of fast) {
    const last = out[out.length - 1];
    if (last && last.id === id && t - last.t1 < 0.1) { last.t1 = t; last.max = Math.max(last.max, v); }
    else out.push({ id, t0: t, t1: t, max: v });
  }
  return out;
});
for (const r of res) console.log(`${r.t0.toFixed(2)}–${r.t1.toFixed(2)} s  ${r.id}  max ${r.max} px/s`);
await browser.close();

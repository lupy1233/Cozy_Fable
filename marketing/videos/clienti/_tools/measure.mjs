// Masoara latimea textelor cu fonturile reale (calibrare marimi de titlu).
import { chromium } from 'playwright';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
const css = pathToFileURL(resolve('assets/fonts/fonts.local.css')).href;
const items = JSON.parse(process.argv[2]);
const browser = await chromium.launch();
const page = await browser.newPage();
// pagina trebuie sa fie file:// (din about:blank fonturile locale nu se incarca)
const { writeFileSync } = await import('node:fs');
const tmp = resolve('clienti/_tools/_measure.html');
writeFileSync(tmp, `<html><head><link rel="stylesheet" href="${css}"></head><body></body></html>`);
await page.goto(pathToFileURL(tmp).href);
const res = await page.evaluate(async (items) => {
  await Promise.all(['400 100px Marcellus','500 40px "DM Sans"','600 40px "DM Sans"','italic 500 40px "DM Sans"','400 40px "IBM Plex Mono"','500 40px "IBM Plex Mono"'].map(f => document.fonts.load(f, 'AaĂăÂâÎîȘșȚț€№·–—…„”')));
  const out = [];
  for (const [font, text, extra] of items) {
    const s = document.createElement('span');
    s.style.cssText = `font:${font};white-space:nowrap;position:absolute;${extra||''}`;
    s.textContent = text; document.body.appendChild(s);
    out.push([Math.round(s.getBoundingClientRect().width), font, text]);
    s.remove();
  }
  return out;
}, items);
for (const r of res) console.log(r.join(' | '));
const check = await page.evaluate(() => [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family + ' ' + f.weight + ' ' + f.style).join(', '));
console.log('fonturi incarcate:', check);
await browser.close();
(await import('node:fs')).unlinkSync(tmp);

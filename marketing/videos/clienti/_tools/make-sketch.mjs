// Randeaza „fotografia” schitei pe hartie (aceeasi ca recuzita din scena 7) ca JPEG, pentru upload real in wizard.
//   node clienti/_tools/make-sketch.mjs <out.jpg>
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const out = resolve(process.argv[2] || 'schita-dormitor.jpg');
const svg = readFileSync(new URL('./paper-sketch.svg', import.meta.url), 'utf8');
const css = pathToFileURL(resolve('assets/fonts/fonts.local.css')).href;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1120, height: 880 } });
await page.setContent(`<html><head><link rel="stylesheet" href="${css}"><style>html,body{margin:0}svg{display:block;width:1120px;height:880px}</style></head><body>${svg}</body></html>`);
await page.evaluate(() => document.fonts.load('italic 500 32px "DM Sans"'));
await page.waitForTimeout(300);
await page.screenshot({ path: out, type: 'jpeg', quality: 88 });
await browser.close();
console.log('salvat', out);

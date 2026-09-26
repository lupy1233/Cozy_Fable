#!/usr/bin/env node
// Randare deterministica: pagina HTML a unui video -> cadre PNG (Playwright/Chromium)
// -> MP4 H.264 (ffmpeg-static). Pagina trebuie sa expuna `window.__video`:
//   { durationMs: number, seek(tMs: number): void | Promise<void> }
// (vezi lib/timeline.js — Timeline.install() face asta automat).
//
// Utilizare:
//   node render.mjs <dir-video> [--out fisier.mp4] [--fps 30] [--w 1080] [--h 1920]
//                   [--from 0] [--to 45] [--stills 0,1.5,3] [--stills-only]
//                   [--scale 1] [--contact 12]
//
//   --stills   : salveaza PNG-uri la secundele date in <dir-video>/stills/ (QA vizual)
//   --contact N: salveaza o plansa de contact cu N cadre echidistante (stills/contact.png)
//   --from/--to: randeaza doar un interval (secunde) — util la iteratii rapide
//   --scale    : deviceScaleFactor (1 = 1080x1920 nativ)

import { chromium } from 'playwright';
import ffmpegPath from 'ffmpeg-static';
import { spawn } from 'node:child_process';
import { mkdirSync, existsSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) args[key] = true;
      else { args[key] = next; i++; }
    } else args._.push(a);
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
const dir = args._[0];
if (!dir) {
  console.error('Lipseste directorul video. Ex: node render.mjs clienti --out out/clienti.mp4');
  process.exit(1);
}
const videoDir = resolve(dir);
const htmlPath = join(videoDir, 'index.html');
if (!existsSync(htmlPath)) {
  console.error(`Nu exista ${htmlPath}`);
  process.exit(1);
}

const fps = Number(args.fps ?? 30);
const width = Number(args.w ?? 1080);
const height = Number(args.h ?? 1920);
const scale = Number(args.scale ?? 1);
const from = Number(args.from ?? 0);
const outPath = resolve(args.out ?? join(videoDir, 'out', 'video.mp4'));
const stillsOnly = Boolean(args['stills-only']);
const stills = args.stills ? String(args.stills).split(',').map(Number).filter((n) => !Number.isNaN(n)) : [];
const contact = args.contact ? Number(args.contact) : 0;

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--force-device-scale-factor=1', '--hide-scrollbars', '--font-render-hinting=none'],
});
const page = await browser.newPage({
  viewport: { width, height },
  deviceScaleFactor: scale,
  reducedMotion: 'no-preference',
});
page.on('pageerror', (e) => console.error('[pageerror]', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.error('[console]', m.text()); });

await page.goto(pathToFileURL(htmlPath).href, { waitUntil: 'load' });
await page.evaluate(() => document.fonts.ready);
await page.waitForFunction(() => window.__video && typeof window.__video.seek === 'function', null, { timeout: 15000 });
await page.evaluate(() => window.__video.ready ? window.__video.ready() : undefined);

const durationMs = await page.evaluate(() => window.__video.durationMs);
const to = Number(args.to ?? durationMs / 1000);
const totalFrames = Math.max(1, Math.round((to - from) * fps));
console.log(`Video: ${videoDir}\n  durata ${(durationMs / 1000).toFixed(2)}s, interval ${from}s..${to}s, ${totalFrames} cadre @ ${fps}fps, ${width}x${height}`);

const seek = async (tMs) => {
  await page.evaluate(async (t) => { await window.__video.seek(t); }, tMs);
  // doua rAF ca layout-ul si compozitorul sa prinda starea noua
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
};

const stillsDir = join(videoDir, 'stills');
if (stills.length || contact) mkdirSync(stillsDir, { recursive: true });
for (const s of stills) {
  await seek(s * 1000);
  const file = join(stillsDir, `t${s.toFixed(2).replace('.', '_')}.png`);
  await page.screenshot({ path: file, type: 'png' });
  console.log('  still', file);
}
if (contact) {
  // plansa de contact: N cadre echidistante, micsorate, pe o grila
  const cols = Math.min(4, contact);
  const rows = Math.ceil(contact / cols);
  const thumbW = 270, thumbH = Math.round((thumbW * height) / width);
  const shots = [];
  for (let i = 0; i < contact; i++) {
    const t = from * 1000 + ((to - from) * 1000 * i) / Math.max(1, contact - 1);
    await seek(t);
    shots.push({ t, buf: await page.screenshot({ type: 'png' }) });
  }
  const sheet = await browser.newPage({ viewport: { width: cols * thumbW, height: rows * (thumbH + 28) } });
  const html = `<html><body style="margin:0;background:#222;display:grid;grid-template-columns:repeat(${cols},${thumbW}px);font:12px monospace;color:#eee">${shots
    .map((s) => `<div style="height:${thumbH + 28}px"><img src="data:image/png;base64,${s.buf.toString('base64')}" width="${thumbW}" height="${thumbH}"><div style="padding:4px 6px">t=${(s.t / 1000).toFixed(2)}s</div></div>`)
    .join('')}</body></html>`;
  await sheet.setContent(html);
  await sheet.screenshot({ path: join(stillsDir, 'contact.png'), type: 'png' });
  await sheet.close();
  console.log('  contact sheet', join(stillsDir, 'contact.png'));
}

if (stillsOnly) {
  await browser.close();
  process.exit(0);
}

mkdirSync(resolve(outPath, '..'), { recursive: true });
const ff = spawn(ffmpegPath, [
  '-y', '-loglevel', 'error',
  '-f', 'image2pipe', '-framerate', String(fps), '-i', '-',
  // pista audio muta (AAC) pentru compatibilitate cu platformele sociale
  '-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=48000',
  '-shortest',
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-pix_fmt', 'yuv420p',
  '-profile:v', 'high', '-level', '4.2', '-r', String(fps),
  '-c:a', 'aac', '-b:a', '96k',
  '-movflags', '+faststart',
  outPath,
], { stdio: ['pipe', 'inherit', 'inherit'] });

const ffDone = new Promise((res, rej) => {
  ff.on('close', (code) => (code === 0 ? res() : rej(new Error(`ffmpeg exit ${code}`))));
});

const started = Date.now();
for (let i = 0; i < totalFrames; i++) {
  const tMs = from * 1000 + (i * 1000) / fps;
  await seek(tMs);
  const buf = await page.screenshot({ type: 'png' });
  if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
  if (i % fps === 0 || i === totalFrames - 1) {
    const pct = Math.round(((i + 1) / totalFrames) * 100);
    process.stdout.write(`\r  cadru ${i + 1}/${totalFrames} (${pct}%) t=${(tMs / 1000).toFixed(1)}s  ${Math.round((Date.now() - started) / 1000)}s`);
  }
}
process.stdout.write('\n');
ff.stdin.end();
await ffDone;
await browser.close();

const meta = { out: outPath, fps, width, height, durationS: to - from, frames: totalFrames, renderedAt: new Date().toISOString() };
writeFileSync(outPath.replace(/\.mp4$/, '.json'), JSON.stringify(meta, null, 2));
console.log('Gata:', outPath);

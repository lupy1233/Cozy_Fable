#!/usr/bin/env node
// Rescrie image_url din inspiration_photos (CDN-uri blocate in container) catre
// imaginile locale servite de pins-server.mjs: http://localhost:8099/<slug>.jpg.
// NU atinge seed-ul din repo — doar randurile din DB-ul local. Idempotent.
//   node tools/rewrite-inspiration.mjs            → rescrie (backup in data/inspiration-urls-backup.json)
//   node tools/rewrite-inspiration.mjs --revert   → pune inapoi URL-urile originale din backup
// Daca seed:inspiration a fost rulat din nou dupa rescriere (a recreat pozele cu URL
// de CDN), duplicatele fara referinte sunt sterse, restul depublicate.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const PINS = join(here, '..', 'pins');
const BACKUP = join(here, '..', 'data', 'inspiration-urls-backup.json');
const BASE = process.env.PINS_BASE_URL || 'http://localhost:8099';
const psql = (sql) => execFileSync('psql', ['-h', 'localhost', '-U', 'marketplace', '-d', 'marketplace', '-v', 'ON_ERROR_STOP=1', '-tAc', sql],
  { env: { ...process.env, PGPASSWORD: 'marketplace' } }).toString();
const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
const slugOf = (url) => decodeURIComponent(url.split('/').pop()).replace(/\.[a-z0-9]+$/i, '').toLowerCase()
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const rows = JSON.parse(psql(`select coalesce(json_agg(json_build_object('id',id,'url',image_url,
  'refs',(select count(*) from inspiration_board_items b where b.photo_id=p.id)+(select count(*) from request_inspiration_photos r where r.photo_id=p.id))),'[]')
  from inspiration_photos p where image_url is not null`));
const backup = existsSync(BACKUP) ? JSON.parse(readFileSync(BACKUP, 'utf8')) : {};

if (process.argv.includes('--revert')) {
  const stmts = rows.filter((r) => backup[r.id] && r.url.startsWith(BASE)).map((r) => `update inspiration_photos set image_url=${q(backup[r.id])} where id=${q(r.id)};`);
  if (stmts.length) psql(stmts.join('\n'));
  console.log(`revert: ${stmts.length} URL-uri restaurate`);
  process.exit(0);
}

const localUrls = new Set(rows.filter((r) => r.url.startsWith(BASE)).map((r) => r.url));
const stmts = [];
let rewritten = 0, dropped = 0, missing = 0;
for (const r of rows) {
  if (r.url.startsWith(BASE)) continue;
  const target = `${BASE}/${slugOf(r.url)}.jpg`;
  if (!existsSync(join(PINS, `${slugOf(r.url)}.jpg`))) { missing++; console.warn(`lipseste pins/${slugOf(r.url)}.jpg (${r.url})`); continue; }
  if (localUrls.has(target)) {
    // duplicat recreat de seed:inspiration — originalul e deja rescris
    stmts.push(r.refs > 0 ? `update inspiration_photos set published=false where id=${q(r.id)};` : `delete from inspiration_photos where id=${q(r.id)};`);
    dropped++;
    continue;
  }
  backup[r.id] = r.url;
  localUrls.add(target);
  stmts.push(`update inspiration_photos set image_url=${q(target)} where id=${q(r.id)};`);
  rewritten++;
}
if (stmts.length) psql(`begin;\n${stmts.join('\n')}\ncommit;`);
writeFileSync(BACKUP, JSON.stringify(backup, null, 1));
console.log(`rewrite: ${rewritten} rescrise, ${dropped} duplicate eliminate, ${missing} fara imagine; total local: ${localUrls.size}`);

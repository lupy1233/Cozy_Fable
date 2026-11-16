// Imbina fragmentele i18n ale agentilor in apps/frontend/src/messages/{ro,en}.json.
// Baza = continutul fisierului din commitul BAZA (argument sau HEAD), niciodata fisierul de lucru,
// deci rularea e idempotenta: aceleasi fragmente → acelasi rezultat.
// Fragmente (in folderul dat ca prim argument):
//   <id>.ro.json / <id>.en.json  — obiect imbricat cu chei noi sau texte schimbate
//   <id>.remove.json             — lista de cai cu punct, sterse din ambele limbi
// Utilizare: node merge-i18n.cjs <folder-fragmente> [commit-baza]
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const REPO = 'E:/Cozy Fable';
const MSG = 'apps/frontend/src/messages';
const fragDir = process.argv[2];
const base = process.argv[3] || 'HEAD';
if (!fragDir || !fs.existsSync(fragDir)) {
  console.error('Folder de fragmente lipsa: ' + fragDir);
  process.exit(2);
}

// lacat simplu (mkdir e atomic); asteapta pana la 30 s
const lock = path.join(fragDir, '.lock');
const t0 = Date.now();
for (;;) {
  try { fs.mkdirSync(lock); break; } catch {
    if (Date.now() - t0 > 30000) { try { fs.rmdirSync(lock); } catch {} }
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 200);
  }
}

let code = 0;
try {
  const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
  const files = fs.readdirSync(fragDir).filter((f) => f.endsWith('.json')).sort();
  const ids = [...new Set(files.map((f) => f.replace(/\.(ro|en|remove)\.json$/, '')))];
  const problems = [];
  const stats = {};
  const out = {};
  const leafSets = { ro: new Map(), en: new Map() };

  for (const lang of ['ro', 'en']) {
    const raw = execFileSync('git', ['-C', REPO, 'show', `${base}:${MSG}/${lang}.json`], {
      encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
    });
    const doc = JSON.parse(raw);
    stats[lang] = { added: 0, changed: 0, removed: 0 };
    const owner = leafSets[lang];

    const merge = (target, frag, prefix, id) => {
      for (const [k, v] of Object.entries(frag)) {
        const p = prefix ? `${prefix}.${k}` : k;
        if (k.includes('.')) { problems.push(`${id}.${lang}: cheia "${p}" contine punct`); continue; }
        if (isObj(v)) {
          if (target[k] !== undefined && !isObj(target[k])) {
            problems.push(`${id}.${lang}: "${p}" e text in baza, fragmentul il face obiect`);
            continue;
          }
          if (target[k] === undefined) target[k] = {};
          merge(target[k], v, p, id);
        } else {
          if (typeof v !== 'string') { problems.push(`${id}.${lang}: "${p}" nu e text`); continue; }
          if (isObj(target[k])) { problems.push(`${id}.${lang}: "${p}" e obiect in baza, fragmentul il face text`); continue; }
          const prev = owner.get(p);
          if (prev && prev.id !== id && prev.v !== v) {
            problems.push(`CONFLICT ${lang}: "${p}" scris diferit de ${prev.id} si ${id}`);
            continue;
          }
          if (!prev) { if (target[k] === undefined) stats[lang].added++; else if (target[k] !== v) stats[lang].changed++; }
          owner.set(p, { id, v });
          target[k] = v;
        }
      }
    };

    for (const id of ids) {
      const f = path.join(fragDir, `${id}.${lang}.json`);
      if (!fs.existsSync(f)) continue;
      let frag;
      try { frag = JSON.parse(fs.readFileSync(f, 'utf8').replace(/^\uFEFF/, '')); }
      catch (e) { problems.push(`${id}.${lang}.json: JSON invalid (${e.message})`); continue; }
      merge(doc, frag, '', id);
    }
    for (const id of ids) {
      const f = path.join(fragDir, `${id}.remove.json`);
      if (!fs.existsSync(f)) continue;
      let list;
      try { list = JSON.parse(fs.readFileSync(f, 'utf8').replace(/^\uFEFF/, '')); }
      catch (e) { problems.push(`${id}.remove.json: JSON invalid (${e.message})`); continue; }
      for (const p of list) {
        const parts = String(p).split('.');
        let node = doc;
        for (let i = 0; i < parts.length - 1 && node; i++) node = node[parts[i]];
        const last = parts[parts.length - 1];
        if (node && Object.prototype.hasOwnProperty.call(node, last)) { delete node[last]; stats[lang].removed++; }
      }
    }
    out[lang] = doc;
  }

  // paritate RO/EN pe cheile atinse de fragmente
  for (const p of leafSets.ro.keys()) if (!leafSets.en.has(p)) problems.push(`PARITATE: "${p}" exista in fragment RO, lipseste in EN (${leafSets.ro.get(p).id})`);
  for (const p of leafSets.en.keys()) if (!leafSets.ro.has(p)) problems.push(`PARITATE: "${p}" exista in fragment EN, lipseste in RO (${leafSets.en.get(p).id})`);

  if (problems.length) {
    console.error('NU am scris nimic. Probleme:\n- ' + problems.join('\n- '));
    code = 1;
  } else {
    for (const lang of ['ro', 'en']) {
      const text = JSON.stringify(out[lang], null, 2).replace(/\n/g, '\r\n') + '\r\n';
      const dest = path.join(REPO, MSG, `${lang}.json`);
      const tmp = dest + '.tmp-merge';
      fs.writeFileSync(tmp, text, 'utf8');
      fs.renameSync(tmp, dest);
    }
    console.log(`OK (${ids.length} fragmente: ${ids.join(', ')}). RO +${stats.ro.added} noi, ${stats.ro.changed} schimbate, ${stats.ro.removed} sterse · EN +${stats.en.added} noi, ${stats.en.changed} schimbate, ${stats.en.removed} sterse`);
  }
} finally {
  try { fs.rmdirSync(lock); } catch {}
}
process.exit(code);

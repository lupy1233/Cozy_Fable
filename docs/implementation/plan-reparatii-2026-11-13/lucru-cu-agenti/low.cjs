// Ruleaza o comanda cu prioritate scazuta (BELOW_NORMAL) si cu "rand la coada":
// cel mult N comenzi grele in acelasi timp pe tot calculatorul (N = continutul fisierului
// low-slots.txt de langa acest script; implicit 1). Asa, mai multi agenti pot rula teste
// fara sa blocheze ce foloseste omul la calculator (joc, browser).
// Procesele-copil mostenesc prioritatea scazuta.
// Folosire: node low.cjs pnpm -F backend exec jest src/cale/fisier.spec.ts
const os = require('os');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

if (process.argv.length < 3) {
  console.error('Folosire: node low.cjs <comanda> [argumente...]');
  process.exit(2);
}

const DIR = __dirname;
const STALE_MS = 25 * 60 * 1000; // un test tintit nu dureaza atat; peste = lacat uitat
const MAX_WAIT_MS = 40 * 60 * 1000;

function slots() {
  try {
    const n = parseInt(fs.readFileSync(path.join(DIR, 'low-slots.txt'), 'utf8').trim(), 10);
    return Number.isFinite(n) && n >= 1 && n <= 6 ? n : 1;
  } catch {
    return 1;
  }
}
function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}
function alive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return e.code === 'EPERM';
  }
}
function tryAcquire() {
  const n = slots();
  for (let i = 0; i < n; i++) {
    const lock = path.join(DIR, `.low-lock-${i}`);
    try {
      fs.mkdirSync(lock);
      fs.writeFileSync(path.join(lock, 'pid'), String(process.pid));
      return lock;
    } catch (e) {
      if (e.code !== 'EEXIST') throw e;
      // lacat ramas de la un proces mort sau prea vechi -> il iau
      try {
        const pid = parseInt(fs.readFileSync(path.join(lock, 'pid'), 'utf8'), 10);
        const age = Date.now() - fs.statSync(lock).mtimeMs;
        if (!alive(pid) || age > STALE_MS) {
          fs.rmSync(lock, { recursive: true, force: true });
          i--; // reincearca acelasi loc
        }
      } catch {
        // pid inca nescris de celalalt proces: il las in pace
      }
    }
  }
  return null;
}

try {
  os.setPriority(0, os.constants.priority.PRIORITY_BELOW_NORMAL);
} catch (e) {
  console.error('low.cjs: nu am putut scadea prioritatea:', e.message);
}

const started = Date.now();
let lock = tryAcquire();
let announced = false;
while (!lock && Date.now() - started < MAX_WAIT_MS) {
  if (!announced) {
    console.error('low.cjs: astept la rand (alta comanda grea ruleaza acum)...');
    announced = true;
  }
  sleep(1500 + Math.floor(Math.random() * 1000));
  lock = tryAcquire();
}
if (!lock) console.error('low.cjs: am asteptat prea mult; rulez fara lacat.');

function release() {
  if (lock) {
    try {
      fs.rmSync(lock, { recursive: true, force: true });
    } catch {}
    lock = null;
  }
}
process.on('exit', release);
process.on('SIGINT', () => { release(); process.exit(130); });
process.on('SIGTERM', () => { release(); process.exit(143); });

// cu shell:true argumentele se lipesc intr-un singur sir: le pun in ghilimele pe cele
// cu spatii sau cu semne speciale pentru cmd.exe
function q(a) {
  return /[\s&|<>^()"]/.test(a) ? '"' + a.replace(/"/g, '\\"') + '"' : a;
}
const cmdline = process.argv.slice(2).map(q).join(' ');
const r = spawnSync(cmdline, { stdio: 'inherit', shell: true });
release();
if (r.error) {
  console.error('low.cjs:', r.error.message);
  process.exit(1);
}
process.exit(r.status === null ? 1 : r.status);

import { execFileSync } from 'node:child_process';
import { closeSync, openSync, readFileSync, readSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Scaneaza exact fisierele care ar intra intr-un commit (tracked + netrackuite neignorate).
// Nu tipareste niciodata secretul complet: doar primele 4 caractere + "…".

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
export const DEFAULT_ALLOWLIST_PATH = path.join(SCRIPT_DIR, 'secret-scan-allowlist.json');
export const MAX_FILE_BYTES = 2 * 1024 * 1024;
const BINARY_SNIFF_BYTES = 8000;

export const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.webp', '.gif', '.glb', '.gltf', '.mp4',
  '.woff', '.woff2', '.ico', '.pdf', '.zip',
]);

export const SECRET_PATTERNS = [
  { id: 'stripe_live', regex: /\b(sk|rk)_live_[0-9A-Za-z]{10,}/ },
  { id: 'stripe_webhook', regex: /\bwhsec_[0-9A-Za-z]{20,}/ },
  { id: 'aws_key', regex: /\bAKIA[0-9A-Z]{16}\b/ },
  { id: 'private_key', regex: /-----BEGIN (RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY/ },
  { id: 'age_identity', regex: /AGE-SECRET-KEY-1[0-9A-Z]{50,}/ },
  { id: 'github_token', regex: /\b(ghp|gho|ghs|ghu)_[0-9A-Za-z]{30,}|github_pat_[0-9A-Za-z_]{40,}/ },
  { id: 'railway_token', regex: /RAILWAY_(API_)?TOKEN\s*=\s*[0-9a-f-]{30,}/ },
  {
    // URL Postgres cu parola spre un host care nu e local
    id: 'db_url_remote',
    regex: /postgres(ql)?:\/\/[^:\s/@]+:[^@\s]{8,}@(?!localhost|127\.0\.0\.1|postgres[:/]|host\.docker\.internal)[^\s'"]+/,
  },
  {
    id: 'env_secret_hex',
    regex: /^(JWT_[A-Z_]*SECRET|MESSAGE_ENCRYPTION_KEY|IP_HASH_SALT|PAYMENT_WEBHOOK_SECRET|SMTP_PASS|S3_SECRET_KEY)\s*=\s*\S{16,}/,
    skipEnvExample: true,
  },
  { id: 'sendgrid_key', regex: /\bSG\.[0-9A-Za-z_-]{20,}\.[0-9A-Za-z_-]{20,}/ },
];

export function toPosix(filePath) {
  return filePath.split('\\').join('/');
}

export function isEnvExample(filePath) {
  return path.posix.basename(toPosix(filePath)) === '.env.example';
}

export function forbiddenReason(filePath) {
  const posix = toPosix(filePath);
  const base = path.posix.basename(posix);
  if (base === '.env' || (base.startsWith('.env.') && base !== '.env.example')) return 'fisier .env';
  if (/\.dump$/i.test(base)) return 'dump de baza de date';
  if (/\.age$/i.test(base)) return 'fisier criptat age';
  if (/\.pem$/i.test(base)) return 'cheie/certificat .pem';
  if (/\.key$/i.test(base)) return 'fisier .key';
  if (/\.jar$/i.test(base)) return 'arhiva .jar';
  if (posix.startsWith('test-results/') || posix.includes('/test-results/')) return 'artefacte test-results/';
  return null;
}

export function hasBinaryExtension(filePath) {
  return BINARY_EXTENSIONS.has(path.posix.extname(toPosix(filePath)).toLowerCase());
}

export function maskFragment(fragment) {
  return `${fragment.slice(0, 4)}…`;
}

export function isAllowlisted(allowlist, filePath, patternId) {
  const posix = toPosix(filePath);
  return allowlist.some((entry) => entry.path === posix && entry.pattern === patternId);
}

export function scanText(filePath, text, { allowlist = [] } = {}) {
  const findings = [];
  const envExample = isEnvExample(filePath);
  const lines = text.split(/\r?\n/);
  lines.forEach((line, index) => {
    for (const pattern of SECRET_PATTERNS) {
      if (pattern.skipEnvExample && envExample) continue;
      const match = pattern.regex.exec(line);
      if (!match) continue;
      if (isAllowlisted(allowlist, filePath, pattern.id)) continue;
      findings.push({
        path: toPosix(filePath),
        line: index + 1,
        pattern: pattern.id,
        masked: maskFragment(match[0]),
      });
    }
  });
  return findings;
}

function looksBinary(buffer) {
  const limit = Math.min(buffer.length, BINARY_SNIFF_BYTES);
  for (let index = 0; index < limit; index += 1) {
    if (buffer[index] === 0) return true;
  }
  return false;
}

function readHead(absolutePath) {
  const fd = openSync(absolutePath, 'r');
  try {
    const buffer = Buffer.alloc(BINARY_SNIFF_BYTES);
    const read = readSync(fd, buffer, 0, BINARY_SNIFF_BYTES, 0);
    return buffer.subarray(0, read);
  } finally {
    closeSync(fd);
  }
}

export function scanFiles({ root, files, allowlist = [] }) {
  const result = { scanned: 0, skippedBinary: 0, findings: [], forbidden: [], large: [] };
  for (const file of files) {
    const posix = toPosix(file);
    const reason = forbiddenReason(posix);
    if (reason) result.forbidden.push({ path: posix, reason });

    const absolutePath = path.join(root, posix);
    let stats;
    try {
      stats = statSync(absolutePath);
    } catch {
      continue; // sters in working tree, dar inca in index
    }
    if (!stats.isFile()) continue;
    if (hasBinaryExtension(posix)) {
      result.skippedBinary += 1;
      continue;
    }
    if (stats.size > MAX_FILE_BYTES) {
      result.large.push({ path: posix, bytes: stats.size });
      continue;
    }
    if (looksBinary(readHead(absolutePath))) {
      result.skippedBinary += 1;
      continue;
    }
    result.scanned += 1;
    result.findings.push(...scanText(posix, readFileSync(absolutePath, 'utf8'), { allowlist }));
  }
  return result;
}

export function listCommitCandidates(root) {
  const output = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  return [...new Set(output.split('\0').filter(Boolean))];
}

export function loadAllowlist(filePath = DEFAULT_ALLOWLIST_PATH) {
  const entries = JSON.parse(readFileSync(filePath, 'utf8'));
  if (!Array.isArray(entries)) throw new Error('Allowlist must be a JSON array');
  for (const entry of entries) {
    if (typeof entry?.path !== 'string' || typeof entry?.pattern !== 'string' || typeof entry?.reason !== 'string' || !entry.reason.trim()) {
      throw new Error('Each allowlist entry needs path, pattern and a non-empty reason');
    }
    if (!SECRET_PATTERNS.some((pattern) => pattern.id === entry.pattern)) {
      throw new Error(`Unknown pattern in allowlist: ${entry.pattern}`);
    }
  }
  return entries;
}

function main() {
  const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
  const allowlist = loadAllowlist();
  const files = listCommitCandidates(root);
  const result = scanFiles({ root, files, allowlist });

  for (const item of result.large) {
    process.stdout.write(`mare (>2 MB), verifica manual: ${item.path} (${item.bytes} bytes)\n`);
  }
  for (const item of result.forbidden) {
    process.stdout.write(`${item.path}:0:forbidden_file ${item.reason}\n`);
  }
  for (const finding of result.findings) {
    process.stdout.write(`${finding.path}:${finding.line}:${finding.pattern} ${finding.masked}\n`);
  }
  const problems = result.findings.length + result.forbidden.length;
  process.stdout.write(
    `scan-secrets: ${files.length} fisiere candidate, ${result.scanned} scanate, ${result.skippedBinary} binare sarite, ` +
    `${result.large.length} mari, ${result.findings.length} gasiri, ${result.forbidden.length} fisiere interzise\n`,
  );
  if (problems > 0) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 2;
  }
}

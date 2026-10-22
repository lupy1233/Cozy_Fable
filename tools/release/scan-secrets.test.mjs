import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  SECRET_PATTERNS,
  forbiddenReason,
  maskFragment,
  scanFiles,
  scanText,
} from './scan-secrets.mjs';

// Exemplele sintetice sunt construite prin concatenare, ca scanerul sa nu se declanseze pe acest fisier.
const j = (...parts) => parts.join('');
const SAMPLES = {
  stripe_live: j('sk', '_live_', 'Abc123Def456Ghi789'),
  stripe_webhook: j('whsec', '_', 'A1b2C3d4E5f6G7h8I9j0K1l2'),
  aws_key: j('AK', 'IA', 'ABCDEFGHIJKLMNOP'),
  private_key: j('-----BEGIN ', 'RSA ', 'PRIVATE KEY-----'),
  age_identity: j('AGE-SECRET', '-KEY-1', 'Q'.repeat(58)),
  github_token: j('gh', 'p_', 'a'.repeat(36)),
  railway_token: j('RAILWAY', '_TOKEN=', '0123abcd-0123-abcd-0123-0123456789ab'),
  db_url_remote: j('postgresql://', 'app:', 'Sup3rS3cretPass', '@db.example.com:5432/prod'),
  env_secret_hex: j('JWT_ACCESS', '_SECRET=', 'f'.repeat(64)),
  sendgrid_key: j('S', 'G.', 'a'.repeat(22), '.', 'b'.repeat(43)),
};

test('every secret pattern has a synthetic example that it catches', () => {
  for (const pattern of SECRET_PATTERNS) {
    const sample = SAMPLES[pattern.id];
    assert.ok(sample, `missing sample for ${pattern.id}`);
    // tiparul env e ancorat la inceput de linie (KEY=valoare)
    const line = pattern.id === 'env_secret_hex' ? sample : `const value = "${sample}";`;
    const findings = scanText('src/config.ts', `${line}\n`);
    assert.ok(findings.some((finding) => finding.pattern === pattern.id), `${pattern.id} not detected`);
  }
});

test('findings carry path, line and only a masked fragment', () => {
  const secret = SAMPLES.stripe_live;
  const [finding] = scanText('apps/x.ts', `ok\nkey=${secret}\n`);
  assert.deepEqual(finding, { path: 'apps/x.ts', line: 2, pattern: 'stripe_live', masked: maskFragment(secret) });
  assert.equal(finding.masked, `${secret.slice(0, 4)}…`);
  assert.ok(!finding.masked.includes(secret.slice(4)));
});

test('.env.example placeholders do not trigger the env secret pattern', () => {
  const text = 'JWT_ACCESS_SECRET=change-me\nS3_SECRET_KEY=minioadmin\nIP_HASH_SALT=' + 'f'.repeat(64) + '\n';
  assert.deepEqual(scanText('apps/backend/.env.example', text), []);
  assert.equal(scanText('apps/backend/config.env.txt', text).length, 1);
});

test('local database URLs do not trigger', () => {
  const text = [
    'postgresql://marketplace:marketplace@localhost:5432/marketplace',
    'postgresql://marketplace:marketplace@127.0.0.1:5432/marketplace',
    'postgresql://marketplace:marketplace@postgres:5432/marketplace',
    'postgresql://marketplace:marketplace@host.docker.internal:5432/marketplace',
    'postgresql://preview:secret@green-postgres.railway.internal/green_preview',
  ].join('\n');
  assert.deepEqual(scanText('docs/x.md', text), []);
});

test('allowlist is matched on both path and pattern', () => {
  const text = `url=${SAMPLES.db_url_remote}\nkey=${SAMPLES.stripe_live}\n`;
  const allowlist = [{ path: 'apps/seed.spec.ts', pattern: 'db_url_remote', reason: 'fictiv' }];
  const findings = scanText('apps/seed.spec.ts', text, { allowlist });
  assert.deepEqual(findings.map((finding) => finding.pattern), ['stripe_live']);
  assert.equal(scanText('apps/other.spec.ts', text, { allowlist }).length, 2);
});

test('forbidden files are reported by name', () => {
  assert.equal(forbiddenReason('.env'), 'fisier .env');
  assert.equal(forbiddenReason('apps/backend/.env'), 'fisier .env');
  assert.equal(forbiddenReason('apps/backend/.env.production'), 'fisier .env');
  assert.equal(forbiddenReason('apps/backend/.env.example'), null);
  assert.ok(forbiddenReason('backup/cozy.dump'));
  assert.ok(forbiddenReason('backup/cozy.dump.age'));
  assert.ok(forbiddenReason('certs/server.pem'));
  assert.ok(forbiddenReason('certs/server.key'));
  assert.ok(forbiddenReason('tools/bfg.jar'));
  assert.ok(forbiddenReason('test-results/run/trace.txt'));
  assert.equal(forbiddenReason('apps/backend/src/main.ts'), null);
});

test('scanFiles skips binaries, flags large files and scans text', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'scan-secrets-'));
  try {
    mkdirSync(path.join(root, 'src'));
    writeFileSync(path.join(root, 'src', 'leak.ts'), `export const k = '${SAMPLES.aws_key}';\n`);
    writeFileSync(path.join(root, 'src', 'clean.ts'), 'export const ok = 1;\n');
    writeFileSync(path.join(root, 'src', 'image.png'), SAMPLES.aws_key);
    writeFileSync(path.join(root, 'src', 'blob.bin'), Buffer.concat([Buffer.from([0, 1, 2]), Buffer.from(SAMPLES.aws_key)]));
    writeFileSync(path.join(root, 'src', 'big.txt'), 'x'.repeat(2 * 1024 * 1024 + 1));
    const result = scanFiles({
      root,
      files: ['src/leak.ts', 'src/clean.ts', 'src/image.png', 'src/blob.bin', 'src/big.txt', 'src/missing.ts'],
    });
    assert.equal(result.scanned, 2);
    assert.equal(result.skippedBinary, 2);
    assert.deepEqual(result.large.map((item) => item.path), ['src/big.txt']);
    assert.deepEqual(result.findings.map((finding) => `${finding.path}:${finding.line}:${finding.pattern}`), ['src/leak.ts:1:aws_key']);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

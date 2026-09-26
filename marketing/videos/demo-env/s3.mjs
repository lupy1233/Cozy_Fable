// S3 mock (inlocuieste MinIO din dev-infra): s3rver pe :9000, path-style,
// cheie minioadmin/minioadmin, bucket "uploads" creat la pornire cu CORS pentru :3000.
import { createRequire } from 'node:module';
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const S3rver = require('s3rver');
const { DUMMY_ACCOUNT } = require('s3rver/lib/models/account');

const here = dirname(fileURLToPath(import.meta.url));
const dir = join(here, 'data', 's3');
mkdirSync(dir, { recursive: true });

// backend-ul semneaza cu S3_ACCESS_KEY/S3_SECRET_KEY din .env (minioadmin/minioadmin)
DUMMY_ACCOUNT.createKeyPair('minioadmin', 'minioadmin');

const server = new S3rver({
  port: Number(process.env.S3_PORT ?? 9000),
  address: '0.0.0.0',
  directory: dir,
  silent: false,
  vhostBuckets: false,
  configureBuckets: [{ name: 'uploads', configs: [readFileSync(join(here, 'cors.xml'))] }],
});
const { address, port } = await server.run();
console.log(`[s3] s3rver pe http://${address}:${port} (bucket uploads, date in ${dir})`);

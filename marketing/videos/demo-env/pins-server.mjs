// Server static pentru imaginile de inspiratie inlocuitoare (CDN-urile reale sunt
// blocate in container). Serveste demo-env/pins/ pe :8099.
import http from 'node:http';
import { createReadStream, statSync } from 'node:fs';
import { dirname, join, normalize, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), 'pins');
const TYPES = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml' };
http.createServer((req, res) => {
  const p = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^([/\\])+/, '');
  const file = join(root, p);
  if (!file.startsWith(root)) { res.writeHead(403); return res.end(); }
  try {
    const st = statSync(file);
    if (!st.isFile()) throw new Error('dir');
    res.writeHead(200, {
      'content-type': TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream',
      'content-length': st.size,
      'cache-control': 'public, max-age=3600',
      'access-control-allow-origin': '*',
    });
    createReadStream(file).pipe(res);
  } catch {
    res.writeHead(404); res.end('not found');
  }
}).listen(Number(process.env.PINS_PORT ?? 8099), '0.0.0.0', () => console.log(`[pins] http://localhost:${process.env.PINS_PORT ?? 8099}/ -> ${root}`));

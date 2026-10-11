import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomBytes } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { get } from 'node:http';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const exec = promisify(execFile), root = fileURLToPath(new URL('../', import.meta.url));
const project = 'cozy-container-smoke';
const compose = ['compose', '-p', project, '-f', 'docs/implementation/container-smoke.compose.yml'];
const secrets = Object.fromEntries(['SMOKE_DB_PASSWORD', 'SMOKE_S3_PASSWORD', 'SMOKE_JWT_ACCESS', 'SMOKE_JWT_REFRESH', 'SMOKE_IP_SALT', 'SMOKE_CHAT_KEY', 'SMOKE_HEALTH_TOKEN'].map((name) => [name, randomBytes(32).toString('hex')]));
const env = { ...process.env, ...secrets };
const docker = async (args, timeout = 120_000) => (await exec('docker', args, { cwd: root, env, timeout, maxBuffer: 8 * 1024 * 1024 })).stdout.trim();
const report = { measuredAt: new Date().toISOString(), project, image: 'cozy-app:implementation', checks: {}, failures: [] };
const redact = (value) => Object.values(secrets).reduce((text, secret) => text.replaceAll(secret, '[REDACTED]'), String(value));
const wireBytes = (url) => new Promise((resolve, reject) => {
  const request = get(url, { headers: { 'accept-encoding': 'gzip' }, timeout: 15_000 }, (response) => {
    let bytes = 0; response.on('data', (chunk) => { bytes += chunk.length; });
    response.on('end', () => resolve({ status: response.statusCode, bodyBytes: bytes, encoding: response.headers['content-encoding'] ?? 'identity' }));
  }); request.on('error', reject); request.on('timeout', () => request.destroy(new Error('Payload measurement timed out')));
});
if (await docker(['ps', '-aq', '--filter', `label=com.docker.compose.project=${project}`]) || await docker(['network', 'ls', '-q', '--filter', `name=^${project}_default$`])) throw new Error('Smoke project already exists; refusing to alter it');
try {
  console.log('Starting isolated container smoke infrastructure');
  await docker([...compose, 'up', '-d'], 180_000);
  for (let attempt = 0; attempt < 50; attempt++) {
    try {
      const response = await fetch('http://127.0.0.1:3210/api/v1/health', { signal: AbortSignal.timeout(3000) });
      if (response.ok) { report.checks.health = await response.json(); break; }
    } catch { /* Serviciile pornesc dupa migratii. */ }
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  if (!report.checks.health) throw new Error('Backend health did not become ready');
  // E-admin-platform-56: corpul public e doar {status}; detaliile doar cu X-Health-Token.
  if (JSON.stringify(Object.keys(report.checks.health)) !== '["status"]') throw new Error(`Public health exposes details: ${Object.keys(report.checks.health).join(',')}`);
  const tokenHealth = await (await fetch('http://127.0.0.1:3210/api/v1/health', { headers: { 'X-Health-Token': secrets.SMOKE_HEALTH_TOKEN }, signal: AbortSignal.timeout(5000) })).json();
  if (!tokenHealth?.release?.slot) throw new Error('Health with token did not return release details');
  report.checks.tokenHealth = { releaseSlot: tokenHealth.release.slot, releaseMode: tokenHealth.release.mode, checks: tokenHealth.checks };
  const appId = await docker([...compose, 'ps', '-q', 'app']);
  // E-admin-platform-56: Nest asculta doar pe loopback; conectarea pe IP-ul eth0 trebuie refuzata.
  report.checks.backendLoopbackOnly = await docker(['exec', appId, 'node', '-e', "const ip=require('os').networkInterfaces().eth0.find(a=>a.family==='IPv4').address;require('net').connect(3001,ip).on('connect',()=>process.exit(1)).on('error',()=>console.log('loopback-only'))"]);
  if (report.checks.backendLoopbackOnly !== 'loopback-only') throw new Error('Backend reachable on the container network interface');
  // E-admin-platform-56: fara dependinte de dezvoltare in imaginea de runtime (stagiul proddeps).
  report.checks.devDependenciesInRuntime = Number(await docker(['exec', appId, 'sh', '-c', "ls /app/node_modules/.pnpm | grep -cE '^(vitest|vite|jest|@nestjs[+]cli|typescript-eslint|@typescript-eslint)@' || true"]));
  if (report.checks.devDependenciesInRuntime !== 0) throw new Error('Development dependencies present in the runtime image');
  report.checks.runtime = await docker(['exec', appId, 'node', '-e', 'console.log(JSON.stringify({node:process.version,platform:process.platform,arch:process.arch,uid:process.getuid()}))']);
  report.checks.artifacts = await docker(['exec', appId, 'sh', '-c', 'test -f /app/web/apps/frontend/server.js && test -d /app/web/apps/frontend/.next/static && test -f /app/apps/backend/dist/main.js && echo present']);
  report.checks.slimRuntime = await docker(['exec', appId, 'sh', '-c', 'test ! -d /app/apps/backend/src && test ! -d /app/packages/shared/src && test ! -d /app/apps/frontend && test -f /app/apps/backend/prisma/schema.prisma && test -f /app/apps/backend/prisma/migrations/migration_lock.toml && echo passed']);
  report.checks.backendDependencies = JSON.parse(await docker(['exec', '-w', '/app/apps/backend', appId, 'node', '-e', 'const fs=require("node:fs");const shared=require("@marketplace/shared"),client=require("@prisma/client");const kinds=shared.PIECE3D_KINDS;if(!Array.isArray(kinds)||kinds.length!==10||!client.Prisma.dmmf.datamodel.models.some(m=>m.name==="DomainEventOutbox"))throw new Error("Incomplete runtime dependency graph");console.log(JSON.stringify({shared:fs.realpathSync(require.resolve("@marketplace/shared")),prismaClient:fs.realpathSync(require.resolve("@prisma/client")),prismaCli:fs.realpathSync(require.resolve("prisma/package.json")),kinds:kinds.length,generatedPrisma:true}));']));
  report.checks.prismaCli = await docker(['exec', '-w', '/app/apps/backend', appId, './node_modules/.bin/prisma', '--version']);
  report.checks.studioLoginReturnArtifact = await docker(['exec', appId, 'node', '-e', 'const fs=require("node:fs"),p=require("node:path");function contains(dir){return fs.readdirSync(dir,{withFileTypes:true}).some(e=>e.isDirectory()?contains(p.join(dir,e.name)):e.name.endsWith(".js")&&fs.readFileSync(p.join(dir,e.name),"utf8").includes("/login?redirect=/studio"));}if(!contains("/app/web/apps/frontend/.next/static/chunks"))process.exit(1);console.log("present");']);
  report.checks.noEnvironmentFiles = await docker(['exec', appId, 'sh', '-c', 'test ! -f /app/apps/backend/.env && test ! -f /app/apps/frontend/.env.local && echo passed']);
  report.checks.chromium = await docker(['exec', appId, 'chromium', '--version']);
  report.checks.pdfBytes = Number(await docker(['exec', '-w', '/app/apps/backend', appId, 'node', '--input-type=module', '-e', 'const {default:puppeteer}=await import("puppeteer");const browser=await puppeteer.launch({headless:true,args:["--no-sandbox","--disable-setuid-sandbox"]});try{const page=await browser.newPage();await page.setContent("<!doctype html><meta charset=utf-8><h1>Container PDF smoke — ăâîșț</h1>");const pdf=Buffer.from(await page.pdf({format:"A4",printBackground:true}));if(pdf.length<1000||pdf.subarray(0,4).toString()!=="%PDF")throw new Error("Invalid PDF");console.log(pdf.length);}finally{await browser.close();}'], 60_000));
  report.checks.pages = [];
  for (const route of ['/en', '/ro', '/en/studio', '/en/requests/new']) {
    const started = Date.now();
    const response = await fetch(`http://127.0.0.1:3210${route}`, { signal: AbortSignal.timeout(15_000) });
    const html = await response.text();
    const ms = Date.now() - started;
    if (!response.ok || !html.includes('<html')) throw new Error(`Page failed: ${route} ${response.status}`);
    // E-admin-platform-56: CSP cu nonce per cerere pe fiecare <script>, COOP, noindex pe host necanonic.
    const csp = response.headers.get('content-security-policy') ?? '';
    const nonce = /'nonce-([^']+)'/.exec(csp)?.[1];
    const scriptSrc = csp.split(';').map((d) => d.trim()).find((d) => d.startsWith('script-src')) ?? '';
    const scripts = [...html.matchAll(/<script\b[^>]*>/g)].map((m) => m[0]);
    const scriptsWithoutNonce = scripts.filter((tag) => !tag.includes(`nonce="${nonce}"`)).length;
    const security = {
      cspNonce: Boolean(nonce),
      strictDynamic: scriptSrc.includes("'strict-dynamic'"),
      unsafeInlineScript: scriptSrc.includes("'unsafe-inline'"),
      scripts: scripts.length,
      scriptsWithoutNonce,
      coop: response.headers.get('cross-origin-opener-policy'),
      robots: response.headers.get('x-robots-tag'),
      reportingEndpoints: response.headers.get('reporting-endpoints'),
    };
    if (!security.cspNonce || !security.strictDynamic || security.unsafeInlineScript || scriptsWithoutNonce) throw new Error(`CSP nonce check failed on ${route}: ${JSON.stringify(security)}`);
    if (security.coop !== 'same-origin') throw new Error(`COOP missing on ${route}`);
    if (!/noindex/.test(security.robots ?? '')) throw new Error(`X-Robots-Tag missing on non-canonical host for ${route}`);
    report.checks.pages.push({ route, status: response.status, ms, security, decodedBytes: Buffer.byteLength(html), wire: await wireBytes(`http://127.0.0.1:3210${route}`) });
    if (route === '/en/studio') {
      const assets = [...new Set([...html.matchAll(/(?:src|href)="([^"\s]*\/_next\/static\/[^"\s]+)"/g)].map((m) => m[1]))];
      if (!assets.length) throw new Error('No standalone static assets found');
      let bytes = 0; const measured = [];
      for (const asset of assets) { const url = new URL(asset, 'http://127.0.0.1:3210'); const res = await fetch(url); if (!res.ok) throw new Error(`Static asset status ${res.status}`); const decodedBytes = (await res.arrayBuffer()).byteLength; bytes += decodedBytes; measured.push({ path: asset, decodedBytes, wire: await wireBytes(url) }); }
      report.checks.staticAssets = { count: assets.length, decodedBytes: bytes, status: 'all 200', assets: measured };
    }
  }
  for (const atlas of ['showroom-furniture', 'showroom-configurations', 'showroom-appliances']) {
    const response = await fetch(`http://127.0.0.1:3210/illustrations/${atlas}.png`);
    if (!response.ok) throw new Error(`Missing public atlas: ${atlas}`);
  }
  report.checks.publicShowroomAtlases = 'all 200';
  report.checks.localeCatalogs = Object.fromEntries(await Promise.all(['en', 'ro'].map(async (locale) => {
    const data = await readFile(path.join(root, `apps/frontend/src/messages/${locale}.json`), 'utf8');
    return [locale, { fileBytes: Buffer.byteLength(data), compactSerializedBytes: Buffer.byteLength(JSON.stringify(JSON.parse(data))) }];
  })));
  report.checks.migrationCount = await docker([...compose, 'exec', '-T', 'postgres', 'psql', '-U', 'smoke', '-d', 'smoke', '-Atc', 'SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NOT NULL']);
  const draft = await fetch('http://127.0.0.1:3210/api/v1/requests/drafts', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}', signal: AbortSignal.timeout(15_000) });
  const draftBody = await draft.json();
  report.checks.guestDraftWrite = { status: draft.status, returnedDraftId: Boolean(draftBody?.data?.id ?? draftBody?.id) };
  if (!draft.ok) throw new Error(`Isolated guest draft write failed: ${draft.status}`);
  report.checks.persistedRequestCount = Number(await docker([...compose, 'exec', '-T', 'postgres', 'psql', '-U', 'smoke', '-d', 'smoke', '-Atc', 'SELECT count(*) FROM requests']));
  if (report.checks.persistedRequestCount < 1) throw new Error('Guest draft was not persisted');
  const require = createRequire(path.join(root, 'apps/frontend/package.json'));
  const { chromium } = require('@playwright/test');
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await context.newPage(); page.setDefaultTimeout(60_000);
    const pageErrors = [], cspErrors = [], consoleErrors = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    page.on('console', (message) => {
      if (message.type() !== 'error') return;
      const text = message.text();
      if (/Content Security Policy|violates.*policy/i.test(text)) cspErrors.push(text);
      if (!text.includes('401 (Unauthorized)')) consoleErrors.push(text);
    });
    await page.route('**/api/v1/**', (route) => route.fulfill({ status: 401, contentType: 'application/json', body: '{"error":{"code":"UNAUTHORIZED","message":"Guest"}}' }));
    const fixture = JSON.parse(await readFile(path.join(root, 'docs/implementation/house-demo-fixture.json'), 'utf8'));
    await page.addInitScript((data) => localStorage.setItem('mm_studio_v3', JSON.stringify({ version: 3, state: { ...data, tutorialSeen: true, accountDraft: null, panelPos: null } })), fixture);
    await page.goto('http://127.0.0.1:3210/en/studio', { waitUntil: 'domcontentloaded' });
    await page.getByRole('heading', { name: 'Your house layout', exact: true }).waitFor();
    await page.locator('canvas').first().waitFor();
    await page.getByRole('button', { name: 'Whole-house 3D cutaway', exact: true }).click();
    await page.waitForFunction(() => document.querySelectorAll('canvas').length === 2);
    await page.locator('canvas').first().scrollIntoViewIfNeeded();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(root, 'docs/implementation/screenshots/production-house-smoke.png'), fullPage: true });
    report.checks.browser = { houseHeadingVisible: true, canvasCount: await page.locator('canvas').count(), pageErrors, cspErrors, consoleErrors };
    if (pageErrors.length || cspErrors.length || consoleErrors.length) throw new Error('Production browser runtime reported errors');
  } finally { await browser.close(); }
  report.checks.image = await docker(['image', 'inspect', 'cozy-app:implementation', '--format', '{{.Id}} {{.Os}}/{{.Architecture}} {{.Size}} bytes']);
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  report.failures.push(redact(error.message));
  try { report.logs = redact(await docker([...compose, 'logs', '--no-color', '--tail', '80', 'app'])); } catch { /* Pastram eroarea initiala. */ }
  process.exitCode = 1;
  console.error(redact(error.message));
} finally {
  await docker([...compose, 'down', '--volumes', '--remove-orphans']);
  report.cleanedUp = !(await docker(['ps', '-aq', '--filter', `label=com.docker.compose.project=${project}`]));
  await writeFile(path.join(root, 'docs/implementation/container-smoke-results.json'), JSON.stringify(report, null, 2));
  console.log(`Isolated smoke containers removed: ${report.cleanedUp}`);
}

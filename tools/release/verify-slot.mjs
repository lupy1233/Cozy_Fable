import { pathToFileURL } from 'node:url';

export function parseArguments(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith('--') || value === undefined) {
      throw new Error(`Invalid argument near ${key ?? '<end>'}`);
    }
    values[key.slice(2)] = value;
  }
  return values;
}

// E-admin-platform-5 (SEC2-3): limitele trebuie sa fie per client. Trei cereri secventiale pe
// /api/v1/health trebuie sa scada strict `x-ratelimit-remaining`; o a patra cu X-Real-IP /
// X-Forwarded-For falsificate trebuie sa ramana in ACELASI bucket (altfel headerul e
// spoofabil); `health.client.scope` trebuie sa fie 'public' (nu adresa proxy-ului).
const SPOOF_IP = '203.0.113.77';

function headerNumber(response, name) {
  const raw = response.headers?.get?.(name);
  if (raw === null || raw === undefined || raw === '') return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

async function sampleRateLimit(fetchImpl, healthUrl, headers) {
  const response = await fetchImpl(healthUrl, { redirect: 'error', ...(headers ? { headers } : {}) });
  if (response.status === 429) throw new Error('Rate limit probe was throttled (HTTP 429); wait a minute and retry');
  return {
    remaining: headerNumber(response, 'x-ratelimit-remaining'),
    reset: headerNumber(response, 'x-ratelimit-reset'),
  };
}

export async function probeRateLimit({ healthUrl, fetchImpl = fetch }) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const samples = [];
    for (let i = 0; i < 3; i += 1) samples.push(await sampleRateLimit(fetchImpl, healthUrl));
    const remaining = samples.map((sample) => sample.remaining);
    if (remaining.some((value) => value === null)) {
      throw new Error('Rate limit headers missing on /api/v1/health (x-ratelimit-remaining)');
    }
    // fereastra s-a resetat intre cereri → o singura reluare a sondei
    const windowRolled = samples.some((sample) => sample.reset !== null && sample.reset <= 2);
    const decreasing = remaining[1] < remaining[0] && remaining[2] < remaining[1];
    if (!decreasing) {
      if (attempt === 0 && windowRolled) continue;
      throw new Error(
        `Rate limit is not per client (remaining ${remaining.join(',')}): throttler keyed on a shared proxy address`,
      );
    }
    const spoof = await sampleRateLimit(fetchImpl, healthUrl, { 'X-Real-IP': SPOOF_IP, 'X-Forwarded-For': SPOOF_IP });
    if (spoof.remaining === null || spoof.remaining >= remaining[2]) {
      if (attempt === 0 && windowRolled) continue;
      throw new Error('Forwarded client IP header is spoofable (spoofed request got a fresh bucket)');
    }
    return { remaining: [...remaining, spoof.remaining], spoofProbe: 'same-bucket' };
  }
  throw new Error('Rate limit probe did not stabilise');
}

// E-admin-platform-56: corpul public al health-ului e doar {status}; detaliile (release, checks,
// client) cer headerul X-Health-Token = HEALTH_DETAILS_TOKEN al slotului. Tokenul vine DOAR din
// env (niciodata argv, ca sa nu ajunga in istoricul shell-ului) si nu apare niciodata in rezultat.
// Release-urile vechi (rollback) dau corpul complet si fara token, deci sunt acceptate.
export const HIDDEN_DETAILS_HINT =
  'Health details hidden: run with HEALTH_DETAILS_TOKEN (e.g. railway run --service <slot> node tools/release/verify-slot.mjs ...)';

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

function isStatusOnly(body) {
  return body !== null && typeof body === 'object' && Object.keys(body).length === 1 && body.status === 'ok';
}

export async function verifySlot({
  baseUrl,
  expectedSlot,
  expectedMode,
  expectedSha,
  rateLimitCheck = 'on',
  healthToken,
  fetchImpl = fetch,
}) {
  const origin = new URL(baseUrl);
  // tokenul e secret: pleaca doar pe https sau pe loopback (niciodata in clar prin retea)
  if (healthToken && origin.protocol !== 'https:' && !LOOPBACK_HOSTS.has(origin.hostname)) {
    throw new Error('HEALTH_DETAILS_TOKEN is only sent over https (or to a loopback host)');
  }
  const healthUrl = new URL('/api/v1/health', origin);
  const tokenHeaders = healthToken ? { 'X-Health-Token': healthToken } : undefined;
  const healthResponse = await fetchImpl(healthUrl, {
    redirect: 'error',
    ...(tokenHeaders ? { headers: tokenHeaders } : {}),
  });
  if (!healthResponse.ok) throw new Error(`Health returned HTTP ${healthResponse.status}`);
  const health = await healthResponse.json();

  if (health?.status !== 'ok') throw new Error('Health payload is not ok');
  if (!health?.release && isStatusOnly(health)) {
    throw new Error(
      healthToken
        ? 'Health details hidden although HEALTH_DETAILS_TOKEN was sent: the token does not match the slot (or the slot has no HEALTH_DETAILS_TOKEN)'
        : HIDDEN_DETAILS_HINT,
    );
  }
  if (health?.release?.slot !== expectedSlot) {
    throw new Error(`Expected slot ${expectedSlot}, received ${health?.release?.slot ?? 'missing'}`);
  }
  if (health?.release?.mode !== expectedMode) {
    throw new Error(`Expected mode ${expectedMode}, received ${health?.release?.mode ?? 'missing'}`);
  }
  if (expectedSha && health?.release?.sha !== expectedSha) {
    throw new Error(`Expected SHA ${expectedSha}, received ${health?.release?.sha ?? 'missing'}`);
  }

  let rateLimit = null;
  if (rateLimitCheck !== 'off') {
    const probe = await probeRateLimit({ healthUrl, fetchImpl });
    // release-urile de dinainte de E-admin-platform-5 nu au `client` → raportat null
    const clientScope = health?.client?.scope ?? null;
    if (clientScope !== null && clientScope !== 'public') {
      throw new Error(
        `Rate-limit key is a ${clientScope} address, not the client IP (set TRUSTED_CLIENT_IP_HEADER after the spoof test, see docs/08)`,
      );
    }
    rateLimit = { ...probe, clientScope };
  }

  // E-admin-platform-8: sonda /health/live nu blocheaza promovarea (release-urile vechi nu o au);
  // live=200 pe AMBELE sloturi e conditia pentru HEALTH_URI=/api/v1/health/live pe gateway.
  let live = null;
  try {
    const liveResponse = await fetchImpl(new URL('/api/v1/health/live', origin), {
      redirect: 'manual',
      ...(tokenHeaders ? { headers: tokenHeaders } : {}),
    });
    live = liveResponse.status;
  } catch {
    live = null;
  }

  const pages = {};
  for (const locale of ['ro', 'en']) {
    const response = await fetchImpl(new URL(`/${locale}`, origin), { redirect: 'manual' });
    if (response.status < 200 || response.status >= 400) {
      throw new Error(`/${locale} returned HTTP ${response.status}`);
    }
    pages[locale] = response.status;
  }

  return { url: origin.origin, release: health.release, checks: health.checks, live, pages, rateLimit };
}

async function main() {
  const args = parseArguments(process.argv.slice(2));
  if (!args.url || !args.slot || !args.mode) {
    throw new Error(
      'Usage: [HEALTH_DETAILS_TOKEN=...] node tools/release/verify-slot.mjs --url <url> --slot <blue|green> --mode <active|standby> [--sha <git-sha>] [--rate-limit-check on|off]',
    );
  }
  if (args['health-token'] !== undefined || args.token !== undefined) {
    throw new Error('Pass the health token only via the HEALTH_DETAILS_TOKEN environment variable, never as an argument');
  }
  const healthToken = process.env.HEALTH_DETAILS_TOKEN?.trim() || undefined;
  const rateLimitCheck = args['rate-limit-check'] ?? 'on';
  if (!['on', 'off'].includes(rateLimitCheck)) throw new Error('--rate-limit-check must be on or off');
  const result = await verifySlot({
    baseUrl: args.url,
    expectedSlot: args.slot,
    expectedMode: args.mode,
    expectedSha: args.sha,
    rateLimitCheck,
    healthToken,
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}

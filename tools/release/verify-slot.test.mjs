import assert from 'node:assert/strict';
import test from 'node:test';
import { HIDDEN_DETAILS_HINT, parseArguments, verifySlot } from './verify-slot.mjs';

function response(status, body = {}, headers = {}) {
  return { ok: status >= 200 && status < 300, status, json: async () => body, headers: new Headers(headers) };
}

// Fals pentru throttler: fiecare cerere la /api/v1/health scade `remaining` in bucket-ul ei.
// `bucketOf(headers)` decide bucket-ul (implicit unul singur = per client, corect).
function rateLimiter({ bucketOf = () => 'client', step = 1, reset = 60 } = {}) {
  const buckets = new Map();
  return (headers = {}) => {
    const bucket = bucketOf(headers);
    const remaining = (buckets.get(bucket) ?? 100) - step;
    buckets.set(bucket, remaining);
    return { 'x-ratelimit-remaining': String(remaining), 'x-ratelimit-reset': String(reset) };
  };
}

function healthBody(slot, mode, client) {
  return {
    status: 'ok',
    checks: { db: 'up', redis: 'up', storage: 'up' },
    release: { slot, mode, sha: 'abcdef0' },
    ...(client == null ? {} : { client }),
  };
}

// `token` setat = release nou (E-admin-platform-56): corpul complet doar cu headerul corect,
// altfel {status}. Nesetat = release vechi care da corpul complet oricui.
function slotFetch({ slot = 'blue', mode = 'active', liveStatus = 200, client = { source: 'header', scope: 'public' }, limiter = rateLimiter(), calls, token, sentTokens } = {}) {
  return async (url, init = {}) => {
    calls?.push(url.pathname);
    const sent = init.headers?.['X-Health-Token'];
    sentTokens?.push([url.pathname, sent ?? null]);
    const detailed = token === undefined || sent === token;
    if (url.pathname === '/api/v1/health') {
      return response(200, detailed ? healthBody(slot, mode, client) : { status: 'ok' }, limiter(init.headers));
    }
    if (url.pathname === '/api/v1/health/live') return response(liveStatus);
    return response(200);
  };
}

test('parses explicit flag/value arguments', () => {
  assert.deepEqual(parseArguments(['--url', 'https://example.test', '--slot', 'green', '--rate-limit-check', 'off']), {
    url: 'https://example.test',
    slot: 'green',
    'rate-limit-check': 'off',
  });
});

test('verifies health identity, rate limit and both locale entry pages', async () => {
  const calls = [];
  const result = await verifySlot({
    baseUrl: 'https://green.example.test',
    expectedSlot: 'green',
    expectedMode: 'standby',
    expectedSha: 'abcdef0',
    fetchImpl: slotFetch({ slot: 'green', mode: 'standby', calls }),
  });

  assert.deepEqual(calls, [
    '/api/v1/health',
    '/api/v1/health',
    '/api/v1/health',
    '/api/v1/health',
    '/api/v1/health',
    '/api/v1/health/live',
    '/ro',
    '/en',
  ]);
  assert.equal(result.release.slot, 'green');
  assert.equal(result.live, 200);
  assert.deepEqual(result.rateLimit, { remaining: [98, 97, 96, 95], spoofProbe: 'same-bucket', clientScope: 'public' });
});

test('reports live=404 without failing on an older release without /health/live', async () => {
  const result = await verifySlot({
    baseUrl: 'https://blue.example.test',
    expectedSlot: 'blue',
    expectedMode: 'active',
    fetchImpl: slotFetch({ liveStatus: 404 }),
  });
  assert.equal(result.live, 404);
  assert.deepEqual(result.pages, { ro: 200, en: 200 });
});

test('reports live=200 when the slot exposes /health/live', async () => {
  const result = await verifySlot({
    baseUrl: 'https://blue.example.test',
    expectedSlot: 'blue',
    expectedMode: 'active',
    fetchImpl: slotFetch({ liveStatus: 200 }),
  });
  assert.equal(result.live, 200);
});

test('refuses a slot identity mismatch', async () => {
  const fetchImpl = async () => response(200, {
    status: 'ok',
    release: { slot: 'blue', mode: 'active', sha: 'abcdef0' },
  });

  await assert.rejects(
    verifySlot({
      baseUrl: 'https://green.example.test',
      expectedSlot: 'green',
      expectedMode: 'standby',
      fetchImpl,
    }),
    /Expected slot green/,
  );
});

// E-admin-platform-5: sonda de rate limit

test('fails when remaining does not decrease (shared proxy bucket or no counting)', async () => {
  await assert.rejects(
    verifySlot({
      baseUrl: 'https://blue.example.test',
      expectedSlot: 'blue',
      expectedMode: 'active',
      fetchImpl: slotFetch({ limiter: rateLimiter({ step: 0 }) }),
    }),
    /Rate limit is not per client \(remaining 100,100,100\)/,
  );
});

test('fails when the rate limit headers are missing', async () => {
  const fetchImpl = async (url) =>
    url.pathname === '/api/v1/health' ? response(200, healthBody('blue', 'active', { source: 'header', scope: 'public' })) : response(200);
  await assert.rejects(
    verifySlot({ baseUrl: 'https://blue.example.test', expectedSlot: 'blue', expectedMode: 'active', fetchImpl }),
    /Rate limit headers missing/,
  );
});

test('fails when a spoofed forwarded header gets a fresh bucket', async () => {
  const limiter = rateLimiter({ bucketOf: (headers) => headers['X-Real-IP'] ?? 'client' });
  await assert.rejects(
    verifySlot({
      baseUrl: 'https://blue.example.test',
      expectedSlot: 'blue',
      expectedMode: 'active',
      fetchImpl: slotFetch({ limiter }),
    }),
    /Forwarded client IP header is spoofable/,
  );
});

test('retries the probe once when the window resets mid-probe', async () => {
  let count = 0;
  const limiter = () => {
    count += 1;
    // prima runda: fereastra se reseteaza intre cererea 2 si 3
    const sequence = [99, 98, 99];
    const remaining = count <= 3 ? sequence[count - 1] : 100 - (count - 3);
    return { 'x-ratelimit-remaining': String(remaining), 'x-ratelimit-reset': count <= 3 ? '1' : '60' };
  };
  const result = await verifySlot({
    baseUrl: 'https://blue.example.test',
    expectedSlot: 'blue',
    expectedMode: 'active',
    fetchImpl: slotFetch({ limiter }),
  });
  assert.deepEqual(result.rateLimit.remaining, [98, 97, 96, 95]);
});

test('fails when the rate-limit key is a private (proxy) address', async () => {
  await assert.rejects(
    verifySlot({
      baseUrl: 'https://blue.example.test',
      expectedSlot: 'blue',
      expectedMode: 'active',
      fetchImpl: slotFetch({ client: { source: 'socket', scope: 'private' } }),
    }),
    /Rate-limit key is a private address, not the client IP/,
  );
});

test('passes with clientScope=null on an older release without the client field', async () => {
  const result = await verifySlot({
    baseUrl: 'https://blue.example.test',
    expectedSlot: 'blue',
    expectedMode: 'active',
    fetchImpl: slotFetch({ client: null }),
  });
  assert.equal(result.rateLimit.clientScope, null);
});

test('--rate-limit-check off skips the probe', async () => {
  const calls = [];
  const result = await verifySlot({
    baseUrl: 'https://blue.example.test',
    expectedSlot: 'blue',
    expectedMode: 'active',
    rateLimitCheck: 'off',
    fetchImpl: slotFetch({ limiter: rateLimiter({ step: 0 }), client: { source: 'socket', scope: 'private' }, calls }),
  });
  assert.equal(result.rateLimit, null);
  assert.deepEqual(calls, ['/api/v1/health', '/api/v1/health/live', '/ro', '/en']);
});

// E-admin-platform-56: health public = doar {status}; detaliile cer X-Health-Token

test('sends the token only on the first health request and the live probe', async () => {
  const sentTokens = [];
  const token = 'k'.repeat(48);
  const result = await verifySlot({
    baseUrl: 'https://green.example.test',
    expectedSlot: 'green',
    expectedMode: 'standby',
    expectedSha: 'abcdef0',
    healthToken: token,
    fetchImpl: slotFetch({ slot: 'green', mode: 'standby', token, sentTokens }),
  });
  assert.equal(result.release.sha, 'abcdef0');
  assert.deepEqual(sentTokens, [
    ['/api/v1/health', token],
    ['/api/v1/health', null],
    ['/api/v1/health', null],
    ['/api/v1/health', null],
    ['/api/v1/health', null],
    ['/api/v1/health/live', token],
    ['/ro', null],
    ['/en', null],
  ]);
  assert.ok(!JSON.stringify(result).includes(token), 'the token never appears in the result');
});

test('fails with a clear hint when a new release hides details and no token is given', async () => {
  await assert.rejects(
    verifySlot({
      baseUrl: 'https://green.example.test',
      expectedSlot: 'green',
      expectedMode: 'standby',
      fetchImpl: slotFetch({ slot: 'green', mode: 'standby', token: 'k'.repeat(48) }),
    }),
    (error) => error.message === HIDDEN_DETAILS_HINT,
  );
});

test('fails when the token does not match the slot', async () => {
  await assert.rejects(
    verifySlot({
      baseUrl: 'https://green.example.test',
      expectedSlot: 'green',
      expectedMode: 'standby',
      healthToken: 'w'.repeat(48),
      fetchImpl: slotFetch({ slot: 'green', mode: 'standby', token: 'k'.repeat(48) }),
    }),
    /token does not match the slot/,
  );
});

test('accepts an older release that returns the full body without a token', async () => {
  const result = await verifySlot({
    baseUrl: 'https://blue.example.test',
    expectedSlot: 'blue',
    expectedMode: 'active',
    fetchImpl: slotFetch(),
  });
  assert.equal(result.release.slot, 'blue');
});

test('refuses to send the token over plain http to a non-loopback host', async () => {
  const sentTokens = [];
  await assert.rejects(
    verifySlot({
      baseUrl: 'http://green.example.test',
      expectedSlot: 'green',
      expectedMode: 'standby',
      healthToken: 'k'.repeat(48),
      fetchImpl: slotFetch({ slot: 'green', mode: 'standby', token: 'k'.repeat(48), sentTokens }),
    }),
    /only sent over https/,
  );
  assert.deepEqual(sentTokens, [], 'no request leaves before the check');
});

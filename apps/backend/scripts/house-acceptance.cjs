/* Isolated local acceptance only. Keeps named records for browser inspection. */
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { randomUUID } = require('node:crypto');
const { PrismaClient } = require('@prisma/client');
const { getFlow } = require('@marketplace/shared');

const dbUrl = process.env.TEST_DATABASE_URL;
const base = process.env.TEST_API_URL || 'http://localhost:3001/api/v1';
assert.equal(process.env.RUN_LOCAL_HOUSE_ACCEPTANCE, '1', 'Explicit acceptance opt-in required');
assert(dbUrl && ['localhost', '127.0.0.1'].includes(new URL(dbUrl).hostname), 'Local TEST_DATABASE_URL required');
assert(['localhost', '127.0.0.1'].includes(new URL(base).hostname), 'Local API required');
assert(process.env.DEMO_PASSWORD, 'Explicit demo password required');
const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });
const fullJourney = process.env.TEST_HOUSE_FULL_JOURNEY === '1';
const report = { run: `House ${fullJourney ? 'transaction' : 'acceptance'} ${new Date().toISOString()}`, checks: [] };

function actor() {
  let cookies = '';
  return async (path, method = 'GET', body, expected = 200, key) => {
    const response = await fetch(`${base}${path}`, {
      method, headers: { 'content-type': 'application/json', origin: 'http://localhost:3100', ...(cookies ? { cookie: cookies } : {}), ...(key ? { 'idempotency-key': key } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const set = response.headers.getSetCookie();
    if (set.length) cookies = set.map((value) => value.split(';')[0]).join('; ');
    const raw = await response.text();
    let data;
    try { data = raw ? JSON.parse(raw) : null; } catch { data = null; }
    assert.equal(response.status, expected, `${method} ${path.replace(/drafts\/[^/]+/, 'drafts/[redacted]')}: ${response.status} ${response.ok ? '' : JSON.stringify(data)}`);
    return data;
  };
}

async function main() {
  const client = actor(), firm = actor(), other = actor();
  for (const [api, email] of [[client, 'ana.popescu@demo.ro'], [firm, 'owner.b@demo.ro'], [other, 'owner.a@demo.ro']]) {
    await api('/auth/login', 'POST', { email, password: process.env.DEMO_PASSWORD });
  }
  const fixture = JSON.parse(readFileSync(resolve(__dirname, '../../../docs/implementation/house-demo-fixture.json'), 'utf8'));
  const addressText = `Acceptance house ${randomUUID()}`;
  const city = 'Bucuresti', county = 'Bucuresti';
  const queryKey = [addressText, city, county, 'ro'].map((s) => s.trim().toLowerCase().replace(/\s+/g, ' ')).join('|');
  await prisma.geocodingCache.create({ data: { queryKey, lat: 44.4268, lng: 26.1025, displayName: 'Local acceptance only', expiresAt: new Date(Date.now() + 86400000) } });
  const saved = await client('/studio/drafts', 'POST', { name: report.run, data: fixture }, 201);
  report.studioDraftId = saved.id;
  const loaded = await client(`/studio/drafts/${saved.id}`);
  assert.deepEqual(loaded.data.house, fixture.house);
  assert.equal(loaded.data.scenes.length, 2);
  report.checks.push('account studio draft saved and reloaded with connected house');
  await firm(`/studio/drafts/${saved.id}`, 'GET', undefined, 404);
  report.checks.push('other account cannot read client studio draft');
  const rooms = [];
  const studioScenes = fixture.scenes.map((scene) => {
    const requestEntryIds = {};
    for (const placement of scene.placements) {
      const piece = fixture.pieces[placement.pieceId];
      const roomType = `PIECE_${piece.kind}`;
      const sourceLocalId = `acceptance-${placement.id}`;
      requestEntryIds[placement.id] = sourceLocalId;
      rooms.push({ sourceLocalId, roomType, flowVersion: getFlow(roomType).version, answers: { config3d: piece.config, material: 'PAL', ...(piece.kind === 'NIGHTSTAND' ? { count: 'ONE' } : {}) } });
    }
    return { scene, pieces: fixture.pieces, house: fixture.house, requestEntryIds, requestEntryIdKind: 'LOCAL' };
  });
  const draft = await client('/requests/drafts', 'POST', { title: report.run, configuratorState: { rooms, studioScenes } }, 201);
  report.requestId = draft.id;
  const content = { title: report.run, description: 'Local automated acceptance: two rooms, five physical furniture placements.', budgetRange: 'UNDISCLOSED', includesPaidDesign: false, hasOwnProject: true, addressText, city, county, country: 'RO', rooms, studioScenes, contactPreferences: [{ channel: 'EMAIL', value: 'ana.popescu@demo.ro' }] };
  const published = await client(`/requests/drafts/${draft.draftToken}/publish`, 'POST', content, 201);
  assert.equal(published.rooms.length, 5);
  const entryIds = new Set(published.rooms.map((room) => room.id));
  const snapshots = published.studioScenes;
  assert.equal(snapshots.length, 2);
  const mappings = snapshots.flatMap(({ data }) => {
    assert.equal(data.requestEntryIdKind, 'PERSISTED');
    assert.deepEqual(data.house, fixture.house);
    return Object.values(data.requestEntryIds);
  });
  assert.equal(new Set(mappings).size, 5);
  assert(mappings.every((id) => entryIds.has(id)));
  const nightstands = published.rooms.filter((room) => room.roomType === 'PIECE_NIGHTSTAND');
  assert.equal(nightstands.length, 2);
  assert(nightstands.every((room) => room.answers.count === 'ONE'));
  assert.equal(nightstands.flatMap((room) => room.items).reduce((total, item) => total + item.quantity, 0), 2);
  report.checks.push('strict publication maps five placements to five persisted request entries; two individual nightstands');
  const publicView = await firm(`/marketplace/requests/${draft.id}`);
  assert.equal(publicView.studioScenes.length, 2);
  assert(!JSON.stringify(publicView).includes('ana.popescu@demo.ro'));
  assert(!JSON.stringify(publicView).includes(addressText));
  report.checks.push('firm pre-claim house view contains no client email or full address');
  const claim = await firm('/claims', 'POST', { requestId: draft.id }, 201, randomUUID());
  report.claimId = claim.id;
  const privateView = await firm(`/quotes/by-claim/${claim.id}`);
  assert(privateView.client.contacts.some((contact) => contact.value === 'ana.popescu@demo.ro'));
  assert.equal(privateView.detail.addressText, addressText);
  assert.equal(privateView.detail.studioScenes.length, 2);
  await other(`/quotes/by-claim/${claim.id}`, 'GET', undefined, 404);
  report.checks.push('occupying firm sees contact/address/house; unrelated firm denied');
  if (fullJourney) {
    const text = 'Local acceptance: five furniture entries including two individual nightstands.';
    const message = await firm(`/company/chat/threads/${claim.chatThreadId}/messages`, 'POST', { body: text }, 201);
    assert(message.id);
    const messages = await client(`/chat/threads/${claim.chatThreadId}/messages`);
    assert(messages.some((entry) => entry.id === message.id && entry.body === text));
    await other(`/company/chat/threads/${claim.chatThreadId}/messages`, 'GET', undefined, 403);
    report.checks.push('firm chat message readable by owning client, denied to unrelated firm');
    const unitPrice = { PIECE_BED: 5000, PIECE_NIGHTSTAND: 750, PIECE_TABLE: 2000, PIECE_BENCH: 1500 };
    const roomPrices = published.rooms.map((room) => ({ requestRoomId: room.id, price: unitPrice[room.roomType] }));
    assert(roomPrices.every((entry) => Number.isFinite(entry.price)));
    const total = roomPrices.reduce((sum, entry) => sum + entry.price, 0);
    const quoteInput = { claimSlotId: claim.id, currency: 'RON', price: total, roomPrices, description: 'Local acceptance offer, not a commercial quotation.', deliveryTerm: 'Test delivery', warranty: 'Test only', validityDays: 7 };
    const quoteKey = randomUUID();
    const quote = await firm('/quotes', 'POST', quoteInput, 201, quoteKey);
    report.quoteId = quote.id;
    const replay = await firm('/quotes', 'POST', quoteInput, 201, quoteKey);
    assert.deepEqual(replay, quote);
    const offered = await client(`/client/quotes/${quote.id}`);
    const version = offered.versions[0];
    assert.equal(version.roomPrices.length, 5);
    assert.equal(version.roomPrices.reduce((sum, entry) => sum + entry.price, 0), total);
    const nightstandIds = new Set(nightstands.map((room) => room.id));
    assert.equal(version.roomPrices.filter((entry) => nightstandIds.has(entry.requestRoomId)).length, 2);
    report.checks.push('five-entry quote totals match, two nightstand prices retained, same-key replay returns same quote');
    const acceptKey = randomUUID();
    const accepted = await client(`/client/quotes/${quote.id}/accept`, 'POST', {}, 201, acceptKey);
    assert.equal(accepted.status, 'ACCEPTED');
    assert.deepEqual(await client(`/client/quotes/${quote.id}/accept`, 'POST', {}, 201, acceptKey), accepted);
    assert.equal((await client(`/requests/${draft.id}`)).status, 'ACCEPTED');
    await other(`/company/requests/${draft.id}/deliver`, 'POST', {}, 403);
    const delivered = await firm(`/company/requests/${draft.id}/deliver`, 'POST', {}, 201);
    assert.equal(delivered.status, 'DELIVERED_BY_COMPANY');
    const completed = await client(`/requests/${draft.id}/confirm-delivery`, 'POST', {}, 201);
    assert.equal(completed.status, 'COMPLETED');
    await client(`/requests/${draft.id}/confirm-delivery`, 'POST', {}, 409);
    const final = await client(`/requests/${draft.id}`);
    assert.equal(final.status, 'COMPLETED');
    assert.equal(final.rooms.filter((room) => room.roomType === 'PIECE_NIGHTSTAND').flatMap((room) => room.items).reduce((sum, item) => sum + item.quantity, 0), 2);
    const completedContext = await firm(`/quotes/by-claim/${claim.id}`);
    assert.equal(completedContext.claimStatus, 'COMPLETED');
    report.checks.push('client accepts once; winning firm delivers; client completion closes claim; duplicate completion rejected');
    console.log(JSON.stringify({ ...report, retained: 'New completed local acceptance request; normal winner credit consumption applied; previous acceptance fixture untouched' }, null, 2));
    return;
  }
  await firm(`/claims/${claim.id}/withdraw`, 'POST', { reasonType: 'VOLUNTARY_NO_REASON' }, 201, randomUUID());
  const closed = await firm(`/quotes/by-claim/${claim.id}`);
  assert.equal(closed.client, null);
  assert.equal(closed.detail.addressText, '');
  report.checks.push('withdrawn firm loses client contact and full address');
  console.log(JSON.stringify({ ...report, retained: 'Named request and studio draft retained on isolated local DB only' }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({ ...report, failure: error.message }, null, 2));
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());

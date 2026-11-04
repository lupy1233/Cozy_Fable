import { HttpException } from '@nestjs/common';
import { ERROR_CODES } from '@marketplace/shared';
import { haversineKm } from './claims.helpers';
import { makeClaimsService, makeClaimsTx } from './claims.test-fixtures';
import { ASSIGN_DEADLINE_MS, ASSIGN_WARNING_JOB } from './claims.constants';
import { PRIVACY_GRID_LAT_DEG, PRIVACY_GRID_LNG_DEG, snapToPrivacyGrid } from '../../common/privacy/location-privacy';
import { freezeClock, plusMs, restoreClock } from '../../test/clock';

// L0-B — verificari in tranzactia de claim (3.1), cu Prisma mock-uit:
//  - gating per plan (4.10): published_at + delay(plan) > now → GATING_NOT_OPEN;
//  - cerere stearsa (soft delete) → CLAIM_NOT_ALLOWED (nu se rezerva credite).
// E-admin-platform-14: serviciul se construieste prin makeClaimsService (tipat — inainte
// eventBus stătea pe pozitia OutboxService) si ceasul e inghetat (freezeClock).

// recalculul statusului cererii are specul lui (claims.helpers.spec); aici doar il observam
jest.mock('./claims.helpers', () => ({
  ...jest.requireActual('./claims.helpers'),
  recomputeRequestStatusAfterClaimChange: jest.fn().mockResolvedValue({ republishedExpiresAt: null }),
}));

/* eslint-disable @typescript-eslint/no-explicit-any */
type Any = any;

const NOW = '2026-09-01T10:00:00Z';
const MIN = 60_000;
let now: Date;

beforeEach(() => {
  now = freezeClock(NOW);
});
afterEach(() => restoreClock());

function makeService(lockedRow: Any, openAfterFirstOffer = false) {
  const tx = makeClaimsTx();
  tx.$queryRaw.mockResolvedValue(lockedRow ? [lockedRow] : []);
  const deps = makeClaimsService({}, tx);
  deps.settings.getBool.mockResolvedValue(openAfterFirstOffer);
  return deps;
}

// published_at relativ la ceasul inghetat (nu la momentul incarcarii modulului)
function baseRow(over: Record<string, unknown> = {}): Any {
  return {
    id: 'r1',
    status: 'IN_MARKETPLACE',
    deleted_at: null,
    published_at: new Date(now.getTime() - 10 * MIN),
    lat: 44.4,
    lng: 26.1,
    project_size: 'SMALL',
    project_score: 10,
    credit_cost: 1,
    ...over,
  };
}
const dto: Any = { requestId: 'r1' };

describe('ClaimsService.create — verificari sub lock (L0-B)', () => {
  it('gating-ul planului nu a trecut (Gold +30 min, publicata acum 10 min) → GATING_NOT_OPEN 403', async () => {
    const { service, tx, credits } = makeService(baseRow());
    const ctx: Any = { companyId: 'c1', memberRole: 'OWNER', status: 'APPROVED', gatingDelayMinutes: 30 };
    await expect(service.create(ctx, 'u1', dto)).rejects.toMatchObject({
      status: 403,
      response: { code: 'GATING_NOT_OPEN' },
    });
    expect(tx.claimSlot.create).not.toHaveBeenCalled();
    expect(credits.reserve).not.toHaveBeenCalled();
  });

  it('gating trecut (Platinum +0) → trece de verificarea de gating (urmatoarea verificare e sloturile)', async () => {
    const { service, tx } = makeService(baseRow());
    tx.claimSlot.count.mockResolvedValue(3); // sloturi pline → ne oprim acolo, dupa gating
    const ctx: Any = { companyId: 'c1', memberRole: 'OWNER', status: 'APPROVED', gatingDelayMinutes: 0 };
    await expect(service.create(ctx, 'u1', dto)).rejects.toMatchObject({
      status: 409,
      response: { code: 'CLAIM_SLOTS_FULL' },
    });
  });

  it('cerere stearsa de client (deleted_at) → CLAIM_NOT_ALLOWED, fara rezervare de credite', async () => {
    const { service, credits } = makeService(baseRow({ deleted_at: new Date() }));
    const ctx: Any = { companyId: 'c1', memberRole: 'OWNER', status: 'APPROVED', gatingDelayMinutes: 0 };
    await expect(service.create(ctx, 'u1', dto)).rejects.toMatchObject({
      status: 409,
      response: { code: 'CLAIM_NOT_ALLOWED' },
    });
    expect(credits.reserve).not.toHaveBeenCalled();
  });

  it('cerere fara published_at → CLAIM_NOT_ALLOWED', async () => {
    const { service } = makeService(baseRow({ published_at: null }));
    const ctx: Any = { companyId: 'c1', memberRole: 'OWNER', status: 'APPROVED' };
    await expect(service.create(ctx, 'u1', dto)).rejects.toMatchObject({
      response: { code: 'CLAIM_NOT_ALLOWED' },
    });
  });
});

// E-admin-platform-10 — cererea dupa prima oferta: invarianta 3.1 literala cu flag-ul oprit,
// varianta A (sloturile libere decid) doar cu claims_open_after_first_offer=true.
describe('ClaimsService.create — claim dupa prima oferta (E-admin-platform-10)', () => {
  const ctx: Any = { companyId: 'c1', memberRole: 'OWNER', status: 'APPROVED', gatingDelayMinutes: 0 };

  it.each(['OFFERS_RECEIVED', 'NEGOTIATION'])('flag oprit: %s → 409 CLAIM_NOT_ALLOWED, fara slot si fara credite', async (status) => {
    const { service, tx, credits, settings } = makeService(baseRow({ status }), false);
    await expect(service.create(ctx, 'u1', dto)).rejects.toMatchObject({
      status: 409,
      response: { code: 'CLAIM_NOT_ALLOWED' },
    });
    expect(settings.getBool).toHaveBeenCalledWith('claims_open_after_first_offer', false);
    expect(tx.claimSlot.count).not.toHaveBeenCalled();
    expect(tx.claimSlot.create).not.toHaveBeenCalled();
    expect(credits.reserve).not.toHaveBeenCalled();
  });

  it('flag pornit: OFFERS_RECEIVED cu 1/3 sloturi trece de status si de sloturi (se opreste la claim existent)', async () => {
    const { service, tx } = makeService(baseRow({ status: 'OFFERS_RECEIVED' }), true);
    tx.claimSlot.count.mockResolvedValue(1);
    tx.claimSlot.findFirst.mockResolvedValue({ id: 'own' }); // oprim testul inainte de acoperire/creare
    await expect(service.create(ctx, 'u1', dto)).rejects.toMatchObject({
      status: 409,
      response: { code: 'CLAIM_ALREADY_EXISTS' },
    });
    expect(tx.claimSlot.count).toHaveBeenCalledTimes(1);
    expect(tx.requestCompanyExclusion.findUnique).toHaveBeenCalledTimes(1);
  });

  it('flag pornit: OFFERS_RECEIVED cu sloturi pline → CLAIM_SLOTS_FULL (numarul de sloturi decide)', async () => {
    const { service, tx } = makeService(baseRow({ status: 'OFFERS_RECEIVED' }), true);
    tx.claimSlot.count.mockResolvedValue(3);
    await expect(service.create(ctx, 'u1', dto)).rejects.toMatchObject({
      status: 409,
      response: { code: 'CLAIM_SLOTS_FULL' },
    });
  });

  it.each(['CLAIMED_FULL', 'ACCEPTED'])('flag pornit: %s ramane neclaimabil', async (status) => {
    const { service } = makeService(baseRow({ status }), true);
    await expect(service.create(ctx, 'u1', dto)).rejects.toMatchObject({
      status: 409,
      response: { code: 'CLAIM_NOT_ALLOWED' },
    });
  });
});

// E-client-9 (C7-2) — acoperirea la claim se masoara din punctul APROXIMAT al cererii (aceeasi
// grila ca SQL-ul din marketplace), nu din punctul exact de geocodare.
describe('ClaimsService.create — acoperire pe punctul aproximat (E-client-9)', () => {
  const ctx: Any = { companyId: 'c1', memberRole: 'OWNER', status: 'APPROVED', gatingDelayMinutes: 0 };
  // punct exact langa coltul unei celule → centrul celulei e la ~1,4 km
  const cellLat = Math.floor(44.4268 / PRIVACY_GRID_LAT_DEG) * PRIVACY_GRID_LAT_DEG;
  const cellLng = Math.floor(26.1025 / PRIVACY_GRID_LNG_DEG) * PRIVACY_GRID_LNG_DEG;
  const exact = { lat: cellLat + 0.0005, lng: cellLng + 0.0005 };
  const snapped = snapToPrivacyGrid(exact.lat, exact.lng);
  const snappedDistance = haversineKm(snapped.lat, snapped.lng, exact.lat, exact.lng);

  it('punctul exact e in raza, punctul aproximat nu → OUT_OF_COVERAGE_AREA, fara slot/credite', async () => {
    expect(snappedDistance).toBeGreaterThan(1);
    const { service, tx, credits } = makeService(baseRow(exact));
    // locatia firmei chiar pe adresa clientului, cu raza sub distanta pana la centrul celulei
    tx.companyLocation.findMany.mockResolvedValue([{ lat: exact.lat, lng: exact.lng, coverageRadiusKm: snappedDistance - 0.2 }]);
    await expect(service.create(ctx, 'u1', dto)).rejects.toMatchObject({
      status: 403,
      response: { code: 'OUT_OF_COVERAGE_AREA' },
    });
    expect(tx.claimSlot.create).not.toHaveBeenCalled();
    expect(credits.reserve).not.toHaveBeenCalled();
  });

  it('punctul aproximat e in raza → trece de acoperire (se opreste la regula de atribuire)', async () => {
    const { service, tx, prisma } = makeService(baseRow(exact));
    prisma.companyMember.findUnique.mockResolvedValue({ companyId: 'c1', userId: 'u2' });
    tx.companyLocation.findMany.mockResolvedValue([{ lat: snapped.lat, lng: snapped.lng, coverageRadiusKm: 2 }]);
    tx.claimSlot.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'busy' });
    await expect(service.create(ctx, 'u1', { requestId: 'r1', assignToUserId: 'u2' })).rejects.toMatchObject({
      status: 409,
      response: { code: 'ASSIGNED_USER_HAS_ACTIVE_CLAIM' },
    });
    expect(tx.companyLocation.findMany).toHaveBeenCalledWith({ where: { companyId: 'c1' } });
  });
});

// E-admin-platform-14 — drumul fericit: rezervarea vine din claim (CreditsService.reserve cu
// costul snapshot), intentiile outbox se scriu in tranzactie, joburile se programeaza dupa.
describe('ClaimsService.create — drumul fericit (E-admin-platform-14)', () => {
  const ctx: Any = { companyId: 'c1', memberRole: 'OWNER', status: 'APPROVED', gatingDelayMinutes: 0 };

  function happy() {
    const row = baseRow({ credit_cost: 2, project_size: 'SMALL' });
    const deps = makeService(row);
    const p = snapToPrivacyGrid(row.lat, row.lng);
    deps.tx.companyLocation.findMany.mockResolvedValue([{ lat: p.lat, lng: p.lng, coverageRadiusKm: 5 }]);
    deps.tx.companyMember.findMany.mockResolvedValue([{ userId: 'u1', companyId: 'c1' }]);
    deps.tx.claimSlot.create.mockImplementation(({ data }: Any) =>
      Promise.resolve({
        id: 'slot1',
        ...data,
        quoteId: null,
        slaPausedAt: null,
        withdrawnAt: null,
        createdAt: now,
        updatedAt: now,
      }),
    );
    deps.tx.request.findUnique.mockResolvedValue({ clientUserId: 'cl1' });
    return deps;
  }

  it('happy path: reserve + outbox + jobs', async () => {
    const { service, tx, credits, outbox, assignQueue, slaQueue } = happy();
    const out = await service.create(ctx, 'u1', dto);

    expect(credits.reserve).toHaveBeenCalledWith('c1', 2, 'CLAIM_RESERVE', 'slot1', tx);
    const created = tx.claimSlot.create.mock.calls[0][0].data;
    expect(created).toMatchObject({
      requestId: 'r1', companyId: 'c1', claimedByUserId: 'u1', assignedToUserId: null,
      status: 'ACTIVE', claimCostCreditsSnapshot: 2, projectSizeSnapshot: 'SMALL',
    });
    expect(created.assignDeadlineAt).toEqual(plusMs(now, ASSIGN_DEADLINE_MS));
    expect(tx.chatThread.create).toHaveBeenCalledWith({ data: { claimSlotId: 'slot1' } });

    const keys = outbox.record.mock.calls.map((c) => c[1]);
    expect(keys).toEqual(['claim.created:slot1', 'claim.created:slot1:status']);
    expect(outbox.record.mock.calls[0][0]).toBe(tx);
    expect(outbox.record.mock.calls[0][4]).toEqual(['u1', 'cl1']);

    expect(assignQueue.add).toHaveBeenCalledWith(
      'assign-deadline',
      { claimSlotId: 'slot1' },
      expect.objectContaining({ delay: ASSIGN_DEADLINE_MS, jobId: 'claim-assign-slot1' }),
    );
    expect(assignQueue.add).toHaveBeenCalledWith(ASSIGN_WARNING_JOB, { claimSlotId: 'slot1' }, expect.anything());
    expect(slaQueue.add).toHaveBeenCalledTimes(3);
    expect(out).toMatchObject({ id: 'slot1', chatThreadId: 't1', claimCostCreditsSnapshot: 2, status: 'ACTIVE' });
  });

  it('INSUFFICIENT_CREDITS din reserve → eroarea se propaga, fara joburi programate', async () => {
    const { service, credits, assignQueue, slaQueue } = happy();
    credits.reserve.mockRejectedValue(
      new HttpException({ code: ERROR_CODES.INSUFFICIENT_CREDITS, message: 'Not enough credits' }, 402),
    );
    await expect(service.create(ctx, 'u1', dto)).rejects.toMatchObject({
      status: 402,
      response: { code: 'INSUFFICIENT_CREDITS' },
    });
    expect(assignQueue.add).not.toHaveBeenCalled();
    expect(slaQueue.add).not.toHaveBeenCalled();
  });
});

import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { createHash } from 'crypto';
import { ERROR_CODES } from '@marketplace/shared';
import { RequestsService } from './requests.service';
import { draftCityText, knownRoomTypes, MAX_LISTED_DRAFTS } from './draft-list';

// d5: "Cererile mele" — numarul de firme socoteste si castigatoarea dupa finalizare; fila
// "Ciorne" arata doar ciornele contului (cu macar o camera) si le redeschide de pe orice
// dispozitiv cu un token nou, doar pentru proprietar.

/* eslint-disable @typescript-eslint/no-explicit-any */
function setup(over: { findMany?: any[]; findUnique?: any; updateCount?: number; raw?: any[] } = {}) {
  const prisma: any = {
    $queryRaw: jest.fn().mockResolvedValue(over.raw ?? []),
    request: {
      findMany: jest.fn().mockResolvedValue(over.findMany ?? []),
      findUnique: jest.fn().mockResolvedValue(over.findUnique ?? null),
      updateMany: jest.fn().mockResolvedValue({ count: over.updateCount ?? 1 }),
    },
  };
  const service = new RequestsService(
    prisma as never, {} as never, {} as never, {} as never, {} as never, {} as never,
    {} as never, {} as never, {} as never, {} as never, {} as never,
  );
  return { service, prisma };
}

async function expectCode(p: Promise<unknown>, type: new (...a: never[]) => Error, code: string) {
  const err = await p.then(() => undefined, (e: unknown) => e);
  expect(err).toBeInstanceOf(type);
  expect((err as { getResponse(): { code: string } }).getResponse().code).toBe(code);
}

const at = new Date('2026-11-10T10:00:00Z');
const listRow = (status: string, claims: string[]) => ({
  id: `r-${status}`, status, title: 'T', budgetRange: 'UNDISCLOSED', budgetEstimateRon: null, budgetDeclared: false,
  city: 'Cluj', county: 'Cluj', publishedAt: at, expiresAt: null, createdAt: at,
  rooms: [{ roomType: 'KITCHEN' }], claims: claims.map((status) => ({ status })), quotes: [],
});

describe('RequestsService.listForClient — firmele socotite (d5)', () => {
  it('cererea finalizata socoteste firma castigatoare (slot COMPLETED); preluarile inchise nu', async () => {
    const { service } = setup({
      findMany: [
        listRow('COMPLETED', ['COMPLETED', 'CANCELLED_REQUEST_ACCEPTED', 'CANCELLED_REQUEST_ACCEPTED']),
        listRow('CLAIMED_PARTIAL', ['ACTIVE', 'OFFER_SENT', 'WITHDRAWN_VOLUNTARY']),
      ],
    });
    const [done, open] = await service.listForClient('A');
    expect(done.activeClaims).toBe(1);
    expect(open.activeClaims).toBe(2);
  });
});

describe('RequestsService.listDraftsForClient (d5-1)', () => {
  // revizie m4: o singura interogare SQL, cu limita, care citeste din JSON doar campurile listei
  it('interogarea: doar ciornele nesterse ale contului, cele mai recente 20, fara tot JSON-ul', async () => {
    const { service, prisma } = setup();
    await service.listDraftsForClient('A');
    expect(prisma.request.findMany).not.toHaveBeenCalled();
    const [strings, ...values] = prisma.$queryRaw.mock.calls[0];
    const sql = strings.join('?');
    expect(sql).toMatch(/client_user_id = \?/);
    expect(sql).toMatch(/deleted_at IS NULL/);
    expect(sql).toMatch(/status = 'DRAFT'/);
    expect(sql).toMatch(/ORDER BY updated_at DESC\s+LIMIT \?/);
    expect(sql).not.toMatch(/SELECT \*|configurator_state,|configurator_state\s+FROM/);
    expect(values).toContain('A');
    expect(values).toContain(MAX_LISTED_DRAFTS);
  });

  it('sare peste ciornele fara camere cunoscute; orasul din formular cand lipseste coloana', async () => {
    const { service } = setup({
      raw: [
        { id: 'd1', title: null, city: null, draft_city: ' Iasi ', room_types: ['KITCHEN', 'HACKED', null], created_at: at, updated_at: at },
        { id: 'd2', title: 'Doar necunoscute', city: null, draft_city: null, room_types: ['HACKED'], created_at: at, updated_at: at },
      ],
    });
    expect(await service.listDraftsForClient('A')).toEqual([
      { id: 'd1', title: '', city: 'Iasi', roomTypes: ['KITCHEN'], createdAt: at.toISOString(), updatedAt: at.toISOString() },
    ]);
  });

  it('citirile apara orice valoare', () => {
    expect(knownRoomTypes(null)).toEqual([]);
    expect(knownRoomTypes('KITCHEN')).toEqual([]);
    expect(knownRoomTypes([1, 'BATHROOM'])).toEqual(['BATHROOM']);
    expect(draftCityText(42)).toBe('');
  });
});

describe('RequestsService.reissueDraftTokenForClient (d5-1)', () => {
  const draft = { id: 'd1', clientUserId: 'A', status: 'DRAFT', deletedAt: null };

  it('proprietarul primeste un token nou; se salveaza doar hash-ul, conditionat pe ciorna', async () => {
    const { service, prisma } = setup({ findUnique: draft });
    const res = await service.reissueDraftTokenForClient('A', 'd1');
    expect(res.id).toBe('d1');
    expect(res.draftToken).toMatch(/^[0-9a-f]{64}$/);
    const call = prisma.request.updateMany.mock.calls[0][0];
    expect(call.where).toEqual({ id: 'd1', clientUserId: 'A', status: 'DRAFT', deletedAt: null });
    expect(call.data.draftTokenHash).toBe(createHash('sha256').update(res.draftToken).digest('hex'));
  });

  it('alt cont → 403; ciorna stearsa → 404; fara scriere', async () => {
    const other = setup({ findUnique: draft });
    await expect(other.service.reissueDraftTokenForClient('B', 'd1')).rejects.toBeInstanceOf(ForbiddenException);
    expect(other.prisma.request.updateMany).not.toHaveBeenCalled();
    const gone = setup({ findUnique: { ...draft, deletedAt: at } });
    await expect(gone.service.reissueDraftTokenForClient('A', 'd1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('cerere publicata → 400 REQUEST_NOT_EDITABLE, fara scriere', async () => {
    const { service, prisma } = setup({ findUnique: { ...draft, status: 'IN_MARKETPLACE' } });
    await expectCode(service.reissueDraftTokenForClient('A', 'd1'), BadRequestException, ERROR_CODES.REQUEST_NOT_EDITABLE);
    expect(prisma.request.updateMany).not.toHaveBeenCalled();
  });

  it('publicata / stearsa intre citire si scriere (count 0) → 400', async () => {
    const { service } = setup({ findUnique: draft, updateCount: 0 });
    await expectCode(service.reissueDraftTokenForClient('A', 'd1'), BadRequestException, ERROR_CODES.REQUEST_NOT_EDITABLE);
  });
});

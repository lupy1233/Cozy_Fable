import { RequestsService } from './requests.service';

// e3 (etapa 9): editarea DUPA preluare anunta firmele cu preluare deschisa — un eveniment
// request.edited_after_claim pe fiecare preluare ACTIVE / OFFER_SENT, tintit membrilor firmei.

type AnyMock = jest.Mock;
const REQ_ID = 'req-1';

function setup(requestOver: Record<string, unknown>, openClaims: unknown[]) {
  const tx = {
    request: { update: jest.fn().mockResolvedValue({}), updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    requestContactDetection: { createMany: jest.fn().mockResolvedValue({ count: 1 }) },
    claimSlot: { findMany: jest.fn().mockResolvedValue(openClaims) },
    // revizie A m2: limita de editare se reverifica pe randul blocat (SELECT … FOR UPDATE)
    $queryRaw: jest.fn().mockResolvedValue([
      {
        status: requestOver.status ?? 'IN_MARKETPLACE',
        deleted_at: null,
        pre_claim_edits_used: requestOver.preClaimEditsUsed ?? 0,
        post_claim_edits_used: requestOver.postClaimEditsUsed ?? 0,
      },
    ]),
  };
  const prisma = {
    request: {
      findUnique: jest.fn().mockResolvedValue({
        id: REQ_ID,
        clientUserId: 'client-1',
        deletedAt: null,
        configuratorState: null,
        repostUsed: false,
        preClaimEditsUsed: 0,
        postClaimEditsUsed: 0,
        includesPaidDesign: false,
        addressText: 'Str. X 1',
        city: 'Cluj-Napoca',
        county: 'Cluj',
        country: 'RO',
        lat: 46.7,
        lng: 23.6,
        ...requestOver,
      }),
      update: jest.fn().mockResolvedValue({}),
    },
    user: { findUnique: jest.fn().mockResolvedValue({ role: 'CLIENT' }), findMany: jest.fn().mockResolvedValue([]) },
    $queryRaw: jest.fn().mockResolvedValue([{ covered: true }]),
    requestRoom: { count: jest.fn().mockResolvedValue(0) },
    requestContactDetection: { createMany: jest.fn().mockResolvedValue({ count: 1 }), count: jest.fn().mockResolvedValue(0) },
    requestStudioScene: { findMany: jest.fn().mockResolvedValue([]) },
    $transaction: jest.fn((fn: (t: typeof tx) => unknown) => fn(tx)),
  };
  const outbox = { record: jest.fn().mockResolvedValue(undefined) };
  const service = new RequestsService(
    prisma as never,
    { geocode: jest.fn().mockResolvedValue({ lat: 46.7, lng: 23.6 }) } as never,
    { compute: jest.fn().mockResolvedValue({ score: 1, size: 'SMALL', creditCost: 1, baseScore: 1 }) } as never,
    {
      processRooms: jest.fn().mockReturnValue({ rooms: [], scoreEntries: [] }),
      collectUploadAttachmentIds: jest.fn().mockReturnValue([]),
      passesStrictValidation: jest.fn().mockReturnValue(false),
    } as never,
    {} as never,
    { assertSelectable: jest.fn().mockResolvedValue(undefined) } as never,
    {
      addWorkingDays: jest.fn().mockReturnValue(new Date('2026-12-20T10:00:00Z')),
      workingDateBefore: jest.fn().mockReturnValue('2026-12-19'),
      bucharestWallClock: jest.fn().mockReturnValue(new Date('2026-12-19T06:00:00Z')),
    } as never,
    outbox as never,
    {} as never,
    { add: jest.fn().mockResolvedValue(undefined) } as never,
    { getString: jest.fn((_k: string, fallback: string) => Promise.resolve(fallback)) } as never,
  );
  const s = service as unknown as Record<string, unknown>;
  for (const m of ['withAccountEmail', 'assertRoomAttachments', 'writeContactPreferences', 'writeInspirationPhotos', 'writeStudioScenes', 'writeVersion', 'removeDroppedDesignHelpUploads']) {
    jest.spyOn(s as never, m as never).mockResolvedValue([] as never);
  }
  jest.spyOn(s as never, 'assertContactFormats' as never).mockReturnValue(undefined as never);
  jest.spyOn(s as never, 'writeRooms' as never).mockResolvedValue(new Map() as never);
  jest.spyOn(s as never, 'resolveTitle' as never).mockReturnValue('Bucătărie — Cluj-Napoca' as never);
  jest.spyOn(s as never, 'toDto' as never).mockImplementation(((id: string) => Promise.resolve({ id })) as never);
  return { service, tx, outbox };
}

const content = {
  rooms: [],
  hasOwnProject: false,
  includesPaidDesign: false,
  budgetRange: 'UNDER_5K',
  studioScenes: [],
  addressText: 'Str. X 1',
  city: 'Cluj-Napoca',
  county: 'Cluj',
  country: 'RO',
} as never;

function editedAfterClaimCalls(outbox: { record: AnyMock }) {
  return outbox.record.mock.calls.filter((c: unknown[]) => c[2] === 'request.edited_after_claim');
}

describe('RequestsService.editForClient — request.edited_after_claim (e3)', () => {
  it('cerere preluata: un eveniment pe fiecare preluare deschisa, tintit membrilor firmei', async () => {
    const { service, tx, outbox } = setup({ status: 'CLAIMED_PARTIAL' }, [
      { id: 'slot-1', companyId: 'co-1', company: { name: 'Firma Unu', members: [{ userId: 'u1' }, { userId: 'u2' }] } },
      { id: 'slot-2', companyId: 'co-2', company: { name: 'Firma Doi', members: [{ userId: 'u3' }] } },
    ]);
    await service.editForClient('client-1', REQ_ID, content);

    // doar preluarile deschise (nu cele retrase / anulate / expirate)
    expect(tx.claimSlot.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { requestId: REQ_ID, status: { in: ['ACTIVE', 'OFFER_SENT'] } } }),
    );
    const calls = editedAfterClaimCalls(outbox);
    expect(calls).toHaveLength(2);
    expect(calls[0][0]).toBe(tx);
    expect(calls[0][1]).toBe('request.edited_after_claim:slot-1:1');
    expect(calls[0][3]).toEqual({
      requestId: REQ_ID,
      requestTitle: 'Bucătărie — Cluj-Napoca',
      claimSlotId: 'slot-1',
      companyId: 'co-1',
      companyName: 'Firma Unu',
      clientUserId: 'client-1',
      actorUserId: 'client-1',
    });
    expect(calls[0][4]).toEqual(['u1', 'u2']);
    expect(calls[1][3]).toMatchObject({ claimSlotId: 'slot-2', companyId: 'co-2' });
    expect(calls[1][4]).toEqual(['u3']);
    // semnalul public de reimprospatare ramane
    expect(outbox.record.mock.calls.some((c: unknown[]) => c[2] === 'request.status_changed')).toBe(true);
  });

  it('editare inainte de preluare (IN_MARKETPLACE) → niciun eveniment catre firme', async () => {
    const { service, tx, outbox } = setup({ status: 'IN_MARKETPLACE' }, []);
    await service.editForClient('client-1', REQ_ID, content);
    expect(tx.claimSlot.findMany).not.toHaveBeenCalled();
    expect(editedAfterClaimCalls(outbox)).toHaveLength(0);
  });

  it('cerere preluata, dar fara nicio preluare deschisa → niciun eveniment', async () => {
    const { service, outbox } = setup({ status: 'CLAIMED_FULL' }, []);
    await service.editForClient('client-1', REQ_ID, content);
    expect(editedAfterClaimCalls(outbox)).toHaveLength(0);
  });
});

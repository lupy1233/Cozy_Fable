import { TokenService } from './token.service';
import { MAX_ACTIVE_SESSIONS } from './auth.constants';

// f3 (PO f3-1): cel mult 5 sesiuni active; a sasea autentificare o scoate pe cea mai veche.
// Testul cu Postgres real (concurenta) e in token.service.integration.spec.ts.
function setup(families: Array<{ familyId: string; startedAt: number }>) {
  const tx = {
    $queryRaw: jest.fn().mockResolvedValue([]),
    user: { findUnique: jest.fn().mockResolvedValue({ id: 'u1', passwordHash: 'h', deletedAt: null, blockedAt: null }) },
    refreshToken: {
      findMany: jest.fn().mockResolvedValue(families.map((f) => ({ familyId: f.familyId }))),
      groupBy: jest.fn().mockResolvedValue(families.map((f) => ({ familyId: f.familyId, _min: { createdAt: new Date(f.startedAt) } }))),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      create: jest.fn().mockResolvedValue({}),
    },
  };
  const prisma = { $transaction: jest.fn((fn: (t: typeof tx) => unknown) => fn(tx)) };
  const service = new TokenService(prisma as never, {} as never, {} as never);
  return { service, tx };
}

describe('TokenService.issueNewFamily — limita de sesiuni (f3)', () => {
  it('sub limita (4 active): nu revoca nimic', async () => {
    const { service, tx } = setup([1, 2, 3, 4].map((i) => ({ familyId: `f${i}`, startedAt: i })));
    const out = await service.issueNewFamily('u1', 'h');
    expect(out.revokedFamilyIds).toEqual([]);
    expect(tx.refreshToken.updateMany).not.toHaveBeenCalled();
    expect(tx.refreshToken.create).toHaveBeenCalledTimes(1);
  });

  it('a sasea autentificare (5 active) revoca doar cea mai veche familie, dupa primul token', async () => {
    // ordinea din DB nu e cea cronologica: f-c e cea mai veche
    const { service, tx } = setup([
      { familyId: 'f-a', startedAt: 300 }, { familyId: 'f-b', startedAt: 500 }, { familyId: 'f-c', startedAt: 100 },
      { familyId: 'f-d', startedAt: 400 }, { familyId: 'f-e', startedAt: 200 },
    ]);
    const out = await service.issueNewFamily('u1', 'h');
    expect(out.revokedFamilyIds).toEqual(['f-c']);
    expect(tx.refreshToken.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: 'u1', familyId: { in: ['f-c'] }, revokedAt: null },
    }));
    expect(out.familyId).not.toBe('f-c');
  });

  it('peste limita (date vechi, 7 active): revoca cele mai vechi pana raman 4 + cea noua', async () => {
    const { service } = setup([1, 2, 3, 4, 5, 6, 7].map((i) => ({ familyId: `f${i}`, startedAt: i })));
    const out = await service.issueNewFamily('u1', 'h');
    expect(out.revokedFamilyIds).toEqual(['f1', 'f2', 'f3']);
    expect(7 - out.revokedFamilyIds.length + 1).toBe(MAX_ACTIVE_SESSIONS);
  });

  it('numara doar familiile active (token nerevocat si neexpirat), sub blocarea userului', async () => {
    const { service, tx } = setup([]);
    await service.issueNewFamily('u1', 'h');
    expect(tx.$queryRaw).toHaveBeenCalled();
    const where = tx.refreshToken.findMany.mock.calls[0][0].where;
    expect(where).toMatchObject({ userId: 'u1', revokedAt: null, expiresAt: { gt: expect.any(Date) } });
    expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(tx.refreshToken.findMany.mock.invocationCallOrder[0]);
  });

  it('revokeAll (schimbarea parolei): revoca toate familiile active', async () => {
    const { service, tx } = setup([1, 2].map((i) => ({ familyId: `f${i}`, startedAt: i })));
    const out = await service.issueNewFamily('u1', 'h', { revokeAll: true });
    expect(out.revokedFamilyIds).toEqual(['f1', 'f2']);
    expect(tx.refreshToken.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 'u1', revokedAt: null } }));
  });

  it('parola schimbata intre timp sau cont blocat: refuza, fara revocari', async () => {
    const { service, tx } = setup([]);
    await expect(service.issueNewFamily('u1', 'alt-hash')).rejects.toMatchObject({ status: 401 });
    tx.user.findUnique.mockResolvedValueOnce({ id: 'u1', passwordHash: 'h', deletedAt: null, blockedAt: new Date() });
    await expect(service.issueNewFamily('u1', 'h')).rejects.toMatchObject({ status: 401 });
    expect(tx.refreshToken.updateMany).not.toHaveBeenCalled();
    expect(tx.refreshToken.create).not.toHaveBeenCalled();
  });
});

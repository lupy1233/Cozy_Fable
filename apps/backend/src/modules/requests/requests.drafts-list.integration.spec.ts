import { testDatabaseUrl } from '../../test/db-guard';
import { cleanupMoney, createTestPrisma, makeClient, type MoneyCleanup } from '../../test/money-fixtures';
import { RequestsService } from './requests.service';
import { MAX_LISTED_DRAFTS } from './draft-list';

// d5 (revizie m4) — interogarea SQL a filei "Ciorne" pe PostgreSQL REAL: doar ciornele contului,
// cu macar o camera, cele mai recente MAX_LISTED_DRAFTS; JSON-uri ciudate nu o rup.

const url = testDatabaseUrl();

(url ? describe : describe.skip)('GET /requests/my-drafts on PostgreSQL (d5)', () => {
  jest.setTimeout(60_000);
  const prisma = url ? createTestPrisma(url).prisma : (undefined as never);
  const service = url
    ? new RequestsService(
        prisma as never, {} as never, {} as never, {} as never, {} as never, {} as never,
        {} as never, {} as never, {} as never, {} as never, {} as never,
      )
    : (undefined as never);
  const ids: MoneyCleanup = { requestIds: [], companyIds: [], userIds: [] };

  afterAll(async () => {
    await cleanupMoney(prisma, ids);
    await prisma.$disconnect();
  });

  const draft = async (clientUserId: string | null, configuratorState: unknown, over: Record<string, unknown> = {}) => {
    const r = await prisma.request.create({
      data: { clientUserId, status: 'DRAFT', configuratorState: configuratorState as never, ...over },
    });
    ids.requestIds.push(r.id);
    return r.id;
  };

  it('filtreaza, ordoneaza si limiteaza; citeste doar tipurile si orasul', async () => {
    const me = await makeClient(prisma);
    const other = await makeClient(prisma);
    ids.userIds.push(me, other);

    const kitchen = await draft(me, { roomInstances: [{ roomType: 'KITCHEN' }, 'x', { roomType: 'HACKED' }], details: { city: 'Iasi' } });
    await draft(me, { roomInstances: [] });
    await draft(me, { roomInstances: 'nu e lista' });
    await draft(me, null);
    await draft(me, { roomInstances: [{ roomType: 'BEDROOM' }] }, { deletedAt: new Date() });
    await draft(other, { roomInstances: [{ roomType: 'BEDROOM' }] });
    await draft(me, { roomInstances: [{ roomType: 'BEDROOM' }] }, { status: 'IN_MARKETPLACE' });

    const items = await service.listDraftsForClient(me);
    expect(items.map((i) => i.id)).toEqual([kitchen]);
    expect(items[0]).toMatchObject({ roomTypes: ['KITCHEN'], city: 'Iasi', title: '' });

    for (let i = 0; i < MAX_LISTED_DRAFTS + 2; i++) await draft(me, { roomInstances: [{ roomType: 'OFFICE' }] });
    const many = await service.listDraftsForClient(me);
    expect(many).toHaveLength(MAX_LISTED_DRAFTS);
    expect(many.map((i) => i.id)).not.toContain(kitchen);
  });
});

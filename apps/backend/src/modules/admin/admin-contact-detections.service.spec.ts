/* eslint-disable @typescript-eslint/no-explicit-any */
import { AdminContactDetectionsService } from './admin-contact-detections.service';

// E-admin-platform-45 — lista read-only a detectarilor (paginare + mapare).
type Any = any;

function makeService(rows: Any[] = [], total = rows.length) {
  const prisma: Any = {
    requestContactDetection: {
      findMany: jest.fn().mockResolvedValue(rows),
      count: jest.fn().mockResolvedValue(total),
    },
  };
  return { service: new AdminContactDetectionsService(prisma), prisma };
}

const ROW = {
  id: 'd1',
  requestId: 'r1',
  trigger: 'EDIT',
  field: 'DESCRIPTION',
  roomType: null,
  stepId: null,
  kinds: ['PHONE', 'EMAIL'],
  excerpt: 'Sunati la 07•• ••• •56',
  action: 'MASKED',
  createdAt: new Date('2026-10-01T08:00:00Z'),
  request: { title: 'Bucatarie', status: 'IN_MARKETPLACE', deletedAt: null },
};

describe('AdminContactDetectionsService.list', () => {
  it('mapeaza randurile si titlul real al cererii', async () => {
    const { service } = makeService([ROW, { ...ROW, id: 'd2', request: { title: null, status: 'CANCELLED', deletedAt: new Date() } }], 7);
    const page = await service.list({});
    expect(page).toMatchObject({ total: 7, page: 1, pageSize: 25 });
    expect(page.items[0]).toEqual({
      id: 'd1',
      requestId: 'r1',
      requestTitle: 'Bucatarie',
      requestStatus: 'IN_MARKETPLACE',
      requestDeleted: false,
      trigger: 'EDIT',
      field: 'DESCRIPTION',
      roomType: null,
      stepId: null,
      kinds: ['PHONE', 'EMAIL'],
      excerpt: ROW.excerpt,
      action: 'MASKED',
      createdAt: '2026-10-01T08:00:00.000Z',
    });
    expect(page.items[1]).toMatchObject({ requestTitle: '', requestDeleted: true });
  });

  it('limiteaza pageSize la 100, page minim 1 si filtreaza dupa cerere', async () => {
    const { service, prisma } = makeService();
    await service.list({ page: 3, pageSize: 500, requestId: 'r9' });
    const args = prisma.requestContactDetection.findMany.mock.calls[0][0];
    expect(args).toMatchObject({ where: { requestId: 'r9' }, skip: 200, take: 100 });
    expect(prisma.requestContactDetection.count).toHaveBeenCalledWith({ where: { requestId: 'r9' } });

    await service.list({ page: 0, pageSize: 0 });
    const args2 = prisma.requestContactDetection.findMany.mock.calls[1][0];
    expect(args2).toMatchObject({ where: {}, skip: 0, take: 1 });
  });
});

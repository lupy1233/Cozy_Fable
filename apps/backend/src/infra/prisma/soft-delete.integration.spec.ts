import { randomUUID } from 'crypto';
import { activeMembershipWhere } from '../../common/company-context/active-membership';
import { PrismaService } from './prisma.service';
import { withDeletedRecords } from './soft-delete';
import { InspirationService } from '../../modules/inspiration/inspiration.service';
import { InspirationBoardsService } from '../../modules/inspiration/boards.service';
import { testDatabaseUrl } from '../../test/db-guard';

// E-admin-platform-14: doar host local (garda db-guard), altfel testele refuza sa porneasca
const url = testDatabaseUrl();
(url ? describe : describe.skip)('soft-delete policy against PostgreSQL', () => {
  const prisma = new PrismaService(url ? { datasources: { db: { url } } } : undefined);
  const userId = randomUUID();
  const companyId = randomUUID();
  const photoId = randomUUID();
  const boardId = randomUUID();
  beforeAll(async () => {
    await prisma.onModuleInit();
    await prisma.user.create({ data: { id: userId, email: `deleted-read-${userId}@example.invalid`, name: 'Read policy test', role: 'COMPANY_USER', passwordHash: 'test-only' } });
    await prisma.company.create({ data: { id: companyId, name: 'Read policy test company', cui: `test-${companyId}`, regComNumber: 'test', addressText: 'test', county: 'test', city: 'test', lat: 0, lng: 0 } });
    await prisma.companyMember.create({ data: { userId, companyId, role: 'OWNER' } });
  });
  afterAll(async () => {
    await prisma.inspirationBoard.deleteMany({ where: { id: boardId } });
    await prisma.inspirationPhoto.deleteMany({ where: { id: photoId } });
    await prisma.companyMember.deleteMany({ where: { companyId } });
    await prisma.company.deleteMany({ where: { id: companyId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.$disconnect();
  });
  it('excludes deleted users from unique, list, count and transactional reads while preserving explicit history', async () => {
    await prisma.user.update({ where: { id: userId }, data: { deletedAt: new Date() } });
    expect(await prisma.user.findUnique({ where: { id: userId } })).toBeNull();
    expect(await prisma.user.count({ where: { id: userId } })).toBe(0);
    expect(await prisma.user.findMany({ where: { id: userId } })).toHaveLength(0);
    expect(await prisma.$transaction((tx) => tx.user.findUnique({ where: { id: userId } }))).toBeNull();
    expect(await withDeletedRecords('EMAIL_UNIQUENESS', () => prisma.user.findUnique({ where: { id: userId } }))).toMatchObject({ id: userId });
    expect(await prisma.companyMember.findUnique({ where: activeMembershipWhere(userId) })).toBeNull();
  });
  it('rejects membership through a deleted company even when the user is active', async () => {
    await prisma.user.update({ where: { id: userId }, data: { deletedAt: null } });
    await prisma.company.update({ where: { id: companyId }, data: { deletedAt: new Date() } });
    expect(await prisma.companyMember.findUnique({ where: activeMembershipWhere(userId) })).toBeNull();
    expect(await prisma.company.findMany({ where: { id: companyId } })).toHaveLength(0);
    expect(await withDeletedRecords('ISSUED_INVOICE', () => prisma.company.findUnique({ where: { id: companyId } }))).toMatchObject({ id: companyId });
  });
  it('filters deleted companies from public inspiration and nested board items/counts', async () => {
    await prisma.company.update({ where: { id: companyId }, data: { deletedAt: null } });
    await prisma.inspirationPhoto.create({ data: { id: photoId, companyId, title: 'Read policy', roomType: 'BEDROOM', published: true, imageUrl: 'https://example.invalid/test.jpg', colors: [], materials: [], systems: [] } });
    await prisma.inspirationBoard.create({ data: { id: boardId, userId, name: 'Read policy test', items: { create: { photoId } } } });
    const inspiration = new InspirationService(prisma, {} as never, {} as never);
    const boards = new InspirationBoardsService(prisma, inspiration);
    expect(await inspiration.listPublic({ ids: photoId })).toHaveLength(1);
    expect((await boards.detail(userId, boardId)).photos).toHaveLength(1);
    await prisma.company.update({ where: { id: companyId }, data: { deletedAt: new Date() } });
    expect(await inspiration.listPublic({ ids: photoId })).toHaveLength(0);
    await expect(inspiration.assertSelectable([photoId])).rejects.toMatchObject({ status: 400 });
    expect((await boards.detail(userId, boardId)).photos).toHaveLength(0);
    expect((await boards.list(userId)).find((board) => board.id === boardId)?.itemsCount).toBe(0);
  });
});

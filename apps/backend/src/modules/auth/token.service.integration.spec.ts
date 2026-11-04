import { JwtService } from '@nestjs/jwt';
import { randomUUID, createHash } from 'crypto';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { TokenService } from './token.service';
import { assertActiveSession } from './access-session';
import { testDatabaseUrl } from '../../test/db-guard';

// Integration explicita: nu foloseste DATABASE_URL si nu atinge conturi existente.
// E-admin-platform-14: doar host local (garda db-guard), altfel testele refuza sa porneasca
const url = testDatabaseUrl();
const suite = url ? describe : describe.skip;
suite('session concurrency against PostgreSQL', () => {
  const prisma = new PrismaService(url ? { datasources: { db: { url } } } : undefined);
  const service = new TokenService(prisma, new JwtService(), { getOrThrow: () => 'integration-test-secret' } as never);
  let userId: string;
  beforeEach(async () => {
    const user = await prisma.user.create({ data: { email: `session-test-${randomUUID()}@example.invalid`, name: 'Session test', role: 'CLIENT', passwordHash: 'test-only-hash', emailVerifiedAt: new Date() } });
    userId = user.id;
  });
  afterEach(async () => {
    if (!userId) return;
    await prisma.refreshToken.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } });
  });
  afterAll(async () => prisma.$disconnect());

  it('concurrent logins leave one active family and invalidate previous access', async () => {
    const results = await Promise.all([service.issueNewFamily(userId, 'test-only-hash'), service.issueNewFamily(userId, 'test-only-hash')]);
    const active = await prisma.refreshToken.findMany({ where: { userId, revokedAt: null } });
    expect(active).toHaveLength(1);
    const checks = await Promise.allSettled(results.map(({ familyId }) => assertActiveSession(prisma, { sub: userId, sid: familyId, role: 'CLIENT', email: 'test@example.invalid' })));
    expect(checks.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
  });

  it('preserves multi-tab grace but logout racing a refresh cannot leave descendants active', async () => {
    const session = await service.issueNewFamily(userId, 'test-only-hash');
    const rotated = await Promise.all([service.rotate(session.refreshToken), service.rotate(session.refreshToken)]);
    expect(rotated.every((r) => r.familyId === session.familyId)).toBe(true);
    await Promise.allSettled([service.rotate(rotated[0].refreshToken), service.revokeByRawToken(rotated[1].refreshToken)]);
    expect(await prisma.refreshToken.count({ where: { userId, revokedAt: null } })).toBe(0);
    await expect(service.rotate(session.refreshToken)).rejects.toMatchObject({ status: 401 });
  });

  it('reuse beyond grace commits family revocation before throwing', async () => {
    const session = await service.issueNewFamily(userId, 'test-only-hash');
    await service.rotate(session.refreshToken);
    await prisma.refreshToken.update({ where: { tokenHash: createHash('sha256').update(session.refreshToken).digest('hex') }, data: { replacedAt: new Date(Date.now() - 31_000) } });
    await expect(service.rotate(session.refreshToken)).rejects.toMatchObject({ response: { code: 'REFRESH_TOKEN_REUSED' } });
    expect(await prisma.refreshToken.count({ where: { userId, revokedAt: null } })).toBe(0);
  });

  it('a blocked account or password changed during login cannot issue a new family', async () => {
    await prisma.user.update({ where: { id: userId }, data: { passwordHash: 'changed-hash' } });
    await expect(service.issueNewFamily(userId, 'test-only-hash')).rejects.toMatchObject({ status: 401 });
    await prisma.user.update({ where: { id: userId }, data: { blockedAt: new Date() } });
    await expect(service.issueNewFamily(userId, 'changed-hash')).rejects.toMatchObject({ status: 401 });
    expect(await prisma.refreshToken.count({ where: { userId, revokedAt: null } })).toBe(0);
  });
});

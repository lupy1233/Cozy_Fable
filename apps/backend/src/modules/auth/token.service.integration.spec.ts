import { JwtService } from '@nestjs/jwt';
import { randomUUID, createHash } from 'crypto';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { TokenService } from './token.service';
import { assertActiveSession } from './access-session';
import { MAX_ACTIVE_SESSIONS } from './auth.constants';
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

  const check = (sid: string) => assertActiveSession(prisma, { sub: userId, sid, role: 'CLIENT', email: 'test@example.invalid' });
  const activeFamilies = async () => new Set((await prisma.refreshToken.findMany({ where: { userId, revokedAt: null } })).map((t) => t.familyId));

  // f3 (PO f3-1): cel mult MAX_ACTIVE_SESSIONS (5) sesiuni; a sasea o scoate pe cea mai veche.
  it('the sixth login revokes only the oldest session; the other four stay active', async () => {
    const sessions = [];
    for (let i = 0; i < MAX_ACTIVE_SESSIONS; i++) sessions.push(await service.issueNewFamily(userId, 'test-only-hash'));
    expect(sessions.every((s) => s.revokedFamilyIds.length === 0)).toBe(true);
    const sixth = await service.issueNewFamily(userId, 'test-only-hash');
    expect(sixth.revokedFamilyIds).toEqual([sessions[0].familyId]);
    await expect(check(sessions[0].familyId)).rejects.toMatchObject({ status: 401 });
    for (const s of [...sessions.slice(1), sixth]) await expect(check(s.familyId)).resolves.toBeUndefined();
    expect((await activeFamilies()).size).toBe(MAX_ACTIVE_SESSIONS);
  });

  it('the oldest session is chosen by its first token, even after it was rotated recently', async () => {
    const sessions = [];
    for (let i = 0; i < MAX_ACTIVE_SESSIONS; i++) sessions.push(await service.issueNewFamily(userId, 'test-only-hash'));
    await service.rotate(sessions[0].refreshToken); // cea mai veche, dar folosita acum
    const sixth = await service.issueNewFamily(userId, 'test-only-hash');
    expect(sixth.revokedFamilyIds).toEqual([sessions[0].familyId]);
  });

  it('concurrent logins never exceed the session limit', async () => {
    for (let i = 0; i < MAX_ACTIVE_SESSIONS - 1; i++) await service.issueNewFamily(userId, 'test-only-hash');
    const results = await Promise.all([service.issueNewFamily(userId, 'test-only-hash'), service.issueNewFamily(userId, 'test-only-hash'), service.issueNewFamily(userId, 'test-only-hash')]);
    expect((await activeFamilies()).size).toBe(MAX_ACTIVE_SESSIONS);
    const checks = await Promise.allSettled(results.map(({ familyId }) => check(familyId)));
    expect(checks.every((r) => r.status === 'fulfilled')).toBe(true);
    expect(results.flatMap((r) => r.revokedFamilyIds)).toHaveLength(2);
  });

  it('password change (revokeAll) leaves only the new session', async () => {
    const first = await service.issueNewFamily(userId, 'test-only-hash');
    const second = await service.issueNewFamily(userId, 'test-only-hash');
    const fresh = await service.issueNewFamily(userId, 'test-only-hash', { revokeAll: true });
    expect(new Set(fresh.revokedFamilyIds)).toEqual(new Set([first.familyId, second.familyId]));
    expect(await activeFamilies()).toEqual(new Set([fresh.familyId]));
  });

  it('reuse detection revokes only its own family, not the other sessions', async () => {
    const other = await service.issueNewFamily(userId, 'test-only-hash');
    const session = await service.issueNewFamily(userId, 'test-only-hash');
    await service.rotate(session.refreshToken);
    await prisma.refreshToken.update({ where: { tokenHash: createHash('sha256').update(session.refreshToken).digest('hex') }, data: { replacedAt: new Date(Date.now() - 31_000) } });
    await expect(service.rotate(session.refreshToken)).rejects.toMatchObject({ response: { code: 'REFRESH_TOKEN_REUSED' } });
    expect(await activeFamilies()).toEqual(new Set([other.familyId]));
  });

  it('logout revokes only the current session', async () => {
    const other = await service.issueNewFamily(userId, 'test-only-hash');
    const session = await service.issueNewFamily(userId, 'test-only-hash');
    await expect(service.revokeByRawToken(session.refreshToken)).resolves.toEqual({ userId, familyId: session.familyId });
    expect(await activeFamilies()).toEqual(new Set([other.familyId]));
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

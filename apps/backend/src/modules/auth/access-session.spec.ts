import { assertActiveSession } from './access-session';
import { OptionalJwtAuthGuard } from './guards/optional-jwt-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

const payload = { sub: 'u1', sid: 'family1', role: 'CLIENT' as const, email: 'test@example.com' };
describe('access sessions', () => {
  it('requires active family and active user, but not an unrotated parent token', async () => {
    const prisma = { refreshToken: { findFirst: jest.fn().mockResolvedValue({ id: 'token1' }) } };
    await assertActiveSession(prisma as never, payload);
    expect(prisma.refreshToken.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ userId: 'u1', familyId: 'family1', revokedAt: null, user: { deletedAt: null, blockedAt: null } }) }));
    expect(prisma.refreshToken.findFirst.mock.calls[0][0].where).not.toHaveProperty('replacedAt');
  });

  it('rejects a legacy JWT without session identity, and revoked/expired/missing families', async () => {
    const prisma = { refreshToken: { findFirst: jest.fn().mockResolvedValue(null) } };
    await expect(assertActiveSession(prisma as never, { ...payload, sid: undefined })).rejects.toMatchObject({ status: 401 });
    expect(prisma.refreshToken.findFirst).not.toHaveBeenCalled();
    await expect(assertActiveSession(prisma as never, payload)).rejects.toMatchObject({ status: 401 });
  });

  it('REST rejects revoked sessions and optional auth removes identity instead of trusting JWT', async () => {
    const jwt = { verifyAsync: jest.fn().mockResolvedValue(payload) };
    const config = { getOrThrow: () => 'secret' };
    const prisma = { refreshToken: { findFirst: jest.fn().mockResolvedValue(null) } };
    const request = { cookies: { mm_access: 'token' }, user: undefined };
    const context = { getHandler: () => null, getClass: () => null, switchToHttp: () => ({ getRequest: () => request }) };
    const required = new JwtAuthGuard(jwt as never, config as never, { getAllAndOverride: () => false } as never, prisma as never);
    await expect(required.canActivate(context as never)).rejects.toMatchObject({ status: 401 });
    const optional = new OptionalJwtAuthGuard(jwt as never, config as never, prisma as never);
    await expect(optional.canActivate(context as never)).resolves.toBe(true);
    expect(request.user).toBeUndefined();
  });
});

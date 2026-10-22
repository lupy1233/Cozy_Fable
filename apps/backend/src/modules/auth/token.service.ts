import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { ERROR_CODES } from '@marketplace/shared';
import type { Prisma, User } from '@prisma/client';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { runTx } from '../../infra/prisma/tx';
import { ACCESS_TOKEN_TTL_SEC, REFRESH_TOKEN_TTL_SEC, ROTATION_GRACE_MS, type AccessTokenPayload } from './auth.constants';

@Injectable()
export class TokenService {
  constructor(private readonly prisma: PrismaService, private readonly jwt: JwtService, private readonly config: ConfigService) {}

  private hash(raw: string): string { return createHash('sha256').update(raw).digest('hex'); }

  private invalid(): UnauthorizedException {
    return new UnauthorizedException({ code: ERROR_CODES.REFRESH_TOKEN_INVALID, message: 'Session no longer valid' });
  }

  async signAccessToken(user: Pick<User, 'id' | 'role' | 'email'>, familyId: string): Promise<string> {
    const payload: AccessTokenPayload = { sub: user.id, role: user.role, email: user.email, sid: familyId };
    return this.jwt.signAsync(payload, { secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'), expiresIn: ACCESS_TOKEN_TTL_SEC });
  }

  // Toate modificarile familiei serializeaza pe acelasi rand de user.
  private async lockUser(tx: Prisma.TransactionClient, userId: string): Promise<void> {
    await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`;
  }

  async issueNewFamily(userId: string, expectedPasswordHash: string): Promise<{ refreshToken: string; familyId: string }> {
    return runTx(this.prisma, 'write', async (tx) => {
      await this.lockUser(tx, userId);
      const user = await tx.user.findUnique({ where: { id: userId } });
      // Un login inceput inaintea resetarii nu poate reinvia parola veche.
      if (!user || user.deletedAt || user.blockedAt || user.passwordHash !== expectedPasswordHash) throw this.invalid();
      await tx.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
      const refreshToken = randomBytes(32).toString('hex');
      const familyId = randomUUID();
      await tx.refreshToken.create({ data: { userId, familyId, tokenHash: this.hash(refreshToken), expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_SEC * 1000) } });
      return { refreshToken, familyId };
    });
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await runTx(this.prisma, 'write', async (tx) => {
      await this.lockUser(tx, userId);
      await tx.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
    });
  }

  async rotate(rawToken: string): Promise<{ userId: string; refreshToken: string; familyId: string }> {
    const tokenHash = this.hash(rawToken);
    const candidate = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });
    if (!candidate) throw this.invalid();
    const result = await runTx(this.prisma, 'write', async (tx) => {
      await this.lockUser(tx, candidate.userId);
      const now = new Date();
      const existing = await tx.refreshToken.findUnique({ where: { tokenHash }, include: { user: true } });
      if (!existing || existing.revokedAt || existing.expiresAt <= now || existing.user.deletedAt || existing.user.blockedAt) throw this.invalid();
      if (existing.replacedAt && now.getTime() - existing.replacedAt.getTime() > ROTATION_GRACE_MS) {
        await tx.refreshToken.updateMany({ where: { familyId: existing.familyId, revokedAt: null }, data: { revokedAt: now } });
        // Return, nu throw: revocarea trebuie COMMIT inainte de eroare.
        return null;
      }
      if (!existing.replacedAt) await tx.refreshToken.update({ where: { id: existing.id }, data: { replacedAt: now } });
      const refreshToken = randomBytes(32).toString('hex');
      await tx.refreshToken.create({ data: { userId: existing.userId, tokenHash: this.hash(refreshToken), familyId: existing.familyId, rotatedFromId: existing.id, expiresAt: new Date(now.getTime() + REFRESH_TOKEN_TTL_SEC * 1000) } });
      return { userId: existing.userId, refreshToken, familyId: existing.familyId };
    });
    if (!result) throw new UnauthorizedException({ code: ERROR_CODES.REFRESH_TOKEN_REUSED, message: 'Refresh token reuse detected — session revoked' });
    return result;
  }

  async revokeByRawToken(rawToken: string): Promise<string | undefined> {
    const existing = await this.prisma.refreshToken.findUnique({ where: { tokenHash: this.hash(rawToken) } });
    if (!existing) return;
    await runTx(this.prisma, 'write', async (tx) => {
      await this.lockUser(tx, existing.userId);
      await tx.refreshToken.updateMany({ where: { familyId: existing.familyId, revokedAt: null }, data: { revokedAt: new Date() } });
    });
    return existing.userId;
  }
}

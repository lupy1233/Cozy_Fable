import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { ERROR_CODES } from '@marketplace/shared';
import type { Prisma, User } from '@prisma/client';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { runTx } from '../../infra/prisma/tx';
import { ACCESS_TOKEN_TTL_SEC, MAX_ACTIVE_SESSIONS, REFRESH_TOKEN_TTL_SEC, ROTATION_GRACE_MS, type AccessTokenPayload } from './auth.constants';

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

  // f3: cel mult MAX_ACTIVE_SESSIONS familii active. Implicit revoca doar cele mai vechi
  // familii peste limita; `revokeAll` (schimbarea parolei) revoca toate celelalte sesiuni.
  // Intoarce sid-urile revocate, ca socketurile lor sa primeasca auth_expired.
  async issueNewFamily(
    userId: string,
    expectedPasswordHash: string,
    opts: { revokeAll?: boolean } = {},
  ): Promise<{ refreshToken: string; familyId: string; revokedFamilyIds: string[] }> {
    return runTx(this.prisma, 'write', async (tx) => {
      await this.lockUser(tx, userId);
      const user = await tx.user.findUnique({ where: { id: userId } });
      // Un login inceput inaintea resetarii nu poate reinvia parola veche.
      if (!user || user.deletedAt || user.blockedAt || user.passwordHash !== expectedPasswordHash) throw this.invalid();
      const now = new Date();
      const revokedFamilyIds = opts.revokeAll
        ? await this.activeFamilyIds(tx, userId, now)
        : await this.familiesOverLimit(tx, userId, now);
      if (opts.revokeAll) {
        await tx.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: now } });
      } else if (revokedFamilyIds.length > 0) {
        await tx.refreshToken.updateMany({ where: { userId, familyId: { in: revokedFamilyIds }, revokedAt: null }, data: { revokedAt: now } });
      }
      const refreshToken = randomBytes(32).toString('hex');
      const familyId = randomUUID();
      await tx.refreshToken.create({ data: { userId, familyId, tokenHash: this.hash(refreshToken), expiresAt: new Date(now.getTime() + REFRESH_TOKEN_TTL_SEC * 1000) } });
      return { refreshToken, familyId, revokedFamilyIds };
    });
  }

  // Sesiune activa = familie cu cel putin un token nerevocat si neexpirat (ca assertActiveSession).
  private async activeFamilyIds(tx: Prisma.TransactionClient, userId: string, now: Date): Promise<string[]> {
    const rows = await tx.refreshToken.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: now } },
      select: { familyId: true },
      distinct: ['familyId'],
    });
    return rows.map((r) => r.familyId);
  }

  // Cele mai vechi familii (dupa primul token al familiei) care trebuie revocate ca, impreuna
  // cu familia noua, sa ramana cel mult MAX_ACTIVE_SESSIONS. Ruleaza sub blocarea userului.
  private async familiesOverLimit(tx: Prisma.TransactionClient, userId: string, now: Date): Promise<string[]> {
    const active = await this.activeFamilyIds(tx, userId, now);
    const excess = active.length - (MAX_ACTIVE_SESSIONS - 1);
    if (excess <= 0) return [];
    const starts = await tx.refreshToken.groupBy({
      by: ['familyId'],
      where: { userId, familyId: { in: active } },
      _min: { createdAt: true },
    });
    const startOf = new Map(starts.map((s) => [s.familyId, s._min.createdAt?.getTime() ?? 0]));
    return [...active]
      .sort((a, b) => (startOf.get(a) ?? 0) - (startOf.get(b) ?? 0) || a.localeCompare(b))
      .slice(0, excess);
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

  async revokeByRawToken(rawToken: string): Promise<{ userId: string; familyId: string } | undefined> {
    const existing = await this.prisma.refreshToken.findUnique({ where: { tokenHash: this.hash(rawToken) } });
    if (!existing) return;
    await runTx(this.prisma, 'write', async (tx) => {
      await this.lockUser(tx, existing.userId);
      await tx.refreshToken.updateMany({ where: { familyId: existing.familyId, revokedAt: null }, data: { revokedAt: new Date() } });
    });
    return { userId: existing.userId, familyId: existing.familyId };
  }
}

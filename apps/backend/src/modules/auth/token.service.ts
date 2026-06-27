import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { ERROR_CODES } from '@marketplace/shared';
import type { User } from '@prisma/client';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { PrismaService } from '../../infra/prisma/prisma.service';
import {
  ACCESS_TOKEN_TTL_SEC,
  REFRESH_TOKEN_TTL_SEC,
  ROTATION_GRACE_MS,
  type AccessTokenPayload,
} from './auth.constants';

export interface TokenPair {
  accessToken: string;
  refreshToken: string; // raw — pleaca doar in cookie httpOnly
}

// Refresh token rotation cu family + grace 30s (invarianta 3.13).
// In DB se stocheaza DOAR hash-ul (sha256) tokenului.
@Injectable()
export class TokenService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  private hash(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }

  async signAccessToken(user: Pick<User, 'id' | 'role' | 'email'>): Promise<string> {
    const payload: AccessTokenPayload = { sub: user.id, role: user.role, email: user.email };
    return this.jwt.signAsync(payload, {
      secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      expiresIn: ACCESS_TOKEN_TTL_SEC,
    });
  }

  // Emite familie noua de refresh tokens (login) — o singura sesiune activa:
  // apelantul revoca intai toate tokenurile active ale userului.
  async issueNewFamily(userId: string): Promise<string> {
    const raw = randomBytes(32).toString('hex');
    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: this.hash(raw),
        familyId: randomUUID(),
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_SEC * 1000),
      },
    });
    return raw;
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  // Rotation: tokenul vechi e marcat replaced si se emite unul nou in aceeasi familie.
  // Reuse in interiorul grace-ului de 30s (race multi-tab) → emite token nou fara penalizare.
  // Reuse DUPA grace → detectie furt → revoca intreaga familie.
  // ATENTIE: revocarea familiei NU se face in $transaction — un throw in callback
  // ar face rollback si ar anula chiar revocarea (detectia de furt trebuie sa persiste).
  async rotate(rawToken: string): Promise<{ userId: string; refreshToken: string }> {
    const tokenHash = this.hash(rawToken);
    const now = new Date();

    const existing = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });

    if (!existing || existing.revokedAt || existing.expiresAt < now) {
      throw new UnauthorizedException({
        code: ERROR_CODES.REFRESH_TOKEN_INVALID,
        message: 'Refresh token invalid or expired',
      });
    }

    if (existing.replacedAt) {
      const withinGrace = now.getTime() - existing.replacedAt.getTime() <= ROTATION_GRACE_MS;
      if (!withinGrace) {
        // reuse dupa grace → revoca toata familia (detectie furt) — persistat inainte de throw
        await this.prisma.refreshToken.updateMany({
          where: { familyId: existing.familyId, revokedAt: null },
          data: { revokedAt: now },
        });
        throw new UnauthorizedException({
          code: ERROR_CODES.REFRESH_TOKEN_REUSED,
          message: 'Refresh token reuse detected — session revoked',
        });
      }
      // in grace (race multi-tab): emite token nou fara a re-marca replaced
    } else {
      // claim atomic al rotatiei; daca alt request a rotit intre timp, suntem in grace prin definitie
      await this.prisma.refreshToken.updateMany({
        where: { id: existing.id, replacedAt: null },
        data: { replacedAt: now },
      });
    }

    const raw = randomBytes(32).toString('hex');
    await this.prisma.refreshToken.create({
      data: {
        userId: existing.userId,
        tokenHash: this.hash(raw),
        familyId: existing.familyId,
        rotatedFromId: existing.id,
        expiresAt: new Date(now.getTime() + REFRESH_TOKEN_TTL_SEC * 1000),
      },
    });

    return { userId: existing.userId, refreshToken: raw };
  }

  async revokeByRawToken(rawToken: string): Promise<void> {
    const existing = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: this.hash(rawToken) },
    });
    if (!existing) return;
    // logout revoca intreaga familie a sesiunii curente
    await this.prisma.refreshToken.updateMany({
      where: { familyId: existing.familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}

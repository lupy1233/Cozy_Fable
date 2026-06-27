import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ERROR_CODES } from '@marketplace/shared';
import { authenticator } from 'otplib';
import { PrismaService } from '../../infra/prisma/prisma.service';

// 2FA TOTP (otplib) — implementat arhitectural, INACTIV in MVP (invarianta 3.13).
// Rutele exista dar sunt blocate cat timp TWO_FACTOR_FEATURE_ENABLED=false.
@Injectable()
export class TwoFactorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private assertFeatureOn(): void {
    if (!this.config.get<boolean>('TWO_FACTOR_FEATURE_ENABLED')) {
      throw new ForbiddenException({
        code: ERROR_CODES.FORBIDDEN,
        message: '2FA feature is disabled in MVP',
      });
    }
  }

  get isFeatureEnabled(): boolean {
    return this.config.get<boolean>('TWO_FACTOR_FEATURE_ENABLED') === true;
  }

  // Genereaza secret + otpauth URI (QR generat in frontend)
  async setup(userId: string): Promise<{ secret: string; otpauthUrl: string }> {
    this.assertFeatureOn();
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const secret = authenticator.generateSecret();
    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorSecret: secret, twoFactorEnabled: false },
    });
    return {
      secret,
      otpauthUrl: authenticator.keyuri(user.email, 'Marketplace Mobilier', secret),
    };
  }

  // Confirma setup-ul cu un cod valid → activeaza 2FA pe cont
  async verifyAndEnable(userId: string, code: string): Promise<void> {
    this.assertFeatureOn();
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.twoFactorSecret || !authenticator.verify({ token: code, secret: user.twoFactorSecret })) {
      throw new UnauthorizedException({
        code: ERROR_CODES.TWO_FACTOR_INVALID_CODE,
        message: 'Invalid TOTP code',
      });
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorEnabled: true },
    });
  }

  verifyLoginCode(secret: string, code: string): boolean {
    return authenticator.verify({ token: code, secret });
  }
}

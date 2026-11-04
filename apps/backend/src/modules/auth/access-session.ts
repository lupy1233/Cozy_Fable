import { UnauthorizedException } from '@nestjs/common';
import { ERROR_CODES } from '@marketplace/shared';
import type { PrismaService } from '../../infra/prisma/prisma.service';
import type { AccessTokenPayload } from './auth.constants';

// Aceeasi verificare pentru REST si socket; fara cache care ar intarzia revocarea.
export async function assertActiveSession(prisma: PrismaService, payload: AccessTokenPayload): Promise<void> {
  if (typeof payload.sid !== 'string' || !payload.sid || typeof payload.sub !== 'string') {
    throw new UnauthorizedException({ code: ERROR_CODES.UNAUTHORIZED, message: 'Session renewal required' });
  }
  const active = await prisma.refreshToken.findFirst({
    where: {
      userId: payload.sub, familyId: payload.sid, revokedAt: null,
      expiresAt: { gt: new Date() }, user: { deletedAt: null, blockedAt: null },
    },
    select: { id: true },
  });
  if (!active) throw new UnauthorizedException({ code: ERROR_CODES.UNAUTHORIZED, message: 'Session no longer valid' });
}

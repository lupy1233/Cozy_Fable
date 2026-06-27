import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';
import { PrismaService } from '../../infra/prisma/prisma.service';

export interface AuditEntry {
  userId?: string | null;
  role?: string | null;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  before?: unknown;
  after?: unknown;
}

// 3.9 — scriere audit log. IP hash-uit cu salt din env (niciodata IP brut, parole, token-uri
// sau continut mesaje). audit_logs e append-only (trigger DB).
@Injectable()
export class AuditService {
  private readonly salt: string;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    // Salt validat la boot (config.schema, min 8) — niciun fallback hardcodat (3.13).
    this.salt = config.getOrThrow<string>('IP_HASH_SALT');
  }

  private hashIp(ip?: string | null): string | null {
    if (!ip) return null;
    return createHmac('sha256', this.salt).update(ip).digest('hex');
  }

  async log(entry: AuditEntry): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        userId: entry.userId ?? null,
        role: entry.role ?? null,
        action: entry.action,
        entityType: entry.entityType ?? null,
        entityId: entry.entityId ?? null,
        ipHash: this.hashIp(entry.ip),
        userAgent: entry.userAgent ?? null,
        before: (entry.before ?? undefined) as never,
        after: (entry.after ?? undefined) as never,
      },
    });
  }
}

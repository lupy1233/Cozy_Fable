import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Observable } from 'rxjs';
import { concatMap } from 'rxjs/operators';
import { clientIpOf } from '../../common/http/client-ip';
import type { AccessTokenPayload } from '../auth/auth.constants';
import { AUDIT_ACTION_KEY } from './audit.decorator';
import { AuditService } from './audit.service';

// Loghează acțiunile marcate cu @Audit DOAR la succes (după handler). Captează metadata:
// cine (userId/role), cand, ce (action/entityId); AuditService permite doar metadatele declarate.
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly audit: AuditService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const meta = this.reflector.get<{ action: string; entityType?: string } | undefined>(
      AUDIT_ACTION_KEY,
      context.getHandler(),
    );
    if (!meta) return next.handle();

    const req = context.switchToHttp().getRequest<{
      user?: AccessTokenPayload;
      params?: Record<string, string>;
      ip?: string;
      clientIp?: string | null;
      headers: Record<string, string | undefined>;
    }>();

    // concatMap (nu tap): asteptam scrierea audit-ului inainte de a raspunde (audit garantat, 3.9).
    return next.handle().pipe(
      concatMap(async (result) => {
        const identity = result as { id?: string; order?: { id?: string } } | undefined;
        const entityId = identity?.id ?? identity?.order?.id ?? req.params?.id ?? null;
        await this.audit.log({
          userId: req.user?.sub ?? null,
          role: req.user?.role ?? null,
          action: meta.action,
          entityType: meta.entityType ?? null,
          entityId,
          // E-admin-platform-5: IP-ul real al clientului (nu adresa proxy-ului); hash-uit in AuditService
          ip: clientIpOf(req),
          userAgent: req.headers['user-agent'] ?? null,
          after: result ?? null,
        });
        return result;
      }),
    );
  }
}

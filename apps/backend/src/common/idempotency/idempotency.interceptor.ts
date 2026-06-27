import {
  CallHandler,
  ConflictException,
  ExecutionContext,
  HttpException,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ERROR_CODES } from '@marketplace/shared';
import { createHash } from 'crypto';
import type { Request } from 'express';
import { from, Observable, of } from 'rxjs';
import { switchMap, tap } from 'rxjs/operators';
import type { AccessTokenPayload } from '../../modules/auth/auth.constants';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { IDEMPOTENT_KEY } from './idempotent.decorator';

const DEDUP_TTL_MS = 24 * 60 * 60 * 1000; // 24h (invarianta 3.2)
const HEADER = 'idempotency-key';

// Invarianta 3.2: pe POST critice (claim/accept/quote/webhook/credits) header
// Idempotency-Key (UUID v4). Match key+endpoint+hash → raspuns cached;
// key+endpoint dar hash diferit → 409 IDEMPOTENCY_CONFLICT.
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const isIdempotent = this.reflector.getAllAndOverride<boolean>(IDEMPOTENT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!isIdempotent) return next.handle();

    const req = context.switchToHttp().getRequest<Request & { user?: AccessTokenPayload }>();
    const key = req.headers[HEADER];
    if (typeof key !== 'string' || key.trim().length === 0) {
      throw new HttpException(
        { code: ERROR_CODES.VALIDATION_ERROR, message: 'Missing Idempotency-Key header' },
        400,
      );
    }

    const userId = req.user?.sub ?? 'anonymous';
    const endpoint = `${req.method} ${req.route?.path ?? req.path}`;
    const requestHash = createHash('sha256')
      .update(JSON.stringify({ body: req.body ?? {}, userId }))
      .digest('hex');

    return from(this.prisma.idempotencyKey.findUnique({ where: { key_endpoint: { key, endpoint } } })).pipe(
      switchMap((existing) => {
        if (existing) {
          if (existing.expiresAt.getTime() < Date.now()) {
            // expirat → trateaza ca o cheie noua (sterge si continua)
            return from(
              this.prisma.idempotencyKey.delete({ where: { id: existing.id } }),
            ).pipe(switchMap(() => this.execute(next, key, userId, endpoint, requestHash, context)));
          }
          if (existing.requestHash !== requestHash) {
            throw new ConflictException({
              code: ERROR_CODES.IDEMPOTENCY_CONFLICT,
              message: 'Idempotency-Key reused with a different payload',
            });
          }
          return of(existing.responseBody);
        }
        return this.execute(next, key, userId, endpoint, requestHash, context);
      }),
    );
  }

  private execute(
    next: CallHandler,
    key: string,
    userId: string,
    endpoint: string,
    requestHash: string,
    context: ExecutionContext,
  ): Observable<unknown> {
    return next.handle().pipe(
      tap((response) => {
        const status = context.switchToHttp().getResponse<{ statusCode: number }>().statusCode;
        // best-effort persist; nu blocheaza raspunsul daca scrierea esueaza
        void this.prisma.idempotencyKey
          .create({
            data: {
              key,
              userId,
              endpoint,
              requestHash,
              responseStatus: status,
              responseBody: (response ?? {}) as object,
              expiresAt: new Date(Date.now() + DEDUP_TTL_MS),
            },
          })
          .catch(() => undefined);
      }),
    );
  }
}

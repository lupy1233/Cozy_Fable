import { CallHandler, ConflictException, ExecutionContext, HttpException, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ERROR_CODES } from '@marketplace/shared';
import { Prisma } from '@prisma/client';
import { createHash } from 'crypto';
import type { Request, Response } from 'express';
import { from, lastValueFrom, Observable } from 'rxjs';
import type { AccessTokenPayload } from '../../modules/auth/auth.constants';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { IDEMPOTENT_KEY } from './idempotent.decorator';
import { withIdempotentOperation } from './idempotent-operation';

const DEDUP_TTL_MS = 24 * 60 * 60 * 1000;
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Ordinea proprietatilor JSON nu schimba identitatea cererii.
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, canonical(v)]));
  return value;
}

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector, private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const mode = this.reflector.getAllAndOverride<boolean | { transactional: boolean }>(IDEMPOTENT_KEY, [context.getHandler(), context.getClass()]);
    if (!mode) return next.handle();
    const req = context.switchToHttp().getRequest<Request & { user?: AccessTokenPayload }>();
    const key = req.headers['idempotency-key'];
    if (typeof key !== 'string' || !UUID_V4.test(key)) throw new HttpException({ code: ERROR_CODES.VALIDATION_ERROR, message: 'Idempotency-Key must be a UUID v4' }, 400);
    return from(this.execute(context, next, req, key.toLowerCase(), typeof mode === 'object' && mode.transactional));
  }

  private conflict(message: string): ConflictException {
    return new ConflictException({ code: ERROR_CODES.IDEMPOTENCY_CONFLICT, message });
  }

  private async execute(context: ExecutionContext, next: CallHandler, req: Request & { user?: AccessTokenPayload }, key: string, transactional: boolean): Promise<unknown> {
    const userId = req.user?.sub ?? 'anonymous';
    // Include ID-ul concret: /quotes/A/accept si /quotes/B/accept nu sunt aceeasi actiune.
    const endpoint = `${req.method} ${(req.originalUrl || req.path).split('?')[0]}`;
    const requestHash = createHash('sha256').update(JSON.stringify(canonical({ body: req.body ?? {}, query: req.query ?? {}, userId }))).digest('hex');
    const identity = { key, endpoint };
    const legacyEndpoint = `${req.method} ${req.route?.path ?? req.path}`;
    if (legacyEndpoint !== endpoint) {
      const legacy = await this.prisma.idempotencyKey.findUnique({ where: { key_endpoint: { key, endpoint: legacyEndpoint } } });
      // Receipt vechi nu continea parametrii rutei: nu putem deduce sigur ce resursa a modificat.
      if (legacy && legacy.expiresAt.getTime() > Date.now()) throw this.conflict('Legacy operation receipt requires verification before retry');
    }
    // Numai rezultatele FINALIZATE expira. Un rezultat necunoscut nu poate fi relansat automat.
    await this.prisma.idempotencyKey.deleteMany({ where: { ...identity, responseStatus: { gt: 0 }, expiresAt: { lte: new Date() } } });
    let receipt;
    try {
      receipt = await this.prisma.idempotencyKey.create({ data: {
        ...identity, userId, requestHash, responseStatus: 0, responseBody: {},
        expiresAt: new Date('9999-12-31T00:00:00.000Z'),
      } });
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') throw error;
      const existing = await this.prisma.idempotencyKey.findUnique({ where: { key_endpoint: identity } });
      if (!existing || existing.requestHash !== requestHash || existing.userId !== userId) throw this.conflict('Idempotency-Key reused with a different request');
      if (existing.responseStatus === 0) {
        if (!transactional) throw this.conflict('Operation in progress or outcome awaiting verification; do not retry with a new key');
        receipt = existing;
      } else return this.replay(context, existing);
    }

    let result: unknown;
    let status: number;
    let failure: HttpException | undefined;
    try {
      result = await withIdempotentOperation({ receiptId: receipt.id, responseStatus: context.switchToHttp().getResponse<Response>().statusCode, transactional }, () => lastValueFrom(next.handle()));
      status = context.switchToHttp().getResponse<Response>().statusCode;
    } catch (error) {
      if (transactional) {
        const committed = await this.prisma.idempotencyKey.findUnique({ where: { id: receipt.id } });
        if (committed && committed.responseStatus > 0) return this.replay(context, committed);
      }
      // Un 5xx poate urma unui commit. Pastram rezervarea pana la reconciliere explicita.
      if (!(error instanceof HttpException) || error.getStatus() >= 500) throw error;
      result = error.getResponse();
      status = error.getStatus();
      failure = error;
    }
    if (transactional) {
      const committed = await this.prisma.idempotencyKey.findUnique({ where: { id: receipt.id } });
      if (committed && committed.responseStatus > 0) return this.replay(context, committed);
    }
    const data = {
      responseStatus: status,
      responseBody: result == null ? Prisma.JsonNull : JSON.parse(JSON.stringify(result)) as Prisma.InputJsonValue,
      expiresAt: new Date(Date.now() + DEDUP_TTL_MS),
    };
    if (transactional) {
      // O validare concurenta nu poate suprascrie un rezultat comis intre read si write.
      const changed = await this.prisma.idempotencyKey.updateMany({ where: { id: receipt.id, responseStatus: 0 }, data });
      if (!changed.count) {
        const committed = await this.prisma.idempotencyKey.findUniqueOrThrow({ where: { id: receipt.id } });
        return this.replay(context, committed);
      }
    } else await this.prisma.idempotencyKey.update({ where: { id: receipt.id }, data });
    if (failure) throw failure;
    return result;
  }

  private replay(context: ExecutionContext, receipt: { responseStatus: number; responseBody: Prisma.JsonValue }): unknown {
    if (receipt.responseStatus >= 400) throw new HttpException(receipt.responseBody as object, receipt.responseStatus);
    context.switchToHttp().getResponse<Response>().status(receipt.responseStatus);
    return receipt.responseBody;
  }
}

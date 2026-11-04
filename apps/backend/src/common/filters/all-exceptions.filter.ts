import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ERROR_CODES, type ApiErrorBody, type ErrorCode } from '@marketplace/shared';
import { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';
import { safeErrorSummary, topStackFrame } from '../logging/safe-error';
import { captureServerException } from '../../infra/monitoring/error-tracking';

// E-company-2: serialization failure venit dintr-un $queryRaw (FOR UPDATE) = P2010 cu SQLSTATE
// 40001/40P01 — aceeasi clasa ca P2034.
function isRawSerializationFailure(e: Prisma.PrismaClientKnownRequestError): boolean {
  const sqlState = (e.meta as { code?: unknown } | undefined)?.code;
  return e.code === 'P2010' && (sqlState === '40001' || sqlState === '40P01');
}

// E-admin-platform-54: erori tranzitorii de baza de date → 503 DATABASE_BUSY reincercabil.
//  P2028 = tranzactie interactiva peste timeout / nu a putut porni; P2024 = pool de conexiuni epuizat;
//  P1001 = baza de date inaccesibila (vine ca PrismaClientInitializationError, campul errorCode);
//  P1017 = serverul a inchis conexiunea.
const DB_BUSY_CODES = new Set(['P2028', 'P2024', 'P1001', 'P1017']);

function dbBusyCode(e: unknown): string | null {
  if (e instanceof Prisma.PrismaClientKnownRequestError && DB_BUSY_CODES.has(e.code)) return e.code;
  if (e instanceof Prisma.PrismaClientInitializationError && e.errorCode && DB_BUSY_CODES.has(e.errorCode)) {
    return e.errorCode;
  }
  return null;
}

// Format unic de eroare (invarianta 3.10):
// { error: { code, message, details, timestamp, traceId } }
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request & { id?: string }>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code: ErrorCode = ERROR_CODES.INTERNAL_ERROR;
    let message = 'Internal server error';
    let details: unknown;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') {
        message = body;
      } else if (typeof body === 'object' && body !== null) {
        const b = body as Record<string, unknown>;
        // ValidationPipe pune mesajele in `message` (array)
        if (Array.isArray(b.message)) {
          code = ERROR_CODES.VALIDATION_ERROR;
          message = 'Validation failed';
          details = b.message;
        } else {
          message = (b.message as string) ?? message;
          if (typeof b.code === 'string') code = b.code as ErrorCode;
          details = b.details;
        }
      }
      if (code === ERROR_CODES.INTERNAL_ERROR) {
        // mapare implicita pe statusuri standard cand exceptia nu aduce un cod de domeniu
        if (status === HttpStatus.UNAUTHORIZED) code = ERROR_CODES.UNAUTHORIZED;
        else if (status === HttpStatus.FORBIDDEN) code = ERROR_CODES.FORBIDDEN;
        else if (status === HttpStatus.NOT_FOUND) code = ERROR_CODES.NOT_FOUND;
        else if (status === HttpStatus.BAD_REQUEST) code = ERROR_CODES.VALIDATION_ERROR;
        else if (status === HttpStatus.TOO_MANY_REQUESTS) code = ERROR_CODES.RATE_LIMITED;
      }
    } else if (
      exception instanceof Prisma.PrismaClientKnownRequestError &&
      (exception.code === 'P2034' || isRawSerializationFailure(exception))
    ) {
      // serialization failure / deadlock sub Serializable (3.1) care a scapat de retry-ul
      // din serviciu → 409 reincercabil, nu 500 (L0-B).
      status = HttpStatus.CONFLICT;
      code = ERROR_CODES.CONCURRENT_MODIFICATION;
      message = 'Concurrent modification, please retry';
      this.logger.warn(`${exception.code} serialization failure on ${req.method}`);
    } else if (dbBusyCode(exception)) {
      // E-company-2 / E-admin-platform-54: DB lent sau inaccesibil (cross-region, pool plin,
      // conexiune inchisa), nu o eroare de business → 503 reincercabil. Chitanta idempotenta
      // tranzactionala ramane la 0 (nimic comis) → un retry cu aceeasi cheie e sigur.
      // In tracker ca warning (semnal operational), separat de bug-urile reale.
      const dbCode = dbBusyCode(exception);
      status = HttpStatus.SERVICE_UNAVAILABLE;
      code = ERROR_CODES.DATABASE_BUSY;
      message = 'Database busy, please retry';
      res.setHeader('Retry-After', '2');
      const route = this.routeOf(req);
      const traceId = req.id ?? 'unknown';
      this.logger.warn(`${dbCode} database busy route=${route} traceId=${traceId}`);
      try {
        captureServerException(exception, { traceId, route }, 'warning');
      } catch {
        // trackerul nu are voie sa strice raspunsul de eroare
      }
    } else if (
      exception instanceof Prisma.PrismaClientKnownRequestError &&
      exception.code === 'P2002'
    ) {
      // E-company-2: violare de unicitate scapata din serviciu (index partial = plasa la curse)
      // → 409 reincercabil. Se logheaza DOAR numele constrangerii, niciodata valorile.
      status = HttpStatus.CONFLICT;
      code = ERROR_CODES.CONCURRENT_MODIFICATION;
      message = 'Concurrent modification, please retry';
      const rawTarget = exception.meta?.target;
      const target = Array.isArray(rawTarget)
        ? rawTarget.join(',')
        : typeof rawTarget === 'string'
          ? rawTarget
          : '';
      this.logger.warn(`P2002 unique violation target=${target}`);
    } else {
      // E-admin-platform-8: ruta (pattern, nu URL brut) + primul cadru din aplicatie; trimis si in tracker
      const route = this.routeOf(req);
      const traceId = req.id ?? 'unknown';
      this.logger.error(
        `${safeErrorSummary(exception)} route=${route} frame=${topStackFrame(exception)} traceId=${traceId}`,
      );
      try {
        captureServerException(exception, { traceId, route });
      } catch {
        // trackerul nu are voie sa strice raspunsul de eroare
      }
    }

    const body: ApiErrorBody = {
      error: {
        code,
        message,
        details,
        timestamp: new Date().toISOString(),
        traceId: req.id ?? 'unknown',
      },
    };
    res.status(status).json(body);
  }

  private routeOf(req: Request): string {
    const routePath = (req as Request & { route?: { path?: unknown } }).route?.path;
    return typeof routePath === 'string' ? routePath : 'unmatched';
  }
}

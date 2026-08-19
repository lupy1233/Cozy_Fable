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
      exception.code === 'P2034'
    ) {
      // serialization failure / deadlock sub Serializable (3.1) care a scapat de retry-ul
      // din serviciu → 409 reincercabil, nu 500 (L0-B).
      status = HttpStatus.CONFLICT;
      code = ERROR_CODES.CONCURRENT_MODIFICATION;
      message = 'Concurrent modification, please retry';
      this.logger.warn(`P2034 serialization failure on ${req.method} ${req.url}`);
    } else {
      this.logger.error(exception instanceof Error ? exception.stack : String(exception));
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
}

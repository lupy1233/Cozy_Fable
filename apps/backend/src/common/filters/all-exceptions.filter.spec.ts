import { Logger, NotFoundException, type ArgumentsHost } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { captureServerException } from '../../infra/monitoring/error-tracking';
import { AllExceptionsFilter } from './all-exceptions.filter';

jest.mock('../../infra/monitoring/error-tracking', () => ({
  captureServerException: jest.fn(),
}));

const TRACE_ID = '00000000-0000-4000-8000-000000000001';

function host(req: Record<string, unknown>) {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const setHeader = jest.fn();
  const res = { status, setHeader };
  const argumentsHost = {
    switchToHttp: () => ({ getResponse: () => res, getRequest: () => req }),
  } as unknown as ArgumentsHost;
  return { argumentsHost, status, json, setHeader };
}

describe('AllExceptionsFilter (E-admin-platform-8)', () => {
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    (captureServerException as jest.Mock).mockClear();
  });
  afterEach(() => errorSpy.mockRestore());

  it('logs kind, route pattern and top frame without the raw message and captures the error', () => {
    const { argumentsHost, status, json } = host({
      id: TRACE_ID,
      method: 'GET',
      route: { path: '/api/v1/requests/:id' },
    });
    const exception = new TypeError('private@example.invalid');

    new AllExceptionsFilter().catch(exception, argumentsHost);

    expect(errorSpy).toHaveBeenCalledTimes(1);
    const line = String(errorSpy.mock.calls[0][0]);
    expect(line).toContain('kind=TypeError');
    expect(line).toContain('route=/api/v1/requests/:id');
    expect(line).toContain('frame=');
    expect(line).toContain(`traceId=${TRACE_ID}`);
    expect(line).not.toContain('private@');

    expect(captureServerException).toHaveBeenCalledWith(exception, {
      traceId: TRACE_ID,
      route: '/api/v1/requests/:id',
    });
    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({
      error: expect.objectContaining({ code: 'INTERNAL_ERROR', traceId: TRACE_ID }),
    });
  });

  it('uses route=unmatched when no route matched and survives a throwing tracker', () => {
    (captureServerException as jest.Mock).mockImplementationOnce(() => {
      throw new Error('tracker down');
    });
    const { argumentsHost, status } = host({ method: 'GET' });

    new AllExceptionsFilter().catch(new Error('boom'), argumentsHost);

    expect(String(errorSpy.mock.calls[0][0])).toContain('route=unmatched');
    expect(status).toHaveBeenCalledWith(500);
  });

  it('does not capture HttpExceptions', () => {
    const { argumentsHost, status } = host({ id: TRACE_ID, method: 'GET' });

    new AllExceptionsFilter().catch(new NotFoundException(), argumentsHost);

    expect(captureServerException).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(404);
  });

  describe('Prisma known errors (E-company-2)', () => {
    let warnSpy: jest.SpyInstance;
    const prismaError = (code: string, meta?: Record<string, unknown>) =>
      new Prisma.PrismaClientKnownRequestError('secret SQL private@example.invalid', {
        code,
        clientVersion: 'test',
        meta,
      });

    beforeEach(() => {
      warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    });
    afterEach(() => warnSpy.mockRestore());

    const expectDbBusy = (code: string, exception: unknown) => {
      const { argumentsHost, status, json, setHeader } = host({
        id: TRACE_ID,
        method: 'POST',
        route: { path: '/api/v1/quotes' },
      });

      new AllExceptionsFilter().catch(exception, argumentsHost);

      expect(status).toHaveBeenCalledWith(503);
      expect(setHeader).toHaveBeenCalledWith('Retry-After', '2');
      expect(json).toHaveBeenCalledWith({
        error: expect.objectContaining({ code: 'DATABASE_BUSY', traceId: TRACE_ID }),
      });
      const line = String(warnSpy.mock.calls[0][0]);
      expect(line).toContain(`${code} database busy route=/api/v1/quotes traceId=${TRACE_ID}`);
      expect(line).not.toContain('private@');
      expect(errorSpy).not.toHaveBeenCalled();
      // E-admin-platform-54: semnal operational → nivel warning in tracker, nu error
      expect(captureServerException).toHaveBeenCalledWith(
        exception,
        { traceId: TRACE_ID, route: '/api/v1/quotes' },
        'warning',
      );
    };

    it.each(['P2028', 'P2024', 'P1017'])(
      '%s → 503 DATABASE_BUSY with Retry-After, warning, no raw message',
      (code) => expectDbBusy(code, prismaError(code)),
    );

    it('P1001 (database unreachable, InitializationError) → 503 DATABASE_BUSY', () => {
      const exception = new Prisma.PrismaClientInitializationError(
        'cannot reach private@example.invalid',
        '5.19.1',
        'P1001',
      );
      expectDbBusy('P1001', exception);
    });

    it('InitializationError without a busy code stays 500 INTERNAL_ERROR', () => {
      const { argumentsHost, status } = host({ id: TRACE_ID, method: 'GET' });

      new AllExceptionsFilter().catch(
        new Prisma.PrismaClientInitializationError('bad schema', '5.19.1', 'P1012'),
        argumentsHost,
      );

      expect(status).toHaveBeenCalledWith(500);
      expect(captureServerException).toHaveBeenCalledWith(expect.anything(), expect.anything());
    });

    it('P2002 → 409 CONCURRENT_MODIFICATION, logs only the constraint name', () => {
      const { argumentsHost, status, json, setHeader } = host({ id: TRACE_ID, method: 'POST' });

      new AllExceptionsFilter().catch(
        prismaError('P2002', { modelName: 'Quote', target: ['claim_slot_id'] }),
        argumentsHost,
      );

      expect(status).toHaveBeenCalledWith(409);
      expect(setHeader).not.toHaveBeenCalled();
      expect(json).toHaveBeenCalledWith({
        error: expect.objectContaining({ code: 'CONCURRENT_MODIFICATION' }),
      });
      const line = String(warnSpy.mock.calls[0][0]);
      expect(line).toBe('P2002 unique violation target=claim_slot_id');
      expect(captureServerException).not.toHaveBeenCalled();
    });

    it('raw query P2010 / SQLSTATE 40001 → 409 CONCURRENT_MODIFICATION', () => {
      const { argumentsHost, status, json } = host({ id: TRACE_ID, method: 'POST' });

      new AllExceptionsFilter().catch(prismaError('P2010', { code: '40001' }), argumentsHost);

      expect(status).toHaveBeenCalledWith(409);
      expect(json).toHaveBeenCalledWith({
        error: expect.objectContaining({ code: 'CONCURRENT_MODIFICATION' }),
      });
    });

    it('P2034 still → 409 CONCURRENT_MODIFICATION', () => {
      const { argumentsHost, status, json } = host({ id: TRACE_ID, method: 'POST' });

      new AllExceptionsFilter().catch(prismaError('P2034'), argumentsHost);

      expect(status).toHaveBeenCalledWith(409);
      expect(json).toHaveBeenCalledWith({
        error: expect.objectContaining({ code: 'CONCURRENT_MODIFICATION' }),
      });
      expect(captureServerException).not.toHaveBeenCalled();
    });
  });
});

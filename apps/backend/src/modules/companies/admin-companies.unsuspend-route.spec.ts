import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import type { AddressInfo } from 'node:net';
import { AllExceptionsFilter } from '../../common/filters/all-exceptions.filter';
import { AuditInterceptor } from '../audit/audit.interceptor';
import { AuditService } from '../audit/audit.service';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AdminCompaniesController } from './admin-companies.controller';
import { CompaniesService } from './companies.service';

// Etapa 12 (k2, teste cerute la revizuire): ruta reala POST /admin/companies/:id/unsuspend cu
// aceeasi ValidationPipe + filtru de erori ca main.ts. Fara corp / motiv gol → 400 VALIDATION_ERROR
// si serviciul nu e apelat; alt rol → 403; cu motiv → 200 si intrarea de audit cu motivul.

describe('POST /admin/companies/:id/unsuspend (ruta)', () => {
  let app: INestApplication;
  let base: string;
  const adminUnsuspend = jest.fn();
  const auditLog = jest.fn().mockResolvedValue(undefined);

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AdminCompaniesController],
      providers: [
        { provide: CompaniesService, useValue: { adminUnsuspend } },
        { provide: AuditService, useValue: { log: auditLog } },
        AuditInterceptor,
      ],
    }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    // utilizatorul vine din antetul de test (in aplicatie il pune garda de autentificare)
    app.use((req: { headers: Record<string, string>; user?: unknown }, _res: unknown, next: () => void) => {
      const role = req.headers['x-test-role'];
      if (role) req.user = { sub: 'admin-1', role };
      next();
    });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalFilters(new AllExceptionsFilter());
    app.useGlobalGuards(new RolesGuard(app.get(Reflector)));
    await app.listen(0, '127.0.0.1');
    const { port } = app.getHttpServer().address() as AddressInfo;
    base = `http://127.0.0.1:${port}`;
  });

  afterAll(async () => {
    await app?.close();
  });

  beforeEach(() => {
    adminUnsuspend.mockReset();
    auditLog.mockClear();
  });

  const post = (body: string | undefined, role = 'ADMIN') =>
    fetch(`${base}/admin/companies/c1/unsuspend`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-test-role': role },
      body,
    });

  it.each([
    ['fara corp', undefined],
    ['obiect gol', '{}'],
    ['motiv sub 3 caractere', JSON.stringify({ reason: 'ab' })],
    ['motiv doar din caractere de control', JSON.stringify({ reason: '\u0001\u0001\u0001' })],
  ])('%s → 400 VALIDATION_ERROR, serviciul nu e apelat', async (_label, body) => {
    const res = await post(body);
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
    expect(adminUnsuspend).not.toHaveBeenCalled();
    expect(auditLog).not.toHaveBeenCalled();
  });

  it('alt rol decat ADMIN → 403 FORBIDDEN', async () => {
    const res = await post(JSON.stringify({ reason: 'Motiv valid' }), 'COMPANY_USER');
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ error: { code: 'FORBIDDEN' } });
    expect(adminUnsuspend).not.toHaveBeenCalled();
  });

  it('cu motiv → 200, serviciul primeste motivul curatat, auditul COMPANY_UNSUSPENDED primeste raspunsul', async () => {
    const result = { id: 'c1', status: 'APPROVED', penaltyPoints: 12, count: 2, items: [], unsuspendReason: 'Firma a explicat.' };
    adminUnsuspend.mockResolvedValue(result);
    const res = await post(JSON.stringify({ reason: '  Firma a explicat.  ' }));
    expect(res.status).toBe(200);
    expect(adminUnsuspend).toHaveBeenCalledWith('c1', expect.objectContaining({ reason: 'Firma a explicat.' }));
    expect(auditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'COMPANY_UNSUSPENDED', entityType: 'company', entityId: 'c1', userId: 'admin-1', after: result }),
    );
  });
});

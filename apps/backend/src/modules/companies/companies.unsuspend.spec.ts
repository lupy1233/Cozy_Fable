import { BadRequestException, ForbiddenException, ValidationPipe, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import type { SettingsService } from '../../common/settings/settings.service';
import type { PrismaService } from '../../infra/prisma/prisma.service';
import { auditSnapshot } from '../audit/audit-snapshot';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { SubscriptionsService } from '../billing/subscriptions.service';
import type { OutboxService } from '../outbox/outbox.service';
import { PenaltiesService } from '../penalties/penalties.service';
import { AdminCompaniesController } from './admin-companies.controller';
import { CompaniesService } from './companies.service';
import { UnsuspendCompanyDto, auditSafeReason } from './dto/unsuspend-company.dto';

// Etapa 12 (k2): ridicarea suspendarii cere motiv si anuleaza punctele active (raspuns PO k2-1).
// O baza simulata in memorie (firma + evenimente de penalizare) e folosita si de CompaniesService,
// si de PenaltiesService, ca sa verificam drumul complet: ridicare → penalizare noua sub prag.

type Event = { id: string; companyId: string; scope: string; ruleKey: string; points: number; appliedAt: Date; expiresAt: Date };

function fakeDb(opts: { status?: string; events?: Array<{ points: number; ruleKey?: string; daysAgo?: number }> } = {}) {
  const company = { id: 'c1', status: opts.status ?? 'SUSPENDED', suspendedAt: new Date() as Date | null, suspendedUntil: new Date() as Date | null, deletedAt: null };
  const now = Date.now();
  const events: Event[] = (opts.events ?? []).map((e, i) => ({
    id: `e${i + 1}`,
    companyId: 'c1',
    scope: 'COMPANY',
    ruleKey: e.ruleKey ?? 'SLA_MISS',
    points: e.points,
    appliedAt: new Date(now - (e.daysAgo ?? 1) * 86_400_000 + i),
    expiresAt: new Date(now + 170 * 86_400_000),
  }));
  const locks: string[] = [];
  const gt = (where: { expiresAt?: { gt: Date } }, e: Event) => !where.expiresAt || e.expiresAt > where.expiresAt.gt;
  const match = (where: { companyId?: string; scope?: string; id?: { in: string[] }; expiresAt?: { gt: Date } }, e: Event) =>
    (!where.companyId || e.companyId === where.companyId) &&
    (!where.scope || e.scope === where.scope) &&
    (!where.id || where.id.in.includes(e.id)) &&
    gt(where, e);
  const tx = {
    company: {
      updateMany: jest.fn(async ({ where, data }: { where: { status: string }; data: Record<string, unknown> }) => {
        if (company.status !== where.status) return { count: 0 };
        Object.assign(company, data);
        return { count: 1 };
      }),
      findUniqueOrThrow: jest.fn(async () => ({ ...company })),
      findUnique: jest.fn(async () => ({ ...company })),
      update: jest.fn(async ({ data }: { data: Record<string, unknown> }) => Object.assign(company, data)),
    },
    companyMember: { findMany: jest.fn().mockResolvedValue([{ userId: 'u1' }]) },
    penaltyEvent: {
      findMany: jest.fn(async ({ where, select }: { where: Parameters<typeof match>[0]; select?: object }) =>
        events
          .filter((e) => match(where, e))
          .sort((a, b) => a.appliedAt.getTime() - b.appliedAt.getTime())
          .map((e) => (select ? { id: e.id, ruleKey: e.ruleKey, points: e.points } : { ...e })),
      ),
      updateMany: jest.fn(async ({ where, data }: { where: Parameters<typeof match>[0]; data: { expiresAt: Date } }) => {
        const hit = events.filter((e) => match(where, e));
        hit.forEach((e) => (e.expiresAt = data.expiresAt));
        return { count: hit.length };
      }),
      aggregate: jest.fn(async ({ where }: { where: Parameters<typeof match>[0] }) => ({
        _sum: { points: events.filter((e) => match(where, e)).reduce((s, e) => s + e.points, 0) || null },
      })),
      create: jest.fn(async ({ data }: { data: Omit<Event, 'id'> }) => {
        const e = { id: `e${events.length + 1}`, ...data } as Event;
        events.push(e);
        return e;
      }),
    },
    penaltyRule: { findUnique: jest.fn().mockResolvedValue(null) },
    // blocarea randului firmei (SELECT ... FOR UPDATE); retinem textul SQL ca sa verificam blocarea
    $queryRaw: jest.fn(async (strings: TemplateStringsArray) => {
      locks.push(strings.join('?'));
      return [{ id: 'c1' }];
    }),
  };
  const prisma = { ...tx, $transaction: jest.fn((fn: (t: typeof tx) => Promise<unknown>) => fn(tx)) };
  const outbox = { record: jest.fn().mockResolvedValue(undefined) };
  const settings = { getInt: jest.fn(async (_k: string, fallback: number) => fallback) };
  const companies = new CompaniesService(
    prisma as unknown as PrismaService,
    {} as unknown as SubscriptionsService,
    outbox as unknown as OutboxService,
    settings as unknown as SettingsService,
  );
  const penalties = new PenaltiesService(prisma as unknown as PrismaService, settings as unknown as SettingsService);
  return { company, events, tx, prisma, outbox, companies, penalties, locks };
}

const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });
const validateBody = (body: unknown) =>
  pipe.transform(body, { type: 'body', metatype: UnsuspendCompanyDto }) as Promise<UnsuspendCompanyDto>;

describe('POST /admin/companies/:id/unsuspend — motivul (etapa 12, k2)', () => {
  it.each([
    ['fara corp', undefined],
    ['fara motiv', {}],
    ['motiv gol', { reason: '' }],
    ['motiv sub 3 caractere dupa trim', { reason: '  ab  ' }],
    // revizuire m1: lungimea se masoara DUPA scoaterea caracterelor de control
    ['motiv doar din caractere de control', { reason: '\u0001\u0001\u0001' }],
    ['motiv din control + spatii care devine gol', { reason: ' \u0007\t\n\u001F ' }],
    ['2 caractere vizibile intre caractere de control', { reason: '\u0001\u0002ab\u0003' }],
    ['motiv care nu e text', { reason: 123 }],
    ['camp necunoscut', { reason: 'Firma a explicat întârzierile.', extra: 1 }],
  ])('%s → 400', async (_label, body) => {
    await expect(validateBody(body)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('motiv valid → trece, taiat de spatii', async () => {
    await expect(validateBody({ reason: '  Am verificat explicațiile firmei.  ' })).resolves.toMatchObject({
      reason: 'Am verificat explicațiile firmei.',
    });
  });

  it('caracterele de control din motiv devin spatiu inainte de validare', async () => {
    await expect(validateBody({ reason: '\u0001Am verificat\u0007firma.\u0002' })).resolves.toMatchObject({
      reason: 'Am verificat firma.',
    });
  });

  it('ruta e doar pentru ADMIN: alt rol → 403 FORBIDDEN', () => {
    const guard = new RolesGuard(new Reflector());
    const ctx = (role: UserRole) =>
      ({
        getHandler: () => AdminCompaniesController.prototype.unsuspend,
        getClass: () => AdminCompaniesController,
        switchToHttp: () => ({ getRequest: () => ({ user: { sub: 'u', role } }) }),
      }) as unknown as ExecutionContext;
    expect(guard.canActivate(ctx(UserRole.ADMIN))).toBe(true);
    for (const role of [UserRole.CLIENT, UserRole.COMPANY_USER]) {
      expect(() => guard.canActivate(ctx(role))).toThrow(ForbiddenException);
    }
  });
});

describe('CompaniesService.adminUnsuspend (etapa 12, k2)', () => {
  it('firma nesuspendata → eroarea existenta (404 NOT_FOUND), punctele raman', async () => {
    const { companies, events, tx } = fakeDb({ status: 'APPROVED', events: [{ points: 3 }] });
    await expect(companies.adminUnsuspend('c1', { reason: 'Motiv valid' })).rejects.toMatchObject({
      status: 404,
      response: { code: 'NOT_FOUND' },
    });
    expect(tx.penaltyEvent.updateMany).not.toHaveBeenCalled();
    expect(events[0].expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('cu motiv → APPROVED, punctele active la 0, evenimentele raman (expirate), urma in raspuns/audit', async () => {
    const { companies, penalties, events, tx, outbox } = fakeDb({
      events: [{ points: 3 }, { points: 3, ruleKey: 'MASS_SLA_MISS' }, { points: 2, ruleKey: 'VOLUNTARY_WITHDRAWAL' }, { points: 4 }],
    });
    const before = Date.now();
    const result = await companies.adminUnsuspend('c1', { reason: 'Firma a explicat întârzierile; sunați la 0722 123 456 sau ana@firma.ro' });

    expect(result).toMatchObject({ id: 'c1', status: 'APPROVED', penaltyPoints: 12, count: 4 });
    expect(result.items.map((e) => e.id)).toEqual(['e1', 'e2', 'e3', 'e4']);
    // starea si punctele in aceeasi tranzactie
    expect(tx.company.updateMany).toHaveBeenCalledWith({
      where: { id: 'c1', status: 'SUSPENDED', deletedAt: null },
      data: { status: 'APPROVED', suspendedAt: null, suspendedUntil: null },
    });
    expect(tx.penaltyEvent.updateMany).toHaveBeenCalledTimes(1);
    // istoricul nu se sterge: aceleasi 4 evenimente, expirate acum
    expect(events).toHaveLength(4);
    for (const e of events) {
      expect(e.expiresAt.getTime()).toBeGreaterThanOrEqual(before);
      expect(e.expiresAt.getTime()).toBeLessThanOrEqual(Date.now());
    }
    // panoul firmei (aceeasi sursa: evenimente COMPANY cu expiresAt > acum) arata 0 si lista goala
    const status = await penalties.getCompanyStatus('c1');
    expect(status).toMatchObject({ activePoints: 0, suspended: false, events: [] });
    const preview = await penalties.previewCompanyPenalty('c1', 'SLA_MISS');
    expect(preview.activePoints).toBe(0);
    // motivul ajunge in raspuns (instantaneul de audit) fara datele de contact
    expect(result.unsuspendReason).toBe('Firma a explicat întârzierile; sunați la [nr] sau [email]');
    expect(outbox.record).toHaveBeenCalledWith(tx, expect.stringMatching(/^company\.unsuspended:c1:/), 'company.unsuspended', { companyId: 'c1' }, ['u1']);
  });

  it('instantaneul de audit pastreaza cine/ce s-a anulat (puncte, numar, evenimente)', async () => {
    const { companies } = fakeDb({ events: [{ points: 3 }, { points: 9 }] });
    const result = await companies.adminUnsuspend('c1', { reason: 'Motiv valid' });
    const snap = auditSnapshot(result) as Record<string, unknown>;
    expect(snap).toMatchObject({
      id: 'c1',
      status: 'APPROVED',
      penaltyPoints: 12,
      count: 2,
      items: [
        { id: 'e1', ruleKey: 'SLA_MISS', points: 3 },
        { id: 'e2', ruleKey: 'SLA_MISS', points: 9 },
      ],
    });
  });

  it('dupa ridicare, o penalizare noua sub prag NU suspenda firma din nou', async () => {
    const { companies, penalties, company } = fakeDb({ events: [{ points: 6 }, { points: 6 }] });
    await companies.adminUnsuspend('c1', { reason: 'Motiv valid' });
    const res = await penalties.applyPenalty({ companyId: 'c1', ruleKey: 'SLA_MISS' });
    expect(res).toEqual({ pointsApplied: 3, suspended: false, suspendedUntil: null });
    expect(company.status).toBe('APPROVED');
    const status = await penalties.getCompanyStatus('c1');
    expect(status.activePoints).toBe(3);
    expect(status.events).toHaveLength(1);
  });

  it('fara ridicare (control): aceeasi penalizare peste prag suspenda', async () => {
    const { penalties, company } = fakeDb({ status: 'APPROVED', events: [{ points: 6 }, { points: 3 }] });
    const res = await penalties.applyPenalty({ companyId: 'c1', ruleKey: 'SLA_MISS' });
    expect(res.suspended).toBe(true);
    expect(company.status).toBe('SUSPENDED');
  });
});

describe('blocarea randului firmei (revizuire m3)', () => {
  it('ridicarea blocheaza firma (FOR UPDATE) inainte de UPDATE si de anularea punctelor', async () => {
    const { companies, tx, locks } = fakeDb({ events: [{ points: 12 }] });
    await companies.adminUnsuspend('c1', { reason: 'Motiv valid' });
    expect(locks).toHaveLength(1);
    expect(locks[0]).toMatch(/FROM companies WHERE id = \? FOR UPDATE/);
    const lockOrder = tx.$queryRaw.mock.invocationCallOrder[0];
    expect(lockOrder).toBeLessThan(tx.company.updateMany.mock.invocationCallOrder[0]);
    expect(lockOrder).toBeLessThan(tx.penaltyEvent.updateMany.mock.invocationCallOrder[0]);
  });

  it('penalizarea in tranzactie blocheaza aceeasi firma inainte de eveniment, suma si stare', async () => {
    const { penalties, tx, locks } = fakeDb({ status: 'APPROVED' });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await penalties.applyPenalty({ companyId: 'c1', ruleKey: 'SLA_MISS' }, tx as any);
    expect(locks).toHaveLength(1);
    expect(locks[0]).toMatch(/FOR UPDATE/);
    const lockOrder = tx.$queryRaw.mock.invocationCallOrder[0];
    expect(lockOrder).toBeLessThan(tx.penaltyEvent.create.mock.invocationCallOrder[0]);
    expect(lockOrder).toBeLessThan(tx.penaltyEvent.aggregate.mock.invocationCallOrder[0]);
  });

  it('penalizare cu 0 puncte (regula oprita) nu blocheaza nimic', async () => {
    const { penalties, tx, locks } = fakeDb({ status: 'APPROVED' });
    tx.penaltyRule.findUnique.mockResolvedValueOnce({ isActive: false, points: 3 });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await penalties.applyPenalty({ companyId: 'c1', ruleKey: 'SLA_MISS' }, tx as any);
    expect(locks).toHaveLength(0);
  });
});

describe('auditSafeReason = aceeasi regula ca auditul (freeReason)', () => {
  it('scoate e-mailuri si numere lungi (telefon); pastreaza textul', () => {
    expect(auditSafeReason('Sună la +40 722-123-456 sau scrie office@firma.ro — termen 12 zile')).toBe(
      'Sună la [nr] sau scrie [email] — termen 12 zile',
    );
  });

  it('caracterele de control devin spatiu', () => {
    expect(auditSafeReason('Am\u0007verificat')).toBe('Am verificat');
  });

  it('datele si sumele obisnuite raman citibile; IBAN-ul cu litere e mascat intreg (m2)', () => {
    expect(auditSafeReason('Contestație admisă pe 14.11.2026, plătit 1.500 lei din RO49 AAAA 1B31 0075 9384 0000')).toBe(
      'Contestație admisă pe 14.11.2026, plătit 1.500 lei din [iban]',
    );
  });

  it('un motiv care pare sa contina un secret ramane in audit ca [ascuns], nu dispare', async () => {
    expect(auditSafeReason('am verificat token ul de plata')).toBe('[ascuns]');
    const { companies } = fakeDb({ events: [{ points: 3 }] });
    const result = await companies.adminUnsuspend('c1', { reason: 'password: 1234 trimisa de firma' });
    expect(result.unsuspendReason).toBe('[ascuns]');
    expect(auditSnapshot(result)).toMatchObject({ unsuspendReason: '[ascuns]' });
  });

  it('motivul obisnuit ajunge identic in raspuns si in audit', async () => {
    const { companies } = fakeDb({ events: [{ points: 3 }] });
    const result = await companies.adminUnsuspend('c1', { reason: 'Firma a explicat întârzierile; sunați la 0722 123 456' });
    expect(auditSnapshot(result)).toMatchObject({ unsuspendReason: result.unsuspendReason });
    expect(result.unsuspendReason).toBe('Firma a explicat întârzierile; sunați la [nr]');
  });
});

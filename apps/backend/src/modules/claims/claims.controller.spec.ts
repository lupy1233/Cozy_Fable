import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import type { PrismaService } from '../../infra/prisma/prisma.service';
import { CompanyApprovedGuard } from '../../common/guards/company-approved.guard';
import { SubscriptionActiveGuard } from '../../common/guards/subscription-active.guard';
import type { CompanyContext, RequestWithCompany } from '../../common/company-context/company-context';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { freezeClock, restoreClock } from '../../test/clock';
import { ClaimsController } from './claims.controller';
import type { ClaimsService } from './claims.service';

// h2 (2026-11-13, decizie PO h2-1): firma cu abonament expirat isi vede si isi termina
// preluarile (lista, atribuire); DOAR preluarea unei cereri noi cere abonament activ.
// Verificam garzile exact in ordinea in care le ruleaza Nest (clasa, apoi metoda).

type Handler = 'create' | 'listMine' | 'assign';
type GuardClass = new (...args: never[]) => CanActivate;

function guardsOf(handler: Handler): GuardClass[] {
  const onClass = (Reflect.getMetadata(GUARDS_METADATA, ClaimsController) ?? []) as GuardClass[];
  const onMethod = (Reflect.getMetadata(GUARDS_METADATA, ClaimsController.prototype[handler]) ?? []) as GuardClass[];
  return [...onClass, ...onMethod];
}

const ctx = (): CompanyContext => ({ companyId: 'c1', memberRole: 'OWNER', status: 'APPROVED' });

// Ruleaza lantul de garzi al unei rute: CompanyApprovedGuard e simulat (firma aprobata),
// SubscriptionActiveGuard e cel real, pe un EntitlementsService cu baza simulata.
async function runGuards(handler: Handler, subscription: unknown) {
  const findFirst = jest.fn().mockResolvedValue(subscription);
  const entitlements = new EntitlementsService({ subscription: { findFirst } } as unknown as PrismaService);
  const req: RequestWithCompany = {};
  const context = { switchToHttp: () => ({ getRequest: () => req }) } as unknown as ExecutionContext;
  for (const G of guardsOf(handler)) {
    if (G === (CompanyApprovedGuard as unknown as GuardClass)) {
      req.companyContext = ctx();
      continue;
    }
    if (G === (SubscriptionActiveGuard as unknown as GuardClass)) {
      await new SubscriptionActiveGuard(entitlements).canActivate(context);
      continue;
    }
    throw new Error(`garda neasteptata pe ${handler}: ${G.name}`);
  }
  return req;
}

const ACTIVE_SUB = {
  id: 'sub1',
  isTrial: false,
  expiresAt: new Date('2026-12-01T10:00:00Z'),
  plan: {
    id: 'p1',
    code: 'GOLD',
    nameRo: null,
    nameEn: null,
    priceRon: 399,
    marketplaceGatingDelayMin: 30,
    features: [{ featureKey: 'MARKETPLACE_ACCESS', enabled: true, limitValue: null }],
  },
};

describe('ClaimsController — bariera de abonament doar pe preluarea noua (h2)', () => {
  beforeEach(() => freezeClock('2026-11-13T10:00:00Z'));
  afterEach(() => restoreClock());

  it('garzile: CompanyApproved pe toata sectiunea, SubscriptionActive doar pe POST /claims', () => {
    expect(guardsOf('create')).toEqual([CompanyApprovedGuard, SubscriptionActiveGuard]);
    expect(guardsOf('listMine')).toEqual([CompanyApprovedGuard]);
    expect(guardsOf('assign')).toEqual([CompanyApprovedGuard]);
  });

  it('fara abonament activ: lista preluarilor raspunde normal', async () => {
    const req = await runGuards('listMine', null);
    const rows = [{ id: 's1' }];
    const service = { listMine: jest.fn().mockResolvedValue(rows) } as unknown as ClaimsService;
    const controller = new ClaimsController(service);
    await expect(controller.listMine(req.companyContext!)).resolves.toBe(rows);
    expect(service.listMine).toHaveBeenCalledWith('c1');
  });

  it('fara abonament activ: atribuirea unui coleg trece de garzi', async () => {
    const req = await runGuards('assign', null);
    const service = { assign: jest.fn().mockResolvedValue({ id: 's1' }) } as unknown as ClaimsService;
    const controller = new ClaimsController(service);
    await controller.assign(req.companyContext!, 's1', { assignToUserId: 'u2' });
    expect(service.assign).toHaveBeenCalledWith(req.companyContext, 's1', { assignToUserId: 'u2' });
  });

  it('fara abonament activ: preluarea noua e refuzata cu 403 SUBSCRIPTION_INACTIVE', async () => {
    await expect(runGuards('create', null)).rejects.toMatchObject({
      status: 403,
      response: { code: 'SUBSCRIPTION_INACTIVE' },
    });
  });

  it('cu abonament activ: preluarea noua trece si primeste gating-ul planului pe context', async () => {
    const req = await runGuards('create', ACTIVE_SUB);
    expect(req.companyContext).toMatchObject({ subscriptionId: 'sub1', gatingDelayMinutes: 30 });
  });
});

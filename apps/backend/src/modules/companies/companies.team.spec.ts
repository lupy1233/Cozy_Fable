import 'reflect-metadata';
import { ERROR_CODES } from '@marketplace/shared';
import { CompaniesService } from './companies.service';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { UserThrottlerGuard } from '../../common/throttler/client-ip-throttler.guard';
import { CompaniesController } from './companies.controller';
import { defaultOfferFieldPermissions, effectiveOfferFieldPermissions } from './companies.constants';
import { InviteMemberDto, UpdateOfferPermissionsDto } from './dto/company.dto';

const FIELDS_ALL = ['PRICE', 'DELIVERY_TERM', 'DELIVERY_DATE', 'WARRANTY', 'DESCRIPTION'];
const ROLES_ALL = ['OWNER', 'MANAGER', 'EMPLOYEE_TRUSTED', 'EMPLOYEE_MANAGED'];

// h1 (etapa 11) — echipa (h1-1: colegul adaugat primeste clopotel + e-mail; mesaj clar cand
// e-mailul nu are cont de firma) si permisiunile ofertei (h1-2: proprietarul are mereu tot;
// firma fara randuri = matricea de la inscriere).

/* eslint-disable @typescript-eslint/no-explicit-any */
function setup(opts: { actorRole?: string; invitee?: any; existing?: any; permRows?: number; recentAdds?: number } = {}) {
  const tx: any = {
    companyMember: { create: jest.fn().mockResolvedValue({ id: 'mem-new' }) },
    // M1c: intentiile company.member_added recente pentru acelasi coleg + aceeasi firma
    domainEventOutbox: { count: jest.fn().mockResolvedValue(opts.recentAdds ?? 0) },
  };
  const prisma: any = {
    companyMember: {
      // doar verificarea „colegul e deja intr-o firma” (membrul curent vine din requireMembership)
      findUnique: jest.fn().mockResolvedValue(opts.existing ?? null),
      findFirst: jest.fn().mockResolvedValue({ id: 'mem-new', companyId: 'c1', userId: 'u-new', role: 'EMPLOYEE_TRUSTED' }),
      delete: jest.fn().mockResolvedValue({}),
      count: jest.fn().mockResolvedValue(1),
    },
    user: { findFirst: jest.fn().mockResolvedValue(opts.invitee === undefined ? { id: 'u-new' } : opts.invitee) },
    companyOfferFieldPermission: {
      count: jest.fn().mockResolvedValue(opts.permRows ?? 20),
      createMany: jest.fn().mockResolvedValue({ count: 20 }),
      upsert: jest.fn().mockResolvedValue({}),
    },
    $transaction: jest.fn(async (arg: any) => (Array.isArray(arg) ? Promise.all(arg) : arg(tx))),
  };
  const outbox: any = { record: jest.fn().mockResolvedValue(undefined) };
  const service = new CompaniesService(prisma, {} as any, outbox, {} as any);
  jest.spyOn(service, 'getMyCompany').mockResolvedValue({ id: 'c1' } as any);
  // membru curent = actorul (requireMembership citeste dupa userId-ul actorului)
  jest
    .spyOn(service as any, 'requireMembership')
    .mockResolvedValue({ companyId: 'c1', userId: 'u-owner', role: opts.actorRole ?? 'OWNER' });
  return { service, prisma, tx, outbox };
}

describe('CompaniesService.addMember (h1-1)', () => {
  it('scrie company.member_added catre colegul adaugat, cu campurile din contract', async () => {
    const { service, tx, outbox } = setup();
    await service.addMember('u-owner', { email: 'Ion@Firma.ro', role: 'EMPLOYEE_TRUSTED' } as any);
    expect(tx.companyMember.create).toHaveBeenCalledWith({
      data: { companyId: 'c1', userId: 'u-new', role: 'EMPLOYEE_TRUSTED' },
    });
    expect(outbox.record).toHaveBeenCalledTimes(1);
    const [txArg, key, event, payload, targets] = outbox.record.mock.calls[0];
    expect(txArg).toBe(tx);
    expect(key).toBe('company.member_added:mem-new');
    expect(event).toBe('company.member_added');
    expect(payload).toEqual({
      companyId: 'c1',
      memberUserId: 'u-new',
      role: 'EMPLOYEE_TRUSTED',
      actorUserId: 'u-owner',
    });
    expect(targets).toEqual(['u-new']);
  });

  it('managerul poate adauga (garda neschimbata)', async () => {
    const { service, outbox } = setup({ actorRole: 'MANAGER' });
    await service.addMember('u-owner', { email: 'ion@firma.ro', role: 'EMPLOYEE_MANAGED' } as any);
    expect(outbox.record).toHaveBeenCalledTimes(1);
  });

  it('angajatul nu poate adauga colegi → 403, fara scriere', async () => {
    const { service, tx, outbox } = setup({ actorRole: 'EMPLOYEE_TRUSTED' });
    await expect(service.addMember('u-owner', { email: 'ion@firma.ro', role: 'EMPLOYEE_MANAGED' } as any)).rejects.toMatchObject({
      status: 403,
    });
    expect(tx.companyMember.create).not.toHaveBeenCalled();
    expect(outbox.record).not.toHaveBeenCalled();
  });

  it('e-mail fara cont de firma (inexistent SAU cont de client) → 404 MEMBER_NO_COMPANY_ACCOUNT, acelasi raspuns', async () => {
    const { service, prisma, outbox } = setup({ invitee: null });
    await expect(service.addMember('u-owner', { email: 'nimeni@x.ro', role: 'MANAGER' } as any)).rejects.toMatchObject({
      status: 404,
      response: { code: ERROR_CODES.MEMBER_NO_COMPANY_ACCOUNT, message: 'No company user with this email' },
    });
    // cautarea cere rolul COMPANY_USER → un cont de client nu se deosebeste de unul inexistent
    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: { email: 'nimeni@x.ro', deletedAt: null, blockedAt: null, role: 'COMPANY_USER' },
    });
    expect(outbox.record).not.toHaveBeenCalled();
  });

  it('m8: contul de firma blocat e exclus din cautare → acelasi 404 ca „nu are cont de firma”', async () => {
    const { service, prisma } = setup({ invitee: null });
    await expect(service.addMember('u-owner', { email: 'blocat@x.ro', role: 'MANAGER' } as any)).rejects.toMatchObject({
      status: 404,
      response: { code: ERROR_CODES.MEMBER_NO_COMPANY_ACCOUNT, message: 'No company user with this email' },
    });
    expect(prisma.user.findFirst.mock.calls[0][0].where.blockedAt).toBeNull();
  });

  it('M1c: prima adaugare fara emailSuppressed; cautarea recentelor e pe acelasi coleg, aceeasi firma, 24h', async () => {
    const { service, tx, outbox } = setup();
    const before = Date.now();
    await service.addMember('u-owner', { email: 'ion@firma.ro', role: 'MANAGER' } as any);
    const where = tx.domainEventOutbox.count.mock.calls[0][0].where;
    expect(where).toMatchObject({
      eventType: 'company.member_added',
      targetUserIds: { has: 'u-new' },
      payload: { path: ['companyId'], equals: 'c1' },
    });
    const since = (where.createdAt.gte as Date).getTime();
    expect(before - since).toBeGreaterThanOrEqual(24 * 3600 * 1000 - 5);
    expect(before - since).toBeLessThan(24 * 3600 * 1000 + 5000);
    expect(outbox.record.mock.calls[0][3]).not.toHaveProperty('emailSuppressed');
  });

  it('adaugare → scoatere → readaugare: doua evenimente cu chei diferite; al doilea fara e-mail (emailSuppressed)', async () => {
    const { service, tx, outbox, prisma } = setup();
    await service.addMember('u-owner', { email: 'ion@firma.ro', role: 'MANAGER' } as any);
    await service.removeMember('u-owner', 'mem-new');
    expect(prisma.companyMember.delete).toHaveBeenCalledWith({ where: { id: 'mem-new' } });
    tx.companyMember.create.mockResolvedValueOnce({ id: 'mem-2' });
    tx.domainEventOutbox.count.mockResolvedValueOnce(1);
    await service.addMember('u-owner', { email: 'ion@firma.ro', role: 'MANAGER' } as any);
    expect(outbox.record).toHaveBeenCalledTimes(2);
    expect(outbox.record.mock.calls[0][1]).toBe('company.member_added:mem-new');
    expect(outbox.record.mock.calls[1][1]).toBe('company.member_added:mem-2');
    // clopotelul ramane (aceeasi tinta), doar e-mailul se opreste
    expect(outbox.record.mock.calls[1][4]).toEqual(['u-new']);
    expect(outbox.record.mock.calls[1][3]).toMatchObject({ emailSuppressed: true });
  });

  it('m10: doua adaugari simultane (P2002 pe user_id) → 409 MEMBER_ALREADY_EXISTS, nu 500', async () => {
    const { service, tx } = setup();
    tx.companyMember.create.mockRejectedValueOnce(Object.assign(new Error('Unique constraint'), { code: 'P2002' }));
    await expect(service.addMember('u-owner', { email: 'ion@firma.ro', role: 'MANAGER' } as any)).rejects.toMatchObject({
      status: 409,
      response: { code: ERROR_CODES.MEMBER_ALREADY_EXISTS },
    });
  });

  it('alta eroare din tranzactie urca neschimbata', async () => {
    const { service, tx } = setup();
    tx.companyMember.create.mockRejectedValueOnce(new Error('boom'));
    await expect(service.addMember('u-owner', { email: 'ion@firma.ro', role: 'MANAGER' } as any)).rejects.toThrow('boom');
  });

  it('colegul e deja in alta firma → 409 MEMBER_ALREADY_EXISTS, fara eveniment', async () => {
    const { service, outbox } = setup({ existing: { id: 'm-other', companyId: 'c2' } });
    await expect(service.addMember('u-owner', { email: 'ion@firma.ro', role: 'MANAGER' } as any)).rejects.toMatchObject({
      status: 409,
      response: { code: ERROR_CODES.MEMBER_ALREADY_EXISTS },
    });
    expect(outbox.record).not.toHaveBeenCalled();
  });
});

describe('CompaniesService.updateOfferPermissions (h1-2)', () => {
  it('randurile proprietarului se ignora (debifarea proprietarului nu are efect)', async () => {
    const { service, prisma } = setup();
    await service.updateOfferPermissions('u-owner', {
      permissions: [
        { role: 'OWNER', fieldKey: 'PRICE', canEdit: false },
        { role: 'EMPLOYEE_TRUSTED', fieldKey: 'PRICE', canEdit: true },
      ],
    } as any);
    expect(prisma.companyOfferFieldPermission.upsert).toHaveBeenCalledTimes(1);
    expect(prisma.companyOfferFieldPermission.upsert.mock.calls[0][0].where.companyId_role_fieldKey).toEqual({
      companyId: 'c1',
      role: 'EMPLOYEE_TRUSTED',
      fieldKey: 'PRICE',
    });
    expect(prisma.companyOfferFieldPermission.createMany).not.toHaveBeenCalled();
  });

  it('firma fara niciun rand: matricea de la inscriere se scrie intai, apoi schimbarile', async () => {
    const { service, prisma } = setup({ permRows: 0 });
    await service.updateOfferPermissions('u-owner', {
      permissions: [{ role: 'MANAGER', fieldKey: 'WARRANTY', canEdit: false }],
    } as any);
    expect(prisma.companyOfferFieldPermission.createMany).toHaveBeenCalledWith({
      data: defaultOfferFieldPermissions().map((p) => ({ companyId: 'c1', ...p })),
      skipDuplicates: true,
    });
    expect(prisma.companyOfferFieldPermission.upsert).toHaveBeenCalledTimes(1);
  });

  it('payload numai cu randuri ale proprietarului, la o firma cu randuri → nicio scriere', async () => {
    const { service, prisma } = setup({ permRows: 20 });
    await service.updateOfferPermissions('u-owner', {
      permissions: FIELDS_ALL.map((fieldKey) => ({ role: 'OWNER', fieldKey, canEdit: false })),
    } as any);
    expect(prisma.companyOfferFieldPermission.upsert).not.toHaveBeenCalled();
    expect(prisma.companyOfferFieldPermission.createMany).not.toHaveBeenCalled();
  });

  it('managerul nu poate schimba matricea → 403 (garda neschimbata)', async () => {
    const { service, prisma } = setup({ actorRole: 'MANAGER' });
    await expect(
      service.updateOfferPermissions('u-owner', { permissions: [{ role: 'MANAGER', fieldKey: 'PRICE', canEdit: true }] } as any),
    ).rejects.toMatchObject({ status: 403 });
    expect(prisma.companyOfferFieldPermission.upsert).not.toHaveBeenCalled();
  });
});

describe('effectiveOfferFieldPermissions (h1-2)', () => {
  const key = (rows: { role: string; fieldKey: string; canEdit: boolean }[]) =>
    Object.fromEntries(rows.map((r) => [`${r.role}|${r.fieldKey}`, r.canEdit]));

  it('fara randuri → exact matricea de la inscriere (angajatul nu primeste mai mult)', () => {
    expect(key(effectiveOfferFieldPermissions([]))).toEqual(key(defaultOfferFieldPermissions()));
  });

  it('proprietarul apare mereu cu tot bifat, chiar daca randurile lui sunt debifate', () => {
    const out = key(
      effectiveOfferFieldPermissions([
        { role: 'OWNER', fieldKey: 'PRICE', canEdit: false },
        { role: 'MANAGER', fieldKey: 'PRICE', canEdit: false },
      ]),
    );
    for (const f of ['PRICE', 'DELIVERY_TERM', 'DELIVERY_DATE', 'WARRANTY', 'DESCRIPTION']) expect(out[`OWNER|${f}`]).toBe(true);
    expect(out['MANAGER|PRICE']).toBe(false);
    // firma cu randuri ramane pe randurile ei (fara completare din matricea implicita)
    expect(out['EMPLOYEE_TRUSTED|DESCRIPTION']).toBeUndefined();
  });
});

describe('DTO-uri echipa / permisiuni (revizuire h1)', () => {
  it('adaugarea cu rolul de proprietar e respinsa de validare', () => {
    const errs = validateSync(plainToInstance(InviteMemberDto, { email: 'ion@firma.ro', role: 'OWNER' }));
    expect(errs.some((e) => e.property === 'role')).toBe(true);
    expect(validateSync(plainToInstance(InviteMemberDto, { email: 'ion@firma.ro', role: 'MANAGER' }))).toHaveLength(0);
  });

  it('m7: matricea trimisa are cel mult roluri × campuri (20) intrari', () => {
    const full = ROLES_ALL.flatMap((role) => FIELDS_ALL.map((fieldKey) => ({ role, fieldKey, canEdit: true })));
    expect(full).toHaveLength(20);
    const ok = validateSync(plainToInstance(UpdateOfferPermissionsDto, { permissions: full }));
    expect(ok).toHaveLength(0);
    const tooMany = validateSync(plainToInstance(UpdateOfferPermissionsDto, { permissions: [...full, full[0]] }));
    expect(tooMany.some((e) => e.property === 'permissions' && e.constraints?.arrayMaxSize)).toBe(true);
  });
});

describe('M1a: limita pe POST /companies/me/members', () => {
  it('10 pe ora, per utilizator (UserThrottlerGuard)', () => {
    const handler = CompaniesController.prototype.addMember;
    expect(Reflect.getMetadata('THROTTLER:LIMITdefault', handler)).toBe(10);
    expect(Reflect.getMetadata('THROTTLER:TTLdefault', handler)).toBe(3_600_000);
    expect(Reflect.getMetadata('__guards__', handler)).toContain(UserThrottlerGuard);
  });

  it('celelalte rute ale echipei nu primesc limita noua', () => {
    expect(Reflect.getMetadata('THROTTLER:LIMITdefault', CompaniesController.prototype.removeMember)).toBeUndefined();
  });
});

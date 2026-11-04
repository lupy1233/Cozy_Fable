import { HttpException } from '@nestjs/common';
import { BillingReadinessService } from './billing-readiness.service';
import { SELLER_SEED_PLACEHOLDERS, SELLER_SETTING_KEYS } from './billing-readiness';
import type { PrismaService } from '../../infra/prisma/prisma.service';
import type { StripeService } from './stripe.service';

// E-admin-platform-4 — nicio factura cu datele de exemplu din seed / CUI sau IBAN invalid.

/* eslint-disable @typescript-eslint/no-explicit-any */

const VALID = {
  name: 'Firma Reala SRL',
  cui: 'RO12345674',
  regCom: 'J40/1/2026',
  address: 'Str. Reala 1, Bucuresti',
  iban: 'ro08 test 0000 0000 0000 0001',
};

function rowsOf(values: Record<string, string>) {
  return Object.entries(SELLER_SETTING_KEYS).map(([field, key]) => ({ key, value: values[field] ?? '' }));
}

function makePrisma(values: Record<string, string>) {
  const prisma: any = {
    systemSetting: {
      findMany: jest.fn().mockResolvedValue(rowsOf(values)),
      upsert: jest.fn((args: unknown) => ({ upsert: args })),
    },
    mockBillingOrder: { count: jest.fn().mockResolvedValue(2) },
    $transaction: jest.fn(async (ops: unknown[]) => ops),
  };
  return prisma;
}

function build(values: Record<string, string>, mode: 'live' | 'test' | null = null) {
  const prisma = makePrisma(values);
  const stripe = { mode: jest.fn(() => mode) } as unknown as StripeService;
  return { prisma, service: new BillingReadinessService(prisma as PrismaService, stripe) };
}

describe('BillingReadinessService', () => {
  it('valorile din seed → not ready, 5 probleme (placeholder / invalid)', async () => {
    const { service, prisma } = build(SELLER_SEED_PLACEHOLDERS);
    const res = await service.check();
    expect(res.ready).toBe(false);
    expect(res.problems).toHaveLength(5);
    expect(res.problems.find((p) => p.field === 'iban')).toEqual({ field: 'iban', reason: 'PLACEHOLDER' });
    expect(['INVALID', 'PLACEHOLDER']).toContain(res.problems.find((p) => p.field === 'cui')?.reason);
    // un singur SELECT pentru cele 5 chei
    expect(prisma.systemSetting.findMany).toHaveBeenCalledTimes(1);
  });

  it('valori goale → MISSING pe fiecare camp', async () => {
    const { service } = build({});
    const res = await service.check();
    expect(res.ready).toBe(false);
    expect(res.problems.every((p) => p.reason === 'MISSING')).toBe(true);
    expect(res.problems).toHaveLength(5);
  });

  it('placeholder recunoscut indiferent de spatii/majuscule', () => {
    const problems = BillingReadinessService.evaluate({ ...VALID, name: '  marketplace mobilier srl ', iban: 'ro49 aaaa 1b31 0075 9384 0000' });
    expect(problems).toEqual([
      { field: 'name', reason: 'PLACEHOLDER' },
      { field: 'iban', reason: 'PLACEHOLDER' },
    ]);
  });

  it('set valid → ready, IBAN normalizat', async () => {
    const { service } = build(VALID);
    const res = await service.check();
    expect(res.ready).toBe(true);
    expect(res.problems).toEqual([]);
    expect(res.seller.iban).toBe('RO08TEST0000000000000001');
    await expect(service.assertReady()).resolves.toMatchObject({ cui: 'RO12345674', iban: 'RO08TEST0000000000000001' });
  });

  it('assertReady cu date incomplete → 503 BILLING_NOT_CONFIGURED', async () => {
    const { service } = build(SELLER_SEED_PLACEHOLDERS);
    await expect(service.assertReady()).rejects.toBeInstanceOf(HttpException);
    await expect(service.assertReady()).rejects.toMatchObject({ status: 503, response: { code: 'BILLING_NOT_CONFIGURED' } });
  });

  it('getReadinessDto: modul Stripe + facturile de raportat', async () => {
    const { service, prisma } = build(VALID, 'test');
    await expect(service.getReadinessDto()).resolves.toEqual({ ready: true, problems: [], stripeMode: 'test', eInvoicePendingCount: 2 });
    expect(prisma.mockBillingOrder.count).toHaveBeenCalledWith({
      where: expect.objectContaining({ status: 'CONFIRMED', testMode: false, invoiceNumber: { not: null } }),
    });
  });

  it('updateSeller respinge IBAN-ul din seed (PLACEHOLDER) si un CUI invalid (400), fara scriere', async () => {
    const { service, prisma } = build({});
    await expect(service.updateSeller({ ...VALID, iban: SELLER_SEED_PLACEHOLDERS.iban }, 'admin-1')).rejects.toMatchObject({
      status: 400,
      response: { code: 'VALIDATION_ERROR', details: [{ field: 'iban', reason: 'PLACEHOLDER' }] },
    });
    await expect(service.updateSeller({ ...VALID, cui: 'RO12345678' }, 'admin-1')).rejects.toMatchObject({
      status: 400,
      response: { details: [{ field: 'cui', reason: 'PLACEHOLDER' }] },
    });
    await expect(service.updateSeller({ ...VALID, cui: 'RO12345675' }, 'admin-1')).rejects.toMatchObject({
      status: 400,
      response: { details: [{ field: 'cui', reason: 'INVALID' }] },
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('updateSeller valid → 5 upsert-uri intr-o singura tranzactie, IBAN normalizat, CUI cu RO pastrat', async () => {
    const { service, prisma } = build({});
    prisma.systemSetting.findMany.mockResolvedValueOnce(rowsOf(VALID));
    const res = await service.updateSeller({ ...VALID, cui: ' ro12345674 ' }, 'admin-1');
    expect(res.ready).toBe(true);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.$transaction.mock.calls[0][0]).toHaveLength(5);
    expect(prisma.systemSetting.upsert).toHaveBeenCalledWith({
      where: { key: 'seller_iban' },
      update: { value: 'RO08TEST0000000000000001', updatedBy: 'admin-1' },
      create: { key: 'seller_iban', value: 'RO08TEST0000000000000001', updatedBy: 'admin-1' },
    });
    expect(prisma.systemSetting.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { key: 'seller_cui' }, update: { value: 'RO12345674', updatedBy: 'admin-1' } }));
  });
});

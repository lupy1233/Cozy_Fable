import { HttpException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import Stripe from 'stripe';
import { StripeService } from './stripe.service';

// L0-D — semnatura webhook + conversie sume.

function makeConfig(values: Record<string, string | undefined>) {
  return { get: jest.fn((k: string) => values[k]) } as unknown as ConfigService;
}

const SECRET = 'whsec_test_secret_123';

describe('StripeService', () => {
  it('fara chei → dezactivat; constructEvent → 503 PAYMENT_PROVIDER_UNAVAILABLE', () => {
    const svc = new StripeService(makeConfig({}));
    expect(svc.isEnabled()).toBe(false);
    expect(() => svc.constructEvent(Buffer.from('{}'), 't=1,v1=abc')).toThrow(HttpException);
    try {
      svc.constructEvent(Buffer.from('{}'), 't=1,v1=abc');
    } catch (e) {
      expect((e as HttpException).getStatus()).toBe(503);
    }
  });

  it('semnatura invalida → 400 PAYMENT_SIGNATURE_INVALID; lipsa semnatura/payload → 400', () => {
    const svc = new StripeService(makeConfig({ STRIPE_SECRET_KEY: 'sk_test_x', STRIPE_WEBHOOK_SECRET: SECRET }));
    expect(svc.isEnabled()).toBe(true);
    const payload = JSON.stringify({ id: 'evt_1', type: 'checkout.session.completed', data: { object: {} } });
    const bad = () => svc.constructEvent(Buffer.from(payload), 't=1,v1=deadbeef');
    expect(bad).toThrow(HttpException);
    try {
      bad();
    } catch (e) {
      expect((e as HttpException).getStatus()).toBe(400);
      expect((e as HttpException).getResponse()).toMatchObject({ code: 'PAYMENT_SIGNATURE_INVALID' });
    }
    expect(() => svc.constructEvent(undefined, 't=1,v1=deadbeef')).toThrow(HttpException);
    expect(() => svc.constructEvent(Buffer.from(payload), undefined)).toThrow(HttpException);
  });

  it('semnatura valida (generata cu secretul) → evenimentul e parsat', () => {
    const svc = new StripeService(makeConfig({ STRIPE_SECRET_KEY: 'sk_test_x', STRIPE_WEBHOOK_SECRET: SECRET }));
    const payload = JSON.stringify({
      id: 'evt_ok',
      object: 'event',
      type: 'checkout.session.completed',
      data: { object: { id: 'cs_1', object: 'checkout.session', payment_status: 'paid' } },
    });
    const header = Stripe.webhooks.generateTestHeaderString({ payload, secret: SECRET });
    const event = svc.constructEvent(Buffer.from(payload), header);
    expect(event.id).toBe('evt_ok');
    expect(event.type).toBe('checkout.session.completed');
  });

  it('toMinorUnits: Decimal RON → bani, rotunjire half-up explicita', () => {
    expect(StripeService.toMinorUnits(new Prisma.Decimal('121.00'))).toBe(12100);
    expect(StripeService.toMinorUnits(new Prisma.Decimal('482.79'))).toBe(48279);
    expect(StripeService.toMinorUnits(new Prisma.Decimal('0.005'))).toBe(1);
  });
});

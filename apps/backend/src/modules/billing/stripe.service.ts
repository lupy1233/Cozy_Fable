import { HttpException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ERROR_CODES } from '@marketplace/shared';
import { Prisma } from '@prisma/client';
import Stripe from 'stripe';
import { safeErrorSummary } from '../../common/logging/safe-error';

// Versiunea API fixata explicit = cea a SDK-ului instalat (stripe ^18.5 → 2025-08-27.basil).
// La upgrade de SDK se actualizeaza impreuna, ca tipurile si payload-urile sa ramana aliniate.
export const STRIPE_API_VERSION = '2025-08-27.basil' as const;

// O ora lasa marja pentru transport si retry; Stripe cere cel putin 30 min la creare.
// Parametrii raman fixati in checkpoint, iar sesiunile deschise se reiau.
export const CHECKOUT_EXPIRES_MINUTES = 60;

export interface CreateCheckoutSessionInput {
  orderId: string;
  companyId: string;
  amountRon: Prisma.Decimal; // total CU TVA
  description: string;
  // limba paginii Stripe Checkout; lipsa (incercari salvate vechi) = 'auto'
  locale?: 'ro' | 'en';
  customerEmail?: string | null;
  successUrl: string;
  cancelUrl: string;
  idempotencyKey: string;
  expiresAt: number;
}

export interface CheckoutSessionRef {
  id: string;
  url: string;
}

// Client Stripe (decizie PO 2026-08-19): Checkout hosted + webhook semnat.
// Lipsa STRIPE_SECRET_KEY/STRIPE_WEBHOOK_SECRET = Stripe dezactivat (isEnabled() false) —
// comenzile raman PENDING si se confirma manual de admin (transfer bancar).
@Injectable()
export class StripeService {
  private readonly logger = new Logger(StripeService.name);
  private readonly client: Stripe | null;
  private readonly webhookSecret: string | null;
  // E-admin-platform-4: modul cheii (live/test) — comenzile test nu primesc numar fiscal.
  private readonly keyMode: 'live' | 'test' | null;

  constructor(config: ConfigService) {
    const secret = config.get<string>('STRIPE_SECRET_KEY');
    this.webhookSecret = config.get<string>('STRIPE_WEBHOOK_SECRET') ?? null;
    this.client = secret ? new Stripe(secret, { apiVersion: STRIPE_API_VERSION }) : null;
    this.keyMode = !secret ? null : /^(sk|rk)_live_/.test(secret) ? 'live' : 'test';
    if (!this.client) {
      this.logger.warn('Stripe dezactivat (STRIPE_SECRET_KEY lipsa) — plati doar prin transfer bancar + confirmare admin');
    }
  }

  isEnabled(): boolean {
    return this.client !== null && this.webhookSecret !== null;
  }

  mode(): 'live' | 'test' | null {
    return this.keyMode;
  }

  // Un eveniment live pe o cheie de test (sau invers) nu se proceseaza: 400, neinregistrat.
  assertEventMode(event: Stripe.Event): void {
    const mode = this.mode();
    if (!mode || event.livemode === (mode === 'live')) return;
    this.logger.error(`Stripe event ${event.id} livemode=${event.livemode} nu corespunde cheii (${mode})`);
    throw new HttpException(
      { code: ERROR_CODES.VALIDATION_ERROR, message: 'Event mode does not match the configured Stripe key' },
      400,
    );
  }

  // Suma in bani (subunitati RON) din Decimal, rotunjire explicita half-up la intreg.
  static toMinorUnits(amountRon: Prisma.Decimal): number {
    return amountRon.mul(100).toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP).toNumber();
  }

  private requireClient(): Stripe {
    if (!this.client) {
      throw new HttpException(
        { code: ERROR_CODES.PAYMENT_PROVIDER_UNAVAILABLE, message: 'Online payments are not enabled' },
        503,
      );
    }
    return this.client;
  }

  async createCheckoutSession(input: CreateCheckoutSessionInput): Promise<CheckoutSessionRef> {
    const stripe = this.requireClient();
    const unitAmount = StripeService.toMinorUnits(input.amountRon);
    try {
      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        client_reference_id: input.orderId,
        ...(input.locale ? { locale: input.locale } : {}),
        customer_email: input.customerEmail ?? undefined,
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: 'ron',
              unit_amount: unitAmount,
              product_data: { name: input.description },
            },
          },
        ],
        metadata: { orderId: input.orderId, companyId: input.companyId },
        payment_intent_data: { metadata: { orderId: input.orderId, companyId: input.companyId } },
        success_url: input.successUrl,
        cancel_url: input.cancelUrl,
        expires_at: input.expiresAt,
      }, { idempotencyKey: input.idempotencyKey });
      if (!session.url) {
        throw new Error('Stripe returned a session without url');
      }
      return { id: session.id, url: session.url };
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error(`Stripe checkout.sessions.create failed for order ${input.orderId}: ${safeErrorSummary(err)}`);
      throw new HttpException(
        { code: ERROR_CODES.PAYMENT_PROVIDER_UNAVAILABLE, message: 'Payment provider error' },
        502,
      );
    }
  }

  async retrieveCheckoutSession(sessionId: string): Promise<{ id: string; url: string | null; status: 'open' | 'complete' | 'expired' | null }> {
    try {
      const session = await this.requireClient().checkout.sessions.retrieve(sessionId);
      return { id: session.id, url: session.url, status: session.status };
    } catch {
      throw new HttpException({ code: ERROR_CODES.PAYMENT_PROVIDER_UNAVAILABLE, message: 'Cannot verify the existing checkout session' }, 502);
    }
  }

  async ensureSessionExpired(sessionId: string): Promise<void> {
    const session = await this.retrieveCheckoutSession(sessionId);
    if (session.status === 'expired') return;
    if (session.status !== 'open') throw new HttpException({ code: ERROR_CODES.PAYMENT_NOT_PENDING, message: 'Payment is awaiting confirmation and cannot be cancelled' }, 409);
    try { await this.requireClient().checkout.sessions.expire(sessionId); }
    catch { throw new HttpException({ code: ERROR_CODES.PAYMENT_PROVIDER_UNAVAILABLE, message: 'Cannot safely expire checkout; cancellation has not been applied' }, 502); }
  }

  // Expira o sesiune veche (best effort) cand firma cere un link nou — evita doua
  // sesiuni deschise pentru aceeasi comanda.
  async expireSession(sessionId: string): Promise<void> {
    if (!this.client) return;
    try {
      await this.client.checkout.sessions.expire(sessionId);
    } catch (err) {
      // sesiunea poate fi deja expirata/platita — nu e eroare pentru flux
      this.logger.debug(`expireSession(${sessionId}) ignorat: ${safeErrorSummary(err)}`);
    }
  }

  // Verifica semnatura pe corpul brut (req.rawBody) — 400 PAYMENT_SIGNATURE_INVALID la esec.
  constructEvent(rawBody: Buffer | string | undefined, signature: string | undefined): Stripe.Event {
    const stripe = this.requireClient();
    if (!this.webhookSecret) {
      throw new HttpException(
        { code: ERROR_CODES.PAYMENT_PROVIDER_UNAVAILABLE, message: 'Webhook secret missing' },
        503,
      );
    }
    if (!rawBody || !signature) {
      throw new HttpException(
        { code: ERROR_CODES.PAYMENT_SIGNATURE_INVALID, message: 'Missing payload or signature' },
        400,
      );
    }
    try {
      return stripe.webhooks.constructEvent(rawBody, signature, this.webhookSecret);
    } catch (err) {
      this.logger.warn(`Stripe webhook signature invalid: ${safeErrorSummary(err)}`);
      throw new HttpException(
        { code: ERROR_CODES.PAYMENT_SIGNATURE_INVALID, message: 'Invalid Stripe signature' },
        400,
      );
    }
  }
}

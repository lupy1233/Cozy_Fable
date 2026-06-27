import { HttpException, Injectable, NotFoundException } from '@nestjs/common';
import {
  ERROR_CODES,
  type AdminBillingOrderItemDto,
  type BillingOrderDto,
  type CreditPackageDto,
  type PurchaseCreditsInput,
  type PurchaseSubscriptionInput,
} from '@marketplace/shared';
import { Prisma, type MockBillingOrder } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { SettingsService } from '../../common/settings/settings.service';
import { CreditsService } from './credits.service';

const SUBSCRIPTION_DAYS = 30;

// 4.16/4.17/3.7 — achizitie credite/abonament → comanda PENDING; la confirmare (admin/webhook)
// se emite factura (serie+numar secvential, TVA snapshot) + grant credite / activare abonament.
@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly credits: CreditsService,
  ) {}

  async listPackages(): Promise<CreditPackageDto[]> {
    const rows = await this.prisma.creditPackage.findMany({
      where: { isActive: true },
      orderBy: { credits: 'asc' },
    });
    return rows.map((p) => ({ id: p.id, credits: p.credits, priceRon: p.priceRon }));
  }

  async listOrders(companyId: string): Promise<BillingOrderDto[]> {
    const rows = await this.prisma.mockBillingOrder.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((o) => this.toDto(o));
  }

  private async vatRate(): Promise<number> {
    return this.settings.getNumber('vat_rate', 21);
  }

  private buildAmounts(base: number, vatRate: number) {
    const round2 = (n: number) => Math.round(n * 100) / 100;
    const vat = round2((base * vatRate) / 100);
    return { base: round2(base), vat, total: round2(base + vat) };
  }

  async purchaseCredits(companyId: string, input: PurchaseCreditsInput): Promise<BillingOrderDto> {
    const pkg = await this.prisma.creditPackage.findUnique({ where: { id: input.creditPackageId } });
    if (!pkg || !pkg.isActive) {
      throw new HttpException(
        { code: ERROR_CODES.CREDIT_PACKAGE_INACTIVE, message: 'Credit package not available' },
        409,
      );
    }
    const vatRate = await this.vatRate();
    const a = this.buildAmounts(pkg.priceRon, vatRate);
    const order = await this.prisma.mockBillingOrder.create({
      data: {
        companyId,
        orderType: 'CREDIT_PACKAGE',
        creditPackageId: pkg.id,
        credits: pkg.credits,
        baseAmountRon: new Prisma.Decimal(a.base),
        vatRate: new Prisma.Decimal(vatRate),
        vatAmountRon: new Prisma.Decimal(a.vat),
        totalRon: new Prisma.Decimal(a.total),
      },
    });
    return this.toDto(order);
  }

  async purchaseSubscription(companyId: string, input: PurchaseSubscriptionInput): Promise<BillingOrderDto> {
    const plan = await this.prisma.subscriptionPlan.findUnique({ where: { id: input.planId } });
    if (!plan || !plan.isActive) {
      throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'Plan not found' });
    }
    const vatRate = await this.vatRate();
    const a = this.buildAmounts(plan.priceRon, vatRate);
    const order = await this.prisma.mockBillingOrder.create({
      data: {
        companyId,
        orderType: 'SUBSCRIPTION',
        planId: plan.id,
        credits: plan.includedCredits,
        baseAmountRon: new Prisma.Decimal(a.base),
        vatRate: new Prisma.Decimal(vatRate),
        vatAmountRon: new Prisma.Decimal(a.vat),
        totalRon: new Prisma.Decimal(a.total),
      },
    });
    return this.toDto(order);
  }

  // 3.7 — confirmare plata (source: admin | webhook). Emite factura + livreaza beneficiul.
  async confirm(orderId: string, source: 'admin' | 'webhook'): Promise<BillingOrderDto> {
    const existing = await this.prisma.mockBillingOrder.findUnique({ where: { id: orderId } });
    if (!existing) {
      throw new NotFoundException({ code: ERROR_CODES.PAYMENT_NOT_FOUND, message: 'Order not found' });
    }
    if (existing.status !== 'PENDING') {
      throw new HttpException(
        { code: ERROR_CODES.PAYMENT_ALREADY_CONFIRMED, message: 'Order already processed' },
        409,
      );
    }
    const series = await this.settings.getString('invoice_series', 'MM');
    const seller = {
      name: await this.settings.getString('seller_name', 'Marketplace Mobilier SRL'),
      cui: await this.settings.getString('seller_cui', ''),
      regCom: await this.settings.getString('seller_reg_com', ''),
      address: await this.settings.getString('seller_address', ''),
      iban: await this.settings.getString('seller_iban', ''),
    };

    const updated = await this.prisma.$transaction(async (tx) => {
      // numerotare secventiala per serie (backstop: @@unique invoiceSeries+invoiceNumber).
      const agg = await tx.mockBillingOrder.aggregate({
        where: { invoiceSeries: series, invoiceNumber: { not: null } },
        _max: { invoiceNumber: true },
      });
      const invoiceNumber = (agg._max.invoiceNumber ?? 0) + 1;
      const order = await tx.mockBillingOrder.update({
        where: { id: orderId },
        data: {
          status: 'CONFIRMED',
          confirmedAt: new Date(),
          paymentSource: source,
          invoiceSeries: series,
          invoiceNumber,
          sellerSnapshot: seller as unknown as Prisma.InputJsonValue,
        },
      });
      // livrare beneficiu
      if (order.orderType === 'CREDIT_PACKAGE' && order.credits) {
        await this.credits.grant(order.companyId, order.credits, 'CREDIT_PURCHASE', tx);
      } else if (order.orderType === 'SUBSCRIPTION' && order.planId) {
        const now = new Date();
        const expiresAt = new Date(now.getTime() + SUBSCRIPTION_DAYS * 24 * 60 * 60 * 1000);
        await tx.subscription.create({
          data: { companyId: order.companyId, planId: order.planId, status: 'ACTIVE', startedAt: now, expiresAt },
        });
        if (order.credits) {
          await this.credits.grant(order.companyId, order.credits, 'SUBSCRIPTION_CREDITS', tx);
        }
      }
      return order;
    });
    return this.toDto(updated);
  }

  async adminListPending(): Promise<AdminBillingOrderItemDto[]> {
    const rows = await this.prisma.mockBillingOrder.findMany({
      where: { status: 'PENDING' },
      orderBy: { createdAt: 'asc' },
      include: { company: true },
    });
    return rows.map((o) => ({
      id: o.id,
      companyName: o.company.name,
      orderType: o.orderType,
      credits: o.credits,
      totalRon: Number(o.totalRon),
      createdAt: o.createdAt.toISOString(),
    }));
  }

  async getOrderForCompany(companyId: string, orderId: string): Promise<MockBillingOrder> {
    const order = await this.prisma.mockBillingOrder.findUnique({ where: { id: orderId } });
    if (!order || order.companyId !== companyId) {
      throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'Order not found' });
    }
    return order;
  }

  toDto(o: MockBillingOrder): BillingOrderDto {
    const label =
      o.invoiceSeries && o.invoiceNumber !== null ? `${o.invoiceSeries}-${o.invoiceNumber}` : null;
    return {
      id: o.id,
      orderType: o.orderType,
      status: o.status,
      credits: o.credits,
      baseAmountRon: Number(o.baseAmountRon),
      vatRate: Number(o.vatRate),
      vatAmountRon: Number(o.vatAmountRon),
      totalRon: Number(o.totalRon),
      invoiceSeries: o.invoiceSeries,
      invoiceNumber: o.invoiceNumber,
      invoiceLabel: label,
      createdAt: o.createdAt.toISOString(),
      confirmedAt: o.confirmedAt?.toISOString() ?? null,
    };
  }
}

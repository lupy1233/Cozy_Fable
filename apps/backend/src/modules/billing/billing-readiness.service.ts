import { HttpException, Injectable } from '@nestjs/common';
import {
  ERROR_CODES,
  SELLER_FIELDS,
  isValidIban,
  isValidRoCui,
  normalizeIban,
  type BillingReadinessDto,
  type SellerDetailsDto,
  type SellerField,
  type SellerProblemReason,
} from '@marketplace/shared';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { runTxBatch } from '../../infra/prisma/tx';
import { StripeService } from './stripe.service';
import { SELLER_SEED_PLACEHOLDERS, SELLER_SETTING_KEYS, type SellerSnapshot } from './billing-readiness';

export interface SellerProblem {
  field: SellerField;
  reason: SellerProblemReason;
}

export interface BillingReadiness {
  ready: boolean;
  problems: SellerProblem[];
  seller: SellerSnapshot;
}

// E-admin-platform-4 — nicio factura (si nicio incasare) fara date fiscale reale ale
// platformei: campuri completate, fara valorile de exemplu din seed, CUI cu cifra de control
// valida si IBAN valid (mod-97). Pana atunci cumpararile si confirmarile raspund 503.
@Injectable()
export class BillingReadinessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stripe: StripeService,
  ) {}

  // Un singur SELECT pentru toate cele 5 chei (latenta cross-region, nu 5 getString).
  async readSeller(): Promise<SellerSnapshot> {
    const rows = await this.prisma.systemSetting.findMany({
      where: { key: { in: Object.values(SELLER_SETTING_KEYS) } },
      select: { key: true, value: true },
    });
    const byKey = new Map(rows.map((r) => [r.key, r.value]));
    const seller = {} as SellerSnapshot;
    for (const field of SELLER_FIELDS) seller[field] = byKey.get(SELLER_SETTING_KEYS[field]) ?? '';
    return seller;
  }

  static normalize(seller: SellerSnapshot): SellerSnapshot {
    return {
      name: seller.name.trim(),
      cui: seller.cui.trim().toUpperCase(),
      regCom: seller.regCom.trim(),
      address: seller.address.trim(),
      iban: normalizeIban(seller.iban),
    };
  }

  // Pura: problemele fiecarui camp (MISSING > PLACEHOLDER > INVALID).
  static evaluate(seller: SellerSnapshot): SellerProblem[] {
    const n = BillingReadinessService.normalize(seller);
    const problems: SellerProblem[] = [];
    for (const field of SELLER_FIELDS) {
      const value = n[field];
      const placeholder =
        field === 'iban' ? normalizeIban(SELLER_SEED_PLACEHOLDERS.iban) : SELLER_SEED_PLACEHOLDERS[field];
      if (!value) problems.push({ field, reason: 'MISSING' });
      else if (value.toLowerCase() === placeholder.toLowerCase()) problems.push({ field, reason: 'PLACEHOLDER' });
      else if ((field === 'cui' && !isValidRoCui(value)) || (field === 'iban' && !isValidIban(value))) {
        problems.push({ field, reason: 'INVALID' });
      }
    }
    return problems;
  }

  async check(): Promise<BillingReadiness> {
    const raw = await this.readSeller();
    const problems = BillingReadinessService.evaluate(raw);
    return { ready: problems.length === 0, problems, seller: BillingReadinessService.normalize(raw) };
  }

  async assertReady(): Promise<SellerSnapshot> {
    const { ready, seller } = await this.check();
    if (!ready) {
      throw new HttpException(
        { code: ERROR_CODES.BILLING_NOT_CONFIGURED, message: 'Billing details are not configured' },
        503,
      );
    }
    return seller;
  }

  async getReadinessDto(): Promise<BillingReadinessDto> {
    const [readiness, eInvoicePendingCount] = await Promise.all([
      this.check(),
      // null + numar fiscal = confirmata de un slot vechi (blue/green) → tot "de raportat"
      this.prisma.mockBillingOrder.count({
        where: {
          status: 'CONFIRMED',
          testMode: false,
          invoiceNumber: { not: null },
          OR: [{ eInvoiceStatus: 'PENDING' }, { eInvoiceStatus: null }],
        },
      }),
    ]);
    return {
      ready: readiness.ready,
      problems: readiness.problems,
      stripeMode: this.stripe.mode(),
      eInvoicePendingCount,
    };
  }

  // Valorile brute curente (chiar si placeholderele) pentru precompletarea formularului.
  async getSellerForAdmin(): Promise<SellerDetailsDto> {
    return this.readSeller();
  }

  async updateSeller(input: SellerDetailsDto, adminId?: string): Promise<BillingReadinessDto> {
    const raw: SellerSnapshot = {
      name: input.name ?? '',
      cui: input.cui ?? '',
      regCom: input.regCom ?? '',
      address: input.address ?? '',
      iban: input.iban ?? '',
    };
    const problems = BillingReadinessService.evaluate(raw);
    if (problems.length) {
      throw new HttpException(
        { code: ERROR_CODES.VALIDATION_ERROR, message: 'Invalid billing details', details: problems },
        400,
      );
    }
    // CUI pastrat cum l-a scris adminul (cu 'RO' daca e platitor de TVA), IBAN normalizat.
    const seller = BillingReadinessService.normalize(raw);
    await runTxBatch(this.prisma, SELLER_FIELDS.map((field) => {
      const key = SELLER_SETTING_KEYS[field];
      const value = seller[field];
      return this.prisma.systemSetting.upsert({
        where: { key },
        update: { value, updatedBy: adminId ?? null },
        create: { key, value, updatedBy: adminId ?? null },
      });
    }));
    return this.getReadinessDto();
  }
}

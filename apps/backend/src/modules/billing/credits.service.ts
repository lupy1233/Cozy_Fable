import { HttpException, Injectable } from '@nestjs/common';
import {
  ERROR_CODES,
  type CreditGrantReason,
  type CreditReserveReason,
  type CreditSettlementReason,
  type CreditWalletDto,
} from '@marketplace/shared';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';

// Semantica portofel (4.8):
//  balance  = credite libere, utilizabile
//  reserved = credite tinute de claim-uri active (RESERVE)
//  total detinut = balance + reserved
// RESERVE: balance -= n, reserved += n (cere balance >= n)
// REFUND:  reserved -= n, balance += n (anulare valida / edit post-claim)
// CONSUME: reserved -= n (consum definitiv la finalizare)
// GRANT:   balance += n (trial / top-up)
type Tx = Prisma.TransactionClient;

@Injectable()
export class CreditsService {
  constructor(private readonly prisma: PrismaService) {}

  // Creeaza portofelul daca lipseste (idempotent). Folosit la approve firma.
  async ensureWallet(companyId: string, tx: Tx): Promise<void> {
    await tx.companyCreditWallet.upsert({
      where: { companyId },
      update: {},
      create: { companyId, balance: 0, reserved: 0 },
    });
  }

  async grant(companyId: string, amount: number, reason: CreditGrantReason, tx: Tx): Promise<void> {
    await this.ensureWallet(companyId, tx);
    await tx.companyCreditWallet.update({
      where: { companyId },
      data: { balance: { increment: amount } },
    });
    await tx.creditTransaction.create({
      data: { companyId, type: 'GRANT', amount, reason },
    });
  }

  // Rezerva credite la claim; arunca INSUFFICIENT_CREDITS daca soldul liber e prea mic.
  async reserve(
    companyId: string,
    amount: number,
    reason: CreditReserveReason,
    claimSlotId: string,
    tx: Tx,
  ): Promise<void> {
    const wallet = await tx.companyCreditWallet.findUnique({ where: { companyId } });
    if (!wallet || wallet.balance < amount) {
      throw new HttpException(
        { code: ERROR_CODES.INSUFFICIENT_CREDITS, message: 'Not enough credits' },
        402,
      );
    }
    await tx.companyCreditWallet.update({
      where: { companyId },
      data: { balance: { decrement: amount }, reserved: { increment: amount } },
    });
    await tx.creditTransaction.create({
      data: { companyId, type: 'RESERVE', amount, reason, claimSlotId },
    });
  }

  // Refund la anulare valida / edit post-claim: reserved → balance.
  // E-admin-platform-15: apelat DOAR din ClaimSettlementService (regula ESLint).
  // updateMany CONDITIONAT pe reserved >= amount: portofel deviat → false, fara rand in
  // ledger (nu mai arunca pe CHECK-ul reserved >= 0; raportul zilnic semnaleaza deviatia).
  async refund(
    companyId: string,
    amount: number,
    reason: CreditSettlementReason,
    claimSlotId: string,
    tx: Tx,
  ): Promise<boolean> {
    const res = await tx.companyCreditWallet.updateMany({
      where: { companyId, reserved: { gte: amount } },
      data: { reserved: { decrement: amount }, balance: { increment: amount } },
    });
    if (res.count === 0) return false;
    await tx.creditTransaction.create({
      data: { companyId, type: 'REFUND', amount, reason, claimSlotId },
    });
    return true;
  }

  // Consum definitiv la finalizare: scade din reserved fara intoarcere.
  // E-admin-platform-15: apelat DOAR din ClaimSettlementService (regula ESLint); acelasi
  // update conditionat ca la refund.
  async consume(
    companyId: string,
    amount: number,
    reason: CreditSettlementReason,
    claimSlotId: string,
    tx: Tx,
  ): Promise<boolean> {
    const res = await tx.companyCreditWallet.updateMany({
      where: { companyId, reserved: { gte: amount } },
      data: { reserved: { decrement: amount } },
    });
    if (res.count === 0) return false;
    await tx.creditTransaction.create({
      data: { companyId, type: 'CONSUME', amount, reason, claimSlotId },
    });
    return true;
  }

  async getWallet(companyId: string): Promise<CreditWalletDto> {
    const wallet = await this.prisma.companyCreditWallet.findUnique({ where: { companyId } });
    const balance = wallet?.balance ?? 0;
    const reserved = wallet?.reserved ?? 0;
    return { companyId, balance, reserved, available: balance };
  }
}

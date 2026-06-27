import { HttpException, Injectable } from '@nestjs/common';
import { ERROR_CODES, type CreditWalletDto } from '@marketplace/shared';
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

  async grant(companyId: string, amount: number, reason: string, tx: Tx): Promise<void> {
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
    reason: string,
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
  async refund(
    companyId: string,
    amount: number,
    reason: string,
    claimSlotId: string,
    tx: Tx,
  ): Promise<void> {
    await tx.companyCreditWallet.update({
      where: { companyId },
      data: { reserved: { decrement: amount }, balance: { increment: amount } },
    });
    await tx.creditTransaction.create({
      data: { companyId, type: 'REFUND', amount, reason, claimSlotId },
    });
  }

  // Consum definitiv la finalizare: scade din reserved fara intoarcere.
  async consume(
    companyId: string,
    amount: number,
    reason: string,
    claimSlotId: string,
    tx: Tx,
  ): Promise<void> {
    await tx.companyCreditWallet.update({
      where: { companyId },
      data: { reserved: { decrement: amount } },
    });
    await tx.creditTransaction.create({
      data: { companyId, type: 'CONSUME', amount, reason, claimSlotId },
    });
  }

  async getWallet(companyId: string): Promise<CreditWalletDto> {
    const wallet = await this.prisma.companyCreditWallet.findUnique({ where: { companyId } });
    const balance = wallet?.balance ?? 0;
    const reserved = wallet?.reserved ?? 0;
    return { companyId, balance, reserved, available: balance };
  }
}

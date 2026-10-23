import { Injectable, Logger } from '@nestjs/common';
import type { CreditSettlementReason } from '@marketplace/shared';
import type { ClaimSlotStatus, Prisma } from '@prisma/client';
import { closeOpenQuotesForSlot } from '../claims/claims.helpers';
import { CreditsService } from './credits.service';

type Tx = Prisma.TransactionClient;

export type TerminalClaimSlotStatus = Exclude<ClaimSlotStatus, 'ACTIVE' | 'OFFER_SENT'>;
export type SettlementCreditOutcome = 'REFUND' | 'CONSUME';
// ce se intampla cu ofertele slotului: WITHDRAWN/SUPERSEDED = ofertele deschise primesc
// statusul final + chat read-only; CHAT_READ_ONLY = doar chat-ul; KEEP = nimic.
export type SettlementQuotes = 'WITHDRAWN' | 'SUPERSEDED' | 'CHAT_READ_ONLY' | 'KEEP';
export type SettlementCredit =
  | 'REFUNDED'
  | 'CONSUMED'
  | 'SKIPPED_NO_RESERVE'
  | 'SKIPPED_ALREADY_SETTLED'
  | 'SKIPPED_WALLET_DRIFT';

export interface SettledSlot {
  id: string;
  companyId: string;
  requestId: string;
  claimCostCreditsSnapshot: number;
}

export interface SettleArgs {
  claimSlotId: string;
  // statusurile deschise din care slotul are voie sa plece (biletul de decontare)
  from: ClaimSlotStatus[];
  to: TerminalClaimSlotStatus;
  outcome: SettlementCreditOutcome;
  // motivul din ledger (credit_transactions.reason)
  reason: CreditSettlementReason;
  // filtre atomice suplimentare, evaluate in ACELASI UPDATE (ex. fara retragere PENDING)
  where?: Prisma.ClaimSlotWhereInput;
  quotes: SettlementQuotes;
  // slotul deja citit de apelant — evita o recitire (latenta cross-region)
  slot?: Omit<SettledSlot, 'id'>;
}

export type SettleResult =
  | { settled: false }
  | {
      settled: true;
      slot: SettledSlot;
      credit: SettlementCredit;
      refunded: boolean;
      amount: number;
    };

// E-admin-platform-15 — calea UNICA de decontare a unei rezervari de credite (IMPACT credite
// pct. 2/8). Apelantul tine deja SELECT ... FOR UPDATE pe cerere, in runTx 'claim'
// (Serializable, invarianta 3.1). Ordinea:
//  1. tranzitia conditionata a slotului (updateMany pe statusul deschis) = biletul; count 0 →
//     { settled: false }, nimic altceva nu se atinge;
//  2. ofertele / chat-ul dupa modul cerut;
//  3. ledger-ul e adevarul: fara RESERVE (date demo / vechi) → fara bani; REFUND/CONSUME deja
//     existent → fara bani; altfel exact un refund SAU un consume pe suma RESERVE-ului;
//     portofel deviat (reserved sub suma) → fara bani, raportat de verificarea zilnica.
// Tranzitia de status se comite in toate cazurile — jobul nu mai esueaza pe veci (LIVE-11).
// Singurul loc din cod care apeleaza credits.refund/consume (regula ESLint).
@Injectable()
export class ClaimSettlementService {
  private readonly logger = new Logger(ClaimSettlementService.name);

  constructor(private readonly credits: CreditsService) {}

  async settle(tx: Tx, args: SettleArgs): Promise<SettleResult> {
    const res = await tx.claimSlot.updateMany({
      where: { ...(args.where ?? {}), id: args.claimSlotId, status: { in: args.from } },
      // COMPLETED nu e o retragere → fara withdrawnAt (ca in fulfillment)
      data: { status: args.to, ...(args.to === 'COMPLETED' ? {} : { withdrawnAt: new Date() }) },
    });
    if (res.count === 0) return { settled: false };

    const slot: SettledSlot = args.slot
      ? {
          id: args.claimSlotId,
          companyId: args.slot.companyId,
          requestId: args.slot.requestId,
          claimCostCreditsSnapshot: args.slot.claimCostCreditsSnapshot,
        }
      : await tx.claimSlot.findUniqueOrThrow({
          where: { id: args.claimSlotId },
          select: { id: true, companyId: true, requestId: true, claimCostCreditsSnapshot: true },
        });

    if (args.quotes === 'WITHDRAWN' || args.quotes === 'SUPERSEDED') {
      await closeOpenQuotesForSlot(tx, slot.id, args.quotes);
    } else if (args.quotes === 'CHAT_READ_ONLY') {
      await tx.chatThread.updateMany({ where: { claimSlotId: slot.id }, data: { readOnly: true } });
    }

    const { credit, amount } = await this.moveCredits(tx, slot, args);
    return { settled: true, slot, credit, refunded: credit === 'REFUNDED', amount };
  }

  private async moveCredits(
    tx: Tx,
    slot: SettledSlot,
    args: SettleArgs,
  ): Promise<{ credit: SettlementCredit; amount: number }> {
    const rows = await tx.creditTransaction.findMany({
      where: { claimSlotId: slot.id, type: { in: ['RESERVE', 'REFUND', 'CONSUME'] } },
      select: { type: true, amount: true },
    });
    const reserve = rows.find((r) => r.type === 'RESERVE');
    if (!reserve) {
      this.logger.warn(`settle ${slot.id} → ${args.to}: fara RESERVE in ledger, fara miscare de credite`);
      return { credit: 'SKIPPED_NO_RESERVE', amount: 0 };
    }
    if (rows.some((r) => r.type === 'REFUND' || r.type === 'CONSUME')) {
      this.logger.error(`settle ${slot.id} → ${args.to}: rezervare deja decontata, fara miscare de credite`);
      return { credit: 'SKIPPED_ALREADY_SETTLED', amount: 0 };
    }
    const amount = reserve.amount;
    if (amount !== slot.claimCostCreditsSnapshot) {
      this.logger.warn(
        `settle ${slot.id}: RESERVE ${amount} difera de snapshot ${slot.claimCostCreditsSnapshot}; se foloseste ledger-ul`,
      );
    }
    const moved =
      args.outcome === 'REFUND'
        ? await this.credits.refund(slot.companyId, amount, args.reason, slot.id, tx)
        : await this.credits.consume(slot.companyId, amount, args.reason, slot.id, tx);
    if (!moved) {
      this.logger.error(
        `settle ${slot.id} → ${args.to}: portofelul firmei ${slot.companyId} nu acopera ${amount} (reserved deviat), fara miscare de credite`,
      );
      return { credit: 'SKIPPED_WALLET_DRIFT', amount: 0 };
    }
    return { credit: args.outcome === 'REFUND' ? 'REFUNDED' : 'CONSUMED', amount };
  }
}

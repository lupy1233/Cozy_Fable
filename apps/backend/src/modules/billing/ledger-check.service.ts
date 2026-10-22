import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { runTx } from '../../infra/prisma/tx';
import { OutboxService } from '../outbox/outbox.service';

// plafon per lista in raport (totalurile raman exacte)
const LIST_CAP = 100;
// conventia din prisma/cleanup-demo.ts
const DEMO_EMAIL_PATTERN = '%@demo.ro';

export interface LedgerWalletMismatch {
  companyId: string;
  balance: number;
  reserved: number;
  ledgerBalance: number;
  ledgerReserved: number;
}

export interface LedgerSlotRef {
  claimSlotId: string;
  status: string;
}

export interface LedgerCheckReport {
  checkedAt: string;
  walletsChecked: number;
  // firme cu TOTI membrii @demo.ro (seed-demo scrie soldul fara GRANT): doar identitatea
  // balance e sarita; reserved si regulile pe slot se verifica pentru toate firmele
  demoBalanceSkipped: number;
  walletMismatches: LedgerWalletMismatch[];
  unsettledTerminalSlots: LedgerSlotRef[];
  openSlotsWithSettlement: LedgerSlotRef[];
  totals: { walletMismatches: number; unsettledTerminalSlots: number; openSlotsWithSettlement: number };
}

interface WalletRow {
  company_id: string;
  balance: number;
  reserved: number;
  ledger_balance: number;
  ledger_reserved: number;
  is_demo: boolean;
}

interface SlotRow {
  id: string;
  status: string;
  kind: 'UNSETTLED_TERMINAL' | 'OPEN_WITH_SETTLEMENT';
}

// Data calendaristica Europe/Bucharest (YYYY-MM-DD) — cheia zilnica a alertei.
export function bucharestDate(now: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Bucharest',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

// E-admin-platform-15 — verificarea zilnica ledger vs portofel (IMPACT credite pct. 7).
// Doar citiri; NU misca bani si nu corecteaza nimic (repararea portofelelor deviate = decizie PO).
//  - portofel: reserved == RESERVE - REFUND - CONSUME (toate firmele);
//              balance == GRANT - RESERVE + REFUND (firmele non-demo);
//  - sloturi: terminal cu RESERVE dar fara REFUND/CONSUME (rezervare vie pe slot inchis);
//             deschis (ACTIVE/OFFER_SENT) cu REFUND/CONSUME (decontat prea devreme).
@Injectable()
export class LedgerCheckService {
  private readonly logger = new Logger(LedgerCheckService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
  ) {}

  async check(now: Date = new Date()): Promise<LedgerCheckReport> {
    const wallets = await this.prisma.$queryRaw<WalletRow[]>(Prisma.sql`
      WITH ledger AS (
        SELECT company_id,
          COALESCE(SUM(amount) FILTER (WHERE type = 'GRANT'), 0)::int AS g,
          COALESCE(SUM(amount) FILTER (WHERE type = 'RESERVE'), 0)::int AS r,
          COALESCE(SUM(amount) FILTER (WHERE type = 'REFUND'), 0)::int AS f,
          COALESCE(SUM(amount) FILTER (WHERE type = 'CONSUME'), 0)::int AS c
        FROM credit_transactions
        GROUP BY company_id
      ), demo AS (
        SELECT m.company_id
        FROM company_members m
        JOIN users u ON u.id = m.user_id
        GROUP BY m.company_id
        HAVING bool_and(u.email LIKE ${DEMO_EMAIL_PATTERN})
      )
      SELECT w.company_id,
        w.balance,
        w.reserved,
        (COALESCE(l.g, 0) - COALESCE(l.r, 0) + COALESCE(l.f, 0))::int AS ledger_balance,
        (COALESCE(l.r, 0) - COALESCE(l.f, 0) - COALESCE(l.c, 0))::int AS ledger_reserved,
        (d.company_id IS NOT NULL) AS is_demo
      FROM company_credit_wallets w
      LEFT JOIN ledger l ON l.company_id = w.company_id
      LEFT JOIN demo d ON d.company_id = w.company_id
    `);

    const slots = await this.prisma.$queryRaw<SlotRow[]>(Prisma.sql`
      SELECT s.id, s.status::text AS status,
        CASE WHEN s.status IN ('ACTIVE', 'OFFER_SENT') THEN 'OPEN_WITH_SETTLEMENT' ELSE 'UNSETTLED_TERMINAL' END AS kind
      FROM claim_slots s
      WHERE (
        s.status NOT IN ('ACTIVE', 'OFFER_SENT')
        AND EXISTS (SELECT 1 FROM credit_transactions t WHERE t.claim_slot_id = s.id AND t.type = 'RESERVE')
        AND NOT EXISTS (SELECT 1 FROM credit_transactions t WHERE t.claim_slot_id = s.id AND t.type IN ('REFUND', 'CONSUME'))
      ) OR (
        s.status IN ('ACTIVE', 'OFFER_SENT')
        AND EXISTS (SELECT 1 FROM credit_transactions t WHERE t.claim_slot_id = s.id AND t.type IN ('REFUND', 'CONSUME'))
      )
      ORDER BY s.id
    `);

    const mismatches: LedgerWalletMismatch[] = [];
    let demoBalanceSkipped = 0;
    for (const w of wallets) {
      const reservedOk = Number(w.reserved) === Number(w.ledger_reserved);
      const balanceOk = w.is_demo || Number(w.balance) === Number(w.ledger_balance);
      if (w.is_demo && Number(w.balance) !== Number(w.ledger_balance)) demoBalanceSkipped++;
      if (reservedOk && balanceOk) continue;
      mismatches.push({
        companyId: w.company_id,
        balance: Number(w.balance),
        reserved: Number(w.reserved),
        ledgerBalance: Number(w.ledger_balance),
        ledgerReserved: Number(w.ledger_reserved),
      });
    }
    const toRef = (s: SlotRow): LedgerSlotRef => ({ claimSlotId: s.id, status: s.status });
    const unsettled = slots.filter((s) => s.kind === 'UNSETTLED_TERMINAL');
    const openSettled = slots.filter((s) => s.kind === 'OPEN_WITH_SETTLEMENT');

    return {
      checkedAt: now.toISOString(),
      walletsChecked: wallets.length,
      demoBalanceSkipped,
      walletMismatches: mismatches.slice(0, LIST_CAP),
      unsettledTerminalSlots: unsettled.slice(0, LIST_CAP).map(toRef),
      openSlotsWithSettlement: openSettled.slice(0, LIST_CAP).map(toRef),
      totals: {
        walletMismatches: mismatches.length,
        unsettledTerminalSlots: unsettled.length,
        openSlotsWithSettlement: openSettled.length,
      },
    };
  }

  // Jobul zilnic: raport + o singura alerta pe zi catre admini (clopotel, fara email).
  // Payload-ul are DOAR numaratori (fara id-uri de firme / sume).
  async runAndAlert(now: Date): Promise<LedgerCheckReport> {
    const report = await this.check(now);
    const { totals } = report;
    const bad = totals.walletMismatches + totals.unsettledTerminalSlots + totals.openSlotsWithSettlement;
    if (bad === 0) {
      this.logger.log(
        `ledger-check OK (wallets=${report.walletsChecked}, demoBalanceSkipped=${report.demoBalanceSkipped})`,
      );
      return report;
    }
    this.logger.error(`ledger-check MISMATCH ${JSON.stringify({ ...totals, demoBalanceSkipped: report.demoBalanceSkipped })}`);
    const checkedOn = bucharestDate(now);
    await runTx(this.prisma, 'write', async (tx) => {
      const admins = await tx.user.findMany({ where: { role: 'ADMIN', deletedAt: null }, select: { id: true } });
      await this.outbox.record(
        tx,
        `credits.ledger_mismatch:${checkedOn}`,
        'credits.ledger_mismatch',
        {
          checkedOn,
          walletMismatches: totals.walletMismatches,
          unsettledTerminalSlots: totals.unsettledTerminalSlots,
          openSlotsWithSettlement: totals.openSlotsWithSettlement,
        },
        admins.map((a) => a.id),
      );
    });
    return report;
  }
}

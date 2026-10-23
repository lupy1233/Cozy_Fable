import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, type OnModuleInit } from '@nestjs/common';
import type { Job, Queue } from 'bullmq';
import { OutboxService } from '../outbox/outbox.service';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { activeSubscriptionWhere } from '../entitlements/entitlements.service';
import { runTx } from '../../infra/prisma/tx';
import { QUEUE_SUBSCRIPTION_EXPIRY } from '../../infra/queues/queues.module';
import { daysLeftOf } from './subscriptions.service';
import { billingManagerIds } from './billing-recipients';
import { BankTransferService } from './bank-transfer.service';

// L1 (audit 2026-08-23): abonamentul expira "prin surprindere" — firma descoperea ecranul
// de blocaj abia cand incerca sa intre in marketplace. Job zilnic (07:00 UTC ≈ 09-10 ora
// Bucurestiului) care anunta firmele cu abonamentul aproape de expirare, la pragurile de
// 7 / 3 / 1 zile ramase (fiecare prag se atinge o singura data pe zi → fara duplicate).
const EXPIRY_WARNING_DAYS = [7, 3, 1];
// E-company-24: aceeasi coada duce si scanarea orara a comenzilor prin transfer bancar
// (reminder + anulare automata; oprita cat timp setarile sunt 0).
export const JOB_BANK_TRANSFER_EXPIRY = 'bank-transfer-expiry';

@Processor(QUEUE_SUBSCRIPTION_EXPIRY)
export class SubscriptionExpiryProcessor extends WorkerHost implements OnModuleInit {
  private readonly logger = new Logger(SubscriptionExpiryProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
    private readonly bankTransfer: BankTransferService,
    @InjectQueue(QUEUE_SUBSCRIPTION_EXPIRY) private readonly queue: Queue,
  ) {
    super();
  }

  async onModuleInit(): Promise<void> {
    // repeatable cu cheie stabila → idempotent la restart (nu se dubleaza scheduler-ul)
    await this.queue.add(
      'check',
      {},
      { repeat: { pattern: '0 7 * * *' }, removeOnComplete: true, removeOnFail: true },
    );
    // E-company-24: scanarea transferurilor bancare — orar + o rulare la boot. Citeste
    // created_at, deci e propria reconciliere (CONCEPT SLA si joburi, regula 4).
    await this.queue.add(
      JOB_BANK_TRANSFER_EXPIRY,
      {},
      { repeat: { pattern: '15 * * * *' }, removeOnComplete: true, removeOnFail: true },
    );
    await this.queue.add(
      JOB_BANK_TRANSFER_EXPIRY,
      {},
      { jobId: 'bank-transfer-expiry-boot', removeOnComplete: true, removeOnFail: true },
    );
  }

  async process(job: Job): Promise<void> {
    if (job.name === JOB_BANK_TRANSFER_EXPIRY) {
      const r = await this.bankTransfer.sweep();
      if (r.reminded > 0 || r.cancelled > 0) {
        this.logger.log(`bank transfer sweep: reminded=${r.reminded} cancelled=${r.cancelled}`);
      }
      return;
    }
    const now = new Date();
    const subs = await this.prisma.subscription.findMany({
      where: activeSubscriptionWhere(now),
      include: { company: { select: { id: true, name: true, deletedAt: true } } },
      orderBy: { expiresAt: 'desc' },
    });
    // per firma conteaza DOAR randul cu expirarea cea mai tarzie (prelungirile scriu
    // acelasi rand, dar istoric pot exista mai multe).
    const latestByCompany = new Map<string, (typeof subs)[number]>();
    for (const s of subs) {
      if (!latestByCompany.has(s.companyId)) latestByCompany.set(s.companyId, s);
    }
    let notified = 0;
    for (const sub of latestByCompany.values()) {
      if (sub.company.deletedAt) continue;
      const days = daysLeftOf(sub.expiresAt, now);
      if (!EXPIRY_WARNING_DAYS.includes(days)) continue;
      await runTx(this.prisma, 'write', async (tx) => {
        const current = await tx.subscription.findFirst({ where: { id: sub.id, status: 'ACTIVE', expiresAt: sub.expiresAt } });
        if (!current) return;
        // E-company-24: doar OWNER/MANAGER (cine poate prelungi abonamentul)
        const managers = await billingManagerIds(tx, sub.companyId);
        await this.outbox.record(tx, `subscription.expiring:${sub.id}:${sub.expiresAt.toISOString()}:${days}`, 'subscription.expiring', {
          companyId: sub.companyId, daysLeft: days, expiresAt: sub.expiresAt.toISOString(),
        }, managers);
      });
      notified += 1;
    }
    if (notified > 0) this.logger.log(`subscription expiry warnings sent: ${notified}`);
  }
}

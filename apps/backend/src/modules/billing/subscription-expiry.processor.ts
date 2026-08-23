import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, type OnModuleInit } from '@nestjs/common';
import type { Job, Queue } from 'bullmq';
import { EventBusService } from '../../infra/event-bus/event-bus.service';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { QUEUE_SUBSCRIPTION_EXPIRY } from '../../infra/queues/queues.module';
import { daysLeftOf } from './subscriptions.service';

// L1 (audit 2026-08-23): abonamentul expira "prin surprindere" — firma descoperea ecranul
// de blocaj abia cand incerca sa intre in marketplace. Job zilnic (07:00 UTC ≈ 09-10 ora
// Bucurestiului) care anunta firmele cu abonamentul aproape de expirare, la pragurile de
// 7 / 3 / 1 zile ramase (fiecare prag se atinge o singura data pe zi → fara duplicate).
const EXPIRY_WARNING_DAYS = [7, 3, 1];

@Processor(QUEUE_SUBSCRIPTION_EXPIRY)
export class SubscriptionExpiryProcessor extends WorkerHost implements OnModuleInit {
  private readonly logger = new Logger(SubscriptionExpiryProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
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
  }

  async process(_job: Job): Promise<void> {
    const now = new Date();
    const subs = await this.prisma.subscription.findMany({
      where: { status: 'ACTIVE', expiresAt: { gt: now } },
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
      const members = await this.prisma.companyMember.findMany({
        where: { companyId: sub.companyId },
        select: { userId: true },
      });
      if (members.length === 0) continue;
      await this.eventBus.publish(
        'subscription.expiring',
        {
          companyId: sub.companyId,
          companyName: sub.company.name,
          daysLeft: days,
          expiresAt: sub.expiresAt.toISOString(),
        },
        members.map((m) => m.userId),
      );
      notified += 1;
    }
    if (notified > 0) this.logger.log(`subscription expiry warnings sent: ${notified}`);
  }
}

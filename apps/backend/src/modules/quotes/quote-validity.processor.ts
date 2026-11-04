import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job, Queue } from 'bullmq';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { runTx } from '../../infra/prisma/tx';
import { QUEUE_OFFER_EXPIRY_SETTLEMENT, QUEUE_QUOTE_VALIDITY } from '../../infra/queues/queues.module';
import { SettingsService } from '../../common/settings/settings.service';
import { OutboxService } from '../outbox/outbox.service';
import {
  offerExpirySettlementJobId,
  readAutoCloseSettings,
  type OfferExpirySettlementJob,
} from '../claims/offer-expiry-settlement.processor';
import { QuotesService } from './quotes.service';

export interface QuoteValidityJob {
  quoteVersionId: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

// D-v6-7 — la valid_until, daca versiunea e inca cea curenta a unei oferte SENT si nu a fost
// extinsa (Buton A), oferta trece EXPIRED. Firma vede reofertarea cu 2 butoane.
// E-admin-platform-3: expirarea e anuntata TINTIT (quote.expired, client + membrii firmei);
// pentru client e reminderul ca oferta nu mai poate fi acceptata (poate cere prelungirea) si
// poarta data inchiderii automate cand aceasta e activata din setari.
@Processor(QUEUE_QUOTE_VALIDITY)
export class QuoteValidityProcessor extends WorkerHost {
  private readonly logger = new Logger(QuoteValidityProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly quotes: QuotesService,
    private readonly outbox: OutboxService,
    private readonly settings: SettingsService,
    @InjectQueue(QUEUE_OFFER_EXPIRY_SETTLEMENT)
    private readonly settlementQueue: Queue<OfferExpirySettlementJob>,
  ) {
    super();
  }

  async process(job: Job<QuoteValidityJob>): Promise<void> {
    const { quoteVersionId } = job.data;
    const autoClose = await readAutoCloseSettings(this.settings);
    const expired = await runTx(this.prisma, 'write', async (tx) => {
      const version = await tx.quoteVersion.findUnique({ where: { id: quoteVersionId } });
      if (!version) return null;
      const quote = await tx.quote.findUnique({
        where: { id: version.quoteId },
        include: {
          versions: { select: { id: true, version: true } },
          request: { select: { clientUserId: true } },
        },
      });
      if (!quote || quote.status !== 'SENT') return null;
      const latest = quote.versions.reduce((a, b) => (b.version > a.version ? b : a));
      if (latest.id !== version.id) return null; // a aparut o versiune mai noua
      if (version.validUntil.getTime() > Date.now()) return null; // extinsa intre timp
      // updateMany conditionat (R3, audit 2026-08-23): acceptul (Serializable) poate comite
      // ACCEPTED intre citirea de mai sus si scriere — un update neconditionat ar suprascrie
      // ACCEPTED cu EXPIRED si markDelivered nu ar mai gasi oferta → livrare blocata pe veci.
      const res = await tx.quote.updateMany({
        where: { id: quote.id, status: 'SENT' },
        data: { status: 'EXPIRED' },
      });
      if (res.count === 0) return null;
      const autoCloseAt = autoClose
        ? new Date(version.validUntil.getTime() + autoClose.days * DAY_MS)
        : null;
      // cheie determinista pe (versiune, valid_until): o prelungire urmata de o noua expirare
      // produce o notificare noua; retry-ul aceluiasi job nu dubleaza.
      await this.outbox.record(tx, `quote.expired:${version.id}:${version.validUntil.getTime()}`,
        'quote.expired',
        {
          quoteId: quote.id,
          requestId: quote.requestId,
          claimSlotId: quote.claimSlotId,
          companyId: quote.companyId,
          clientUserId: quote.request.clientUserId,
          autoCloseAt: autoCloseAt?.toISOString() ?? null,
        },
        await this.quotes.participantsFor(quote.id, tx),
      );
      return { quoteId: quote.id, validUntil: version.validUntil, autoCloseAt };
    });

    if (!expired) return;
    this.logger.debug(`quote ${expired.quoteId} expired (validity)`);
    if (expired.autoCloseAt) {
      // best-effort dupa commit; sweep-ul de reconciliere re-inarmeaza jobul pierdut
      await this.settlementQueue
        .add(
          'settle',
          { quoteId: expired.quoteId },
          {
            delay: Math.max(0, expired.autoCloseAt.getTime() - Date.now()),
            jobId: offerExpirySettlementJobId(expired.quoteId, expired.validUntil),
            removeOnComplete: true,
            removeOnFail: 1000,
            attempts: 3,
            backoff: { type: 'exponential', delay: 2000 },
          },
        )
        .catch(() => this.logger.warn(`Offer expiry settlement scheduling deferred for ${expired.quoteId}`));
    }
  }
}

import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { QUEUE_QUOTE_VALIDITY } from '../../infra/queues/queues.module';
import { QuotesService } from './quotes.service';

export interface QuoteValidityJob {
  quoteVersionId: string;
}

// D-v6-7 — la valid_until, daca versiunea e inca cea curenta a unei oferte SENT si nu a fost
// extinsa (Buton A), oferta trece EXPIRED. Firma vede reofertarea cu 2 butoane.
@Processor(QUEUE_QUOTE_VALIDITY)
export class QuoteValidityProcessor extends WorkerHost {
  private readonly logger = new Logger(QuoteValidityProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly quotes: QuotesService,
  ) {
    super();
  }

  async process(job: Job<QuoteValidityJob>): Promise<void> {
    const { quoteVersionId } = job.data;
    const expiredQuoteId = await this.prisma.$transaction(async (tx) => {
      const version = await tx.quoteVersion.findUnique({ where: { id: quoteVersionId } });
      if (!version) return null;
      const quote = await tx.quote.findUnique({
        where: { id: version.quoteId },
        include: { versions: { select: { id: true, version: true } } },
      });
      if (!quote || quote.status !== 'SENT') return null;
      const latest = quote.versions.reduce((a, b) => (b.version > a.version ? b : a));
      if (latest.id !== version.id) return null; // a aparut o versiune mai noua
      if (version.validUntil.getTime() > Date.now()) return null; // extinsa intre timp
      await tx.quote.update({ where: { id: quote.id }, data: { status: 'EXPIRED' } });
      return quote.id;
    });

    if (expiredQuoteId) {
      await this.quotes.publishQuoteUpdated(expiredQuoteId);
      this.logger.debug(`quote ${expiredQuoteId} expired (validity)`);
    }
  }
}

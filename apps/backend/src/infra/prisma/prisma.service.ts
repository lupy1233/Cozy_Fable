import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  Optional,
} from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { slowQueryLogger } from './slow-query';
import { softDeleteReads } from './soft-delete';
import { WRITE_TX_OPTIONS } from './tx-options';

// Token optional: in aplicatie nu e furnizat (DI trece undefined); specurile de integrare
// construiesc direct `new PrismaService({ datasources })`.
export const PRISMA_CLIENT_OPTIONS = 'PRISMA_CLIENT_OPTIONS';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('PrismaService');
  private readPolicyRegistered = false;

  // E-company-2: plafon global maxWait 5 s / timeout 20 s pentru tranzactiile interactive
  // (Prisma combina per cheie cu optiunile per apel → claim/accept raman la 10 s). E-admin-platform-54:
  // codul de domeniu trece prin runTx(profil) din tx.ts; plafonul global ramane plasa.
  constructor(@Optional() @Inject(PRISMA_CLIENT_OPTIONS) options?: Prisma.PrismaClientOptions) {
    super({
      ...(options ?? {}),
      transactionOptions: { ...WRITE_TX_OPTIONS, ...(options?.transactionOptions ?? {}) },
    });
  }

  async onModuleInit() {
    if (!this.readPolicyRegistered) {
      // E-admin-platform-8: primul inregistrat = cel mai exterior → masoara tot lantul
      this.$use(slowQueryLogger((m) => this.logger.warn(m)));
      this.$use(softDeleteReads);
      this.readPolicyRegistered = true;
    }
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}

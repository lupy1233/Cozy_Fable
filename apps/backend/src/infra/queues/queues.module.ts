import { BullModule } from '@nestjs/bullmq';
import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export const QUEUE_NOTIFICATIONS = 'notifications';
export const QUEUE_REQUEST_EXPIRATION = 'request-expiration';
export const QUEUE_CLAIM_ASSIGN = 'claim-assign';
export const QUEUE_QUOTE_VALIDITY = 'quote-validity';
export const QUEUE_CONSULTATION_EXPIRY = 'consultation-expiry';
export const QUEUE_SLA_BREACH = 'sla-breach';
export const QUEUE_WITHDRAWAL_REMINDER = 'withdrawal-reminder';
export const QUEUE_SUBSCRIPTION_EXPIRY = 'subscription-expiry';
export const QUEUE_DELIVERY_AUTOCOMPLETE = 'delivery-autocomplete';
export const QUEUE_RECONCILIATION = 'reconciliation';
export const QUEUE_UPLOADS = 'uploads';
export const QUEUE_DOMAIN_EVENTS = 'domain-events';
// E-admin-platform-3: inchiderea automata (gated prin setari) a ofertelor expirate fara decizie
export const QUEUE_OFFER_EXPIRY_SETTLEMENT = 'offer-expiry-settlement';
// E-admin-platform-3: reminder firma inainte de data livrarii + anunt de termen depasit
export const QUEUE_PROJECT_DEADLINES = 'project-deadlines';

@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        defaultJobOptions: { attempts: 3, backoff: { type: 'exponential', delay: 2000 }, removeOnFail: 1000 },
        connection: {
          host: config.getOrThrow<string>('REDIS_HOST'),
          port: config.getOrThrow<number>('REDIS_PORT'),
          password: config.get<string>('REDIS_PASSWORD') || undefined,
          family: 0, // dual-stack DNS (IPv6 private networking pe hosting managed)
        },
      }),
    }),
    BullModule.registerQueue({ name: QUEUE_NOTIFICATIONS }),
    BullModule.registerQueue({ name: QUEUE_REQUEST_EXPIRATION }),
    BullModule.registerQueue({ name: QUEUE_CLAIM_ASSIGN }),
    BullModule.registerQueue({ name: QUEUE_QUOTE_VALIDITY }),
    BullModule.registerQueue({ name: QUEUE_CONSULTATION_EXPIRY }),
    BullModule.registerQueue({ name: QUEUE_SLA_BREACH }),
    BullModule.registerQueue({ name: QUEUE_WITHDRAWAL_REMINDER }),
    BullModule.registerQueue({ name: QUEUE_SUBSCRIPTION_EXPIRY }),
    BullModule.registerQueue({ name: QUEUE_DELIVERY_AUTOCOMPLETE }),
    BullModule.registerQueue({ name: QUEUE_RECONCILIATION }),
    BullModule.registerQueue({ name: QUEUE_UPLOADS }),
    BullModule.registerQueue({ name: QUEUE_DOMAIN_EVENTS }),
    BullModule.registerQueue({ name: QUEUE_OFFER_EXPIRY_SETTLEMENT }),
    BullModule.registerQueue({ name: QUEUE_PROJECT_DEADLINES }),
  ],
  exports: [BullModule],
})
export class QueuesModule {}

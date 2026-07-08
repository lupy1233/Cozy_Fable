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

@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
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
  ],
  exports: [BullModule],
})
export class QueuesModule {}

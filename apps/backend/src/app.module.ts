import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { randomUUID } from 'crypto';
import { validateConfig } from './config/config.schema';
import { SettingsModule } from './common/settings/settings.module';
import { CalendarModule } from './infra/calendar/calendar.module';
import { EventBusModule } from './infra/event-bus/event-bus.module';
import { MailModule } from './infra/mail/mail.module';
import { PrismaModule } from './infra/prisma/prisma.module';
import { QueuesModule } from './infra/queues/queues.module';
import { RedisModule } from './infra/redis/redis.module';
import { StorageModule } from './infra/storage/storage.module';
import { AdminModule } from './modules/admin/admin.module';
import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { BillingModule } from './modules/billing/billing.module';
import { ChatModule } from './modules/chat/chat.module';
import { FulfillmentModule } from './modules/fulfillment/fulfillment.module';
import { ClaimsModule } from './modules/claims/claims.module';
import { CompaniesModule } from './modules/companies/companies.module';
import { HealthModule } from './modules/health/health.module';
import { InspirationModule } from './modules/inspiration/inspiration.module';
import { StudioModule } from './modules/studio/studio.module';
import { MarketplaceModule } from './modules/marketplace/marketplace.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { PenaltiesModule } from './modules/penalties/penalties.module';
import { QuotesModule } from './modules/quotes/quotes.module';
import { RequestsModule } from './modules/requests/requests.module';
import { UploadsModule } from './modules/uploads/uploads.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateConfig }),
    // Logging structurat JSON cu traceId per request (invarianta 3.11)
    LoggerModule.forRoot({
      pinoHttp: {
        genReqId: (req) => (req.headers['x-trace-id'] as string) ?? randomUUID(),
        autoLogging: true,
        // referer poate contine ?token= (reset-password / verify-email) cand API-ul e same-origin
        redact: ['req.headers.authorization', 'req.headers.cookie', 'req.headers.referer', 'req.headers.referrer'],
        transport:
          process.env.NODE_ENV === 'development' ? { target: 'pino-pretty' } : undefined,
      },
    }),
    // Rate limit global 100/min per IP (invarianta 3.13); limite per-ruta cu @Throttle
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    PrismaModule,
    RedisModule,
    StorageModule,
    MailModule,
    QueuesModule,
    CalendarModule,
    EventBusModule,
    SettingsModule,
    AuditModule,
    AuthModule,
    BillingModule,
    CompaniesModule,
    RequestsModule,
    UploadsModule,
    MarketplaceModule,
    ClaimsModule,
    ChatModule,
    QuotesModule,
    PenaltiesModule,
    FulfillmentModule,
    NotificationsModule,
    AdminModule,
    InspirationModule,
    StudioModule,
    HealthModule,
  ],
})
export class AppModule {}

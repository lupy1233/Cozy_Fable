import { Module, RequestMethod } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import type Redis from 'ioredis';
import { LoggerModule } from 'nestjs-pino';
import { healthAwareLogLevel, requestTraceId, routeProps, safeRequestLog, safeResponseLog } from './common/logging/safe-http';
import { safeErrorSummary } from './common/logging/safe-error';
import { validateConfig } from './config/config.schema';
import { DeploymentStandbyGuard } from './common/guards/deployment-standby.guard';
import { SettingsModule } from './common/settings/settings.module';
import { CalendarModule } from './infra/calendar/calendar.module';
import { EventBusModule } from './infra/event-bus/event-bus.module';
import { MailModule } from './infra/mail/mail.module';
import { PrismaModule } from './infra/prisma/prisma.module';
import { QueuesModule } from './infra/queues/queues.module';
import { REDIS_CLIENT, RedisModule } from './infra/redis/redis.module';
import { RedisThrottlerStorage } from './common/throttler/redis-throttler.storage';
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
import { LegalModule } from './modules/legal/legal.module';
import { PenaltiesModule } from './modules/penalties/penalties.module';
import { QuotesModule } from './modules/quotes/quotes.module';
import { RequestsModule } from './modules/requests/requests.module';
import { UploadsModule } from './modules/uploads/uploads.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateConfig }),
    // Logging structurat JSON cu traceId per request (invarianta 3.11)
    // E-admin-platform-8: forRootAsync pentru LOG_LEVEL din config; routePattern in linia de acces
    // (in loc de 'unmatched') si sondele de health reusite nu se mai logheaza.
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        // E-admin-platform-56 (Nest 11 / Express 5): wildcard numit; implicitul '*' al nestjs-pino
        // declanseaza LegacyRouteConverter la fiecare boot.
        forRoutes: [{ path: '{*path}', method: RequestMethod.ALL }],
        pinoHttp: {
          level: config.get<string>('LOG_LEVEL', 'info'),
          genReqId: (req) => requestTraceId(req.headers['x-trace-id']),
          serializers: { req: safeRequestLog, res: safeResponseLog, err: (error: unknown) => ({ summary: safeErrorSummary(error) }) },
          customProps: (req) => routeProps(req as never),
          customLogLevel: (req, res, err) => healthAwareLogLevel(req, res, err),
          autoLogging: true,
          // referer poate contine ?token= (reset-password / verify-email) cand API-ul e same-origin
          redact: ['req.headers.authorization', 'req.headers.cookie', 'req.headers.referer', 'req.headers.referrer', 'res.headers["set-cookie"]', 'req.headers["x-health-token"]'],
          transport:
            process.env.NODE_ENV === 'development' ? { target: 'pino-pretty' } : undefined,
        },
      }),
    }),
    // Rate limit global 100/min per IP client (invarianta 3.13); limite per-ruta cu @Throttle.
    // E-admin-platform-5: contorul sta in Redis (partajat intre procese/sloturi, fallback in
    // memorie la eroare/timeout); THROTTLER_STORE=memory il tine per proces. Tracker-ul (IP-ul
    // real al clientului) e in ClientIpThrottlerGuard (auth.module).
    ThrottlerModule.forRootAsync({
      inject: [ConfigService, REDIS_CLIENT],
      useFactory: (config: ConfigService, redis: Redis) => ({
        throttlers: [{ ttl: 60_000, limit: 100 }],
        storage:
          config.get<string>('THROTTLER_STORE') === 'memory' ? undefined : new RedisThrottlerStorage(redis),
      }),
    }),
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
    LegalModule,
    InspirationModule,
    StudioModule,
    HealthModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: DeploymentStandbyGuard }],
})
export class AppModule {}

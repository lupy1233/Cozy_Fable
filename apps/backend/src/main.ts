import { Logger as NestLogger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { clientIpMiddleware } from './common/http/client-ip';
import { RedisIoAdapter } from './infra/socket/redis-io.adapter';
import { initErrorTracking } from './infra/monitoring/error-tracking';

async function bootstrap() {
  // rawBody: webhook-ul Stripe verifica semnatura pe corpul brut (req.rawBody)
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
    rawBody: true,
  });
  // Draftul include raspunsuri + scene (max 300 kB); pastram rawBody pentru Stripe.
  app.useBodyParser('json', { limit: '1mb' });
  app.useLogger(app.get(Logger));

  const config = app.get(ConfigService);
  // E-admin-platform-8: tracker de erori (no-op fara SENTRY_DSN)
  initErrorTracking(config);

  app.setGlobalPrefix('api/v1');
  // Lantul de productie: client -> edge Railway -> gateway Caddy -> Next (:3000) -> rewrite
  // loopback -> Nest. Avem incredere DOAR in hop-ul loopback (Next), deci req.ip = ultimul IP
  // din X-Forwarded-For. Caddy (fara trusted_proxies) rescrie insa XFF cu adresa conexiunii
  // directe, asa ca req.ip e adresa edge-ului/proxy-ului, nu a clientului (SEC2-3).
  // IP-ul real vine din headerul edge-ului DOAR cand TRUSTED_CLIENT_IP_HEADER e setat dupa
  // testul de spoofing (E-admin-platform-5, common/http/client-ip.ts). `true` ar crede toate
  // hop-urile si un client putea ocoli throttlingul cu un XFF fals (audit 2026-08-19).
  app.set('trust proxy', 'loopback');
  const trustedClientIpHeader = config.get<string>('TRUSTED_CLIENT_IP_HEADER');
  app.use(clientIpMiddleware(trustedClientIpHeader));
  if (config.get<string>('NODE_ENV') === 'production' && !trustedClientIpHeader) {
    new NestLogger('Bootstrap').warn(
      'TRUSTED_CLIENT_IP_HEADER unset: rate limits and audit IPs key on the proxy address',
    );
  }
  app.use(helmet());
  app.use(cookieParser()); // tokens in cookies httpOnly (3.5/3.13)
  const allowedOrigins = new Set([
    new URL(config.getOrThrow<string>('FRONTEND_ORIGIN')).origin,
    ...config.get<string[]>('FRONTEND_PREVIEW_ORIGINS', []),
  ]);
  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.has(origin)) callback(null, true);
      else callback(new Error('CORS origin denied'));
    },
    credentials: true,
  });

  // ValidationPipe global (whitelist + transform) — cerut din Sprint 2, montat de acum
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());

  // Socket.IO Redis adapter — obligatoriu de la Sprint 1 (invarianta 3.5)
  const redisAdapter = new RedisIoAdapter(app);
  await redisAdapter.connectToRedis(
    config.getOrThrow<string>('REDIS_HOST'),
    config.getOrThrow<number>('REDIS_PORT'),
    config.get<string>('REDIS_PASSWORD'),
  );
  app.useWebSocketAdapter(redisAdapter);

  app.enableShutdownHooks();
  // E-admin-platform-56: in containerul combinat Nest asculta doar pe loopback (LISTEN_HOST=127.0.0.1);
  // nesetat = toate interfetele (dev/compose).
  const port = config.getOrThrow<number>('PORT');
  const host = config.get<string>('LISTEN_HOST');
  await (host ? app.listen(port, host) : app.listen(port));
}

void bootstrap();

import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { RedisIoAdapter } from './infra/socket/redis-io.adapter';

async function bootstrap() {
  // rawBody: webhook-ul Stripe verifica semnatura pe corpul brut (req.rawBody)
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
    rawBody: true,
  });
  app.useLogger(app.get(Logger));

  const config = app.get(ConfigService);

  app.setGlobalPrefix('api/v1');
  // In productie stam dupa edge proxy + rewrite-ul Next (acelasi container, loopback).
  // Avem incredere DOAR in hop-ul loopback (Next): req.ip = ultimul IP din
  // X-Forwarded-For, scris de edge-ul Railway. `true` ar fi avut incredere in toate
  // hop-urile si un client putea ocoli throttlingul per-IP cu un XFF fals (audit 2026-08-19).
  app.set('trust proxy', 'loopback');
  app.use(helmet());
  app.use(cookieParser()); // tokens in cookies httpOnly (3.5/3.13)
  app.enableCors({
    origin: config.getOrThrow<string>('FRONTEND_ORIGIN'),
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
  await app.listen(config.getOrThrow<number>('PORT'));
}

void bootstrap();

import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { RedisIoAdapter } from './infra/socket/redis-io.adapter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));

  const config = app.get(ConfigService);

  app.setGlobalPrefix('api/v1');
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
  );
  app.useWebSocketAdapter(redisAdapter);

  app.enableShutdownHooks();
  await app.listen(config.getOrThrow<number>('PORT'));
}

void bootstrap();

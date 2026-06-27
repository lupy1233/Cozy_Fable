import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerGuard } from '@nestjs/throttler';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from './guards/optional-jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { TwoFactorGuard } from './guards/two-factor.guard';
import { TokenService } from './token.service';
import { TwoFactorService } from './two-factor.service';

@Module({
  imports: [JwtModule.register({})], // secret/expiry per-sign (token.service)
  controllers: [AuthController],
  providers: [
    AuthService,
    TokenService,
    TwoFactorService,
    JwtAuthGuard,
    OptionalJwtAuthGuard,
    RolesGuard,
    TwoFactorGuard,
    // Guards globale, in ordine: rate limit → auth → roluri (route protection Sprint 2)
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
  exports: [JwtModule, JwtAuthGuard, OptionalJwtAuthGuard, RolesGuard, TwoFactorGuard, TokenService],
})
export class AuthModule {}

import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ClientIpThrottlerGuard, UserThrottlerGuard } from '../../common/throttler/client-ip-throttler.guard';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { LoginLockoutService } from './login-lockout.service';
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
    LoginLockoutService,
    // E-admin-platform-5: limita per user (change-password), folosit doar ca guard de ruta
    UserThrottlerGuard,
    // Guards globale, in ordine: rate limit → auth → roluri (route protection Sprint 2)
    // E-admin-platform-5: rate limit per IP-ul real al clientului (nu adresa proxy-ului)
    { provide: APP_GUARD, useClass: ClientIpThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
  exports: [JwtModule, JwtAuthGuard, OptionalJwtAuthGuard, RolesGuard, TwoFactorGuard, TokenService],
})
export class AuthModule {}

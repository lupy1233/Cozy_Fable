import { CanActivate, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// Invarianta 3.13: 2FA implementat arhitectural dar INACTIV in MVP.
// Guard-ul e no-op cat timp TWO_FACTOR_FEATURE_ENABLED=false.
@Injectable()
export class TwoFactorGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(): boolean {
    const enabled = this.config.get<boolean>('TWO_FACTOR_FEATURE_ENABLED');
    if (!enabled) return true; // no-op flag off
    // Verificarea efectiva 2FA per sesiune se face la login (AuthService);
    // accesul pe rute nu e re-verificat in MVP.
    return true;
  }
}

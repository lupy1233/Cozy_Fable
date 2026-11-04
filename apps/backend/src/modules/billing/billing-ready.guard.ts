import { CanActivate, Injectable } from '@nestjs/common';
import { BillingReadinessService } from './billing-readiness.service';

// E-admin-platform-4 — cumpararile (credite, abonament, "Continua plata") sunt oprite cu
// 503 BILLING_NOT_CONFIGURED pana cand datele fiscale ale platformei sunt reale. Garda
// ruleaza inaintea IdempotencyInterceptor, deci un 503 nu consuma Idempotency-Key.
@Injectable()
export class BillingReadyGuard implements CanActivate {
  constructor(private readonly readiness: BillingReadinessService) {}

  async canActivate(): Promise<boolean> {
    await this.readiness.assertReady();
    return true;
  }
}

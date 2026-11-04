import { Module } from '@nestjs/common';
import { EntitlementsService } from './entitlements.service';
import { PlanFeatureGuard } from './plan-feature.guard';

// E-admin-platform-58: modul mic (depinde doar de PrismaService global) — il importa billing,
// admin, claims si marketplace fara sa traga BillingModule.
@Module({
  providers: [EntitlementsService, PlanFeatureGuard],
  exports: [EntitlementsService, PlanFeatureGuard],
})
export class EntitlementsModule {}

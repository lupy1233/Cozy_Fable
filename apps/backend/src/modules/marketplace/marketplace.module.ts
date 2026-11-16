import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { UploadsModule } from '../uploads/uploads.module';
import { EntitlementsModule } from '../entitlements/entitlements.module';
import { SizingModule } from '../sizing/sizing.module';
import { ConfiguratorService } from '../requests/configurator.service';
import { MarketplaceController } from './marketplace.controller';
import { MarketplaceService } from './marketplace.service';
import { MarketplaceBudgetEstimator } from './marketplace-budget-estimate';
import { CompanyApprovedGuard } from '../../common/guards/company-approved.guard';
import { SubscriptionActiveGuard } from '../../common/guards/subscription-active.guard';

@Module({
  imports: [AuthModule, UploadsModule, EntitlementsModule, SizingModule],
  controllers: [MarketplaceController],
  // ConfiguratorService (fara dependente) — doar pentru estimarea din raspunsuri (b11)
  providers: [
    MarketplaceService,
    ConfiguratorService,
    MarketplaceBudgetEstimator,
    CompanyApprovedGuard,
    SubscriptionActiveGuard,
  ],
  // g1-2 (etapa 9): anunturile de cereri noi refolosesc lista din marketplace
  exports: [MarketplaceService],
})
export class MarketplaceModule {}

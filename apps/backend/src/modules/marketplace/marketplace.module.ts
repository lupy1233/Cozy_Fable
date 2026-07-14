import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { UploadsModule } from '../uploads/uploads.module';
import { MarketplaceController } from './marketplace.controller';
import { MarketplaceService } from './marketplace.service';
import { CompanyApprovedGuard } from '../../common/guards/company-approved.guard';
import { SubscriptionActiveGuard } from '../../common/guards/subscription-active.guard';

@Module({
  imports: [AuthModule, UploadsModule],
  controllers: [MarketplaceController],
  providers: [MarketplaceService, CompanyApprovedGuard, SubscriptionActiveGuard],
  exports: [MarketplaceService],
})
export class MarketplaceModule {}

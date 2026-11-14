import { Module } from '@nestjs/common';
import { UploadsService } from './uploads.service';
import { UploadsProcessor } from './uploads.processor';
import { PortfolioImagesService } from './portfolio-images.service';
import { activeOnlyProviders } from '../../config/deployment-mode';

@Module({
  providers: [UploadsService, PortfolioImagesService, ...activeOnlyProviders(UploadsProcessor)],
  exports: [UploadsService, PortfolioImagesService],
})
export class UploadsModule {}

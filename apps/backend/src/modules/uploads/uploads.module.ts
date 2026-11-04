import { Module } from '@nestjs/common';
import { UploadsService } from './uploads.service';
import { UploadsProcessor } from './uploads.processor';
import { activeOnlyProviders } from '../../config/deployment-mode';

@Module({
  providers: [UploadsService, ...activeOnlyProviders(UploadsProcessor)],
  exports: [UploadsService],
})
export class UploadsModule {}

import { Module } from '@nestjs/common';
import { SizingService } from './sizing.service';

@Module({
  providers: [SizingService],
  exports: [SizingService],
})
export class SizingModule {}

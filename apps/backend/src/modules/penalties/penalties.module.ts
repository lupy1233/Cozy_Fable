import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PenaltiesController } from './penalties.controller';
import { PenaltiesService } from './penalties.service';

@Module({
  imports: [AuthModule],
  controllers: [PenaltiesController],
  providers: [PenaltiesService],
  exports: [PenaltiesService],
})
export class PenaltiesModule {}

import { Module } from '@nestjs/common';
import { StudioController } from './studio.controller';
import { StudioService } from './studio.service';

// Studio 3D (mod Sims): drafturile salvate in cont — CRUD simplu per user,
// continut JSON validat cu schema partajata (studio.schemas din shared).
@Module({
  controllers: [StudioController],
  providers: [StudioService],
})
export class StudioModule {}

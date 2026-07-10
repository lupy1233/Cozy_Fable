import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { UploadsModule } from '../uploads/uploads.module';
import { InspirationBoardsService } from './boards.service';
import {
  InspirationAdminController,
  InspirationBoardsController,
  InspirationController,
} from './inspiration.controller';
import { InspirationService } from './inspiration.service';

// Galeria de inspiratie (F6, item 3) + colectiile de salvari (item 8):
// CRUD admin, listare publica cu filtre, boards per utilizator.
@Module({
  imports: [AuthModule, UploadsModule],
  controllers: [InspirationController, InspirationBoardsController, InspirationAdminController],
  providers: [InspirationService, InspirationBoardsService],
  exports: [InspirationService],
})
export class InspirationModule {}

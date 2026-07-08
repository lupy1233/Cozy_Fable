import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { UploadsModule } from '../uploads/uploads.module';
import { InspirationAdminController, InspirationController } from './inspiration.controller';
import { InspirationService } from './inspiration.service';

// Galeria de inspiratie (F6, item 3): CRUD admin + listare publica cu filtre.
@Module({
  imports: [AuthModule, UploadsModule],
  controllers: [InspirationController, InspirationAdminController],
  providers: [InspirationService],
  exports: [InspirationService],
})
export class InspirationModule {}

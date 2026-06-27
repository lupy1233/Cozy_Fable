import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { UploadsModule } from '../uploads/uploads.module';
import { CompanyApprovedGuard } from '../../common/guards/company-approved.guard';
import { ChatController, CompanyChatController } from './chat.controller';
import { ChatService } from './chat.service';

@Module({
  imports: [AuthModule, UploadsModule],
  controllers: [ChatController, CompanyChatController],
  providers: [ChatService, CompanyApprovedGuard],
  exports: [ChatService],
})
export class ChatModule {}

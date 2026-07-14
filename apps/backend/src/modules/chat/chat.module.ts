import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { UploadsModule } from '../uploads/uploads.module';
import { CompanyApprovedGuard } from '../../common/guards/company-approved.guard';
import { ChatController, CompanyChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { MessageCryptoService } from './message-crypto.service';

@Module({
  imports: [AuthModule, UploadsModule],
  controllers: [ChatController, CompanyChatController],
  providers: [ChatService, MessageCryptoService, CompanyApprovedGuard],
  exports: [ChatService],
})
export class ChatModule {}

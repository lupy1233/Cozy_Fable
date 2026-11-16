import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { OutboxModule } from '../outbox/outbox.module';
import { UploadsModule } from '../uploads/uploads.module';
import { CompanyApprovedGuard } from '../../common/guards/company-approved.guard';
import { ChatController, CompanyChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { MessageCryptoService } from './message-crypto.service';

@Module({
  imports: [AuthModule, OutboxModule, UploadsModule],
  controllers: [ChatController, CompanyChatController],
  providers: [ChatService, MessageCryptoService, CompanyApprovedGuard],
  // a4: MessageCryptoService exportat pentru mesajele de sistem scrise de QuotesService
  exports: [ChatService, MessageCryptoService],
})
export class ChatModule {}

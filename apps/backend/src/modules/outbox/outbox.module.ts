import { Module } from '@nestjs/common';
import { OutboxService } from './outbox.service';
import { OutboxProcessor } from './outbox.processor';
import { activeOnlyProviders } from '../../config/deployment-mode';

@Module({ providers: [OutboxService, ...activeOnlyProviders(OutboxProcessor)], exports: [OutboxService] })
export class OutboxModule {}

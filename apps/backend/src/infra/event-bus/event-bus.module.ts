import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { EventBusService } from './event-bus.service';
import { EventsGateway } from './events.gateway';

@Global()
@Module({
  imports: [JwtModule.register({})], // pentru verificarea access tokenului la handshake
  providers: [EventsGateway, EventBusService],
  exports: [EventBusService],
})
export class EventBusModule {}

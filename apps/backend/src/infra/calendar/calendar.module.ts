import { Global, Module } from '@nestjs/common';
import { BusinessCalendarService } from './business-calendar.service';

@Global()
@Module({
  providers: [BusinessCalendarService],
  exports: [BusinessCalendarService],
})
export class CalendarModule {}

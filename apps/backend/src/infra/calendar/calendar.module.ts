import { Global, Module } from '@nestjs/common';
import { BusinessCalendarService } from './business-calendar.service';
import { CalendarSyncService } from './calendar-sync.service';

@Global()
@Module({
  providers: [BusinessCalendarService, CalendarSyncService],
  exports: [BusinessCalendarService, CalendarSyncService],
})
export class CalendarModule {}

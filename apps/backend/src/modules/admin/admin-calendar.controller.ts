import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query, UseInterceptors } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { Audit } from '../audit/audit.decorator';
import { AuditInterceptor } from '../audit/audit.interceptor';
import { AdminCalendarService } from './admin-calendar.service';
import {
  AdminCalendarQueryDto,
  CalendarCheckQueryDto,
  CreateCalendarHolidayDto,
  UpdateCalendarHolidayDto,
} from './dto/admin-calendar.dto';

// E-admin-platform-25: calendarul de lucru (sarbatori mobile + punti). Mutatiile sunt
// auditate si reincarca cache-ul pe ambele sloturi (CalendarSyncService); pe slotul standby
// POST/PATCH/DELETE raspund 503 (DeploymentStandbyGuard).
@Controller('admin/calendar')
@Roles(UserRole.ADMIN)
@UseInterceptors(AuditInterceptor)
export class AdminCalendarController {
  constructor(private readonly calendar: AdminCalendarService) {}

  @Get()
  overview(@Query() query: AdminCalendarQueryDto) {
    return this.calendar.overview(query.year);
  }

  @Get('check')
  check(@Query() query: CalendarCheckQueryDto) {
    return this.calendar.check(query.from, query.workingDays);
  }

  @Post()
  @Audit('CALENDAR_HOLIDAY_CREATED', 'business_calendar_holiday')
  create(@Body() dto: CreateCalendarHolidayDto) {
    return this.calendar.create(dto);
  }

  @Patch(':id')
  @Audit('CALENDAR_HOLIDAY_UPDATED', 'business_calendar_holiday')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCalendarHolidayDto) {
    return this.calendar.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(200)
  @Audit('CALENDAR_HOLIDAY_DELETED', 'business_calendar_holiday')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.calendar.remove(id);
  }
}

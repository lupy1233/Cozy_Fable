import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';

// E-admin-platform-25: calendarul de lucru. Oglinda createCalendarHolidaySchema /
// updateCalendarHolidaySchema (shared).
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export class AdminCalendarQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2024)
  @Max(2100)
  year?: number;
}

export class CreateCalendarHolidayDto {
  @Matches(DATE_ONLY)
  date: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name: string;

  @IsBoolean()
  isWorkingDay: boolean;
}

export class UpdateCalendarHolidayDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsBoolean()
  isWorkingDay?: boolean;
}

export class CalendarCheckQueryDto {
  @Matches(DATE_ONLY)
  from: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(30)
  workingDays: number;
}

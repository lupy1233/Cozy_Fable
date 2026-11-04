import { Type } from 'class-transformer';
import {
  ADMIN_REQUEST_FILTERS,
  PROJECT_CASE_REASONS,
  SETTLEMENT_OUTCOMES,
  type AdminRequestFilter,
  type ProjectCaseReason,
  type SettlementOutcome,
} from '@marketplace/shared';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateReviewDto {
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;
}

export class ResolveDisputeDto {
  @IsIn(['RESOLVED', 'DISMISSED'])
  status: 'RESOLVED' | 'DISMISSED';

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  resolutionNote?: string;
}

// E-admin-platform-3 — proiect acceptat blocat (raport / raspuns / inchidere admin).
export class OpenProjectCaseDto {
  @IsIn(PROJECT_CASE_REASONS)
  reason: ProjectCaseReason;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class RespondProjectCaseDto {
  @IsBoolean()
  confirmCancel: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class CloseProjectDto {
  // fara valoare implicita: adminul alege explicit REFUND sau CONSUME
  @IsIn(SETTLEMENT_OUTCOMES)
  creditOutcome: SettlementOutcome;

  @IsString()
  @MinLength(10)
  @MaxLength(1000)
  adminNote: string;
}

export class DismissProjectCaseDto {
  @IsString()
  @MinLength(10)
  @MaxLength(1000)
  adminNote: string;
}

export class AdminRequestsQueryDto {
  @IsOptional()
  @IsIn(ADMIN_REQUEST_FILTERS)
  filter?: AdminRequestFilter;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10_000)
  page?: number;
}

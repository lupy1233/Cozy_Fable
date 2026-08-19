import { IsBoolean, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

// Admin: acordare / prelungire manuala abonament (L0-D). Oglinda grantSubscriptionSchema (shared).
export class GrantSubscriptionDto {
  @IsUUID()
  companyId: string;

  @IsUUID()
  planId: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(366)
  days?: number;

  @IsOptional()
  @IsBoolean()
  includeCredits?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

import { UserRole } from '@prisma/client';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Min, MaxLength } from 'class-validator';

// Pasul 6 (D-L1-2): filtrele listei de utilizatori din consola admin.
export class AdminUsersQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;
}

export class UpdateSettingDto {
  @IsString()
  @MaxLength(500)
  value: string;
}

export class UpdatePenaltyRuleDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  points?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpsertCreditPackageDto {
  @IsInt()
  @Min(1)
  credits: number;

  @IsInt()
  @Min(1)
  priceRon: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateCreditPackageDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  credits?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  priceRon?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdatePlanDto {
  @IsOptional() @IsInt() @Min(1) priceRon?: number;
  @IsOptional() @IsInt() @Min(0) includedCredits?: number;
  @IsOptional() @IsInt() @Min(0) marketplaceGatingDelayMin?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class UpdateThresholdDto {
  @IsOptional() @IsInt() @Min(0) minScore?: number;
  @IsOptional() @IsInt() @Min(0) maxScore?: number | null;
}

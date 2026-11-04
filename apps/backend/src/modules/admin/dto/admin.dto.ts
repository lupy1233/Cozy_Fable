import { UserRole } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDefined,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { PLAN_CODE_RE } from '@marketplace/shared';

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

// E-admin-platform-58 — planuri ca date (oglinda createPlanSchema / updatePlanSchema din shared).
export class PlanFeatureToggleDto {
  @IsBoolean() enabled: boolean;
}

export class PlanFeatureUpdateDto {
  @IsBoolean() enabled: boolean;
  // limita tehnica INT4 (coloana limit_value), ca sa nu ajunga un 500 din Postgres
  @IsOptional() @IsInt() @Min(0) @Max(2_147_483_647) limit?: number | null;
}

// la creare accesul la marketplace e obligatoriu (alegere explicita a adminului)
export class CreatePlanFeaturesDto {
  @IsDefined() @ValidateNested() @Type(() => PlanFeatureToggleDto) MARKETPLACE_ACCESS: PlanFeatureToggleDto;
}

export class UpdatePlanFeaturesDto {
  @IsOptional() @ValidateNested() @Type(() => PlanFeatureUpdateDto) MARKETPLACE_ACCESS?: PlanFeatureUpdateDto;
}

export class CreatePlanDto {
  @IsString() @Matches(PLAN_CODE_RE) code: string;
  @IsOptional() @IsString() @MaxLength(60) nameRo?: string;
  @IsOptional() @IsString() @MaxLength(60) nameEn?: string;
  @IsInt() @Min(0) @Max(10_000_000) priceRon: number;
  @IsInt() @Min(0) @Max(100_000) includedCredits: number;
  @IsInt() @Min(0) @Max(2_147_483_647) marketplaceGatingDelayMin: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsDefined() @ValidateNested() @Type(() => CreatePlanFeaturesDto) features: CreatePlanFeaturesDto;
}

export class UpdatePlanDto {
  // pretul 0 = plan gratuit (nu se cumpara online; grant admin / trial_plan)
  @IsOptional() @IsInt() @Min(0) @Max(10_000_000) priceRon?: number;
  @IsOptional() @IsInt() @Min(0) @Max(2_147_483_647) includedCredits?: number;
  @IsOptional() @IsInt() @Min(0) @Max(2_147_483_647) marketplaceGatingDelayMin?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
  // null sterge numele (se afiseaza codul)
  @IsOptional() @IsString() @MaxLength(60) nameRo?: string | null;
  @IsOptional() @IsString() @MaxLength(60) nameEn?: string | null;
  @IsOptional() @ValidateNested() @Type(() => UpdatePlanFeaturesDto) features?: UpdatePlanFeaturesDto;
}

export class UpdateThresholdDto {
  @IsOptional() @IsInt() @Min(0) minScore?: number;
  @IsOptional() @IsInt() @Min(0) maxScore?: number | null;
}

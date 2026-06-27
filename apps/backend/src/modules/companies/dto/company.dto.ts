import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { CompanyMemberRole, OfferFieldKey } from '@prisma/client';

export class OnboardCompanyDto {
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name: string;

  @Matches(/^(RO)?\d{2,10}$/i)
  cui: string;

  @Matches(/^J\d{1,2}\/\d{1,7}\/\d{4}$/i)
  regComNumber: string;

  @IsString()
  @MinLength(3)
  @MaxLength(300)
  addressText: string;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  county: string;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  city: string;

  @IsNumber()
  @Min(-90)
  @Max(90)
  lat: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  lng: number;
}

// Profil editabil post-onboarding — CUI/Reg.Com. nu se schimba (whitelist le elimina)
export class UpdateCompanyDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(300)
  addressText?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  county?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  city?: string;

  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat?: number;

  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng?: number;
}

export class CompanyLocationDto {
  @IsString()
  @MinLength(3)
  @MaxLength(300)
  addressText: string;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  county: string;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  city: string;

  @IsNumber()
  @Min(-90)
  @Max(90)
  lat: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  lng: number;

  // D-v6-10: coverage_radius_km per locatie
  @IsNumber()
  @Min(0.1)
  @Max(1000)
  coverageRadiusKm: number;
}

export class InviteMemberDto {
  @IsString()
  @MaxLength(254)
  email: string;

  // Invitatie NU poate fi OWNER (un singur owner initial; promovarea separat)
  @IsIn([
    CompanyMemberRole.MANAGER,
    CompanyMemberRole.EMPLOYEE_TRUSTED,
    CompanyMemberRole.EMPLOYEE_MANAGED,
  ])
  role: 'MANAGER' | 'EMPLOYEE_TRUSTED' | 'EMPLOYEE_MANAGED';
}

export class ChangeMemberRoleDto {
  @IsEnum(CompanyMemberRole)
  role: CompanyMemberRole;
}

export class PortfolioItemDto {
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsUrl()
  @MaxLength(2000)
  imageUrl?: string;
}

class OfferFieldPermissionEntryDto {
  @IsEnum(CompanyMemberRole)
  role: CompanyMemberRole;

  @IsEnum(OfferFieldKey)
  fieldKey: OfferFieldKey;

  @IsBoolean()
  canEdit: boolean;
}

export class UpdateOfferPermissionsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OfferFieldPermissionEntryDto)
  permissions: OfferFieldPermissionEntryDto[];
}

export class RejectCompanyDto {
  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  reason: string;
}

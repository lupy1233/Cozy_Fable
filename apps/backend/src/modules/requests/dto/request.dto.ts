import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { BudgetRange, ItemSystem, Material, RoomType } from '@prisma/client';
import { ALLOWED_ATTACHMENT_MIME, MAX_ATTACHMENT_BYTES } from '@marketplace/shared';

export class RoomItemInputDto {
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  name: string;

  @IsEnum(Material)
  material: Material;

  @IsArray()
  @IsEnum(ItemSystem, { each: true })
  systems: ItemSystem[];

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsInt()
  @Min(1)
  @Max(999)
  quantity: number;
}

export class RoomInputDto {
  @IsEnum(RoomType)
  roomType: RoomType;

  @IsNumber()
  @Min(0.01)
  @Max(100)
  lengthM: number;

  @IsNumber()
  @Min(0.01)
  @Max(100)
  widthM: number;

  @IsNumber()
  @Min(0.01)
  @Max(100)
  heightM: number;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => RoomItemInputDto)
  items: RoomItemInputDto[];
}

export class ContactPreferenceInputDto {
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  channel: string;

  @IsString()
  @MinLength(2)
  @MaxLength(200)
  value: string;

  @IsInt()
  @Min(1)
  @Max(5)
  priority: number;
}

// Continut complet — la publicare si la editare.
export class CreateRequestContentDto {
  @IsString()
  @MinLength(4)
  @MaxLength(200)
  title: string;

  @IsString()
  @MinLength(10)
  @MaxLength(5000)
  description: string;

  @IsEnum(BudgetRange)
  budgetRange: BudgetRange;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  desiredDeadline?: string;

  @IsBoolean()
  includesPaidDesign: boolean;

  @IsBoolean()
  hasOwnProject: boolean;

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

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => RoomInputDto)
  rooms: RoomInputDto[];

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => ContactPreferenceInputDto)
  contactPreferences: ContactPreferenceInputDto[];
}

// Salvare incrementala draft — totul optional.
export class PatchDraftDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @IsOptional()
  @IsEnum(BudgetRange)
  budgetRange?: BudgetRange;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  desiredDeadline?: string;

  @IsOptional()
  @IsBoolean()
  includesPaidDesign?: boolean;

  @IsOptional()
  @IsBoolean()
  hasOwnProject?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  addressText?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  county?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => RoomInputDto)
  rooms?: RoomInputDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => ContactPreferenceInputDto)
  contactPreferences?: ContactPreferenceInputDto[];
}

export class PresignAttachmentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  filename: string;

  @IsIn([...ALLOWED_ATTACHMENT_MIME])
  mimeType: (typeof ALLOWED_ATTACHMENT_MIME)[number];

  @IsInt()
  @Min(1)
  @Max(MAX_ATTACHMENT_BYTES)
  sizeBytes: number;
}

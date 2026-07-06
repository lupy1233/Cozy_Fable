import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { BudgetRange, ContactChannel, DesiredDeadlineBucket, RoomType } from '@prisma/client';
import { ALLOWED_ATTACHMENT_MIME, MAX_ATTACHMENT_BYTES } from '@marketplace/shared';

// O camera in payload-ul configuratorului: raspunsuri brute + versiunea flow-ului.
// Continutul `answers` NU e validat de class-validator (JSON dinamic); validarea
// semantica (step-uri, sloturi, conditii) se face cu validateRoomAnswers in
// ConfiguratorService. Whitelist-ul trece pentru ca `answers` e proprietate declarata.
export class ConfiguratorRoomInputDto {
  @IsEnum(RoomType)
  roomType: RoomType;

  @IsInt()
  @Min(1)
  flowVersion: number;

  @IsObject()
  answers: Record<string, unknown>;
}

// Canal restrans la EMAIL/PHONE; formatul valorii (email valid / telefon RO)
// e verificat semantic in service cu schema partajata (contactPreferencesSchema).
export class ContactPreferenceInputDto {
  @IsEnum(ContactChannel)
  channel: ContactChannel;

  @IsString()
  @MinLength(2)
  @MaxLength(200)
  value: string;
}

// Continut complet — la publicare si la editare.
// Titlul e optional: lipseste in fluxul configurator (generat automat pe server
// din camere + oras); description e mesaj liber optional.
export class CreateRequestContentDto {
  @IsOptional()
  @IsString()
  @MinLength(4)
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @IsEnum(BudgetRange)
  budgetRange: BudgetRange;

  @IsOptional()
  @IsEnum(DesiredDeadlineBucket)
  deadlineBucket?: DesiredDeadlineBucket;

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
  @Type(() => ConfiguratorRoomInputDto)
  rooms: ConfiguratorRoomInputDto[];

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(4)
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
  @IsEnum(DesiredDeadlineBucket)
  deadlineBucket?: DesiredDeadlineBucket;

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

  // starea bruta a wizard-ului configurator (backup server al draftului local);
  // opaca pentru backend, cap de marime aplicat in service
  @IsOptional()
  @IsObject()
  configuratorState?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(4)
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

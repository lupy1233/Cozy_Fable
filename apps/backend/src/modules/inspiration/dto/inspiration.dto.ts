import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { InspirationColor, ItemSystem, Material, RoomType } from '@prisma/client';
import { MAX_ATTACHMENT_BYTES, MAX_BOARD_NAME_LENGTH } from '@marketplace/shared';

// Colectie de salvari (item 8): numele vine de la utilizator.
export class BoardNameDto {
  @IsString()
  @MinLength(1)
  @MaxLength(MAX_BOARD_NAME_LENGTH)
  name: string;
}

export class BoardItemDto {
  @IsUUID()
  photoId: string;
}

// Mutarea unui pin salvat in alta colectie (idee 4 PO r2).
export class BoardMoveDto {
  @IsUUID()
  targetBoardId: string;
}

// Meta unei poze de inspiratie (F6, item 3) — create/update din admin.
// Imaginea vine separat: upload prin presign (attachment) sau URL extern.
export class CreateInspirationPhotoDto {
  @IsUUID()
  companyId: string;

  @IsString()
  @MinLength(3)
  @MaxLength(150)
  title: string;

  @IsEnum(RoomType)
  roomType: RoomType;

  @IsOptional()
  @IsArray()
  @IsEnum(InspirationColor, { each: true })
  colors?: InspirationColor[];

  @IsOptional()
  @IsArray()
  @IsEnum(Material, { each: true })
  materials?: Material[];

  @IsOptional()
  @IsArray()
  @IsEnum(ItemSystem, { each: true })
  systems?: ItemSystem[];

  @IsOptional()
  @IsUrl()
  @MaxLength(2000)
  imageUrl?: string;

  // linkul proiectului-sursa din portofoliul atelierului
  @IsOptional()
  @IsUrl()
  @MaxLength(2000)
  sourceUrl?: string;

  @IsOptional()
  @IsBoolean()
  published?: boolean;

  @IsOptional()
  @IsBoolean()
  featured?: boolean;
}

export class UpdateInspirationPhotoDto {
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(150)
  title?: string;

  @IsOptional()
  @IsEnum(RoomType)
  roomType?: RoomType;

  @IsOptional()
  @IsArray()
  @IsEnum(InspirationColor, { each: true })
  colors?: InspirationColor[];

  @IsOptional()
  @IsArray()
  @IsEnum(Material, { each: true })
  materials?: Material[];

  @IsOptional()
  @IsArray()
  @IsEnum(ItemSystem, { each: true })
  systems?: ItemSystem[];

  @IsOptional()
  @IsUrl()
  @MaxLength(2000)
  imageUrl?: string;

  // linkul proiectului-sursa din portofoliul atelierului
  @IsOptional()
  @IsUrl()
  @MaxLength(2000)
  sourceUrl?: string;

  @IsOptional()
  @IsBoolean()
  published?: boolean;

  @IsOptional()
  @IsBoolean()
  featured?: boolean;
}

// Interogarea publica: filtre CSV in query (ex. ?colors=WHITE,GREEN) — valorile
// necunoscute sunt ignorate in service (whitelist pe enum-uri).
export class ListInspirationQueryDto {
  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsString()
  colors?: string;

  @IsOptional()
  @IsString()
  materials?: string;

  @IsOptional()
  @IsString()
  systems?: string;

  @IsOptional()
  @IsString()
  ids?: string;

  // paginare (idee 6 PO r2): fara parametri, comportamentul ramane cel vechi
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;
}

export class ConfirmInspirationImageDto {
  @IsUUID()
  attachmentId: string;
}

// doar imagini pentru galerie (subsetul de MIME din fluxul de atasamente)
const IMAGE_MIME = ['image/jpeg', 'image/png', 'image/webp'] as const;

export class PresignInspirationImageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  filename: string;

  @IsIn([...IMAGE_MIME])
  mimeType: (typeof IMAGE_MIME)[number];

  @IsInt()
  @Min(1)
  @Max(MAX_ATTACHMENT_BYTES)
  sizeBytes: number;
}

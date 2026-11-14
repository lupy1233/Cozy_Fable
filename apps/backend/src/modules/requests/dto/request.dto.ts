import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { BudgetRange, ContactChannel, DesiredDeadlineBucket, RoomType } from '@prisma/client';
import {
  ADDRESS_DETAILS_MAX,
  APPROX_LENGTH_MAX_M,
  APPROX_LENGTH_MIN_M,
  BUDGET_SLIDER_STEP_RON,
  INSPIRATION_NOTE_MAX,
  MAX_BUDGET_RON,
  MAX_REQUEST_INSPIRATION_PHOTOS,
  MAX_REQUEST_ROOMS,
  REQUEST_STUDIO_SCENES_MAX,
  type RequestStudioSceneData,
} from '@marketplace/shared';

// O camera in payload-ul configuratorului: raspunsuri brute + versiunea flow-ului.
// Continutul `answers` NU e validat de class-validator (JSON dinamic); validarea
// semantica (step-uri, sloturi, conditii) se face cu validateRoomAnswers in
// ConfiguratorService. Whitelist-ul trece pentru ca `answers` e proprietate declarata.
export class ConfiguratorRoomInputDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  sourceLocalId?: string;

  @IsEnum(RoomType)
  roomType: RoomType;

  @IsInt()
  @Min(1)
  flowVersion: number;

  @IsObject()
  answers: Record<string, unknown>;

  // b8 (PO g0-8): "La camera asta am nevoie de ajutor" — implicit false. Camera bifata se
  // valideaza partial, iar la publicare/editare raspunsurile ei nu se pastreaza (b8-3).
  @IsOptional()
  @IsBoolean()
  needsDesignHelp?: boolean;

  // d3 (PO d3-2): lungimea aproximativa (m) a camerei, doar cu hasOwnProject (verificat in
  // resolveApproxLength). Conteaza la ROOM_SIZE doar cand dimensiunile lipsesc.
  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false, maxDecimalPlaces: 2 })
  @Min(APPROX_LENGTH_MIN_M)
  @Max(APPROX_LENGTH_MAX_M)
  approxLengthM?: number;
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

// E-client-34: poza de inspiratie cu notita + camera (validarea camerei: in service)
export class RequestInspirationPhotoInputDto {
  @IsUUID('4')
  photoId: string;

  @IsOptional()
  @IsString()
  @MaxLength(INSPIRATION_NOTE_MAX)
  note?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  roomLocalId?: string;
}

// Continut complet — la publicare si la editare.
// Titlul e optional: lipseste in fluxul configurator (generat automat pe server
// din camere + oras); description e mesaj liber optional.
export class CreateRequestContentDto {
  // Validarea completa a scenelor foloseste schema partajata in service.
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(REQUEST_STUDIO_SCENES_MAX)
  @IsObject({ each: true })
  studioScenes?: RequestStudioSceneData[];

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

  // b8: DERIVAT pe server (true daca macar o camera are needsDesignHelp). Ramane acceptat
  // pentru interfata veche (blue/green) si e ignorat — exceptie: niciun camp needsDesignHelp
  // pe camere + includesPaidDesign=true → toate camerele cu ajutor (comportamentul vechi).
  @IsOptional()
  @IsBoolean()
  includesPaidDesign?: boolean;

  @IsBoolean()
  hasOwnProject: boolean;

  @IsString()
  @MinLength(3)
  @MaxLength(300)
  addressText: string;

  // b12: "Bloc, scara, apartament" (optional), separat de strada
  @IsOptional()
  @IsString()
  @MaxLength(ADDRESS_DETAILS_MAX)
  addressDetails?: string;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  county: string;

  // b12 (din b9): un oras doar din spatii nu trece (MinLength numara si spatiile)
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  @Matches(/\S/)
  city: string;

  // ISO2 (F5, item 19) — optional, serverul pune implicit RO
  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z]{2}$/)
  country?: string;

  // bugetul ales pe sliderul estimat (F5, item 18); m1: nu sub pasul glisorului (500 lei) —
  // interfata nu trimite niciodata mai putin, iar o suma de 0 ar ajunge la firma ca "0 lei"
  @IsOptional()
  @IsInt()
  @Min(BUDGET_SLIDER_STEP_RON)
  @Max(MAX_BUDGET_RON)
  budgetEstimateRon?: number;

  // b11: suma aleasa de client pe glisor (nu pusa de formular); pastrata doar langa o suma
  @IsOptional()
  @IsBoolean()
  budgetDeclared?: boolean;

  // pozele din galerie alese ca inspiratie (F6, item 3)
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_REQUEST_INSPIRATION_PHOTOS)
  @IsUUID('4', { each: true })
  inspirationPhotoIds?: string[];

  // E-client-34: poze de inspiratie cu notita + camera (alternativa la inspirationPhotoIds)
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_REQUEST_INSPIRATION_PHOTOS)
  @ValidateNested({ each: true })
  @Type(() => RequestInspirationPhotoInputDto)
  inspirationPhotos?: RequestInspirationPhotoInputDto[];

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_REQUEST_ROOMS)
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

  // b12: "Bloc, scara, apartament"
  @IsOptional()
  @IsString()
  @MaxLength(ADDRESS_DETAILS_MAX)
  addressDetails?: string;

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

// Estimare de buget pre-publish (F5, item 18) — doar camerele, anonim.
export class EstimateRequestDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_REQUEST_ROOMS)
  @ValidateNested({ each: true })
  @Type(() => ConfiguratorRoomInputDto)
  rooms: ConfiguratorRoomInputDto[];
}

// b5: DTO-ul verifica doar forma; tipul permis, fisierul gol si limita de 25 MB le verifica
// UploadsService.presign (inainte de orice scriere), ca raspunsul sa poarte codurile dedicate
// FILE_TYPE_NOT_ALLOWED / FILE_TOO_LARGE in loc de VALIDATION_ERROR.
export class PresignAttachmentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  filename: string;

  @IsString()
  @MaxLength(100)
  mimeType: string;

  @IsInt()
  sizeBytes: number;
}

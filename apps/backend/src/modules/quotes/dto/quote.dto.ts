import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsISO8601,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { QuoteCurrency } from '@prisma/client';
import {
  ALLOWED_ATTACHMENT_MIME,
  MAX_ATTACHMENT_BYTES,
  MAX_ATTACHMENTS_PER_QUOTE,
} from '@marketplace/shared';

// Campurile editabile ale ofertei (offer field_key). Permisiunile per rol se verifica in service.
export class OfferFieldsDto {
  @IsNumber()
  @Min(0.01)
  @Max(100_000_000)
  price: number;

  @IsOptional()
  @IsNumber()
  @Min(0.01)
  @Max(100_000_000)
  designFee?: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  deliveryTerm?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  deliveryDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  warranty?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  description: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  validityDays?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_ATTACHMENTS_PER_QUOTE)
  @IsUUID('4', { each: true })
  attachmentIds?: string[];
}

export class CreateQuoteDto extends OfferFieldsDto {
  @IsUUID()
  claimSlotId: string;

  @IsOptional()
  @IsEnum(QuoteCurrency)
  currency?: QuoteCurrency;
}

export class ReviseQuoteDto extends OfferFieldsDto {
  @IsUUID()
  changeRequestId: string;
}

export class ExtraQuoteVersionDto extends OfferFieldsDto {}

export class RequestQuoteChangeDto {
  @IsUUID()
  quoteVersionId: string;

  @IsString()
  @MinLength(3)
  @MaxLength(2000)
  requestedText: string;
}

export class ExtendValidityDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(60)
  days?: number;
}

export class CreateConsultationInviteDto {
  @IsString()
  @MinLength(3)
  @MaxLength(300)
  locationAddress: string;

  @IsISO8601()
  proposedDatetime: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @IsISO8601({}, { each: true })
  alternativeDatetimes?: string[];
}

export class RespondConsultationInviteDto {
  @IsBoolean()
  accept: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  clientResponseText?: string;
}

export class PresignQuoteAttachmentDto {
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

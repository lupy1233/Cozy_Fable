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
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { QuoteCurrency } from '@prisma/client';
import {
  ALLOWED_ATTACHMENT_MIME,
  MAX_ATTACHMENT_BYTES,
  MAX_ATTACHMENTS_PER_QUOTE,
  MAX_DELIVERY_TERM_VALUE,
  MAX_DESIGN_INCLUDES_LENGTH,
  MAX_QUOTE_DECLINE_NOTE_LENGTH,
  MAX_WARRANTY_MONTHS,
  QUOTE_DECLINE_REASONS,
  QUOTE_DELIVERY_TERM_UNITS,
  QUOTE_VAT_MODES,
  type QuoteDeclineReason,
  type QuoteDeliveryTermUnit,
  type QuoteVatMode,
} from '@marketplace/shared';

// Pretul unei camere din defalcare (F7, item 22).
export class QuoteRoomPriceInputDto {
  @IsUUID()
  requestRoomId: string;

  @IsNumber()
  @Min(0.01)
  @Max(100_000_000)
  price: number;
}

// Campurile editabile ale ofertei (offer field_key). Permisiunile per rol se verifica in service.
// a3/g0-11 (2026-11-13): rubricile structurate sunt OBLIGATORII pe toate drumurile care creeaza o
// varianta (v1, revise, extra, reoffer) — un payload vechi doar cu text → 400 VALIDATION_ERROR.
// deliveryTerm / warranty (text) raman acceptate dar ignorate: serverul le scrie din rubrici.
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

  // g0-11: obligatoriu odata cu designFee (cererile cu proiectare cu plata); verificat in service
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(MAX_DESIGN_INCLUDES_LENGTH)
  designIncludes?: string;

  // a4: moneda VARIANTEI; lipsa = moneda variantei precedente (v1 = RON)
  @IsOptional()
  @IsEnum(QuoteCurrency)
  currency?: QuoteCurrency;

  @IsIn([...QUOTE_VAT_MODES])
  vatMode: QuoteVatMode;

  @IsInt()
  @Min(1)
  @Max(MAX_DELIVERY_TERM_VALUE)
  deliveryTermValue: number;

  @IsIn([...QUOTE_DELIVERY_TERM_UNITS])
  deliveryTermUnit: QuoteDeliveryTermUnit;

  @IsInt()
  @Min(1)
  @Max(MAX_WARRANTY_MONTHS)
  warrantyMonths: number;

  @IsBoolean()
  includesTransport: boolean;

  @IsBoolean()
  includesAssembly: boolean;

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

  // defalcarea pe camere (F7): daca exista, acopera toate camerele si suma = price
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => QuoteRoomPriceInputDto)
  roomPrices?: QuoteRoomPriceInputDto[];
}

export class CreateQuoteDto extends OfferFieldsDto {
  @IsUUID()
  claimSlotId: string;
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

// E-client-1: versiunea afisata clientului in dialogul de confirmare
export class AcceptQuoteDto {
  @IsUUID()
  quoteVersionId: string;
}

// a4 (PO a4-2): motiv optional din lista scurta + nota libera (firma le vede)
export class DeclineQuoteDto {
  @IsOptional()
  @IsIn([...QUOTE_DECLINE_REASONS])
  reason?: QuoteDeclineReason;

  @IsOptional()
  @IsString()
  @MaxLength(MAX_QUOTE_DECLINE_NOTE_LENGTH)
  note?: string;
}

// E-company-6: confirmarea explicita a expirarii preluarii (retragere dupa SLA + gratie)
export class WithdrawQuoteDto {
  @IsOptional()
  @IsBoolean()
  acknowledgeSlaBreach?: boolean;
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

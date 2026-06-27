import { IsArray, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength } from 'class-validator';
import {
  ALLOWED_ATTACHMENT_MIME,
  MAX_ATTACHMENT_BYTES,
  MAX_ATTACHMENTS_PER_MESSAGE,
} from '@marketplace/shared';

export class SendMessageDto {
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  body?: string;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  attachmentIds?: string[];
}

export class PresignChatAttachmentDto {
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

export { MAX_ATTACHMENTS_PER_MESSAGE };

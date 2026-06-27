import { IsBoolean, IsEnum, IsOptional, IsString, MaxLength, MinLength, ValidateIf } from 'class-validator';
import { WithdrawalReasonType } from '@prisma/client';

export class RequestWithdrawalDto {
  @IsEnum(WithdrawalReasonType)
  reasonType: WithdrawalReasonType;

  // obligatoriu doar pentru CUSTOM (validare suplimentara in service).
  @ValidateIf((o) => o.reasonType === 'CUSTOM')
  @IsString()
  @MinLength(3)
  @MaxLength(2000)
  customReason?: string;
}

export class ReviewWithdrawalDto {
  @IsBoolean()
  approve: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  adminNote?: string;
}

export class RequestClarificationDto {
  @IsString()
  @MinLength(3)
  @MaxLength(2000)
  questionText: string;
}

export class AnswerClarificationDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  answerText: string;
}

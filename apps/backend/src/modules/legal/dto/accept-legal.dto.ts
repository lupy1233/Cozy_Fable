import { IsString, MaxLength, MinLength } from 'class-validator';

export class AcceptLegalDto {
  @IsString()
  @MinLength(1)
  @MaxLength(32)
  termsVersion!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(32)
  privacyVersion!: string;
}

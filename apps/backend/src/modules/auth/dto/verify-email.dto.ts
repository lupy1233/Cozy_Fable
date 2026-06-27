import { IsString, Length } from 'class-validator';

export class VerifyEmailDto {
  @IsString()
  @Length(64, 64) // 32 bytes hex
  token: string;
}

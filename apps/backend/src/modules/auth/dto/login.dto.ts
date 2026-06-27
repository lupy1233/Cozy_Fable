import { IsEmail, IsOptional, IsString, Length, MaxLength } from 'class-validator';

export class LoginDto {
  @IsEmail()
  @MaxLength(254)
  email: string;

  @IsString()
  @MaxLength(72)
  password: string;

  // folosit doar cand flagul 2FA e activ si userul are 2FA enabled
  @IsOptional()
  @IsString()
  @Length(6, 6)
  totpCode?: string;
}

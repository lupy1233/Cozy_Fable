import { IsEmail, IsString, Length, MaxLength, MinLength } from 'class-validator';

// L0-A — DTO-uri pentru retrimitere confirmare, parola uitata/resetare/schimbare.
// Politica de parola identica cu RegisterDto (min 8, max 72 = limita bcrypt).

export class EmailOnlyDto {
  @IsEmail()
  @MaxLength(254)
  email: string;
}

export class ResetPasswordDto {
  @IsString()
  @Length(64, 64) // 32 bytes hex
  token: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password: string;
}

export class ChangePasswordDto {
  @IsString()
  @MaxLength(72)
  currentPassword: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72)
  newPassword: string;
}

import { IsEmail, IsEnum, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { Language, UserRole } from '@prisma/client';

export class RegisterDto {
  @IsEmail()
  @MaxLength(254)
  email: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72) // limita bcrypt
  password: string;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  // ADMIN nu se poate inregistra public
  @IsIn([UserRole.CLIENT, UserRole.COMPANY_USER])
  role: 'CLIENT' | 'COMPANY_USER';

  @IsOptional()
  @IsEnum(Language)
  languagePreference?: Language;
}

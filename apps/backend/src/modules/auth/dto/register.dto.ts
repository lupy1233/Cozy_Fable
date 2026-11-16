import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Language, UserRole } from '@prisma/client';
import { RETURN_TO_MAX_LENGTH } from '../auth.constants';

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

  // L0-A: obligatoriu true — serviciul raspunde TERMS_NOT_ACCEPTED (400) altfel
  // (tipul e validat aici; valoarea, cu cod dedicat, in AuthService.register)
  @IsBoolean()
  termsAccepted: boolean;

  // b4: intoarcerea dupa confirmarea emailului; AuthService o pastreaza doar daca e in
  // VERIFY_EMAIL_RETURN_PATHS, altfel o ignora (fara eroare)
  @IsOptional()
  @IsString()
  @MaxLength(RETURN_TO_MAX_LENGTH)
  returnTo?: string;
}

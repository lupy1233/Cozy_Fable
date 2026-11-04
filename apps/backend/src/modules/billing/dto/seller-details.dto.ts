import { IsString, MaxLength } from 'class-validator';

// E-admin-platform-4 — verificarile semantice (CUI, IBAN, placeholdere) sunt in
// BillingReadinessService; aici doar forma si limitele de lungime.
export class SellerDetailsDto {
  @IsString()
  @MaxLength(200)
  name: string;

  @IsString()
  @MaxLength(14)
  cui: string;

  @IsString()
  @MaxLength(40)
  regCom: string;

  @IsString()
  @MaxLength(300)
  address: string;

  @IsString()
  @MaxLength(42)
  iban: string;
}

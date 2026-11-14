import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { freeReason } from '../../audit/audit-snapshot';

export const UNSUSPEND_REASON_MIN = 3;
export const UNSUSPEND_REASON_MAX = 1000;

// caracterele de control devin spatiu (acelasi tratament ca freeReason din audit)
// eslint-disable-next-line no-control-regex
const CONTROL_RE = /[\u0000-\u001F\u007F]+/g;

// Curatarea se face INAINTE de validare (revizuire m1): un motiv doar din caractere de control
// sau spatii devine '' si pica la MinLength, deci nu se poate ridica o suspendare fara motiv.
export function cleanUnsuspendReason(value: unknown): unknown {
  return typeof value === 'string' ? value.replace(CONTROL_RE, ' ').trim() : value;
}

// Etapa 12 (k2): ridicarea suspendarii cere un motiv, ca respingerea (min 3 caractere dupa curatare).
// Fara corp / fara motiv / motiv prea scurt → 400 VALIDATION_ERROR (ValidationPipe global).
export class UnsuspendCompanyDto {
  @Transform(({ value }) => cleanUnsuspendReason(value))
  @IsString()
  @MinLength(UNSUSPEND_REASON_MIN)
  @MaxLength(UNSUSPEND_REASON_MAX)
  reason!: string;
}

// Motivul din raspuns = exact ce pastreaza auditul (o singura regula, freeReason din
// audit-snapshot): e-mail → [email], IBAN → [iban], numere de la 9 cifre → [nr], un motiv care
// pare sa contina un secret → [ascuns]; datele si sumele obisnuite raman citibile.
export function auditSafeReason(reason: string): string {
  return freeReason(reason) ?? '';
}

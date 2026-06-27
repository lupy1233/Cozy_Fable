import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
// Marcheaza ruta ca accesibila fara access token (JwtAuthGuard global o sare)
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

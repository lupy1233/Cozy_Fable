import { SetMetadata } from '@nestjs/common';

export const IDEMPOTENT_KEY = 'isIdempotent';

// Marcheaza un POST critic ca necesitand header Idempotency-Key (invarianta 3.2).
// IdempotencyInterceptor preia cheia, deduplica 24h si returneaza raspunsul cached.
export const Idempotent = () => SetMetadata(IDEMPOTENT_KEY, true);

import { performance } from 'node:perf_hooks';
import type { Prisma } from '@prisma/client';

// E-admin-platform-8: prag tehnic pentru interogarile lente (DB cross-region ~150 ms/round-trip).
export const SLOW_QUERY_MS = 300;

// Logheaza DOAR modelul si actiunea — niciodata args (pot contine emailuri, adrese, token-uri).
// Inregistrat primul in PrismaService, deci masoara si middleware-urile de dupa el.
export function slowQueryLogger(log: (msg: string) => void): Prisma.Middleware {
  return async (params, next) => {
    const started = performance.now();
    try {
      return await next(params);
    } finally {
      const ms = Math.round(performance.now() - started);
      if (ms > SLOW_QUERY_MS) {
        log(`slow query model=${params.model ?? 'raw'} action=${params.action} ms=${ms}`);
      }
    }
  };
}

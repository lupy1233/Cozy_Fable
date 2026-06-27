import { z } from 'zod';

// Validare env la boot — fail-fast (invarianta 3.13).
export const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  FRONTEND_ORIGIN: z.string().url(),

  DATABASE_URL: z.string().min(1),

  REDIS_HOST: z.string().min(1),
  REDIS_PORT: z.coerce.number().int().positive(),

  S3_ENDPOINT: z.string().url(),
  S3_ACCESS_KEY: z.string().min(1),
  S3_SECRET_KEY: z.string().min(1),
  S3_BUCKET: z.string().min(1),
  S3_REGION: z.string().min(1),

  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.coerce.number().int().positive(),
  MAIL_FROM: z.string().min(1),

  // 2FA TOTP implementat dar inactiv in MVP (invarianta 3.13) — flag off by default
  TWO_FACTOR_FEATURE_ENABLED: z
    .string()
    .optional()
    .default('false')
    .transform((v) => v === 'true'),

  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  PAYMENT_WEBHOOK_SECRET: z.string().min(16),
  IP_HASH_SALT: z.string().min(8),

  // Geocoding (invarianta 3.8): Nominatim cu user-agent custom + cache 90 zile.
  NOMINATIM_BASE_URL: z.string().url().default('https://nominatim.openstreetmap.org'),
  NOMINATIM_USER_AGENT: z
    .string()
    .min(1)
    .default('marketplace-mobilier/1.0 (contact: dev@marketplace.local)'),
});

export type AppConfig = z.infer<typeof configSchema>;

export function validateConfig(raw: Record<string, unknown>): AppConfig {
  const parsed = configSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Config invalid — boot abort:\n${issues}`);
  }
  return parsed.data;
}

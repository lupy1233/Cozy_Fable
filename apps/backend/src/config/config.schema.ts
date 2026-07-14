import { z } from 'zod';

// Validare env la boot — fail-fast (invarianta 3.13).
export const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  FRONTEND_ORIGIN: z.string().url(),

  DATABASE_URL: z.string().min(1),

  REDIS_HOST: z.string().min(1),
  REDIS_PORT: z.coerce.number().int().positive(),
  // Optional — necesar pe hosting managed (Railway/Upstash); gol in dev local
  REDIS_PASSWORD: z.string().optional(),

  S3_ENDPOINT: z.string().url(),
  S3_ACCESS_KEY: z.string().min(1),
  S3_SECRET_KEY: z.string().min(1),
  S3_BUCKET: z.string().min(1),
  S3_REGION: z.string().min(1),

  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.coerce.number().int().positive(),
  // Optional — SMTP autentificat (provider real in prod); gol in dev (Mailpit)
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_SECURE: z
    .string()
    .optional()
    .default('false')
    .transform((v) => v === 'true'),
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

  // Criptare la stocare pentru corpul mesajelor de chat (PO r6): AES-256-GCM,
  // cheia = 64 caractere hex (openssl rand -hex 32). Lipsa cheii = mesajele se
  // stocheaza in clar (dev); mesajele vechi in clar raman citibile (dual-read).
  // NU este end-to-end: serverul detine cheia — adminul poate accesa chatul in
  // dispute (regula 4.18), iar conversatiile raman recuperabile.
  MESSAGE_ENCRYPTION_KEY: z
    .string()
    .regex(/^[0-9a-fA-F]{64}$/, 'MESSAGE_ENCRYPTION_KEY must be 64 hex chars (32 bytes)')
    .optional(),
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

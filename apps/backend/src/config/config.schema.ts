import { z } from 'zod';
import { DEV_SMTP_PORTS, isDevSmtpHost, isNoReplyLocal, isReservedMailDomain, parseMailbox } from './mail-rules';

// Validare env la boot — fail-fast (invarianta 3.13).
export const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  // E-admin-platform-56: nesetat = toate interfetele (dev/compose); 127.0.0.1 in containerul combinat
  LISTEN_HOST: z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
    z.string().trim().ip().optional(),
  ),
  FRONTEND_ORIGIN: z.string().url(),
  FRONTEND_PREVIEW_ORIGINS: z.string()
    .optional()
    .default('')
    .transform((value) => value.split(',').map((origin) => origin.trim()).filter(Boolean))
    .pipe(z.array(z.string().url()).max(4))
    .transform((origins) => origins.map((origin) => new URL(origin).origin)),
  DEPLOYMENT_MODE: z.enum(['active', 'standby']).default('active'),
  DEPLOYMENT_SLOT: z.enum(['blue', 'green', 'unassigned']).default('unassigned'),
  RELEASE_SHA: z.string().regex(/^[0-9a-f]{7,40}$/i).optional(),
  RAILWAY_GIT_COMMIT_SHA: z.string().regex(/^[0-9a-f]{7,40}$/i).optional(),
  // E-admin-platform-56: token pentru detaliile health (slot/mode/sha/checks/client);
  // nesetat = detaliile nu se dau niciodata. Optional si in productie (un slot fara el porneste).
  HEALTH_DETAILS_TOKEN: z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
    z.string().min(32).optional(),
  ),
  RUN_MIGRATIONS: z.enum(['true', 'false'])
    .optional()
    .default('true')
    .transform((v) => v === 'true'),

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
  // Supapa EXPLICITA pentru stack-ul local prod-like (dev-infra/docker-compose.prod.yml),
  // care ruleaza intentionat cu Mailpit. Pe hostingul real NU se seteaza niciodata.
  SMTP_ALLOW_DEV_HOST: z
    .string()
    .optional()
    .default('false')
    .transform((v) => v === 'true'),
  // Productie: format cu nume afisat, ex. "Cozy Home" <notificari@domeniu-final>
  MAIL_FROM: z.string().min(1),
  // Casuta de suport monitorizata: Reply-To pe emailurile de cont/facturare + linia de
  // suport din subsol. Obligatorie in productie; gol in dev (.env.example livreaza "SUPPORT_EMAIL=").
  SUPPORT_EMAIL: z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
    z.string().trim().email().optional(),
  ),

  // 2FA TOTP implementat dar inactiv in MVP (invarianta 3.13) — flag off by default
  TWO_FACTOR_FEATURE_ENABLED: z
    .string()
    .optional()
    .default('false')
    .transform((v) => v === 'true'),

  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
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

  // Plati reale prin Stripe Checkout (decizie PO 2026-08-19 — inlocuieste calea B mock
  // din 3.7; calea A "confirmare admin" ramane pentru transfer bancar/fallback).
  // Lipsa cheilor = Stripe dezactivat (butoanele de plata online nu apar).
  STRIPE_SECRET_KEY: z.string().min(1).optional(),
  STRIPE_WEBHOOK_SECRET: z.string().min(1).optional(),
  // Cheia publica nu e folosita de backend (Checkout e hosted), dar o validam daca exista.
  STRIPE_PUBLISHABLE_KEY: z.string().min(1).optional(),
  // E-admin-platform-4: productia refuza cheile Stripe de test; supapa explicita DOAR pentru
  // staging izolat; pe productia reala nu se seteaza.
  STRIPE_ALLOW_TEST_MODE: z
    .string()
    .optional()
    .default('false')
    .transform((v) => v === 'true'),

  // E-admin-platform-8: observabilitate. Nivelul pino; trackerul de erori (protocol Sentry:
  // Sentry EU sau GlitchTip, decizie PO) e dezactivat cat timp SENTRY_DSN lipseste.
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  SENTRY_DSN: z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
    z.string().trim().url().optional(),
  ),
  SENTRY_ENVIRONMENT: z.string().max(40).optional(),

  // E-admin-platform-5: headerul scris de edge cu IP-ul real al clientului (ex. x-real-ip).
  // Se seteaza DOAR dupa testul de spoofing (verify-slot) pe AMBELE sloturi; nesetat = req.ip.
  // Crezut doar cand peer-ul e loopback (rewrite-ul Next din acelasi container).
  TRUSTED_CLIENT_IP_HEADER: z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
    z.string().trim().toLowerCase().regex(/^[a-z0-9-]{1,64}$/).optional(),
  ),
  // Stocarea throttlerului: Redis (partajat intre procese/sloturi) sau memorie (per proces).
  THROTTLER_STORE: z.enum(['redis', 'memory']).default('redis'),
})
  .superRefine((cfg, ctx) => {
    if (cfg.DEPLOYMENT_MODE === 'standby' && cfg.RUN_MIGRATIONS) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['RUN_MIGRATIONS'],
        message: 'must be false while DEPLOYMENT_MODE=standby',
      });
    }
    // In productie criptarea chatului e obligatorie — altfel o regresie de env ar
    // stoca mesajele in clar fara ca nimeni sa observe (audit 2026-08-19).
    if (cfg.NODE_ENV === 'production' && !cfg.MESSAGE_ENCRYPTION_KEY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['MESSAGE_ENCRYPTION_KEY'],
        message: 'obligatorie in productie (openssl rand -hex 32)',
      });
    }
    // In productie SMTP-ul de dev (Mailpit/localhost) inseamna ca TOATE emailurile
    // (verificare cont, reset parola, notificari) se inghit tacut — exact P0-ul din
    // auditul 2026-08-19; boot abort in loc de esec silentios (audit 2026-08-23).
    // Actualizare E-admin-platform-1: garda compara hostul exact si scapa FQDN-urile
    // interne (ex. mailpit.railway.internal, green-mail.railway.internal); acum refuza si
    // portul de captura, SMTP neautentificat, expeditor fara nume afisat si lipsa adresei
    // de suport. Supapa SMTP_ALLOW_DEV_HOST=true le scuteste pe toate (stack prod-like local).
    if (cfg.NODE_ENV === 'production' && !cfg.SMTP_ALLOW_DEV_HOST) {
      const issue = (path: string, message: string) =>
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message });
      if (isDevSmtpHost(cfg.SMTP_HOST)) {
        issue('SMTP_HOST', 'SMTP de dev (Mailpit/localhost) in productie — seteaza un provider SMTP real');
      }
      if (DEV_SMTP_PORTS.has(cfg.SMTP_PORT)) {
        issue('SMTP_PORT', 'port de captura (Mailpit) in productie');
      }
      if (!cfg.SMTP_USER || !cfg.SMTP_PASS) {
        issue('SMTP_USER', 'SMTP autentificat obligatoriu in productie (SMTP_USER + SMTP_PASS)');
      }
      const from = parseMailbox(cfg.MAIL_FROM);
      if (!from || !from.name) {
        issue('MAIL_FROM', 'foloseste formatul "Cozy Home" <adresa@domeniu>');
      } else if (isReservedMailDomain(from.domain)) {
        issue('MAIL_FROM', 'domeniu rezervat/de test in productie — foloseste domeniul final autentificat SPF/DKIM');
      }
      if (!cfg.SUPPORT_EMAIL) {
        issue('SUPPORT_EMAIL', 'obligatoriu in productie (adresa de suport monitorizata)');
      } else {
        const support = parseMailbox(cfg.SUPPORT_EMAIL);
        if (!support || isReservedMailDomain(support.domain) || isNoReplyLocal(support.local)) {
          issue('SUPPORT_EMAIL', 'trebuie sa fie o casuta monitorizata pe un domeniu real (nu no-reply, nu domeniu de test)');
        }
      }
    }
    // E-admin-platform-5: X-Forwarded-For e deja tratat de req.ip (trust proxy) si poate fi
    // completat de client; doar un header suprascris de edge poate fi crezut.
    if (cfg.TRUSTED_CLIENT_IP_HEADER === 'x-forwarded-for') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['TRUSTED_CLIENT_IP_HEADER'],
        message: 'req.ip already handles X-Forwarded-For; trust only an edge-overwritten header such as x-real-ip',
      });
    }
    if ((cfg.STRIPE_SECRET_KEY ? 1 : 0) + (cfg.STRIPE_WEBHOOK_SECRET ? 1 : 0) === 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['STRIPE_WEBHOOK_SECRET'],
        message: 'STRIPE_SECRET_KEY si STRIPE_WEBHOOK_SECRET se seteaza impreuna',
      });
    }
    // E-admin-platform-4: un card de test nu poate cumpara pe productie (factura fiscala reala).
    if (cfg.STRIPE_SECRET_KEY && !/^(sk|rk)_(live|test)_/.test(cfg.STRIPE_SECRET_KEY)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['STRIPE_SECRET_KEY'],
        message: 'format necunoscut (sk_live_/sk_test_/rk_*)',
      });
    } else if (
      cfg.NODE_ENV === 'production' &&
      cfg.STRIPE_SECRET_KEY &&
      !/^(sk|rk)_live_/.test(cfg.STRIPE_SECRET_KEY) &&
      !cfg.STRIPE_ALLOW_TEST_MODE
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['STRIPE_SECRET_KEY'],
        message: 'cheie Stripe de test in productie - foloseste sk_live_ sau STRIPE_ALLOW_TEST_MODE=true doar pe staging izolat',
      });
    }
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

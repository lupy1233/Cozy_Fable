// E-admin-platform-14 — garda pentru testele de integrare pe PostgreSQL real.
// Specurile *.integration.spec.ts creeaza si sterg firme, cereri si credite: ruleaza DOAR pe o
// baza locala (dev) sau pe serviciul Postgres din CI. Orice alt host (Railway, *.rlwy.net,
// *.railway.internal etc.) e refuzat inainte de orice conexiune. Fara override prin env.

export const ALLOWED_TEST_DB_HOSTS = ['localhost', '127.0.0.1', '::1', '[::1]', 'postgres'] as const;

const ALLOWED_PROTOCOLS = ['postgres:', 'postgresql:'];

// Mesajul numeste doar host-ul, niciodata utilizatorul sau parola din URL.
export function assertSafeTestDatabaseUrl(raw: string): void {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error(
      'Refuz sa rulez testele de integrare: TEST_DATABASE_URL nu este un URL valid (se asteapta postgresql://...@localhost/...).',
    );
  }
  if (!ALLOWED_PROTOCOLS.includes(parsed.protocol)) {
    throw new Error(
      `Refuz sa rulez testele de integrare: TEST_DATABASE_URL are protocolul "${parsed.protocol}". Sunt permise doar postgres:// si postgresql://.`,
    );
  }
  const host = parsed.hostname.toLowerCase();
  if (!(ALLOWED_TEST_DB_HOSTS as readonly string[]).includes(host)) {
    throw new Error(
      `Refuz sa rulez testele de integrare: TEST_DATABASE_URL indica host-ul "${host}". Sunt permise doar localhost/127.0.0.1/::1 sau serviciul CI "postgres" (testele creeaza si sterg firme, cereri si credite).`,
    );
  }
}

// URL-ul bazei de test: undefined cand variabila lipseste (suita se sare), altfel verificat.
export function testDatabaseUrl(): string | undefined {
  const raw = process.env.TEST_DATABASE_URL;
  if (!raw) return undefined;
  assertSafeTestDatabaseUrl(raw);
  return raw;
}

import { assertSafeTestDatabaseUrl } from './db-guard';

// E-admin-platform-14 — ruleaza o data inaintea oricarui spec: un TEST_DATABASE_URL catre un
// host nepermis opreste toata rularea (exit != 0), fara nicio conexiune la baza.
export default async function globalSetup(): Promise<void> {
  const raw = process.env.TEST_DATABASE_URL;
  if (raw) assertSafeTestDatabaseUrl(raw);
}

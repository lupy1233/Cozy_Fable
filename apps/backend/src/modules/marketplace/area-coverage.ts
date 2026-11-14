import type { RequestCoverage } from '@marketplace/shared';
import { Prisma } from '@prisma/client';
import { PRIVACY_GRID_LAT_DEG, PRIVACY_GRID_LNG_DEG } from '../../common/privacy/location-privacy';

// Constante de cod ca literali SQL (fara input user) — aceeasi grila ca marketplace.service.
const GRID_LAT_SQL = Prisma.raw(`${PRIVACY_GRID_LAT_DEG}::float8`);
const GRID_LNG_SQL = Prisma.raw(`${PRIVACY_GRID_LNG_DEG}::float8`);

// Orice client Prisma care stie $queryRaw (PrismaService sau tranzactia).
type RawDb = Pick<Prisma.TransactionClient, '$queryRaw'>;

// a6 — exista cel putin o "firma care acopera" punctul aproximat al cererii? (contract §4)
// Firma = nestearsa, aprobata (sau cu suspendarea expirata — exact CompanyApprovedGuard),
// cu abonament activ (status ACTIVE si neexpirat — activeSubscriptionWhere) al carui plan include
// MARKETPLACE_ACCESS (SubscriptionActiveGuard: abonamentul cu expires_at cel mai tarziu, rand de
// functie lipsa = dezactivat), cu cel putin o locatie a carei raza acopera punctul cererii
// aproximat pe grila (centrul celulei, floor + 0.5) cu aceeasi formula Haversine ca piata.
// Fara excluderi pe cerere si fara intarzierea planului. Intoarce DOAR da / nu (niciodata un numar).
export async function hasCoveringCompany(db: RawDb, lat: number, lng: number): Promise<boolean> {
  const rows = await db.$queryRaw<{ covered: boolean }[]>`
    WITH rp AS (
      SELECT (floor(${lat}::float8 / ${GRID_LAT_SQL}) + 0.5) * ${GRID_LAT_SQL} AS lat,
             (floor(${lng}::float8 / ${GRID_LNG_SQL}) + 0.5) * ${GRID_LNG_SQL} AS lng
    )
    SELECT EXISTS (
      SELECT 1
      FROM companies c
      JOIN company_locations l ON l.company_id = c.id
      CROSS JOIN rp
      WHERE c.deleted_at IS NULL
        AND (c.status::text = 'APPROVED'
             OR (c.status::text = 'SUSPENDED' AND c.suspended_until IS NOT NULL AND c.suspended_until <= now()))
        AND EXISTS (
          SELECT 1
          FROM (
            SELECT s.plan_id FROM subscriptions s
            WHERE s.company_id = c.id AND s.status::text = 'ACTIVE' AND s.expires_at > now()
            ORDER BY s.expires_at DESC
            LIMIT 1
          ) cur
          JOIN subscription_plan_features f
            ON f.plan_id = cur.plan_id AND f.feature_key = 'MARKETPLACE_ACCESS' AND f.enabled = true
        )
        AND (6371 * acos(LEAST(1, GREATEST(-1,
              cos(radians(rp.lat)) * cos(radians(l.lat)) * cos(radians(l.lng) - radians(rp.lng))
              + sin(radians(rp.lat)) * sin(radians(l.lat)))))) <= l.coverage_radius_km
    ) AS covered
  `;
  return rows[0]?.covered === true;
}

// Cererea fara coordonate → UNKNOWN; altfel COVERED / NONE.
export async function requestCoverage(
  db: RawDb,
  lat: number | null | undefined,
  lng: number | null | undefined,
): Promise<RequestCoverage> {
  if (lat === null || lat === undefined || lng === null || lng === undefined) return 'UNKNOWN';
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return 'UNKNOWN';
  return (await hasCoveringCompany(db, lat, lng)) ? 'COVERED' : 'NONE';
}

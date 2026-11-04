import { MarketplaceService } from './marketplace.service';

// E-admin-platform-10 — vitrina firmelor: contorul "X/max" vine din max_claims_per_request
// (nu mai e hardcodat 3), iar setul de statusuri din SQL depinde de claims_open_after_first_offer.

/* eslint-disable @typescript-eslint/no-explicit-any */
type Any = any;

const ROW = {
  id: 'r1',
  title: 'Bucatarie',
  description: 'desc',
  budget_range: 'FROM_5K_TO_15K',
  city: 'Bucuresti',
  county: 'Bucuresti',
  project_size: 'MEDIUM',
  credit_cost: 4,
  includes_paid_design: false,
  has_own_project: false,
  desired_deadline_bucket: null,
  published_at: new Date(Date.now() - 5 * 60_000),
  distance_km: 5.14,
  active_claims: 1n,
  already_claimed: false,
};

function makeService(opts: { maxClaims?: number; openAfterFirstOffer?: boolean; distanceDisplay?: string } = {}) {
  const prisma: Any = { $queryRaw: jest.fn().mockResolvedValue([ROW]) };
  const settings: Any = {
    getInt: jest.fn().mockResolvedValue(opts.maxClaims ?? 2),
    getBool: jest.fn().mockResolvedValue(opts.openAfterFirstOffer ?? false),
    getString: jest.fn().mockResolvedValue(opts.distanceDisplay ?? 'KM'),
  };
  const uploads: Any = { listForEntity: jest.fn().mockResolvedValue([]) };
  const service = new MarketplaceService(prisma, settings, uploads);
  return { service, prisma, settings, uploads };
}

// Valorile interpolate in SQL (inclusiv fragmentul Prisma.sql cu statusurile claimabile).
const sqlOf = (prisma: Any) => JSON.stringify(prisma.$queryRaw.mock.calls[0]);

describe('MarketplaceService.list (E-admin-platform-10)', () => {
  it('maxClaims din DTO = settingul max_claims_per_request (nu 3 hardcodat)', async () => {
    const { service, settings } = makeService({ maxClaims: 2 });
    const [item] = await service.list('c1', 0);
    expect(item.maxClaims).toBe(2);
    expect(item.activeClaims).toBe(1);
    expect(item.distanceKm).toBe(5);
    expect(settings.getInt).toHaveBeenCalledWith('max_claims_per_request', 3);
    expect(settings.getBool).toHaveBeenCalledWith('claims_open_after_first_offer', false);
  });

  it('flag oprit → SQL-ul filtreaza doar IN_MARKETPLACE/CLAIMED_PARTIAL (invarianta 3.1)', async () => {
    const { service, prisma } = makeService({ openAfterFirstOffer: false });
    await service.list('c1', 0);
    const sql = sqlOf(prisma);
    expect(sql).toContain('IN_MARKETPLACE');
    expect(sql).toContain('CLAIMED_PARTIAL');
    expect(sql).not.toContain('OFFERS_RECEIVED');
    expect(sql).not.toContain('NEGOTIATION');
  });

  it('flag pornit → SQL-ul include OFFERS_RECEIVED/NEGOTIATION, niciodata CLAIMED_FULL', async () => {
    const { service, prisma } = makeService({ openAfterFirstOffer: true });
    await service.list('c1', 0);
    const sql = sqlOf(prisma);
    expect(sql).toContain('OFFERS_RECEIVED');
    expect(sql).toContain('NEGOTIATION');
    expect(sql).not.toContain('CLAIMED_FULL');
  });

  it('detaliul foloseste acelasi maxClaims si acelasi set de statusuri', async () => {
    const { service, prisma } = makeService({ maxClaims: 2, openAfterFirstOffer: true });
    prisma.requestRoom = { findMany: jest.fn().mockResolvedValue([]) };
    prisma.requestInspirationPhoto = { findMany: jest.fn().mockResolvedValue([]) };
    prisma.requestStudioScene = { findMany: jest.fn().mockResolvedValue([]) };
    const detail = await service.detail('c1', 0, 'r1');
    expect(detail.maxClaims).toBe(2);
    expect(sqlOf(prisma)).toContain('OFFERS_RECEIVED');
  });
});

// E-client-9 (C7-2) — distanta pre-claim din punctul aproximat, km intregi sau banda.
describe('MarketplaceService distanta aproximativa (E-client-9)', () => {
  // textul SQL (fara valori interpolate)
  const sqlText = (prisma: Any) => (prisma.$queryRaw.mock.calls[0][0] as string[]).join('?');

  it('Haversine ruleaza pe punctul aproximat (floor pe grila), nu pe r.lat/r.lng', async () => {
    const { service, prisma } = makeService();
    await service.list('c1', 0);
    const sql = sqlText(prisma) + sqlOf(prisma);
    expect(sql).toContain('floor(r.lat /');
    expect(sql).toContain('floor(r.lng /');
    expect(sql).toContain('0.018::float8');
    expect(sql).toContain('0.026::float8');
    expect(sql).toContain('radians(rp.lat)');
    expect(sql).toContain('radians(rp.lng)');
    expect(sql).not.toContain('radians(r.lat)');
    expect(sql).not.toContain('radians(r.lng)');
    // filtrele de eligibilitate raman
    expect(sql).toContain('r.lat IS NOT NULL');
    expect(sql).toContain('per_loc.dist <= per_loc.radius');
  });

  it('KM (implicit): distanceKm intreg + banda', async () => {
    const { service, prisma, settings } = makeService();
    prisma.$queryRaw.mockResolvedValue([{ ...ROW, distance_km: 12.46 }, { ...ROW, id: 'r2', distance_km: 0.3 }]);
    const [a, b] = await service.list('c1', 0);
    expect(a.distanceKm).toBe(12);
    expect(a.distanceBand).toBe('FROM_5_TO_15');
    expect(b.distanceKm).toBe(1);
    expect(b.distanceBand).toBe('UNDER_5');
    expect(settings.getString).toHaveBeenCalledWith('marketplace_distance_display', 'KM');
  });

  it('BAND: distanceKm null, doar banda (UNDER_5 la 4.9 km)', async () => {
    const { service, prisma } = makeService({ distanceDisplay: 'BAND' });
    prisma.$queryRaw.mockResolvedValue([{ ...ROW, distance_km: 4.9 }, { ...ROW, id: 'r2', distance_km: 31 }]);
    const [a, b] = await service.list('c1', 0);
    expect(a.distanceKm).toBeNull();
    expect(a.distanceBand).toBe('UNDER_5');
    expect(b.distanceBand).toBe('OVER_30');
  });

  it('valoare necunoscuta a setarii → KM', async () => {
    const { service } = makeService({ distanceDisplay: 'EXACT' });
    const [item] = await service.list('c1', 0);
    expect(item.distanceKm).toBe(5);
  });

  it('detaliul cere atasamentele cu nume neutre', async () => {
    const { service, prisma, uploads } = makeService();
    prisma.requestRoom = { findMany: jest.fn().mockResolvedValue([]) };
    prisma.requestInspirationPhoto = { findMany: jest.fn().mockResolvedValue([]) };
    prisma.requestStudioScene = { findMany: jest.fn().mockResolvedValue([]) };
    await service.detail('c1', 0, 'r1');
    expect(uploads.listForEntity).toHaveBeenCalledWith('REQUEST', 'r1', undefined, { neutralNames: true });
  });
});

// E-admin-platform-45 (F2-16) — datele de contact din texte libere nu ajung la firme.
describe('MarketplaceService contact masking (E-admin-platform-45)', () => {
  const TOKEN = '⟦contact⟧';
  const UPLOAD_ID = '3f2a1b4c-1234-4567-8901-426614174000';

  it('lista mascheaza telefonul si pastreaza dimensiunile', async () => {
    const { service, prisma } = makeService();
    prisma.$queryRaw.mockResolvedValue([
      { ...ROW, title: 'Bucatarie 0722123456', description: 'Sunati la 0722 123 456. Corp 240 x 60 cm' },
    ]);
    const [item] = await service.list('c1', 0);
    expect(item.title).toBe(`Bucatarie ${TOKEN}`);
    expect(item.description).toBe(`Sunati la ${TOKEN}. Corp 240 x 60 cm`);
  });

  it('detaliul mascheaza raspunsul text, descrierea itemului si numele scenei; UUID-ul de upload ramane', async () => {
    const { service, prisma } = makeService();
    prisma.requestRoom = {
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'room-1',
          roomType: 'KITCHEN',
          lengthM: 3,
          widthM: 0.6,
          heightM: 2.6,
          flowVersion: 1,
          createdAt: new Date(),
          answers: { notes: 'scrieti pe ana@example.com', layout: 'L_SHAPE', sketch: [UPLOAD_ID] },
          items: [
            { id: 'it-1', name: 'Corp baza', material: 'PAL', systems: [], description: 'tel +40722123456, 240 x 60 cm', quantity: 1 },
          ],
        },
      ]),
    };
    prisma.requestInspirationPhoto = { findMany: jest.fn().mockResolvedValue([]) };
    prisma.requestStudioScene = {
      findMany: jest.fn().mockResolvedValue([
        { id: 's1', name: 'Living 0722123456', data: { scene: { id: 'x', name: 'Living 0722123456' }, pieces: {} } },
      ]),
    };
    const detail = await service.detail('c1', 0, 'r1');
    const room = detail.rooms[0];
    expect(room.answers?.notes).toBe(`scrieti pe ${TOKEN}`);
    expect(room.answers?.sketch).toEqual([UPLOAD_ID]);
    expect(room.answers?.layout).toBe('L_SHAPE');
    expect(room.items[0].description).toBe(`tel ${TOKEN}, 240 x 60 cm`);
    expect(room.items[0].name).toBe('Corp baza');
    expect(detail.studioScenes?.[0]?.name).toBe(`Living ${TOKEN}`);
    expect(detail.studioScenes?.[0]?.data.scene.name).toBe(`Living ${TOKEN}`);
  });

  // E-client-34: notitele pozelor de inspiratie se mascheaza mereu in marketplace
  it('detaliul mascheaza notitele pozelor de inspiratie si pastreaza camera', async () => {
    const { service, prisma } = makeService();
    prisma.requestRoom = { findMany: jest.fn().mockResolvedValue([]) };
    prisma.requestInspirationPhoto = {
      findMany: jest.fn().mockResolvedValue([
        { photoId: 'p1', note: 'suna 0722 123 456, fronturi mate', requestRoomId: 'r-1' },
        { photoId: 'p2', note: null, requestRoomId: null },
      ]),
    };
    prisma.requestStudioScene = { findMany: jest.fn().mockResolvedValue([]) };
    const detail = await service.detail('c1', 0, 'r1');
    expect(detail.inspirationPhotoIds).toEqual(['p1', 'p2']);
    expect(detail.inspirationPhotos[0].note).toContain(TOKEN);
    expect(detail.inspirationPhotos[0].note).not.toContain('0722 123 456');
    expect(detail.inspirationPhotos[0].requestRoomId).toBe('r-1');
    expect(detail.inspirationPhotos[1]).toEqual({ photoId: 'p2', note: null, requestRoomId: null });
  });
});

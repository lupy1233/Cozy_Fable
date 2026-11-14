import { randomUUID } from 'crypto';
import type { CompanyStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { testDatabaseUrl } from '../../test/db-guard';
import { hasCoveringCompany, requestCoverage } from './area-coverage';

// a6 — "firma care acopera" punctul aproximat al cererii (contract etapa 5 §4), pe PostgreSQL.
// Ruleaza doar cu TEST_DATABASE_URL (host local, garda db-guard). Fiecare test lucreaza intr-o
// tranzactie care se anuleaza la final: firmele existente in baza de test se ascund (deleted_at)
// doar in tranzactie, ca rezultatul sa depinda numai de firmele create aici.
const url = testDatabaseUrl();

const BUCHAREST = { lat: 44.4268, lng: 26.1025 };
const CLUJ = { lat: 46.7712, lng: 23.6236 };
// Turda: ~30 km de Cluj-Napoca
const TURDA = { lat: 46.5667, lng: 23.7833 };

class Rollback extends Error {}

(url ? describe : describe.skip)('area coverage (a6) against PostgreSQL', () => {
  const prisma = new PrismaService(url ? { datasources: { db: { url } } } : undefined);
  afterAll(async () => {
    await prisma.$disconnect();
  });

  // ruleaza fn intr-o tranzactie anulata la final (nimic nu ramane in baza)
  async function inRollback(fn: (tx: Prisma.TransactionClient) => Promise<void>): Promise<void> {
    await prisma
      .$transaction(
        async (tx) => {
          await tx.$executeRaw`UPDATE companies SET deleted_at = now() WHERE deleted_at IS NULL`;
          await fn(tx);
          throw new Rollback();
        },
        { timeout: 20_000 },
      )
      .catch((e: unknown) => {
        if (!(e instanceof Rollback)) throw e;
      });
  }

  async function plan(tx: Prisma.TransactionClient, marketplaceAccess: boolean | null): Promise<string> {
    const p = await tx.subscriptionPlan.create({
      data: {
        code: `T_A6_${randomUUID().slice(0, 8).toUpperCase().replace(/-/g, '')}`,
        priceRon: 299,
        includedCredits: 0,
        marketplaceGatingDelayMin: 30,
      },
    });
    // null = niciun rand de functie (registrul il trateaza ca dezactivat)
    if (marketplaceAccess !== null) {
      await tx.subscriptionPlanFeature.create({
        data: { planId: p.id, featureKey: 'MARKETPLACE_ACCESS', enabled: marketplaceAccess },
      });
    }
    return p.id;
  }

  async function company(
    tx: Prisma.TransactionClient,
    opts: {
      at: { lat: number; lng: number };
      radiusKm?: number;
      status?: CompanyStatus;
      suspendedUntil?: Date | null;
      subscription?: { planId: string; expiresAt?: Date; status?: 'ACTIVE' | 'CANCELLED' } | null;
    },
  ): Promise<string> {
    const c = await tx.company.create({
      data: {
        name: `Firma test a6 ${randomUUID().slice(0, 6)}`,
        cui: `RO${Math.floor(Math.random() * 1e8)}`,
        regComNumber: 'J00/0000/2026',
        status: opts.status ?? 'APPROVED',
        suspendedUntil: opts.suspendedUntil ?? null,
        addressText: 'Strada Test 1',
        county: 'Test',
        city: 'Test',
        lat: opts.at.lat,
        lng: opts.at.lng,
        locations: {
          create: [{ addressText: 'Strada Test 1', county: 'Test', city: 'Test', lat: opts.at.lat, lng: opts.at.lng, coverageRadiusKm: opts.radiusKm ?? 50 }],
        },
      },
    });
    if (opts.subscription) {
      await tx.subscription.create({
        data: {
          companyId: c.id,
          planId: opts.subscription.planId,
          status: opts.subscription.status ?? 'ACTIVE',
          expiresAt: opts.subscription.expiresAt ?? new Date(Date.now() + 30 * 86_400_000),
        },
      });
    }
    return c.id;
  }

  it('firme doar in Bucuresti: cerere in Cluj → NONE; cerere in Bucuresti → COVERED', async () => {
    await inRollback(async (tx) => {
      const gold = await plan(tx, true);
      await company(tx, { at: BUCHAREST, subscription: { planId: gold } });
      expect(await requestCoverage(tx, CLUJ.lat, CLUJ.lng)).toBe('NONE');
      expect(await requestCoverage(tx, BUCHAREST.lat, BUCHAREST.lng)).toBe('COVERED');
    });
  });

  it('firma suspendata nu se numara; suspendarea expirata se numara (ca CompanyApprovedGuard)', async () => {
    await inRollback(async (tx) => {
      const gold = await plan(tx, true);
      await company(tx, {
        at: CLUJ,
        status: 'SUSPENDED',
        suspendedUntil: new Date(Date.now() + 7 * 86_400_000),
        subscription: { planId: gold },
      });
      await company(tx, { at: CLUJ, status: 'PENDING_VERIFICATION', subscription: { planId: gold } });
      expect(await hasCoveringCompany(tx, CLUJ.lat, CLUJ.lng)).toBe(false);
      await company(tx, {
        at: CLUJ,
        status: 'SUSPENDED',
        suspendedUntil: new Date(Date.now() - 86_400_000),
        subscription: { planId: gold },
      });
      expect(await hasCoveringCompany(tx, CLUJ.lat, CLUJ.lng)).toBe(true);
    });
  });

  it('fara abonament activ cu acces la piata nu se numara (lipsa, expirat, plan fara acces)', async () => {
    await inRollback(async (tx) => {
      const gold = await plan(tx, true);
      const noAccess = await plan(tx, false);
      const noFeatureRow = await plan(tx, null);
      await company(tx, { at: CLUJ, subscription: null });
      await company(tx, { at: CLUJ, subscription: { planId: gold, expiresAt: new Date(Date.now() - 60_000) } });
      await company(tx, { at: CLUJ, subscription: { planId: noAccess } });
      await company(tx, { at: CLUJ, subscription: { planId: noFeatureRow } });
      expect(await hasCoveringCompany(tx, CLUJ.lat, CLUJ.lng)).toBe(false);
      await company(tx, { at: CLUJ, subscription: { planId: gold } });
      expect(await hasCoveringCompany(tx, CLUJ.lat, CLUJ.lng)).toBe(true);
    });
  });

  it('locatia cu raza care nu ajunge nu se numara; aceeasi locatie cu raza mai mare se numara', async () => {
    await inRollback(async (tx) => {
      const gold = await plan(tx, true);
      await company(tx, { at: TURDA, radiusKm: 10, subscription: { planId: gold } });
      expect(await requestCoverage(tx, CLUJ.lat, CLUJ.lng)).toBe('NONE');
      await company(tx, { at: TURDA, radiusKm: 50, subscription: { planId: gold } });
      expect(await requestCoverage(tx, CLUJ.lat, CLUJ.lng)).toBe('COVERED');
    });
  });

  it('cerere fara coordonate → UNKNOWN', async () => {
    expect(await requestCoverage(prisma, null, null)).toBe('UNKNOWN');
  });
});

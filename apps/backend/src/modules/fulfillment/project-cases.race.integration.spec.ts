import { Prisma } from '@prisma/client';
import type { CreateQuoteInput } from '@marketplace/shared';
import type { Queue } from 'bullmq';
import { testDatabaseUrl } from '../../test/db-guard';
import {
  backdateRequest,
  cleanupMoney,
  createTestPrisma,
  makeClient,
  makeFirm,
  makePublishedRequest,
  sweepLateNotifications,
  type MoneyCleanup,
} from '../../test/money-fixtures';
import { createMoneyServices, errorCode, errorLabel, ownerCtx } from '../../test/money-services';
import type { BusinessCalendarService } from '../../infra/calendar/business-calendar.service';
import { isSerializationFailure } from '../../infra/prisma/tx';
import { ProjectCasesService } from './project-cases.service';

// Review M1 (etapa 1, e2-1) — cursa reala pe PostgreSQL (TEST_DATABASE_URL local, garda db-guard):
// clientul apasa "Am o problema" exact cand ruleaza finalizarea automata (ziua 14).
// Finalizarea e Serializable si isi ia instantaneul INAINTE sa astepte lock-ul pe cerere; fara
// scrierea pe randul cererii din open(), ar citi cazurile cu instantaneul vechi si ar finaliza.
// Invariant verificat: niciodata cerere COMPLETED cu un caz OPEN deschis inainte de finalizare.

const DAY = 24 * 3600 * 1000;
const COST = 2;
const GRANT = 20;
const LAT = 44.4268;
const LNG = 26.1025;
const ITERATIONS = 5;

const url = testDatabaseUrl();

function wire(dbUrl: string) {
  const t = createTestPrisma(dbUrl);
  const services = createMoneyServices(t.prisma);
  const cases = new ProjectCasesService(
    t.prisma,
    services.outbox,
    { todayInBucharest: () => new Date().toISOString().slice(0, 10) } as unknown as BusinessCalendarService,
    services.queue as unknown as Queue,
  );
  return { prisma: t.prisma, setLatency: t.setLatency, cases, ...services };
}

(url ? describe : describe.skip)('project case vs auto-complete race on PostgreSQL (review M1)', () => {
  jest.setTimeout(300_000);
  const w = url ? wire(url) : (undefined as unknown as ReturnType<typeof wire>);
  const ids: MoneyCleanup = { requestIds: [], companyIds: [], userIds: [] };
  const allUserIds: string[] = [];

  afterEach(async () => {
    w.setLatency(0);
    await cleanupMoney(w.prisma, ids);
    ids.requestIds = [];
    ids.companyIds = [];
    allUserIds.push(...ids.userIds);
    ids.userIds = [];
  });
  afterAll(async () => {
    await sweepLateNotifications(w.prisma, allUserIds);
    await w.prisma.$disconnect();
  });

  // cerere livrata acum 15 zile (finalizarea automata e scadenta), oferta acceptata a firmei A
  async function deliveredDue(): Promise<{ clientId: string; requestId: string }> {
    const a = await makeFirm(w.prisma, w.credits, { label: 'M1', lat: LAT, lng: LNG, grant: GRANT });
    ids.companyIds.push(a.companyId);
    ids.userIds.push(a.ownerId);
    const clientId = await makeClient(w.prisma);
    ids.userIds.push(clientId);
    const requestId = await makePublishedRequest(w.prisma, clientId, { cost: COST, lat: LAT, lng: LNG });
    ids.requestIds.push(requestId);
    const slot = await w.claims.create(ownerCtx(a.companyId), a.ownerId, { requestId });
    const quote = await w.quotes.createQuote(ownerCtx(a.companyId), a.ownerId, {
      claimSlotId: slot.id,
      price: 1000,
      description: 'M1 oferta',
    } as CreateQuoteInput);
    await w.quotes.acceptQuote(clientId, quote.id, quote.versions[0].id);
    await w.fulfillment.markDelivered(ownerCtx(a.companyId), requestId);
    await backdateRequest(w.prisma, requestId, { deliveredAt: new Date(Date.now() - 15 * DAY) });
    return { clientId, requestId };
  }

  const state = async (requestId: string) => {
    const [req, open] = await Promise.all([
      w.prisma.request.findUniqueOrThrow({ where: { id: requestId }, select: { status: true } }),
      w.prisma.requestProjectCase.count({ where: { requestId, status: 'OPEN' } }),
    ]);
    return { status: req.status, openCases: open };
  };

  it('(1) mecanismul: o tranzactie Serializable cu instantaneu luat inainte de deschiderea cazului primeste 40001 la FOR UPDATE', async () => {
    const { clientId, requestId } = await deliveredDue();
    let release!: () => void;
    const snapshotTaken = new Promise<void>((r) => (release = r));
    let caseOpened!: () => void;
    const opened = new Promise<void>((r) => (caseOpened = r));

    const t2 = w.prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT 1`; // instantaneul se ia aici (ca in finalizarea automata)
        release();
        await opened;
        await tx.$queryRaw`SELECT id FROM requests WHERE id = ${requestId} FOR UPDATE`;
        return tx.requestProjectCase.count({ where: { requestId, status: 'OPEN' } });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 20_000 },
    );
    await snapshotTaken;
    await w.cases.open({ kind: 'CLIENT', userId: clientId }, requestId, { reason: 'OTHER', note: 'Lipseste un raft' });
    caseOpened();

    const err = await t2.then(() => null, (e: unknown) => e);
    // fara scrierea din open(), T2 ar fi trecut si ar fi numarat 0 cazuri (instantaneul vechi)
    expect(err && isSerializationFailure(err)).toBe(true);
    // reluata (cum face runTx 'claim'), finalizarea vede cazul si nu finalizeaza
    await expect(w.fulfillment.autoCompleteDelivered(requestId)).resolves.toBe(false);
    expect(await state(requestId)).toEqual({ status: 'DELIVERED_BY_COMPANY', openCases: 1 });
  });

  it('(2) cursa reala "Am o problema" vs finalizarea automata: niciodata COMPLETED cu caz OPEN; drumul invers → 409 PROJECT_NOT_CLOSABLE', async () => {
    const outcomes = { caseWon: 0, completionWon: 0 };
    for (let i = 0; i < ITERATIONS; i++) {
      const { clientId, requestId } = await deliveredDue();
      w.setLatency(20);
      const [openRes, completeRes] = await Promise.allSettled([
        w.cases.open({ kind: 'CLIENT', userId: clientId }, requestId, { reason: 'OTHER', note: 'Usa nu se inchide' }),
        w.fulfillment.autoCompleteDelivered(requestId),
      ]);
      w.setLatency(0);
      const s = await state(requestId);
      const label = `iteratia ${i}: open=${openRes.status === 'rejected' ? errorLabel(openRes.reason) : 'ok'}, complete=${
        completeRes.status === 'fulfilled' ? completeRes.value : errorLabel(completeRes.reason)
      }, stare=${s.status}/${s.openCases}`;
      // invariantul
      expect({ label, bad: s.status === 'COMPLETED' && s.openCases > 0 }).toEqual({ label, bad: false });
      if (openRes.status === 'fulfilled') {
        outcomes.caseWon++;
        expect({ label, s }).toEqual({ label, s: { status: 'DELIVERED_BY_COMPANY', openCases: 1 } });
      } else {
        outcomes.completionWon++;
        // drumul invers: finalizarea a apucat prima → raportul vede COMPLETED sub lock
        expect({ label, code: errorCode(openRes.reason) }).toEqual({ label, code: 'PROJECT_NOT_CLOSABLE' });
        expect({ label, s }).toEqual({ label, s: { status: 'COMPLETED', openCases: 0 } });
      }
      await cleanupMoney(w.prisma, ids);
      allUserIds.push(...ids.userIds);
      ids.requestIds = [];
      ids.companyIds = [];
      ids.userIds = [];
    }
    expect(outcomes.caseWon + outcomes.completionWon).toBe(ITERATIONS);
  });
});

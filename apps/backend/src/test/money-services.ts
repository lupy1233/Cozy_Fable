import type { Queue } from 'bullmq';
import type { PrismaService } from '../infra/prisma/prisma.service';
import type { BusinessCalendarService } from '../infra/calendar/business-calendar.service';
import type { EventBusService } from '../infra/event-bus/event-bus.service';
import { SettingsService } from '../common/settings/settings.service';
import type { CompanyContext } from '../common/company-context/company-context';
import { CreditsService } from '../modules/billing/credits.service';
import { ClaimSettlementService } from '../modules/billing/claim-settlement.service';
import { LedgerCheckService } from '../modules/billing/ledger-check.service';
import { OutboxService } from '../modules/outbox/outbox.service';
import { PenaltiesService } from '../modules/penalties/penalties.service';
import { ClaimsService } from '../modules/claims/claims.service';
import { WithdrawalsService } from '../modules/claims/withdrawals.service';
import { ClaimAssignProcessor } from '../modules/claims/claim-assign.processor';
import { SlaBreachProcessor } from '../modules/claims/sla-breach.processor';
import { QuotesService } from '../modules/quotes/quotes.service';
import { FulfillmentService } from '../modules/fulfillment/fulfillment.service';
import { RequestsService } from '../modules/requests/requests.service';
import type { UploadsService } from '../modules/uploads/uploads.service';

// E-admin-platform-14 — serviciile REALE care misca bani, legate de un PrismaService de test.
// Doar marginile sunt stub-uri: cozile BullMQ (add/remove fara Redis), event bus-ul (fara
// Socket.IO), calendarul (zile lucratoare = zile calendaristice) si uploads (fara S3).
// Fiecare constructor e apelat cu ordinea reala a parametrilor (verificata la typecheck).

const DAY = 24 * 3600 * 1000;

export interface QueueStub {
  add: jest.Mock;
  remove: jest.Mock;
}

export function queueStub(): QueueStub {
  return { add: jest.fn().mockResolvedValue(undefined), remove: jest.fn().mockResolvedValue(undefined) };
}

export function createMoneyServices(prisma: PrismaService) {
  const queue = queueStub();
  const q = queue as unknown as Queue;
  const eventBus = { publish: jest.fn() } as unknown as EventBusService;
  const calendar = {
    addWorkingDays: (d: Date, n: number) => new Date(d.getTime() + n * DAY),
  } as unknown as BusinessCalendarService;
  const uploads = {
    listForEntities: async () => new Map(),
    listForEntity: async () => [],
    relink: async () => [],
    toAttachmentDtos: async () => [],
  } as unknown as UploadsService;

  const settings = new SettingsService(prisma);
  const credits = new CreditsService(prisma);
  const settlement = new ClaimSettlementService(credits);
  const outbox = new OutboxService(prisma, eventBus);
  const ledgerCheck = new LedgerCheckService(prisma, outbox);
  const penalties = new PenaltiesService(prisma, settings);
  const claims = new ClaimsService(prisma, credits, settings, outbox, calendar, q, q);
  const withdrawals = new WithdrawalsService(prisma, settlement, penalties, eventBus, calendar, q, q, outbox);
  const claimAssign = new ClaimAssignProcessor(prisma, settlement, eventBus, calendar, q, outbox);
  const slaBreach = new SlaBreachProcessor(prisma, settlement, penalties, calendar, eventBus, q, outbox);
  const quotes = new QuotesService(prisma, settings, outbox, calendar, uploads, settlement, q, q, q, q, q);
  const fulfillment = new FulfillmentService(prisma, eventBus, settlement, q, outbox);
  // deleteForClient foloseste doar prisma/settlement/outbox; restul dependintelor nu sunt atinse
  const requests = new RequestsService(
    prisma,
    {} as never, // geo
    {} as never, // sizing
    {} as never, // configurator
    uploads,
    {} as never, // inspiration
    calendar,
    outbox,
    settlement,
    q,
    settings,
  );
  return {
    queue, eventBus, calendar, uploads,
    settings, credits, settlement, ledgerCheck, outbox, penalties,
    claims, withdrawals, claimAssign, slaBreach, quotes, fulfillment, requests,
  };
}

export type MoneyServices = ReturnType<typeof createMoneyServices>;

// Contextul unei firme aprobate (OWNER), gating 0 implicit — ca dupa SubscriptionActiveGuard.
export function ownerCtx(companyId: string, gatingDelayMinutes = 0): CompanyContext {
  return { companyId, memberRole: 'OWNER', status: 'APPROVED', gatingDelayMinutes };
}

// Codul de eroare de domeniu dintr-o respingere (HttpException.response.code) — sau undefined.
export function errorCode(e: unknown): string | undefined {
  if (typeof e !== 'object' || e === null || !('response' in e)) return undefined;
  const response = (e as { response?: unknown }).response;
  if (typeof response !== 'object' || response === null) return undefined;
  const code = (response as { code?: unknown }).code;
  return typeof code === 'string' ? code : undefined;
}

export function errorStatus(e: unknown): number | undefined {
  if (typeof e !== 'object' || e === null || !('status' in e)) return undefined;
  const status = (e as { status?: unknown }).status;
  return typeof status === 'number' ? status : undefined;
}

// Eticheta scurta pentru o respingere fara cod de domeniu (clasa + codul Prisma), ca un esec
// de test sa spuna ce a scapat fara sa copieze mesaje brute in log.
export function errorLabel(e: unknown): string {
  const code = errorCode(e);
  if (code) return code;
  if (typeof e !== 'object' || e === null) return String(e);
  const prismaCode = (e as { code?: unknown }).code;
  const meta = (e as { meta?: { code?: unknown } }).meta;
  return [e.constructor?.name ?? 'Error', typeof prismaCode === 'string' ? prismaCode : '', typeof meta?.code === 'string' ? meta.code : '']
    .filter(Boolean)
    .join(':');
}

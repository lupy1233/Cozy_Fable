import type { Queue } from 'bullmq';
import type { PrismaService } from '../../infra/prisma/prisma.service';
import type { BusinessCalendarService } from '../../infra/calendar/business-calendar.service';
import type { SettingsService } from '../../common/settings/settings.service';
import type { CreditsService } from '../billing/credits.service';
import type { OutboxService } from '../outbox/outbox.service';
import { ClaimsService } from './claims.service';
import type { ClaimAssignJob } from './claim-assign.processor';
import type { SlaBreachJob } from './sla-breach.processor';

// E-admin-platform-14 — fabrica tipata pentru specurile UNIT de ClaimsService. Singurul apel
// pozitional al constructorului e aici si fiecare cast numeste clasa reala: dependinte in
// ordinea gresita (ex. eventBus pe pozitia OutboxService) = eroare de typecheck, nu test verde.

export interface ClaimsTx {
  $queryRaw: jest.Mock;
  claimSlot: { count: jest.Mock; findFirst: jest.Mock; findMany: jest.Mock; create: jest.Mock };
  chatThread: { create: jest.Mock };
  requestCompanyExclusion: { findUnique: jest.Mock };
  companyLocation: { findMany: jest.Mock };
  companyMember: { findMany: jest.Mock };
  request: { findUnique: jest.Mock };
}

export interface ClaimsPrismaMock {
  $transaction: jest.Mock;
  companyMember: { findUnique: jest.Mock };
}

export interface QueueMock {
  add: jest.Mock;
  remove: jest.Mock;
}

export interface ClaimsDeps {
  prisma: ClaimsPrismaMock;
  credits: jest.Mocked<Pick<CreditsService, 'reserve'>>;
  settings: jest.Mocked<Pick<SettingsService, 'getInt' | 'getBool'>>;
  outbox: jest.Mocked<Pick<OutboxService, 'record'>>;
  calendar: jest.Mocked<Pick<BusinessCalendarService, 'addWorkingDays'>>;
  assignQueue: QueueMock;
  slaQueue: QueueMock;
}

export function makeClaimsTx(): ClaimsTx {
  return {
    $queryRaw: jest.fn().mockResolvedValue([]),
    claimSlot: {
      count: jest.fn().mockResolvedValue(0),
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
    },
    chatThread: { create: jest.fn().mockResolvedValue({ id: 't1' }) },
    requestCompanyExclusion: { findUnique: jest.fn().mockResolvedValue(null) },
    companyLocation: { findMany: jest.fn().mockResolvedValue([]) },
    companyMember: { findMany: jest.fn().mockResolvedValue([]) },
    request: { findUnique: jest.fn().mockResolvedValue(null) },
  };
}

export function makeClaimsService(over: Partial<ClaimsDeps> = {}, tx: ClaimsTx = makeClaimsTx()) {
  const d: ClaimsDeps = {
    prisma: {
      $transaction: jest.fn((fn: (t: ClaimsTx) => Promise<unknown>) => fn(tx)),
      companyMember: { findUnique: jest.fn() },
    },
    credits: { reserve: jest.fn().mockResolvedValue(undefined) },
    settings: {
      getInt: jest.fn().mockResolvedValue(3),
      getBool: jest.fn().mockResolvedValue(false),
    },
    outbox: { record: jest.fn().mockResolvedValue(undefined) },
    calendar: { addWorkingDays: jest.fn((date: Date, n: number) => new Date(date.getTime() + n * 24 * 3600 * 1000)) },
    assignQueue: { add: jest.fn().mockResolvedValue(undefined), remove: jest.fn().mockResolvedValue(undefined) },
    slaQueue: { add: jest.fn().mockResolvedValue(undefined), remove: jest.fn().mockResolvedValue(undefined) },
    ...over,
  };
  const service = new ClaimsService(
    d.prisma as unknown as PrismaService,
    d.credits as unknown as CreditsService,
    d.settings as unknown as SettingsService,
    d.outbox as unknown as OutboxService,
    d.calendar as unknown as BusinessCalendarService,
    d.assignQueue as unknown as Queue<ClaimAssignJob>,
    d.slaQueue as unknown as Queue<SlaBreachJob>,
  );
  return { service, tx, ...d };
}

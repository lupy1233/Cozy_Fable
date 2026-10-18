// E-company-2: builder-e comune pentru specurile QuotesService (NU e *.spec.ts → jest nu il
// ruleaza singur). Prisma e mock-uit; tx.$queryRaw raspunde dupa textul SQL (chitanta
// idempotenta, cererea blocata, starea blocata a ofertei, slotul ocupat al asignatului).
/* eslint-disable @typescript-eslint/no-explicit-any */
import { QuotesService } from './quotes.service';
import { ClaimSettlementService } from '../billing/claim-settlement.service';
import type { LockedQuoteState, LockedRequest } from './quote-lock';

type Any = any;

export const DAY = 24 * 3600 * 1000;
export const FUTURE = new Date(Date.now() + 7 * DAY);
export const PAST = new Date(Date.now() - 2 * DAY);
export const T0 = new Date('2026-09-01T10:00:00.000Z');

export interface VersionSpec {
  id?: string;
  isExtra?: boolean;
  validUntil?: Date;
  sentAt?: Date;
  changeRequests?: Any[];
  validityExtensions?: Any[];
  deliveryDate?: Date | null;
}

export function makeVersion(i: number, spec: VersionSpec = {}): Any {
  return {
    id: spec.id ?? `v${i}`,
    quoteId: 'q1',
    version: i,
    isExtra: spec.isExtra ?? false,
    price: 1000,
    designFee: null,
    deliveryTerm: null,
    deliveryDate: spec.deliveryDate ?? null,
    warranty: null,
    description: 'x',
    validUntil: spec.validUntil ?? FUTURE,
    createdByUserId: 'u-firm',
    sentAt: spec.sentAt ?? new Date(),
    createdAt: T0,
    extensionRequestedAt: null,
    changeRequests: spec.changeRequests ?? [],
    validityExtensions: spec.validityExtensions ?? [],
    roomPrices: [],
  };
}

export function makeQuoteFull(opts: {
  status?: string;
  versions?: VersionSpec[];
  requestStatus?: string;
  deletedAt?: Date | null;
  includesPaidDesign?: boolean;
  consultationInvites?: Any[];
} = {}): Any {
  const versions = (opts.versions ?? [{}]).map((v, idx) => makeVersion(idx + 1, v));
  return {
    id: 'q1',
    claimSlotId: 'slot-win',
    requestId: 'r1',
    companyId: 'c-win',
    currency: 'RON',
    status: opts.status ?? 'SENT',
    extraVersionsCount: 0,
    withdrawnAt: null,
    acceptedAt: null,
    acceptedVersionId: null,
    createdAt: T0,
    updatedAt: T0,
    company: { name: 'Firma A' },
    request: {
      id: 'r1',
      clientUserId: 'u-client',
      title: 'Bucatarie',
      deletedAt: opts.deletedAt ?? null,
      status: opts.requestStatus ?? 'OFFERS_RECEIVED',
      includesPaidDesign: opts.includesPaidDesign ?? false,
    },
    versions,
    consultationInvites: opts.consultationInvites ?? [],
  };
}

// Starea blocata consistenta cu snapshot-ul (→ fara recitire), cu suprascrieri per test.
export function makeLockedState(full: Any, overrides: Partial<LockedQuoteState> = {}): LockedQuoteState {
  const latest = full.versions.reduce((a: Any, b: Any) => (b.version > a.version ? b : a));
  return {
    id: full.id,
    quote_status: full.status,
    updated_at: full.updatedAt,
    claim_slot_id: full.claimSlotId,
    request_id: full.requestId,
    company_id: full.companyId,
    slot_status: 'OFFER_SENT',
    assigned_to_user_id: null,
    sla_deadline_at: FUTURE,
    sla_paused_at: null,
    negotiation_ended_by_company: false,
    latest_version_id: latest.id,
    latest_sent_at: latest.sentAt,
    latest_valid_until: latest.validUntil,
    version_count: full.versions.length,
    non_extra_count: full.versions.filter((v: Any) => !v.isExtra).length,
    max_version: Math.max(...full.versions.map((v: Any) => v.version)),
    pending_changes: full.versions.reduce(
      (n: number, v: Any) => n + v.changeRequests.filter((c: Any) => c.status === 'PENDING').length,
      0,
    ),
    latest_extensions: latest.validityExtensions.length,
    invite_count: full.consultationInvites.length,
    ...overrides,
  };
}

export function makeLockedRequest(overrides: Partial<LockedRequest> = {}): LockedRequest {
  return { id: 'r1', status: 'OFFERS_RECEIVED', deleted_at: null, client_user_id: 'u-client', ...overrides };
}

export interface ServiceOpts {
  snapshot?: Any;
  state?: Partial<LockedQuoteState>;
  lockedRequest?: Partial<LockedRequest> | null;
  busySlots?: { id: string; company_id: string }[];
  slot?: Any;
}

export function makeService(opts: ServiceOpts = {}) {
  const snapshot = opts.snapshot ?? makeQuoteFull();
  const state = makeLockedState(snapshot, opts.state);
  const lockedRequest = opts.lockedRequest === null ? null : makeLockedRequest(opts.lockedRequest ?? {});
  const tx: Any = {
    // E-admin-platform-10: recalculul citeste max_claims_per_request in tranzactie (null → fallback 3)
    systemSetting: { findUnique: jest.fn().mockResolvedValue(null) },
    $queryRaw: jest.fn((strings: TemplateStringsArray) => {
      const sql = strings.join('?');
      if (sql.includes('FROM idempotency_keys')) return Promise.resolve([{ response_status: 0 }]);
      if (sql.includes('FROM requests')) return Promise.resolve(lockedRequest ? [lockedRequest] : []);
      if (sql.includes('FROM quotes q')) return Promise.resolve([state]);
      if (sql.includes('FROM claim_slots')) return Promise.resolve(opts.busySlots ?? []);
      return Promise.resolve([]);
    }),
    quote: {
      create: jest.fn(({ data }: Any) =>
        Promise.resolve({
          extraVersionsCount: 0,
          withdrawnAt: null,
          acceptedAt: null,
          acceptedVersionId: null,
          createdAt: T0,
          updatedAt: T0,
          ...data,
        }),
      ),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      findUnique: jest.fn().mockResolvedValue({
        ...snapshot,
        versions: snapshot.versions.map((v: Any) => ({
          id: v.id,
          version: v.version,
          validUntil: v.validUntil,
          deliveryDate: v.deliveryDate,
        })),
        claimSlot: { status: 'OFFER_SENT' },
      }),
      count: jest.fn().mockResolvedValue(0),
    },
    quoteVersion: {
      create: jest.fn(({ data }: Any) =>
        Promise.resolve({
          id: `v-new-${data.version}`,
          sentAt: new Date(),
          createdAt: new Date(),
          extensionRequestedAt: null,
          deliveryTerm: null,
          deliveryDate: null,
          warranty: null,
          designFee: null,
          isExtra: false,
          ...data,
        }),
      ),
      update: jest.fn().mockResolvedValue(undefined),
    },
    quoteVersionRoomPrice: { createMany: jest.fn().mockResolvedValue({ count: 0 }) },
    quoteChangeRequest: {
      create: jest.fn(({ data }: Any) =>
        Promise.resolve({ id: 'cr-new', status: 'PENDING', respondedAt: null, createdAt: new Date(), ...data }),
      ),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    quoteValidityExtension: {
      create: jest.fn(({ data }: Any) => Promise.resolve({ id: 'ext-new', extendedAt: new Date(), ...data })),
    },
    physicalConsultationInvite: {
      create: jest.fn(({ data }: Any) =>
        Promise.resolve({
          id: 'inv-new',
          status: 'PENDING_CLIENT',
          clientResponseText: null,
          respondedAt: null,
          createdAt: new Date(),
          alternativeDatetimes: null,
          ...data,
        }),
      ),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      findUnique: jest.fn().mockResolvedValue(null),
    },
    claimSlot: {
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockResolvedValue(undefined),
      count: jest.fn().mockResolvedValue(1),
    },
    request: {
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      update: jest.fn().mockResolvedValue(undefined),
      findUnique: jest.fn().mockResolvedValue({ id: 'r1', status: 'OFFERS_RECEIVED', deletedAt: null, clientUserId: 'u-client' }),
    },
    chatThread: {
      update: jest.fn().mockResolvedValue(undefined),
      updateMany: jest.fn().mockResolvedValue(undefined),
    },
    companyMember: { findMany: jest.fn().mockResolvedValue([{ userId: 'm1' }]) },
    idempotencyKey: { update: jest.fn().mockResolvedValue(undefined) },
    // E-admin-platform-15: ledger-ul slotului citit de settle(); testele care deconteaza il seteaza
    creditTransaction: { findMany: jest.fn().mockResolvedValue([]) },
  };
  const prisma: Any = {
    $transaction: jest.fn((fn: (t: Any) => Promise<unknown>) => fn(tx)),
    quote: { findUnique: jest.fn().mockResolvedValue(snapshot) },
    claimSlot: {
      findUnique: jest.fn().mockResolvedValue(
        opts.slot ?? {
          id: 'slot-win',
          companyId: 'c-win',
          status: 'ACTIVE',
          requestId: 'r1',
          request: { id: 'r1', status: 'CLAIMED_PARTIAL', deletedAt: null, includesPaidDesign: false },
        },
      ),
      findMany: jest.fn().mockResolvedValue([]),
    },
    company: { findUnique: jest.fn().mockResolvedValue({ name: 'Firma A' }) },
    companyOfferFieldPermission: {
      findMany: jest.fn().mockResolvedValue(
        ['PRICE', 'DESCRIPTION', 'DELIVERY_TERM', 'DELIVERY_DATE', 'WARRANTY'].map((fieldKey) => ({ fieldKey, canEdit: true })),
      ),
    },
    quoteChangeRequest: { findUnique: jest.fn().mockResolvedValue(null) },
    quoteVersion: { findUnique: jest.fn().mockResolvedValue(null) },
    chatThread: { findUnique: jest.fn().mockResolvedValue({ negotiationEndedByCompany: false }) },
    requestRoom: { findMany: jest.fn().mockResolvedValue([]) },
    physicalConsultationInvite: { findUnique: jest.fn().mockResolvedValue(null) },
    request: { findUnique: jest.fn().mockResolvedValue({ clientUserId: 'u-client' }) },
    companyMember: tx.companyMember,
  };
  const settings: Any = { getInt: jest.fn().mockResolvedValue(14), getNumber: jest.fn().mockResolvedValue(5.2) };
  const outbox: Any = { record: jest.fn().mockResolvedValue(undefined) };
  const calendar: Any = {
    addWorkingDays: jest.fn((d: Date, n: number) => new Date(d.getTime() + n * DAY)),
  };
  const uploads: Any = {
    listForEntities: jest.fn().mockResolvedValue(new Map()),
    relink: jest.fn().mockResolvedValue([]),
    toAttachmentDtos: jest.fn().mockResolvedValue([]),
  };
  const credits: Any = {
    consume: jest.fn().mockResolvedValue(true),
    refund: jest.fn().mockResolvedValue(true),
  };
  // decontarea reala (bilet + ledger) peste credite mock-uite
  const settlement = new ClaimSettlementService(credits);
  const queue: Any = { add: jest.fn().mockResolvedValue(undefined), remove: jest.fn().mockResolvedValue(undefined) };
  const service = new QuotesService(
    prisma,
    settings,
    outbox,
    calendar,
    uploads,
    settlement,
    queue, // validity
    queue, // consultation
    queue, // sla
    queue, // assign
    queue, // project deadlines
  );
  return { service, tx, prisma, settings, outbox, calendar, uploads, credits, queue, snapshot, state };
}

export const companyCtx: Any = { companyId: 'c-win', memberRole: 'OWNER', status: 'APPROVED' };
export const offerDto: Any = { price: 1200, description: 'v noua' };

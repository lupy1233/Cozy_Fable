import { HttpException } from '@nestjs/common';
import { ERROR_CODES, type ErrorCode } from '@marketplace/shared';
import type { ClaimSlotStatus, Prisma, QuoteStatus, RequestStatus } from '@prisma/client';
import { OFFERABLE_REQUEST_STATUSES } from '../claims/claims.constants';

type Tx = Prisma.TransactionClient;

// E-company-2 — starea autoritativa a unei oferte, citita SUB lock (invarianta 3.1):
// intai randul cererii (FOR UPDATE, acelasi domeniu de serializare ca claim/accept/retrageri/
// procesoare), apoi oferta + slot + thread + agregatele versiunilor intr-un singur statement.

export interface LockedRequest {
  id: string;
  status: RequestStatus;
  deleted_at: Date | null;
  client_user_id: string | null;
}

export interface LockedQuoteState {
  id: string;
  quote_status: QuoteStatus;
  updated_at: Date;
  claim_slot_id: string;
  request_id: string;
  company_id: string;
  slot_status: ClaimSlotStatus;
  assigned_to_user_id: string | null;
  sla_deadline_at: Date | null;
  // E-company-6: procesorul SLA sare peste sloturile pe pauza
  sla_paused_at: Date | null;
  negotiation_ended_by_company: boolean | null;
  latest_version_id: string | null;
  latest_sent_at: Date | null;
  latest_valid_until: Date | null;
  version_count: number;
  non_extra_count: number;
  max_version: number | null;
  pending_changes: number;
  latest_extensions: number;
  invite_count: number;
}

// Id-urile sunt TEXT in schema (fara cast ::uuid).
export async function lockRequestRow(tx: Tx, requestId: string): Promise<LockedRequest | null> {
  const rows = await tx.$queryRaw<LockedRequest[]>`
    SELECT id, status, deleted_at, client_user_id FROM requests WHERE id = ${requestId} FOR UPDATE`;
  return rows[0] ?? null;
}

// Un singur round-trip; blocheaza doar oferta (cererea e deja blocata de lockRequestRow).
export async function readLockedQuoteState(tx: Tx, quoteId: string): Promise<LockedQuoteState | null> {
  const rows = await tx.$queryRaw<LockedQuoteState[]>`
    SELECT q.id, q.status AS quote_status, q.updated_at, q.claim_slot_id, q.request_id, q.company_id,
           cs.status AS slot_status, cs.assigned_to_user_id, cs.sla_deadline_at, cs.sla_paused_at,
           ct.negotiation_ended_by_company,
           lv.id AS latest_version_id, lv.sent_at AS latest_sent_at, lv.valid_until AS latest_valid_until,
           (SELECT count(*)::int FROM quote_versions v WHERE v.quote_id = q.id) AS version_count,
           (SELECT count(*)::int FROM quote_versions v WHERE v.quote_id = q.id AND NOT v.is_extra) AS non_extra_count,
           (SELECT max(v.version)::int FROM quote_versions v WHERE v.quote_id = q.id) AS max_version,
           (SELECT count(*)::int FROM quote_change_requests c JOIN quote_versions v ON v.id = c.quote_version_id
              WHERE v.quote_id = q.id AND c.status = 'PENDING') AS pending_changes,
           (SELECT count(*)::int FROM quote_validity_extensions e WHERE e.quote_version_id = lv.id) AS latest_extensions,
           (SELECT count(*)::int FROM physical_consultation_invites i WHERE i.quote_id = q.id) AS invite_count
    FROM quotes q
    JOIN claim_slots cs ON cs.id = q.claim_slot_id
    LEFT JOIN chat_threads ct ON ct.claim_slot_id = q.claim_slot_id
    LEFT JOIN LATERAL (
      SELECT v.id, v.sent_at, v.valid_until FROM quote_versions v
      WHERE v.quote_id = q.id ORDER BY v.version DESC LIMIT 1
    ) lv ON true
    WHERE q.id = ${quoteId}
    FOR UPDATE OF q`;
  return rows[0] ?? null;
}

export type QuoteAction =
  | 'REVISE'
  | 'EXTRA'
  | 'REOFFER'
  | 'EXTEND'
  | 'CONSULTATION_INVITE'
  | 'WITHDRAW'
  | 'REJECT_CHANGE'
  | 'END_NEGOTIATION'
  | 'REQUEST_CHANGE'
  | 'CONSULTATION_RESPOND';

interface QuoteActionRule {
  quoteStatuses: QuoteStatus[];
  slotOfferSent: boolean;
  requestOpen: boolean;
  // codul pentru oferta/slot in stare nepotrivita (actiunile clientului isi pastreaza codurile)
  code: ErrorCode;
}

const OPEN: QuoteStatus[] = ['SENT', 'EXPIRED'];
const COMPANY_WRITE: QuoteActionRule = {
  quoteStatuses: OPEN,
  slotOfferSent: true,
  requestOpen: true,
  code: ERROR_CODES.QUOTE_NOT_MODIFIABLE,
};

// Masina de stari a actiunilor pe oferta (verificata sub lock). Limitele numerice (3 versiuni,
// 2 prelungiri, fereastra de retragere) se verifica separat, tot din starea blocata.
export const QUOTE_ACTION_RULES: Record<QuoteAction, QuoteActionRule> = {
  REVISE: COMPANY_WRITE,
  EXTRA: COMPANY_WRITE,
  REOFFER: COMPANY_WRITE,
  EXTEND: COMPANY_WRITE,
  CONSULTATION_INVITE: COMPANY_WRITE,
  WITHDRAW: COMPANY_WRITE,
  REJECT_CHANGE: { quoteStatuses: OPEN, slotOfferSent: false, requestOpen: false, code: ERROR_CODES.QUOTE_NOT_MODIFIABLE },
  END_NEGOTIATION: { quoteStatuses: OPEN, slotOfferSent: false, requestOpen: false, code: ERROR_CODES.QUOTE_NOT_MODIFIABLE },
  REQUEST_CHANGE: { quoteStatuses: ['SENT'], slotOfferSent: true, requestOpen: true, code: ERROR_CODES.QUOTE_ACCEPT_NOT_ALLOWED },
  CONSULTATION_RESPOND: { quoteStatuses: OPEN, slotOfferSent: false, requestOpen: false, code: ERROR_CODES.QUOTE_ACCEPT_NOT_ALLOWED },
};

export function isRequestOpenForOffers(request: { status: RequestStatus; deletedAt: Date | null }): boolean {
  return request.deletedAt === null && OFFERABLE_REQUEST_STATUSES.includes(request.status);
}

// Ordinea: starea ofertei, apoi slotul, apoi cererea. `slotStatus` lipseste la verificarea
// rapida din afara tranzactiei (snapshot fara slot) — atunci se sare peste slot.
export function assertQuoteRule(
  action: QuoteAction,
  state: {
    quoteStatus: QuoteStatus;
    slotStatus?: ClaimSlotStatus;
    request: { status: RequestStatus; deletedAt: Date | null };
  },
): void {
  const rule = QUOTE_ACTION_RULES[action];
  if (!rule.quoteStatuses.includes(state.quoteStatus)) {
    throw new HttpException({ code: rule.code, message: 'Offer cannot be changed in its current state' }, 409);
  }
  if (rule.slotOfferSent && state.slotStatus !== undefined && state.slotStatus !== 'OFFER_SENT') {
    throw new HttpException({ code: rule.code, message: 'Offer slot is no longer open' }, 409);
  }
  if (rule.requestOpen && !isRequestOpenForOffers(state.request)) {
    throw new HttpException(
      { code: ERROR_CODES.REQUEST_NOT_OPEN_FOR_OFFERS, message: 'Request no longer accepts offers' },
      409,
    );
  }
}

export function assertLockedRule(action: QuoteAction, s: LockedQuoteState, req: LockedRequest): void {
  assertQuoteRule(action, {
    quoteStatus: s.quote_status,
    slotStatus: s.slot_status,
    request: { status: req.status, deletedAt: req.deleted_at },
  });
}

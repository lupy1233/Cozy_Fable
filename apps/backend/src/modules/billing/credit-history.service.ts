import { HttpException, Injectable } from '@nestjs/common';
import {
  CREDIT_REASONS,
  ERROR_CODES,
  type CreditHistoryItemDto,
  type CreditHistoryKind,
  type CreditHistoryPageDto,
} from '@marketplace/shared';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { maskFreeText } from '../../common/privacy/contact-masking';

export const CREDIT_HISTORY_DEFAULT_LIMIT = 20;
export const CREDIT_HISTORY_MAX_LIMIT = 50;
// h3: motivul miscarii de sold initial scrise de datele demo (nu e o scriere a aplicatiei)
export const OPENING_BALANCE_REASON = 'OPENING_BALANCE';

const KNOWN_REASONS = new Set<string>([...CREDIT_REASONS, OPENING_BALANCE_REASON]);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface CreditHistoryRow {
  id: string;
  type: string;
  amount: number;
  reason: string;
  claim_slot_id: string | null;
  created_at: Date;
  available_after: number;
  reserved_after: number;
}

type LedgerType = CreditHistoryItemDto['type'];

// Efectul unei miscari pe portofel (4.8 — aceeasi semantica ca CreditsService / LedgerCheck):
// GRANT +disponibile; RESERVE disponibile → rezervate; REFUND rezervate → disponibile; CONSUME -rezervate.
export function ledgerDeltas(type: LedgerType, amount: number): { availableDelta: number; reservedDelta: number } {
  switch (type) {
    case 'GRANT':
      return { availableDelta: amount, reservedDelta: 0 };
    case 'RESERVE':
      return { availableDelta: -amount, reservedDelta: amount };
    case 'REFUND':
      return { availableDelta: amount, reservedDelta: -amount };
    case 'CONSUME':
      return { availableDelta: 0, reservedDelta: -amount };
  }
}

// Ce s-a intamplat, din tip + motiv. Motiv necunoscut (randuri istorice scrise liber) → OTHER.
export function historyKind(type: string, reason: string): CreditHistoryKind {
  if (type === 'GRANT') {
    if (reason === 'CREDIT_PURCHASE') return 'PURCHASE';
    if (reason === 'SUBSCRIPTION_CREDITS') return 'SUBSCRIPTION_CREDITS';
    if (reason === 'TRIAL_BONUS') return 'TRIAL_BONUS';
    if (reason === OPENING_BALANCE_REASON) return 'OPENING_BALANCE';
    return 'OTHER';
  }
  if (!KNOWN_REASONS.has(reason)) return 'OTHER';
  if (type === 'RESERVE') return reason === 'CLAIM_RESERVE' ? 'CLAIM' : 'OTHER';
  if (type === 'REFUND') return 'REFUND';
  if (type === 'CONSUME') return 'CONSUME';
  return 'OTHER';
}

function isLedgerType(t: string): t is LedgerType {
  return t === 'GRANT' || t === 'RESERVE' || t === 'REFUND' || t === 'CONSUME';
}

export function toHistoryItem(
  row: CreditHistoryRow,
  slot: { requestId: string; requestTitle: string | null } | null,
): CreditHistoryItemDto {
  const type: LedgerType = isLedgerType(row.type) ? row.type : 'GRANT';
  const deltas = isLedgerType(row.type) ? ledgerDeltas(type, row.amount) : { availableDelta: 0, reservedDelta: 0 };
  const kind = isLedgerType(row.type) ? historyKind(row.type, row.reason) : 'OTHER';
  return {
    id: row.id,
    createdAt: row.created_at.toISOString(),
    type,
    kind,
    reason: KNOWN_REASONS.has(row.reason) ? row.reason : null,
    amount: row.amount,
    ...deltas,
    availableAfter: Number(row.available_after),
    reservedAfter: Number(row.reserved_after),
    claimSlotId: row.claim_slot_id,
    requestId: slot?.requestId ?? null,
    requestTitle: slot?.requestTitle ?? null,
  };
}

export function clampHistoryLimit(raw: unknown): number {
  const n = typeof raw === 'string' ? Number.parseInt(raw, 10) : typeof raw === 'number' ? raw : NaN;
  if (!Number.isFinite(n) || n < 1) return CREDIT_HISTORY_DEFAULT_LIMIT;
  return Math.min(Math.floor(n), CREDIT_HISTORY_MAX_LIMIT);
}

// h3 (etapa 9) — istoricul miscarilor de credite ale firmei. DOAR citiri: nu scrie in registru
// si nu atinge portofelul. Soldul dupa fiecare miscare = suma miscarilor firmei pana la ea
// (fereastra pe created_at, id), deci e independent de paginare.
@Injectable()
export class CreditHistoryService {
  constructor(private readonly prisma: PrismaService) {}

  async list(companyId: string, opts: { cursor?: string | null; limit?: unknown } = {}): Promise<CreditHistoryPageDto> {
    const limit = clampHistoryLimit(opts.limit);
    const cursor = opts.cursor?.trim() || null;
    if (cursor && !UUID_RE.test(cursor)) {
      throw new HttpException({ code: ERROR_CODES.VALIDATION_ERROR, message: 'Invalid cursor' }, 400);
    }
    // cursorul = id-ul ultimei miscari vazute; comparatia pe (created_at, id) se face in SQL,
    // cu precizia completa a coloanei (microsecunde), si doar pe miscarile firmei proprii
    const cursorFilter = cursor
      ? Prisma.sql`WHERE (l.created_at, l.id) < (SELECT c.created_at, c.id FROM credit_transactions c
          WHERE c.id = ${cursor} AND c.company_id = ${companyId})`
      : Prisma.empty;
    const rows = await this.prisma.$queryRaw<CreditHistoryRow[]>(Prisma.sql`
      WITH l AS (
        SELECT ct.id, ct.type::text AS type, ct.amount, ct.reason, ct.claim_slot_id, ct.created_at,
          SUM(CASE ct.type::text WHEN 'GRANT' THEN ct.amount WHEN 'RESERVE' THEN -ct.amount
                WHEN 'REFUND' THEN ct.amount ELSE 0 END)
            OVER (ORDER BY ct.created_at, ct.id ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)::int AS available_after,
          SUM(CASE ct.type::text WHEN 'RESERVE' THEN ct.amount WHEN 'REFUND' THEN -ct.amount
                WHEN 'CONSUME' THEN -ct.amount ELSE 0 END)
            OVER (ORDER BY ct.created_at, ct.id ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)::int AS reserved_after
        FROM credit_transactions ct
        WHERE ct.company_id = ${companyId}
      )
      SELECT l.* FROM l
      ${cursorFilter}
      ORDER BY l.created_at DESC, l.id DESC
      LIMIT ${limit + 1}
    `);
    const page = rows.slice(0, limit);
    const slotIds = [...new Set(page.map((r) => r.claim_slot_id).filter((id): id is string => !!id))];
    // preluarea legata: doar sloturile firmei proprii (aparare in adancime)
    const slots = slotIds.length
      ? await this.prisma.claimSlot.findMany({
          where: { id: { in: slotIds }, companyId },
          select: { id: true, requestId: true, request: { select: { title: true } } },
        })
      : [];
    // titlul se mascheaza ca in piata si in vederea limitata a fisei (maskFreeText): poate contine
    // contacte scrise de client, iar istoricul arata si preluari retrase / cereri sterse. Legatura
    // spre fisa ramane: getClaimContext deschide orice slot al firmei (vedere limitata daca nu-l mai ocupa).
    const slotById = new Map(
      slots.map((s) => [
        s.id,
        { requestId: s.requestId, requestTitle: s.request?.title ? maskFreeText(s.request.title) : null },
      ]),
    );
    const items = page.map((r) => toHistoryItem(r, r.claim_slot_id ? (slotById.get(r.claim_slot_id) ?? null) : null));
    return { items, nextCursor: rows.length > limit ? (page[page.length - 1]?.id ?? null) : null };
  }
}

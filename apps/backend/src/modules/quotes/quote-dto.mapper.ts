import {
  MAX_QUOTE_VERSIONS,
  type AttachmentDto,
  type ConsultationInviteDto,
  type QuoteChangeRequestHistoryDto,
  type QuoteDto,
  type QuoteVersionDto,
} from '@marketplace/shared';
import {
  Prisma,
  type PhysicalConsultationInvite,
  type PhysicalConsultationInviteStatus,
  type QuoteChangeRequest,
  type QuoteChangeRequestStatus,
  type QuoteCurrency,
  type QuoteDeclineReason,
  type QuoteStatus,
  type QuoteValidityExtension,
  type QuoteVersion,
} from '@prisma/client';
import { VAT_RATE_DEFAULT } from '../billing/vat';
import { amountWithVat, convertCurrency, deliveryWorkingDays } from './quotes.helpers';

// E-company-2: maparea QuoteDto e pura (fara I/O) — chitanta idempotenta si raspunsul
// actiunilor pe oferta se construiesc in memorie, fara recitiri in tranzactie (~150 ms/query
// cross-region). getQuoteDto = loadQuoteFull + 1 query de atasamente + toQuoteDto.

// Ce citeste DTO-ul (fara `request`: DTO-ul nu il foloseste).
export const QUOTE_DTO_INCLUDE = {
  company: { select: { name: true } },
  versions: {
    orderBy: { version: 'asc' as const },
    include: {
      changeRequests: { orderBy: { createdAt: 'asc' as const } },
      validityExtensions: { orderBy: { extendedAt: 'asc' as const } },
      // defalcarea pe camere (F7) — roomType pentru afisare directa la client
      roomPrices: { include: { room: { select: { roomType: true } } } },
    },
  },
  consultationInvites: { orderBy: { createdAt: 'asc' as const } },
} satisfies Prisma.QuoteInclude;

// Varianta cu cererea (gardele pre-tranzactie: status/deletedAt/includesPaidDesign/client).
export const QUOTE_INCLUDE = { ...QUOTE_DTO_INCLUDE, request: true } satisfies Prisma.QuoteInclude;

export type QuoteFull = Prisma.QuoteGetPayload<{ include: typeof QUOTE_DTO_INCLUDE }>;
export type QuoteFullWithRequest = Prisma.QuoteGetPayload<{ include: typeof QUOTE_INCLUDE }>;
export type QuoteVersionFull = QuoteFull['versions'][number];
type RoomTypeOf = QuoteVersionFull['roomPrices'][number]['room']['roomType'];
export type RoomPriceInput = { id: string; requestRoomId: string; price: number; roomType: RoomTypeOf };

export function nonExtraCount(versions: { isExtra: boolean }[]): number {
  return versions.filter((v) => !v.isExtra).length;
}

export function pendingChangeCount(full: QuoteFull): number {
  return full.versions.reduce(
    (n, v) => n + v.changeRequests.filter((c) => c.status === 'PENDING').length,
    0,
  );
}

// a4: moneda variantei; variantele scrise de codul vechi (fereastra blue/green) nu o au → oferta
export function versionCurrency(v: { currency?: QuoteCurrency | null }, quoteCurrency: QuoteCurrency): QuoteCurrency {
  return v.currency ?? quoteCurrency;
}

// a4: numarul variantei care a raspuns unei cereri FULFILLED. Randurile noi au
// answered_by_version_id; cele vechi (fara coloana completata) → prima varianta in limita
// trimisa dupa varianta cererii, la momentul raspunsului (revise e singurul drum care
// indeplineste o cerere si creeaza varianta in aceeasi tranzactie).
function answeredByVersionNumber(full: QuoteFull, c: QuoteChangeRequest, requestedOn: number): number | null {
  if (c.status !== 'FULFILLED') return null;
  if (c.answeredByVersionId) {
    const byId = full.versions.find((v) => v.id === c.answeredByVersionId);
    if (byId) return byId.version;
  }
  const after = full.versions
    .filter((v) => v.version > requestedOn && !v.isExtra)
    .sort((a, b) => a.version - b.version);
  if (after.length === 0) return null;
  const respondedAt = c.respondedAt?.getTime();
  if (respondedAt != null) {
    // toleranta: sent_at = now() al tranzactiei (putin inainte de respondedAt din aplicatie)
    const near = after.find((v) => Math.abs(v.sentAt.getTime() - respondedAt) < 60_000);
    if (near) return near.version;
  }
  return after[0].version;
}

export function toQuoteDto(
  full: QuoteFull,
  attachmentsByVersion: Map<string, AttachmentDto[]>,
  rate: number,
  now: number = Date.now(),
  vatRatePercent: number = VAT_RATE_DEFAULT,
): QuoteDto {
  const versions: QuoteVersionDto[] = full.versions.map((v) => {
    const currency = versionCurrency(v, full.currency);
    const price = Number(v.price);
    const designFee = v.designFee != null ? Number(v.designFee) : null;
    const p = convertCurrency(price, currency, rate);
    const d = designFee != null ? convertCurrency(designFee, currency, rate) : null;
    // E-client-1: totalul acceptat = pret + proiectare (docs/03, D-v6-11), in moneda variantei
    const total = Math.round((price + (designFee ?? 0)) * 100) / 100;
    const tc = convertCurrency(total, currency, rate);
    const versionVat = v.vatRatePercent != null ? Number(v.vatRatePercent) : vatRatePercent;
    const pendingChange =
      v.changeRequests.find((c) => c.status === 'PENDING') ??
      v.changeRequests[v.changeRequests.length - 1] ??
      null;
    return {
      id: v.id,
      version: v.version,
      isExtra: v.isExtra,
      price,
      designFee,
      currency,
      priceRon: p.ron,
      priceEur: p.eur,
      designFeeRon: d?.ron ?? null,
      designFeeEur: d?.eur ?? null,
      total,
      totalRon: tc.ron,
      totalEur: tc.eur,
      deliveryTerm: v.deliveryTerm,
      deliveryDate: v.deliveryDate ? v.deliveryDate.toISOString().slice(0, 10) : null,
      warranty: v.warranty,
      description: v.description,
      // a3 — rubrici structurate (null pe variantele vechi) + valorile calculate
      vatMode: v.vatMode ?? null,
      deliveryTermValue: v.deliveryTermValue ?? null,
      deliveryTermUnit: v.deliveryTermUnit ?? null,
      warrantyMonths: v.warrantyMonths ?? null,
      includesTransport: v.includesTransport ?? null,
      includesAssembly: v.includesAssembly ?? null,
      designIncludes: v.designIncludes ?? null,
      // revizuire M1: cota inghetata pe varianta; cota curenta doar pentru variantele vechi (NULL)
      vatRatePercent: versionVat,
      priceWithVat: amountWithVat(price, v.vatMode, versionVat),
      totalWithVat: amountWithVat(total, v.vatMode, versionVat),
      deliveryWorkingDays: deliveryWorkingDays(v.deliveryTermValue, v.deliveryTermUnit),
      validUntil: v.validUntil.toISOString(),
      // E-admin-platform-3: o oferta ACCEPTED/SUPERSEDED/WITHDRAWN/DECLINED nu mai e "expirata"
      isExpired: (full.status === 'SENT' || full.status === 'EXPIRED') && v.validUntil.getTime() < now,
      validityExtensionsUsed: v.validityExtensions.length,
      extensionRequestedAt: v.extensionRequestedAt?.toISOString() ?? null,
      createdByUserId: v.createdByUserId,
      sentAt: v.sentAt.toISOString(),
      roomPrices: v.roomPrices.map((rp) => ({
        requestRoomId: rp.requestRoomId,
        roomType: rp.room.roomType,
        price: Number(rp.price),
      })),
      changeRequest: pendingChange
        ? {
            id: pendingChange.id,
            quoteVersionId: pendingChange.quoteVersionId,
            requestedText: pendingChange.requestedText,
            status: pendingChange.status,
            createdAt: pendingChange.createdAt.toISOString(),
            respondedAt: pendingChange.respondedAt?.toISOString() ?? null,
          }
        : null,
      attachments: (attachmentsByVersion.get(v.id) ?? []).map((a) => ({
        id: a.id,
        filename: a.filename,
        mimeType: a.mimeType,
        downloadUrl: a.downloadUrl,
      })),
    };
  });
  const consultationInvites: ConsultationInviteDto[] = full.consultationInvites.map((i) => ({
    id: i.id,
    quoteId: i.quoteId,
    companyId: i.companyId,
    locationAddress: i.locationAddress,
    proposedDatetime: i.proposedDatetime.toISOString(),
    alternativeDatetimes: (i.alternativeDatetimes as string[] | null) ?? null,
    status: i.status,
    clientResponseText: i.clientResponseText,
    expiresAt: i.expiresAt.toISOString(),
    respondedAt: i.respondedAt?.toISOString() ?? null,
    createdAt: i.createdAt.toISOString(),
  }));
  const versionsUsed = nonExtraCount(full.versions);
  const changeRequests: QuoteChangeRequestHistoryDto[] = full.versions
    .flatMap((v) => v.changeRequests.map((c) => ({ c, requestedOn: v.version })))
    .sort((a, b) => a.c.createdAt.getTime() - b.c.createdAt.getTime())
    .map(({ c, requestedOn }) => ({
      id: c.id,
      quoteVersionId: c.quoteVersionId,
      requestedText: c.requestedText,
      status: c.status,
      createdAt: c.createdAt.toISOString(),
      respondedAt: c.respondedAt?.toISOString() ?? null,
      requestedOnVersion: requestedOn,
      answeredByVersion: answeredByVersionNumber(full, c, requestedOn),
    }));
  const latest = full.versions.length > 0
    ? full.versions.reduce((a, b) => (b.version > a.version ? b : a))
    : null;
  return {
    id: full.id,
    claimSlotId: full.claimSlotId,
    requestId: full.requestId,
    companyId: full.companyId,
    companyName: full.company.name,
    // a4: moneda variantei curente
    currency: latest ? versionCurrency(latest, full.currency) : full.currency,
    status: full.status,
    extraVersionsCount: full.extraVersionsCount,
    versionsUsed,
    versionLimitReached: versionsUsed >= MAX_QUOTE_VERSIONS,
    eurRonRate: rate,
    versions,
    consultationInvites,
    createdAt: full.createdAt.toISOString(),
    acceptedAt: full.acceptedAt?.toISOString() ?? null,
    acceptedVersionId: full.acceptedVersionId ?? null,
    declinedAt: full.declinedAt?.toISOString() ?? null,
    declineReason: full.declineReason ?? null,
    declineNote: full.declineNote ?? null,
    changeRequests,
  };
}

// ===== patch-uri pure pentru chitanta (starea de dupa mutatie, fara recitire) =====

function mapVersion(
  full: QuoteFull,
  versionId: string,
  patch: (v: QuoteVersionFull) => QuoteVersionFull,
): QuoteFull {
  return { ...full, versions: full.versions.map((v) => (v.id === versionId ? patch(v) : v)) };
}

export function withNewVersion(
  full: QuoteFull,
  versionRow: QuoteVersion,
  roomPrices: RoomPriceInput[],
): QuoteFull {
  const version: QuoteVersionFull = {
    ...versionRow,
    changeRequests: [],
    validityExtensions: [],
    roomPrices: roomPrices.map((rp) => ({
      id: rp.id,
      quoteVersionId: versionRow.id,
      requestRoomId: rp.requestRoomId,
      price: new Prisma.Decimal(rp.price),
      room: { roomType: rp.roomType },
    })),
  };
  return {
    ...full,
    versions: [...full.versions, version].sort((a, b) => a.version - b.version),
  };
}

export function withStatus(
  full: QuoteFull,
  status: QuoteStatus,
  extra: {
    acceptedAt?: Date;
    withdrawnAt?: Date;
    extraVersionsCountDelta?: number;
    updatedAt?: Date;
    acceptedVersionId?: string;
    currency?: QuoteCurrency;
    declined?: { at: Date; reason: QuoteDeclineReason | null; note: string | null };
  } = {},
): QuoteFull {
  return {
    ...full,
    status,
    currency: extra.currency ?? full.currency,
    ...(extra.declined
      ? { declinedAt: extra.declined.at, declineReason: extra.declined.reason, declineNote: extra.declined.note }
      : {}),
    acceptedAt: extra.acceptedAt ?? full.acceptedAt,
    acceptedVersionId: extra.acceptedVersionId ?? full.acceptedVersionId,
    withdrawnAt: extra.withdrawnAt ?? full.withdrawnAt,
    extraVersionsCount: full.extraVersionsCount + (extra.extraVersionsCountDelta ?? 0),
    updatedAt: extra.updatedAt ?? full.updatedAt,
  };
}

export function withChangeRequest(full: QuoteFull, versionId: string, row: QuoteChangeRequest): QuoteFull {
  return mapVersion(full, versionId, (v) => ({ ...v, changeRequests: [...v.changeRequests, row] }));
}

export function withChangeStatus(
  full: QuoteFull,
  changeId: string,
  status: QuoteChangeRequestStatus,
  respondedAt: Date,
  answeredByVersionId: string | null = null,
): QuoteFull {
  return {
    ...full,
    versions: full.versions.map((v) => ({
      ...v,
      changeRequests: v.changeRequests.map((c) =>
        c.id === changeId ? { ...c, status, respondedAt, answeredByVersionId: answeredByVersionId ?? c.answeredByVersionId } : c,
      ),
    })),
  };
}

export function withExtension(
  full: QuoteFull,
  versionId: string,
  extRow: QuoteValidityExtension,
  newValidUntil: Date,
): QuoteFull {
  return mapVersion(full, versionId, (v) => ({
    ...v,
    validUntil: newValidUntil,
    validityExtensions: [...v.validityExtensions, extRow],
  }));
}

export function withInvite(full: QuoteFull, inviteRow: PhysicalConsultationInvite): QuoteFull {
  return { ...full, consultationInvites: [...full.consultationInvites, inviteRow] };
}

export function withInviteStatus(
  full: QuoteFull,
  inviteId: string,
  patch: { status: PhysicalConsultationInviteStatus; clientResponseText: string | null; respondedAt: Date },
): QuoteFull {
  return {
    ...full,
    consultationInvites: full.consultationInvites.map((i) => (i.id === inviteId ? { ...i, ...patch } : i)),
  };
}

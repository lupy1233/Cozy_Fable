import {
  MAX_QUOTE_VERSIONS,
  type AttachmentDto,
  type ConsultationInviteDto,
  type QuoteDto,
  type QuoteVersionDto,
} from '@marketplace/shared';
import {
  Prisma,
  type PhysicalConsultationInvite,
  type PhysicalConsultationInviteStatus,
  type QuoteChangeRequest,
  type QuoteChangeRequestStatus,
  type QuoteStatus,
  type QuoteValidityExtension,
  type QuoteVersion,
} from '@prisma/client';
import { convertCurrency } from './quotes.helpers';

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

export function toQuoteDto(
  full: QuoteFull,
  attachmentsByVersion: Map<string, AttachmentDto[]>,
  rate: number,
  now: number = Date.now(),
): QuoteDto {
  const versions: QuoteVersionDto[] = full.versions.map((v) => {
    const price = Number(v.price);
    const designFee = v.designFee != null ? Number(v.designFee) : null;
    const p = convertCurrency(price, full.currency, rate);
    const d = designFee != null ? convertCurrency(designFee, full.currency, rate) : null;
    // E-client-1: totalul acceptat = pret + proiectare (docs/03, D-v6-11), in moneda ofertei
    const total = Math.round((price + (designFee ?? 0)) * 100) / 100;
    const tc = convertCurrency(total, full.currency, rate);
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
      currency: full.currency,
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
      validUntil: v.validUntil.toISOString(),
      // E-admin-platform-3: o oferta ACCEPTED/SUPERSEDED/WITHDRAWN nu mai e "expirata"
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
  return {
    id: full.id,
    claimSlotId: full.claimSlotId,
    requestId: full.requestId,
    companyId: full.companyId,
    companyName: full.company.name,
    currency: full.currency,
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
  } = {},
): QuoteFull {
  return {
    ...full,
    status,
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
): QuoteFull {
  return {
    ...full,
    versions: full.versions.map((v) => ({
      ...v,
      changeRequests: v.changeRequests.map((c) => (c.id === changeId ? { ...c, status, respondedAt } : c)),
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

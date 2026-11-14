import { Prisma } from '@prisma/client';
import { convertCurrency } from './quotes.helpers';
import {
  toQuoteDto,
  withChangeRequest,
  withChangeStatus,
  withExtension,
  withInvite,
  withInviteStatus,
  withNewVersion,
  withStatus,
} from './quote-dto.mapper';
import { makeQuoteFull, makeVersion, PAST } from './quotes.test-fixtures';

// E-company-2 — maparea pura QuoteDto (fara I/O) + patch-urile folosite la chitanta in memorie.

/* eslint-disable @typescript-eslint/no-explicit-any */
type Any = any;

const RATE = 5.2;
const NO_ATTACHMENTS = new Map();
const change = (over: Any = {}) => ({
  id: 'cr',
  quoteVersionId: 'v1',
  clientUserId: 'u-client',
  requestedText: 't',
  status: 'REJECTED',
  respondedAt: null,
  createdAt: new Date('2026-09-01T00:00:00Z'),
  ...over,
});

describe('convertCurrency (D-v6-12)', () => {
  it('RON → EUR rotunjit la 2 zecimale', () => {
    expect(convertCurrency(1000, 'RON', RATE)).toEqual({ ron: 1000, eur: 192.31 });
  });
  it('EUR → RON', () => {
    expect(convertCurrency(100, 'EUR', RATE)).toEqual({ eur: 100, ron: 520 });
  });
  it('curs 0 → EUR 0 (fara impartire la zero)', () => {
    expect(convertCurrency(1000, 'RON', 0)).toEqual({ ron: 1000, eur: 0 });
  });
});

describe('toQuoteDto', () => {
  it('oferta RON → priceEur = price / 5.2 rotunjit (ca convertCurrency)', () => {
    const dto = toQuoteDto(makeQuoteFull(), NO_ATTACHMENTS, RATE);
    expect(dto.versions[0]).toMatchObject({ price: 1000, priceRon: 1000, priceEur: 192.31, currency: 'RON' });
    expect(dto.eurRonRate).toBe(RATE);
  });

  it('oferta EUR → priceRon = price × 5.2; designFee convertit la fel', () => {
    const full = makeQuoteFull();
    full.currency = 'EUR';
    full.versions[0].designFee = new Prisma.Decimal(50);
    const dto = toQuoteDto(full, NO_ATTACHMENTS, RATE);
    expect(dto.versions[0]).toMatchObject({ priceEur: 1000, priceRon: 5200, designFee: 50, designFeeEur: 50, designFeeRon: 260 });
  });

  it.each([
    ['SENT', true],
    ['EXPIRED', true],
    ['ACCEPTED', false],
    ['WITHDRAWN', false],
    ['SUPERSEDED', false],
  ])('isExpired doar pentru SENT/EXPIRED dupa valid_until (%s → %s)', (status, expired) => {
    const dto = toQuoteDto(makeQuoteFull({ status, versions: [{ validUntil: PAST }] }), NO_ATTACHMENTS, RATE);
    expect(dto.versions[0].isExpired).toBe(expired);
  });

  it('versionLimitReached la 3 versiuni non-extra (extra nu se numara)', () => {
    const two = toQuoteDto(makeQuoteFull({ versions: [{}, {}, { isExtra: true }] }), NO_ATTACHMENTS, RATE);
    expect(two).toMatchObject({ versionsUsed: 2, versionLimitReached: false });
    const three = toQuoteDto(makeQuoteFull({ versions: [{}, {}, {}] }), NO_ATTACHMENTS, RATE);
    expect(three).toMatchObject({ versionsUsed: 3, versionLimitReached: true });
  });

  it('cererea PENDING e preferata celei mai recente; altfel ultima', () => {
    const withPending = makeQuoteFull({
      versions: [{ changeRequests: [change({ id: 'a', status: 'PENDING' }), change({ id: 'b' })] }],
    });
    expect(toQuoteDto(withPending, NO_ATTACHMENTS, RATE).versions[0].changeRequest?.id).toBe('a');
    const noPending = makeQuoteFull({ versions: [{ changeRequests: [change({ id: 'a' }), change({ id: 'b' })] }] });
    expect(toQuoteDto(noPending, NO_ATTACHMENTS, RATE).versions[0].changeRequest?.id).toBe('b');
  });

  it('roomPrices cu roomType; atasamentele pe versiune din harta', () => {
    const full = makeQuoteFull();
    full.versions[0].roomPrices = [
      { id: 'rp', quoteVersionId: 'v1', requestRoomId: 'room1', price: new Prisma.Decimal(400), room: { roomType: 'KITCHEN' } },
    ];
    const attachments = new Map([
      ['v1', [{ id: 'a1', filename: 'f.pdf', mimeType: 'application/pdf', downloadUrl: 'u', sizeBytes: 1, status: 'SAFE', createdAt: 'x' }]],
    ]);
    const dto = toQuoteDto(full, attachments as Any, RATE);
    expect(dto.versions[0].roomPrices).toEqual([{ requestRoomId: 'room1', roomType: 'KITCHEN', price: 400 }]);
    expect(dto.versions[0].attachments).toEqual([{ id: 'a1', filename: 'f.pdf', mimeType: 'application/pdf', downloadUrl: 'u' }]);
  });
});

describe('patch-uri pentru chitanta', () => {
  it('withNewVersion adauga versiunea ordonata, cu roomPrices si fara cereri/prelungiri', () => {
    const v2 = makeVersion(2);
    delete v2.changeRequests;
    delete v2.validityExtensions;
    delete v2.roomPrices;
    const next = withNewVersion(makeQuoteFull(), v2, [{ id: 'rp', requestRoomId: 'room1', price: 1000, roomType: 'KITCHEN' as Any }]);
    const dto = toQuoteDto(next, NO_ATTACHMENTS, RATE);
    expect(dto.versions.map((v) => v.version)).toEqual([1, 2]);
    expect(dto.versions[1]).toMatchObject({ roomPrices: [{ requestRoomId: 'room1', roomType: 'KITCHEN', price: 1000 }], changeRequest: null });
  });

  it('withStatus schimba statusul, acceptedAt si contorul extra', () => {
    const at = new Date('2026-09-29T12:00:00Z');
    const dto = toQuoteDto(withStatus(makeQuoteFull(), 'ACCEPTED', { acceptedAt: at, extraVersionsCountDelta: 1 }), NO_ATTACHMENTS, RATE);
    expect(dto).toMatchObject({ status: 'ACCEPTED', acceptedAt: at.toISOString(), extraVersionsCount: 1 });
  });

  it('withChangeRequest + withChangeStatus', () => {
    const added = withChangeRequest(makeQuoteFull(), 'v1', change({ id: 'n', status: 'PENDING' }) as Any);
    expect(toQuoteDto(added, NO_ATTACHMENTS, RATE).versions[0].changeRequest).toMatchObject({ id: 'n', status: 'PENDING' });
    const at = new Date('2026-09-29T12:00:00Z');
    const done = withChangeStatus(added, 'n', 'REJECTED', at);
    expect(toQuoteDto(done, NO_ATTACHMENTS, RATE).versions[0].changeRequest).toMatchObject({
      status: 'REJECTED',
      respondedAt: at.toISOString(),
    });
  });

  it('withExtension muta valid_until si numara prelungirea', () => {
    const until = new Date('2026-12-01T00:00:00Z');
    const next = withExtension(makeQuoteFull(), 'v1', { id: 'e' } as Any, until);
    expect(toQuoteDto(next, NO_ATTACHMENTS, RATE).versions[0]).toMatchObject({
      validUntil: until.toISOString(),
      validityExtensionsUsed: 1,
    });
  });

  it('withInvite + withInviteStatus', () => {
    const invite: Any = {
      id: 'i1', quoteId: 'q1', companyId: 'c-win', locationAddress: 'X', proposedDatetime: new Date('2026-10-01T10:00:00Z'),
      alternativeDatetimes: null, status: 'PENDING_CLIENT', clientResponseText: null, respondedAt: null,
      expiresAt: new Date('2026-10-08T10:00:00Z'), createdAt: new Date('2026-09-29T10:00:00Z'),
    };
    const at = new Date('2026-09-30T10:00:00Z');
    const next = withInviteStatus(withInvite(makeQuoteFull(), invite), 'i1', { status: 'ACCEPTED', clientResponseText: 'ok', respondedAt: at });
    expect(toQuoteDto(next, NO_ATTACHMENTS, RATE).consultationInvites).toEqual([
      expect.objectContaining({ id: 'i1', status: 'ACCEPTED', clientResponseText: 'ok', respondedAt: at.toISOString() }),
    ]);
  });
});

describe('E-client-1 — total oferta + versiunea acceptata', () => {
  it('fara design fee → total = pret', () => {
    const dto = toQuoteDto(makeQuoteFull(), NO_ATTACHMENTS, RATE);
    expect(dto.versions[0]).toMatchObject({ price: 1000, designFee: null, total: 1000, totalRon: 1000, totalEur: 192.31 });
  });

  it('RON: 1000 + proiectare 250 → total 1250, totalEur 240.38 (curs 5.2)', () => {
    const full = makeQuoteFull();
    full.versions[0].designFee = new Prisma.Decimal(250);
    const dto = toQuoteDto(full, NO_ATTACHMENTS, RATE);
    expect(dto.versions[0]).toMatchObject({ total: 1250, totalRon: 1250, totalEur: 240.38 });
  });

  it('EUR: totalRon = round2(total × curs)', () => {
    const full = makeQuoteFull();
    full.currency = 'EUR';
    full.versions[0].price = new Prisma.Decimal(1000.55);
    full.versions[0].designFee = new Prisma.Decimal(50.1);
    const dto = toQuoteDto(full, NO_ATTACHMENTS, RATE);
    expect(dto.versions[0]).toMatchObject({ total: 1050.65, totalEur: 1050.65, totalRon: 5463.38 });
  });

  it('acceptedVersionId: null implicit, trecut prin DTO si setat de withStatus', () => {
    expect(toQuoteDto(makeQuoteFull(), NO_ATTACHMENTS, RATE).acceptedVersionId).toBeNull();
    const full = makeQuoteFull({ versions: [{}, {}] });
    full.acceptedVersionId = 'v2';
    expect(toQuoteDto(full, NO_ATTACHMENTS, RATE).acceptedVersionId).toBe('v2');
    const at = new Date('2026-09-30T12:00:00Z');
    const accepted = withStatus(makeQuoteFull(), 'ACCEPTED', { acceptedAt: at, acceptedVersionId: 'v1' });
    expect(toQuoteDto(accepted, NO_ATTACHMENTS, RATE)).toMatchObject({ status: 'ACCEPTED', acceptedVersionId: 'v1' });
  });
});

// a3 / a4 (2026-11-13) — variante vechi neschimbate, moneda pe varianta, istoricul cererilor
describe('toQuoteDto — rubrici structurate, moneda variantei, cereri de modificare (a3/a4)', () => {
  it('varianta veche (fara rubrici): textul liber ramane, rubricile si calculele sunt null', () => {
    const full = makeQuoteFull();
    full.versions[0].deliveryTerm = '6 saptamani';
    full.versions[0].warranty = '2 ani';
    const v = toQuoteDto(full, NO_ATTACHMENTS, RATE, Date.now(), 21).versions[0];
    expect(v).toMatchObject({
      deliveryTerm: '6 saptamani',
      warranty: '2 ani',
      vatMode: null,
      deliveryTermValue: null,
      deliveryTermUnit: null,
      warrantyMonths: null,
      includesTransport: null,
      includesAssembly: null,
      designIncludes: null,
      vatRatePercent: 21,
      priceWithVat: null,
      totalWithVat: null,
      deliveryWorkingDays: null,
    });
  });

  it('v1 in RON, v2 in EUR fara TVA: fiecare varianta in moneda ei; oferta = moneda variantei curente', () => {
    const full = makeQuoteFull({ versions: [{}, {}] });
    full.versions[0].currency = 'RON';
    Object.assign(full.versions[1], {
      currency: 'EUR', price: new Prisma.Decimal(3900), vatMode: 'VAT_EXCLUDED',
      deliveryTermValue: 6, deliveryTermUnit: 'WEEKS', warrantyMonths: 24, includesTransport: true, includesAssembly: true,
    });
    const dto = toQuoteDto(full, NO_ATTACHMENTS, RATE, Date.now(), 21);
    expect(dto.currency).toBe('EUR');
    expect(dto.versions[0]).toMatchObject({ currency: 'RON', priceRon: 1000 });
    expect(dto.versions[1]).toMatchObject({
      currency: 'EUR', priceEur: 3900, priceRon: 20280, priceWithVat: 4719, deliveryWorkingDays: 30,
    });
  });

  it('varianta fara moneda (scrisa de codul vechi) → moneda ofertei', () => {
    const full = makeQuoteFull();
    full.currency = 'EUR';
    full.versions[0].currency = null;
    expect(toQuoteDto(full, NO_ATTACHMENTS, RATE).versions[0].currency).toBe('EUR');
  });

  it('changeRequests: toate, in ordine, cu varianta ceruta si varianta care a raspuns', () => {
    const full = makeQuoteFull({
      versions: [
        { changeRequests: [change({ id: 'c1', status: 'FULFILLED', respondedAt: new Date('2026-09-02T00:00:00Z'), answeredByVersionId: 'v2' })] },
        { changeRequests: [change({ id: 'c2', quoteVersionId: 'v2', status: 'REJECTED', createdAt: new Date('2026-09-03T00:00:00Z') })] },
        { changeRequests: [] },
      ],
    });
    const dto = toQuoteDto(full, NO_ATTACHMENTS, RATE);
    expect(dto.changeRequests).toEqual([
      expect.objectContaining({ id: 'c1', status: 'FULFILLED', requestedOnVersion: 1, answeredByVersion: 2 }),
      expect.objectContaining({ id: 'c2', status: 'REJECTED', requestedOnVersion: 2, answeredByVersion: null }),
    ]);
  });

  it('cerere FULFILLED veche (fara answered_by_version_id) → prima varianta in limita de dupa', () => {
    const full = makeQuoteFull({
      versions: [{ changeRequests: [change({ id: 'c1', status: 'FULFILLED', respondedAt: null })] }, {}],
    });
    expect(toQuoteDto(full, NO_ATTACHMENTS, RATE).changeRequests[0]).toMatchObject({ requestedOnVersion: 1, answeredByVersion: 2 });
  });

  it('refuzul: declinedAt / declineReason / declineNote; DECLINED nu e "expirata"', () => {
    const full = makeQuoteFull({ status: 'DECLINED', versions: [{ validUntil: PAST }] });
    Object.assign(full, { declinedAt: new Date('2026-09-05T10:00:00Z'), declineReason: 'PRICE', declineNote: 'scump' });
    const dto = toQuoteDto(full, NO_ATTACHMENTS, RATE);
    expect(dto).toMatchObject({ status: 'DECLINED', declinedAt: '2026-09-05T10:00:00.000Z', declineReason: 'PRICE', declineNote: 'scump' });
    expect(dto.versions[0].isExpired).toBe(false);
  });

  it('oferta fara refuz → campurile de refuz null', () => {
    expect(toQuoteDto(makeQuoteFull(), NO_ATTACHMENTS, RATE)).toMatchObject({ declinedAt: null, declineReason: null, declineNote: null });
  });
});

describe('toQuoteDto — cota de TVA inghetata pe varianta (revizuire M1)', () => {
  it('varianta cu vat_rate_percent 19 ramane la 19 chiar daca cota curenta e 21; NULL → cota curenta', () => {
    const full = makeQuoteFull({ versions: [{}, {}] });
    Object.assign(full.versions[0], { vatMode: 'VAT_EXCLUDED', vatRatePercent: new Prisma.Decimal(19) });
    Object.assign(full.versions[1], { vatMode: 'VAT_EXCLUDED', vatRatePercent: null });
    const dto = toQuoteDto(full, NO_ATTACHMENTS, RATE, Date.now(), 21);
    expect(dto.versions[0]).toMatchObject({ vatRatePercent: 19, priceWithVat: 1190 });
    expect(dto.versions[1]).toMatchObject({ vatRatePercent: 21, priceWithVat: 1210 });
  });
});
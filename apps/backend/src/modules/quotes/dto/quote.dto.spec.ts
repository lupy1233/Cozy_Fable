import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { CreateQuoteDto, DeclineQuoteDto, ExtraQuoteVersionDto, ReviseQuoteDto } from './quote.dto';

// a3 (PO a3-1/a3-2/a3-3, 2026-11-13): TVA, termen (numar + unitate), garantie (luni) si bifele
// transport / montaj sunt obligatorii pe TOATE drumurile care creeaza o varianta; un payload vechi
// doar cu text e refuzat de ValidationPipe (VALIDATION_ERROR). a4: motivul refuzului.

const SLOT = '7d6f5f0e-6a7e-4c1b-9c39-0c2a7f1f2b11';
const CHANGE = '1b2c3d4e-5f60-4718-8a9b-0c1d2e3f4a5b';
const structured = {
  vatMode: 'VAT_INCLUDED',
  deliveryTermValue: 30,
  deliveryTermUnit: 'WORKING_DAYS',
  warrantyMonths: 24,
  includesTransport: true,
  includesAssembly: false,
};

function errorsOf(cls: new () => object, body: Record<string, unknown>): string[] {
  const errors = validateSync(plainToInstance(cls, body), { whitelist: true, forbidNonWhitelisted: true });
  return errors.map((e) => e.property).sort();
}

describe('OfferFieldsDto — rubrici structurate obligatorii (a3)', () => {
  it('payload vechi (doar text) → refuzat, cu toate rubricile lipsa', () => {
    const legacy = { claimSlotId: SLOT, price: 1000, description: 'x', deliveryTerm: '6 saptamani', warranty: '2 ani' };
    expect(errorsOf(CreateQuoteDto, legacy)).toEqual(
      ['deliveryTermUnit', 'deliveryTermValue', 'includesAssembly', 'includesTransport', 'vatMode', 'warrantyMonths'],
    );
  });

  it.each([
    ['CreateQuoteDto (v1)', CreateQuoteDto, { claimSlotId: SLOT }],
    ['ReviseQuoteDto', ReviseQuoteDto, { changeRequestId: CHANGE }],
    ['ExtraQuoteVersionDto (extra / reoffer)', ExtraQuoteVersionDto, {}],
  ] as const)('%s: cu rubricile complete → valid', (_l, cls, extra) => {
    expect(errorsOf(cls, { ...extra, price: 1000, description: 'x', ...structured })).toEqual([]);
  });

  it.each([
    ['vatMode necunoscut', { vatMode: 'MAYBE' }, 'vatMode'],
    ['termen 0', { deliveryTermValue: 0 }, 'deliveryTermValue'],
    ['termen zecimal', { deliveryTermValue: 1.5 }, 'deliveryTermValue'],
    ['unitate necunoscuta', { deliveryTermUnit: 'MONTHS' }, 'deliveryTermUnit'],
    ['garantie 0', { warrantyMonths: 0 }, 'warrantyMonths'],
    ['bifa ca text', { includesTransport: 'da' }, 'includesTransport'],
    ['bifa lipsa (null)', { includesAssembly: null }, 'includesAssembly'],
    ['moneda necunoscuta', { currency: 'USD' }, 'currency'],
    ['ce include proiectarea gol', { designIncludes: '' }, 'designIncludes'],
  ])('%s → refuzat', (_l, patch, field) => {
    expect(errorsOf(CreateQuoteDto, { claimSlotId: SLOT, price: 1000, description: 'x', ...structured, ...patch })).toEqual([field]);
  });

  it('moneda pe varianta e acceptata si la revise / extra', () => {
    expect(errorsOf(ReviseQuoteDto, { changeRequestId: CHANGE, price: 1, description: 'x', ...structured, currency: 'EUR' })).toEqual([]);
    expect(errorsOf(ExtraQuoteVersionDto, { price: 1, description: 'x', ...structured, currency: 'EUR' })).toEqual([]);
  });
});

describe('DeclineQuoteDto (a4-2)', () => {
  it('corp gol → valid (motivul e optional)', () => {
    expect(errorsOf(DeclineQuoteDto, {})).toEqual([]);
  });
  it('motiv din lista + nota ≤ 500 → valid', () => {
    expect(errorsOf(DeclineQuoteDto, { reason: 'DELIVERY_TERM', note: 'Termenul e prea lung' })).toEqual([]);
  });
  it.each([
    ['motiv necunoscut', { reason: 'BORED' }, 'reason'],
    ['nota prea lunga', { note: 'x'.repeat(501) }, 'note'],
  ])('%s → refuzat', (_l, body, field) => {
    expect(errorsOf(DeclineQuoteDto, body)).toEqual([field]);
  });
});

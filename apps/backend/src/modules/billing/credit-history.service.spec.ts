import { CREDIT_REASONS } from '@marketplace/shared';
import {
  CREDIT_HISTORY_MAX_LIMIT,
  CreditHistoryService,
  clampHistoryLimit,
  historyKind,
  ledgerDeltas,
  toHistoryItem,
  type CreditHistoryRow,
} from './credit-history.service';
import { BillingController } from './billing.controller';
import { maskFreeText } from '../../common/privacy/contact-masking';

// h3 (etapa 9) — istoricul portofelului: transformarea randurilor + doar firma proprie + doar citire.

/* eslint-disable @typescript-eslint/no-explicit-any */

const CURSOR = '22222222-2222-4222-8222-222222222222';

function row(over: Partial<CreditHistoryRow> = {}): CreditHistoryRow {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    type: 'GRANT',
    amount: 10,
    reason: 'CREDIT_PURCHASE',
    claim_slot_id: null,
    created_at: new Date('2026-11-01T10:00:00Z'),
    available_after: 10,
    reserved_after: 0,
    ...over,
  };
}

// Simuleaza fereastra SQL pe un registru din memorie (aceeasi semantica: suma pana la rand inclusiv).
function runningRows(ledger: Array<Pick<CreditHistoryRow, 'id' | 'type' | 'amount' | 'reason'> & { claim_slot_id?: string | null }>) {
  let available = 0;
  let reserved = 0;
  return ledger.map((r, i) => {
    const d = ledgerDeltas(r.type as any, r.amount);
    available += d.availableDelta;
    reserved += d.reservedDelta;
    return row({ ...r, claim_slot_id: r.claim_slot_id ?? null, created_at: new Date(Date.UTC(2026, 10, 1, 10, i)), available_after: available, reserved_after: reserved });
  });
}

describe('credit history — transformare', () => {
  it('semnul pe disponibile / rezervate urmeaza 4.8', () => {
    expect(ledgerDeltas('GRANT', 5)).toEqual({ availableDelta: 5, reservedDelta: 0 });
    expect(ledgerDeltas('RESERVE', 5)).toEqual({ availableDelta: -5, reservedDelta: 5 });
    expect(ledgerDeltas('REFUND', 5)).toEqual({ availableDelta: 5, reservedDelta: -5 });
    expect(ledgerDeltas('CONSUME', 5)).toEqual({ availableDelta: 0, reservedDelta: -5 });
  });

  it('tipul + motivul devin "ce s-a intamplat"; motivele necunoscute → OTHER', () => {
    expect(historyKind('GRANT', 'CREDIT_PURCHASE')).toBe('PURCHASE');
    expect(historyKind('GRANT', 'SUBSCRIPTION_CREDITS')).toBe('SUBSCRIPTION_CREDITS');
    expect(historyKind('GRANT', 'TRIAL_BONUS')).toBe('TRIAL_BONUS');
    expect(historyKind('GRANT', 'OPENING_BALANCE')).toBe('OPENING_BALANCE');
    expect(historyKind('GRANT', 'bonus scris de mana')).toBe('OTHER');
    expect(historyKind('RESERVE', 'CLAIM_RESERVE')).toBe('CLAIM');
    expect(historyKind('REFUND', 'SLA_BREACH')).toBe('REFUND');
    expect(historyKind('CONSUME', 'COMPLETED')).toBe('CONSUME');
    expect(historyKind('REFUND', 'motiv vechi')).toBe('OTHER');
    expect(historyKind('CONSUME', '')).toBe('OTHER');
  });

  it('orice motiv cunoscut are un "kind" diferit de OTHER pe tipul lui', () => {
    for (const reason of CREDIT_REASONS) {
      const type = ['CREDIT_PURCHASE', 'SUBSCRIPTION_CREDITS', 'TRIAL_BONUS'].includes(reason)
        ? 'GRANT'
        : reason === 'CLAIM_RESERVE'
          ? 'RESERVE'
          : 'REFUND';
      expect(historyKind(type, reason)).not.toBe('OTHER');
    }
  });

  it('toHistoryItem: motiv necunoscut → reason null; preluarea legata cu titlul cererii', () => {
    const item = toHistoryItem(
      row({ type: 'RESERVE', reason: 'CLAIM_RESERVE', claim_slot_id: 's1', amount: 3, available_after: 7, reserved_after: 3 }),
      { requestId: 'r1', requestTitle: 'Bucătărie' },
    );
    expect(item).toMatchObject({
      kind: 'CLAIM', reason: 'CLAIM_RESERVE', amount: 3, availableDelta: -3, reservedDelta: 3,
      availableAfter: 7, reservedAfter: 3, claimSlotId: 's1', requestId: 'r1', requestTitle: 'Bucătărie',
      createdAt: '2026-11-01T10:00:00.000Z',
    });
    const odd = toHistoryItem(row({ reason: 'ceva vechi' }), null);
    expect(odd).toMatchObject({ kind: 'OTHER', reason: null, requestId: null, requestTitle: null });
  });

  it('suma miscarilor = soldul de la capat (disponibile si rezervate)', () => {
    const rows = runningRows([
      { id: 'a', type: 'GRANT', amount: 200, reason: 'OPENING_BALANCE' },
      { id: 'b', type: 'RESERVE', amount: 5, reason: 'CLAIM_RESERVE', claim_slot_id: 's1' },
      { id: 'c', type: 'RESERVE', amount: 3, reason: 'CLAIM_RESERVE', claim_slot_id: 's2' },
      { id: 'd', type: 'REFUND', amount: 5, reason: 'SLA_BREACH', claim_slot_id: 's1' },
      { id: 'e', type: 'CONSUME', amount: 3, reason: 'COMPLETED', claim_slot_id: 's2' },
    ]);
    const items = rows.map((r) => toHistoryItem(r, null));
    const sumAvailable = items.reduce((s, i) => s + i.availableDelta, 0);
    const sumReserved = items.reduce((s, i) => s + i.reservedDelta, 0);
    const last = items[items.length - 1];
    expect(last.availableAfter).toBe(sumAvailable);
    expect(last.reservedAfter).toBe(sumReserved);
    expect({ available: last.availableAfter, reserved: last.reservedAfter }).toEqual({ available: 197, reserved: 0 });
  });

  it('limita: implicit 20, plafon 50, valori stricate → implicit', () => {
    expect(clampHistoryLimit(undefined)).toBe(20);
    expect(clampHistoryLimit('abc')).toBe(20);
    expect(clampHistoryLimit('0')).toBe(20);
    expect(clampHistoryLimit('5')).toBe(5);
    expect(clampHistoryLimit('500')).toBe(CREDIT_HISTORY_MAX_LIMIT);
  });
});

describe('CreditHistoryService.list', () => {
  function setup(rows: CreditHistoryRow[], slots: any[] = []) {
    const prisma: any = {
      $queryRaw: jest.fn().mockResolvedValue(rows),
      claimSlot: { findMany: jest.fn().mockResolvedValue(slots) },
      creditTransaction: { create: jest.fn(), update: jest.fn(), delete: jest.fn() },
      companyCreditWallet: { update: jest.fn(), updateMany: jest.fn(), upsert: jest.fn() },
      $transaction: jest.fn(),
    };
    return { prisma, service: new CreditHistoryService(prisma) };
  }

  function sqlOf(prisma: any): { text: string; values: unknown[] } {
    const sql = prisma.$queryRaw.mock.calls[0][0];
    return { text: sql.sql ?? sql.strings?.join('?'), values: sql.values };
  }

  it('interogheaza doar firma proprie, cele mai noi primele, si nu scrie nimic', async () => {
    const { prisma, service } = setup([row({ claim_slot_id: 's1', type: 'RESERVE', reason: 'CLAIM_RESERVE' })], [
      { id: 's1', requestId: 'r1', request: { title: 'Dulap' } },
    ]);
    const page = await service.list('c1', {});
    const { text, values } = sqlOf(prisma);
    expect(text).toContain('ct.company_id = ?');
    expect(text).toContain('ORDER BY l.created_at DESC, l.id DESC');
    expect(values).toContain('c1');
    expect(values).toContain(21); // limit + 1 pentru "mai urmeaza"
    expect(prisma.claimSlot.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: ['s1'] }, companyId: 'c1' } }),
    );
    expect(page.items[0]).toMatchObject({ requestId: 'r1', requestTitle: 'Dulap' });
    expect(page.nextCursor).toBeNull();
    // doar citire: nicio scriere in registru sau portofel
    expect(prisma.creditTransaction.create).not.toHaveBeenCalled();
    expect(prisma.companyCreditWallet.update).not.toHaveBeenCalled();
    expect(prisma.companyCreditWallet.updateMany).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('preluarea altei firme nu se leaga (slotul nu vine din filtrul pe firma)', async () => {
    const { service } = setup([row({ claim_slot_id: 's-alta', type: 'RESERVE', reason: 'CLAIM_RESERVE' })], []);
    const page = await service.list('c1', {});
    expect(page.items[0]).toMatchObject({ claimSlotId: 's-alta', requestId: null, requestTitle: null });
  });

  it('titlul cererii e mascat (contacte scrise de client), ca in piata; legatura spre fisa ramane', async () => {
    const { service } = setup([row({ claim_slot_id: 's1', type: 'REFUND', reason: 'SLA_BREACH' })], [
      { id: 's1', requestId: 'r1', request: { title: 'Dulap Ana 0722 123 456 ana@mail.ro' } },
    ]);
    const page = await service.list('c1', {});
    const title = page.items[0].requestTitle ?? '';
    expect(title).toBe(maskFreeText('Dulap Ana 0722 123 456 ana@mail.ro'));
    expect(title).not.toContain('0722 123 456');
    expect(title).not.toContain('ana@mail.ro');
    expect(title).toContain('Dulap');
    expect(page.items[0]).toMatchObject({ claimSlotId: 's1', requestId: 'r1' });
  });

  it('cerere fara titlu → requestTitle null (interfata scrie „Cerere fara titlu”)', async () => {
    const { service } = setup([row({ claim_slot_id: 's1', type: 'RESERVE', reason: 'CLAIM_RESERVE' })], [
      { id: 's1', requestId: 'r1', request: { title: null } },
    ]);
    expect((await service.list('c1', {})).items[0].requestTitle).toBeNull();
  });

  it('pagina: cu un rand peste limita intoarce nextCursor = ultimul id din pagina', async () => {
    const rows = [row({ id: 'id-3' }), row({ id: 'id-2' }), row({ id: 'id-1' })];
    const { service } = setup(rows);
    const page = await service.list('c1', { limit: '2' });
    expect(page.items.map((i) => i.id)).toEqual(['id-3', 'id-2']);
    expect(page.nextCursor).toBe('id-2');
  });

  it('cursorul se compara doar cu miscarile firmei proprii; cursor nevalid → 400', async () => {
    const { prisma, service } = setup([]);
    await service.list('c1', { cursor: CURSOR });
    const { text, values } = sqlOf(prisma);
    expect(text).toContain('c.company_id = ?');
    expect(values).toEqual(expect.arrayContaining([CURSOR, 'c1']));
    await expect(service.list('c1', { cursor: "x' OR 1=1" })).rejects.toMatchObject({ status: 400 });
  });

  it('ruta GET /billing/credit-history exista pe controllerul cu aceleasi roluri ca soldul', () => {
    const handler = (BillingController.prototype as any).creditHistory;
    expect(Reflect.getMetadata('path', handler)).toBe('credit-history');
    expect(Reflect.getMetadata('method', handler)).toBe(0); // RequestMethod.GET
  });
});

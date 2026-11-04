import { LedgerCheckService, bucharestDate } from './ledger-check.service';

// E-admin-platform-15 — verificarea zilnica ledger vs portofel: doar citiri; la neconcordanta
// o singura intentie outbox pe zi (cheie per data Bucuresti) catre adminii activi, cu numaratori.

/* eslint-disable @typescript-eslint/no-explicit-any */
type Any = any;

function wallet(over: Partial<Record<string, unknown>> = {}) {
  return { company_id: 'c1', balance: 18, reserved: 2, ledger_balance: 18, ledger_reserved: 2, is_demo: false, ...over };
}

function harness(wallets: Any[], slots: Any[]) {
  const tx: Any = { user: { findMany: jest.fn().mockResolvedValue([{ id: 'admin1' }, { id: 'admin2' }]) } };
  const prisma: Any = {
    $queryRaw: jest.fn().mockResolvedValueOnce(wallets).mockResolvedValueOnce(slots),
    $transaction: jest.fn((fn: (t: Any) => Promise<unknown>) => fn(tx)),
  };
  const outbox: Any = { record: jest.fn().mockResolvedValue(undefined) };
  return { service: new LedgerCheckService(prisma, outbox), prisma, outbox, tx };
}

describe('LedgerCheckService', () => {
  const now = new Date('2026-10-01T00:40:00Z'); // 03:40 Bucuresti

  it('curat → raport gol, fara alerta', async () => {
    const h = harness([wallet()], []);
    const report = await h.service.runAndAlert(now);
    expect(report.totals).toEqual({ walletMismatches: 0, unsettledTerminalSlots: 0, openSlotsWithSettlement: 0 });
    expect(report.walletsChecked).toBe(1);
    expect(h.outbox.record).not.toHaveBeenCalled();
    expect(h.prisma.$transaction).not.toHaveBeenCalled();
  });

  it('firma demo: sare DOAR identitatea balance (numarata), reserved se verifica in continuare', async () => {
    const h = harness(
      [
        wallet({ company_id: 'demo-ok', balance: 200, ledger_balance: 0, reserved: 0, ledger_reserved: 0, is_demo: true }),
        wallet({ company_id: 'demo-bad', balance: 200, ledger_balance: 0, reserved: 5, ledger_reserved: 2, is_demo: true }),
      ],
      [],
    );
    const report = await h.service.check(now);
    expect(report.demoBalanceSkipped).toBe(2);
    expect(report.walletMismatches).toEqual([
      { companyId: 'demo-bad', balance: 200, reserved: 5, ledgerBalance: 0, ledgerReserved: 2 },
    ]);
  });

  it('neconcordanta → o intentie outbox pe zi catre admini, payload doar cu numaratori', async () => {
    const h = harness(
      [wallet({ company_id: 'real', balance: 20, reserved: 0 })],
      [
        { id: 's1', status: 'SLA_EXPIRED', kind: 'UNSETTLED_TERMINAL' },
        { id: 's2', status: 'ACTIVE', kind: 'OPEN_WITH_SETTLEMENT' },
      ],
    );
    const report = await h.service.runAndAlert(now);
    expect(report.walletMismatches).toEqual([
      { companyId: 'real', balance: 20, reserved: 0, ledgerBalance: 18, ledgerReserved: 2 },
    ]);
    expect(report.unsettledTerminalSlots).toEqual([{ claimSlotId: 's1', status: 'SLA_EXPIRED' }]);
    expect(report.openSlotsWithSettlement).toEqual([{ claimSlotId: 's2', status: 'ACTIVE' }]);
    expect(h.tx.user.findMany).toHaveBeenCalledWith({ where: { role: 'ADMIN', deletedAt: null }, select: { id: true } });
    expect(h.outbox.record).toHaveBeenCalledTimes(1);
    expect(h.outbox.record).toHaveBeenCalledWith(
      h.tx,
      'credits.ledger_mismatch:2026-10-01',
      'credits.ledger_mismatch',
      { checkedOn: '2026-10-01', walletMismatches: 1, unsettledTerminalSlots: 1, openSlotsWithSettlement: 1 },
      ['admin1', 'admin2'],
    );
  });

  it('listele sunt plafonate la 100, totalurile raman exacte', async () => {
    const slots = Array.from({ length: 130 }, (_, i) => ({ id: `s${i}`, status: 'WITHDRAWN', kind: 'UNSETTLED_TERMINAL' }));
    const h = harness([], slots);
    const report = await h.service.check(now);
    expect(report.unsettledTerminalSlots).toHaveLength(100);
    expect(report.totals.unsettledTerminalSlots).toBe(130);
  });

  it('bucharestDate foloseste ziua calendaristica din Bucuresti', () => {
    expect(bucharestDate(new Date('2026-09-30T21:30:00Z'))).toBe('2026-10-01');
    expect(bucharestDate(new Date('2026-09-30T20:30:00Z'))).toBe('2026-09-30');
  });
});

import { HttpException } from '@nestjs/common';
import { CreditsService } from './credits.service';
import type { PrismaService } from '../../infra/prisma/prisma.service';

// Semantica portofelului de credite (4.8) — inima claim-ului pay-to-play.

function makeTx(wallet: { balance: number; reserved: number } | null) {
  return {
    companyCreditWallet: {
      findUnique: jest.fn().mockResolvedValue(wallet),
      update: jest.fn().mockResolvedValue(undefined),
      updateMany: jest.fn().mockResolvedValue({ count: wallet ? 1 : 0 }),
      upsert: jest.fn().mockResolvedValue(undefined),
    },
    creditTransaction: { create: jest.fn().mockResolvedValue(undefined) },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

describe('CreditsService', () => {
  const service = new CreditsService({} as PrismaService);

  it('reserve arunca INSUFFICIENT_CREDITS (402) cand soldul liber e prea mic', async () => {
    const tx = makeTx({ balance: 1, reserved: 0 });
    await expect(service.reserve('c1', 2, 'CLAIM_RESERVE', 'slot1', tx)).rejects.toMatchObject({
      status: 402,
    });
    await expect(service.reserve('c1', 2, 'CLAIM_RESERVE', 'slot1', tx)).rejects.toBeInstanceOf(
      HttpException,
    );
    expect(tx.companyCreditWallet.update).not.toHaveBeenCalled();
  });

  it('reserve arunca si cand portofelul lipseste', async () => {
    const tx = makeTx(null);
    await expect(service.reserve('c1', 1, 'CLAIM_RESERVE', 'slot1', tx)).rejects.toMatchObject({
      status: 402,
    });
  });

  it('reserve muta balance → reserved si scrie tranzactia RESERVE', async () => {
    const tx = makeTx({ balance: 5, reserved: 0 });
    await service.reserve('c1', 2, 'CLAIM_RESERVE', 'slot1', tx);
    expect(tx.companyCreditWallet.update).toHaveBeenCalledWith({
      where: { companyId: 'c1' },
      data: { balance: { decrement: 2 }, reserved: { increment: 2 } },
    });
    expect(tx.creditTransaction.create).toHaveBeenCalledWith({
      data: { companyId: 'c1', type: 'RESERVE', amount: 2, reason: 'CLAIM_RESERVE', claimSlotId: 'slot1' },
    });
  });

  it('refund muta reserved → balance cu tranzactie REFUND (conditionat pe reserved >= suma)', async () => {
    const tx = makeTx({ balance: 3, reserved: 2 });
    await expect(service.refund('c1', 2, 'WITHDRAWAL_VOLUNTARY_GRACE', 'slot1', tx)).resolves.toBe(true);
    expect(tx.companyCreditWallet.updateMany).toHaveBeenCalledWith({
      where: { companyId: 'c1', reserved: { gte: 2 } },
      data: { reserved: { decrement: 2 }, balance: { increment: 2 } },
    });
    expect(tx.creditTransaction.create).toHaveBeenCalledWith({
      data: { companyId: 'c1', type: 'REFUND', amount: 2, reason: 'WITHDRAWAL_VOLUNTARY_GRACE', claimSlotId: 'slot1' },
    });
  });

  it('consume scade DOAR din reserved (pay-to-play: creditele nu se intorc)', async () => {
    const tx = makeTx({ balance: 3, reserved: 2 });
    await expect(service.consume('c1', 2, 'COMPLETED', 'slot1', tx)).resolves.toBe(true);
    expect(tx.companyCreditWallet.updateMany).toHaveBeenCalledWith({
      where: { companyId: 'c1', reserved: { gte: 2 } },
      data: { reserved: { decrement: 2 } },
    });
    expect(tx.creditTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ type: 'CONSUME' }) }),
    );
  });

  // E-admin-platform-15: portofel deviat (reserved sub suma) → false, fara rand in ledger
  it('refund / consume pe portofel care nu acopera suma → false si NICIUN creditTransaction', async () => {
    const tx = makeTx({ balance: 3, reserved: 0 });
    tx.companyCreditWallet.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.refund('c1', 2, 'SLA_BREACH', 'slot1', tx)).resolves.toBe(false);
    await expect(service.consume('c1', 2, 'SLA_BREACH', 'slot1', tx)).resolves.toBe(false);
    expect(tx.creditTransaction.create).not.toHaveBeenCalled();
    expect(tx.companyCreditWallet.update).not.toHaveBeenCalled();
  });
});

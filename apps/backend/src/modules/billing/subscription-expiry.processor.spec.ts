import type { Job, Queue } from 'bullmq';
import { JOB_BANK_TRANSFER_EXPIRY, SubscriptionExpiryProcessor } from './subscription-expiry.processor';
import type { PrismaService } from '../../infra/prisma/prisma.service';
import type { OutboxService } from '../outbox/outbox.service';
import type { BankTransferService } from './bank-transfer.service';

// E-company-24 — coada subscription-expiry duce si scanarea transferurilor bancare; avertizarea
// de expirare a abonamentului tinteste doar OWNER/MANAGER.

/* eslint-disable @typescript-eslint/no-explicit-any */

function build() {
  const tx: any = {
    subscription: { findFirst: jest.fn(async () => ({ id: 's1' })) },
    companyMember: { findMany: jest.fn().mockResolvedValue([{ userId: 'owner-1' }, { userId: 'mgr-1' }]) },
  };
  const expiresAt = new Date(Date.now() + 3 * 86_400_000 - 2 * 3_600_000); // ceil → 3 zile ramase
  const prisma: any = {
    $transaction: jest.fn(async (fn: any) => fn(tx)),
    subscription: {
      findMany: jest.fn().mockResolvedValue([
        { id: 's1', companyId: 'c1', expiresAt, company: { id: 'c1', name: 'A', deletedAt: null } },
      ]),
    },
  };
  const outbox = { record: jest.fn().mockResolvedValue(undefined) };
  const bankTransfer = { sweep: jest.fn().mockResolvedValue({ reminded: 1, cancelled: 2 }) };
  const queue = { add: jest.fn().mockResolvedValue(undefined) };
  const processor = new SubscriptionExpiryProcessor(
    prisma as PrismaService,
    outbox as unknown as OutboxService,
    bankTransfer as unknown as BankTransferService,
    queue as unknown as Queue,
  );
  return { processor, prisma, tx, outbox, bankTransfer, queue };
}

describe('SubscriptionExpiryProcessor', () => {
  it("job 'bank-transfer-expiry' → doar sweep(), fara scanarea abonamentelor", async () => {
    const { processor, bankTransfer, prisma } = build();
    await processor.process({ name: JOB_BANK_TRANSFER_EXPIRY } as Job);
    expect(bankTransfer.sweep).toHaveBeenCalledTimes(1);
    expect(prisma.subscription.findMany).not.toHaveBeenCalled();
  });

  it("job 'check' → subscription.expiring cu tinte OWNER/MANAGER (filtru de rol)", async () => {
    const { processor, tx, outbox, bankTransfer } = build();
    await processor.process({ name: 'check' } as Job);
    expect(bankTransfer.sweep).not.toHaveBeenCalled();
    expect(tx.companyMember.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { companyId: 'c1', role: { in: ['OWNER', 'MANAGER'] }, user: { deletedAt: null, blockedAt: null } },
    }));
    expect(outbox.record).toHaveBeenCalledTimes(1);
    expect(outbox.record.mock.calls[0][2]).toBe('subscription.expiring');
    expect(outbox.record.mock.calls[0][4]).toEqual(['owner-1', 'mgr-1']);
  });

  it('onModuleInit programeaza verificarea zilnica + scanarea orara a transferurilor + o rulare la boot', async () => {
    const { processor, queue } = build();
    await processor.onModuleInit();
    expect(queue.add).toHaveBeenCalledWith('check', {}, expect.objectContaining({ repeat: { pattern: '0 7 * * *' } }));
    expect(queue.add).toHaveBeenCalledWith(JOB_BANK_TRANSFER_EXPIRY, {}, expect.objectContaining({ repeat: { pattern: '15 * * * *' } }));
    expect(queue.add).toHaveBeenCalledWith(JOB_BANK_TRANSFER_EXPIRY, {}, expect.objectContaining({ jobId: 'bank-transfer-expiry-boot' }));
  });
});

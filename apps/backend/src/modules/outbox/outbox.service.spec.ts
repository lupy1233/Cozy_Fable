import { OutboxService } from './outbox.service';
import type { PrismaService } from '../../infra/prisma/prisma.service';
import type { EventBusService } from '../../infra/event-bus/event-bus.service';

describe('OutboxService recovery', () => {
  function setup() {
    const row = { id: 'event-1', eventType: 'payment.confirmed', payload: { orderId: 'order-1' }, targetUserIds: ['owner-1'] };
    const prisma = { domainEventOutbox: { findMany: jest.fn().mockResolvedValue([row]), updateMany: jest.fn().mockResolvedValue({ count: 1 }) }, company: { findUnique: jest.fn().mockResolvedValue(null) } };
    const events = { publish: jest.fn().mockResolvedValue(undefined) };
    const service = new OutboxService(prisma as unknown as PrismaService, events as unknown as EventBusService);
    return { prisma, events, service };
  }
  it('retains committed intent when Redis fails and replays the same event ID', async () => {
    const { service, prisma, events } = setup();
    events.publish.mockRejectedValueOnce(new Error('Redis unavailable'));
    await expect(service.dispatchBatch()).rejects.toThrow('Outbox delivery incomplete');
    expect(prisma.domainEventOutbox.updateMany).toHaveBeenLastCalledWith(expect.objectContaining({ data: { leaseUntil: null, lastError: 'DELIVERY_FAILED' } }));
    await service.dispatchBatch();
    expect(events.publish).toHaveBeenNthCalledWith(1, 'payment.confirmed', { orderId: 'order-1' }, ['owner-1'], 'event-1');
    expect(events.publish).toHaveBeenNthCalledWith(2, 'payment.confirmed', { orderId: 'order-1' }, ['owner-1'], 'event-1');
    expect(prisma.domainEventOutbox.updateMany).toHaveBeenLastCalledWith(expect.objectContaining({ data: expect.objectContaining({ dispatchedAt: expect.any(Date) }) }));
  });
  it('does not deliver an intent already leased by another worker', async () => {
    const { service, prisma, events } = setup();
    prisma.domainEventOutbox.updateMany.mockResolvedValueOnce({ count: 0 });
    await service.dispatchBatch();
    expect(events.publish).not.toHaveBeenCalled();
  });
  it('replays safely when marking dispatch fails after delivery', async () => {
    const { service, prisma, events } = setup();
    prisma.domainEventOutbox.updateMany.mockResolvedValueOnce({ count: 1 }).mockRejectedValueOnce(new Error('DB disconnected'));
    await expect(service.dispatchBatch()).rejects.toThrow();
    await service.dispatchBatch();
    expect(events.publish.mock.calls.map((call) => call[3])).toEqual(['event-1', 'event-1']);
  });
  it('stores metadata without request titles or company display names', async () => {
    const { service } = setup();
    const tx = { domainEventOutbox: { createMany: jest.fn().mockResolvedValue({ count: 1 }) } };
    await service.record(tx as never, 'claim-created', 'claim.created', { requestId: 'r1', requestTitle: 'Private title', companyName: 'Private company' }, ['u1', 'u1']);
    expect(tx.domainEventOutbox.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ eventKey: 'claim-created', payload: { requestId: 'r1' }, targetUserIds: ['u1'] })],
      skipDuplicates: true,
    });
  });
  it('resolves only the current rejection reason, never a stale one after approval', async () => {
    const { service, prisma, events } = setup();
    prisma.domainEventOutbox.findMany.mockResolvedValue([{ id: 'event-1', eventType: 'company.rejected', payload: { companyId: 'c1' }, targetUserIds: ['owner-1'] }] as never);
    prisma.company.findUnique.mockResolvedValueOnce({ name: 'Firma', status: 'REJECTED', rejectionReason: 'Current reason' } as never);
    await service.dispatchBatch();
    expect(events.publish).toHaveBeenLastCalledWith('company.rejected', { companyId: 'c1', companyName: 'Firma', reason: 'Current reason' }, ['owner-1'], 'event-1');
    prisma.company.findUnique.mockResolvedValueOnce({ name: 'Firma', status: 'APPROVED', rejectionReason: 'Old reason' } as never);
    await service.dispatchBatch();
    expect(events.publish).toHaveBeenLastCalledWith('company.rejected', { companyId: 'c1', companyName: 'Firma' }, ['owner-1'], 'event-1');
  });
});

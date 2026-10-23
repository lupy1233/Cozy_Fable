import { NotificationsService } from './notifications.service';
import type { PrismaService } from '../../infra/prisma/prisma.service';

describe('notification idempotency contract', () => {
  it('uses the database event-recipient constraint on every delivery', async () => {
    const createMany = jest.fn().mockResolvedValue({ count: 1 });
    const service = new NotificationsService({ notification: { createMany } } as unknown as PrismaService);
    await service.createForUsers(['owner'], 'payment.confirmed', { orderId: 'order' }, 'event');
    await service.createForUsers(['owner'], 'payment.confirmed', { orderId: 'order' }, 'event');
    expect(createMany).toHaveBeenCalledTimes(2);
    expect(createMany).toHaveBeenLastCalledWith({ data: [{ userId: 'owner', type: 'payment.confirmed', payload: { orderId: 'order' }, eventId: 'event' }], skipDuplicates: true });
  });
});

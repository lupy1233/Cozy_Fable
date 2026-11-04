import { EventBusService } from './event-bus.service';
import type { EventsGateway } from './events.gateway';
import type { Queue } from 'bullmq';

describe('event delivery identity', () => {
  it('never broadcasts private events with empty or missing recipients', async () => {
    const gateway = { publishToActiveSessions: jest.fn() };
    const queue = { add: jest.fn() };
    const bus = new EventBusService(gateway as unknown as EventsGateway, queue as unknown as Queue);
    await bus.publish('payment.confirmed', { orderId: 'private' }, []);
    await bus.publish('message.created', { messageId: 'private' });
    expect(gateway.publishToActiveSessions).not.toHaveBeenCalled();
    expect(queue.add).not.toHaveBeenCalled();
  });
  it('keeps a stable queue identity and retries an exhausted job during durable replay', async () => {
    const gateway = { publishToActiveSessions: jest.fn().mockResolvedValue(undefined) };
    const job = { getState: jest.fn().mockResolvedValue('failed'), retry: jest.fn().mockResolvedValue(undefined) };
    const queue = { add: jest.fn().mockResolvedValue(job) };
    const bus = new EventBusService(gateway as unknown as EventsGateway, queue as unknown as Queue);
    await bus.publish('payment.confirmed', { orderId: 'order-1' }, ['owner', 'owner'], 'event-1');
    expect(gateway.publishToActiveSessions).toHaveBeenCalledWith('payment.confirmed', { orderId: 'order-1' }, ['owner']);
    expect(queue.add).toHaveBeenCalledWith('payment.confirmed', { orderId: 'order-1', __targets: ['owner'], __eventId: 'event-1' }, expect.objectContaining({ jobId: 'event-event-1', attempts: 3 }));
    expect(job.retry).toHaveBeenCalledTimes(1);
  });
});

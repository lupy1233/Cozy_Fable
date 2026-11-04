import { createHmac } from 'crypto';
import { AuditService } from './audit.service';

describe('AuditService persistence boundary', () => {
  it('sanitizes both snapshots for direct callers and hashes IP without changing attribution', async () => {
    const create = jest.fn();
    const service = new AuditService({ auditLog: { create } } as never, { getOrThrow: () => 'test-only-salt' } as never);
    await service.log({ action: 'PAYMENT_CONFIRMED', userId: 'user-1', role: 'ADMIN', entityType: 'mock_billing_order', entityId: 'order-1', ip: '127.0.0.1', userAgent: 'private@example.invalid', before: { status: 'PENDING', password: 'secret' }, after: { status: 'CONFIRMED', totalRon: 100, checkoutUrl: 'https://secret' } });
    expect(create).toHaveBeenCalledWith({ data: { action: 'PAYMENT_CONFIRMED', userId: 'user-1', role: 'ADMIN', entityType: 'mock_billing_order', entityId: 'order-1', ipHash: createHmac('sha256', 'test-only-salt').update('127.0.0.1').digest('hex'), userAgent: 'other', before: { status: 'PENDING' }, after: { status: 'CONFIRMED', totalRon: 100 } } });
    expect(JSON.stringify(create.mock.calls)).not.toContain('secret');
    expect(JSON.stringify(create.mock.calls)).not.toContain('127.0.0.1');
  });
});

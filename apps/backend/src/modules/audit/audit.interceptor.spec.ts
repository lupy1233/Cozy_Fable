import { lastValueFrom, of } from 'rxjs';
import { AuditInterceptor } from './audit.interceptor';
import { AuditService } from './audit.service';

describe('AuditInterceptor response contract', () => {
  it('saves only declared metadata while returning the original DTO untouched', async () => {
    const create = jest.fn();
    const service = new AuditService({ auditLog: { create } } as never, { getOrThrow: () => 'test-only-salt' } as never);
    const interceptor = new AuditInterceptor({ get: () => ({ action: 'INSPIRATION_PHOTO_IMAGE_SET', entityType: 'inspiration_photo' }) } as never, service);
    const dto = { id: 'photo-1', published: true, title: 'Private title', imageUrl: 'https://store/image?X-Amz-Signature=secret' };
    const context = { getHandler: () => null, switchToHttp: () => ({ getRequest: () => ({ user: { sub: 'admin-1', role: 'ADMIN' }, params: { id: 'photo-1' }, headers: {} }) }) };
    const result = await lastValueFrom(interceptor.intercept(context as never, { handle: () => of(dto) }));
    expect(result).toBe(dto);
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ entityId: 'photo-1', after: { id: 'photo-1', published: true } }) }));
  });

  it('still waits for audit durability and propagates a failed audit write', async () => {
    const interceptor = new AuditInterceptor({ get: () => ({ action: 'PAYMENT_CONFIRMED' }) } as never, { log: jest.fn().mockRejectedValue(new Error('audit unavailable')) } as never);
    const context = { getHandler: () => null, switchToHttp: () => ({ getRequest: () => ({ params: {}, headers: {} }) }) };
    await expect(lastValueFrom(interceptor.intercept(context as never, { handle: () => of({ id: 'order-1' }) }))).rejects.toThrow('audit unavailable');
  });

  it('passes the resolved client IP (E-admin-platform-5), falling back to req.ip', async () => {
    const log = jest.fn().mockResolvedValue(undefined);
    const interceptor = new AuditInterceptor({ get: () => ({ action: 'PAYMENT_CONFIRMED' }) } as never, { log } as never);
    const run = (request: Record<string, unknown>) => {
      const context = { getHandler: () => null, switchToHttp: () => ({ getRequest: () => ({ params: {}, headers: {}, ...request }) }) };
      return lastValueFrom(interceptor.intercept(context as never, { handle: () => of({ id: 'order-1' }) }));
    };
    await run({ ip: '10.0.0.5', clientIp: '198.51.100.1' });
    await run({ ip: '10.0.0.5', clientIp: '198.51.100.2' });
    await run({ ip: '::ffff:10.0.0.5' });
    expect(log.mock.calls.map(([entry]) => entry.ip)).toEqual(['198.51.100.1', '198.51.100.2', '10.0.0.5']);
  });

  it('hashes different client IPs to different ip_hash values', async () => {
    const create = jest.fn();
    const service = new AuditService({ auditLog: { create } } as never, { getOrThrow: () => 'test-only-salt' } as never);
    await service.log({ action: 'X', ip: '198.51.100.1' });
    await service.log({ action: 'X', ip: '198.51.100.2' });
    const [a, b] = create.mock.calls.map(([arg]) => arg.data.ipHash);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(a).not.toBe(b);
  });
});

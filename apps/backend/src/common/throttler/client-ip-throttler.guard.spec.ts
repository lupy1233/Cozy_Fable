import { Reflector } from '@nestjs/core';
import { ThrottlerStorageService } from '@nestjs/throttler';
import { ClientIpThrottlerGuard, UserThrottlerGuard } from './client-ip-throttler.guard';

// expune getTracker (protected) pentru test
class ProbeIp extends ClientIpThrottlerGuard {
  tracker(req: Record<string, unknown>) {
    return this.getTracker(req);
  }
}
class ProbeUser extends UserThrottlerGuard {
  tracker(req: Record<string, unknown>) {
    return this.getTracker(req);
  }
}

const options = [{ ttl: 60_000, limit: 100 }];

describe('throttler trackers (E-admin-platform-5)', () => {
  const storage = new ThrottlerStorageService();
  afterAll(() => storage.onApplicationShutdown());

  it('ClientIpThrottlerGuard keys on the resolved client IP, not the proxy req.ip', async () => {
    const guard = new ProbeIp(options, storage, new Reflector());
    await expect(guard.tracker({ ip: '10.0.0.5', clientIp: '198.51.100.1' })).resolves.toBe('198.51.100.1');
    await expect(guard.tracker({ ip: '10.0.0.5', clientIp: '198.51.100.2' })).resolves.toBe('198.51.100.2');
    await expect(guard.tracker({ ip: '::ffff:10.0.0.5' })).resolves.toBe('10.0.0.5');
    await expect(guard.tracker({ clientIp: '2a02:2f0e:1:2::9' })).resolves.toBe('v6:2a02:2f0e:0001:0002::/64');
    await expect(guard.tracker({})).resolves.toBe('unknown');
  });

  it('UserThrottlerGuard keys on the user id when authenticated, else on the client IP', async () => {
    const guard = new ProbeUser(options, storage, new Reflector());
    await expect(guard.tracker({ clientIp: '198.51.100.1', user: { sub: 'user-1' } })).resolves.toBe('user:user-1');
    // acelasi user din doua IP-uri diferite = acelasi bucket
    await expect(guard.tracker({ clientIp: '198.51.100.2', user: { sub: 'user-1' } })).resolves.toBe('user:user-1');
    await expect(guard.tracker({ clientIp: '198.51.100.1', user: { sub: 'user-2' } })).resolves.toBe('user:user-2');
    await expect(guard.tracker({ clientIp: '198.51.100.1' })).resolves.toBe('198.51.100.1');
  });
});

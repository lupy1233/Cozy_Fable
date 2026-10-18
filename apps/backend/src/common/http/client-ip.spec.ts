import {
  clientIpMiddleware,
  clientIpOf,
  ipScope,
  normalizeIp,
  resolveClientIp,
  throttleBucket,
} from './client-ip';

function req(opts: { peer?: string; ip?: string; headers?: Record<string, string> }) {
  return {
    ip: opts.ip ?? opts.peer,
    socket: { remoteAddress: opts.peer },
    headers: opts.headers ?? {},
  };
}

describe('resolveClientIp (E-admin-platform-5)', () => {
  it('ignores the header when no trusted header is configured', () => {
    const r = req({ peer: '127.0.0.1', ip: '10.0.0.9', headers: { 'x-real-ip': '203.0.113.7' } });
    expect(resolveClientIp(r)).toEqual({ ip: '10.0.0.9', source: 'socket' });
  });

  it('ignores the header when the peer is not loopback', () => {
    const r = req({ peer: '10.0.0.5', headers: { 'x-real-ip': '203.0.113.7' } });
    expect(resolveClientIp(r, 'x-real-ip')).toEqual({ ip: '10.0.0.5', source: 'socket' });
  });

  it.each(['127.0.0.1', '::ffff:127.0.0.1', '::1'])(
    'uses the header when the peer is loopback (%s)',
    (peer) => {
      const r = req({ peer, headers: { 'x-real-ip': '203.0.113.7' } });
      expect(resolveClientIp(r, 'x-real-ip')).toEqual({ ip: '203.0.113.7', source: 'header' });
    },
  );

  it('falls back to the socket when the header value is not an IP', () => {
    const r = req({ peer: '127.0.0.1', headers: { 'x-real-ip': 'not-an-ip' } });
    expect(resolveClientIp(r, 'x-real-ip')).toEqual({ ip: '127.0.0.1', source: 'socket' });
  });

  it('takes the first token of a comma-separated header', () => {
    const r = req({ peer: '127.0.0.1', headers: { 'x-real-ip': '198.51.100.4, 10.0.0.1' } });
    expect(resolveClientIp(r, 'x-real-ip').ip).toBe('198.51.100.4');
  });

  it('middleware stores the resolved ip and source once per request', () => {
    const r = req({ peer: '127.0.0.1', headers: { 'x-real-ip': '198.51.100.4' } }) as ReturnType<
      typeof req
    > & { clientIp?: string; clientIpSource?: string };
    const next = jest.fn();
    clientIpMiddleware('x-real-ip')(r as never, {} as never, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(r.clientIp).toBe('198.51.100.4');
    expect(r.clientIpSource).toBe('header');
    expect(clientIpOf(r)).toBe('198.51.100.4');
  });

  it('clientIpOf falls back to req.ip without the middleware', () => {
    expect(clientIpOf({ ip: '::ffff:192.0.2.1' })).toBe('192.0.2.1');
    expect(clientIpOf({})).toBeNull();
  });
});

describe('normalizeIp / ipScope / throttleBucket', () => {
  it('strips the IPv4-mapped prefix and rejects garbage', () => {
    expect(normalizeIp('::ffff:1.2.3.4')).toBe('1.2.3.4');
    expect(normalizeIp(' 8.8.8.8 ')).toBe('8.8.8.8');
    expect(normalizeIp('bogus')).toBeNull();
    expect(normalizeIp(undefined)).toBeNull();
  });

  it.each([
    ['10.1.2.3', 'private'],
    ['100.64.0.1', 'private'],
    ['127.0.0.1', 'loopback'],
    ['::1', 'loopback'],
    ['8.8.8.8', 'public'],
    ['2a02:2f0e::1', 'public'],
    ['fd12::1', 'private'],
    [null, 'unknown'],
  ])('scope of %s is %s', (ip, scope) => {
    expect(ipScope(ip)).toBe(scope);
  });

  it('keeps IPv4 as-is and groups IPv6 by /64', () => {
    expect(throttleBucket('203.0.113.9')).toBe('203.0.113.9');
    expect(throttleBucket('2a02:2f0e:1:2:aaaa::1')).toBe(
      throttleBucket('2a02:2f0e:1:2:bbbb:cccc:dddd:eeee'),
    );
    expect(throttleBucket('2a02:2f0e:1:2::1')).toBe('v6:2a02:2f0e:0001:0002::/64');
    expect(throttleBucket('2a02:2f0e::1')).toBe('v6:2a02:2f0e:0000:0000::/64');
    expect(throttleBucket('2a02:2f0e:1:3::1')).not.toBe(throttleBucket('2a02:2f0e:1:2::1'));
    expect(throttleBucket(null)).toBe('unknown');
  });
});

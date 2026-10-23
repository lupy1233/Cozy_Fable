import { healthAwareLogLevel, requestTraceId, routeProps, safeRequestLog, safeResponseLog } from './safe-http';

describe('HTTP logger metadata boundary', () => {
  it('omits raw capability paths, headers, bodies and response Set-Cookie', () => {
    const req = { id: '00000000-0000-4000-8000-000000000001', method: 'POST', url: '/drafts/private-token?email=private@example.invalid', headers: { cookie: 'secret' }, body: { password: 'secret' }, raw: { route: { path: 'drafts/:token' } } };
    expect(safeRequestLog(req)).toEqual({ id: req.id, method: 'POST', route: 'drafts/:token' });
    const res = { statusCode: 200, headers: { 'set-cookie': ['mm_access=secret'] } };
    expect(safeResponseLog(res)).toEqual({ statusCode: 200 });
  });
  it('accepts only UUID trace IDs and never substitutes the raw URL for an unmatched route', () => {
    expect(requestTraceId('00000000-0000-4000-8000-000000000001')).toBe('00000000-0000-4000-8000-000000000001');
    expect(requestTraceId('Bearer private-token')).toMatch(/^[0-9a-f-]{36}$/);
    expect(safeRequestLog({ id: 'secret', method: 'GET' })).toEqual({ id: undefined, method: 'GET', route: 'unmatched' });
  });
});

describe('route pattern and health-aware access log level (E-admin-platform-8)', () => {
  it('exposes only the matched route pattern', () => {
    expect(routeProps({ route: { path: '/api/v1/requests/:id' } })).toEqual({ routePattern: '/api/v1/requests/:id' });
    expect(routeProps({})).toEqual({});
    expect(routeProps({ route: { path: 42 } })).toEqual({});
  });
  it('silences only successful health probes', () => {
    expect(healthAwareLogLevel({ url: '/api/v1/health/live' }, { statusCode: 200 })).toBe('silent');
    expect(healthAwareLogLevel({ url: '/api/v1/health' }, { statusCode: 200 })).toBe('silent');
    expect(healthAwareLogLevel({ url: '/api/v1/health/ready' }, { statusCode: 503 })).toBe('error');
    expect(healthAwareLogLevel({ url: '/api/v1/health/nope' }, { statusCode: 404 })).toBe('warn');
  });
  it('keeps normal requests at info, client errors at warn and failures at error', () => {
    expect(healthAwareLogLevel({ url: '/api/v1/requests' }, { statusCode: 200 })).toBe('info');
    expect(healthAwareLogLevel({ url: '/api/v1/requests' }, { statusCode: 401 })).toBe('warn');
    expect(healthAwareLogLevel({ url: '/api/v1/requests' }, { statusCode: 500 })).toBe('error');
    expect(healthAwareLogLevel({ url: '/api/v1/health' }, { statusCode: 200 }, new Error('x'))).toBe('error');
  });
});

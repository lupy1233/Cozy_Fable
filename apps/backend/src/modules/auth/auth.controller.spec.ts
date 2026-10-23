import { HttpException, HttpStatus, UnauthorizedException } from '@nestjs/common';
import { ERROR_CODES } from '@marketplace/shared';
import { REFRESH_TOKEN_TTL_SEC } from './auth.constants';
import { AuthController } from './auth.controller';

// E-admin-platform-5: contractul GET /auth/me pentru vizitatori anonimi (SEC2-11) si
// transmiterea contextului de login (IP rezolvat + Retry-After la LOGIN_COOLDOWN).

function setup() {
  const auth = {
    me: jest.fn().mockResolvedValue({ id: 'u1', email: 'ana@demo.ro' }),
    login: jest.fn().mockResolvedValue({ user: { id: 'u1', role: 'COMPANY_USER' }, accessToken: 'a', refreshToken: 'r' }),
    refresh: jest.fn().mockResolvedValue({ accessToken: 'a2', refreshToken: 'r2', role: 'CLIENT' }),
    logout: jest.fn().mockResolvedValue(undefined),
    changePassword: jest.fn().mockResolvedValue({ accessToken: 'a3', refreshToken: 'r3' }),
  };
  const config = { get: () => 'test' };
  const controller = new AuthController(auth as never, {} as never, config as never);
  return { controller, auth };
}

function req(opts: { cookies?: Record<string, string>; authorization?: string; user?: unknown } = {}) {
  return {
    cookies: opts.cookies ?? {},
    headers: opts.authorization ? { authorization: opts.authorization } : {},
    user: opts.user,
  } as never;
}

const meRes = () => ({ clearCookie: jest.fn() }) as never;

describe('AuthController.me (SEC2-11)', () => {
  it('returns { user: null } without any session material', async () => {
    const { controller, auth } = setup();
    await expect(controller.me(req(), meRes())).resolves.toEqual({ user: null });
    expect(auth.me).not.toHaveBeenCalled();
  });

  it('returns 401 when only the refresh cookie is present (so the client refreshes)', async () => {
    const { controller } = setup();
    await expect(controller.me(req({ cookies: { mm_refresh: 'r' } }), meRes())).rejects.toMatchObject({
      status: 401,
      response: { code: ERROR_CODES.UNAUTHORIZED },
    });
  });

  it('returns 401 for an invalid access cookie (guard left req.user undefined)', async () => {
    const { controller } = setup();
    await expect(controller.me(req({ cookies: { mm_access: 'expired' } }), meRes())).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('returns 401 for a Bearer header that did not authenticate', async () => {
    const { controller } = setup();
    await expect(controller.me(req({ authorization: 'Bearer bogus' }), meRes())).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('returns the user when the optional guard authenticated the request', async () => {
    const { controller, auth } = setup();
    await expect(
      controller.me(req({ cookies: { mm_access: 'ok' }, user: { sub: 'u1', role: 'CLIENT', email: 'x' } }), meRes()),
    ).resolves.toEqual({ user: { id: 'u1', email: 'ana@demo.ro' } });
    expect(auth.me).toHaveBeenCalledWith('u1');
  });
});

describe('AuthController.login (E-admin-platform-5)', () => {
  const res = () => ({ cookie: jest.fn(), setHeader: jest.fn() });

  it('passes the resolved client IP and user agent to the service', async () => {
    const { controller, auth } = setup();
    const request = { ip: '10.0.0.5', clientIp: '198.51.100.1', headers: { 'user-agent': 'jest' } };
    await controller.login({ email: 'ana@demo.ro', password: 'x' } as never, request as never, res() as never);
    expect(auth.login).toHaveBeenCalledWith(expect.anything(), { ip: '198.51.100.1', userAgent: 'jest' });
  });

  it('sets Retry-After on LOGIN_COOLDOWN and rethrows', async () => {
    const { controller, auth } = setup();
    auth.login.mockRejectedValueOnce(
      new HttpException(
        { code: ERROR_CODES.LOGIN_COOLDOWN, message: 'cooldown', details: { retryAfterSec: 900 } },
        HttpStatus.TOO_MANY_REQUESTS,
      ),
    );
    const response = res();
    await expect(
      controller.login({ email: 'a', password: 'b' } as never, { headers: {} } as never, response as never),
    ).rejects.toMatchObject({ status: 429 });
    expect(response.setHeader).toHaveBeenCalledWith('Retry-After', '900');
    expect(response.cookie).not.toHaveBeenCalled();
  });
});

// Pasul Sprint 75: cookie-ul indiciu mm_session (doar rolul) pentru headerul randat pe server.
describe('AuthController mm_session (indiciu de UI)', () => {
  const res = () => ({ cookie: jest.fn(), clearCookie: jest.fn(), setHeader: jest.fn() });
  const hintCall = (response: { cookie: jest.Mock }) =>
    response.cookie.mock.calls.find((c) => c[0] === 'mm_session');
  const hintOptions = {
    httpOnly: true,
    secure: false,
    sameSite: 'lax',
    path: '/',
    maxAge: REFRESH_TOKEN_TTL_SEC * 1000,
  };

  it('login seteaza mm_session cu rolul utilizatorului', async () => {
    const { controller } = setup();
    const response = res();
    await controller.login({ email: 'a', password: 'b' } as never, { headers: {} } as never, response as never);
    expect(hintCall(response)).toEqual(['mm_session', 'COMPANY_USER', hintOptions]);
  });

  it('refresh reusit seteaza mm_session cu rolul din service', async () => {
    const { controller } = setup();
    const response = res();
    await controller.refresh({ cookies: { mm_refresh: 'raw' } } as never, response as never);
    expect(hintCall(response)).toEqual(['mm_session', 'CLIENT', hintOptions]);
  });

  it('refresh esuat sterge mm_session si rearunca', async () => {
    const { controller, auth } = setup();
    auth.refresh.mockRejectedValueOnce(new UnauthorizedException());
    const response = res();
    await expect(
      controller.refresh({ cookies: { mm_refresh: 'raw' } } as never, response as never),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(response.clearCookie).toHaveBeenCalledWith('mm_session', { path: '/' });
  });

  it('logout sterge mm_session', async () => {
    const { controller } = setup();
    const response = res();
    await controller.logout({ cookies: {} } as never, response as never);
    expect(response.clearCookie).toHaveBeenCalledWith('mm_session', { path: '/' });
  });

  it('changePassword seteaza mm_session cu rolul din payload', async () => {
    const { controller } = setup();
    const response = res();
    await controller.changePassword(
      { sub: 'u1', role: 'ADMIN', email: 'x' } as never,
      { currentPassword: 'a', newPassword: 'b' } as never,
      response as never,
    );
    expect(hintCall(response)).toEqual(['mm_session', 'ADMIN', hintOptions]);
  });

  it('me() cu DOAR mm_session ramane { user: null } si sterge indiciul ramas', async () => {
    const { controller, auth } = setup();
    const response = res();
    await expect(controller.me(req({ cookies: { mm_session: 'ADMIN' } }), response as never)).resolves.toEqual({ user: null });
    expect(auth.me).not.toHaveBeenCalled();
    expect(response.clearCookie).toHaveBeenCalledWith('mm_session', { path: '/' });
  });

  it('me() fara indiciu nu atinge cookie-urile', async () => {
    const { controller } = setup();
    const response = res();
    await controller.me(req(), response as never);
    expect(response.clearCookie).not.toHaveBeenCalled();
  });

  it('me() cu access invalid + indiciu → 401, indiciul ramane (refresh-ul decide)', async () => {
    const { controller } = setup();
    const response = res();
    await expect(
      controller.me(req({ cookies: { mm_access: 'expired', mm_session: 'CLIENT' } }), response as never),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(response.clearCookie).not.toHaveBeenCalled();
  });
});

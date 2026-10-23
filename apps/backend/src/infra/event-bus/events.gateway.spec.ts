import { EventsGateway } from './events.gateway';
import { GATEWAY_OPTIONS } from '@nestjs/websockets/constants';

describe('socket session authorization', () => {
  it('resolves the allowed origin after dotenv loads and fails closed without configuration', () => {
    const previous = process.env.FRONTEND_ORIGIN;
    try {
      const origin = Reflect.getMetadata(GATEWAY_OPTIONS, EventsGateway).cors.origin;
      const callback = jest.fn();
      delete process.env.FRONTEND_ORIGIN;
      origin('https://evil.invalid', callback);
      expect(callback).toHaveBeenLastCalledWith(null, false);
      process.env.FRONTEND_ORIGIN = 'https://app.invalid';
      origin('https://app.invalid', callback);
      expect(callback).toHaveBeenLastCalledWith(null, true);
      origin('https://evil.invalid', callback);
      expect(callback).toHaveBeenLastCalledWith(null, false);
    } finally {
      if (previous === undefined) delete process.env.FRONTEND_ORIGIN;
      else process.env.FRONTEND_ORIGIN = previous;
    }
  });
  const payload = { sub: 'u1', sid: 'family1', role: 'CLIENT', email: 'test@example.invalid', exp: Math.floor(Date.now() / 1000) + 60 };
  function setup(active: boolean) {
    const prisma = { refreshToken: { findFirst: jest.fn().mockResolvedValue(active ? { id: 't1' } : null) } };
    const gateway = new EventsGateway({ verifyAsync: jest.fn().mockResolvedValue(payload) } as never, { getOrThrow: () => 'secret' } as never, prisma as never);
    const socket = { handshake: { headers: { cookie: 'mm_access=test' } }, data: {} as Record<string, unknown>, emit: jest.fn(), disconnect: jest.fn(), join: jest.fn(), once: jest.fn() };
    return { gateway, socket, prisma };
  }

  it('rejects a revoked session even with a valid signed token', async () => {
    const { gateway, socket } = setup(false);
    await gateway.handleConnection(socket as never);
    expect(socket.join).not.toHaveBeenCalled();
    expect(socket.emit).toHaveBeenCalledWith('auth_expired');
    expect(socket.disconnect).toHaveBeenCalledWith(true);
  });

  it('rechecks after joining to close a concurrent revocation and never delivers private events', async () => {
    const { gateway, socket, prisma } = setup(true);
    prisma.refreshToken.findFirst.mockResolvedValueOnce({ id: 't1' }).mockResolvedValue(null);
    await gateway.handleConnection(socket as never);
    expect(socket.disconnect).toHaveBeenCalledWith(true);
    gateway.server = { fetchSockets: jest.fn().mockResolvedValue([socket]) } as never;
    await gateway.publishToActiveSessions('message.created', { private: true }, null);
    expect(socket.emit).not.toHaveBeenCalledWith('message.created', expect.anything());
  });

  it('delivers only to active sessions and expires connected sockets', async () => {
    jest.useFakeTimers();
    try {
      const { gateway, socket } = setup(true);
      await gateway.handleConnection(socket as never);
      gateway.server = { fetchSockets: jest.fn().mockResolvedValue([socket]) } as never;
      await gateway.publishToActiveSessions('message.created', { id: 'm1' }, null);
      expect(socket.emit).toHaveBeenCalledWith('message.created', { id: 'm1' });
      jest.advanceTimersByTime(60_001);
      expect(socket.emit).toHaveBeenCalledWith('auth_expired');
      expect(socket.disconnect).toHaveBeenCalledWith(true);
    } finally { jest.useRealTimers(); }
  });
});

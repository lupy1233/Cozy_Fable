import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { parse as parseCookie } from 'cookie';
import { Server, Socket } from 'socket.io';
import { ACCESS_COOKIE, type AccessTokenPayload } from '../../modules/auth/auth.constants';
import { assertActiveSession } from '../../modules/auth/access-session';
import { PrismaService } from '../prisma/prisma.service';

// Invarianta 3.5: auth socket cookie-based (acelasi cookie httpOnly).
// Token lipsa/expirat la handshake → emit auth_expired → client face refresh + reconectare.
// Controllerele NU emit direct; doar EventBusService foloseste serverul.
// Pasul 6 (audit 2026-08-23): CORS aliniat la FRONTEND_ORIGIN ca pe REST (inainte
// Originea se citeste la handshake, dupa incarcarea .env; lipsa ei nu permite wildcard.
@WebSocketGateway({
  cors: {
    origin: (origin: string | undefined, callback: (error: Error | null, allow: boolean) => void) => {
      const configured = process.env.FRONTEND_ORIGIN;
      callback(null, !!configured && (!origin || origin === configured));
    },
    credentials: true,
  },
})
export class EventsGateway implements OnGatewayConnection {
  private readonly logger = new Logger(EventsGateway.name);

  @WebSocketServer()
  server: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async publishToActiveSessions(event: string, payload: Record<string, unknown>, userIds: string[] | null): Promise<void> {
    if (!this.server) return;
    const sockets = await (userIds ? this.server.in(userIds.map((id) => `user:${id}`)) : this.server).fetchSockets();
    await Promise.all(sockets.map(async (socket) => {
      const access = socket.data.accessPayload as AccessTokenPayload | undefined;
      try {
        if (!access || !access.exp || access.exp * 1000 <= Date.now()) throw new Error('Expired session');
        await assertActiveSession(this.prisma, access);
      } catch {
        socket.emit('auth_expired');
        socket.disconnect(true);
        return;
      }
      socket.emit(event, payload);
    }));
  }

  async handleConnection(socket: Socket): Promise<void> {
    const cookies = parseCookie(socket.handshake.headers.cookie ?? '');
    const token = cookies[ACCESS_COOKIE];
    if (!token) {
      socket.emit('auth_expired');
      socket.disconnect(true);
      return;
    }
    try {
      const payload = await this.jwt.verifyAsync<AccessTokenPayload>(token, {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      });
      await assertActiveSession(this.prisma, payload);
      socket.data.userId = payload.sub;
      socket.data.role = payload.role;
      socket.data.accessPayload = payload;
      // room per user — tinta pentru auth_expired si notificari directe
      await socket.join(`user:${payload.sub}`);
      // Inchide fereastra dintre verificare si join, inclusiv login concurent.
      await assertActiveSession(this.prisma, payload);
      const expiry = setTimeout(() => {
        socket.emit('auth_expired');
        socket.disconnect(true);
      }, Math.max(0, (payload.exp ?? 0) * 1000 - Date.now()));
      expiry.unref();
      socket.once('disconnect', () => clearTimeout(expiry));
    } catch {
      socket.emit('auth_expired');
      socket.disconnect(true);
    }
  }
}

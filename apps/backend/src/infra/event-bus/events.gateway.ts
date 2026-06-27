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

// Invarianta 3.5: auth socket cookie-based (acelasi cookie httpOnly).
// Token lipsa/expirat la handshake → emit auth_expired → client face refresh + reconectare.
// Controllerele NU emit direct; doar EventBusService foloseste serverul.
@WebSocketGateway({ cors: { origin: true, credentials: true } })
export class EventsGateway implements OnGatewayConnection {
  private readonly logger = new Logger(EventsGateway.name);

  @WebSocketServer()
  server: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

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
      socket.data.userId = payload.sub;
      socket.data.role = payload.role;
      // room per user — tinta pentru auth_expired si notificari directe
      await socket.join(`user:${payload.sub}`);
    } catch {
      socket.emit('auth_expired');
      socket.disconnect(true);
    }
  }
}

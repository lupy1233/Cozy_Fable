import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ERROR_CODES } from '@marketplace/shared';
import type { Request } from 'express';
import { ACCESS_COOKIE, type AccessTokenPayload } from '../auth.constants';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

// Guard global: valideaza access token din cookie httpOnly (sau Bearer pentru Postman)
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<Request & { user?: AccessTokenPayload }>();
    const token =
      (req.cookies?.[ACCESS_COOKIE] as string | undefined) ??
      req.headers.authorization?.replace(/^Bearer /, '');

    if (!token) {
      throw new UnauthorizedException({
        code: ERROR_CODES.UNAUTHORIZED,
        message: 'Missing access token',
      });
    }
    try {
      req.user = await this.jwt.verifyAsync<AccessTokenPayload>(token, {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      });
      return true;
    } catch {
      throw new UnauthorizedException({
        code: ERROR_CODES.UNAUTHORIZED,
        message: 'Invalid or expired access token',
      });
    }
  }
}

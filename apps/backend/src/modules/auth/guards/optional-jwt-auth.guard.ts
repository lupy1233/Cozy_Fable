import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { ACCESS_COOKIE, type AccessTokenPayload } from '../auth.constants';

// Auth optionala: daca exista un access token valid, ataseaza req.user;
// altfel lasa cererea sa treaca anonim. Folosit pe fluxul draft anonim cu token,
// ca sa putem lega draftul de un client logat fara a-l obliga sa fie logat.
@Injectable()
export class OptionalJwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request & { user?: AccessTokenPayload }>();
    const token =
      (req.cookies?.[ACCESS_COOKIE] as string | undefined) ??
      req.headers.authorization?.replace(/^Bearer /, '');
    if (token) {
      try {
        req.user = await this.jwt.verifyAsync<AccessTokenPayload>(token, {
          secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        });
      } catch {
        // token invalid/expirat → ramane anonim
      }
    }
    return true;
  }
}

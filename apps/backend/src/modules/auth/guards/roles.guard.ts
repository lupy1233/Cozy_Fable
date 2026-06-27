import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ERROR_CODES } from '@marketplace/shared';
import type { UserRole } from '@prisma/client';
import type { AccessTokenPayload } from '../auth.constants';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<UserRole[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const req = context.switchToHttp().getRequest<{ user?: AccessTokenPayload }>();
    if (req.user && required.includes(req.user.role)) return true;

    throw new ForbiddenException({
      code: ERROR_CODES.FORBIDDEN,
      message: 'Insufficient role',
    });
  }
}

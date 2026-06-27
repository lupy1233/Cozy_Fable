import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { AccessTokenPayload } from '../auth.constants';

// Payload-ul JWT atasat de JwtAuthGuard pe request
export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): AccessTokenPayload => {
    const req = ctx.switchToHttp().getRequest();
    return req.user as AccessTokenPayload;
  },
);

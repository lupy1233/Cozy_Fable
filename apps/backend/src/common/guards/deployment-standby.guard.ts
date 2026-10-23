import { CanActivate, ExecutionContext, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ERROR_CODES } from '@marketplace/shared';
import { isSafeStandbyMethod } from '../../config/deployment-mode';

@Injectable()
export class DeploymentStandbyGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    if (this.config.get<'active' | 'standby'>('DEPLOYMENT_MODE', 'active') !== 'standby') {
      return true;
    }
    if (context.getType() !== 'http') return true;

    const request = context.switchToHttp().getRequest<{ method: string }>();
    if (isSafeStandbyMethod(request.method)) return true;

    throw new ServiceUnavailableException({
      code: ERROR_CODES.DEPLOYMENT_STANDBY,
      message: 'This release slot is in read-only standby mode',
    });
  }
}

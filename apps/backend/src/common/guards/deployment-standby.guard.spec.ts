import { ServiceUnavailableException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { ExecutionContext } from '@nestjs/common';
import { DeploymentStandbyGuard } from './deployment-standby.guard';

function context(method: string, type: string = 'http'): ExecutionContext {
  return {
    getType: () => type,
    switchToHttp: () => ({ getRequest: () => ({ method }) }),
  } as unknown as ExecutionContext;
}

describe('DeploymentStandbyGuard', () => {
  it('does not affect an active slot', () => {
    const config = { get: () => 'active' } as unknown as ConfigService;
    expect(new DeploymentStandbyGuard(config).canActivate(context('POST'))).toBe(true);
  });

  it('keeps health and preview reads available in standby', () => {
    const config = { get: () => 'standby' } as unknown as ConfigService;
    expect(new DeploymentStandbyGuard(config).canActivate(context('GET'))).toBe(true);
  });

  it('rejects production mutations in standby', () => {
    const config = { get: () => 'standby' } as unknown as ConfigService;
    expect(() => new DeploymentStandbyGuard(config).canActivate(context('POST')))
      .toThrow(ServiceUnavailableException);
  });
});

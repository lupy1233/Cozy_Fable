import type { Provider } from '@nestjs/common';

export type DeploymentMode = 'active' | 'standby';

export function deploymentMode(env: NodeJS.ProcessEnv = process.env): DeploymentMode {
  return env.DEPLOYMENT_MODE === 'standby' ? 'standby' : 'active';
}

export function activeOnlyProviders(...providers: Provider[]): Provider[] {
  return deploymentMode() === 'active' ? providers : [];
}

export function isSafeStandbyMethod(method: string): boolean {
  return method === 'GET' || method === 'HEAD' || method === 'OPTIONS';
}

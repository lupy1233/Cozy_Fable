import { activeOnlyProviders, deploymentMode, isSafeStandbyMethod } from './deployment-mode';

describe('deployment mode', () => {
  const original = process.env.DEPLOYMENT_MODE;

  afterEach(() => {
    if (original === undefined) delete process.env.DEPLOYMENT_MODE;
    else process.env.DEPLOYMENT_MODE = original;
  });

  it('defaults to active for existing deployments', () => {
    expect(deploymentMode({})).toBe('active');
  });

  it('removes worker providers from a standby process', () => {
    process.env.DEPLOYMENT_MODE = 'standby';
    class Worker {}
    expect(activeOnlyProviders(Worker)).toEqual([]);
  });

  it('keeps worker providers in an active process', () => {
    process.env.DEPLOYMENT_MODE = 'active';
    class Worker {}
    expect(activeOnlyProviders(Worker)).toEqual([Worker]);
  });

  it.each(['GET', 'HEAD', 'OPTIONS'])('allows %s in standby', (method) => {
    expect(isSafeStandbyMethod(method)).toBe(true);
  });

  it.each(['POST', 'PUT', 'PATCH', 'DELETE'])('blocks %s in standby', (method) => {
    expect(isSafeStandbyMethod(method)).toBe(false);
  });
});

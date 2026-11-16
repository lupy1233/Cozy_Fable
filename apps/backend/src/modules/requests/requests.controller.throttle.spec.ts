import 'reflect-metadata';
import { THROTTLER_LIMIT, THROTTLER_TTL } from '@nestjs/throttler/dist/throttler.constants';
import {
  DRAFT_CREATE_LIMIT_PER_CLIENT_IP,
  DRAFT_CREATE_LIMIT_SHARED_IP,
  draftCreateLimit,
  RequestsController,
} from './requests.controller';

// f6 + revizie M2: crearea ciornelor are limita proprie — 10 pe minut pe IP cand IP-ul clientului e
// sigur (antetul de incredere), altfel un plafon larg (IP comun al proxy-ului = toti vizitatorii)
const ctx = (req: Record<string, unknown>) => ({ switchToHttp: () => ({ getRequest: () => req }) }) as never;

describe('RequestsController throttle (f6)', () => {
  it('POST /requests/drafts: limita se decide pe cerere, fereastra de un minut', () => {
    const handler = RequestsController.prototype.createDraft;
    expect(Reflect.getMetadata(`${THROTTLER_LIMIT}default`, handler)).toBe(draftCreateLimit);
    expect(Reflect.getMetadata(`${THROTTLER_TTL}default`, handler)).toBe(60_000);
  });

  it('IP din antetul de incredere → 10 pe minut', () => {
    expect(DRAFT_CREATE_LIMIT_PER_CLIENT_IP).toBe(10);
    expect(draftCreateLimit(ctx({ clientIpSource: 'header', clientIp: '203.0.113.7' }))).toBe(10);
  });

  it('IP doar din socket (antet nesetat / lipsa) → plafonul larg, nu 10', () => {
    expect(DRAFT_CREATE_LIMIT_SHARED_IP).toBe(120);
    expect(draftCreateLimit(ctx({ clientIpSource: 'socket', clientIp: '100.64.0.2' }))).toBe(120);
    // middleware-ul n-a rulat → sursa implicita socket
    expect(draftCreateLimit(ctx({}))).toBe(120);
  });

  it('ruta noua de republicare cu modificari exista pe controller', () => {
    expect(typeof RequestsController.prototype.repostWithChangesById).toBe('function');
  });
});

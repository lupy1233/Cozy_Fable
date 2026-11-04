import type { Prisma } from '@prisma/client';
import { SETTING_DEFAULTS } from '../../common/settings/setting-defaults';
import type { SettingsService } from '../../common/settings/settings.service';
import type { PrismaService } from '../../infra/prisma/prisma.service';
import { freezeClock, plusMs, restoreClock } from '../../test/clock';
import type { CreditsService } from './credits.service';
import { SubscriptionsService } from './subscriptions.service';

// E-admin-platform-14 — caracterizare startTrialIfEnabled (4.16), rulat in tranzactia de approve:
// trial pe planul din setari (implicit GOLD) cu durata si bonusul din SETTING_DEFAULTS; fara
// trial / plan lipsa → doar portofelul; re-approve → no-op. Valorile vin din setari, nu din test.

const DAY = 24 * 3600 * 1000;
const NOW = '2026-09-01T10:00:00Z';

type SettingsOverrides = Partial<Record<keyof typeof SETTING_DEFAULTS, string | number | boolean>>;

function setup(overrides: SettingsOverrides = {}) {
  const value = <T>(key: string, fallback: T): Promise<T> =>
    Promise.resolve((key in overrides ? overrides[key as keyof SettingsOverrides] : fallback) as T);
  const settings = {
    getBool: jest.fn((key: string, fallback: boolean) => value(key, fallback)),
    getString: jest.fn((key: string, fallback: string) => value(key, fallback)),
    getInt: jest.fn((key: string, fallback: number) => value(key, fallback)),
  };
  const credits = {
    ensureWallet: jest.fn().mockResolvedValue(undefined),
    grant: jest.fn().mockResolvedValue(undefined),
  };
  const tx = {
    subscription: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({ id: 'sub1' }) },
    subscriptionPlan: { findUnique: jest.fn().mockResolvedValue({ id: 'plan-gold', tier: 'GOLD', code: 'GOLD' }) },
  };
  const service = new SubscriptionsService(
    {} as unknown as PrismaService,
    settings as unknown as SettingsService,
    credits as unknown as CreditsService,
  );
  const run = () => service.startTrialIfEnabled('c1', tx as unknown as Prisma.TransactionClient);
  return { service, settings, credits, tx, run };
}

describe('SubscriptionsService.startTrialIfEnabled (E-admin-platform-14)', () => {
  let now: Date;
  beforeEach(() => {
    now = freezeClock(NOW);
  });
  afterEach(() => restoreClock());

  it('trial_enabled=false → doar portofelul, fara abonament', async () => {
    const { run, credits, tx } = setup({ trial_enabled: false });
    await run();
    expect(credits.ensureWallet).toHaveBeenCalledWith('c1', tx);
    expect(tx.subscription.findFirst).not.toHaveBeenCalled();
    expect(tx.subscription.create).not.toHaveBeenCalled();
    expect(credits.grant).not.toHaveBeenCalled();
  });

  it('abonament existent (re-approve) → no-op', async () => {
    const { run, credits, tx } = setup();
    tx.subscription.findFirst.mockResolvedValue({ id: 'old' });
    await run();
    expect(tx.subscription.findFirst).toHaveBeenCalledWith({ where: { companyId: 'c1' } });
    expect(tx.subscription.create).not.toHaveBeenCalled();
    expect(credits.ensureWallet).not.toHaveBeenCalled();
    expect(credits.grant).not.toHaveBeenCalled();
  });

  it('planul de trial lipseste → doar portofelul', async () => {
    const { run, credits, tx } = setup();
    tx.subscriptionPlan.findUnique.mockResolvedValue(null);
    await run();
    expect(tx.subscriptionPlan.findUnique).toHaveBeenCalledWith({ where: { code: SETTING_DEFAULTS.trial_plan } });
    expect(tx.subscription.create).not.toHaveBeenCalled();
    expect(credits.ensureWallet).toHaveBeenCalledWith('c1', tx);
    expect(credits.grant).not.toHaveBeenCalled();
  });

  it('drumul fericit → abonament ACTIVE isTrial cu durata din setari, portofel, apoi bonusul TRIAL_BONUS', async () => {
    const { run, credits, tx } = setup();
    await run();
    const expiresAt = plusMs(now, SETTING_DEFAULTS.trial_duration_days * DAY);
    expect(tx.subscription.create).toHaveBeenCalledWith({
      data: {
        companyId: 'c1',
        planId: 'plan-gold',
        status: 'ACTIVE',
        isTrial: true,
        startedAt: now,
        expiresAt,
        trialEndsAt: expiresAt,
      },
    });
    expect(credits.ensureWallet).toHaveBeenCalledWith('c1', tx);
    expect(credits.grant).toHaveBeenCalledWith('c1', SETTING_DEFAULTS.trial_bonus_credits, 'TRIAL_BONUS', tx);
    // ordinea: abonament → portofel → bonus
    const order = [
      tx.subscription.create.mock.invocationCallOrder[0],
      credits.ensureWallet.mock.invocationCallOrder[0],
      credits.grant.mock.invocationCallOrder[0],
    ];
    expect([...order].sort((x, y) => x - y)).toEqual(order);
  });

  it('bonus 0 → abonament fara grant', async () => {
    const { run, credits, tx } = setup({ trial_bonus_credits: 0 });
    await run();
    expect(tx.subscription.create).toHaveBeenCalledTimes(1);
    expect(credits.ensureWallet).toHaveBeenCalledWith('c1', tx);
    expect(credits.grant).not.toHaveBeenCalled();
  });
});

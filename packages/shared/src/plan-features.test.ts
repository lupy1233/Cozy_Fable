import { describe, expect, it } from 'vitest';
import { PLAN_CODE_RE, PLAN_FEATURE_DEFAULTS, resolvePlanFeatures } from './plan-features';

describe('plan features (E-admin-platform-58)', () => {
  it('no rows → defaults (disabled)', () => {
    expect(resolvePlanFeatures([])).toEqual({ MARKETPLACE_ACCESS: { enabled: false, limit: null } });
  });

  it('reads enabled rows and limits', () => {
    expect(resolvePlanFeatures([{ featureKey: 'MARKETPLACE_ACCESS', enabled: true, limitValue: 5 }])).toEqual({
      MARKETPLACE_ACCESS: { enabled: true, limit: 5 },
    });
  });

  it('ignores unknown keys', () => {
    const out = resolvePlanFeatures([{ featureKey: 'AI_READS', enabled: true, limitValue: 10 }]);
    expect(out).toEqual({ MARKETPLACE_ACCESS: { enabled: false, limit: null } });
    expect(Object.keys(out)).toEqual(['MARKETPLACE_ACCESS']);
  });

  it('does not mutate the defaults', () => {
    const out = resolvePlanFeatures([]);
    out.MARKETPLACE_ACCESS.enabled = true;
    expect(PLAN_FEATURE_DEFAULTS.MARKETPLACE_ACCESS.enabled).toBe(false);
  });

  it.each([['GOLD', true], ['TEST_FREE', true], ['START_0', true], ['gold', false], ['G', false], ['1GOLD', false], ['GOLD-X', false], ['A'.repeat(33), false]])(
    'PLAN_CODE_RE %s → %s',
    (code, ok) => {
      expect(PLAN_CODE_RE.test(code)).toBe(ok);
    },
  );
});

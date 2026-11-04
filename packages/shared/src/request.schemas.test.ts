import { describe, expect, it } from 'vitest';
import { boardItemMetaSchema, INSPIRATION_NOTE_MAX } from './inspiration.schemas';
import {
  BUDGET_RON_PER_POINT,
  budgetRangeFromRon,
  CLAIM_COST_DEFAULTS,
  configuratorContentSchema,
  CREDIT_VALUE_RON,
  creditCostFromBaseScore,
  mergeAccountEmail,
  resolveBudgetFields,
  resolveClaimCostRules,
  type ContactPreferenceInput,
} from './request.schemas';

describe('resolveBudgetFields', () => {
  it('deriva bucket-ul din estimarea RON', () => {
    expect(resolveBudgetFields('UNDER_5K', 33000)).toEqual({ budgetRange: 'OVER_15K', budgetEstimateRon: 33000 });
  });

  it('UNDISCLOSED ramane alegere explicita si scoate estimarea', () => {
    expect(resolveBudgetFields('UNDISCLOSED', 33000)).toEqual({ budgetRange: 'UNDISCLOSED', budgetEstimateRon: null });
  });

  it('fara estimare pastreaza bucket-ul trimis', () => {
    expect(resolveBudgetFields('FROM_5K_TO_15K', undefined)).toEqual({ budgetRange: 'FROM_5K_TO_15K', budgetEstimateRon: null });
    expect(resolveBudgetFields('OVER_15K', null)).toEqual({ budgetRange: 'OVER_15K', budgetEstimateRon: null });
  });

  it('respecta pragurile budgetRangeFromRon', () => {
    expect(resolveBudgetFields('OVER_15K', 4999).budgetRange).toBe('UNDER_5K');
    expect(resolveBudgetFields('UNDER_5K', 5000).budgetRange).toBe('FROM_5K_TO_15K');
    expect(resolveBudgetFields('UNDER_5K', 15000).budgetRange).toBe('FROM_5K_TO_15K');
    expect(resolveBudgetFields('UNDER_5K', 15001).budgetRange).toBe('OVER_15K');
  });
});

// E-admin-platform-14: formula curenta a costului de claim (PO r5: 1 credit = 1.000 lei din
// bugetul minim estimat, minim 1 credit). E-company-21: regulile implicite (fara argument) dau
// exact formula veche; plafonul/minimul vin din system_settings (DECIZIE NECESARA PO: valorile).
describe('creditCostFromBaseScore', () => {
  it.each([
    [0, 1],
    [-5, 1],
    [0.4, 1],
    [1, 1],
    [12, 12],
    [12.5, 13],
    [33, 33],
  ])('baseScore %s → %s credite', (baseScore, credits) => {
    expect(creditCostFromBaseScore(baseScore)).toBe(credits);
  });

  it.each([3, 10, 20, 35])('baseScore %s = max(1, ceil(bugetul minim / valoarea unui credit))', (b) => {
    expect(creditCostFromBaseScore(b)).toBe(Math.max(1, Math.ceil((b * BUDGET_RON_PER_POINT) / CREDIT_VALUE_RON)));
  });
});

describe('creditCostFromBaseScore cu reguli (E-company-21)', () => {
  it('regulile implicite = formula veche', () => {
    for (const b of [0, 1, 12, 33, 380]) {
      expect(creditCostFromBaseScore(b, CLAIM_COST_DEFAULTS)).toBe(creditCostFromBaseScore(b));
    }
  });

  it.each([
    [380, 25],
    [12, 12],
    [0, 1],
  ])('plafon 25: baseScore %s → %s credite', (baseScore, credits) => {
    expect(creditCostFromBaseScore(baseScore, { creditValueRon: 1000, min: 1, max: 25 })).toBe(credits);
  });

  it('minim 3: baseScore 1 → 3 credite', () => {
    expect(creditCostFromBaseScore(1, { creditValueRon: 1000, min: 3, max: 25 })).toBe(3);
  });

  it('1 credit = 2000 lei: baseScore 33 → 17 credite', () => {
    expect(creditCostFromBaseScore(33, { creditValueRon: 2000, min: 1, max: null })).toBe(17);
  });
});

describe('resolveClaimCostRules', () => {
  it('fara chei → implicitele', () => {
    expect(resolveClaimCostRules({})).toEqual(CLAIM_COST_DEFAULTS);
    expect(CLAIM_COST_DEFAULTS).toEqual({ creditValueRon: 1000, min: 1, max: null });
  });

  it('claim_cost_max 0 → fara plafon', () => {
    expect(resolveClaimCostRules({ claim_cost_max: '0' }).max).toBeNull();
  });

  it.each(['abc', '-1', '', '1.5'])('valoare invalida %j → implicit', (v) => {
    expect(resolveClaimCostRules({ credit_value_ron: v, claim_cost_min: v, claim_cost_max: v })).toEqual(
      CLAIM_COST_DEFAULTS,
    );
  });

  it('peste limite → implicit', () => {
    expect(resolveClaimCostRules({ credit_value_ron: '1000001', claim_cost_min: '1001', claim_cost_max: '1001' })).toEqual(
      CLAIM_COST_DEFAULTS,
    );
  });

  it('plafonul nu coboara sub minim', () => {
    expect(resolveClaimCostRules({ claim_cost_min: '5', claim_cost_max: '3' })).toEqual({
      creditValueRon: 1000,
      min: 5,
      max: 5,
    });
  });

  it('credit_value_ron 0 → 1000', () => {
    expect(resolveClaimCostRules({ credit_value_ron: '0' }).creditValueRon).toBe(1000);
  });

  it('valori valide', () => {
    expect(resolveClaimCostRules({ credit_value_ron: '2000', claim_cost_min: '3', claim_cost_max: '25' })).toEqual({
      creditValueRon: 2000,
      min: 3,
      max: 25,
    });
  });
});

describe('budgetRangeFromRon', () => {
  it.each([
    [0, 'UNDER_5K'],
    [4999, 'UNDER_5K'],
    [4999.99, 'UNDER_5K'],
    [5000, 'FROM_5K_TO_15K'],
    [10000, 'FROM_5K_TO_15K'],
    [15000, 'FROM_5K_TO_15K'],
    [15000.01, 'OVER_15K'],
    [15001, 'OVER_15K'],
    [250000, 'OVER_15K'],
  ] as const)('%s lei → %s', (ron, range) => {
    expect(budgetRangeFromRon(ron)).toBe(range);
  });
});

describe('mergeAccountEmail', () => {
  const email = (value: string): ContactPreferenceInput => ({ channel: 'EMAIL', value });
  const phone = (value: string): ContactPreferenceInput => ({ channel: 'PHONE', value });

  it('pune emailul contului primul si scoate emailurile peste plafon', () => {
    const merged = mergeAccountEmail([email('a@x.ro'), email('b@x.ro'), phone('0712345678')], 'c@x.ro');
    expect(merged.contacts).toEqual([email('c@x.ro'), email('a@x.ro'), phone('0712345678')]);
    expect(merged.dropped).toEqual([email('b@x.ro')]);
  });

  it('deduplica emailul contului case-insensitive', () => {
    const merged = mergeAccountEmail([email('C@X.RO '), phone('0712345678')], 'c@x.ro');
    expect(merged.contacts).toEqual([email('c@x.ro'), phone('0712345678')]);
    expect(merged.dropped).toEqual([]);
  });

  it('nu depaseste 4 contacte', () => {
    const merged = mergeAccountEmail(
      [email('a@x.ro'), phone('0712345678'), phone('0722345678'), phone('0732345678'), email('b@x.ro')],
      'c@x.ro',
    );
    expect(merged.contacts).toHaveLength(4);
    expect(merged.contacts[0]).toEqual(email('c@x.ro'));
    expect(merged.dropped).toEqual([phone('0732345678'), email('b@x.ro')]);
  });

  it('fara email de cont lasa lista neschimbata', () => {
    const list = [email('a@x.ro')];
    expect(mergeAccountEmail(list, null)).toEqual({ contacts: list, dropped: [] });
    expect(mergeAccountEmail(undefined, '  ')).toEqual({ contacts: [], dropped: [] });
  });
});

// E-client-34: poze de inspiratie cu notita + camera
describe('inspirationPhotos (configuratorContentSchema)', () => {
  const field = configuratorContentSchema.shape.inspirationPhotos;
  const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

  it('accepta notita de 200 caractere si camera', () => {
    const r = field.safeParse([{ photoId: id(1), note: 'a'.repeat(INSPIRATION_NOTE_MAX), roomLocalId: 'room-1' }]);
    expect(r.success).toBe(true);
  });

  it('respinge notita de 201 caractere cu cheia inspirationNoteTooLong', () => {
    const r = field.safeParse([{ photoId: id(1), note: 'a'.repeat(INSPIRATION_NOTE_MAX + 1) }]);
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].message).toBe('inspirationNoteTooLong');
  });

  it('respinge 11 intrari', () => {
    const list = Array.from({ length: 11 }, (_, i) => ({ photoId: id(i + 1) }));
    expect(field.safeParse(list).success).toBe(false);
  });

  it('respinge photoId duplicat cu cheia inspirationDuplicate', () => {
    const r = field.safeParse([{ photoId: id(1) }, { photoId: id(1), note: 'x' }]);
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].message).toBe('inspirationDuplicate');
  });
});

describe('boardItemMetaSchema', () => {
  it('respinge patch gol', () => {
    expect(boardItemMetaSchema.safeParse({}).success).toBe(false);
  });

  it('accepta note null (sterge) si roomType null', () => {
    expect(boardItemMetaSchema.safeParse({ note: null }).success).toBe(true);
    expect(boardItemMetaSchema.safeParse({ roomType: null }).success).toBe(true);
  });

  it('respinge notita prea lunga', () => {
    expect(boardItemMetaSchema.safeParse({ note: 'a'.repeat(INSPIRATION_NOTE_MAX + 1) }).success).toBe(false);
  });
});

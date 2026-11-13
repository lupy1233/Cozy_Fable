import { describe, expect, it } from 'vitest';
import { budgetPayload, isBudgetChosen } from './budget-choice';

// b11: ce trimite publicarea / editarea despre buget
describe('budget choice (b11)', () => {
  it('chosen = an amount or "I prefer not to share"', () => {
    expect(isBudgetChosen({ budgetRange: 'OVER_15K', budgetEstimateRon: 20000 })).toBe(true);
    expect(isBudgetChosen({ budgetRange: 'UNDISCLOSED' })).toBe(true);
    expect(isBudgetChosen({ budgetRange: 'UNDER_5K' })).toBe(false);
    expect(isBudgetChosen({})).toBe(false);
  });

  it('a chosen amount goes out declared, with the band derived as on the server', () => {
    expect(budgetPayload({ budgetRange: 'UNDER_5K', budgetEstimateRon: 12000 })).toEqual({
      budgetRange: 'FROM_5K_TO_15K',
      budgetEstimateRon: 12000,
      budgetDeclared: true,
    });
  });

  it('"I prefer not to share" or no choice → undisclosed, never a default band', () => {
    expect(budgetPayload({ budgetRange: 'UNDISCLOSED', budgetEstimateRon: 9000 })).toEqual({
      budgetRange: 'UNDISCLOSED',
      budgetEstimateRon: undefined,
      budgetDeclared: false,
    });
    expect(budgetPayload({})).toEqual({ budgetRange: 'UNDISCLOSED', budgetEstimateRon: undefined, budgetDeclared: false });
  });
});

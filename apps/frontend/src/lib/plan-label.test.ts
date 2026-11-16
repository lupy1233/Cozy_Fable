import { describe, expect, it } from 'vitest';
import { planDisplayName, planSentenceName } from './plan-label';

describe('planSentenceName (h2)', () => {
  it('numele din limba curenta, apoi din cealalta limba', () => {
    expect(planSentenceName({ code: 'GOLD', nameRo: 'Aur', nameEn: 'Gold plan' }, 'ro')).toBe('Aur');
    expect(planSentenceName({ code: 'GOLD', nameRo: 'Aur', nameEn: null }, 'en')).toBe('Aur');
  });

  it('fara nume → eticheta codurilor cunoscute', () => {
    expect(planSentenceName({ code: 'GOLD', nameRo: null, nameEn: '' }, 'ro')).toBe('Gold');
    expect(planSentenceName({ code: 'SILVER' }, 'en')).toBe('Silver');
    expect(planSentenceName({ code: 'PLATINUM' }, 'ro')).toBe('Platinum');
  });

  it('cod necunoscut fara nume → sir gol (apelantul foloseste textul fara nume)', () => {
    expect(planSentenceName({ code: 'TEST_FREE' }, 'ro')).toBe('');
    expect(planSentenceName({ code: null }, 'ro')).toBe('');
  });

  it('planDisplayName ramane neschimbat (codul brut ca ultima varianta)', () => {
    expect(planDisplayName({ code: 'GOLD' }, 'ro')).toBe('GOLD');
  });
});

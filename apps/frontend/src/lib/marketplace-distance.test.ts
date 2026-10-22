import { createTranslator } from 'next-intl';
import { describe, expect, it } from 'vitest';
import en from '../messages/en.json';
import ro from '../messages/ro.json';
import { distanceLabel } from './marketplace-distance';

// E-client-9 — distanta aratata firmelor inainte de preluare.
describe('distanceLabel', () => {
  const tRo = createTranslator({ locale: 'ro', messages: ro, namespace: 'Marketplace' });
  const tEn = createTranslator({ locale: 'en', messages: en, namespace: 'Marketplace' });

  it('KM: km intregi cu semnul de aproximare', () => {
    expect(distanceLabel({ distanceKm: 12, distanceBand: 'FROM_5_TO_15' }, tRo as never)).toBe('≈12 km');
    expect(distanceLabel({ distanceKm: 1, distanceBand: 'UNDER_5' }, tEn as never)).toBe('≈1 km');
  });

  it('BAND: doar banda, in ambele limbi', () => {
    expect(distanceLabel({ distanceKm: null, distanceBand: 'UNDER_5' }, tRo as never)).toBe('sub 5 km');
    expect(distanceLabel({ distanceKm: null, distanceBand: 'OVER_30' }, tRo as never)).toBe('peste 30 km');
    expect(distanceLabel({ distanceKm: null, distanceBand: 'FROM_15_TO_30' }, tEn as never)).toBe('15–30 km');
  });
});

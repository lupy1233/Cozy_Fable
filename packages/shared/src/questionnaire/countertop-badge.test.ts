import { describe, expect, it } from 'vitest';
import { getFlow } from './engine';
import type { QuestionStep } from './types';

// c6: blatul de la spalatorie / balcon nu mai primeste badge-ul "Recomandat"
// (material de corp nepotrivit pentru blat); celelalte piese il pastreaza.
function recommendedOn(steps: QuestionStep[], stepId: string, material: string) {
  const step = steps.find((s) => s.id === stepId);
  if (step?.type !== 'single-choice') throw new Error(`missing single-choice step ${stepId}`);
  return step.options.find((o) => o.value === material)?.recommendedIf;
}

describe('c6 — fara "Recomandat" pe blat', () => {
  it('spalatorie v2: blatul fara badge, celelalte piese cu MDF infoliat recomandat', () => {
    // etapa 6: fixat pe v2 (v3 are setul de blaturi, testat in flows/rooms-b.v6.test.ts)
    const { steps, version } = getFlow('LAUNDRY', 2);
    expect(version).toBe(2);
    expect(recommendedOn(steps, 'materialCountertop', 'MDF_INFOLIAT')).toBeUndefined();
    for (const id of ['materialApplianceHousing', 'materialStorage', 'materialSinkUnit']) {
      expect(recommendedOn(steps, id, 'MDF_INFOLIAT')).toEqual({
        questionId: 'ventilation',
        equals: 'NONE',
      });
    }
  });

  it('balcon v2: blatul fara badge, celelalte piese cu lemn masiv recomandat', () => {
    const { steps, version } = getFlow('BALCONY', 2);
    expect(version).toBe(2);
    expect(recommendedOn(steps, 'materialWorktop', 'LEMN_MASIV')).toBeUndefined();
    for (const id of ['materialStorageBench', 'materialTallCabinet', 'materialShelves']) {
      expect(recommendedOn(steps, id, 'LEMN_MASIV')).toEqual({
        questionId: 'enclosed',
        equals: 'OPEN',
      });
    }
  });
});

import { getFlow, type AnswerMap, type QuestionStep } from '@marketplace/shared';
import { describe, expect, it } from 'vitest';
import { getQuestionTargets } from './question-anchor';

// Banda-tinta a bucatariei: zonele aratate urmeaza raspunsurile (verificarea in browser, etapa 10).
describe('getQuestionTargets — zonele bucatariei', () => {
  const flow = getFlow('KITCHEN');
  const step = (id: string) => flow.steps.find((s) => s.id === id) as QuestionStep;
  const keys = (answers: AnswerMap, id = 'frontMaterialBase') =>
    getQuestionTargets('KITCHEN', step(id), answers, flow.version)?.items.map((i) => i.key);

  it('arata corpurile de baza si suspendatele cand suspendatele nu au fost refuzate', () => {
    expect(keys({})).toEqual(['BASE_UNITS', 'WALL_UNITS']);
    expect(keys({ wallCabinets: 'WALL_CABINETS' })).toEqual(['BASE_UNITS', 'WALL_UNITS']);
    expect(keys({ wallCabinets: 'FIRM_DECIDES', hasIsland: true })).toEqual(['BASE_UNITS', 'WALL_UNITS', 'ISLAND_UNITS']);
  });

  it('„Fara corpuri suspendate” scoate zona suspendatelor, si cu materiale diferite pe zone', () => {
    expect(keys({ wallCabinets: 'NO_WALL_CABINETS' })).toEqual(['BASE_UNITS']);
    expect(keys({ wallCabinets: 'NO_WALL_CABINETS', hasIsland: true, separateFrontMaterials: true })).toEqual([
      'BASE_UNITS',
      'ISLAND_UNITS',
    ]);
    expect(keys({ wallCabinets: 'NO_WALL_CABINETS', hasIsland: true }, 'openingSystemsIsland')).toEqual([
      'BASE_UNITS',
      'ISLAND_UNITS',
    ]);
  });
});

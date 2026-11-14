import { BadRequestException } from '@nestjs/common';
import {
  BUDGET_RANGE_FACTOR,
  BUDGET_RON_PER_POINT,
  budgetRangeFromRon,
  ERROR_CODES,
  resolveBudgetFields,
  type BudgetRange,
  type ScoreEntry,
} from '@marketplace/shared';
import { computeSizing } from '../sizing/sizing.service';
import {
  assertApproxLengthAllowed,
  normalizeBudget,
  projectFileCount,
  resolveDesignHelp,
  sizeWithBudgetFloor,
  studioSourceIds,
} from './publish-rules';
import type { CreateRequestContentDto } from './dto/request.dto';

function dto(partial: Partial<CreateRequestContentDto>): CreateRequestContentDto {
  return { budgetRange: 'UNDER_5K', includesPaidDesign: false, hasOwnProject: false, ...partial } as CreateRequestContentDto;
}

describe('publish rules', () => {
  it('derives the budget bucket from the RON estimate', () => {
    const out = normalizeBudget(dto({ budgetRange: 'UNDER_5K', budgetEstimateRon: 33000 }));
    expect(out.budgetRange).toBe('OVER_15K');
    expect(out.budgetEstimateRon).toBe(33000);
  });

  it('keeps UNDISCLOSED and drops the estimate', () => {
    const out = normalizeBudget(dto({ budgetRange: 'UNDISCLOSED', budgetEstimateRon: 33000 }));
    expect(out.budgetRange).toBe('UNDISCLOSED');
    expect(out.budgetEstimateRon).toBeUndefined();
  });

  it('keeps the sent bucket when there is no estimate', () => {
    const out = normalizeBudget(dto({ budgetRange: 'FROM_5K_TO_15K' }));
    expect(out.budgetRange).toBe('FROM_5K_TO_15K');
    expect(out.budgetEstimateRon).toBeUndefined();
  });

  // b11: "declarat de client" doar langa o suma aleasa
  it('keeps budgetDeclared only next to an amount', () => {
    expect(normalizeBudget(dto({ budgetRange: 'OVER_15K', budgetEstimateRon: 12000, budgetDeclared: true })).budgetDeclared).toBe(true);
    expect(normalizeBudget(dto({ budgetRange: 'OVER_15K', budgetEstimateRon: 12000 })).budgetDeclared).toBe(false);
    expect(normalizeBudget(dto({ budgetRange: 'UNDISCLOSED' })).budgetDeclared).toBe(false);
  });

  // m1: budgetDeclared fara suma (sau langa "Prefer sa nu spun") = 400 VALIDATION_ERROR
  it('rejects budgetDeclared without an amount', () => {
    for (const bad of [
      dto({ budgetRange: 'UNDER_5K', budgetDeclared: true }),
      dto({ budgetRange: 'UNDISCLOSED', budgetEstimateRon: 12000, budgetDeclared: true }),
    ]) {
      let err: unknown;
      try {
        normalizeBudget(bad);
      } catch (e) {
        err = e;
      }
      expect(err).toBeInstanceOf(BadRequestException);
      expect((err as BadRequestException).getResponse()).toMatchObject({
        code: ERROR_CODES.VALIDATION_ERROR,
        details: [{ field: 'budgetDeclared', messageKey: 'validation.budgetRequired' }],
      });
    }
  });

  // M3 (obligatoriu, regula aleasa de coordonator): pentru aceeasi cerere, marimea de acum e cea de
  // la commitul f10eac4, unde formularul punea din oficiu minimul estimarii, iar clientul putea
  // doar urca pana la 3× minimul. Costul in credite e acelasi (scorul de baza).
  describe('project size matches f10eac4 for the same request (M3)', () => {
    const config = [
      { key: 'ROOM_TYPE', option: 'KITCHEN', weight: 12 },
      { key: 'BUDGET', option: 'UNDER_5K', weight: 0 },
      { key: 'BUDGET', option: 'FROM_5K_TO_15K', weight: 5 },
      { key: 'BUDGET', option: 'OVER_15K', weight: 10 },
      { key: 'BUDGET', option: 'UNDISCLOSED', weight: 3 },
    ];
    const thresholds = [
      { size: 'SMALL', minScore: 0, maxScore: 15 },
      { size: 'MEDIUM', minScore: 16, maxScore: 21 },
      { size: 'LARGE', minScore: 22, maxScore: null },
    ];
    const scoreEntries = [{ category: 'ROOM_TYPE', optionKey: 'KITCHEN' }] as ScoreEntry[];
    const compute = async (budgetRange: BudgetRange) =>
      computeSizing(config, thresholds, { scoreEntries, budgetRange, includesPaidDesign: false });
    // estimarea pentru camerele de mai sus: scor de baza 12 → 12.000 – 36.000 lei
    const MIN = 12 * BUDGET_RON_PER_POINT;
    const MAX = MIN * BUDGET_RANGE_FACTOR;

    // f10eac4: glisorul pornea pe minim (pus din oficiu) si nu cobora sub el; treapta din suma
    async function sizeAtF10eac4(choice: number | 'UNDISCLOSED') {
      const range = choice === 'UNDISCLOSED'
        ? 'UNDISCLOSED'
        : resolveBudgetFields('UNDER_5K', Math.min(Math.max(choice, MIN), MAX)).budgetRange;
      return compute(range);
    }
    // acum: interfata trimite treapta sumei alese (budgetPayload), serverul aplica pragul estimarii
    async function sizeNow(choice: number | 'UNDISCLOSED') {
      const sent = normalizeBudget(choice === 'UNDISCLOSED'
        ? dto({ budgetRange: 'UNDISCLOSED' })
        : dto({ budgetRange: budgetRangeFromRon(choice), budgetEstimateRon: choice, budgetDeclared: true }));
      const out = await sizeWithBudgetFloor(sent, compute);
      return { ...out.sizing, savedRange: out.budgetRange };
    }

    it.each([
      ['below the estimate', 4000, 'MEDIUM', 'FROM_5K_TO_15K'],
      ['equal to the estimate', MIN, 'MEDIUM', 'FROM_5K_TO_15K'],
      ['above the estimate', 30000, 'LARGE', 'OVER_15K'],
      ['undisclosed', 'UNDISCLOSED', 'SMALL', 'UNDISCLOSED'],
    ] as const)('%s', async (_name, choice, size, savedRange) => {
      const before = await sizeAtF10eac4(choice);
      const now = await sizeNow(choice);
      expect(now.size).toBe(before.size);
      expect(now.size).toBe(size);
      expect(now.score).toBe(before.score);
      expect(now.creditCost).toBe(before.creditCost);
      // treapta salvata pe cerere = cea folosita la marime
      expect(now.savedRange).toBe(savedRange);
    });

    it('without the floor the size would drop (the rule is what keeps it)', async () => {
      expect((await compute(budgetRangeFromRon(4000))).size).toBe('SMALL');
    });

    it('a second sizing pass only when the band changes', async () => {
      const spy = jest.fn(compute);
      await sizeWithBudgetFloor({ budgetRange: 'OVER_15K', budgetEstimateRon: 30000 }, spy);
      expect(spy).toHaveBeenCalledTimes(1);
      spy.mockClear();
      await sizeWithBudgetFloor({ budgetRange: 'UNDER_5K', budgetEstimateRon: 4000 }, spy);
      expect(spy.mock.calls.map((c) => c[0])).toEqual(['UNDER_5K', 'FROM_5K_TO_15K']);
    });
  });

  it('counts only SAFE attachments that no room references', () => {
    const rows = [
      { id: 'a', status: 'SAFE' },
      { id: 'b', status: 'SAFE' },
      { id: 'c', status: 'BLOCKED' },
      { id: 'd', status: 'PENDING_SCAN' },
    ];
    expect(projectFileCount(rows, new Set(['a']))).toBe(1);
    expect(projectFileCount(rows, new Set(['a', 'b']))).toBe(0);
    expect(projectFileCount([], new Set())).toBe(0);
  });
});

// b8 (PO g0-8) + reparatiile din revizuire (M2-M4, hotarari coordonator)
// d3 (PO d3-2): lungimea aproximativa doar cu "Am deja un proiect"
describe('assertApproxLengthAllowed', () => {
  it('cu proiect propriu orice valoare trece; fara camp trece oricum', () => {
    expect(() => assertApproxLengthAllowed([{ approxLengthM: 8 }, {}], true)).not.toThrow();
    expect(() => assertApproxLengthAllowed([{}, { approxLengthM: null }], false)).not.toThrow();
  });

  it('fara proiect propriu → 400 VALIDATION_ERROR cu camera si campul', () => {
    try {
      assertApproxLengthAllowed([{}, { approxLengthM: 6.5 }], false);
      throw new Error('expected error');
    } catch (e) {
      expect(e).toBeInstanceOf(BadRequestException);
      expect((e as BadRequestException).getResponse()).toMatchObject({
        code: ERROR_CODES.VALIDATION_ERROR,
        details: [{ roomIndex: 1, field: 'approxLengthM', messageKey: 'validation.approxLengthWithoutOwnProject' }],
      });
    }
  });
});

describe('resolveDesignHelp', () => {
  type Room = { sourceLocalId?: string; roomType: string; flowVersion: number; answers: Record<string, unknown>; needsDesignHelp?: boolean };
  const room = (id: string, over: Partial<Room> = {}): Room => ({ sourceLocalId: id, roomType: 'KITCHEN', flowVersion: 1, answers: {}, ...over });
  const content = (rooms: Room[], over: Partial<CreateRequestContentDto> = {}) =>
    dto({ rooms: rooms as never, includesPaidDesign: undefined, ...over });
  // camerele "complete" trec validarea stricta; restul nu
  const complete = new Set(['full', 'full2', 'studio']);
  const passesStrict = (r: { sourceLocalId?: string }) => complete.has(r.sourceLocalId ?? '');
  const flags = (out: { rooms: { needsDesignHelp?: boolean }[] }) => out.rooms.map((r) => r.needsDesignHelp);
  const codeOf = (fn: () => unknown) => {
    try { fn(); } catch (e) { return (e as BadRequestException).getResponse() as { code: string; details: { messageKey: string }[] }; }
    throw new Error('expected error');
  };

  it('derivat strict din camere la publicare: bifa trimisa de client e ignorata', () => {
    expect(resolveDesignHelp(content([room('a', { needsDesignHelp: true }), room('b', { needsDesignHelp: false })], { includesPaidDesign: false }), { passesStrict }).includesPaidDesign).toBe(true);
    expect(resolveDesignHelp(content([room('a', { needsDesignHelp: false })], { includesPaidDesign: true }), { passesStrict }).includesPaidDesign).toBe(false);
  });

  it('interfata veche, toate camerele complete + bifa veche: nicio camera bifata, proiectarea ramane', () => {
    const out = resolveDesignHelp(content([room('full'), room('full2')], { includesPaidDesign: true }), { passesStrict });
    expect(flags(out)).toEqual([false, false]);
    expect(out.includesPaidDesign).toBe(true);
  });

  it('interfata veche, toate camerele goale: toate bifate (brief)', () => {
    const out = resolveDesignHelp(content([room('e1'), room('e2')], { includesPaidDesign: true }), { passesStrict });
    expect(flags(out)).toEqual([true, true]);
    expect(out.includesPaidDesign).toBe(true);
  });

  it('interfata veche, amestec: doar camerele care nu trec validarea stricta se bifeaza', () => {
    const out = resolveDesignHelp(content([room('full'), room('half', { answers: { a: 1 } }), room('empty')], { includesPaidDesign: true }), { passesStrict });
    expect(flags(out)).toEqual([false, true, true]);
  });

  it('interfata veche: o piesa din Studio nu se bifeaza niciodata (ramane pe validarea stricta)', () => {
    const out = resolveDesignHelp(content([room('studio-half'), room('e1')], { includesPaidDesign: true }), {
      passesStrict,
      studioSourceIds: new Set(['studio-half']),
    });
    expect(flags(out)).toEqual([false, true]);
  });

  it('interfata veche fara bifa de proiectare: nimic bifat, proiectare false', () => {
    const out = resolveDesignHelp(content([room('e1')], { includesPaidDesign: false }), { passesStrict });
    expect(flags(out)).toEqual([false]);
    expect(out.includesPaidDesign).toBe(false);
  });

  it('piesa din Studio bifata explicit → VALIDATION_ERROR designHelpWithStudioPiece', () => {
    const body = codeOf(() =>
      resolveDesignHelp(content([room('s1', { needsDesignHelp: true })]), { passesStrict, studioSourceIds: studioSourceIds([{ requestEntryIds: { p1: 's1' } }]) }),
    );
    expect(body.code).toBe(ERROR_CODES.VALIDATION_ERROR);
    expect(body.details[0].messageKey).toBe('validation.designHelpWithStudioPiece');
  });

  it('proiect propriu + camera bifata → VALIDATION_ERROR designHelpWithOwnProject', () => {
    const body = codeOf(() => resolveDesignHelp(content([room('a', { needsDesignHelp: true })], { hasOwnProject: true }), { passesStrict }));
    expect(body.details[0].messageKey).toBe('validation.designHelpWithOwnProject');
  });

  it('editare cerere veche cu proiectare: fara camere bifate ramane true; cu o camera bifata, derivare normala', () => {
    const none = resolveDesignHelp(content([room('full', { needsDesignHelp: false })]), { passesStrict, legacyPaidDesign: true });
    expect(none.includesPaidDesign).toBe(true);
    const some = resolveDesignHelp(content([room('a', { needsDesignHelp: true }), room('full', { needsDesignHelp: false })]), { passesStrict, legacyPaidDesign: true });
    expect(some.includesPaidDesign).toBe(true);
    expect(flags(some)).toEqual([true, false]);
    // fara reprezentarea veche: derivare stricta
    expect(resolveDesignHelp(content([room('full', { needsDesignHelp: false })]), { passesStrict }).includesPaidDesign).toBe(false);
  });
});

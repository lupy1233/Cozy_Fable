import { BadRequestException } from '@nestjs/common';
import { ERROR_CODES } from '@marketplace/shared';
import { normalizeBudget, projectFileCount, resolveDesignHelp, studioSourceIds } from './publish-rules';
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

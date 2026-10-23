import { normalizeBudget, projectFileCount } from './publish-rules';
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

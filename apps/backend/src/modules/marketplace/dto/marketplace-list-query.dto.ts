import { MAX_BUDGET_RON } from '@marketplace/shared';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

// b11-3 (PO 2026-11-13): GET /marketplace/requests?minBudgetRon= — glisorul de buget minim al
// firmei. Raman doar cererile cu suma declarata/orientativa >= minim; 0 / lipsa = fara filtru.
export class MarketplaceListQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(MAX_BUDGET_RON)
  minBudgetRon?: number;
}

import type { BudgetRange, ProjectSize, ScoreEntry } from '@marketplace/shared';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';

export interface SizingResult {
  score: number;
  size: ProjectSize;
  creditCost: number;
}

export interface SizingInput {
  // intrari de scoring per camera, colectate din answers de engine-ul configuratorului
  // (ROOM_TYPE + ROOM_SIZE + ITEM_QUANTITY per camera; MATERIAL + max SYSTEM per item;
  // plus referintele optiunilor: KITCHEN_LAYOUT, KITCHEN_ISLAND etc.)
  scoreEntries: ScoreEntry[];
  budgetRange: BudgetRange;
  includesPaidDesign: boolean;
}

// Scoring proiect (docs/sprint-0 §7). Greutatile vin din project_sizing_config,
// pragurile din project_size_thresholds (ambele seed-uite si editabile din admin).
// Scorul = Σ intrari camere (rezolvate din DB) + PAID_DESIGN + BUDGET.
// Interfata score→size→creditCost e neschimbata: marketplace/claims/billing neatinse.
@Injectable()
export class SizingService {
  constructor(private readonly prisma: PrismaService) {}

  async compute(input: SizingInput): Promise<SizingResult> {
    const [configRows, thresholds] = await Promise.all([
      this.prisma.projectSizingConfig.findMany(),
      this.prisma.projectSizeThreshold.findMany({ orderBy: { minScore: 'asc' } }),
    ]);

    // index: weights[key:option] = weight
    const weights = new Map<string, number>();
    for (const r of configRows) weights.set(`${r.key}:${r.option}`, r.weight);
    const w = (key: string, option: string): number => weights.get(`${key}:${option}`) ?? 0;

    let score = 0;
    for (const entry of input.scoreEntries) {
      if ('optionKeys' in entry) {
        // pick:'max' — ex. SYSTEM per item = max dintre sistemele selectate
        score += entry.optionKeys.reduce((max, opt) => Math.max(max, w(entry.category, opt)), 0);
      } else {
        score += w(entry.category, entry.optionKey);
      }
    }

    if (input.includesPaidDesign) score += w('PAID_DESIGN', 'YES');
    score += w('BUDGET', input.budgetRange);

    // mapare prag: prima regula al carei interval contine scorul
    const match =
      thresholds.find(
        (t) => score >= t.minScore && (t.maxScore === null || score <= t.maxScore),
      ) ?? thresholds[thresholds.length - 1];

    return {
      score,
      size: match.size as ProjectSize,
      creditCost: match.creditCost,
    };
  }
}

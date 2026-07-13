import {
  creditCostFromBaseScore,
  type BudgetRange,
  type ProjectSize,
  type ScoreEntry,
} from '@marketplace/shared';
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
// Costul in credite (PO r5, 2026-07-13) NU mai vine din praguri: 1 credit =
// 1000 RON din bugetul minim estimat, adica scorul de BAZA al camerelor (fara
// PAID_DESIGN si fara BUDGET — identic cu scorul din POST /requests/estimate,
// deci costul = minRon/1000 afisat clientului). Pragurile raman doar pentru
// clasificarea S/M/L (SLA, filtre marketplace).
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

    // scorul de baza = doar camerele; determina bugetul minim estimat si costul
    let baseScore = 0;
    for (const entry of input.scoreEntries) {
      if ('optionKeys' in entry) {
        // pick:'max' — ex. SYSTEM per item = max dintre sistemele selectate
        baseScore += entry.optionKeys.reduce((max, opt) => Math.max(max, w(entry.category, opt)), 0);
      } else {
        baseScore += w(entry.category, entry.optionKey);
      }
    }

    let score = baseScore;
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
      creditCost: creditCostFromBaseScore(baseScore),
    };
  }
}

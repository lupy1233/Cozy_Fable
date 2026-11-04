import {
  CLAIM_COST_DEFAULTS,
  CLAIM_COST_SETTING_KEYS,
  creditCostFromBaseScore,
  resolveClaimCostRules,
  type BudgetRange,
  type ClaimCostRules,
  type ProjectSize,
  type ScoreEntry,
} from '@marketplace/shared';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';

export interface SizingResult {
  score: number;
  size: ProjectSize;
  creditCost: number;
  // scorul de BAZA (doar camerele) — sursa bugetului minim estimat si a costului (PO r5 V1)
  baseScore: number;
}

export interface SizingInput {
  // intrari de scoring per camera, colectate din answers de engine-ul configuratorului
  // (ROOM_TYPE + ROOM_SIZE + ITEM_QUANTITY per camera; MATERIAL + max SYSTEM per item;
  // plus referintele optiunilor: KITCHEN_LAYOUT, KITCHEN_ISLAND etc.)
  scoreEntries: ScoreEntry[];
  budgetRange: BudgetRange;
  includesPaidDesign: boolean;
}

export interface SizingConfigRow {
  key: string;
  option: string;
  weight: number;
}

export interface SizingThresholdRow {
  size: string;
  minScore: number;
  maxScore: number | null;
}

// Functie pura de scoring (fara DB) — folosita de compute() si de previzualizarea din
// Admin -> Marime proiect. Pragurile trebuie sortate crescator dupa minScore.
// rules (E-company-21) = valoarea creditului + intervalul costului din system_settings.
export function computeSizing(
  configRows: SizingConfigRow[],
  thresholds: SizingThresholdRow[],
  input: SizingInput,
  rules: ClaimCostRules = CLAIM_COST_DEFAULTS,
): SizingResult {
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
    thresholds.find((t) => score >= t.minScore && (t.maxScore === null || score <= t.maxScore)) ??
    thresholds[thresholds.length - 1];

  return {
    score,
    size: match.size as ProjectSize,
    creditCost: creditCostFromBaseScore(baseScore, rules),
    baseScore,
  };
}

// Scoring proiect (docs/sprint-0 §7). Greutatile vin din project_sizing_config
// (editabile din Admin -> Marime proiect, /admin/sizing, cu previzualizare), pragurile din
// project_size_thresholds (Admin -> Setari). Fara cache: fiecare compute citeste DB-ul,
// deci o modificare din admin are efect imediat pe ambele sloturi.
// Scorul = Σ intrari camere (rezolvate din DB) + PAID_DESIGN + BUDGET.
// Costul in credite (PO r5, 2026-07-13) NU mai vine din praguri: 1 credit =
// 1000 RON din bugetul minim estimat, adica scorul de BAZA al camerelor (fara
// PAID_DESIGN si fara BUDGET — identic cu scorul din POST /requests/estimate,
// deci costul = minRon/1000 afisat clientului). Pragurile raman doar pentru
// clasificarea S/M/L (SLA, filtre marketplace).
// E-admin-platform-14: compute() intoarce si baseScore → estimate() calculeaza minRon din el,
// nu din scorul total (altfel s-ar desparti de cost cand adminul schimba BUDGET:UNDISCLOSED).
// E-company-21: cost = ceil(minRon / credit_value_ron), limitat la [claim_cost_min,
// claim_cost_max | infinit] (system_settings, citite in acelasi Promise.all, in afara
// oricarei tranzactii). Schimbarea setarilor re-evalueaza doar cererile publicate sau
// editate dupa; credit_cost existent si claim_cost_credits_snapshot nu se recalculeaza.
@Injectable()
export class SizingService {
  constructor(private readonly prisma: PrismaService) {}

  async compute(input: SizingInput): Promise<SizingResult> {
    const [configRows, thresholds, costRows] = await Promise.all([
      this.prisma.projectSizingConfig.findMany(),
      this.prisma.projectSizeThreshold.findMany({ orderBy: { minScore: 'asc' } }),
      this.prisma.systemSetting.findMany({
        where: { key: { in: Object.values(CLAIM_COST_SETTING_KEYS) } },
        select: { key: true, value: true },
      }),
    ]);
    const rules = resolveClaimCostRules(Object.fromEntries(costRows.map((r) => [r.key, r.value])));
    const { score, size, creditCost, baseScore } = computeSizing(configRows, thresholds, input, rules);
    return { score, size, creditCost, baseScore };
  }
}

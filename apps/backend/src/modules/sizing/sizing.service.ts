import type { ProjectSize, RequestContentInput } from '@marketplace/shared';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';

export interface SizingResult {
  score: number;
  size: ProjectSize;
  creditCost: number;
}

// Scoring proiect (docs/sprint-0 §7). Greutatile vin din project_sizing_config,
// pragurile din project_size_thresholds (ambele seed-uite).
// Agregare (interpretare deterministica a §7):
//   scor = Σ camere [ ROOM_TYPE + ROOM_SIZE(length_m) + ITEM_QUANTITY(Σ cantitati)
//                      + Σ iteme ( MATERIAL + max SYSTEM selectat ) ]
//          + PAID_DESIGN (daca da) + BUDGET
@Injectable()
export class SizingService {
  constructor(private readonly prisma: PrismaService) {}

  private roomSizeOption(lengthM: number): string {
    if (lengthM < 2) return 'UNDER_2M';
    if (lengthM <= 4) return 'FROM_2_TO_4M';
    return 'OVER_4M';
  }

  private itemQuantityOption(totalQty: number): string {
    if (totalQty <= 1) return 'QTY_1';
    if (totalQty <= 3) return 'QTY_2_3';
    return 'QTY_4_PLUS';
  }

  async compute(content: Pick<RequestContentInput, 'rooms' | 'budgetRange' | 'includesPaidDesign'>): Promise<SizingResult> {
    const [configRows, thresholds] = await Promise.all([
      this.prisma.projectSizingConfig.findMany(),
      this.prisma.projectSizeThreshold.findMany({ orderBy: { minScore: 'asc' } }),
    ]);

    // index: weights[key][option] = weight
    const weights = new Map<string, number>();
    for (const r of configRows) weights.set(`${r.key}:${r.option}`, r.weight);
    const w = (key: string, option: string): number => weights.get(`${key}:${option}`) ?? 0;

    let score = 0;
    for (const room of content.rooms) {
      score += w('ROOM_TYPE', room.roomType);
      score += w('ROOM_SIZE', this.roomSizeOption(room.lengthM));

      const totalQty = room.items.reduce((acc, it) => acc + it.quantity, 0);
      score += w('ITEM_QUANTITY', this.itemQuantityOption(totalQty));

      for (const item of room.items) {
        score += w('MATERIAL', item.material);
        const maxSystem = item.systems.reduce((max, s) => Math.max(max, w('SYSTEM', s)), 0);
        score += maxSystem;
      }
    }

    if (content.includesPaidDesign) score += w('PAID_DESIGN', 'YES');
    score += w('BUDGET', content.budgetRange);

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

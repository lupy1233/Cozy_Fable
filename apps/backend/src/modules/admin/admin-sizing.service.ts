import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  CLAIM_COST_SETTING_KEYS,
  collectScoreEntries,
  ERROR_CODES,
  resolveClaimCostRules,
  type AnswerMap,
  type BudgetRange,
  type ScoreEntry,
  type SizingPreviewDto,
  type SizingPreviewExampleDto,
  type SizingSizeCounts,
  type SizingWeightDto,
  type SizingWeightsUpdateResultDto,
} from '@marketplace/shared';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { computeSizing, type SizingConfigRow } from '../sizing/sizing.service';

// E-admin-platform-25: editorul de puncte (project_sizing_config) — D1 "ajustare fara deploy",
// docs/03 4.5. Doar randurile existente; formula si pragurile nu se schimba. Previzualizarea
// re-scoreaza ultimele cereri publicate cu ponderile curente si cu cele propuse (fara scriere).
// SizingService nu are cache: salvarea are efect imediat pe ambele sloturi; preluarile
// existente isi pastreaza costul (snapshot pe claim_slots).
const PREVIEW_SAMPLE = 200;
const PREVIEW_EXAMPLES = 20;

type WeightChange = { id: string; weight: number };
type Size = 'SMALL' | 'MEDIUM' | 'LARGE';

function emptyCounts(): SizingSizeCounts {
  return { SMALL: 0, MEDIUM: 0, LARGE: 0 };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

@Injectable()
export class AdminSizingService {
  constructor(private readonly prisma: PrismaService) {}

  getWeights(): Promise<SizingWeightDto[]> {
    return this.prisma.projectSizingConfig.findMany({
      orderBy: [{ key: 'asc' }, { option: 'asc' }],
      select: { id: true, key: true, option: true, weight: true },
    });
  }

  // fara id-uri duplicate (400) si toate id-urile trebuie sa existe (404)
  // intoarce ponderile curente (id -> weight) ca salvarea sa poata audita valoarea anterioara
  private async assertKnown(changes: WeightChange[]): Promise<Map<string, number>> {
    const ids = changes.map((c) => c.id);
    if (new Set(ids).size !== ids.length) {
      throw new BadRequestException({ code: ERROR_CODES.VALIDATION_ERROR, message: 'Duplicate ids', details: [{ field: 'changes' }] });
    }
    const found = await this.prisma.projectSizingConfig.findMany({ where: { id: { in: ids } }, select: { id: true, weight: true } });
    const known = new Set(found.map((r) => r.id));
    const unknown = ids.filter((id) => !known.has(id));
    if (unknown.length) {
      throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'Sizing weight not found', details: unknown.map((id) => ({ id })) });
    }
    return new Map(found.map((r) => [r.id, r.weight]));
  }

  async preview(changes: WeightChange[]): Promise<SizingPreviewDto> {
    await this.assertKnown(changes);
    // 4 citiri in paralel, fara tranzactie (latenta cross-region)
    const [configRows, thresholds, requests, costRows] = await Promise.all([
      this.prisma.projectSizingConfig.findMany({ select: { id: true, key: true, option: true, weight: true } }),
      this.prisma.projectSizeThreshold.findMany({ orderBy: { minScore: 'asc' } }),
      this.prisma.request.findMany({
        where: { publishedAt: { not: null } },
        orderBy: { publishedAt: 'desc' },
        take: PREVIEW_SAMPLE,
        select: {
          id: true,
          budgetRange: true,
          includesPaidDesign: true,
          rooms: { select: { roomType: true, flowVersion: true, answers: true } },
        },
      }),
      // E-company-21: previzualizarea arata costul real, cu valoarea creditului si plafonul in vigoare
      this.prisma.systemSetting.findMany({
        where: { key: { in: Object.values(CLAIM_COST_SETTING_KEYS) } },
        select: { key: true, value: true },
      }),
    ]);

    const rules = resolveClaimCostRules(Object.fromEntries(costRows.map((r) => [r.key, r.value])));
    const overlay = new Map(changes.map((c) => [c.id, c.weight]));
    const proposedRows: SizingConfigRow[] = configRows.map((r) => ({ ...r, weight: overlay.get(r.id) ?? r.weight }));

    const result: SizingPreviewDto = {
      sampleSize: 0,
      skipped: 0,
      current: emptyCounts(),
      proposed: emptyCounts(),
      changedSize: 0,
      changedCreditCost: 0,
      avgCreditCostCurrent: 0,
      avgCreditCostProposed: 0,
      examples: [],
    };
    let sumCurrent = 0;
    let sumProposed = 0;

    for (const req of requests) {
      // cererile vechi fara raspunsuri / cu versiuni de flow neinregistrate nu pot fi re-scorate
      if (!req.rooms.length || req.rooms.some((r) => r.answers === null)) {
        result.skipped++;
        continue;
      }
      let entries: ScoreEntry[];
      try {
        entries = req.rooms.flatMap((r) => collectScoreEntries(r.roomType, r.answers as AnswerMap, r.flowVersion ?? undefined));
      } catch {
        result.skipped++;
        continue;
      }
      const input = {
        scoreEntries: entries,
        budgetRange: (req.budgetRange ?? 'UNDISCLOSED') as BudgetRange,
        includesPaidDesign: req.includesPaidDesign,
      };
      const cur = computeSizing(configRows, thresholds, input, rules);
      const next = computeSizing(proposedRows, thresholds, input, rules);
      result.sampleSize++;
      result.current[cur.size as Size]++;
      result.proposed[next.size as Size]++;
      sumCurrent += cur.creditCost;
      sumProposed += next.creditCost;
      const sizeChanged = cur.size !== next.size;
      const costChanged = cur.creditCost !== next.creditCost;
      if (sizeChanged) result.changedSize++;
      if (costChanged) result.changedCreditCost++;
      if ((sizeChanged || costChanged) && result.examples.length < PREVIEW_EXAMPLES) {
        const example: SizingPreviewExampleDto = {
          requestId: req.id,
          currentSize: cur.size as Size,
          proposedSize: next.size as Size,
          currentCreditCost: cur.creditCost,
          proposedCreditCost: next.creditCost,
        };
        result.examples.push(example);
      }
    }
    if (result.sampleSize) {
      result.avgCreditCostCurrent = round2(sumCurrent / result.sampleSize);
      result.avgCreditCostProposed = round2(sumProposed / result.sampleSize);
    }
    return result;
  }

  async updateWeights(changes: WeightChange[]): Promise<SizingWeightsUpdateResultDto> {
    const previous = await this.assertKnown(changes);
    // O singura instructiune (nu cate un UPDATE per rand: ~150 ms/query cross-region)
    const count = await this.prisma.$executeRaw(
      Prisma.sql`UPDATE "project_sizing_config" AS c SET "weight" = v.weight FROM (VALUES ${Prisma.join(
        changes.map((ch) => Prisma.sql`(${ch.id}, ${ch.weight}::int)`),
      )}) AS v(id, weight) WHERE c."id" = v.id`,
    );
    // previousWeight intra in audit (SIZING_WEIGHTS_UPDATED) ca o modificare sa poata fi inversata
    return { count, items: changes.map(({ id, weight }) => ({ id, weight, previousWeight: previous.get(id) ?? null })) };
  }
}

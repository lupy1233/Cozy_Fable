import {
  BUDGET_RON_PER_POINT,
  ERROR_CODES,
  resolveBudgetFields,
  sizingBudgetRange,
  type BudgetRange,
} from '@marketplace/shared';
import { BadRequestException } from '@nestjs/common';
import type { CreateRequestContentDto } from './dto/request.dto';

// Reguli pure de publish/edit (E-client-2), testabile fara Prisma.

// Bucket-ul de buget e derivat din estimarea RON (docs/04): serverul ignora
// bucket-ul trimis cand exista estimare. Acelasi obiect alimenteaza scalarData,
// sizing.compute si snapshotul de versiune, deci toate raman consecvente.
// b11: budgetDeclared ramane true doar langa o suma (nu la "Prefer sa nu spun", nu fara suma);
// nu atinge treapta, deci punctajul si costul in credite raman aceleasi.
export function normalizeBudget<T extends Pick<CreateRequestContentDto, 'budgetRange' | 'budgetEstimateRon' | 'budgetDeclared'>>(
  dto: T,
): T & { budgetDeclared: boolean } {
  const resolved = resolveBudgetFields(dto.budgetRange, dto.budgetEstimateRon);
  // m1: "declarat de client" fara suma (sau langa "Prefer sa nu spun") e un payload gresit, nu o
  // alegere — interfata trimite budgetDeclared doar langa suma aleasa
  if (dto.budgetDeclared === true && resolved.budgetEstimateRon === null) {
    throw new BadRequestException({
      code: ERROR_CODES.VALIDATION_ERROR,
      message: 'budgetDeclared requires a chosen budget amount',
      details: [{ field: 'budgetDeclared', messageKey: 'validation.budgetRequired' }],
    });
  }
  return {
    ...dto,
    budgetRange: resolved.budgetRange,
    budgetEstimateRon: resolved.budgetEstimateRon ?? undefined,
    budgetDeclared: dto.budgetDeclared === true && resolved.budgetEstimateRon !== null,
  };
}

// b11 / M3: treapta salvata pe cerere si folosita la marime = treapta lui max(suma, minimul
// estimarii din raspunsuri) (sizingBudgetRange). Minimul vine din scorul de baza al aceluiasi
// calcul (independent de treapta); a doua trecere prin sizing doar cand treapta se schimba.
// Costul in credite e acelasi in ambele treceri (scorul de baza).
export async function sizeWithBudgetFloor<S extends { baseScore: number }>(
  dto: { budgetRange: BudgetRange; budgetEstimateRon?: number | null },
  compute: (budgetRange: BudgetRange) => Promise<S>,
): Promise<{ sizing: S; budgetRange: BudgetRange }> {
  const first = await compute(dto.budgetRange);
  const budgetRange = sizingBudgetRange(dto.budgetRange, dto.budgetEstimateRon, first.baseScore * BUDGET_RON_PER_POINT);
  if (budgetRange === dto.budgetRange) return { sizing: first, budgetRange };
  return { sizing: await compute(budgetRange), budgetRange };
}

type DesignHelpRoom = CreateRequestContentDto['rooms'][number];

export interface ResolveDesignHelpContext {
  // camera trece validarea STRICTA (fara ajutor)? — doar pentru compatibilitatea cu interfata veche
  passesStrict: (room: DesignHelpRoom) => boolean;
  // sourceLocalId-urile camerelor legate de o piesa asezata in Studio (requestEntryIds)
  studioSourceIds?: ReadonlySet<string>;
  // doar la EDITARE: cererea din baza avea includesPaidDesign=true fara nicio camera bifata
  // (reprezentarea dinainte de needs_design_help)
  legacyPaidDesign?: boolean;
}

// b8 (PO g0-8, 2026-11-13): ajutorul de proiectare se cere pe camera. Fiecare camera iese cu
// needsDesignHelp boolean, iar includesPaidDesign devine DERIVAT (macar o camera cu ajutor);
// valoarea trimisa de client e ignorata, cu doua exceptii fara pierderi (hotarare coordonator,
// de confirmat de PO):
// - interfata veche (niciun camp needsDesignHelp pe camere) + includesPaidDesign=true, fara proiect
//   propriu: se bifeaza DOAR camerele care nu trec validarea stricta (brief, fara raspunsuri);
//   camerele complete raman nebifate cu raspunsurile lor; includesPaidDesign ramane true.
//   O piesa din Studio nu se bifeaza niciodata (ramane pe validarea stricta).
// - editarea unei cereri vechi cu proiectare si fara camere bifate, care nu bifeaza nimic:
//   includesPaidDesign ramane true.
// Nu exista drum pe care o camera nebifata scapa de validarea stricta.
// Erori: proiect propriu + camera bifata; piesa din Studio bifata (400 VALIDATION_ERROR).
export function resolveDesignHelp<T extends Pick<CreateRequestContentDto, 'rooms' | 'hasOwnProject' | 'includesPaidDesign'>>(
  dto: T,
  ctx: ResolveDesignHelpContext,
): T & { includesPaidDesign: boolean } {
  const studio = ctx.studioSourceIds ?? new Set<string>();
  const fromStudio = (room: DesignHelpRoom) => room.sourceLocalId !== undefined && studio.has(room.sourceLocalId);
  const legacyClient = dto.rooms.every((room) => room.needsDesignHelp === undefined);
  const legacyCompat = legacyClient && dto.includesPaidDesign === true && dto.hasOwnProject !== true;

  const rooms = dto.rooms.map((room) => ({
    ...room,
    needsDesignHelp: legacyCompat ? !fromStudio(room) && !ctx.passesStrict(room) : room.needsDesignHelp === true,
  }));

  const helpIndexes = rooms.flatMap((room, roomIndex) => (room.needsDesignHelp ? [roomIndex] : []));
  if (dto.hasOwnProject === true && helpIndexes.length > 0) {
    throw new BadRequestException({
      code: ERROR_CODES.VALIDATION_ERROR,
      message: 'A request with its own project cannot ask for design help on rooms',
      details: helpIndexes.map((roomIndex) => ({ roomIndex, field: 'needsDesignHelp', messageKey: 'validation.designHelpWithOwnProject' })),
    });
  }
  const studioHelp = helpIndexes.filter((i) => fromStudio(rooms[i]));
  if (studioHelp.length > 0) {
    throw new BadRequestException({
      code: ERROR_CODES.VALIDATION_ERROR,
      message: 'A furniture piece placed in Studio cannot ask for design help',
      details: studioHelp.map((roomIndex) => ({ roomIndex, field: 'needsDesignHelp', messageKey: 'validation.designHelpWithStudioPiece' })),
    });
  }

  const anyHelp = helpIndexes.length > 0;
  const includesPaidDesign = anyHelp || legacyCompat || ctx.legacyPaidDesign === true;
  return { ...dto, rooms, includesPaidDesign };
}

// sourceLocalId-urile camerelor legate de piese asezate in Studio (scenele publicate / de publicat).
export function studioSourceIds(scenes: { requestEntryIds?: Record<string, string> }[]): Set<string> {
  return new Set(scenes.flatMap((s) => Object.values(s.requestEntryIds ?? {})));
}

// Fisierele de proiect = atasamente SAFE ale cererii pe care nu le refera nicio
// camera (nici schita, nici snapshot3d) — aceeasi regula ca in sumarul din FE.
export function projectFileCount(
  attachments: { id: string; status: string }[],
  referencedIds: Set<string>,
): number {
  return attachments.filter((a) => a.status === 'SAFE' && !referencedIds.has(a.id)).length;
}

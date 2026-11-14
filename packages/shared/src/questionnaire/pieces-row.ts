import { z } from 'zod';
import type { ItemSystem, Material } from '../enums';
import { requestItemSchema, type RequestItemInput } from '../request.schemas';
import {
  FIRM_DECIDES,
  FIRM_MATERIAL_NOTE,
  FIRM_OPENING_NOTE,
  finishDescription,
  NO_FRONTS,
  NO_FRONTS_NOTE,
} from './flows/finish-sets';
import type { FirmRecommendation } from './types';

// Etapa 6 (c10, partea a doua): randul "Alta piesa" v2 (PiecesStep.rowVersion = 2).
// Campurile noi stau DOAR in raspunsuri; derivarea le muta in descrierea piesei
// (request_items nu are coloane noi). N13 + N14.

export const PIECE_ROW_DIM_MIN_CM = 1;
export const PIECE_ROW_DIM_MAX_CM = 600;
// lasa loc notelor adaugate la derivare (limita totala a descrierii = 2000)
export const PIECE_ROW_DESCRIPTION_MAX = 1800;
// regula unica: fara "Usi glisante" in deschiderea pe rand
export const PIECE_ROW_V2_SYSTEMS = ['MANER', 'PUSH'] as const satisfies readonly ItemSystem[];

const dimCm = z
  .number({ errorMap: () => ({ message: 'validation.dimensionOutOfRange' }) })
  .int('validation.dimensionOutOfRange')
  .min(PIECE_ROW_DIM_MIN_CM, 'validation.dimensionOutOfRange')
  .max(PIECE_ROW_DIM_MAX_CM, 'validation.dimensionOutOfRange')
  .optional();

export const pieceRowV2Schema = requestItemSchema
  .extend({
    description: z.string().trim().max(PIECE_ROW_DESCRIPTION_MAX, 'validation.textTooLong').optional().or(z.literal('')),
    widthCm: dimCm,
    heightCm: dimCm,
    depthCm: dimCm,
    materialChoice: z.literal(FIRM_DECIDES).optional(),
    openingChoice: z.enum([FIRM_DECIDES, NO_FRONTS]).optional(),
  })
  .strict('validation.unknownAnswer')
  .superRefine((row, ctx) => {
    // "decide firma" la material se salveaza ca ALTUL
    if (row.materialChoice && row.material !== 'ALTUL') {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['material'], message: 'validation.answerInvalid' });
    }
    if (row.openingChoice) {
      // ieșirile de deschidere sunt exclusive: fara sisteme
      if (row.systems.length > 0) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['systems'], message: 'validation.exclusiveOption' });
      }
      return;
    }
    // deschiderea e obligatorie (cu iesirile de mai sus), doar Maner / Push
    if (row.systems.length === 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['systems'], message: 'validation.minOneOption' });
    } else if (row.systems.some((s) => !(PIECE_ROW_V2_SYSTEMS as readonly string[]).includes(s))) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['systems'], message: 'validation.optionInvalid' });
    }
  });

export type PieceRowV2 = z.infer<typeof pieceRowV2Schema>;

const cmText = (v: number) => `${v} cm`;

// "Dimensiuni: 120 × 80 × 40 cm (lățime × înălțime × adâncime)" / "Lățime 120 cm, adâncime 40 cm" / nimic
export function pieceRowDimensionsText(row: { widthCm?: number; heightCm?: number; depthCm?: number }): string | undefined {
  const w = validDim(row.widthCm);
  const h = validDim(row.heightCm);
  const d = validDim(row.depthCm);
  if (w !== undefined && h !== undefined && d !== undefined) {
    return `Dimensiuni: ${w} × ${h} × ${d} cm (lățime × înălțime × adâncime)`;
  }
  const parts = [
    w !== undefined ? `lățime ${cmText(w)}` : undefined,
    h !== undefined ? `înălțime ${cmText(h)}` : undefined,
    d !== undefined ? `adâncime ${cmText(d)}` : undefined,
  ].filter((p): p is string => p !== undefined);
  if (parts.length === 0) return undefined;
  const text = parts.join(', ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function validDim(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : undefined;
}

// Randurile v2 → piese (fara campurile noi) + marcajele "recomandarea firmei".
// Tolerant la ciorne incomplete (previzualizare): ce nu e obiect se sare.
export function derivePieceRowsV2(rows: unknown): { items: RequestItemInput[]; firmRecommendations: FirmRecommendation[] } {
  const items: RequestItemInput[] = [];
  const firmRecommendations: FirmRecommendation[] = [];
  if (!Array.isArray(rows)) return { items, firmRecommendations };
  for (const raw of rows) {
    if (!raw || typeof raw !== 'object') continue;
    const row = raw as Partial<PieceRowV2>;
    const firmMaterial = row.materialChoice === FIRM_DECIDES;
    const firmOpening = row.openingChoice === FIRM_DECIDES;
    const noFronts = row.openingChoice === NO_FRONTS;
    const description = finishDescription([
      typeof row.description === 'string' ? row.description : undefined,
      pieceRowDimensionsText(row),
      firmMaterial ? FIRM_MATERIAL_NOTE : undefined,
      firmOpening ? FIRM_OPENING_NOTE : undefined,
      noFronts ? NO_FRONTS_NOTE : undefined,
    ]);
    const name = typeof row.name === 'string' ? row.name : '';
    const item: RequestItemInput = {
      name,
      material: firmMaterial ? 'ALTUL' : ((row.material as Material | undefined) ?? 'ALTUL'),
      systems: row.openingChoice ? [] : Array.isArray(row.systems) ? [...row.systems] : [],
      quantity: typeof row.quantity === 'number' ? row.quantity : 1,
    };
    if (description) item.description = description;
    items.push(item);
    if (firmMaterial || firmOpening) firmRecommendations.push({ itemName: name, material: firmMaterial, opening: firmOpening });
  }
  return { items, firmRecommendations };
}

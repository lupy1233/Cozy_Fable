import { pieceConfig3dSchema, describePieceConfig, type Piece3dFeature, type Piece3dKind, type PieceConfig3d } from '../../piece3d';
import type { AnswerMap, FirmRecommendation, QuestionStep, RoomFlow, ScoreEntry, SingleChoiceStep } from '../../types';
import { otherMaterialStep } from '../common';
import { finishDescription, materialSetOptions, resolveMaterial, type MaterialSetKind } from '../finish-sets';
import { pieceSketchStep } from './builder';
import { furnitureLegacyAnswers } from './furniture-v3';
import { snapshot3dStep } from './v3';
import { pieceBedFlowV2, pieceBenchFlowV2, pieceTableFlowV2 } from './v2';

// Etapa 10 (formularul v7, DESIGN §6) — pat, masa, banca v5. Copie a furnitureFlowV4 (furniture-v4
// ramane INGHETAT), cu pasi NOI (nu se modifica obiectele v4): pasul 3D declara `features`, deci
// primeste campurile noi optionale:
// - pat: "Alta marime" (bed.customSize) — gabaritul si textul saltelei vin din ea;
// - masa: lungimea deschisa (doar la masa extensibila = shape 'EXTENDABLE') si inaltimea aleasa;
// - banca: inaltimea aleasa.
// Scorul e ca la v4 (BED_STORAGE / TABLE_EXTENDABLE); campurile noi au 0 puncte (PO c9-3).
// Descrierea pentru firma: textele noi le pune describePieceConfig (doar cand campul exista).

type FurnitureSet = Extract<MaterialSetKind, 'WOOD' | 'PANEL'>;

const SUBTITLE: Record<FurnitureSet, string> = {
  WOOD: 'common.finish.woodMaterial.subtitle',
  PANEL: 'common.finish.panelMaterial.subtitle',
};

const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined);

// textul saltelei standard pus de fluxul v1/v2 ("saltea 160 × 200"), inlocuit la "Alta marime".
// La "Alta marime" schema pastreaza si mattressSize (camp obligatoriu); textul lui se scoate exact.
const standardMattressText = (mattressSize: string) => `saltea ${mattressSize.replace(/^[A-Z]_/, '')} × 200`;

// Revizuire M2 (PO c9-3: "restul 0 puncte"): "Alta marime" NU schimba costul. Marimea camerei
// (lengthM, din care se ia ROOM_SIZE) se plafoneaza la cea mai lata saltea standard, 1,8 m
// (180 × 200) — o saltea de 2,0–2,2 m ramane in aceeasi treapta ca 180 × 200. Gabaritul 3D,
// descrierea pentru firma si lungimea saltelei (widthM) raman cele reale.
export const BED_CUSTOM_SIZE_SCORE_WIDTH_MAX_M = 1.8;

// "saltea 160 × 200, ladă …" → "ladă …" (doar prefixul exact al marimii standard salvate)
function stripStandardMattress(description: string, text: string): string {
  if (description === text) return '';
  return description.startsWith(`${text}, `) ? description.slice(text.length + 2) : description;
}

export function furnitureScoreEntriesV5(config: PieceConfig3d): ScoreEntry[] {
  if (config.bed && config.bed.storage !== 'NONE') return [{ category: 'BED_STORAGE', optionKey: config.bed.storage }];
  if (config.table?.shape === 'EXTENDABLE') return [{ category: 'TABLE_EXTENDABLE', optionKey: 'YES' }];
  return [];
}

function furnitureFlowV5(kind: Piece3dKind, legacy: RoomFlow, set: FurnitureSet, features: readonly Piece3dFeature[]): RoomFlow {
  const F = `flows.${legacy.roomType}`;
  const materialStep: SingleChoiceStep = {
    id: 'material',
    type: 'single-choice',
    // aceleasi texte ca v4 (intrebarea nu s-a schimbat)
    titleKey: `${F}.v4.material.title`,
    subtitleKey: SUBTITLE[set],
    screenGroup: 'material',
    options: materialSetOptions(set),
  };
  const steps: QuestionStep[] = [
    {
      id: 'config3d',
      type: 'configurator-3d',
      piece: kind,
      titleKey: `${F}.config3d.title`,
      subtitleKey: `${F}.config3d.subtitle`,
      scoreEntries: furnitureScoreEntriesV5,
      features,
    },
    materialStep,
    ...(set === 'PANEL' ? [otherMaterialStep('material', 'material')] : []),
    pieceSketchStep(F),
    snapshot3dStep(),
  ];
  return {
    roomType: legacy.roomType,
    version: 5,
    steps,
    deriveRoom: (answers) => {
      const result = pieceConfig3dSchema(kind).safeParse(answers.config3d);
      if (!result.success) return { lengthM: 0, widthM: 0, heightM: 0, items: [] };
      const config = result.data;
      const legacyAnswers: AnswerMap = { ...answers, ...furnitureLegacyAnswers(config) };
      delete legacyAnswers.material;
      delete legacyAnswers.materialOther;
      const derived = legacy.deriveRoom(legacyAnswers);
      const m = resolveMaterial(str(answers.material), set, str(answers.materialOther));
      const customSize = config.bed?.customSize;
      const firmRecommendations: FirmRecommendation[] = [];
      const items = derived.items.map((item) => {
        if (m.firmDecides) firmRecommendations.push({ itemName: item.name, material: true, opening: false });
        // "Alta marime": textul saltelei standard dispare; "Saltea: … (altă mărime)" vine din 3D
        const base = customSize && config.bed && item.description
          ? stripStandardMattress(item.description, standardMattressText(config.bed.mattressSize))
          : item.description;
        const description = finishDescription([base || undefined, describePieceConfig(kind, config), ...m.notes]);
        return { ...item, material: m.material, systems: [], ...(description ? { description } : {}) };
      });
      // salteaua aleasa da marimea (ca salteaua standard la v4), plafonata pentru cost (M2);
      // inaltimea aleasa a mesei / bancutei
      const dims = customSize
        ? { lengthM: Math.min(customSize.widthM, BED_CUSTOM_SIZE_SCORE_WIDTH_MAX_M), widthM: customSize.lengthM }
        : config.table?.customHeightM !== undefined || config.bench?.customHeightM !== undefined
          ? { heightM: config.heightM }
          : {};
      return { ...derived, ...dims, items, ...(firmRecommendations.length > 0 ? { firmRecommendations } : {}) };
    },
  };
}

export const pieceBedFlowV5: RoomFlow = furnitureFlowV5('BED', pieceBedFlowV2, 'WOOD', ['BED_CUSTOM_SIZE']);
export const pieceTableFlowV5: RoomFlow = furnitureFlowV5('TABLE', pieceTableFlowV2, 'WOOD', ['TABLE_OPEN_LENGTH', 'TABLE_CUSTOM_HEIGHT']);
export const pieceBenchFlowV5: RoomFlow = furnitureFlowV5('BENCH', pieceBenchFlowV2, 'PANEL', ['BENCH_CUSTOM_HEIGHT']);

import { pieceConfig3dSchema, describePieceConfig, type Piece3dKind, type PieceConfig3d } from '../../piece3d';
import type { AnswerMap, FirmRecommendation, QuestionStep, RoomFlow, ScoreEntry, SingleChoiceStep } from '../../types';
import { otherMaterialStep } from '../common';
import { finishDescription, materialSetOptions, resolveMaterial, type MaterialSetKind } from '../finish-sets';
import { pieceSketchStep } from './builder';
import { furnitureLegacyAnswers } from './furniture-v3';
import { snapshot3dStep } from './v3';
import { pieceBedFlowV2, pieceBenchFlowV2, pieceTableFlowV2 } from './v2';

// Etapa 6 (DESIGN §5.13) — pat, masa, banca v4. Copie a furnitureFlow din furniture-v3 (v3 ramane
// INGHETAT): materialul foloseste setul de lemn (pat, masa — fara "Altul", fara pret pe metru, N5)
// sau setul de placi (banca — cu "Altul"). Fara deschidere (N10). Derivarea porneste tot din
// fluxurile v2 (furnitureLegacyAnswers), apoi suprascrie materialul cu resolveMaterial si adauga notele.

type FurnitureSet = Extract<MaterialSetKind, 'WOOD' | 'PANEL'>;

const SUBTITLE: Record<FurnitureSet, string> = {
  WOOD: 'common.finish.woodMaterial.subtitle',
  PANEL: 'common.finish.panelMaterial.subtitle',
};

const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined);

function furnitureFlowV4(kind: Piece3dKind, legacy: RoomFlow, set: FurnitureSet): RoomFlow {
  const F = `flows.${legacy.roomType}`;
  const scoreEntries = (config: PieceConfig3d): ScoreEntry[] => {
    if (config.bed && config.bed.storage !== 'NONE') return [{ category: 'BED_STORAGE', optionKey: config.bed.storage }];
    if (config.table?.shape === 'EXTENDABLE') return [{ category: 'TABLE_EXTENDABLE', optionKey: 'YES' }];
    return [];
  };
  const materialStep: SingleChoiceStep = {
    id: 'material',
    type: 'single-choice',
    titleKey: `${F}.v4.material.title`,
    subtitleKey: SUBTITLE[set],
    screenGroup: 'material',
    options: materialSetOptions(set),
  };
  const steps: QuestionStep[] = [
    { id: 'config3d', type: 'configurator-3d', piece: kind, titleKey: `${F}.config3d.title`, subtitleKey: `${F}.config3d.subtitle`, scoreEntries },
    materialStep,
    // "Altul" exista doar in setul de placi (banca)
    ...(set === 'PANEL' ? [otherMaterialStep('material', 'material')] : []),
    pieceSketchStep(F),
    snapshot3dStep(),
  ];
  return {
    roomType: legacy.roomType,
    version: 4,
    steps,
    deriveRoom: (answers) => {
      const result = pieceConfig3dSchema(kind).safeParse(answers.config3d);
      if (!result.success) return { lengthM: 0, widthM: 0, heightM: 0, items: [] };
      const config = result.data;
      // fluxul v2 nu primeste materialul: altfel ar adauga singur "Material dorit: …"
      const legacyAnswers: AnswerMap = { ...answers, ...furnitureLegacyAnswers(config) };
      delete legacyAnswers.material;
      delete legacyAnswers.materialOther;
      const derived = legacy.deriveRoom(legacyAnswers);
      const m = resolveMaterial(str(answers.material), set, str(answers.materialOther));
      const firmRecommendations: FirmRecommendation[] = [];
      const items = derived.items.map((item) => {
        if (m.firmDecides) firmRecommendations.push({ itemName: item.name, material: true, opening: false });
        const description = finishDescription([item.description, describePieceConfig(kind, config), ...m.notes]);
        return { ...item, material: m.material, systems: [], ...(description ? { description } : {}) };
      });
      return { ...derived, items, ...(firmRecommendations.length > 0 ? { firmRecommendations } : {}) };
    },
  };
}

export const pieceBedFlowV4: RoomFlow = furnitureFlowV4('BED', pieceBedFlowV2, 'WOOD');
export const pieceTableFlowV4: RoomFlow = furnitureFlowV4('TABLE', pieceTableFlowV2, 'WOOD');
export const pieceBenchFlowV4: RoomFlow = furnitureFlowV4('BENCH', pieceBenchFlowV2, 'PANEL');

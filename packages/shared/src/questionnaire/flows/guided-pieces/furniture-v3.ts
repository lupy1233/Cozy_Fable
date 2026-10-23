import { pieceConfig3dSchema, describePieceConfig, type Piece3dKind, type PieceConfig3d } from '../../piece3d';
import type { AnswerMap, RoomFlow, ScoreEntry } from '../../types';
import { pieceMaterialStep, pieceSketchStep } from './builder';
import { otherMaterialStep } from '../common';
import { snapshot3dStep } from './v3';
import { pieceBedFlowV2, pieceTableFlowV2, pieceBenchFlowV2 } from './v2';

// v1/v2 sunt nemodificate. v3 foloseste acelasi raspuns 3D in studio, wizard si firma.
// Derivarea se bazeaza pe semantica existenta: salteaua, nu gabaritul cadrului, da ROOM_SIZE.
export function furnitureLegacyAnswers(config: PieceConfig3d): AnswerMap {
  if (config.bed) return {
    bedSize: config.bed.mattressSize, storage: config.bed.storage, upholstered: config.bed.upholstered,
  };
  if (config.table) return {
    tableType: config.table.type, shape: config.table.shape,
    ...(config.table.seats ? { seats: config.table.seats } : {}),
    dimensions: config.table.shape === 'ROUND'
      ? { diameter: config.widthM }
      : { length: config.widthM, width: config.depthM },
  };
  if (config.bench) return {
    style: config.bench.style, upholsteredSeat: config.bench.upholsteredSeat,
    dimensions: { width: config.widthM },
  };
  return {};
}

function furnitureFlow(kind: Piece3dKind, legacy: RoomFlow): RoomFlow {
  const F = `flows.${legacy.roomType}`;
  const scoreEntries = (config: PieceConfig3d): ScoreEntry[] => {
    if (config.bed && config.bed.storage !== 'NONE') return [{ category: 'BED_STORAGE', optionKey: config.bed.storage }];
    if (config.table?.shape === 'EXTENDABLE') return [{ category: 'TABLE_EXTENDABLE', optionKey: 'YES' }];
    return [];
  };
  return {
    roomType: legacy.roomType,
    version: 3,
    steps: [
      { id: 'config3d', type: 'configurator-3d', piece: kind, titleKey: `${F}.config3d.title`, subtitleKey: `${F}.config3d.subtitle`, scoreEntries },
      pieceMaterialStep(F), otherMaterialStep('material', 'material'), pieceSketchStep(F), snapshot3dStep(),
    ],
    deriveRoom: (answers) => {
      const result = pieceConfig3dSchema(kind).safeParse(answers.config3d);
      if (!result.success) return { lengthM: 0, widthM: 0, heightM: 0, items: [] };
      const config = result.data;
      const derived = legacy.deriveRoom({ ...answers, ...furnitureLegacyAnswers(config) });
      return {
        ...derived,
        items: derived.items.map((item) => ({
          ...item,
          description: [item.description, describePieceConfig(kind, config)].filter(Boolean).join('; '),
        })),
      };
    },
  };
}

export const pieceBedFlowV3 = furnitureFlow('BED', pieceBedFlowV2);
export const pieceTableFlowV3 = furnitureFlow('TABLE', pieceTableFlowV2);
export const pieceBenchFlowV3 = furnitureFlow('BENCH', pieceBenchFlowV2);

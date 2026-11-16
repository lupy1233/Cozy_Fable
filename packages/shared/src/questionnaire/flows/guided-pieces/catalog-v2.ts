import type { ItemSystem } from '../../../enums';
import { configHasFronts, NEW_PIECE_KINDS, PIECE3D_RULES, pieceConfig3dSchema, describePieceConfig } from '../../piece3d';
import type { QuestionStep, RoomFlow } from '../../types';
import { otherMaterialStep } from '../common';
import { FRAME_BY_FIRM_NOTE, finishDescription } from '../finish-sets';
import { pieceSketchStep } from './builder';
import { snapshot3dStep } from './v3';
import { finishMaterialStepV4, finishPieceItem, liftUpDoorsStep } from './v4';

// Etapa 6 (DESIGN §5.14) — piesele de catalog v2. Bucla din catalog-v1 copiata (v1 ramane INGHETAT):
// - bufet, corp suspendat: setul BODY + bifa pistoanelor (liftUpDoors → AVENTOS + nota, N7);
// - mobilier lavoar: setul BODY + "Integral din MDF" (N4);
// - mobilier hol: setul BODY;
// - canapea, fotoliu, taburet: FARA pas de material (PO c1-2) → ALTUL + "Cadru: il alege firma"
//   + marcajul "recomandarea firmei" (N19).
// Sistemele vin din 3D ca la v1 (vanity.handles, entryway.shoeStorage, frontStyle), dar doar
// cand piesa are fronturi (configHasFronts) — aceeasi regula ca la piesele ghidate v4.
type CatalogKind = (typeof NEW_PIECE_KINDS)[number];
type CatalogRoomType = `PIECE_${CatalogKind}`;

const UPHOLSTERED: readonly CatalogKind[] = ['SOFA', 'ARMCHAIR', 'OTTOMAN'];
const WITH_PISTONS: readonly CatalogKind[] = ['SIDEBOARD', 'WALL_CABINET'];

export const catalogFlowRegistryV2 = {} as Record<CatalogRoomType, Record<number, RoomFlow>>;
export const catalogFlowVersionsV2 = {} as Record<CatalogRoomType, number>;

for (const kind of NEW_PIECE_KINDS) {
  const roomType: CatalogRoomType = `PIECE_${kind}`;
  const key = `flows.${roomType}`;
  const upholstered = UPHOLSTERED.includes(kind);
  const pistons = WITH_PISTONS.includes(kind);
  const finishSteps: QuestionStep[] = upholstered
    ? []
    : [
        finishMaterialStepV4(key, 2, { integralMdf: kind === 'BATHROOM_VANITY' }),
        otherMaterialStep('material', 'material'),
        ...(pistons ? [liftUpDoorsStep()] : []),
      ];
  const flow: RoomFlow = {
    roomType,
    version: 2,
    steps: [
      { id: 'config3d', type: 'configurator-3d', piece: kind, titleKey: `${key}.config3d.title`, subtitleKey: `${key}.config3d.subtitle` },
      ...finishSteps,
      pieceSketchStep(key),
      snapshot3dStep(),
    ],
    deriveRoom: (answers) => {
      const parsed = pieceConfig3dSchema(kind).safeParse(answers.config3d);
      if (!parsed.success) return { lengthM: 0, widthM: 0, heightM: 0, items: [] };
      const config = parsed.data;
      const itemName = PIECE3D_RULES[kind].itemName;
      const opening = config.vanity
        ? config.vanity.storage === 'OPEN' ? undefined : config.vanity.handles
        : config.entryway
          ? config.entryway.shoeStorage === 'DOORS' ? 'HANDLE' : undefined
          : config.frontStyle;
      // maner / push din 3D doar la o piesa cu fronturi (revizuire m2; aceeasi regula ca v4)
      const systems: ItemSystem[] = !configHasFronts(kind, config) ? []
        : opening === 'HANDLE' ? ['MANER'] : opening === 'PUSH' ? ['PUSH'] : [];
      const dims = { lengthM: config.widthM, widthM: config.depthM, heightM: config.heightM };
      const described = describePieceConfig(kind, config);

      if (upholstered) {
        return {
          ...dims,
          items: [{
            name: itemName,
            material: 'ALTUL',
            systems,
            quantity: 1,
            description: finishDescription([described, FRAME_BY_FIRM_NOTE]),
          }],
          firmRecommendations: [{ itemName, material: true, opening: false }],
        };
      }

      const finished = finishPieceItem({
        kind,
        config,
        answers,
        liftUp: pistons,
        itemName,
        baseSystems: systems,
        baseParts: [described],
      });
      return {
        ...dims,
        items: [{
          name: itemName,
          material: finished.material,
          systems: finished.systems,
          quantity: 1,
          ...(finished.description ? { description: finished.description } : {}),
        }],
        ...(finished.firmRecommendations.length > 0 ? { firmRecommendations: finished.firmRecommendations } : {}),
      };
    },
  };
  catalogFlowRegistryV2[roomType] = { 2: flow };
  catalogFlowVersionsV2[roomType] = 2;
}

import { DEFAULT_CEILING_HEIGHT, dimensionValues, linearMeters, STANDARD_CABINET_DEPTH } from '../mapping';
import type { DimensionGroupStep, QuestionStep, RoomFlow } from '../types';
import { bedroomFlowV2 } from './bedroom.v2';
import { finishDescription } from './finish-sets';
import {
  buildFinishItems,
  pieceFinishSteps,
  renameItem,
  sameFinishStep,
  type FinishOpts,
  type FinishPieceDef,
} from './piece-finish';
import { pieceChoiceOptions } from './pieces-flow';

// Dormitor v3 (etapa 6 — c2, c3, c14):
// - materialul si deschiderea fiecarei piese pe UN ecran (piece:<VALUE>), cu seturile noi
//   si "Nu stiu — vreau recomandarea firmei";
// - dulapul: tipul usilor intrebat o data; glisante → GLISANTE fara intrebare de deschidere,
//   batante → deschiderea pe ecranul dulapului;
// - patul: setul de lemn; deschidere doar cand are sertare;
// - intrebarea comuna "Acelasi material si aceeasi deschidere pentru toate piesele?";
// - ecranul saltelei aduna marimea, dimensiunile custom si tapitarea.
// Pasii neschimbati (dimensiuni, saltea, tipul usilor, depozitare, noptiere, schita) sunt
// luati direct din v2 (inghetat), ca sa ramana identici.

const F = 'flows.BEDROOM';
const V = `${F}.v3`;

function fromV2<T extends QuestionStep = QuestionStep>(id: string): T {
  const s = bedroomFlowV2.steps.find((x) => x.id === id);
  if (!s) throw new Error(`bedroom.v3: pasul ${id} lipseste din v2`);
  return s as T;
}

const DEFS: FinishPieceDef[] = [
  {
    value: 'WARDROBE', icon: 'door-closed', itemName: 'Dulap dormitor',
    materialStepId: 'materialWardrobe', systemsStepId: 'systemsWardrobe', materialTitleKey: `${V}.materialWardrobe.title`,
    materialSet: 'BODY', fronts: 'YES',
    leadSteps: [fromV2('wardrobeDoorType')],
    frontsIf: { questionId: 'wardrobeDoorType', equals: 'HINGED' },
    // c3: costul tine cont de usile glisante
    fixedSystems: (a) => (a.wardrobeDoorType === 'SLIDING' ? ['GLISANTE'] : null),
  },
  {
    value: 'BED_FRAME', icon: 'bed-double', itemName: 'Cadru pat',
    materialStepId: 'materialBed', systemsStepId: 'systemsBed', materialTitleKey: `${V}.materialBed.title`,
    materialSet: 'WOOD', fronts: 'YES',
    leadSteps: [fromV2('bedStorage')],
    // lada rabatabila / fara depozitare → fara pas de deschidere
    frontsIf: { questionId: 'bedStorage', equals: 'DRAWERS' },
  },
  {
    value: 'NIGHTSTANDS', icon: 'lamp', itemName: 'Noptiere', quantity: 2,
    materialStepId: 'materialNightstands', systemsStepId: 'systemsNightstands', materialTitleKey: `${V}.materialNightstands.title`,
    materialSet: 'BODY', fronts: 'YES',
    leadSteps: [fromV2('nightstandsCount')],
  },
  {
    value: 'DRESSER', icon: 'archive', itemName: 'Comodă',
    materialStepId: 'materialDresser', systemsStepId: 'systemsDresser', materialTitleKey: `${V}.materialDresser.title`,
    materialSet: 'BODY', fronts: 'YES',
  },
  {
    value: 'TV_UNIT', icon: 'tv', itemName: 'Comodă TV',
    materialStepId: 'materialTvUnit', systemsStepId: 'systemsTvUnit', materialTitleKey: `${V}.materialTvUnit.title`,
    materialSet: 'BODY', fronts: 'YES', pistons: true,
  },
  {
    value: 'VANITY', icon: 'sparkles', itemName: 'Măsuță toaletă',
    materialStepId: 'materialVanity', systemsStepId: 'systemsVanity', materialTitleKey: `${V}.materialVanity.title`,
    materialSet: 'BODY', fronts: 'MAYBE',
  },
];

const OPTS: FinishOpts = { flowKey: F, common: true };

// latimea saltelei standard (aceeasi tabela ca v2) → intra in metri liniari
const BED_WIDTH: Record<string, number> = { S_90: 0.9, M_140: 1.4, Q_160: 1.6, K_180: 1.8 };

const dimensionsStep = fromV2<DimensionGroupStep>('dimensions');

export const bedroomFlowV3: RoomFlow = {
  roomType: 'BEDROOM',
  version: 3,
  steps: [
    {
      id: 'piecesNeeded',
      type: 'multi-choice',
      titleKey: `${F}.piecesNeeded.title`,
      subtitleKey: `${F}.piecesNeeded.subtitle`,
      screenGroup: 'pieces',
      minSelected: 1,
      options: pieceChoiceOptions(F, DEFS),
    },
    sameFinishStep(OPTS, DEFS),
    // ecranul saltelei: marime + dimensiuni custom (conditionat) + tapitare
    fromV2('bedSize'),
    fromV2('bedCustomSize'),
    { ...fromV2('bedUpholstered'), screenGroup: 'bedSize' },
    dimensionsStep,
    ...pieceFinishSteps(OPTS, DEFS),
    fromV2('sketch'),
  ],
  deriveRoom: (answers) => {
    const result = buildFinishItems(answers, DEFS, 'Mobilier dormitor');
    const bedSize = typeof answers.bedSize === 'string' ? answers.bedSize : undefined;
    const custom = dimensionValues(answers, 'bedCustomSize');
    for (const item of result.items) {
      if (item.name === 'Cadru pat') {
        const details: string[] = [];
        if (bedSize === 'CUSTOM' && custom.bedCustomWidth && custom.bedCustomLength) {
          details.push(
            `saltea custom ${Math.round(custom.bedCustomWidth * 100)} × ${Math.round(custom.bedCustomLength * 100)} cm`,
          );
        } else if (bedSize) {
          details.push(`saltea ${bedSize.replace(/^[A-Z]_/, '')} × 200`);
        }
        if (answers.bedStorage === 'LIFT_UP') details.push('ladă rabatabilă');
        if (answers.bedStorage === 'DRAWERS') details.push('sertare laterale');
        if (details.length > 0) {
          const description = finishDescription([item.description, details.join(', ')]);
          if (description) item.description = description;
        }
      }
      if (item.name === 'Noptiere' && answers.nightstandsCount === 'ONE') {
        item.quantity = 1;
      }
    }
    if (answers.bedUpholstered === true) renameItem(result, 'Cadru pat', 'Pat tapițat');

    const bedLinear =
      bedSize === 'CUSTOM' ? (custom.bedCustomWidth ?? 0) : bedSize ? (BED_WIDTH[bedSize] ?? 0) : 0;
    return {
      lengthM: linearMeters(dimensionsStep, answers) + bedLinear,
      widthM: STANDARD_CABINET_DEPTH,
      heightM: dimensionValues(answers, 'dimensions').ceilingHeight ?? DEFAULT_CEILING_HEIGHT,
      items: result.items,
      firmRecommendations: result.firmRecommendations,
    };
  },
};

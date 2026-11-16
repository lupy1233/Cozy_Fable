import { linearMeters } from '../mapping';
import type { DimensionGroupStep, DimensionSlot, QuestionStep, RoomFlow, SingleChoiceStep } from '../types';
import { hallwayFlowV2 } from './hallway.v2';
import { ceilingIfTall, optionalChoiceStep, optionalHeightSlot, pieceWidthSlot } from './measure-sets';
import { selectedPieces } from './per-piece';

// Hol v3 (etapa 10 — c5, DESIGN §5.10 / tabelul 5.0):
// - intrebarea simpla "Hol ingust (sub 1,2 m) / generos / nu stiu" pe ecranul pieselor (E10-N15:
//   "Nu stiu — o masoara firma" = valoarea comuna FIRM_DECIDES cu eticheta proprie). E o informatie
//   de camera: firma o vede in rezumat, nu intra in descrierea pieselor;
// - inaltimea optionala la dulapul de hol si la cuier (E10-N13); tavanul tot doar la ele (ca v1).
// Restul pasilor si derivarea pieselor sunt cele din v2 (inghetat), refolosite nemodificate.

const F = 'flows.HALLWAY';
const V = `${F}.v3`;

const hallWidthBase = optionalChoiceStep({
  id: 'hallWidth',
  titleKey: `${V}.hallWidth.title`,
  subtitleKey: `${V}.hallWidth.subtitle`,
  screenGroup: 'pieces',
  icon: 'ruler',
  category: 'HALLWAY_WIDTH',
  keyPrefix: `${V}.hallWidth`,
  options: [{ value: 'NARROW' }, { value: 'WIDE' }],
  firmDecidesLabelKey: `${V}.hallWidth.options.FIRM_DECIDES.label`,
});
// "Nu stiu — o masoara firma" are si descriere proprie (cea comuna vorbeste de recomandare)
const hallWidthStep: SingleChoiceStep = {
  ...hallWidthBase,
  options: hallWidthBase.options.map((o) =>
    o.value === 'FIRM_DECIDES' ? { ...o, descriptionKey: `${V}.hallWidth.options.FIRM_DECIDES.description` } : o,
  ),
};

const PIECE_SLOTS: Record<string, () => DimensionSlot[]> = {
  SHOE_CABINET: () => [
    pieceWidthSlot('shoeCabinetWidth', `${F}.dimensions.slots.shoeCabinetWidth`, { min: 0.4, max: 2.5 }),
  ],
  COAT_UNIT: () => [
    pieceWidthSlot('coatUnitWidth', `${F}.dimensions.slots.coatUnitWidth`, { min: 0.5, max: 2.5 }),
    optionalHeightSlot('coatUnitHeight', `${F}.dimensions.slots.coatUnitHeight`, { min: 1.4, max: 2.6 }, 2),
  ],
  WARDROBE: () => [
    pieceWidthSlot('wardrobeWidth', `${F}.dimensions.slots.wardrobeWidth`, { min: 0.5, max: 3 }),
    optionalHeightSlot('wardrobeHeight', `${F}.dimensions.slots.wardrobeHeight`, { min: 1.8, max: 3 }, 2.4),
  ],
  BENCH: () => [pieceWidthSlot('benchWidth', `${F}.dimensions.slots.benchWidth`, { min: 0.5, max: 2 })],
  MIRROR: () => [pieceWidthSlot('mirrorWidth', `${F}.dimensions.slots.mirrorWidth`, { min: 0.4, max: 1.5 })],
};
// tavanul conteaza doar pentru corpurile inalte (ca v1)
const TALL_PIECES = ['WARDROBE', 'COAT_UNIT'];

const dimensionsStep: DimensionGroupStep = {
  id: 'dimensions',
  type: 'dimension-group',
  titleKey: `${F}.dimensions.title`,
  subtitleKey: `${V}.dimensions.subtitle`,
  slots: (answers) => {
    const selected = selectedPieces(answers);
    return [
      ...selected.filter((p) => PIECE_SLOTS[p]).flatMap((p) => PIECE_SLOTS[p]()),
      ...ceilingIfTall(selected, TALL_PIECES),
    ];
  },
};

// ecranul pieselor: piecesNeeded, sameFinishAll, apoi latimea holului
const steps: QuestionStep[] = [];
for (const s of hallwayFlowV2.steps) {
  steps.push(s.id === 'dimensions' ? dimensionsStep : s);
  if (s.id === 'sameFinishAll') steps.push(hallWidthStep);
}

export const hallwayFlowV3: RoomFlow = {
  roomType: 'HALLWAY',
  version: 3,
  steps,
  // piesele, adancimea si tavanul ca v2; lungimea din latimile pasului nou
  deriveRoom: (answers) => ({ ...hallwayFlowV2.deriveRoom(answers), lengthM: linearMeters(dimensionsStep, answers) }),
};

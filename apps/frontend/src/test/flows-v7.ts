import {
  emptyDerivedRoom,
  FLOW_REGISTRY,
  optionalHeightSlot,
  pieceDetailsGroup,
  pieceWidthSlot,
  type DimensionGroupStep,
  type QuestionStep,
  type RoomFlow,
} from '@marketplace/shared';

// Flux de test (etapa 10, doar pentru teste): un slot optional cu valoare tipica si un
// ecran de detalii pe piesa, construite cu API-ul fundatiei — nu depind de continutul
// final al fluxurilor scrise de ceilalti agenti. Se inregistreaza temporar ca BEDROOM v99.
// DOAR pentru teste: nu se importa din codul de productie (scrie in FLOW_REGISTRY).

export const TOY_ROOM = 'BEDROOM' as const;
export const TOY_VERSION = 99;

export const TOY_WIDTH_LABEL = 'flows.BEDROOM.dimensions.slots.wardrobeWidth';
export const TOY_HEIGHT_LABEL = 'flows.DRESSING.dimensions.slots.wardrobeHeight';

export const toyDimensions: DimensionGroupStep = {
  id: 'dimensions',
  type: 'dimension-group',
  titleKey: 'flows.BEDROOM.dimensions.title',
  slots: () => [
    pieceWidthSlot('wardrobeWidth', TOY_WIDTH_LABEL, { min: 0.6, max: 6 }),
    optionalHeightSlot('wardrobeHeight', TOY_HEIGHT_LABEL, { min: 1.8, max: 3.2 }, 2.4),
  ],
};

const choice = (id: string, screenGroup?: string, extra: Partial<QuestionStep> = {}): QuestionStep =>
  ({
    id,
    type: 'single-choice',
    titleKey: `flows.BEDROOM.dimensions.title`,
    options: [
      { value: 'A', labelKey: 'common.boolean.yes' },
      { value: 'B', labelKey: 'common.boolean.no' },
    ],
    ...(screenGroup ? { screenGroup } : {}),
    ...extra,
  }) as QuestionStep;

// ecranele: [start] [piesa: material + deschidere] [piesa: detalii] [dimensiuni]
export const toyFlow: RoomFlow = {
  roomType: TOY_ROOM,
  version: TOY_VERSION,
  steps: [
    choice('start'),
    choice('materialWardrobe', 'piece:WARDROBE'),
    choice('openingWardrobe', 'piece:WARDROBE'),
    choice('wardrobeInterior', pieceDetailsGroup('WARDROBE'), { optional: true }),
    toyDimensions,
  ],
  deriveRoom: () => emptyDerivedRoom(),
};

export function registerToyFlow(): void {
  (FLOW_REGISTRY[TOY_ROOM] as Record<number, RoomFlow>)[TOY_VERSION] = toyFlow;
}

export function unregisterToyFlow(): void {
  delete (FLOW_REGISTRY[TOY_ROOM] as Record<number, RoomFlow>)[TOY_VERSION];
}

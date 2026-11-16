import { linearMeters } from '../mapping';
import type { AnswerMap, DimensionGroupStep, DimensionSlot, QuestionStep, RoomFlow } from '../types';
import { linearSlot } from './common';
import { dressingFlowV4 } from './dressing.v4';

// Dressing v5 (etapa 10, formularul v7 — DESIGN §5.0 / §5.2; PO c5):
// - walk-in cere laturile A / B / C (azi doar A / B, ca "In L");
// - laturile B / C pornesc de la 0,6 m la toate formele; A ramane de la 1 m;
// - inaltimea dulapului ramane obligatorie (c5 pasul 3); subtitlu nou pe versiune.
// Restul pasilor (usi, module, material, deschidere, schita) = aceleasi obiecte ca v4.
// Derivarea = cea din v4, cu lungimea recalculata pe laturile v5 (suma laturilor, ca azi).
// v4 ramane FROZEN.

const F = 'flows.DRESSING';

const LAYOUT_RUNS: Record<string, string[]> = {
  LINEAR: ['runA'],
  L_SHAPE: ['runA', 'runB'],
  U_SHAPE: ['runA', 'runB', 'runC'],
  WALK_IN: ['runA', 'runB', 'runC'],
};
const RUN_MIN: Record<string, number> = { runA: 1, runB: 0.6, runC: 0.6 };

function dimensionSlots(answers: AnswerMap): DimensionSlot[] {
  const layout = typeof answers.layout === 'string' ? answers.layout : 'LINEAR';
  const runs = LAYOUT_RUNS[layout] ?? LAYOUT_RUNS.LINEAR;
  const slots = runs.map((id) => linearSlot(id, `${F}.dimensions.slots.${id}`, { min: RUN_MIN[id] ?? 1 }));
  // inaltimea DULAPULUI, nu a camerei (ca v3 / v4)
  slots.push({
    id: 'wardrobeHeight',
    labelKey: `${F}.dimensions.slots.wardrobeHeight`,
    unit: 'm',
    min: 1.8,
    max: 3.2,
    step: 0.05,
  });
  return slots;
}

const v4Dimensions = (): DimensionGroupStep => {
  const s = dressingFlowV4.steps.find((x) => x.id === 'dimensions');
  if (!s || s.type !== 'dimension-group') throw new Error('dressing v4 step lipsa: dimensions');
  return s;
};

const dimensionsStep: DimensionGroupStep = {
  ...v4Dimensions(),
  subtitleKey: `${F}.v5.dimensions.subtitle`,
  slots: dimensionSlots,
};

const steps: QuestionStep[] = dressingFlowV4.steps.map((step) => (step.id === 'dimensions' ? dimensionsStep : step));

export const dressingFlowV5: RoomFlow = {
  roomType: 'DRESSING',
  version: 5,
  steps,
  deriveRoom: (answers) => ({
    ...dressingFlowV4.deriveRoom(answers),
    lengthM: linearMeters(dimensionsStep, answers),
  }),
};

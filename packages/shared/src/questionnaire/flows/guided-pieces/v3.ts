import type { ItemSystem, Material, RoomType } from '../../../enums';
import {
  describePieceConfig,
  isPieceConfig3d,
  PIECE3D_RULES,
  type Piece3dKind,
  type PieceConfig3d,
} from '../../piece3d';
import type {
  AnswerMap,
  Configurator3dStep,
  QuestionStep,
  RoomFlow,
  ScoreEntry,
  UploadStep,
} from '../../types';
import { otherMaterialStep } from '../common';
import { answerString, pieceMaterialStep, pieceSketchStep, pieceSystemsStep } from './builder';

// Versiunile 3 ale pieselor-carcasa (docs/10 R3+R5): step-ul configurator-3d
// INLOCUIESTE dimensions + configuratia interioara (style/interiorModules/
// storage); raman intrebarile ortogonale (material cu "Altul", doorType la
// dulap, tvSetup, cableManagement, count la noptiere) si schita. v1/v2 raman
// FROZEN — cererile publicate pe ele se valideaza contra definitiei originale.
// Piesele care nu sunt corpuri (pat, masa, bancuta) raman pe v2.

// Snapshotul PNG al scenei (R4): step upload ASCUNS, scris programatic la
// publish; trece prin acelasi flux presigned + verificare de ownership ca
// schitele. Hidden → fara ecran in wizard si fara intrare in rezumatul Q→A.
export function snapshot3dStep(): UploadStep {
  return {
    id: 'snapshot3d',
    type: 'upload',
    titleKey: 'config3d.snapshotAlt',
    optional: true,
    hidden: true,
    maxFiles: 1,
  };
}

function config3dStep(
  flowKey: string,
  kind: Piece3dKind,
  scoreEntries?: (config: PieceConfig3d) => ScoreEntry[],
): Configurator3dStep {
  return {
    id: 'config3d',
    type: 'configurator-3d',
    piece: kind,
    titleKey: `${flowKey}.config3d.title`,
    subtitleKey: `${flowKey}.config3d.subtitle`,
    ...(scoreEntries ? { scoreEntries } : {}),
  };
}

function configOf(answers: AnswerMap): PieceConfig3d | null {
  return isPieceConfig3d(answers.config3d) ? answers.config3d : null;
}

// Descrierea itemului derivat: config-ul generat + textul liber "alt material"
// (aceeasi semantica precum pieceFlowV2).
function derivedDescription(
  kind: Piece3dKind,
  config: PieceConfig3d | null,
  answers: AnswerMap,
  extra?: string,
): string | undefined {
  const parts: string[] = [];
  if (config) parts.push(describePieceConfig(kind, config));
  if (extra) parts.push(extra);
  const text = answers.materialOther;
  if (answers.material === 'ALTUL' && typeof text === 'string' && text.trim()) {
    parts.push(`Material dorit: ${text.trim()}`);
  }
  return parts.length > 0 ? parts.join('; ') : undefined;
}

interface Piece3dFlowSpec {
  roomType: RoomType;
  kind: Piece3dKind;
  // step-uri ortogonale pastrate din v1, inserate intre config3d si material
  extraSteps?: QuestionStep[];
  // include intrebarea de sisteme de deschidere (doar unde exista chei i18n v1)
  withSystems?: boolean;
  scoreEntries?: (config: PieceConfig3d) => ScoreEntry[];
  derive: (config: PieceConfig3d | null, answers: AnswerMap) => {
    name: string;
    systems: ItemSystem[];
    quantity: number;
    extraDescription?: string;
  };
}

function piece3dFlow(spec: Piece3dFlowSpec): RoomFlow {
  const F = `flows.${spec.roomType}`;
  const rules = PIECE3D_RULES[spec.kind];
  return {
    roomType: spec.roomType,
    version: 3,
    steps: [
      config3dStep(F, spec.kind, spec.scoreEntries),
      ...(spec.extraSteps ?? []),
      pieceMaterialStep(F),
      otherMaterialStep('material', 'material'),
      ...(spec.withSystems ? [pieceSystemsStep(F)] : []),
      pieceSketchStep(F),
      snapshot3dStep(),
    ],
    deriveRoom: (answers) => {
      const config = configOf(answers);
      const item = spec.derive(config, answers);
      return {
        // lengthM = frontul piesei (metri liniari pentru ROOM_SIZE)
        lengthM: (config?.widthM ?? 0) * item.quantity,
        widthM: config?.depthM ?? rules.depth.default,
        heightM: config?.heightM ?? rules.height.default,
        items: [
          {
            name: item.name,
            material: (answers.material as Material) ?? 'PAL',
            systems: [...new Set([...item.systems, ...frontStyleSystems(config)])],
            description: derivedDescription(spec.kind, config, answers, item.extraDescription),
            quantity: item.quantity,
          },
        ],
      };
    },
  };
}

const openingSystems = (answers: AnswerMap): ItemSystem[] =>
  Array.isArray(answers.openingSystems) ? (answers.openingSystems as ItemSystem[]) : [];

// T1: alegerea maner/push din configuratorul 3D intra in sistemele itemului
// derivat (dedup cu openingSystems unde intrebarea separata exista).
const frontStyleSystems = (config: PieceConfig3d | null): ItemSystem[] =>
  config?.frontStyle === 'HANDLE' ? ['MANER'] : config?.frontStyle === 'PUSH' ? ['PUSH'] : [];

export const pieceBookcaseFlowV3: RoomFlow = piece3dFlow({
  roomType: 'PIECE_BOOKCASE',
  kind: 'BOOKCASE',
  withSystems: true,
  derive: (_config, answers) => ({
    name: 'Biblioteca',
    systems: openingSystems(answers),
    quantity: 1,
  }),
});

// T1 (feedback PO 2026-07-13): alegerea glisant/batante s-a mutat IN
// configuratorul 3D (config.doorMode, cu usi vizibile si directie de glisare).
// Step-ul doorType devine ASCUNS + optional — ca snapshot3d: nu mai primeste
// ecran, dar raspunsurile din drafturile/cererile vechi raman valide la
// publish. Sistemul GLISANTE se deriva din config, cu fallback pe raspunsul
// legacy; "pana in tavan" ramane implicat de inaltime (≥2.5m), inclusiv scoring.
const WARDROBE_DOOR_SYSTEMS: Record<string, ItemSystem[]> = {
  SLIDING: ['GLISANTE'],
  HINGED: [],
};

export const pieceWardrobeFlowV3: RoomFlow = (() => {
  const F = 'flows.PIECE_WARDROBE';
  const doorTypeStep: QuestionStep = {
    id: 'doorType',
    type: 'single-choice',
    titleKey: `${F}.doorType.title`,
    subtitleKey: `${F}.doorType.subtitle`,
    optional: true,
    hidden: true,
    options: ['SLIDING', 'HINGED'].map((value) => ({
      value,
      labelKey: `${F}.doorType.options.${value}.label`,
      descriptionKey: `${F}.doorType.options.${value}.description`,
      icon: value === 'SLIDING' ? 'move-horizontal' : 'door-closed',
      info: {
        titleKey: `${F}.doorType.options.${value}.info.title`,
        bodyKey: `${F}.doorType.options.${value}.info.body`,
        prosKeys: [1, 2].map((i) => `${F}.doorType.options.${value}.info.pros${i}`),
        consKeys: [1].map((i) => `${F}.doorType.options.${value}.info.cons${i}`),
        priceHintKey: `${F}.doorType.options.${value}.info.price`,
      },
    })),
  };
  return piece3dFlow({
    roomType: 'PIECE_WARDROBE',
    kind: 'WARDROBE',
    extraSteps: [doorTypeStep],
    scoreEntries: (config) =>
      config.heightM >= 2.5 ? [{ category: 'WARDROBE_TO_CEILING', optionKey: 'YES' }] : [],
    derive: (config, answers) => ({
      name:
        config && config.heightM >= 2.5 ? 'Dulap pana in tavan (tip dressing)' : 'Dulap',
      systems:
        config?.doorMode === 'SLIDING'
          ? ['GLISANTE']
          : WARDROBE_DOOR_SYSTEMS[answerString(answers, 'doorType', 'HINGED')] ?? [],
      quantity: 1,
    }),
  });
})();

export const pieceTvUnitFlowV3: RoomFlow = (() => {
  const F = 'flows.PIECE_TV_UNIT';
  const tvSetupStep: QuestionStep = {
    id: 'tvSetup',
    type: 'single-choice',
    titleKey: `${F}.tvSetup.title`,
    info: { titleKey: `${F}.tvSetup.info.title`, bodyKey: `${F}.tvSetup.info.body` },
    options: ['TV_ON_WALL', 'TV_ON_UNIT', 'UNDECIDED'].map((value) => ({
      value,
      labelKey: `${F}.tvSetup.options.${value}.label`,
    })),
  };
  return piece3dFlow({
    roomType: 'PIECE_TV_UNIT',
    kind: 'TV_UNIT',
    extraSteps: [tvSetupStep],
    withSystems: true,
    derive: (_config, answers) => ({
      name: 'Comoda TV',
      systems: openingSystems(answers),
      quantity: 1,
      extraDescription: `TV: ${answerString(answers, 'tvSetup', 'UNDECIDED')}`,
    }),
  });
})();

export const pieceShoeCabinetFlowV3: RoomFlow = piece3dFlow({
  roomType: 'PIECE_SHOE_CABINET',
  kind: 'SHOE_CABINET',
  derive: () => ({ name: 'Pantofar', systems: [], quantity: 1 }),
});

export const pieceDresserFlowV3: RoomFlow = piece3dFlow({
  roomType: 'PIECE_DRESSER',
  kind: 'DRESSER',
  withSystems: true,
  derive: (_config, answers) => ({
    name: 'Comoda',
    systems: openingSystems(answers),
    quantity: 1,
  }),
});

export const pieceNightstandFlowV3: RoomFlow = (() => {
  const F = 'flows.PIECE_NIGHTSTAND';
  const countStep: QuestionStep = {
    id: 'count',
    type: 'single-choice',
    titleKey: `${F}.count.title`,
    info: { titleKey: `${F}.count.info.title`, bodyKey: `${F}.count.info.body` },
    options: ['ONE', 'TWO'].map((value) => ({
      value,
      labelKey: `${F}.count.options.${value}.label`,
    })),
  };
  return piece3dFlow({
    roomType: 'PIECE_NIGHTSTAND',
    kind: 'NIGHTSTAND',
    extraSteps: [countStep],
    derive: (_config, answers) => {
      const quantity = answerString(answers, 'count', 'TWO') === 'ONE' ? 1 : 2;
      return { name: quantity === 1 ? 'Noptiera' : 'Noptiere', systems: [], quantity };
    },
  });
})();

export const pieceDeskFlowV3: RoomFlow = (() => {
  const F = 'flows.PIECE_DESK';
  const cableStep: QuestionStep = {
    id: 'cableManagement',
    type: 'boolean',
    titleKey: `${F}.cableManagement.title`,
    optional: true,
    info: {
      titleKey: `${F}.cableManagement.info.title`,
      bodyKey: `${F}.cableManagement.info.body`,
    },
  };
  return piece3dFlow({
    roomType: 'PIECE_DESK',
    kind: 'DESK',
    extraSteps: [cableStep],
    derive: (_config, answers) => ({
      name: 'Birou',
      systems: [],
      quantity: 1,
      extraDescription:
        answers.cableManagement === true ? 'Cu management de cabluri' : undefined,
    }),
  });
})();

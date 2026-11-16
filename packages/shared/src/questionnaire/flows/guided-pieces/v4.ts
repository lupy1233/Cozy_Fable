import type { ItemSystem, RoomType } from '../../../enums';
import {
  configHasFronts,
  describePieceConfig,
  isPieceConfig3d,
  PIECE3D_RULES,
  type Piece3dKind,
  type PieceConfig3d,
} from '../../piece3d';
import type {
  AnswerMap,
  BooleanStep,
  Configurator3dStep,
  FirmRecommendation,
  QuestionStep,
  RoomFlow,
  ScoreEntry,
  SingleChoiceStep,
} from '../../types';
import { otherMaterialStep, tvSetupText } from '../common';
import {
  BODY_NOTE,
  FIRM_DECIDES,
  finishDescription,
  frontMaterialSubtitleKey,
  MDF_INTEGRAL,
  materialSetOptions,
  PISTONS_NOTE,
  resolveMaterial,
} from '../finish-sets';
import { answerString, pieceSketchStep } from './builder';
import { snapshot3dStep } from './v3';

// Etapa 6 (DESIGN §5.12) — piesele-corp ghidate v4. Copie a piece3dFlow din v3 (v3 ramane
// INGHETAT), cu trei schimbari:
// - o singura sursa de deschidere: alegerea din 3D (frontStyle, doorMode). Nu mai exista pasul
//   openingSystems (TV, biblioteca, comoda) si nici pasul ascuns doorType (dulap) — c2 pasul 5;
// - materialul = setul BODY (cu "Nu stiu — vreau recomandarea firmei"), pe ecranul `material`;
// - comoda TV: bifa liftUpDoors pe ecranul materialului (pistoane → AVENTOS + nota, N1 / N2).
// Fara "decide firma" la deschidere (N3): lista e chiar configuratorul 3D.

const FINISH = 'common.finish';

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

// Pasul de material v4 (refolosit si de catalog-v2): setul BODY, titlul pe piesa si versiune.
export function finishMaterialStepV4(
  flowKey: string,
  version: number,
  opts: { integralMdf?: boolean } = {},
): SingleChoiceStep {
  return {
    id: 'material',
    type: 'single-choice',
    titleKey: `${flowKey}.v${version}.material.title`,
    subtitleKey: frontMaterialSubtitleKey(opts.integralMdf === true),
    screenGroup: 'material',
    options: materialSetOptions('BODY', opts),
  };
}

// Bifa "unele usi se deschid in sus sau in jos, pe pistoane" (comoda TV, bufet, corp suspendat).
export function liftUpDoorsStep(): BooleanStep {
  return {
    id: 'liftUpDoors',
    type: 'boolean',
    titleKey: `${FINISH}.liftUp.title`,
    subtitleKey: `${FINISH}.liftUp.subtitle`,
    optional: true,
    toggleStyle: 'checkbox',
    cardLabelKey: `${FINISH}.liftUp.cardLabel`,
    screenGroup: 'material',
  };
}

function configOf(answers: AnswerMap): PieceConfig3d | null {
  return isPieceConfig3d(answers.config3d) ? answers.config3d : null;
}

const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined);

// Mâner / push din 3D — doar cand piesa chiar are fronturi (o biblioteca cu toate zonele
// deschise nu primeste sistem, chiar daca frontStyle a ramas setat). frontStyle lipsa → nimic (N3).
export function frontStyleSystemsV4(kind: Piece3dKind, config: PieceConfig3d | null): ItemSystem[] {
  if (!config || !configHasFronts(kind, config)) return [];
  return config.frontStyle === 'HANDLE' ? ['MANER'] : config.frontStyle === 'PUSH' ? ['PUSH'] : [];
}

export interface FinishedPieceItem {
  material: ReturnType<typeof resolveMaterial>['material'];
  systems: ItemSystem[];
  description: string | undefined;
  firmRecommendations: FirmRecommendation[];
}

// Materialul, sistemele si descrierea unei piese 3D v4 (refolosit de catalog-v2).
// - material: resolveMaterial pe setul BODY (lipsa → ALTUL, N15);
// - "Corp: PAL standard" doar cand piesa are fronturi si materialul nu e integral / decis de firma
//   (fara fronturi, materialul ales e al intregii piese);
// - liftUpDoors = true → AVENTOS + nota pistoanelor, doar daca piesa are fronturi in 3D.
export function finishPieceItem(args: {
  kind: Piece3dKind;
  config: PieceConfig3d | null;
  answers: AnswerMap;
  // fluxul are pasul liftUpDoors (altfel raspunsul e ignorat)
  liftUp: boolean;
  itemName: string;
  baseSystems: ItemSystem[];
  baseParts: (string | undefined)[];
}): FinishedPieceItem {
  const { kind, config, answers, itemName } = args;
  const value = str(answers.material);
  const m = resolveMaterial(value, 'BODY', str(answers.materialOther));
  const hasFronts = config ? configHasFronts(kind, config) : false;
  const systems: ItemSystem[] = [...args.baseSystems];
  const notes: string[] = [];
  // pistoanele au sens doar la o piesa cu usi in 3D (revizuire m3): fara fronturi, bifa nu adauga nimic
  if (args.liftUp && answers.liftUpDoors === true && hasFronts) {
    systems.push('AVENTOS');
    notes.push(PISTONS_NOTE);
  }
  const bodyNote =
    hasFronts && value !== undefined && value !== MDF_INTEGRAL && value !== FIRM_DECIDES ? BODY_NOTE : undefined;
  return {
    material: m.material,
    systems: [...new Set(systems)],
    description: finishDescription([...args.baseParts, bodyNote, ...m.notes, ...notes]),
    firmRecommendations: m.firmDecides ? [{ itemName, material: true, opening: false }] : [],
  };
}

interface Piece3dFlowSpecV4 {
  roomType: RoomType;
  kind: Piece3dKind;
  // pasi ortogonali pastrati din v3, intre config3d si material (tvSetup, count, cableManagement)
  extraSteps?: QuestionStep[];
  // bifa pistoanelor pe ecranul materialului (doar comoda TV la piesele ghidate)
  liftUpDoors?: boolean;
  scoreEntries?: (config: PieceConfig3d) => ScoreEntry[];
  derive: (config: PieceConfig3d | null, answers: AnswerMap) => {
    name: string;
    quantity: number;
    extraDescription?: string;
  };
}

function piece3dFlowV4(spec: Piece3dFlowSpecV4): RoomFlow {
  const F = `flows.${spec.roomType}`;
  const rules = PIECE3D_RULES[spec.kind];
  return {
    roomType: spec.roomType,
    version: 4,
    steps: [
      config3dStep(F, spec.kind, spec.scoreEntries),
      ...(spec.extraSteps ?? []),
      finishMaterialStepV4(F, 4),
      otherMaterialStep('material', 'material'),
      ...(spec.liftUpDoors ? [liftUpDoorsStep()] : []),
      pieceSketchStep(F),
      snapshot3dStep(),
    ],
    deriveRoom: (answers) => {
      const config = configOf(answers);
      const item = spec.derive(config, answers);
      // o singura sursa: dulapul glisant din 3D + maner / push din 3D
      const baseSystems: ItemSystem[] = [
        ...(config?.doorMode === 'SLIDING' ? (['GLISANTE'] as ItemSystem[]) : []),
        ...frontStyleSystemsV4(spec.kind, config),
      ];
      const finished = finishPieceItem({
        kind: spec.kind,
        config,
        answers,
        liftUp: spec.liftUpDoors === true,
        itemName: item.name,
        baseSystems,
        baseParts: [config ? describePieceConfig(spec.kind, config) : undefined, item.extraDescription],
      });
      return {
        // lengthM = frontul piesei (metri liniari pentru ROOM_SIZE)
        lengthM: (config?.widthM ?? 0) * item.quantity,
        widthM: config?.depthM ?? rules.depth.default,
        heightM: config?.heightM ?? rules.height.default,
        items: [
          {
            name: item.name,
            material: finished.material,
            systems: finished.systems,
            ...(finished.description ? { description: finished.description } : {}),
            quantity: item.quantity,
          },
        ],
        ...(finished.firmRecommendations.length > 0
          ? { firmRecommendations: finished.firmRecommendations }
          : {}),
      };
    },
  };
}

export const pieceBookcaseFlowV4: RoomFlow = piece3dFlowV4({
  roomType: 'PIECE_BOOKCASE',
  kind: 'BOOKCASE',
  derive: () => ({ name: 'Bibliotecă', quantity: 1 }),
});

// Dulapul: glisant / batant vine DOAR din 3D (config.doorMode); pasul doorType nu mai exista.
// "Pana in tavan" ramane implicat de inaltime (≥ 2,5 m), inclusiv scorul.
export const pieceWardrobeFlowV4: RoomFlow = piece3dFlowV4({
  roomType: 'PIECE_WARDROBE',
  kind: 'WARDROBE',
  scoreEntries: (config) =>
    config.heightM >= 2.5 ? [{ category: 'WARDROBE_TO_CEILING', optionKey: 'YES' }] : [],
  derive: (config) => ({
    name: config && config.heightM >= 2.5 ? 'Dulap până în tavan (tip dressing)' : 'Dulap',
    quantity: 1,
  }),
});

export const pieceTvUnitFlowV4: RoomFlow = (() => {
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
  return piece3dFlowV4({
    roomType: 'PIECE_TV_UNIT',
    kind: 'TV_UNIT',
    extraSteps: [tvSetupStep],
    liftUpDoors: true,
    derive: (_config, answers) => ({
      name: 'Comodă TV',
      quantity: 1,
      extraDescription: tvSetupText(answerString(answers, 'tvSetup', 'UNDECIDED')),
    }),
  });
})();

export const pieceShoeCabinetFlowV4: RoomFlow = piece3dFlowV4({
  roomType: 'PIECE_SHOE_CABINET',
  kind: 'SHOE_CABINET',
  derive: () => ({ name: 'Pantofar', quantity: 1 }),
});

export const pieceDresserFlowV4: RoomFlow = piece3dFlowV4({
  roomType: 'PIECE_DRESSER',
  kind: 'DRESSER',
  derive: () => ({ name: 'Comodă', quantity: 1 }),
});

// `count` pastreaza id-ul din v3 (Studio il ascunde).
export const pieceNightstandFlowV4: RoomFlow = (() => {
  const F = 'flows.PIECE_NIGHTSTAND';
  const countStep: QuestionStep = {
    id: 'count',
    type: 'single-choice',
    titleKey: `${F}.count.title`,
    // c13 (etapa 12): subtitlu (doar afisare; nu schimba ce se salveaza)
    subtitleKey: `${F}.count.subtitle`,
    info: { titleKey: `${F}.count.info.title`, bodyKey: `${F}.count.info.body` },
    options: ['ONE', 'TWO'].map((value) => ({
      value,
      labelKey: `${F}.count.options.${value}.label`,
    })),
  };
  return piece3dFlowV4({
    roomType: 'PIECE_NIGHTSTAND',
    kind: 'NIGHTSTAND',
    extraSteps: [countStep],
    derive: (_config, answers) => {
      const quantity = answerString(answers, 'count', 'TWO') === 'ONE' ? 1 : 2;
      return { name: quantity === 1 ? 'Noptieră' : 'Noptiere', quantity };
    },
  });
})();

export const pieceDeskFlowV4: RoomFlow = (() => {
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
  return piece3dFlowV4({
    roomType: 'PIECE_DESK',
    kind: 'DESK',
    extraSteps: [cableStep],
    derive: (_config, answers) => ({
      name: 'Birou',
      quantity: 1,
      extraDescription: answers.cableManagement === true ? 'Cu canal pentru cabluri' : undefined,
    }),
  });
})();

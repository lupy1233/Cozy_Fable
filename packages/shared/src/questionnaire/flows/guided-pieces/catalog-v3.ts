import type { RoomFlow, ScoreEntry } from '../../types';
import { NEW_PIECE_KINDS, PIECE3D_RULES, pieceConfig3dSchema, describePieceConfig, type PieceConfig3d } from '../../piece3d';
import { FRAME_BY_FIRM_NOTE, finishDescription } from '../finish-sets';
import { pieceSketchStep } from './builder';
import { snapshot3dStep } from './v3';

// Etapa 10 (formularul v7, DESIGN §6 / §7a) — doar canapeaua v3. Copie a buclei din catalog-v2
// (v2 ramane INGHETAT), ramura tapitata: fara pas de material, ALTUL + "Cadru: il alege firma" +
// marcajul "recomandarea firmei". NOU: pasul 3D declara `features` (extensibila, lada) si
// puncteaza configuratia (d3 + c9-3): locuri, sezlong, extensibila, lada.
// Celelalte piese de catalog raman pe v2.
type CatalogRoomType = `PIECE_${(typeof NEW_PIECE_KINDS)[number]}`;

const KEY = 'flows.PIECE_SOFA';

// d3 (a doua parte) + c9-3: un rand pe optiune (ponderile stau in project_sizing_config).
export function sofaScoreEntriesV3(config: PieceConfig3d): ScoreEntry[] {
  const sofa = config.sofa;
  if (!sofa) return [];
  return [
    { category: 'SOFA_SEATS', optionKey: `SEATS_${sofa.seats}` },
    { category: 'SOFA_LAYOUT', optionKey: sofa.layout },
    ...(sofa.sleeper === true ? [{ category: 'SOFA_SLEEPER', optionKey: 'YES' }] : []),
    ...(sofa.storage === true ? [{ category: 'SOFA_STORAGE', optionKey: 'YES' }] : []),
  ];
}

export const pieceSofaFlowV3: RoomFlow = {
  roomType: 'PIECE_SOFA',
  version: 3,
  steps: [
    {
      id: 'config3d',
      type: 'configurator-3d',
      piece: 'SOFA',
      titleKey: `${KEY}.config3d.title`,
      subtitleKey: `${KEY}.config3d.subtitle`,
      scoreEntries: sofaScoreEntriesV3,
      features: ['SOFA_SLEEPER', 'SOFA_STORAGE'],
    },
    pieceSketchStep(KEY),
    snapshot3dStep(),
  ],
  deriveRoom: (answers) => {
    const parsed = pieceConfig3dSchema('SOFA').safeParse(answers.config3d);
    if (!parsed.success) return { lengthM: 0, widthM: 0, heightM: 0, items: [] };
    const config = parsed.data;
    const itemName = PIECE3D_RULES.SOFA.itemName;
    return {
      lengthM: config.widthM,
      widthM: config.depthM,
      heightM: config.heightM,
      items: [{
        name: itemName,
        material: 'ALTUL',
        // canapeaua nu are fronturi (configHasFronts = fals) → fara sisteme, ca la v2
        systems: [],
        quantity: 1,
        description: finishDescription([describePieceConfig('SOFA', config), FRAME_BY_FIRM_NOTE]),
      }],
      firmRecommendations: [{ itemName, material: true, opening: false }],
    };
  },
};

export const catalogFlowRegistryV3: Partial<Record<CatalogRoomType, Record<number, RoomFlow>>> = {
  PIECE_SOFA: { 3: pieceSofaFlowV3 },
};
export const catalogFlowVersionsV3: Partial<Record<CatalogRoomType, number>> = { PIECE_SOFA: 3 };

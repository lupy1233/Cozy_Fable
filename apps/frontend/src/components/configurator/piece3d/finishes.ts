import { CUSTOM_COLOR_RE, type Piece3dFinish, type PieceConfig3d, type Upholstery3d } from '@marketplace/shared';

// Paleta de finisaje a randarii 3D: culoare + rugozitate, fibra procedurala
// fara imagini descarcate. Nuante calde, aliniate la identitatea
// ATELIER; frontul e usor mai deschis decat carcasa ca sa se citeasca volumele.
// T1 (feedback PO): paleta extinsa + CUSTOM cu orice culoare din color picker.

export interface FinishSpec {
  body: string;
  front: string;
  roughness: number;
  grain?: boolean;
  fabric?: string;
  fabricType?: Upholstery3d['fabric'];
  legColor?: string;
}

export const DRAWER_INTERIOR_SPEC: FinishSpec = { body: '#cbbb9d', front: '#cbbb9d', roughness: .72, grain: true };

export const FINISH_SPECS: Record<Piece3dFinish, FinishSpec> = {
  ALB: { body: '#efece4', front: '#f6f3ec', roughness: 0.55 },
  CREM: { body: '#e4d7bd', front: '#ece0c9', roughness: 0.6 },
  STEJAR: { body: '#ac8156', front: '#b88e63', fabric: '#b9ab95', roughness: 0.57, grain: true },
  NUC: { body: '#67432d', front: '#745039', fabric: '#8d7767', roughness: 0.53, grain: true },
  GRI: { body: '#98968f', front: '#a5a39c', roughness: 0.6 },
  NEGRU: { body: '#2e2a26', front: '#3a3531', roughness: 0.55 },
  VERDE_SALVIE: { body: '#8a9c88', front: '#96a894', roughness: 0.65 },
  ALBASTRU: { body: '#42586c', front: '#4d647a', roughness: 0.6 },
  TERACOTA: { body: '#b1663f', front: '#bd734d', roughness: 0.65 },
  // fallback-ul CUSTOM fara culoare aleasa (normalize nu lasa cazul la publish)
  CUSTOM: { body: '#9a938a', front: '#a6a097', roughness: 0.6 },
};

// frontul CUSTOM: corpul amestecat ~10% spre alb, ca la paleta predefinita
function lighten(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const mix = (v: number) => Math.round(v + (255 - v) * amount);
  const r = mix((n >> 16) & 0xff);
  const g = mix((n >> 8) & 0xff);
  const b = mix(n & 0xff);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

// Spec-ul efectiv de randare: finisajele predefinite vin din paleta, CUSTOM
// isi deriva corpul/frontul din culoarea aleasa in picker.
export function finishSpecFor(finish: Piece3dFinish, customColor?: string): FinishSpec {
  if (finish === 'CUSTOM' && customColor && CUSTOM_COLOR_RE.test(customColor)) {
    return { body: customColor, front: lighten(customColor, 0.1), roughness: 0.6 };
  }
  return FINISH_SPECS[finish] ?? FINISH_SPECS.STEJAR;
}

export function finishSpecForConfig(config: PieceConfig3d): FinishSpec {
  const spec = finishSpecFor(config.finish, config.customColor);
  const u = config.upholstery;
  return u ? { ...spec, fabric: u.color, fabricType: u.fabric, legColor: { OAK: '#a77d50', WALNUT: '#654630', BLACK: '#282a2b', PLINTH: '#3c3935' }[u.base] } : spec;
}

// alama pentru bara de haine si manere (accentul design-system)
export const ROD_COLOR = '#b08d57';
// selectia zonelor in 3D: teracota saturata — alama se pierdea pe stejar;
// nuanta contrasteaza cu finisajele si cu fundalul cald al scenei
export const HIGHLIGHT_COLOR = '#e2662e';

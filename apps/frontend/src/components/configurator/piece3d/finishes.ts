import type { Piece3dFinish } from '@marketplace/shared';

// Paleta de finisaje a randarii 3D (R4): culoare + rugozitate, fara texturi
// (docs/10 — nu crestem bundle-ul). Nuante calde, aliniate la identitatea
// ATELIER; frontul e usor mai deschis decat carcasa ca sa se citeasca volumele.

export interface FinishSpec {
  body: string;
  front: string;
  roughness: number;
}

export const FINISH_SPECS: Record<Piece3dFinish, FinishSpec> = {
  ALB: { body: '#efece4', front: '#f6f3ec', roughness: 0.55 },
  STEJAR: { body: '#c49a66', front: '#cfa876', roughness: 0.65 },
  NUC: { body: '#7a5638', front: '#875f40', roughness: 0.6 },
  GRI: { body: '#98968f', front: '#a5a39c', roughness: 0.6 },
  VERDE_SALVIE: { body: '#8a9c88', front: '#96a894', roughness: 0.65 },
};

// alama pentru bara de haine (accentul design-system)
export const ROD_COLOR = '#b08d57';
// selectia zonelor in 3D: teracota saturata — alama se pierdea pe stejar;
// nuanta contrasteaza cu toate cele 5 finisaje si cu fundalul cald al scenei
export const HIGHLIGHT_COLOR = '#e2662e';

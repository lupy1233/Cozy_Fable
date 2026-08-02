// Paletele camerei din Studio 3D — culori plate, calde, aliniate identitatii
// ATELIER (fara texturi, ca finisajele pieselor din piece3d/finishes.ts).

export interface RoomSwatch {
  id: string;
  color: string;
}

export const WALL_COLORS: RoomSwatch[] = [
  { id: 'VAR', color: '#efe9df' },
  { id: 'CREM', color: '#e6dcc6' },
  { id: 'SALVIE', color: '#b3c0af' },
  { id: 'TERACOTA', color: '#c98f6b' },
  { id: 'ALBASTRU', color: '#8fa3b5' },
  { id: 'GRI', color: '#bcb8b0' },
];

export const FLOOR_COLORS: RoomSwatch[] = [
  { id: 'STEJAR', color: '#c29a6e' },
  { id: 'NUC', color: '#8a6544' },
  { id: 'FAG', color: '#d8c096' },
  { id: 'TRAVERTIN', color: '#d9cfbc' },
  { id: 'BETON', color: '#a7a39b' },
];

export function wallColorOf(id: string): string {
  return WALL_COLORS.find((s) => s.id === id)?.color ?? WALL_COLORS[0].color;
}

export function floorColorOf(id: string): string {
  return FLOOR_COLORS.find((s) => s.id === id)?.color ?? FLOOR_COLORS[0].color;
}

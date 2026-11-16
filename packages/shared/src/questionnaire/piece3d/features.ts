import type { PieceConfig3d } from './config';

// Etapa 10 (E10-N1): campurile 3D optionale noi. Schemele (catalog-config / furniture-config) le
// accepta pe toate versiunile, dar motorul (engine.ts, pasul configurator-3d) le primeste DOAR pe
// pasii care le declara in `Configurator3dStep.features` → pe versiunile vechi o configuratie cu
// un camp nou e respinsa (validation.unknownAnswer), ca inainte (cand o respingea `.strict()`).
export const PIECE3D_FEATURES = [
  'SOFA_SLEEPER',
  'SOFA_STORAGE',
  'BED_CUSTOM_SIZE',
  'TABLE_OPEN_LENGTH',
  'TABLE_CUSTOM_HEIGHT',
  'BENCH_CUSTOM_HEIGHT',
] as const;
export type Piece3dFeature = (typeof PIECE3D_FEATURES)[number];

// Campurile noi folosite de o configuratie (in ordinea PIECE3D_FEATURES). Un camp prezent cu
// valoarea `false` (ex. sofa.sleeper: false) conteaza tot ca folosit — pasul vechi nu il cunoaste.
export function piece3dFeaturesUsed(config: PieceConfig3d): Piece3dFeature[] {
  const used: Piece3dFeature[] = [];
  if (config.sofa?.sleeper !== undefined) used.push('SOFA_SLEEPER');
  if (config.sofa?.storage !== undefined) used.push('SOFA_STORAGE');
  if (config.bed?.customSize !== undefined) used.push('BED_CUSTOM_SIZE');
  if (config.table?.openLengthM !== undefined) used.push('TABLE_OPEN_LENGTH');
  if (config.table?.customHeightM !== undefined) used.push('TABLE_CUSTOM_HEIGHT');
  if (config.bench?.customHeightM !== undefined) used.push('BENCH_CUSTOM_HEIGHT');
  return used;
}

import {
  defaultPieceConfig,
  initialPieceConfig,
  isFurnitureKind,
  PIECE3D_FINISHES,
  PIECE3D_RULES,
  pieceConfigTotals,
  type Piece3dFinish,
  type Piece3dKind,
  type PieceConfig3d,
} from '@marketplace/shared';
import { formatDecimal } from '@/lib/decimal';
import { formatDimension, toUnit } from '@/lib/dimension-format';
import { FINISH_SPECS } from './finishes';

// Chips-urile localizate ale unui config 3D — partajate de RoomAnswerSummary
// (Review) si RoomSpecCard (detaliu client + marketplace firma): R4 —
// "firma vede poza corpului + «4 coloane · 2 usi · 12 polite»".
// Etapa 8 (d2): deschiderea apare mereu la piesele cu fronturi (lipsa = Push) si niciodata
// fara fronturi; baza (soclu / picioare) mereu unde piesa o are; etichete pe valori
// ("Saltea: …", "Depozitare: …", "Persoane: …"); culoarea libera = nume aproximativ + mostra.
// Dimensiunile in cm (3D-ul si firma vad mereu cm, D2b), dupa limba cand e data.

type Translate = (key: string, values?: Record<string, string | number>) => string;

export interface Config3dChipItem {
  text: string;
  // culoarea mostrei (hex) — pentru finisaj / culoarea tapiteriei
  swatch?: string;
}

const hexRgb = (hex: string): [number, number, number] | null => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
};

// Cel mai apropiat finisaj din paleta (distanta RGB) pentru o culoare libera.
export function approxColorKey(hex: string): Exclude<Piece3dFinish, 'CUSTOM'> | null {
  const rgb = hexRgb(hex);
  if (!rgb) return null;
  let best: Exclude<Piece3dFinish, 'CUSTOM'> | null = null;
  let bestD = Infinity;
  for (const finish of PIECE3D_FINISHES) {
    if (finish === 'CUSTOM') continue;
    const c = hexRgb(FINISH_SPECS[finish].body)!;
    const d = (c[0] - rgb[0]) ** 2 + (c[1] - rgb[1]) ** 2 + (c[2] - rgb[2]) ** 2;
    if (d < bestD) {
      bestD = d;
      best = finish;
    }
  }
  return best;
}

const lowerFirst = (s: string) => (s ? s.charAt(0).toLowerCase() + s.slice(1) : s);

// fronturi de corp (usi / sertare in zone, usi glisante) — deschiderea din 3D se aplica doar lor
const cabinetHasFronts = (config: PieceConfig3d) =>
  config.doorMode === 'SLIDING' ||
  config.columns.some((c) => c.zones.some((z) => z.type === 'DOOR' || z.type === 'DRAWERS' || z.type === 'TILT_OUT'));

export function config3dChipItems(
  t: Translate,
  config: PieceConfig3d,
  kind?: Piece3dKind,
  // fara limba: cm intregi (ca inainte); cu limba: cm cu o zecimala, virgula in ro
  locale?: string,
): Config3dChipItem[] {
  const totals = pieceConfigTotals(config);
  const num = (m: number) => (locale ? formatDecimal(toUnit(m, 'cm'), locale, 1) : String(Math.round(m * 100)));
  const dim = (m: number) => (locale ? formatDimension(m, { unit: 'cm', locale }) : `${Math.round(m * 100)} cm`);
  const items: Config3dChipItem[] = [];
  const push = (text: string, swatch?: string) => items.push(swatch ? { text, swatch } : { text });
  const colorChip = (hex: string) => {
    const key = approxColorKey(hex);
    push(key ? t('config3d.chips.colorApprox', { color: lowerFirst(t(`config3d.finishes.${key}`)) }) : hex, hex);
  };

  push(t('config3d.chips.size', { w: num(config.widthM), h: num(config.heightM), d: num(config.depthM) }));
  if (config.columns.length) push(t('config3d.chips.columns', { count: totals.columns }));
  const option = (key: string, value: string | number) =>
    push(`${t(`config3d.catalog.${key}`)}: ${typeof value === 'number' ? value : t(`config3d.catalog.options.${value}`)}`);
  if (config.upholstery) {
    option('fabric', config.upholstery.fabric);
    colorChip(config.upholstery.color);
    option('firmness', config.upholstery.firmness);
    option('base', config.upholstery.base);
  }
  if (config.sofa) { option('seats', config.sofa.seats); option('layout', config.sofa.layout); option('arms', config.sofa.arms); option('cushions', config.sofa.cushions); }
  if (config.armchair) option('arms', config.armchair.arms);
  if (config.sofa) push(`${t('config3d.catalog.bodyDepth')}: ${dim(config.sofa.bodyDepthM)}`);
  // etapa 10: canapeaua extensibila / cu lada (doar cand e aleasa; configuratiile vechi neschimbate)
  if (config.sofa?.sleeper) push(t('config3d.chips.sofaSleeper'));
  if (config.sofa?.storage) push(t('config3d.chips.sofaStorage'));
  if (config.ottoman) { option('shape', config.ottoman.shape); if (config.ottoman.storage) push(t('config3d.catalog.storage')); }
  if (config.vanity) { option('mounting', config.vanity.mounting); option('basins', config.vanity.basins); option('storageLayout', config.vanity.storage); option('countertop', config.vanity.countertop); if (config.vanity.storage !== 'OPEN') option('handles', config.vanity.handles); }
  if (config.entryway) { option('hooks', config.entryway.hooks); option('mirror', config.entryway.mirror); option('shoeStorage', config.entryway.shoeStorage); if (config.entryway.upperShelf) push(t('config3d.catalog.upperShelf')); if (config.entryway.upholsteredSeat) push(t('config3d.catalog.upholsteredSeat')); }
  if (config.mountingHeightM !== undefined) push(`${t('config3d.catalog.mountingHeight')}: ${dim(config.mountingHeightM)}`);
  if (config.bed) {
    // etapa 10: "Altă mărime" inlocuieste salteaua standard
    const custom = config.bed.customSize;
    if (custom) {
      const w = locale ? formatDimension(custom.widthM, { unit: 'cm', locale }) : `${Math.round(custom.widthM * 100)} cm`;
      const l = locale ? formatDimension(custom.lengthM, { unit: 'cm', locale }) : `${Math.round(custom.lengthM * 100)} cm`;
      push(t('config3d.chips.mattressCustom', { w: w.replace(/ cm$/, ''), l }));
    } else push(t('config3d.chips.mattress', { size: t(`flows.PIECE_BED.bedSize.options.${config.bed.mattressSize}.label`) }));
    push(t('config3d.chips.storage', { value: lowerFirst(t(`flows.PIECE_BED.storage.options.${config.bed.storage}.label`)) }));
    if (config.bed.upholstered) push(t('config3d.furniture.upholstered'));
  }
  if (config.table) {
    push(t(`flows.PIECE_TABLE.tableType.options.${config.table.type}.label`));
    push(t(`flows.PIECE_TABLE.shape.options.${config.table.shape}.label`));
    if (config.table.seats) push(t('config3d.chips.seats', { value: t(`flows.PIECE_TABLE.seats.options.${config.table.seats}.label`) }));
    // etapa 10: lungimea deschisa (inaltimea aleasa apare deja in chip-ul de dimensiuni)
    if (config.table.openLengthM !== undefined) push(t('config3d.chips.openLength', { value: dim(config.table.openLengthM) }));
  }
  if (config.bench) {
    push(t(`flows.PIECE_BENCH.style.options.${config.bench.style}.label`));
    if (config.bench.upholsteredSeat) push(t('config3d.furniture.upholsteredSeat'));
  }
  if (totals.hanging > 0) push(t('config3d.chips.hanging', { count: totals.hanging }));
  if (totals.shelves > 0) push(t('config3d.chips.shelves', { count: totals.shelves }));
  if (totals.drawers > 0) push(t('config3d.chips.drawers', { count: totals.drawers }));
  if (totals.tiltOut > 0) push(t('config3d.chips.tiltOut', { count: totals.tiltOut }));
  if (totals.doors > 0) push(t('config3d.chips.doors', { count: totals.doors }));
  if (totals.open > 0) push(t('config3d.chips.open', { count: totals.open }));
  if (config.doorMode === 'SLIDING') push(t('config3d.chips.sliding'));
  // baza: mereu la piesele care au soclu sau pot sta pe picioare; fara tipul piesei, doar picioarele
  const rules = kind ? PIECE3D_RULES[kind] : undefined;
  if (config.legs) push(t('config3d.chips.baseLegs'));
  else if (rules && (rules.hasPlinth || rules.legsOption)) push(t('config3d.chips.basePlinth'));
  // deschiderea: doar la corpurile cu fronturi; lipsa = Push (cererile publicate inainte de etapa 8)
  if (!(kind && isFurnitureKind(kind)) && cabinetHasFronts(config)) {
    push(t(config.frontStyle === 'HANDLE' ? 'config3d.chips.openingHandle' : 'config3d.chips.openingPush'));
  }
  if (!config.upholstery) {
    if (config.finish === 'CUSTOM' && config.customColor) colorChip(config.customColor);
    else push(t('config3d.chips.finish', { finish: t(`config3d.finishes.${config.finish}`) }), FINISH_SPECS[config.finish]?.body);
  }
  return items;
}

// Textele simple (apelantii vechi: Fisa cererii, fisa firmei, vizualizatorul)
export function config3dChips(t: Translate, config: PieceConfig3d, kind?: Piece3dKind, locale?: string): string[] {
  return config3dChipItems(t, config, kind, locale).map((i) => i.text);
}

// Etapa 8 (d2-1, D3): latimea, inaltimea si adancimea sunt exact cele de pornire (ale piesei
// noi din etapa 8 SAU ale implicitului vechi) → firma vede "Dimensiuni orientative".
export function config3dDimsUntouched(kind: Piece3dKind, config: PieceConfig3d): boolean {
  const same = (a: number, b: number) => Math.abs(a - b) < 1e-6;
  return [initialPieceConfig(kind), defaultPieceConfig(kind)].some(
    (start) => same(start.widthM, config.widthM) && same(start.heightM, config.heightM) && same(start.depthM, config.depthM),
  );
}

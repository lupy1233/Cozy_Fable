import { pieceConfigTotals, type PieceConfig3d } from '@marketplace/shared';

// Chips-urile localizate ale unui config 3D — partajate de RoomAnswerSummary
// (Review) si RoomSpecCard (detaliu client + marketplace firma): R4 —
// "firma vede poza corpului + «4 coloane · 2 usi · 12 polite»".

type Translate = (key: string, values?: Record<string, string | number>) => string;

export function config3dChips(t: Translate, config: PieceConfig3d): string[] {
  const totals = pieceConfigTotals(config);
  const cm = (v: number) => Math.round(v * 100);
  const chips = [
    t('config3d.chips.size', {
      w: cm(config.widthM),
      h: cm(config.heightM),
      d: cm(config.depthM),
    }),
  ];
  if (config.columns.length) chips.push(t('config3d.chips.columns', { count: totals.columns }));
  const option = (key: string, value: string | number) => chips.push(`${t(`config3d.catalog.${key}`)}: ${typeof value === 'number' ? value : t(`config3d.catalog.options.${value}`)}`);
  if (config.upholstery) {
    option('fabric', config.upholstery.fabric);
    chips.push(config.upholstery.color);
    option('firmness', config.upholstery.firmness);
    option('base', config.upholstery.base);
  }
  if (config.sofa) { option('seats', config.sofa.seats); option('layout', config.sofa.layout); option('arms', config.sofa.arms); option('cushions', config.sofa.cushions); }
  if (config.armchair) option('arms', config.armchair.arms);
  if (config.sofa) chips.push(`${t('config3d.catalog.bodyDepth')}: ${cm(config.sofa.bodyDepthM)} cm`);
  if (config.ottoman) { option('shape', config.ottoman.shape); if (config.ottoman.storage) chips.push(t('config3d.catalog.storage')); }
  if (config.vanity) { option('mounting', config.vanity.mounting); option('basins', config.vanity.basins); option('storageLayout', config.vanity.storage); option('countertop', config.vanity.countertop); if (config.vanity.storage !== 'OPEN') option('handles', config.vanity.handles); }
  if (config.entryway) { option('hooks', config.entryway.hooks); option('mirror', config.entryway.mirror); option('shoeStorage', config.entryway.shoeStorage); if (config.entryway.upperShelf) chips.push(t('config3d.catalog.upperShelf')); if (config.entryway.upholsteredSeat) chips.push(t('config3d.catalog.upholsteredSeat')); }
  if (config.mountingHeightM !== undefined) chips.push(`${t('config3d.catalog.mountingHeight')}: ${cm(config.mountingHeightM)} cm`);
  if (config.bed) {
    chips.push(t(`flows.PIECE_BED.bedSize.options.${config.bed.mattressSize}.label`));
    chips.push(t(`flows.PIECE_BED.storage.options.${config.bed.storage}.label`));
    if (config.bed.upholstered) chips.push(t('config3d.furniture.upholstered'));
  }
  if (config.table) {
    chips.push(t(`flows.PIECE_TABLE.tableType.options.${config.table.type}.label`));
    chips.push(t(`flows.PIECE_TABLE.shape.options.${config.table.shape}.label`));
    if (config.table.seats) chips.push(t(`flows.PIECE_TABLE.seats.options.${config.table.seats}.label`));
  }
  if (config.bench) {
    chips.push(t(`flows.PIECE_BENCH.style.options.${config.bench.style}.label`));
    if (config.bench.upholsteredSeat) chips.push(t('config3d.furniture.upholsteredSeat'));
  }
  if (totals.hanging > 0) chips.push(t('config3d.chips.hanging', { count: totals.hanging }));
  if (totals.shelves > 0) chips.push(t('config3d.chips.shelves', { count: totals.shelves }));
  if (totals.drawers > 0) chips.push(t('config3d.chips.drawers', { count: totals.drawers }));
  if (totals.tiltOut > 0) chips.push(t('config3d.chips.tiltOut', { count: totals.tiltOut }));
  if (totals.doors > 0) chips.push(t('config3d.chips.doors', { count: totals.doors }));
  if (totals.open > 0) chips.push(t('config3d.chips.open', { count: totals.open }));
  // T1: starile ne-implicite devin chips (glisant, picioare, manere)
  if (config.doorMode === 'SLIDING') chips.push(t('config3d.chips.sliding'));
  if (config.legs) chips.push(t('config3d.chips.legs'));
  if (config.frontStyle === 'HANDLE') chips.push(t('config3d.chips.handles'));
  const finishLabel = t(`config3d.finishes.${config.finish}`);
  if (!config.upholstery) chips.push(
    t('config3d.chips.finish', {
      finish:
        config.finish === 'CUSTOM' && config.customColor
          ? `${finishLabel} (${config.customColor})`
          : finishLabel,
    }),
  );
  return chips;
}

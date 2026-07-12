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
    t('config3d.chips.columns', { count: totals.columns }),
  ];
  if (totals.hanging > 0) chips.push(t('config3d.chips.hanging', { count: totals.hanging }));
  if (totals.shelves > 0) chips.push(t('config3d.chips.shelves', { count: totals.shelves }));
  if (totals.drawers > 0) chips.push(t('config3d.chips.drawers', { count: totals.drawers }));
  if (totals.tiltOut > 0) chips.push(t('config3d.chips.tiltOut', { count: totals.tiltOut }));
  if (totals.doors > 0) chips.push(t('config3d.chips.doors', { count: totals.doors }));
  if (totals.open > 0) chips.push(t('config3d.chips.open', { count: totals.open }));
  chips.push(t('config3d.chips.finish', { finish: t(`config3d.finishes.${config.finish}`) }));
  return chips;
}

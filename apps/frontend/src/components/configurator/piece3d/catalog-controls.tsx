'use client';
import { useTranslations } from 'next-intl';
import { NEW_PIECE_RULES, UPHOLSTERY_FABRICS, SEAT_FIRMNESSES, SEATING_BASES, SOFA_LAYOUTS, type Piece3dFeature, type Piece3dKind, type PieceConfig3d, type Sofa3d } from '@marketplace/shared';
import { Select } from '@/components/ui/select';
import { PieceDimensionControl } from './dimension-control';

// 41.4: fostul CatalogSize — acum componenta unica de dimensiune (dimension-control.tsx)
function CatalogSize({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (n: number) => void }) {
  return <PieceDimensionControl label={label} valueM={value} minM={min} maxM={max} onValueM={onChange} />;
}

// etapa 10: comutatoarele canapelei — bifat = true, debifat = cheia scoasa (lipsa = "nu", ca azi)
function sofaFlag(sofa: Sofa3d, key: 'sleeper' | 'storage', on: boolean): Sofa3d {
  const next = { ...sofa };
  if (on) next[key] = true;
  else delete next[key];
  return next;
}

export function CatalogControls({ kind, config, apply, features }: {
  kind: Piece3dKind;
  config: PieceConfig3d;
  apply: (patch: Partial<PieceConfig3d>) => void;
  // etapa 10: campurile noi declarate de pas (Configurator3dStep.features); lipsa = niciunul
  features?: readonly Piece3dFeature[];
}) {
  const has = (f: Piece3dFeature) => features?.includes(f) === true;
  const t = useTranslations('Configurator');
  const label = (key: string) => t(`config3d.catalog.${key}`);
  const choice = (key: string, value: string | number, options: readonly (string | number)[], set: (v: string) => void) =>
    <label className="grid gap-1 text-sm font-medium">{label(key)}<Select className="min-h-11" value={value} onChange={e => set(e.target.value)}>
      {options.map(v => <option key={v} value={v}>{typeof v === 'number' ? v : label(`options.${v}`)}</option>)}
    </Select></label>;
  const toggle = (key: string, value: boolean, set: (v: boolean) => void) => <label className="flex min-h-11 items-center gap-3 rounded-lg border border-border-2 p-3 text-sm">
    <input type="checkbox" className="h-5 w-5 accent-walnut" checked={value} onChange={e => set(e.target.checked)} />{label(key)}</label>;
  const r = NEW_PIECE_RULES[kind as keyof typeof NEW_PIECE_RULES];
  const { sofa, armchair, ottoman, vanity, entryway, upholstery: u } = config;
  return <>
    {kind !== 'WALL_CABINET' && kind !== 'SIDEBOARD' && r && <>
      <CatalogSize label={t('config3d.width')} value={config.widthM} min={vanity?.basins === 'DOUBLE' ? 1.2 : armchair ? (armchair.arms === 'WIDE' ? 0.94 : 0.74) : sofa ? Math.max(r.width.min, sofa.seats * 0.5 + (sofa.arms === 'WIDE' ? 0.44 : 0.24)) : r.width.min} max={r.width.max} onChange={widthM => apply({ widthM })} />
      <CatalogSize label={t('config3d.height')} value={config.heightM} min={vanity?.mounting === 'FLOOR' ? 0.8 : r.height.min} max={r.height.max} onChange={heightM => apply({ heightM })} />
      {!sofa && ottoman?.shape !== 'ROUND' && <CatalogSize label={t('config3d.depth')} value={config.depthM} min={r.depth.min} max={r.depth.max} onChange={depthM => apply({ depthM })} />}
    </>}
    {sofa && <>
      {choice('seats', sofa.seats, [2, 3, 4], v => apply({ sofa: { ...sofa, seats: Number(v) } }))}
      {choice('layout', sofa.layout, SOFA_LAYOUTS, v => apply({ sofa: { ...sofa, layout: v as typeof sofa.layout } }))}
      <p className="text-xs text-muted-foreground">{label('chaiseOrientation')}</p>
      <CatalogSize label={label('bodyDepth')} value={sofa.bodyDepthM} min={0.8} max={1.15} onChange={bodyDepthM => apply({ sofa: { ...sofa, bodyDepthM } })} />
      {sofa.layout !== 'STRAIGHT' && <CatalogSize label={label('chaiseDepth')} value={sofa.chaiseDepthM} min={1.35} max={2} onChange={chaiseDepthM => apply({ sofa: { ...sofa, chaiseDepthM } })} />}
      {choice('arms', sofa.arms, ['SLIM', 'WIDE'], v => apply({ sofa: { ...sofa, arms: v as typeof sofa.arms } }))}
      {sofa.layout === 'STRAIGHT' && choice('cushions', sofa.cushions, ['SPLIT', 'BENCH'], v => apply({ sofa: { ...sofa, cushions: v as typeof sofa.cushions } }))}
      {has('SOFA_SLEEPER') && toggle('sleeper', sofa.sleeper === true, on => apply({ sofa: sofaFlag(sofa, 'sleeper', on) }))}
      {has('SOFA_STORAGE') && toggle('sofaStorage', sofa.storage === true, on => apply({ sofa: sofaFlag(sofa, 'storage', on) }))}
    </>}
    {armchair && choice('arms', armchair.arms, ['SLIM', 'WIDE'], v => apply({ armchair: { arms: v as typeof armchair.arms } }))}
    {ottoman && <>
      {choice('shape', ottoman.shape, ['RECTANGULAR', 'ROUND'], v => apply({ ottoman: { ...ottoman, shape: v as typeof ottoman.shape } }))}
      {toggle('storage', ottoman.storage, storage => apply({ ottoman: { ...ottoman, storage } }))}
    </>}
    {vanity && <>
      {choice('mounting', vanity.mounting, ['WALL', 'FLOOR'], v => apply({ vanity: { ...vanity, mounting: v as typeof vanity.mounting } }))}
      {choice('basins', vanity.basins, ['SINGLE', 'DOUBLE'], v => apply({ vanity: { ...vanity, basins: v as typeof vanity.basins } }))}
      {choice('storageLayout', vanity.storage, ['DRAWERS', 'DOORS', 'OPEN'], v => apply({ vanity: { ...vanity, storage: v as typeof vanity.storage } }))}
      {vanity.storage !== 'OPEN' && choice('handles', vanity.handles, ['PUSH', 'HANDLE'], v => apply({ vanity: { ...vanity, handles: v as typeof vanity.handles } }))}
      {choice('countertop', vanity.countertop, ['LIGHT', 'DARK'], v => apply({ vanity: { ...vanity, countertop: v as typeof vanity.countertop } }))}
      <p className="text-xs text-muted-foreground">{label('plumbingNote')}</p>
    </>}
    {config.mountingHeightM !== undefined && <CatalogSize label={label('mountingHeight')} value={config.mountingHeightM} min={kind === 'WALL_CABINET' ? 0.3 : 0.1} max={kind === 'WALL_CABINET' ? 2.2 : 0.6} onChange={mountingHeightM => apply({ mountingHeightM })} />}
    {entryway && <>
      {choice('hooks', entryway.hooks, [2, 3, 4, 5, 6], v => apply({ entryway: { ...entryway, hooks: Number(v) } }))}
      {choice('mirror', entryway.mirror, ['NONE', 'LEFT', 'RIGHT'], v => apply({ entryway: { ...entryway, mirror: v as typeof entryway.mirror } }))}
      {toggle('upperShelf', entryway.upperShelf, upperShelf => apply({ entryway: { ...entryway, upperShelf } }))}
      {toggle('upholsteredSeat', entryway.upholsteredSeat, upholsteredSeat => apply({ entryway: { ...entryway, upholsteredSeat } }))}
      {choice('shoeStorage', entryway.shoeStorage, ['OPEN', 'DOORS'], v => apply({ entryway: { ...entryway, shoeStorage: v as typeof entryway.shoeStorage } }))}
    </>}
    {u && <>
      {choice('fabric', u.fabric, UPHOLSTERY_FABRICS, v => apply({ upholstery: { ...u, fabric: v as typeof u.fabric } }))}
      <label className="flex min-h-11 items-center justify-between text-sm font-medium">{label('color')}<input type="color" className="h-11 w-16" value={u.color} onChange={e => apply({ upholstery: { ...u, color: e.target.value } })} /></label>
      {choice('firmness', u.firmness, SEAT_FIRMNESSES, v => apply({ upholstery: { ...u, firmness: v as typeof u.firmness } }))}
      {choice('base', u.base, SEATING_BASES, v => apply({ upholstery: { ...u, base: v as typeof u.base } }))}
      <p className="text-xs text-muted-foreground">{label('fabricNote')}</p>
    </>}
  </>;
}

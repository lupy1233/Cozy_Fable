import { fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import {
  defaultPieceConfig,
  normalizePieceConfig,
  pieceConfig3dSchema,
  type Piece3dFeature,
  type Piece3dKind,
  type PieceConfig3d,
} from '@marketplace/shared';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ro from '@/messages/ro.json';
import en from '@/messages/en.json';
import { FurnitureControls } from './furniture-controls';
import { config3dChips } from './config-chips';

vi.mock('./piece-canvas', () => ({ PieceCanvas: () => null }));
const edit = vi.hoisted(() => ({ on: false }));
vi.mock('@/stores/configurator-store', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/stores/configurator-store')>()),
  isInEditSession: () => edit.on,
}));

// Etapa 10 (DESIGN §4.3 / §6): comenzile noi ale pieselor 3D apar DOAR cand pasul declara campul
// in `features` (versiunile noi); pe versiunile vechi (fara features) nu apar.
const onChange = vi.fn();
const last = () => onChange.mock.calls.at(-1)?.[0] as PieceConfig3d;
const c3 = ro.Configurator.config3d;

function Harness({ piece, initial, features }: { piece: Piece3dKind; initial: PieceConfig3d; features?: readonly Piece3dFeature[] }) {
  const [value, setValue] = useState<PieceConfig3d>(initial);
  return <FurnitureControls piece={piece} value={value} features={features} onChange={(v) => { onChange(v); setValue(v); }} />;
}

function setup(piece: Piece3dKind, features?: readonly Piece3dFeature[], patch: Partial<PieceConfig3d> = {}, locale: 'ro' | 'en' = 'ro') {
  const initial = normalizePieceConfig(piece, { ...defaultPieceConfig(piece), ...patch });
  return render(
    <NextIntlClientProvider locale={locale} messages={locale === 'ro' ? ro : en}>
      <Harness piece={piece} initial={initial} features={features} />
    </NextIntlClientProvider>,
  );
}

const valid = (piece: Piece3dKind, c: PieceConfig3d) => pieceConfig3dSchema(piece).safeParse(c).success;

describe('etapa 10 — comenzile noi doar cu features', () => {
  beforeEach(() => {
    onChange.mockClear();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  });

  it('canapea: comutatoarele „Extensibilă” / „Ladă” lipsesc fara features si scriu sleeper / storage cu features', () => {
    const { unmount } = setup('SOFA');
    expect(screen.queryByRole('checkbox', { name: c3.catalog.sleeper })).toBeNull();
    expect(screen.queryByRole('checkbox', { name: c3.catalog.sofaStorage })).toBeNull();
    unmount();
    setup('SOFA', ['SOFA_SLEEPER', 'SOFA_STORAGE']);
    fireEvent.click(screen.getByRole('checkbox', { name: c3.catalog.sleeper }));
    expect(last().sofa?.sleeper).toBe(true);
    fireEvent.click(screen.getByRole('checkbox', { name: c3.catalog.sofaStorage }));
    expect(last().sofa?.storage).toBe(true);
    expect(valid('SOFA', last())).toBe(true);
    // debifat → cheia dispare (lipsa = "nu", ca azi)
    fireEvent.click(screen.getByRole('checkbox', { name: c3.catalog.sleeper }));
    expect(last().sofa && 'sleeper' in last().sofa!).toBe(false);
  });

  it('pat: „Altă mărime” doar cu BED_CUSTOM_SIZE; porneste de la 120 × 200, schimba gabaritul; o marime standard o sterge', () => {
    const { unmount } = setup('BED');
    const sizes = () => [...(screen.getByRole('combobox', { name: ro.Configurator.flows.PIECE_BED.bedSize.title }) as HTMLSelectElement).options].map((o) => o.value);
    expect(sizes()).toEqual(['S_90', 'M_140', 'Q_160', 'K_180']);
    unmount();
    setup('BED', ['BED_CUSTOM_SIZE']);
    expect(sizes()).toEqual(['S_90', 'M_140', 'Q_160', 'K_180', 'CUSTOM']);
    const select = screen.getByRole('combobox', { name: ro.Configurator.flows.PIECE_BED.bedSize.title });
    fireEvent.change(select, { target: { value: 'CUSTOM' } });
    expect(last().bed?.customSize).toEqual({ widthM: 1.2, lengthM: 2 });
    expect(last().depthM).toBeCloseTo(2.2, 6);
    expect(valid('BED', last())).toBe(true);
    const length = screen.getByRole('textbox', { name: c3.furniture.mattressLength });
    fireEvent.change(length, { target: { value: '190' } });
    fireEvent.blur(length);
    expect(last().bed?.customSize?.lengthM).toBeCloseTo(1.9, 6);
    expect(last().depthM).toBeCloseTo(2.1, 6);
    expect(valid('BED', last())).toBe(true);
    fireEvent.change(select, { target: { value: 'M_140' } });
    expect(last().bed?.customSize).toBeUndefined();
    expect(last().bed?.mattressSize).toBe('M_140');
  });

  it('masa: „Lungime deschisă” doar la extensibila si doar cu TABLE_OPEN_LENGTH; inaltimea doar cu TABLE_CUSTOM_HEIGHT', () => {
    const ext = { widthM: 1.6, depthM: 0.9, table: { type: 'DINING' as const, shape: 'EXTENDABLE' as const, seats: 'SIX' as const } };
    const { unmount } = setup('TABLE', undefined, ext);
    expect(screen.queryByRole('checkbox', { name: c3.furniture.openLengthToggle })).toBeNull();
    expect(screen.queryByText(/Vreau altă înălțime/)).toBeNull();
    unmount();
    setup('TABLE', ['TABLE_OPEN_LENGTH', 'TABLE_CUSTOM_HEIGHT'], ext);
    fireEvent.click(screen.getByRole('checkbox', { name: c3.furniture.openLengthToggle }));
    expect(last().table?.openLengthM).toBeCloseTo(2.2, 6);
    expect(valid('TABLE', last())).toBe(true);
    // indiciul de inaltime in cm, prin formatatorul etapei 8
    const height = screen.getByRole('checkbox', { name: 'Vreau altă înălțime (de obicei 75 cm)' });
    fireEvent.click(height);
    expect(last().table?.customHeightM).toBe(0.75);
    expect(valid('TABLE', last())).toBe(true);
    // fara extensibila, campul lungimii deschise dispare si valoarea se sterge
    fireEvent.click(screen.getByRole('checkbox', { name: ro.Configurator.flows.PIECE_TABLE.shape.options.EXTENDABLE.label }));
    expect(last().table?.openLengthM).toBeUndefined();
    expect(screen.queryByRole('checkbox', { name: c3.furniture.openLengthToggle })).toBeNull();
  });

  it('bancuta: inaltimea doar cu BENCH_CUSTOM_HEIGHT (EN)', () => {
    const { unmount } = setup('BENCH', undefined, {}, 'en');
    expect(screen.queryByText(/different height/)).toBeNull();
    unmount();
    setup('BENCH', ['BENCH_CUSTOM_HEIGHT'], {}, 'en');
    fireEvent.click(screen.getByRole('checkbox', { name: 'I want a different height (usually 45 cm)' }));
    expect(last().bench?.customHeightM).toBe(0.45);
    expect(valid('BENCH', last())).toBe(true);
  });
});

describe('etapa 10 — dupa revizuire (m1, m2, sesiunea de editare, canapeaua)', () => {
  const TABLE_FEATURES = ['TABLE_OPEN_LENGTH', 'TABLE_CUSTOM_HEIGHT'] as const;
  const f = ro.Configurator.flows.PIECE_TABLE;
  const ext = { widthM: 1.6, depthM: 0.9, table: { type: 'DINING' as const, shape: 'EXTENDABLE' as const, seats: 'SIX' as const } };
  const typeSelect = () => screen.getByRole('combobox', { name: f.tableType.title });
  const shapeSelect = () => screen.getByRole('combobox', { name: f.shape.title });
  const openToggle = () => screen.queryByRole('checkbox', { name: c3.furniture.openLengthToggle });

  beforeEach(() => {
    onChange.mockClear();
    edit.on = false;
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  });

  it('m1: dining 75 → consola: inaltimea aleasa se sterge, bifa se debifeaza, indiciul e cel al consolei', () => {
    setup('TABLE', TABLE_FEATURES, { widthM: 1.6, depthM: 0.9 });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Vreau altă înălțime (de obicei 75 cm)' }));
    expect(last().table?.customHeightM).toBe(0.75);
    fireEvent.change(typeSelect(), { target: { value: 'CONSOLE' } });
    expect(last().table?.type).toBe('CONSOLE');
    expect(last().table?.customHeightM).toBeUndefined();
    expect(last().heightM).toBe(0.8);
    const box = screen.getByRole('checkbox', { name: 'Vreau altă înălțime (de obicei 80 cm)' });
    expect(box).not.toBeChecked();
    expect(valid('TABLE', last())).toBe(true);
  });

  it('m2: lungimea deschisa se tine minte la Dining → Cafea → Dining si la Dreptunghi → Rotund → Dreptunghi', () => {
    setup('TABLE', TABLE_FEATURES, ext);
    fireEvent.click(openToggle()!);
    const chosen = last().table?.openLengthM;
    expect(chosen).toBeCloseTo(2.2, 6);
    fireEvent.change(typeSelect(), { target: { value: 'COFFEE' } });
    expect(last().table?.openLengthM).toBeUndefined();
    fireEvent.change(typeSelect(), { target: { value: 'DINING' } });
    expect(last().table?.shape).toBe('EXTENDABLE');
    expect(last().table?.openLengthM).toBeCloseTo(2.2, 6);
    expect(openToggle()).toBeChecked();
    fireEvent.change(shapeSelect(), { target: { value: 'ROUND' } });
    expect(last().table?.openLengthM).toBeUndefined();
    fireEvent.change(shapeSelect(), { target: { value: 'RECTANGULAR' } });
    expect(last().table?.shape).toBe('EXTENDABLE');
    expect(last().table?.openLengthM).toBeCloseTo(2.2, 6);
    expect(valid('TABLE', last())).toBe(true);
  });

  it('m2: debifarea „Extensibilă” sterge lungimea deschisa (nu se salveaza), rebifarea o aduce inapoi', () => {
    setup('TABLE', TABLE_FEATURES, ext);
    fireEvent.click(openToggle()!);
    const extendable = () => screen.getByRole('checkbox', { name: f.shape.options.EXTENDABLE.label });
    fireEvent.click(extendable());
    expect(last().table?.shape).toBe('RECTANGULAR');
    expect(last().table?.openLengthM).toBeUndefined();
    expect(openToggle()).toBeNull();
    fireEvent.click(extendable());
    expect(last().table?.openLengthM).toBeCloseTo(2.2, 6);
  });

  it('m2: dupa ce omul scoate lungimea deschisa, ea nu mai revine la ocol', () => {
    setup('TABLE', TABLE_FEATURES, ext);
    fireEvent.click(openToggle()!);
    fireEvent.click(openToggle()!);
    expect(last().table?.openLengthM).toBeUndefined();
    fireEvent.change(typeSelect(), { target: { value: 'COFFEE' } });
    fireEvent.change(typeSelect(), { target: { value: 'DINING' } });
    expect(last().table?.shape).toBe('EXTENDABLE');
    expect(last().table?.openLengthM).toBeUndefined();
    expect(openToggle()).not.toBeChecked();
  });

  it('sesiune de editare: masa v5 si patul „Altă mărime” publicate nu se rescriu la deschidere', () => {
    edit.on = true;
    const { unmount } = setup('TABLE', TABLE_FEATURES, { ...ext, table: { ...ext.table, openLengthM: 2.4, customHeightM: 0.72 } });
    expect(onChange).not.toHaveBeenCalled();
    unmount();
    setup('BED', ['BED_CUSTOM_SIZE'], { bed: { mattressSize: 'K_180', storage: 'NONE', upholstered: false, customSize: { widthM: 2.2, lengthM: 2 } } });
    expect(onChange).not.toHaveBeenCalled();
    // m3: lista arata „Altă mărime”, nu marimea standard veche (K_180)
    expect((screen.getByRole('combobox', { name: ro.Configurator.flows.PIECE_BED.bedSize.title }) as HTMLSelectElement).value).toBe('CUSTOM');
  });

  it('nici in afara sesiunii de editare o masa v5 valida nu se rescrie la deschidere', () => {
    setup('TABLE', TABLE_FEATURES, { ...ext, table: { ...ext.table, openLengthM: 2.4, customHeightM: 0.72 } });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('canapea: schimbarea locurilor / formei pastreaza extensibila si lada', () => {
    setup('SOFA', ['SOFA_SLEEPER', 'SOFA_STORAGE']);
    fireEvent.click(screen.getByRole('checkbox', { name: c3.catalog.sleeper }));
    fireEvent.click(screen.getByRole('checkbox', { name: c3.catalog.sofaStorage }));
    fireEvent.change(screen.getByRole('combobox', { name: c3.catalog.seats }), { target: { value: '4' } });
    fireEvent.change(screen.getByRole('combobox', { name: c3.catalog.layout }), { target: { value: 'CHAISE_LEFT' } });
    expect(last().sofa).toMatchObject({ seats: 4, layout: 'CHAISE_LEFT', sleeper: true, storage: true });
    expect(screen.getByRole('checkbox', { name: c3.catalog.sleeper })).toBeChecked();
    expect(valid('SOFA', last())).toBe(true);
  });
});

describe('etapa 10 — chips pentru campurile noi', () => {
  const t = (key: string, values?: Record<string, string | number>) => {
    const raw = key.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown>)?.[k], ro.Configurator) as string;
    return Object.entries(values ?? {}).reduce((s, [k, v]) => s.replace(`{${k}}`, String(v)), raw ?? key);
  };
  it('salteaua „Altă mărime”, lungimea deschisa, canapeaua extensibila / cu lada', () => {
    const bed = normalizePieceConfig('BED', { ...defaultPieceConfig('BED'), bed: { mattressSize: 'Q_160', storage: 'NONE', upholstered: false, customSize: { widthM: 1.2, lengthM: 1.9 } } });
    expect(config3dChips(t, bed, 'BED', 'ro')).toContain('Saltea: 120 × 190 cm (altă mărime)');
    // m3: marimea standard ramasa salvata (K_180) nu apare in chips (Sumar + fisa firmei le folosesc)
    const stale = normalizePieceConfig('BED', { ...bed, bed: { ...bed.bed!, mattressSize: 'K_180' } });
    const staleChips = config3dChips(t, stale, 'BED', 'ro').join(' | ');
    expect(staleChips).toContain('Saltea: 120 × 190 cm (altă mărime)');
    expect(staleChips).not.toContain(ro.Configurator.flows.PIECE_BED.bedSize.options.K_180.label);
    const table = normalizePieceConfig('TABLE', { ...defaultPieceConfig('TABLE'), widthM: 1.6, table: { type: 'DINING', shape: 'EXTENDABLE', seats: 'SIX', openLengthM: 2.4 } });
    expect(config3dChips(t, table, 'TABLE', 'ro')).toContain('Lungime deschisă: 240 cm');
    const sofa = normalizePieceConfig('SOFA', { ...defaultPieceConfig('SOFA'), sofa: { ...defaultPieceConfig('SOFA').sofa!, sleeper: true, storage: true } });
    const chips = config3dChips(t, sofa, 'SOFA', 'ro');
    expect(chips).toContain(c3.chips.sofaSleeper);
    expect(chips).toContain(c3.chips.sofaStorage);
    // configuratia veche: aceleasi chips ca inainte (fara cele noi)
    const plain = config3dChips(t, normalizePieceConfig('SOFA', defaultPieceConfig('SOFA')), 'SOFA', 'ro');
    expect(plain).not.toContain(c3.chips.sofaSleeper);
  });
});

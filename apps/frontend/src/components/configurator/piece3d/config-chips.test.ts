import {
  defaultPieceConfig,
  initialPieceConfig,
  normalizePieceConfig,
  type PieceConfig3d,
} from '@marketplace/shared';
import { createTranslator } from 'next-intl';
import { describe, expect, it } from 'vitest';
import en from '@/messages/en.json';
import ro from '@/messages/ro.json';
import { approxColorKey, config3dChipItems, config3dChips, config3dDimsUntouched } from './config-chips';

// Etapa 8 (d2, 41): chips-urile configuratiei 3D din Sumar / fisa firmei.
const tRo = createTranslator({ locale: 'ro', messages: ro, namespace: 'Configurator' }) as never;
const tEn = createTranslator({ locale: 'en', messages: en, namespace: 'Configurator' }) as never;
const c3 = ro.Configurator.config3d;
const texts = (config: PieceConfig3d, kind?: Parameters<typeof config3dChipItems>[2], locale?: string) =>
  config3dChipItems(tRo, config, kind, locale).map((i) => i.text);

describe('config3dChipItems', () => {
  it('comoda TV deschisa: fara deschidere (nu mai scrie „Fronturi cu mâner”), cu baza', () => {
    const tv = { ...defaultPieceConfig('TV_UNIT'), frontStyle: 'HANDLE' as const };
    const chips = texts(tv, 'TV_UNIT');
    expect(chips).not.toContain(c3.chips.openingHandle);
    expect(chips).not.toContain(c3.chips.openingPush);
    expect(chips.join(' ')).not.toMatch(/mâner/i);
    expect(chips).toContain(c3.chips.basePlinth);
  });

  it('piesa cu fronturi: deschiderea apare mereu, lipsa = Push (cererile vechi)', () => {
    const dresser = defaultPieceConfig('DRESSER');
    expect(dresser.frontStyle).toBeUndefined();
    expect(texts(dresser, 'DRESSER')).toContain('Deschidere: Push');
    expect(texts({ ...dresser, frontStyle: 'HANDLE' }, 'DRESSER')).toContain('Deschidere: cu mâner');
    expect(texts(initialPieceConfig('TV_UNIT'), 'TV_UNIT')).toContain('Deschidere: Push');
  });

  it('baza: soclu / picioare la comoda; fara tipul piesei doar picioarele', () => {
    const dresser = defaultPieceConfig('DRESSER');
    expect(texts(dresser, 'DRESSER')).toContain('Bază: soclu');
    expect(texts({ ...dresser, legs: true }, 'DRESSER')).toContain('Bază: picioare');
    expect(texts(dresser)).not.toContain('Bază: soclu');
    expect(texts({ ...dresser, legs: true })).toContain('Bază: picioare');
  });

  it('etichete pe valori: saltea, depozitare, persoane', () => {
    const bed = defaultPieceConfig('BED');
    const chips = texts(bed, 'BED');
    expect(chips).toContain(`Saltea: ${ro.Configurator.flows.PIECE_BED.bedSize.options.Q_160.label}`);
    expect(chips).toContain('Depozitare: fără');
    const table = defaultPieceConfig('TABLE');
    expect(texts({ ...table, table: { ...table.table!, seats: 'SIX' } }, 'TABLE')).toContain('Persoane: 6');
  });

  it('culoarea libera: nume aproximativ + mostra, nu codul hex', () => {
    expect(approxColorKey('#8b9d89')).toBe('VERDE_SALVIE');
    expect(approxColorKey('#ffffff')).toBe('ALB');
    expect(approxColorKey('nu e culoare')).toBeNull();
    const custom = normalizePieceConfig('WARDROBE', { ...defaultPieceConfig('WARDROBE'), finish: 'CUSTOM', customColor: '#8b9d89' });
    const items = config3dChipItems(tRo, custom, 'WARDROBE');
    const color = items.find((i) => i.text.startsWith('Culoare:'));
    expect(color).toEqual({ text: 'Culoare: aproape de verde salvie', swatch: '#8b9d89' });
    expect(items.map((i) => i.text).join(' ')).not.toContain('#8b9d89');
    expect(config3dChipItems(tEn, custom, 'WARDROBE').find((i) => i.swatch === '#8b9d89')?.text).toBe('Colour: close to sage green');
    // canapeaua: culoarea tapiteriei la fel
    const sofa = config3dChipItems(tRo, defaultPieceConfig('SOFA'), 'SOFA');
    expect(sofa.some((i) => i.text.startsWith('Culoare: aproape de') && i.swatch === '#a69d8e')).toBe(true);
  });

  it('finisajul predefinit are si mostra', () => {
    const item = config3dChipItems(tRo, defaultPieceConfig('WARDROBE'), 'WARDROBE').find((i) => i.text === 'Finisaj Stejar');
    expect(item?.swatch).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('dimensiunile: primul chip; cu limba, cm cu virgula in ro si punct in en', () => {
    const w = { ...defaultPieceConfig('WARDROBE'), widthM: 1.506 };
    expect(texts(w)[0]).toBe('151 × 240 × 60 cm');
    expect(texts(w, 'WARDROBE', 'ro')[0]).toBe('150,6 × 240 × 60 cm');
    expect(config3dChipItems(tEn, w, 'WARDROBE', 'en')[0].text).toBe('150.6 × 240 × 60 cm');
    const sofa = defaultPieceConfig('SOFA');
    expect(texts({ ...sofa, sofa: { ...sofa.sofa!, bodyDepthM: 0.955 } }, 'SOFA', 'ro')).toContain(
      `${c3.catalog.bodyDepth}: 95,5 cm`,
    );
  });

  it('config3dChips = textele din config3dChipItems (apelantii vechi)', () => {
    const cfg = initialPieceConfig('WARDROBE');
    expect(config3dChips(tRo, cfg, 'WARDROBE')).toEqual(config3dChipItems(tRo, cfg, 'WARDROBE').map((i) => i.text));
  });
});

describe('config3dDimsUntouched (d2-1)', () => {
  it('adevarat la dimensiunile de pornire (noi si vechi), fals dupa o schimbare', () => {
    expect(config3dDimsUntouched('WARDROBE', initialPieceConfig('WARDROBE'))).toBe(true);
    expect(config3dDimsUntouched('WARDROBE', defaultPieceConfig('WARDROBE'))).toBe(true);
    // alta configuratie a interiorului, aceleasi dimensiuni → tot orientative
    expect(config3dDimsUntouched('WARDROBE', { ...defaultPieceConfig('WARDROBE'), finish: 'NUC' })).toBe(true);
    expect(config3dDimsUntouched('WARDROBE', { ...initialPieceConfig('WARDROBE'), widthM: 2.5 })).toBe(false);
    expect(config3dDimsUntouched('TABLE', { ...defaultPieceConfig('TABLE'), depthM: 0.9 })).toBe(false);
  });
});

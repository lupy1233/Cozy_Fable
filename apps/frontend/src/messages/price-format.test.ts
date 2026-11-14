import { describe, expect, it } from 'vitest';
import en from './en.json';
import ro from './ro.json';

// Etapa 12, problema 54 (c12): un singur format pentru preturile orientative din formular.
// RO „600–1.100 lei / m liniar” (punct de mii, liniuta fara spatii, „+” doar la costuri in plus);
// EN „600–1,100 lei per linear metre” („lei” si in engleza, glosarul D10).
// Testul prinde orice cheie `…price` din Configurator.*, deci si cheile versiunilor noi de formular.

type Flat = Record<string, string>;
function flatten(o: unknown, prefix = '', acc: Flat = {}): Flat {
  if (typeof o === 'string') acc[prefix] = o;
  else if (o && typeof o === 'object') {
    for (const [k, v] of Object.entries(o)) flatten(v, prefix ? `${prefix}.${k}` : k, acc);
  }
  return acc;
}

const PRICE_KEY = /^Configurator\.(.+\.)?price$/;
const priceEntries = (flat: Flat) => Object.entries(flat).filter(([k]) => PRICE_KEY.test(k));

const RO_PRICES = priceEntries(flatten(ro));
const EN_PRICES = priceEntries(flatten(en));

// numere cu separator de mii (fara 4+ cifre lipite), interval cu liniuta „–” fara spatii
const RO_NUM = String.raw`\d{1,3}(?:\.\d{3})*`;
const EN_NUM = String.raw`\d{1,3}(?:,\d{3})*`;
const RO_UNITS = ['m liniar', 'bucată', 'front', 'sertar', 'corp', 'modul', 'accesoriu'];
const EN_UNITS = ['linear metre', 'piece', 'front', 'drawer', 'unit', 'module', 'accessory'];
const alt = (list: string[]) => list.join('|');

const RO_PATTERNS = [
  new RegExp(`^\\+?${RO_NUM}–${RO_NUM} lei(?: / (?:${alt(RO_UNITS)}))?(?: față de [^\\d]+)?$`),
  /^\+\d{1,2}–\d{1,2}%(?: față de [^\d]+)?$/,
  /^(?:inclus|incluse de regulă)$/,
];
const EN_PATTERNS = [
  new RegExp(`^\\+?${EN_NUM}–${EN_NUM} lei(?: per (?:${alt(EN_UNITS)}))?(?: vs [^\\d]+)?$`),
  /^\+\d{1,2}–\d{1,2}%(?: vs [^\d]+)?$/,
  /^(?:included|usually included)$/,
];

const bad = (entries: [string, string][], patterns: RegExp[]) =>
  entries.filter(([, v]) => !patterns.some((re) => re.test(v))).map(([k, v]) => `${k} = ${v}`);

const digits = (s: string) => (s.match(/\d+/g) ?? []).join('');

describe('preturile orientative (problema 54) — un singur format', () => {
  it('gaseste toate cheile de pret (nu trece pe gol)', () => {
    // 81 la etapa 12; e12-clean a sters 2 preturi nefolosite (DRESSING.toCeiling, BEDROOM.wardrobeToCeiling)
    expect(RO_PRICES.length).toBeGreaterThanOrEqual(75);
    expect(EN_PRICES.map(([k]) => k).sort()).toEqual(RO_PRICES.map(([k]) => k).sort());
  });

  it('RO: fiecare pret respecta tiparul', () => {
    expect(bad(RO_PRICES, RO_PATTERNS)).toEqual([]);
  });

  it('EN: fiecare pret respecta tiparul', () => {
    expect(bad(EN_PRICES, EN_PATTERNS)).toEqual([]);
  });

  it('RO si EN au aceleasi cifre si acelasi „+” pe fiecare cheie', () => {
    const enMap = Object.fromEntries(EN_PRICES);
    const diff = RO_PRICES.filter(([k, v]) => {
      const e = enMap[k] ?? '';
      return digits(v) !== digits(e) || v.startsWith('+') !== e.startsWith('+');
    }).map(([k, v]) => `${k}: ${v} | ${enMap[k]}`);
    expect(diff).toEqual([]);
  });

  it('formele vechi nu mai apar in formular (lei/ml, RON, „/buc”, unitati lipite)', () => {
    const all = [...Object.values(flatten(ro.Configurator)), ...Object.values(flatten(en.Configurator))];
    expect(all.filter((s) => /lei\/|\blei\s*\/\s*(?:ml|lm|buc|pc)\b|\bRON\b|\/\s*lm\b/.test(s))).toEqual([]);
  });

  it('exemple din plan', () => {
    expect(ro.Configurator.common.materials.MDF_FURNIR.info.price).toBe('600–1.100 lei / m liniar');
    expect(en.Configurator.common.materials.MDF_FURNIR.info.price).toBe('600–1,100 lei per linear metre');
    expect(ro.Configurator.common.systems.MANER.info.price).toBe('10–80 lei / bucată');
    expect(en.Configurator.common.systems.MANER.info.price).toBe('10–80 lei per piece');
  });
});

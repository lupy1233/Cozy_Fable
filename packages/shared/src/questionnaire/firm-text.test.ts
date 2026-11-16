import { describe, expect, it } from 'vitest';
import { ROOM_TYPES } from '../enums';
import { collectScoreEntries, deriveRoomForFirms, getFlow } from './engine';
import { allFixtureFlows, fixtureAnswers, FIXTURE_VARIANTS } from './firm-text.fixtures';
import { defaultPieceConfig, describePieceConfig } from './piece3d';

// d1 (etapa 3): instantaneul textelor pe care le citeste firma (nume + descriere piese,
// cantitate, material, sisteme, dimensiuni) pentru fiecare flow si versiune.
function collect() {
  const out: Record<string, unknown> = {};
  // etapa 6: doar versiunile de dinainte (instantaneul ramane byte-identic)
  for (const { roomType, version, flow } of allFixtureFlows({ only: 'legacy' })) {
    for (const variant of FIXTURE_VARIANTS) {
      const derived = flow.deriveRoom(fixtureAnswers(flow, variant));
      out[`${roomType}@v${version}/${variant}`] = {
        dims: [derived.lengthM, derived.widthM, derived.heightM],
        items: derived.items.map((it) => `${it.quantity}× ${it.name} | ${it.material} | ${it.systems.join(',')}${it.description ? ` | ${it.description}` : ''}`),
      };
    }
  }
  return out;
}

function firmTexts(): { key: string; text: string }[] {
  const out: { key: string; text: string }[] = [];
  for (const { roomType, version, flow } of allFixtureFlows()) {
    for (const variant of FIXTURE_VARIANTS) {
      for (const it of flow.deriveRoom(fixtureAnswers(flow, variant)).items) {
        out.push({ key: `${roomType}@v${version}/${variant}`, text: `${it.name} | ${it.description ?? ''}` });
      }
    }
  }
  return out;
}

// cuvinte care apareau fara diacritice in textele generate inainte de d1
const NO_DIACRITICS = [
  'baza', 'bucatarie', 'camara', 'comoda', 'biblioteca', 'vitrina', 'masuta', 'masa', 'consola', 'polita', 'polite',
  'usa', 'usi', 'coloana', 'zona', 'tapitat', 'sezut', 'bancuta', 'oglinda', 'incastrare', 'spalatorie', 'lada',
  'rabatabila', 'tesatura', 'tapiterie', 'adancime', 'brate', 'pana', 'noptiera', 'insula', 'cuva', 'tehnica',
  'rotunda', 'extensibila', 'etajera', 'agatat', 'spatiu', 'fara', 'inguste', 'doua', 'pozitia', 'masuratori',
  'cota', 'inferioara', 'superioara', 'maner', 'manere', 'retrasa', 'continua', 'sezlong', 'stanga', 'toaleta',
];

describe('textele generate pentru firma', () => {
  it('instantaneu pe toate flow-urile', async () => {
    await expect(JSON.stringify(collect(), null, 1)).toMatchFileSnapshot('./__snapshots__/firm-text.json');
  });

  it('fara coduri interne, cu "×" in dimensiuni si cu diacritice', () => {
    const problems: string[] = [];
    const wordRe = new RegExp(`(^|[^\\p{L}])(${NO_DIACRITICS.join('|')})(?=$|[^\\p{L}])`, 'iu');
    for (const { key, text } of firmTexts()) {
      if (/\b[A-Z][A-Z0-9]*_[A-Z0-9_]+\b/.test(text)) problems.push(`${key}: cod intern — ${text}`);
      if (/\b(ONE|TWO|FOUR|SIX|EIGHT_PLUS|UNDECIDED|OPEN|LIGHT|DARK)\b/.test(text)) problems.push(`${key}: cod intern — ${text}`);
      if (/\d\s*x\s*\d/i.test(text)) problems.push(`${key}: "x" in dimensiuni — ${text}`);
      if (wordRe.test(text)) problems.push(`${key}: fara diacritice — ${text}`);
    }
    expect(problems).toEqual([]);
  });

  it('exemplele cerute de plan: locuri, televizor, module dressing, "deschis" cu doua sensuri', () => {
    const table = getFlow('PIECE_TABLE', 1).deriveRoom({ tableType: 'DINING', shape: 'RECTANGULAR', seats: 'SIX', dimensions: { length: 1.8, width: 0.9 }, material: 'PAL' });
    expect(table.items[0].description).toBe('6 locuri');
    const eight = getFlow('PIECE_TABLE', 1).deriveRoom({ tableType: 'DINING', shape: 'RECTANGULAR', seats: 'EIGHT_PLUS', dimensions: { length: 2.4, width: 1 }, material: 'PAL' });
    expect(eight.items[0].description).toBe('8+ locuri');
    const tv = (tvSetup: string) => getFlow('PIECE_TV_UNIT', 1).deriveRoom({ style: 'LOW_UNIT', tvSetup, dimensions: { width: 1.8 }, material: 'PAL' }).items[0].description;
    expect([tv('TV_ON_WALL'), tv('TV_ON_UNIT'), tv('UNDECIDED')]).toEqual(['TV pe perete', 'TV pe comodă', 'TV: nedecis']);
    const dressing = getFlow('DRESSING', 3).deriveRoom({ layout: 'LINEAR', doorType: 'SLIDING', dimensions: { runA: 2.5, wardrobeHeight: 2.4 }, interiorModules: ['HANGING_RODS', 'SHELVES', 'LED_LIGHTING'], material: 'PAL' });
    expect(dressing.items[0].description).toBe('Interior: bare de agățat, rafturi; iluminare LED');
    const bed = getFlow('BEDROOM', 2).deriveRoom({ piecesNeeded: ['BED_FRAME'], bedSize: 'Q_160', bedStorage: 'LIFT_UP', bedUpholstered: true, dimensions: { ceilingHeight: 2.6 }, materialBed: 'PAL', systemsBed: ['MANER'] });
    expect(bed.items[0]).toMatchObject({ name: 'Pat tapițat', description: 'saltea 160 × 200, ladă rabatabilă' });
    const vanityConfig = defaultPieceConfig('BATHROOM_VANITY');
    const vanity = describePieceConfig('BATHROOM_VANITY', { ...vanityConfig, vanity: { ...vanityConfig.vanity!, storage: 'OPEN', countertop: 'LIGHT' } });
    expect(vanity).toContain('Depozitare: polițe deschise (fără uși)');
    expect(vanity).toContain('Blat: culoare deschisă');
    expect(vanity).toMatch(/^Configurat 3D: \d+ × \d+ × \d+ cm/);
  });
});

// d1-1 (PO): camera cu "am nevoie de ajutor" nu primeste piese, materiale si dimensiuni inventate
describe('camera cu ajutor la proiectare', () => {
  it('nu are piese si nici dimensiuni, pe niciun tip de camera', () => {
    for (const roomType of ROOM_TYPES) {
      expect(deriveRoomForFirms(roomType, {}, undefined, { needsDesignHelp: true }), roomType).toEqual({ lengthM: 0, widthM: 0, heightM: 0, items: [] });
    }
  });

  it('scorul pastreaza doar intrarile de camera, fara materiale / sisteme puse din oficiu', () => {
    const before = collectScoreEntries('KITCHEN', {}, 3);
    const after = collectScoreEntries('KITCHEN', {}, 3, { needsDesignHelp: true });
    expect(before.filter((e) => e.category === 'MATERIAL')).toHaveLength(2);
    expect(after).toEqual([
      { category: 'ROOM_TYPE', optionKey: 'KITCHEN' },
      { category: 'ROOM_SIZE', optionKey: 'UNDER_2M' },
      { category: 'ITEM_QUANTITY', optionKey: 'QTY_1' },
    ]);
  });

  it('o camera fara bifa ramane neschimbata', () => {
    const flow = getFlow('BEDROOM', 2);
    const answers = fixtureAnswers(flow, 'first');
    expect(deriveRoomForFirms('BEDROOM', answers, 2)).toEqual(flow.deriveRoom(answers));
    expect(collectScoreEntries('BEDROOM', answers, 2, { needsDesignHelp: false })).toEqual(collectScoreEntries('BEDROOM', answers, 2));
  });
});

import { describe, expect, it } from 'vitest';
import {
  clampColumns,
  columnWidth,
  defaultPieceConfig,
  describePieceConfig,
  normalizePieceConfig,
  PIECE3D_KINDS,
  PIECE3D_RULES,
  pieceConfig3dSchema,
  pieceConfigTotals,
  resolvePieceLayout,
  suggestedColumns,
  type PieceConfig3d,
} from './config';
import {
  buildPanels,
  buildZoneBoxes,
  canAddColumn,
  nextZoneType,
  panelsWithinBounds,
} from './model';

// Biblioteca Tylko tipica (R5.3): 2 coloane — polite ca INTERIOR al zonelor
// deschise, sertare si usa.
function bookcaseConfig(): PieceConfig3d {
  return {
    widthM: 1.6,
    heightM: 2.0,
    depthM: 0.35,
    columns: [
      { zones: [{ type: 'OPEN', fill: 'SHELVES', count: 3 }, { type: 'DRAWERS', count: 2 }] },
      { zones: [{ type: 'OPEN' }, { type: 'DOOR' }] },
    ],
    finish: 'STEJAR',
  };
}

// Dulap cu bara de haine (fill HANGING) — adancimea implicita 0.6 >= 0.55.
function wardrobeConfig(): PieceConfig3d {
  return {
    widthM: 2.4,
    heightM: 2.4,
    depthM: 0.6,
    columns: [
      { zones: [{ type: 'OPEN', fill: 'HANGING' }, { type: 'DRAWERS', count: 2 }] },
      { zones: [{ type: 'OPEN', fill: 'HANGING' }, { type: 'DRAWERS', count: 2 }] },
      { zones: [{ type: 'DOOR', fill: 'SHELVES', count: 4 }] },
    ],
    finish: 'STEJAR',
  };
}

describe('defaultPieceConfig', () => {
  it('produce config valid contra schemei pentru TOATE piesele', () => {
    for (const kind of PIECE3D_KINDS) {
      const config = defaultPieceConfig(kind);
      const parsed = pieceConfig3dSchema(kind).safeParse(config);
      expect(parsed.success, `${kind}: ${JSON.stringify(parsed)}`).toBe(true);
    }
  });

  it('respecta gabaritul implicit din reguli', () => {
    const config = defaultPieceConfig('BOOKCASE');
    expect(config.widthM).toBe(PIECE3D_RULES.BOOKCASE.width.default);
    expect(config.columns.length).toBe(suggestedColumns('BOOKCASE', config.widthM));
  });

  it('foloseste doar cele 3 tipuri active de zona (OPEN/DRAWERS/DOOR)', () => {
    for (const kind of PIECE3D_KINDS) {
      for (const type of PIECE3D_RULES[kind].zoneTypes) {
        expect(['OPEN', 'DRAWERS', 'DOOR']).toContain(type);
      }
    }
  });
});

describe('pieceConfig3dSchema', () => {
  it('accepta config-ul de biblioteca tipica', () => {
    expect(pieceConfig3dSchema('BOOKCASE').safeParse(bookcaseConfig()).success).toBe(true);
  });

  it('respinge dimensiuni in afara limitelor piesei', () => {
    const config = { ...bookcaseConfig(), heightM: 3.5 };
    expect(pieceConfig3dSchema('BOOKCASE').safeParse(config).success).toBe(false);
  });

  it('respinge tipurile legacy (HANGING/SHELVES ca TIP de zona)', () => {
    const hanging = bookcaseConfig();
    hanging.columns[0].zones[0] = { type: 'HANGING' };
    expect(pieceConfig3dSchema('BOOKCASE').safeParse(hanging).success).toBe(false);
    const shelves = bookcaseConfig();
    shelves.columns[0].zones[0] = { type: 'SHELVES', count: 3 };
    expect(pieceConfig3dSchema('BOOKCASE').safeParse(shelves).success).toBe(false);
  });

  it('cere count la DRAWERS si la fill SHELVES; il interzice la zonele goale', () => {
    const noDrawerCount = bookcaseConfig();
    delete noDrawerCount.columns[0].zones[1].count;
    expect(pieceConfig3dSchema('BOOKCASE').safeParse(noDrawerCount).success).toBe(false);

    const noShelfCount = bookcaseConfig();
    delete noShelfCount.columns[0].zones[0].count;
    expect(pieceConfig3dSchema('BOOKCASE').safeParse(noShelfCount).success).toBe(false);

    const openWithCount = bookcaseConfig();
    openWithCount.columns[1].zones[0] = { type: 'OPEN', count: 2 };
    expect(pieceConfig3dSchema('BOOKCASE').safeParse(openWithCount).success).toBe(false);
  });

  it('usa cu polite interioare = fill SHELVES (count obligatoriu, max 8)', () => {
    const withShelves = bookcaseConfig();
    withShelves.columns[1].zones[1] = { type: 'DOOR', fill: 'SHELVES', count: 3 };
    expect(pieceConfig3dSchema('BOOKCASE').safeParse(withShelves).success).toBe(true);

    const tooMany = bookcaseConfig();
    tooMany.columns[1].zones[1] = { type: 'DOOR', fill: 'SHELVES', count: 9 };
    expect(pieceConfig3dSchema('BOOKCASE').safeParse(tooMany).success).toBe(false);

    // forma legacy (DOOR cu count fara fill) nu mai e acceptata la publish
    const legacy = bookcaseConfig();
    legacy.columns[1].zones[1] = { type: 'DOOR', count: 3 };
    expect(pieceConfig3dSchema('BOOKCASE').safeParse(legacy).success).toBe(false);
  });

  it('bara de haine cere adancime >= 55cm si zona >= 80cm', () => {
    expect(pieceConfig3dSchema('WARDROBE').safeParse(wardrobeConfig()).success).toBe(true);

    const shallow = { ...wardrobeConfig(), depthM: 0.45 };
    expect(pieceConfig3dSchema('WARDROBE').safeParse(shallow).success).toBe(false);

    // 4 zone la 1.8m inaltime → ~41cm/zona < 80cm
    const short: PieceConfig3d = {
      ...wardrobeConfig(),
      heightM: 1.8,
      columns: [
        {
          zones: [
            { type: 'OPEN', fill: 'HANGING' },
            { type: 'OPEN' },
            { type: 'OPEN' },
            { type: 'OPEN' },
          ],
        },
      ],
    };
    expect(pieceConfig3dSchema('WARDROBE').safeParse(short).success).toBe(false);
  });

  it('permite 2-3 bare suprapuse doar daca inaltimea zonei ajunge (80cm/bara)', () => {
    const two: PieceConfig3d = {
      ...wardrobeConfig(),
      widthM: 0.8,
      columns: [{ zones: [{ type: 'OPEN', fill: 'HANGING', count: 2 }] }],
    };
    // zona unica are ~2.30m → incap 2 bare
    expect(pieceConfig3dSchema('WARDROBE').safeParse(two).success).toBe(true);
    // 3 bare cer 240cm de zona — nu incap la 2.4m inaltime totala
    const three: PieceConfig3d = {
      ...two,
      columns: [{ zones: [{ type: 'OPEN', fill: 'HANGING', count: 3 }] }],
    };
    expect(pieceConfig3dSchema('WARDROBE').safeParse(three).success).toBe(false);
    const threeTall: PieceConfig3d = { ...three, heightM: 2.8 };
    expect(pieceConfig3dSchema('WARDROBE').safeParse(threeTall).success).toBe(true);
    // plafonul absolut e 3 bare
    const four: PieceConfig3d = {
      ...two,
      heightM: 2.8,
      columns: [{ zones: [{ type: 'OPEN', fill: 'HANGING', count: 4 }] }],
    };
    expect(pieceConfig3dSchema('WARDROBE').safeParse(four).success).toBe(false);
  });

  it('respinge sertarele cu marginea de sus peste 160cm', () => {
    // dulap ingust cu o singura coloana (latimea coloanei ramane valida)
    const high: PieceConfig3d = {
      ...wardrobeConfig(),
      widthM: 0.8,
      columns: [{ zones: [{ type: 'DRAWERS', count: 2 }, { type: 'OPEN' }] }],
    };
    // zona de sus (sertare) urca pana la ~2.38m
    expect(pieceConfig3dSchema('WARDROBE').safeParse(high).success).toBe(false);

    const low: PieceConfig3d = {
      ...wardrobeConfig(),
      widthM: 0.8,
      columns: [{ zones: [{ type: 'OPEN' }, { type: 'DRAWERS', count: 2 }] }],
    };
    expect(pieceConfig3dSchema('WARDROBE').safeParse(low).success).toBe(true);
  });

  it('valideaza blocajele: widthM/heightM in limitele geometrice', () => {
    const badWidth = bookcaseConfig();
    badWidth.columns[0].widthM = 0.1; // sub COLUMN_W_MIN
    expect(pieceConfig3dSchema('BOOKCASE').safeParse(badWidth).success).toBe(false);

    const badHeight = bookcaseConfig();
    badHeight.columns[0].zones[0].heightM = 0.05; // sub ZONE_H_MIN
    expect(pieceConfig3dSchema('BOOKCASE').safeParse(badHeight).success).toBe(false);

    const ok = bookcaseConfig();
    ok.columns[0].widthM = 0.5;
    ok.columns[0].zones[0].heightM = 1.2;
    expect(pieceConfig3dSchema('BOOKCASE').safeParse(ok).success).toBe(true);
  });

  it('respinge coloane care rezulta in latimi nerealiste', () => {
    const config: PieceConfig3d = {
      ...bookcaseConfig(),
      widthM: 0.5,
      columns: [
        { zones: [{ type: 'OPEN' }] },
        { zones: [{ type: 'OPEN' }] },
        { zones: [{ type: 'OPEN' }] },
      ],
    };
    expect(pieceConfig3dSchema('BOOKCASE').safeParse(config).success).toBe(false);
    // iar 4m cu 1 coloana depaseste COLUMN_W_MAX
    const wide: PieceConfig3d = { ...bookcaseConfig(), widthM: 4, columns: [{ zones: [{ type: 'OPEN' }] }] };
    expect(pieceConfig3dSchema('BOOKCASE').safeParse(wide).success).toBe(false);
  });

  it('respinge chei straine (answers fabricate)', () => {
    const config = { ...bookcaseConfig(), hacked: true } as unknown as PieceConfig3d;
    expect(pieceConfig3dSchema('BOOKCASE').safeParse(config).success).toBe(false);
  });
});

describe('suggestedColumns / clampColumns', () => {
  it('deriva coloanele din latime la ~80cm/coloana', () => {
    expect(suggestedColumns('BOOKCASE', 0.6)).toBe(1);
    expect(suggestedColumns('BOOKCASE', 1.6)).toBe(2);
    expect(suggestedColumns('WARDROBE', 3.2)).toBe(4);
  });

  it('nu permite coloane mai late de COLUMN_W_MAX', () => {
    expect(columnWidth(2.4, clampColumns('WARDROBE', 2.4, 1))).toBeLessThanOrEqual(1.0);
  });
});

describe('resolvePieceLayout (R5.3: dimensiuni blocate)', () => {
  it('fara blocaje imparte egal, identic cu columnWidth', () => {
    const config = bookcaseConfig();
    const layout = resolvePieceLayout('BOOKCASE', config);
    const equal = columnWidth(config.widthM, 2);
    expect(layout[0].width).toBeCloseTo(equal, 6);
    expect(layout[1].width).toBeCloseTo(equal, 6);
  });

  it('coloana blocata isi tine latimea, restul se imparte egal', () => {
    const config: PieceConfig3d = {
      ...bookcaseConfig(),
      columns: [
        { widthM: 0.4, zones: [{ type: 'OPEN' }] },
        { zones: [{ type: 'OPEN' }] },
        { zones: [{ type: 'OPEN' }] },
      ],
    };
    const layout = resolvePieceLayout('BOOKCASE', config);
    expect(layout[0].width).toBeCloseTo(0.4, 6);
    expect(layout[1].width).toBeCloseTo(layout[2].width, 6);
    const total = layout.reduce((s, c) => s + c.width, 0);
    expect(total).toBeCloseTo(config.widthM - 2 * 0.018 - 2 * 0.018, 6);
  });

  it('randul blocat isi tine inaltimea, iar suma acopera exact interiorul', () => {
    const config = bookcaseConfig();
    config.columns[0].zones[0].heightM = 0.4;
    const layout = resolvePieceLayout('BOOKCASE', config);
    const zones = layout[0].zones;
    expect(zones[0].height).toBeCloseTo(0.4, 6);
    // zonele sunt ordonate de sus in jos si nu se suprapun
    expect(zones[0].bottom).toBeGreaterThan(zones[1].top - 1e-9);
    expect(zones[1].bottom).toBeCloseTo(0.06 + 0.018, 6);
  });

  it('blocajele care nu mai incap sunt scalate, geometria ramane valida', () => {
    const config = bookcaseConfig();
    config.columns[0].zones[0].heightM = 5; // mai mult decat toata piesa
    const layout = resolvePieceLayout('BOOKCASE', config);
    const zones = layout[0].zones;
    expect(zones[0].height).toBeLessThan(2);
    expect(zones[1].height).toBeGreaterThanOrEqual(0.1 - 1e-9);
  });
});

describe('normalizePieceConfig', () => {
  it('pastreaza zonele existente si adauga coloane implicite la capat', () => {
    const config = { ...bookcaseConfig(), widthM: 2.4, columns: bookcaseConfig().columns };
    const normalized = normalizePieceConfig('BOOKCASE', config);
    expect(normalized.columns.length).toBe(3);
    expect(normalized.columns[0].zones[0]).toEqual({ type: 'OPEN', fill: 'SHELVES', count: 3 });
    expect(normalized.columns[2].zones[0].fill).toBe('SHELVES');
  });

  it('migreaza formele legacy: SHELVES/HANGING/TILT_OUT/DOOR+count', () => {
    const config = wardrobeConfig();
    config.columns[0].zones = [{ type: 'SHELVES', count: 5 } as never];
    config.columns[1].zones = [{ type: 'HANGING' } as never, { type: 'TILT_OUT', count: 2 } as never];
    config.columns[2].zones = [{ type: 'DOOR', count: 3 } as never];
    const normalized = normalizePieceConfig('WARDROBE', config);
    expect(normalized.columns[0].zones[0]).toEqual({ type: 'OPEN', fill: 'SHELVES', count: 5 });
    expect(normalized.columns[1].zones[0]).toEqual({ type: 'OPEN', fill: 'HANGING', count: 1 });
    expect(normalized.columns[1].zones[1]).toEqual({ type: 'DRAWERS', count: 2 });
    expect(normalized.columns[2].zones[0]).toEqual({ type: 'DOOR', fill: 'SHELVES', count: 3 });
    expect(pieceConfig3dSchema('WARDROBE').safeParse(normalized).success).toBe(true);
  });

  it('corecteaza count-uri si tipuri nepermise', () => {
    const config = bookcaseConfig();
    config.columns[0].zones[0] = { type: 'HANGING', count: 99 } as never;
    const normalized = normalizePieceConfig('BOOKCASE', config);
    // HANGING migrat la OPEN+fill, dar biblioteca are 35cm adancime < 55cm
    // → bara dispare, ramane zona deschisa
    expect(normalized.columns[0].zones[0]).toEqual({ type: 'OPEN' });
    expect(pieceConfig3dSchema('BOOKCASE').safeParse(normalized).success).toBe(true);
  });

  it('bara de haine dispare cand adancimea scade sub 55cm', () => {
    const config = { ...wardrobeConfig(), depthM: 0.4 };
    const normalized = normalizePieceConfig('WARDROBE', config);
    expect(normalized.columns[0].zones[0].fill).toBeUndefined();
    expect(pieceConfig3dSchema('WARDROBE').safeParse(normalized).success).toBe(true);
  });

  it('reduce barele suprapuse cand zona nu le mai incape', () => {
    const config: PieceConfig3d = {
      ...wardrobeConfig(),
      widthM: 0.8,
      heightM: 1.8,
      columns: [{ zones: [{ type: 'OPEN', fill: 'HANGING', count: 3 }] }],
    };
    const normalized = normalizePieceConfig('WARDROBE', config);
    // zona unica are ~1.70m → incap doar 2 bare
    expect(normalized.columns[0].zones[0]).toEqual({ type: 'OPEN', fill: 'HANGING', count: 2 });
    expect(pieceConfig3dSchema('WARDROBE').safeParse(normalized).success).toBe(true);
  });

  it('sertarele urcate peste 160cm redevin zona deschisa', () => {
    const config: PieceConfig3d = {
      ...wardrobeConfig(),
      columns: [{ zones: [{ type: 'DRAWERS', count: 3 }, { type: 'OPEN' }] }],
    };
    const normalized = normalizePieceConfig('WARDROBE', config);
    expect(normalized.columns[0].zones[0].type).toBe('OPEN');
    expect(normalized.columns[0].zones[0].count).toBeUndefined();
    expect(pieceConfig3dSchema('WARDROBE').safeParse(normalized).success).toBe(true);
  });

  it('lasa mereu cel putin un rand si o coloana flexibile', () => {
    const config: PieceConfig3d = {
      ...bookcaseConfig(),
      columns: [
        { widthM: 0.5, zones: [{ type: 'OPEN', heightM: 0.5 }, { type: 'OPEN', heightM: 0.5 }] },
        { widthM: 0.5, zones: [{ type: 'OPEN' }] },
      ],
    };
    const normalized = normalizePieceConfig('BOOKCASE', config);
    expect(normalized.columns[1].widthM).toBeUndefined();
    const zones = normalized.columns[0].zones;
    expect(zones[zones.length - 1].heightM).toBeUndefined();
    expect(zones[0].heightM).toBeCloseTo(0.5, 6);
  });
});

describe('buildPanels', () => {
  it('genereaza carcasa completa: 2 laterale, sus, jos, spate, soclu, despartitor', () => {
    const panels = buildPanels(bookcaseConfig(), 'BOOKCASE');
    const roles = panels.map((p) => p.role);
    expect(roles.filter((r) => r === 'SIDE').length).toBe(2);
    expect(roles).toContain('TOP');
    expect(roles).toContain('BOTTOM');
    expect(roles).toContain('BACK');
    expect(roles).toContain('PLINTH');
    expect(roles.filter((r) => r === 'DIVIDER').length).toBe(1);
  });

  it('genereaza politele, fronturile si separatoarele cerute de zone', () => {
    const panels = buildPanels(bookcaseConfig(), 'BOOKCASE');
    expect(panels.filter((p) => p.role === 'SHELF').length).toBe(3);
    expect(panels.filter((p) => p.role === 'DRAWER_FRONT').length).toBe(2);
    // coloana 2 (~77cm) depaseste pragul de 65cm → usa dubla
    expect(panels.filter((p) => p.role === 'DOOR_FRONT').length).toBe(2);
    // cate un separator intre zonele fiecarei coloane
    expect(panels.filter((p) => p.role === 'ZONE_SEP').length).toBe(2);
  });

  it('tine toate panourile in gabaritul piesei, pentru toate piesele', () => {
    for (const kind of PIECE3D_KINDS) {
      const config = defaultPieceConfig(kind);
      const panels = buildPanels(config, kind);
      expect(panels.length).toBeGreaterThan(3);
      expect(panelsWithinBounds(config, panels), kind).toBe(true);
    }
  });

  it('coloana blocata muta despartitorul si pastreaza gabaritul', () => {
    // 3 coloane, prima blocata la 40cm — celelalte doua raman in limite
    const config: PieceConfig3d = {
      ...bookcaseConfig(),
      columns: [
        { widthM: 0.4, zones: [{ type: 'OPEN' }] },
        { zones: [{ type: 'OPEN' }] },
        { zones: [{ type: 'OPEN' }] },
      ],
    };
    const panels = buildPanels(config, 'BOOKCASE');
    const dividers = panels.filter((p) => p.role === 'DIVIDER');
    // primul despartitor: stanga interioara (-0.782) + 0.4 + T/2
    expect(dividers[0]?.x).toBeCloseTo(-config.widthM / 2 + 0.018 + 0.4 + 0.009, 6);
    expect(panelsWithinBounds(config, panels)).toBe(true);
  });

  it('usa cu polite interioare: SHELF-uri in zona usii + balamale pe fronturi', () => {
    const config = bookcaseConfig();
    config.columns[1].zones[1] = { type: 'DOOR', fill: 'SHELVES', count: 2 };
    const panels = buildPanels(config, 'BOOKCASE');
    // 3 polite in zona deschisa + 2 interioare in spatele usii
    expect(panels.filter((p) => p.role === 'SHELF').length).toBe(5);
    const doors = panels.filter((p) => p.role === 'DOOR_FRONT');
    // coloana ~77cm → usa dubla, balamale stanga + dreapta
    expect(doors.map((d) => d.hinge).sort()).toEqual(['L', 'R']);
  });

  it('bara de haine (fill HANGING) primeste ROD, si in spatele usii', () => {
    const wardrobe = defaultPieceConfig('WARDROBE');
    expect(buildPanels(wardrobe, 'WARDROBE').some((p) => p.role === 'ROD')).toBe(true);

    const doorHang = wardrobeConfig();
    doorHang.columns[2].zones[0] = { type: 'DOOR', fill: 'HANGING' };
    expect(buildPanels(doorHang, 'WARDROBE').some((p) => p.role === 'ROD')).toBe(true);
  });

  it('barele suprapuse produc ROD-uri la inaltimi diferite si intra in totaluri', () => {
    const config: PieceConfig3d = {
      ...wardrobeConfig(),
      widthM: 0.8,
      columns: [{ zones: [{ type: 'OPEN', fill: 'HANGING', count: 2 }] }],
    };
    const rods = buildPanels(config, 'WARDROBE').filter((p) => p.role === 'ROD');
    expect(rods.length).toBe(2);
    expect(Math.abs(rods[0].y - rods[1].y)).toBeGreaterThan(0.5);
    expect(panelsWithinBounds(config, buildPanels(config, 'WARDROBE'))).toBe(true);
    expect(pieceConfigTotals(config).hanging).toBe(2);
  });

  it('sertarele primesc fundal intunecat pentru rosturi (FRONT_BACKDROP)', () => {
    const panels = buildPanels(bookcaseConfig(), 'BOOKCASE');
    const backdrops = panels.filter((p) => p.role === 'FRONT_BACKDROP');
    expect(backdrops.length).toBe(1);
    expect(backdrops[0].col).toBe(0);
  });

  it('politele din spatele usilor intra in totalul de polite', () => {
    const config = bookcaseConfig();
    config.columns[1].zones[1] = { type: 'DOOR', fill: 'SHELVES', count: 2 };
    expect(pieceConfigTotals(config).shelves).toBe(5);
  });

  it('biroul primeste blat si casetiera cu sertare', () => {
    const desk = defaultPieceConfig('DESK');
    const deskPanels = buildPanels(desk, 'DESK');
    expect(deskPanels.some((p) => p.role === 'DESK_TOP')).toBe(true);
    expect(deskPanels.filter((p) => p.role === 'DRAWER_FRONT').length).toBe(3);
  });

  it('doua casetiere nu incap la un birou ingust (docs/12 S6)', () => {
    const wide = defaultPieceConfig('DESK'); // 1.4m — incap doua
    wide.columns = [
      { zones: [{ type: 'DRAWERS', count: 3 }] },
      { zones: [{ type: 'DRAWERS', count: 3 }] },
    ];
    expect(canAddColumn('DESK', { ...wide, columns: wide.columns.slice(0, 1) })).toBe(true);
    expect(pieceConfig3dSchema('DESK').safeParse(wide).success).toBe(true);

    // sub pragul de genunchi (2 laterale + 2×42cm + 40cm): a doua dispare
    const narrow = { ...wide, widthM: 1.1 };
    expect(canAddColumn('DESK', { ...narrow, columns: narrow.columns.slice(0, 1) })).toBe(false);
    expect(pieceConfig3dSchema('DESK').safeParse(narrow).success).toBe(false);
    const normalized = normalizePieceConfig('DESK', narrow);
    expect(normalized.columns.length).toBe(1);
    expect(pieceConfig3dSchema('DESK').safeParse(normalized).success).toBe(true);
  });
});

describe('buildZoneBoxes', () => {
  it('produce cate o cutie per zona, aliniata cu coloana ei', () => {
    const config = bookcaseConfig();
    const boxes = buildZoneBoxes(config, 'BOOKCASE');
    expect(boxes.length).toBe(4);
    expect(boxes.filter((b) => b.col === 0).length).toBe(2);
    // zonele nu se suprapun pe verticala in aceeasi coloana
    const colBoxes = boxes.filter((b) => b.col === 0).sort((a, b) => b.y - a.y);
    expect(colBoxes[0].y - colBoxes[0].h / 2).toBeGreaterThanOrEqual(
      colBoxes[1].y + colBoxes[1].h / 2 - 1e-9,
    );
  });
});

describe('nextZoneType', () => {
  it('cicleaza doar prin tipurile permise piesei', () => {
    expect(nextZoneType('BOOKCASE', 'OPEN')).toBe('DRAWERS');
    expect(nextZoneType('BOOKCASE', 'DOOR')).toBe('OPEN');
    // tip legacy necunoscut → primul tip permis
    expect(nextZoneType('WARDROBE', 'HANGING')).toBe('OPEN');
  });
});

describe('describePieceConfig / pieceConfigTotals', () => {
  it('numara corect elementele si genereaza descrierea pentru ateliere', () => {
    const totals = pieceConfigTotals(bookcaseConfig());
    expect(totals).toMatchObject({ columns: 2, shelves: 3, drawers: 2, doors: 2, open: 1 });
    const text = describePieceConfig('BOOKCASE', bookcaseConfig());
    expect(text).toContain('Configurat 3D: 160 x 200 x 35 cm');
    expect(text).toContain('2 coloane');
    expect(text).toContain('3 polite');
    expect(text).toContain('2 sertare');
    expect(text).toContain('2 usi');
    expect(text).toContain('finisaj stejar');
  });

  it('bara de haine din fill intra in totaluri', () => {
    const totals = pieceConfigTotals(wardrobeConfig());
    expect(totals.hanging).toBe(2);
    expect(totals.drawers).toBe(4);
    expect(totals.shelves).toBe(4);
  });
});

describe('canAddColumn', () => {
  it('respecta limitele de latime', () => {
    const narrow = defaultPieceConfig('NIGHTSTAND');
    expect(canAddColumn('NIGHTSTAND', narrow)).toBe(false);
    const wide = { ...defaultPieceConfig('WARDROBE'), widthM: 4 };
    expect(canAddColumn('WARDROBE', normalizePieceConfig('WARDROBE', wide))).toBe(true);
  });
});

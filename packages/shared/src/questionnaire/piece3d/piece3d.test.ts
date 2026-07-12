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

// Biblioteca Tylko tipica: 2 coloane, polite + sertare + usa.
function bookcaseConfig(): PieceConfig3d {
  return {
    widthM: 1.6,
    heightM: 2.0,
    depthM: 0.35,
    columns: [
      { zones: [{ type: 'SHELVES', count: 3 }, { type: 'DRAWERS', count: 2 }] },
      { zones: [{ type: 'OPEN' }, { type: 'DOOR' }] },
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
});

describe('pieceConfig3dSchema', () => {
  it('accepta config-ul de biblioteca tipica', () => {
    expect(pieceConfig3dSchema('BOOKCASE').safeParse(bookcaseConfig()).success).toBe(true);
  });

  it('respinge dimensiuni in afara limitelor piesei', () => {
    const config = { ...bookcaseConfig(), heightM: 3.5 };
    expect(pieceConfig3dSchema('BOOKCASE').safeParse(config).success).toBe(false);
  });

  it('respinge tip de zona nepermis piesei (HANGING la biblioteca)', () => {
    const config = bookcaseConfig();
    config.columns[0].zones[0] = { type: 'HANGING' };
    expect(pieceConfig3dSchema('BOOKCASE').safeParse(config).success).toBe(false);
  });

  it('cere count la SHELVES/DRAWERS si il interzice la OPEN', () => {
    const noCount = bookcaseConfig();
    delete noCount.columns[0].zones[0].count;
    expect(pieceConfig3dSchema('BOOKCASE').safeParse(noCount).success).toBe(false);

    const openWithCount = bookcaseConfig();
    openWithCount.columns[1].zones[0] = { type: 'OPEN', count: 2 };
    expect(pieceConfig3dSchema('BOOKCASE').safeParse(openWithCount).success).toBe(false);
  });

  it('DOOR accepta count OPTIONAL = politele interioare (max 8)', () => {
    const plain = bookcaseConfig();
    expect(pieceConfig3dSchema('BOOKCASE').safeParse(plain).success).toBe(true);

    const withShelves = bookcaseConfig();
    withShelves.columns[1].zones[1] = { type: 'DOOR', count: 3 };
    expect(pieceConfig3dSchema('BOOKCASE').safeParse(withShelves).success).toBe(true);

    const tooMany = bookcaseConfig();
    tooMany.columns[1].zones[1] = { type: 'DOOR', count: 9 };
    expect(pieceConfig3dSchema('BOOKCASE').safeParse(tooMany).success).toBe(false);
  });

  it('respinge coloane care rezulta in latimi nerealiste', () => {
    // 0.5m cu 2 coloane → ~22.4cm interior/coloana... sub COLUMN_W_MIN la 3 coloane
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
    // 2.4m cu 1 coloana → 2.36m interior: clamp urca numarul
    expect(columnWidth(2.4, clampColumns('WARDROBE', 2.4, 1))).toBeLessThanOrEqual(1.0);
  });
});

describe('normalizePieceConfig', () => {
  it('pastreaza zonele existente si adauga coloane implicite la capat', () => {
    const config = { ...bookcaseConfig(), widthM: 2.4, columns: bookcaseConfig().columns };
    const normalized = normalizePieceConfig('BOOKCASE', config);
    expect(normalized.columns.length).toBe(3);
    expect(normalized.columns[0].zones[0]).toEqual({ type: 'SHELVES', count: 3 });
    expect(normalized.columns[2].zones[0].type).toBe('SHELVES');
  });

  it('corecteaza count-uri si tipuri nepermise', () => {
    const config = bookcaseConfig();
    config.columns[0].zones[0] = { type: 'HANGING', count: 99 } as never;
    const normalized = normalizePieceConfig('BOOKCASE', config);
    expect(normalized.columns[0].zones[0].type).toBe('OPEN');
    const parsed = pieceConfig3dSchema('BOOKCASE').safeParse(normalized);
    expect(parsed.success).toBe(true);
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

  it('usa cu polite interioare: SHELF-uri in zona usii + balamale pe fronturi', () => {
    const config = bookcaseConfig();
    config.columns[1].zones[1] = { type: 'DOOR', count: 2 };
    const panels = buildPanels(config, 'BOOKCASE');
    // 3 polite in zona SHELVES + 2 interioare in spatele usii
    expect(panels.filter((p) => p.role === 'SHELF').length).toBe(5);
    const doors = panels.filter((p) => p.role === 'DOOR_FRONT');
    // coloana ~77cm → usa dubla, balamale stanga + dreapta
    expect(doors.map((d) => d.hinge).sort()).toEqual(['L', 'R']);
  });

  it('sertarele primesc fundal intunecat pentru rosturi (FRONT_BACKDROP)', () => {
    const panels = buildPanels(bookcaseConfig(), 'BOOKCASE');
    const backdrops = panels.filter((p) => p.role === 'FRONT_BACKDROP');
    expect(backdrops.length).toBe(1);
    expect(backdrops[0].col).toBe(0);
  });

  it('politele din spatele usilor intra in totalul de polite', () => {
    const config = bookcaseConfig();
    config.columns[1].zones[1] = { type: 'DOOR', count: 2 };
    expect(pieceConfigTotals(config).shelves).toBe(5);
  });

  it('dulapul cu HANGING primeste bara; biroul primeste blat si casetiera', () => {
    const wardrobe = defaultPieceConfig('WARDROBE');
    expect(buildPanels(wardrobe, 'WARDROBE').some((p) => p.role === 'ROD')).toBe(true);

    const desk = defaultPieceConfig('DESK');
    const deskPanels = buildPanels(desk, 'DESK');
    expect(deskPanels.some((p) => p.role === 'DESK_TOP')).toBe(true);
    expect(deskPanels.filter((p) => p.role === 'DRAWER_FRONT').length).toBe(3);
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
    expect(nextZoneType('BOOKCASE', 'OPEN')).toBe('SHELVES');
    expect(nextZoneType('BOOKCASE', 'DOOR')).toBe('OPEN');
    expect(nextZoneType('WARDROBE', 'HANGING')).toBe('SHELVES');
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
});

describe('canAddColumn', () => {
  it('respecta limitele de latime', () => {
    const narrow = defaultPieceConfig('NIGHTSTAND');
    expect(canAddColumn('NIGHTSTAND', narrow)).toBe(false);
    const wide = { ...defaultPieceConfig('WARDROBE'), widthM: 4 };
    expect(canAddColumn('WARDROBE', normalizePieceConfig('WARDROBE', wide))).toBe(true);
  });
});

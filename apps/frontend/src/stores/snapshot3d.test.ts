import { CURRENT_FLOW_VERSION, defaultPieceConfig } from '@marketplace/shared';
import { describe, expect, it } from 'vitest';
import { config3dKey, dataUrlToFile, piece3dOf, snapshot3dStatus } from './snapshot3d';

const PNG = '0b6ad530-3c0f-4c39-8ab1-8a4f3f5d2b6e';
const desk = (answers: Record<string, unknown>, extra: Record<string, unknown> = {}) => ({
  roomType: 'PIECE_DESK' as const,
  flowVersion: CURRENT_FLOW_VERSION.PIECE_DESK,
  answers: answers as never,
  ...extra,
});

// d4: imaginea 3D tine minte configuratia pe care o arata
describe('snapshot3d helpers (d4)', () => {
  const config = defaultPieceConfig('DESK');

  it('the configuration key ignores key order and changes with the configuration', () => {
    const reordered = Object.fromEntries(Object.entries(config).reverse());
    expect(config3dKey(reordered)).toBe(config3dKey(config));
    expect(config3dKey({ ...config, widthM: config.widthM + 0.1 })).not.toBe(config3dKey(config));
  });

  it('a configured piece has a picture status; other rooms and flagged rooms have none', () => {
    expect(piece3dOf(desk({ config3d: config }))?.piece).toBe('DESK');
    expect(snapshot3dStatus({ roomType: 'KITCHEN', flowVersion: 1, answers: {} })).toBe('none');
    expect(snapshot3dStatus(desk({ config3d: config }, { needsDesignHelp: true }))).toBe('none');
    expect(snapshot3dStatus(desk({}))).toBe('none');
  });

  it('missing / fresh / stale follow the picture and its key', () => {
    const key = config3dKey(config);
    expect(snapshot3dStatus(desk({ config3d: config }))).toBe('missing');
    expect(snapshot3dStatus(desk({ config3d: config, snapshot3d: [PNG] }, { snapshot3dKey: key }))).toBe('fresh');
    // configuratia schimbata dupa imagine
    expect(snapshot3dStatus(desk({ config3d: { ...config, widthM: config.widthM + 0.1 }, snapshot3d: [PNG] }, { snapshot3dKey: key }))).toBe('stale');
    // imagine fara cheie (ex. ramasa de la o publicare esuata) = veche
    expect(snapshot3dStatus(desk({ config3d: config, snapshot3d: [PNG] }))).toBe('stale');
  });

  it('turns a PNG data URL into a file without fetch', async () => {
    const file = dataUrlToFile('data:image/png;base64,iVBORw0KGgo=', 'a.png');
    expect(file?.type).toBe('image/png');
    expect(file?.name).toBe('a.png');
    expect(file?.size).toBe(8);
    expect(dataUrlToFile('not a data url', 'a.png')).toBeNull();
  });
});

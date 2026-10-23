import { render } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { getIllustration, ROOM_OPTION_PHOTOS } from './index';
import { answerVisualCoverage } from './coverage';
import { SHOWROOM_ATLASES, showroomPhoto, showroomCropStyle, showroomCropBounds } from './showroom-atlas';
import { optionPhoto } from './option-photo';

describe('answer visual registry', () => {
  it('maps the 48 concepts to distinct original atlas cells', () => {
    expect(Object.values(SHOWROOM_ATLASES).flat()).toHaveLength(48);
    expect(new Set(Object.values(SHOWROOM_ATLASES).flat()).size).toBe(48);
    const Last = showroomPhoto('desk-cable-port');
    const { container } = render(<Last />);
    expect(container.querySelector('[data-showroom-concept] > span')).toHaveStyle({ backgroundPosition: '100% 100%' });
    expect(showroomCropStyle('furniture', 15).height).toBe('100%');
    expect(parseFloat(showroomCropStyle('furniture', 15).width as string)).toBeLessThan(100);
  });
  it('uses consistent bed artwork across room and piece flows without collapsing bed-size diagrams', () => {
    expect(getIllustration('BEDROOM', 'piecesNeeded', 'BED_FRAME')?.displayName).toBe('Showroom(bed)');
    expect(getIllustration('PIECE_BED', 'storage', 'LIFT_UP')?.displayName).toBe('Showroom(bed-lift-up)');
    expect(getIllustration('BEDROOM', 'bedSize', 'S_90')).not.toBe(getIllustration('BEDROOM', 'bedSize', 'K_180'));
  });
  it('inventories every registered version and makes retained visuals explicit', () => {
    const rows = answerVisualCoverage();
    expect(rows.some((row) => row.current)).toBe(true);
    expect(rows.some((row) => !row.current)).toBe(true);
    expect(rows.some((row) => row.visual.startsWith('Showroom'))).toBe(true);
    const current = rows.filter((row) => row.current);
    expect(current.filter((row) => row.visual === 'fallback-icon')).toEqual([]);
    console.info('Answer artwork coverage:', JSON.stringify({ total: rows.length, current: current.length, showroom: current.filter((row) => row.visual.startsWith('Showroom')).length, standalone: current.filter((row) => row.visual.startsWith('OptionPhoto')).length, photos: current.filter((row) => row.visual === 'existing-material-opening-photo').length, retained: current.filter((row) => row.visual.startsWith('retained-diagram')).length, missing: current.filter((row) => row.visual === 'fallback-icon').map((row) => `${row.roomType}.${row.stepId}.${row.value}`) }));
  });
  it('uses precise standalone concepts instead of semantically different atlas cells', () => {
    for (const [room, step, value, concept] of [
      ['LIVING', 'piecesNeeded', 'WALL_SHELVES', 'wall-shelves'], ['OFFICE', 'piecesNeeded', 'WALL_SHELVES', 'wall-shelves'],
      ['BEDROOM', 'bedStorage', 'DRAWERS', 'bed-side-drawers'],
      ['DRESSING', 'interiorModules', 'LED_LIGHTING', 'wardrobe-led'],
    ] as const) {
      const Illustration = getIllustration(room, step, value)!;
      expect(Illustration.displayName, `${room}.${step}.${value}`).toBe(`OptionPhoto(${concept})`);
    }
  });
  it('covers every requested artwork family and keeps room layout contexts distinct', () => {
    const concepts = new Set(Object.values(ROOM_OPTION_PHOTOS).flatMap((steps) => Object.values(steps).flatMap((options) => Object.values(options).map((Photo) => Photo.displayName))));
    expect(concepts.size).toBe(41);
    for (const [room, step, values] of [
      ['KITCHEN', 'layout', ['STRAIGHT', 'L_SHAPE', 'U_SHAPE']],
      ['KITCHEN', 'countertop', ['PAL', 'HPL', 'QUARTZ', 'GRANITE']],
      ['DRESSING', 'layout', ['LINEAR', 'L_SHAPE', 'U_SHAPE', 'WALK_IN']],
      ['DRESSING', 'doorType', ['OPEN', 'SLIDING', 'HINGED']],
      ['LIVING', 'tvStyle', ['FLOATING', 'ON_FLOOR', 'COMPLEX_UNIT']],
      ['BEDROOM', 'wardrobeDoorType', ['SLIDING', 'HINGED']],
      ['BEDROOM', 'bedSize', ['S_90', 'M_140', 'Q_160', 'K_180', 'CUSTOM']],
      ['BEDROOM', 'nightstandsCount', ['TWO']],
      ['OFFICE', 'deskShape', ['STRAIGHT', 'L_SHAPE', 'U_SHAPE']],
      ['BATHROOM', 'ventilation', ['WINDOW', 'FAN', 'NONE']],
      ['LAUNDRY', 'piecesNeeded', ['APPLIANCE_HOUSING', 'COUNTERTOP', 'SINK_UNIT']],
      ['PANTRY', 'wallsUsed', ['ONE_WALL', 'L_SHAPE', 'U_SHAPE']],
      ['BALCONY', 'enclosed', ['ENCLOSED', 'OPEN']],
      ['BALCONY', 'piecesNeeded', ['WORKTOP']],
    ] as const) {
      for (const value of values) expect(getIllustration(room, step, value)?.displayName, `${room}.${step}.${value}`).toMatch(/^OptionPhoto\(/);
    }
    expect(getIllustration('KITCHEN', 'layout', 'L_SHAPE')).not.toBe(getIllustration('DRESSING', 'layout', 'L_SHAPE'));
    expect(getIllustration('DRESSING', 'layout', 'L_SHAPE')).not.toBe(getIllustration('PANTRY', 'wallsUsed', 'L_SHAPE'));
    expect(getIllustration('LIVING', 'systemsTvUnit', 'GLISANTE')?.displayName).toBe('OptionPhoto(sliding-doors)');
  });
  it('excludes the neighboring TV shadow while retaining the bookcase and its floor shadow', () => {
    const crop = showroomCropBounds('furniture', SHOWROOM_ATLASES.furniture.indexOf('bookcase'));
    // Limite masurate pe atlasul original 1254px: vecinul ajunge la x=345,
    // biblioteca si umbra proprie incap intre x=380..600, y=340..600.
    expect(crop.x * 1254).toBeGreaterThan(345);
    expect(crop.x * 1254).toBeLessThan(380);
    expect((crop.x + crop.width) * 1254).toBeGreaterThan(600);
    expect(crop.y * 1254).toBeLessThan(340);
    expect((crop.y + crop.height) * 1254).toBeGreaterThan(600);
    expect(getIllustration('LIVING', 'piecesNeeded', 'BOOKSHELF')?.displayName).toBe('Showroom(bookcase)');
    expect(getIllustration('OFFICE', 'piecesNeeded', 'BOOKSHELF')?.displayName).toBe('Showroom(bookcase)');
  });
  it('shows standalone side-by-side appliances without implying a worktop', () => {
    expect(getIllustration('LAUNDRY', 'applianceSetup', 'SIDE_BY_SIDE')?.displayName).toBe('Showroom(side-by-side-washer-dryer)');
  });
  it('renders every current visual and decodes the actual referenced PNG data', () => {
    const components = new Set(answerVisualCoverage().filter((row) => row.current).map((row) => getIllustration(row.roomType as Parameters<typeof getIllustration>[0], row.stepId, row.value)).filter((value) => value !== null));
    const sources = new Set<string>();
    for (const Illustration of components) {
      const markup = renderToStaticMarkup(<Illustration />);
      expect(markup).toMatch(/<svg|<img|background-image/);
      const document = new DOMParser().parseFromString(markup, 'text/html');
      for (const image of document.querySelectorAll('img')) {
        sources.add(image.getAttribute('data-option-art-src') ?? image.getAttribute('src')!);
      }
      for (const match of markup.matchAll(/(?:url\(&quot;|url\()([^"&;)]+\.png)/g)) sources.add(match[1]);
    }
    expect(sources.size).toBeGreaterThan(3);
    for (const source of sources) {
      expect(source).toMatch(/^\/illustrations\//);
      const data = readFileSync(resolve(process.cwd(), 'public', source.slice(1)));
      expect(data.subarray(0, 8).toString('hex'), source).toBe('89504e470d0a1a0a');
      expect(data.readUInt32BE(16), source).toBeGreaterThan(0);
      expect(data.readUInt32BE(20), source).toBeGreaterThan(0);
      const chunks: Buffer[] = [];
      let ended = false;
      for (let offset = 8; offset + 12 <= data.length;) {
        const size = data.readUInt32BE(offset);
        const kind = data.toString('ascii', offset + 4, offset + 8);
        expect(offset + size + 12, source).toBeLessThanOrEqual(data.length);
        if (kind === 'IDAT') chunks.push(data.subarray(offset + 8, offset + 8 + size));
        if (kind === 'IEND') ended = true;
        offset += size + 12;
      }
      expect(ended, source).toBe(true);
      expect(inflateSync(Buffer.concat(chunks)).length, source).toBeGreaterThan(data.readUInt32BE(20));
    }
  });
  it('serves new standalone artwork responsively without sprite windows', () => {
    const Photo = optionPhoto('sliding-doors');
    const { container } = render(<Photo />);
    const image = container.querySelector('img')!;
    expect(image).toHaveAttribute('data-option-art-src', '/illustrations/options/sliding-doors.png');
    expect(image.src).toContain('/_next/image?');
    expect(image).toHaveAttribute('sizes', '(max-width: 639px) 256px, 240px');
    expect(image).toHaveAttribute('alt', '');
    expect(container.querySelector('[style*="background-image"]')).toBeNull();
  });
});

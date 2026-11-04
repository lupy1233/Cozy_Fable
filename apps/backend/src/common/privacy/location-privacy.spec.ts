import { haversineKm } from '../../modules/claims/claims.helpers';
import { PRIVACY_GRID_LAT_DEG, PRIVACY_GRID_LNG_DEG, snapToPrivacyGrid, wholeKm } from './location-privacy';

// E-client-9 — grila de confidentialitate pentru punctul cererii (pre-claim).
describe('snapToPrivacyGrid', () => {
  const points: [string, number, number][] = [
    ['Bucuresti', 44.4268, 26.1025],
    ['Cluj-Napoca', 46.7712, 23.6236],
    ['Suceava', 47.6514, 26.2556],
    ['Constanta', 44.1598, 28.6348],
  ];

  it.each(points)('%s: determinist si la cel mult ~1,5 km de punctul real', (_name, lat, lng) => {
    const a = snapToPrivacyGrid(lat, lng);
    const b = snapToPrivacyGrid(lat, lng);
    expect(a).toEqual(b);
    expect(haversineKm(lat, lng, a.lat, a.lng)).toBeLessThanOrEqual(1.5);
  });

  it('doua puncte din aceeasi celula dau acelasi rezultat (strada nu se mai distinge)', () => {
    const base = snapToPrivacyGrid(44.4268, 26.1025);
    const cellLat = Math.floor(44.4268 / PRIVACY_GRID_LAT_DEG) * PRIVACY_GRID_LAT_DEG;
    const cellLng = Math.floor(26.1025 / PRIVACY_GRID_LNG_DEG) * PRIVACY_GRID_LNG_DEG;
    const other = snapToPrivacyGrid(cellLat + PRIVACY_GRID_LAT_DEG * 0.9, cellLng + PRIVACY_GRID_LNG_DEG * 0.1);
    expect(other).toEqual(base);
  });

  it('punctul rezultat e centrul celulei (idempotent)', () => {
    const once = snapToPrivacyGrid(46.7712, 23.6236);
    expect(snapToPrivacyGrid(once.lat, once.lng)).toEqual(once);
  });
});

describe('wholeKm', () => {
  it.each([
    [0.2, 1],
    [0, 1],
    [1.49, 1],
    [4.9, 5],
    [12.5, 13],
    [37.2, 37],
  ])('%p → %p', (input, expected) => {
    expect(wholeKm(input)).toBe(expected);
    expect(Number.isInteger(wholeKm(input))).toBe(true);
  });
});

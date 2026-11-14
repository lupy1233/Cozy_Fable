import { addressDetailsValue } from './address-details';

describe('addressDetailsValue (b12)', () => {
  it('lipsa campului nu atinge coloana (patch de ciorna)', () => {
    expect(addressDetailsValue(undefined)).toBeUndefined();
  });
  it('gol / doar spatii → NULL', () => {
    expect(addressDetailsValue('')).toBeNull();
    expect(addressDetailsValue('   ')).toBeNull();
    expect(addressDetailsValue(null)).toBeNull();
  });
  it('textul ramane, fara spatii in plus', () => {
    expect(addressDetailsValue('  bl. A2,   sc. 1, ap. 14 ')).toBe('bl. A2, sc. 1, ap. 14');
  });
});

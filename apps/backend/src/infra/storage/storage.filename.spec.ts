import { asciiFilename } from './storage.service';

// E-client-9: numele din Content-Disposition (original pentru client, neutru pentru firme)
describe('asciiFilename', () => {
  it('drops Romanian diacritics instead of replacing them with underscores', () => {
    expect(asciiFilename('Bucătărie ștearsă.jpg')).toBe('Bucatarie_stearsa.jpg');
  });

  it('removes quotes and header separators', () => {
    expect(asciiFilename('a"b;c\r\nd.pdf')).toBe('a_b_c_d.pdf');
  });

  it('keeps neutral names unchanged and never returns an empty name', () => {
    expect(asciiFilename('attachment-1.jpg')).toBe('attachment-1.jpg');
    expect(asciiFilename('')).toBe('file');
  });
});

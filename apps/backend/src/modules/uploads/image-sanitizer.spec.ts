import sharp from 'sharp';
import { isSanitizableImage, sanitizeImage } from './image-sanitizer';

// E-client-9 (C7-3) — pozele ajung la firme fara EXIF/GPS.
describe('sanitizeImage', () => {
  const withGps = () =>
    sharp({ create: { width: 32, height: 32, channels: 3, background: '#cc9966' } })
      .jpeg()
      .withExif({
        IFD0: { Copyright: 'Ana Popescu', ImageDescription: 'Str Aviatorilor 10' },
        IFD3: { GPSLatitudeRef: 'N', GPSLatitude: '44/1 26/1 0/1', GPSLongitudeRef: 'E', GPSLongitude: '26/1 6/1 0/1' },
      })
      .toBuffer();

  it('JPEG cu EXIF + GPS → fara EXIF dupa curatare, ramane JPEG valid', async () => {
    const input = await withGps();
    expect((await sharp(input).metadata()).exif).toBeDefined();
    const out = await sanitizeImage(input, 'image/jpeg');
    const meta = await sharp(out).metadata();
    expect(meta.exif).toBeUndefined();
    expect(meta.format).toBe('jpeg');
    expect(meta.width).toBe(32);
    expect(out.includes(Buffer.from('Aviatorilor'))).toBe(false);
  });

  it('PNG si WEBP raman in formatul lor, fara metadate', async () => {
    const png = await sharp({ create: { width: 8, height: 8, channels: 4, background: '#123456' } }).png().withExif({ IFD0: { Copyright: 'x' } }).toBuffer();
    const pngOut = await sanitizeImage(png, 'image/png');
    expect((await sharp(pngOut).metadata()).format).toBe('png');
    expect((await sharp(pngOut).metadata()).exif).toBeUndefined();
    const webp = await sharp({ create: { width: 8, height: 8, channels: 3, background: '#654321' } }).webp().withExif({ IFD0: { Copyright: 'x' } }).toBuffer();
    const webpOut = await sanitizeImage(webp, 'image/webp');
    expect((await sharp(webpOut).metadata()).format).toBe('webp');
    expect((await sharp(webpOut).metadata()).exif).toBeUndefined();
  });

  it('buffer corupt → arunca (apelantul marcheaza BLOCKED)', async () => {
    await expect(sanitizeImage(Buffer.from('nu e o imagine'), 'image/jpeg')).rejects.toThrow();
    const truncated = (await withGps()).subarray(0, 60);
    await expect(sanitizeImage(truncated, 'image/jpeg')).rejects.toThrow();
  });

  it('doar jpeg/png/webp sunt re-encodate', () => {
    expect(isSanitizableImage('image/jpeg')).toBe(true);
    expect(isSanitizableImage('application/pdf')).toBe(false);
    expect(isSanitizableImage('application/zip')).toBe(false);
  });
});

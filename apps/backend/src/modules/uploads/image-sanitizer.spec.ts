import sharp from 'sharp';
import * as zlib from 'zlib';
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

  // b5 pas 4 (audit L5: PNG 16x16 de 85 B respins). Un PNG minim scris de mana, cu sume de
  // control corecte, trece; doar unul cu CRC gresit e refuzat (Windows il deschide, libpng nu).
  describe('PNG minim scris de mana', () => {
    const crc32 = (buf: Buffer) => {
      let crc = 0xffffffff;
      for (const byte of buf) {
        crc ^= byte;
        for (let k = 0; k < 8; k++) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
      }
      return (crc ^ 0xffffffff) >>> 0;
    };
    const chunk = (type: string, data: Buffer, badCrc = false) => {
      const len = Buffer.alloc(4);
      len.writeUInt32BE(data.length);
      const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
      const crc = Buffer.alloc(4);
      crc.writeUInt32BE(badCrc ? 0 : crc32(body));
      return Buffer.concat([len, body, crc]);
    };
    const tinyPng = (badCrc = false) => {
      const ihdr = Buffer.alloc(13);
      ihdr.writeUInt32BE(16, 0);
      ihdr.writeUInt32BE(16, 4);
      ihdr[8] = 8; // bit depth
      ihdr[9] = 2; // RGB
      const raw = Buffer.alloc((16 * 3 + 1) * 16, 0x80);
      for (let y = 0; y < 16; y++) raw[y * (16 * 3 + 1)] = 0; // filtru 0 pe fiecare rand
      return Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        chunk('IHDR', ihdr),
        chunk('IDAT', zlib.deflateSync(raw), badCrc),
        chunk('IEND', Buffer.alloc(0)),
      ]);
    };

    it('16x16 sub 100 B, sume corecte → curatat, ramane PNG 16x16', async () => {
      const input = tinyPng();
      expect(input.length).toBeLessThan(100);
      const meta = await sharp(await sanitizeImage(input, 'image/png')).metadata();
      expect(meta.format).toBe('png');
      expect(meta.width).toBe(16);
    });

    it('acelasi PNG cu CRC gresit → arunca (fisier deteriorat)', async () => {
      await expect(sanitizeImage(tinyPng(true), 'image/png')).rejects.toThrow();
    });
  });

  it('doar jpeg/png/webp sunt re-encodate', () => {
    expect(isSanitizableImage('image/jpeg')).toBe(true);
    expect(isSanitizableImage('application/pdf')).toBe(false);
    expect(isSanitizableImage('application/zip')).toBe(false);
  });
});

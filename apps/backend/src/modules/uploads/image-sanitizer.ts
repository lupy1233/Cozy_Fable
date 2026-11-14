import sharp from 'sharp';

// E-client-9 (C7-3): pozele clientului ajung la firme inainte de claim. Re-encodarea in
// worker elimina metadatele ascunse (EXIF, GPS, XMP, IPTC, comentarii) si aplica orientarea.
// sharp NU pastreaza metadatele decat cu withMetadata/keepExif — nu le apelam niciodata.
export const SANITIZABLE_IMAGE_MIME = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type SanitizableImageMime = (typeof SANITIZABLE_IMAGE_MIME)[number];

// fara cache de fisiere/iesiri intre joburi si un singur fir libvips per job (worker partajat)
sharp.cache(false);
sharp.concurrency(1);

// ~40 MP: peste orice poza de telefon, sub "bombele" de decompresie
const MAX_INPUT_PIXELS = 40_000_000;

export function isSanitizableImage(mime: string): mime is SanitizableImageMime {
  return (SANITIZABLE_IMAGE_MIME as readonly string[]).includes(mime);
}

// h1 (etapa 11): tipul imaginii dupa CONTINUT (semnatura de la inceputul fisierului), nu dupa
// extensie sau antetul trimis de browser. SVG / HTML / orice altceva → null.
export function detectImageMime(bytes: Uint8Array): SanitizableImageMime | null {
  const at = (i: number) => bytes[i];
  if (bytes.length >= 3 && at(0) === 0xff && at(1) === 0xd8 && at(2) === 0xff) return 'image/jpeg';
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length >= 8 && png.every((b, i) => at(i) === b)) return 'image/png';
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.subarray(from, to));
  if (bytes.length >= 12 && ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'image/webp';
  return null;
}

// Arunca la imagine corupta/necunoscuta (failOn: 'error') — apelantul marcheaza BLOCKED.
export async function sanitizeImage(input: Buffer, mime: SanitizableImageMime): Promise<Buffer> {
  const pipeline = sharp(input, {
    failOn: 'error',
    limitInputPixels: MAX_INPUT_PIXELS,
    animated: mime === 'image/webp',
  }).rotate();
  if (mime === 'image/jpeg') return pipeline.jpeg({ quality: 88 }).toBuffer();
  if (mime === 'image/png') return pipeline.png().toBuffer();
  return pipeline.webp({ quality: 88 }).toBuffer();
}

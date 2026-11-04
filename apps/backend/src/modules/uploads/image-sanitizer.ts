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

// Ilustratii foto (redari 3D cu fundal transparent) pentru materiale si
// sisteme de deschidere — inlocuiesc desenele line-art pe cardurile de raspuns
// (PO 2026-07-31). PNG-urile stau in /public/illustrations, decupate pe
// conturul alpha si redimensionate la 480px.
import type { IllustrationProps } from './common';

function photo(src: string) {
  function PhotoIllustration({ className }: IllustrationProps) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        aria-hidden="true"
        loading="lazy"
        decoding="async"
        className={'h-full w-full object-contain ' + (className ?? '')}
      />
    );
  }
  return PhotoIllustration;
}

// --- materiale ---
export const PhotoPal = photo('/illustrations/pal.png');
export const PhotoMdfVopsit = photo('/illustrations/mdf-vopsit.png');
export const PhotoMdfInfoliat = photo('/illustrations/mdf-infoliat.png');
export const PhotoMdfFurnir = photo('/illustrations/mdf-furnir.png');
export const PhotoLemnMasiv = photo('/illustrations/lemn-masiv.png');
export const PhotoAltMaterial = photo('/illustrations/altul.png');

// --- sisteme de deschidere ---
export const PhotoManer = photo('/illustrations/maner.png');
export const PhotoPush = photo('/illustrations/push.png');
export const PhotoGola = photo('/illustrations/gola.png');
export const PhotoAventos = photo('/illustrations/aventos.png');
export const PhotoGlisante = photo('/illustrations/glisante.png');

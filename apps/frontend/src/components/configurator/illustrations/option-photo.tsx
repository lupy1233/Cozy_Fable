import Image from 'next/image';
import type { IllustrationProps } from './common';

// Imagini individuale: optimizare Next la dimensiunea cardului, fara vecini de atlas.
export function optionPhoto(concept: string) {
  const src = `/illustrations/options/${concept}.png`;
  function OptionPhoto({ className }: IllustrationProps) {
    return <Image
      src={src}
      width={768}
      height={768}
      sizes="(max-width: 639px) 256px, 240px"
      alt=""
      aria-hidden="true"
      data-option-art={concept}
      data-option-art-src={src}
      className={`h-full w-full object-contain mix-blend-multiply ${className ?? ''}`}
    />;
  }
  OptionPhoto.displayName = `OptionPhoto(${concept})`;
  return OptionPhoto;
}

import type { RoomType } from '@marketplace/shared';
import Image, { getImageProps } from 'next/image';
import type { ComponentType } from 'react';
import { cn } from '@/lib/utils';
import type { IllustrationProps } from './illustrations/common';
import { IlluOtherPiece } from './illustrations/room-pieces';
import { SHOWROOM_ATLASES, showroomCropStyle, type ShowroomConcept } from './illustrations/showroom-atlas';

// Imaginea unei camere / piese in cosul cererii. Refoloseste redarile 3D pe care
// clientul le vede apoi in intrebari (pozele de optiuni si atlasele "showroom"),
// ca pasul de cos si chestionarul sa arate la fel. Piesele tapitate (canapea,
// fotoliu, taburet) nu existau in atlase: au redari proprii, in acelasi stil,
// generate cu tools/make-cart-renders.py. Doar "Alta piesa" ramane schita.

type CartArt =
  | { kind: 'photo'; src: string; width: number; height: number }
  | { kind: 'atlas'; concept: ShowroomConcept }
  | { kind: 'sketch'; Sketch: ComponentType<IllustrationProps> };

const option = (concept: string): CartArt => ({
  kind: 'photo',
  src: `/illustrations/options/${concept}.png`,
  width: 768,
  height: 768,
});
// latime / inaltime = fisierul scris de tools/make-cart-renders.py
const piece = (name: string, width: number, height: number): CartArt => ({
  kind: 'photo',
  src: `/illustrations/pieces/${name}.png`,
  width,
  height,
});
const atlas = (concept: ShowroomConcept): CartArt => ({ kind: 'atlas', concept });
const sketch = (Sketch: ComponentType<IllustrationProps>): CartArt => ({ kind: 'sketch', Sketch });

export const CART_ART: Record<RoomType, CartArt> = {
  KITCHEN: option('kitchen-layout-l'),
  DRESSING: option('dressing-layout-u'),
  LIVING: option('tv-complex'),
  BEDROOM: option('bed-side-drawers'),
  OFFICE: option('desk-l'),
  BATHROOM: atlas('vanity-sink'),
  HALLWAY: atlas('coat-unit'),
  LAUNDRY: option('laundry-appliance-housing'),
  PANTRY: option('pantry-layout-l'),
  BALCONY: option('balcony-enclosed'),
  PIECE_WARDROBE: atlas('wardrobe'),
  PIECE_TV_UNIT: atlas('tv-unit'),
  PIECE_BOOKCASE: atlas('bookcase'),
  PIECE_DESK: atlas('desk'),
  PIECE_BED: atlas('bed'),
  PIECE_DRESSER: atlas('dresser'),
  PIECE_TABLE: atlas('dining-table'),
  PIECE_SHOE_CABINET: atlas('shoe-cabinet'),
  PIECE_NIGHTSTAND: atlas('nightstand'),
  PIECE_BENCH: atlas('bench'),
  PIECE_SIDEBOARD: atlas('mixed-storage'),
  PIECE_WALL_CABINET: atlas('wall-cabinet'),
  PIECE_BATHROOM_VANITY: atlas('vanity-sink'),
  PIECE_ENTRYWAY: atlas('coat-unit'),
  PIECE_SOFA: piece('sofa', 1200, 800),
  PIECE_ARMCHAIR: piece('armchair', 960, 960),
  PIECE_OTTOMAN: piece('ottoman', 1080, 900),
  PIECES: sketch(IlluOtherPiece),
};

type AtlasName = keyof typeof SHOWROOM_ATLASES;

// Atlasele au ~1,2 MB ca PNG; prin optimizatorul Next vin ca WebP/AVIF la o
// fractiune din greutate. getImageProps da acelasi URL pe care l-ar cere <Image>.
const ATLAS_URL = Object.fromEntries(
  (Object.keys(SHOWROOM_ATLASES) as AtlasName[]).map((name) => [
    name,
    getImageProps({ src: `/illustrations/showroom-${name}.png`, alt: '', width: 1254, height: 1254 }).props.src,
  ]),
) as Record<AtlasName, string>;

function atlasCell(concept: ShowroomConcept): { name: AtlasName; index: number } {
  for (const name of Object.keys(SHOWROOM_ATLASES) as AtlasName[]) {
    const index = (SHOWROOM_ATLASES[name] as readonly string[]).indexOf(concept);
    if (index >= 0) return { name, index };
  }
  throw new Error(`Unknown showroom concept ${concept}`);
}

export function CartVisual({
  roomType,
  size,
  className,
}: {
  roomType: RoomType;
  // 'tile' = cartonasul din catalog; 'thumb' = miniatura din cos
  size: 'tile' | 'thumb';
  className?: string;
}) {
  const art = CART_ART[roomType];

  if (art.kind === 'photo') {
    return (
      <Image
        src={art.src}
        width={art.width}
        height={art.height}
        sizes={size === 'tile' ? '(max-width: 639px) 45vw, 256px' : '48px'}
        alt=""
        aria-hidden="true"
        className={cn('h-full w-full object-contain mix-blend-multiply', className)}
      />
    );
  }

  if (art.kind === 'atlas') {
    const { name, index } = atlasCell(art.concept);
    return (
      <span className={cn('flex h-full w-full items-center justify-center', className)} aria-hidden="true">
        <span className="flex aspect-square h-full max-w-full items-center justify-center overflow-hidden mix-blend-multiply">
          <span
            className="block shrink-0"
            style={{ ...showroomCropStyle(name, index), backgroundImage: `url("${ATLAS_URL[name]}")` }}
          />
        </span>
      </span>
    );
  }

  const { Sketch } = art;
  return (
    <span
      // schita e mai "grea" decat o redare: o tinem mai mica, sa nu domine randul
      className={cn(
        'flex h-full w-full items-center justify-center text-walnut/70 [&_svg]:w-auto',
        size === 'tile' ? '[&_svg]:h-[62%]' : '[&_svg]:h-full',
        className,
      )}
      aria-hidden="true"
    >
      <Sketch />
    </span>
  );
}

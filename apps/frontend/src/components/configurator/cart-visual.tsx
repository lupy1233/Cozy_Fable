import type { RoomType } from '@marketplace/shared';
import Image, { getImageProps } from 'next/image';
import type { ComponentType } from 'react';
import { cn } from '@/lib/utils';
import { IllustrationSvg, type IllustrationProps } from './illustrations/common';
import { IlluOtherPiece } from './illustrations/room-pieces';
import { SHOWROOM_ATLASES, showroomCropStyle, type ShowroomConcept } from './illustrations/showroom-atlas';

// Imaginea unei camere / piese in cosul cererii. Refoloseste redarile 3D pe care
// clientul le vede apoi in intrebari (pozele de optiuni si atlasele "showroom"),
// ca pasul de cos si chestionarul sa arate la fel. Tipurile fara redare (canapea,
// fotoliu, taburet, "Alta piesa") primesc o schita line-art, nu o poza inventata.

// --- schite pentru piesele tapitate (fara redare 3D in atlase) ---

function SketchSofa({ className }: IllustrationProps) {
  return (
    <IllustrationSvg className={className}>
      <path d="M24 46V32a8 8 0 0 1 8-8h56a8 8 0 0 1 8 8v14" />
      <path d="M14 66V50a6 6 0 0 1 12 0v6h68v-6a6 6 0 0 1 12 0v16z" />
      <path d="M60 24v32" />
      <path d="M24 66v8M96 66v8" />
    </IllustrationSvg>
  );
}

function SketchArmchair({ className }: IllustrationProps) {
  return (
    <IllustrationSvg className={className}>
      <path d="M40 46V30a8 8 0 0 1 8-8h24a8 8 0 0 1 8 8v16" />
      <path d="M30 66V50a6 6 0 0 1 12 0v6h36v-6a6 6 0 0 1 12 0v16z" />
      <path d="M40 66v8M80 66v8" />
    </IllustrationSvg>
  );
}

function SketchOttoman({ className }: IllustrationProps) {
  return (
    <IllustrationSvg className={className}>
      <rect x="28" y="32" width="64" height="32" rx="12" />
      <path d="M28 46h64" />
      <path d="M40 64v8M80 64v8" />
    </IllustrationSvg>
  );
}

type CartArt =
  | { kind: 'option'; concept: string }
  | { kind: 'atlas'; concept: ShowroomConcept }
  | { kind: 'sketch'; Sketch: ComponentType<IllustrationProps> };

const option = (concept: string): CartArt => ({ kind: 'option', concept });
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
  PIECE_SOFA: sketch(SketchSofa),
  PIECE_ARMCHAIR: sketch(SketchArmchair),
  PIECE_OTTOMAN: sketch(SketchOttoman),
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

  if (art.kind === 'option') {
    return (
      <Image
        src={`/illustrations/options/${art.concept}.png`}
        width={768}
        height={768}
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

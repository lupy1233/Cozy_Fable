import type { IllustrationProps } from './common';
import type { CSSProperties } from 'react';

// Ordine row-major in atlasele originale, fara re-encodarea imaginilor generate.
export const SHOWROOM_ATLASES = {
  furniture: ['wardrobe', 'bed', 'nightstand', 'dresser', 'tv-unit', 'bookcase', 'desk', 'dining-table', 'coffee-table', 'console-table', 'shoe-cabinet', 'bench', 'coat-unit', 'mirror-shelf', 'vanity-table', 'glass-display'],
  appliances: ['base-cabinet', 'wall-cabinet', 'tall-pantry', 'island', 'oven', 'hob', 'hood', 'dishwasher', 'fridge', 'microwave', 'vanity-sink', 'mirror-cabinet', 'tall-bath-storage', 'washer', 'stacked-washer-dryer', 'side-by-side-washer-dryer'],
  configurations: ['bed-lift-up', 'bed-drawers', 'upholstered-bed', 'hanging-rod', 'open-shelves', 'shoe-rack', 'wardrobe-accessories', 'led-shelf', 'closed-cabinet', 'mixed-storage', 'storage-bench', 'shoe-bench', 'round-table', 'extendable-table', 'drawer-pedestal', 'desk-cable-port'],
} as const;

export type ShowroomConcept = typeof SHOWROOM_ATLASES[keyof typeof SHOWROOM_ATLASES][number];

// Generatorul nu aliniaza perfect randurile; ferestrele urmeaza spatiul alb real.
// Decuparea ramane CSS, fara procesare sau re-encodare PNG.
export function showroomCropBounds(atlas: keyof typeof SHOWROOM_ATLASES, index: number) {
  // Umbra comodei TV din celula vecina intra prin stanga ferestrei standard.
  // Limita pastreaza biblioteca si umbra ei completa, fara a atinge PNG-ul.
  if (atlas === 'furniture' && SHOWROOM_ATLASES.furniture[index] === 'bookcase') {
    return { x: .28, y: .25, width: .20, height: .24 };
  }
  const rows = atlas === 'furniture' ? [0, .25, .49, .71, 1] : atlas === 'appliances' ? [0, .25, .48, .72, 1] : [0, .25, .49, .72, 1];
  const row = Math.floor(index / 4), col = index % 4;
  const columns = atlas === 'configurations' && row === 3 ? [0, .243, .505, .74, 1] : [0, .25, .5, .75, 1];
  const x = columns[col], y = rows[row];
  const width = columns[col + 1] - x, height = rows[row + 1] - y;
  return { x, y, width, height };
}

export function showroomCropStyle(atlas: keyof typeof SHOWROOM_ATLASES, index: number): CSSProperties {
  const { x, y, width, height } = showroomCropBounds(atlas, index);
  const extent = Math.max(width, height);
  return {
    width: `${width / extent * 100}%`, height: `${height / extent * 100}%`,
    backgroundImage: `url('/illustrations/showroom-${atlas}.png')`,
    backgroundSize: `${100 / width}% ${100 / height}%`,
    backgroundPosition: `${x / (1 - width) * 100}% ${y / (1 - height) * 100}%`,
    backgroundRepeat: 'no-repeat',
  };
}

export function showroomPhoto(concept: ShowroomConcept) {
  const atlas = Object.entries(SHOWROOM_ATLASES).find(([, concepts]) => (concepts as readonly string[]).includes(concept))!;
  const index = (atlas[1] as readonly string[]).indexOf(concept);
  function ShowroomPhoto({ className }: IllustrationProps) {
    return <span className={`flex h-full w-full items-center justify-center ${className ?? ''}`} aria-hidden="true">
      <span className="flex aspect-square h-full max-w-full items-center justify-center overflow-hidden mix-blend-multiply" data-showroom-concept={concept}>
        <span className="block shrink-0" style={showroomCropStyle(atlas[0] as keyof typeof SHOWROOM_ATLASES, index)} />
      </span>
    </span>;
  }
  ShowroomPhoto.displayName = `Showroom(${concept})`;
  return ShowroomPhoto;
}

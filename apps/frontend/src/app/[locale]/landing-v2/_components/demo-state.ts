import { create } from 'zustand';

// Starea mini-configuratorului din hero, partajata cu statia 1 din "Drumul
// cererii" (PO r12): ce alege vizitatorul sus devine "cererea lui" mai jos —
// pagina demonstreaza continuitatea, nu doar o afirma. Doar in memorie.

export type PieceKind = 'WARDROBE' | 'BOOKCASE' | 'TV';
export type DemoMaterial = 'WHITE' | 'WOOD' | 'SAGE';

// configuratia fiecarei piese: doua latimi reale + variantele intrebarii a 4-a
export const DEMO_PIECES: Record<
  PieceKind,
  { widths: [number, number]; variants: readonly string[] }
> = {
  WARDROBE: { widths: [160, 240], variants: ['MANER', 'PUSH', 'GLISANTE'] },
  BOOKCASE: { widths: [120, 180], variants: ['OPEN', 'DOORS'] },
  TV: { widths: [160, 220], variants: ['MANER', 'PUSH'] },
};

// vizualul cardului per material / varianta de deschidere (redarile reale)
export const MATERIAL_CARD: Record<DemoMaterial, { img?: string; swatch?: string }> = {
  WHITE: { img: '/illustrations/mdf-vopsit.png' },
  WOOD: { img: '/illustrations/mdf-furnir.png' },
  SAGE: { swatch: 'hsl(var(--sage) / 0.55)' },
};
export const VARIANT_CARD: Record<string, { img?: string; shelves?: boolean }> = {
  MANER: { img: '/illustrations/maner.png' },
  PUSH: { img: '/illustrations/push.png' },
  GLISANTE: { img: '/illustrations/glisante.png' },
  DOORS: { img: '/illustrations/maner.png' },
  OPEN: { shelves: true },
};

interface DemoState {
  piece: PieceKind;
  wide: boolean;
  material: DemoMaterial;
  variant: string;
  pickPiece: (piece: PieceKind) => void;
  setWide: (wide: boolean) => void;
  setMaterial: (material: DemoMaterial) => void;
  setVariant: (variant: string) => void;
}

export const useDemoStore = create<DemoState>((set) => ({
  piece: 'WARDROBE',
  wide: false,
  material: 'WHITE',
  variant: 'MANER',
  // varianta curenta poate sa nu existe la piesa noua → prima valida
  pickPiece: (piece) =>
    set((s) => ({
      piece,
      variant: DEMO_PIECES[piece].variants.includes(s.variant)
        ? s.variant
        : DEMO_PIECES[piece].variants[0],
    })),
  setWide: (wide) => set({ wide }),
  setMaterial: (material) => set({ material }),
  setVariant: (variant) => set({ variant }),
}));

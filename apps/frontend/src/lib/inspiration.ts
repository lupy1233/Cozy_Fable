// Galeria de pe LANDING — subset static curat din portofoliul Mobila Unicat
// (R6: aceleasi imagini ca in caietul de idei din DB; CDN-ul lor Webflow).
// Fiecare pin are un tip pentru linkul de filtrare /inspiration?type=…;
// titlurile vin din i18n: Inspiration.pins.<id>.

export type FurnitureType = 'kitchen' | 'living' | 'bedroom' | 'dressing' | 'office';

export const FURNITURE_TYPES: FurnitureType[] = [
  'kitchen',
  'living',
  'bedroom',
  'dressing',
  'office',
];

const CDN = 'https://cdn.prod.website-files.com/60c4bb3c4288c6dd046e1d07';

export interface InspirationPin {
  id: string;
  type: FurnitureType;
  img: string;
}

export const INSPIRATION_PINS: InspirationPin[] = [
  { id: 'kitchen-black-gold', type: 'kitchen', img: `${CDN}/61bb1e2b0bac79833378c9ab_a56-min.jpg` },
  { id: 'kitchen-island-chevron', type: 'kitchen', img: `${CDN}/697bb2694cd704616f2058ab__MG_7387%201.png` },
  { id: 'living-stone-tv', type: 'living', img: `${CDN}/697bb2602ffc7c1c50eeacb0__MG_7414%201.png` },
  { id: 'living-bookcase-wall', type: 'living', img: `${CDN}/60cc8f9646fc8053088b6797__MG_5769-min.jpg` },
  { id: 'bedroom-petrol', type: 'bedroom', img: `${CDN}/61d6f5fa28804833e181242e_One%20Eliade%20T1-12-min.jpg` },
  { id: 'bedroom-wood-slats', type: 'bedroom', img: `${CDN}/64bfda84ae2c07d0914599cb__MG_2068-min.jpg` },
  { id: 'dressing-walkin-oak', type: 'dressing', img: `${CDN}/64bfda482655df9626749523__MG_2079-min.jpg` },
  { id: 'office-slats', type: 'office', img: `${CDN}/61289ccc114306d534848566_Living%20room-min.jpg` },
];

// subsetul afisat pe landing (echilibrat pe tipuri)
export const LANDING_PIN_IDS = [
  'kitchen-black-gold',
  'living-stone-tv',
  'dressing-walkin-oak',
  'bedroom-petrol',
  'kitchen-island-chevron',
  'living-bookcase-wall',
  'office-slats',
  'bedroom-wood-slats',
] as const;

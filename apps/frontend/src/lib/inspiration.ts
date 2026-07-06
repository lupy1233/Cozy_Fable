// Galeria de inspiratie (stil Pinterest) — dataset curat static pentru MVP.
// Sursa: Unsplash (URL-uri stabile; fiecare imagine verificata vizual ca
// tipul de mobilier sa fie corect). Fiecare pin are un tip (pentru
// filtrare) si un link de cautare Pinterest pe tipul lui.
// Titlurile vin din i18n: Inspiration.pins.<id>.

export type FurnitureType = 'kitchen' | 'living' | 'bedroom' | 'dressing' | 'office';

export const FURNITURE_TYPES: FurnitureType[] = [
  'kitchen',
  'living',
  'bedroom',
  'dressing',
  'office',
];

// interogarea Pinterest per tip (RO — publicul tinta)
const PINTEREST_QUERY: Record<FurnitureType, string> = {
  kitchen: 'bucatarie mobila la comanda',
  living: 'living mobilier la comanda',
  bedroom: 'dormitor mobila la comanda',
  dressing: 'dressing la comanda',
  office: 'birou acasa mobilier',
};

export function pinterestUrl(type: FurnitureType): string {
  return `https://ro.pinterest.com/search/pins/?q=${encodeURIComponent(PINTEREST_QUERY[type])}`;
}

const img = (id: string, w = 640) =>
  `https://images.unsplash.com/photo-${id}?w=${w}&q=75&auto=format&fit=crop`;

export interface InspirationPin {
  id: string;
  type: FurnitureType;
  img: string;
}

export const INSPIRATION_PINS: InspirationPin[] = [
  { id: 'kitchen-bright', type: 'kitchen', img: img('1556911220-bff31c812dba') },
  { id: 'living-green-sofa', type: 'living', img: img('1555041469-a586c61ea9bc') },
  { id: 'bedroom-classic', type: 'bedroom', img: img('1505693416388-ac5ce068fe85') },
  { id: 'dressing-vintage', type: 'dressing', img: img('1558997519-83ea9252edf8') },
  { id: 'office-desk', type: 'office', img: img('1518455027359-f3f8164ba6bd') },
  { id: 'reading-corner', type: 'living', img: img('1586023492125-27b2c045efd7') },
  { id: 'kitchen-island', type: 'kitchen', img: img('1565538810643-b5bdb714032a') },
  { id: 'bedroom-minimal', type: 'bedroom', img: img('1595526114035-0d45ed16cfbf') },
  { id: 'living-cat', type: 'living', img: img('1493663284031-b7e3aefcae8e') },
  { id: 'dressing-shelves', type: 'dressing', img: img('1595428774223-ef52624120d2') },
  { id: 'bedroom-hotel', type: 'bedroom', img: img('1540518614846-7eded433c457') },
  { id: 'kitchen-l', type: 'kitchen', img: img('1600489000022-c2086d79f9d4') },
  { id: 'living-boho', type: 'living', img: img('1631679706909-1844bbd07221') },
  { id: 'office-light', type: 'office', img: img('1497215728101-856f4ea42174') },
  { id: 'living-lounge', type: 'living', img: img('1524758631624-e2822e304c36') },
  { id: 'sofa-statement', type: 'living', img: img('1567016432779-094069958ea5') },
  { id: 'dressing-open', type: 'dressing', img: img('1441986300917-64674bd600d8') },
  { id: 'living-shelving', type: 'living', img: img('1594026112284-02bb6f3352fe') },
  { id: 'living-stairs', type: 'living', img: img('1600566753086-00f18fb6b3ea') },
  { id: 'living-modern', type: 'living', img: img('1616486338812-3dadae4b4ace') },
];

// subsetul afisat pe landing (echilibrat pe tipuri)
export const LANDING_PIN_IDS = [
  'kitchen-bright',
  'living-green-sofa',
  'dressing-vintage',
  'bedroom-classic',
  'kitchen-island',
  'living-cat',
  'office-desk',
  'bedroom-hotel',
] as const;

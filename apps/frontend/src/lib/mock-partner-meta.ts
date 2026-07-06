// MOCK (Bible §1.4): ratingul Google si descrierea scurta a partenerilor
// nu exista inca in modelul de date (integrarea Google reviews e
// semi-manuala, post-MVP; descrierea firmei vine odata cu profilul
// extins). Pana atunci derivam deterministe de prezentare din id-ul
// firmei, ca landing-ul sa arate ca produsul final. Inlocuire ulterioara:
// campuri reale pe PartnerDto (rating, reviewsCount, shortDescription)
// fara refactor de UI.

export interface PartnerMeta {
  rating: number;
  reviewsCount: number;
  specialtyKey: 'kitchens' | 'dressings' | 'living' | 'full';
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

const SPECIALTIES: PartnerMeta['specialtyKey'][] = ['kitchens', 'dressings', 'living', 'full'];

export function mockPartnerMeta(companyId: string): PartnerMeta {
  const h = hash(companyId);
  return {
    rating: Math.round((4.6 + (h % 5) * 0.1) * 10) / 10, // 4.6 – 5.0
    reviewsCount: 38 + (h % 180),
    specialtyKey: SPECIALTIES[h % SPECIALTIES.length],
  };
}

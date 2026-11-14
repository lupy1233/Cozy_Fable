// a3 (etapa 4): rubricile tabelului de comparare, in ordinea din tabel. Le folosesc si tabelul
// real (offers-comparison.tsx), si exemplul de pe prima pagina (landing-compare-demo.tsx), cu
// aceleasi etichete (Quotes.compare.*), ca exemplul sa nu promita alte rubrici decat oferta reala.
// "design" apare doar la cererile cu proiectare cu plata (exemplul e o bucatarie fara proiectare).
export const COMPARE_ROW_KEYS = [
  'price',
  'vat',
  'totalLeiVat',
  'design',
  'term',
  'warranty',
  'transport',
  'assembly',
  'status',
] as const;
export type CompareRowKey = (typeof COMPARE_ROW_KEYS)[number];

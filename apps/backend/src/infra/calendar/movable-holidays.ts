// docs/02 §3.3 + Decizia 6: sarbatori mobile RO (zile lucratoare care devin libere).
// Sursa unica pentru seed, teste si verificarea migrarii. Datele au fost verificate cu
// date-holidays (reguli 'orthodox -2' / 'orthodox 1' / 'orthodox 50'); in runtime vin DOAR
// din business_calendar_holidays (migrare + admin), biblioteca e doar referinta.
export const MOVABLE_HOLIDAYS: ReadonlyArray<{ date: string; name: string }> = [
  { date: '2025-04-18', name: 'Vinerea Mare' },
  { date: '2025-04-21', name: 'A doua zi de Paste' },
  { date: '2025-06-09', name: 'A doua zi de Rusalii' },
  { date: '2026-04-10', name: 'Vinerea Mare' },
  { date: '2026-04-13', name: 'A doua zi de Paste' },
  { date: '2026-06-01', name: 'A doua zi de Rusalii' },
  { date: '2027-04-30', name: 'Vinerea Mare' },
  { date: '2027-05-03', name: 'A doua zi de Paste' },
  { date: '2027-06-21', name: 'A doua zi de Rusalii' },
  { date: '2028-04-14', name: 'Vinerea Mare' },
  { date: '2028-04-17', name: 'A doua zi de Paste' },
  { date: '2028-06-05', name: 'A doua zi de Rusalii' },
  { date: '2029-04-06', name: 'Vinerea Mare' },
  { date: '2029-04-09', name: 'A doua zi de Paste' },
  { date: '2029-05-28', name: 'A doua zi de Rusalii' },
  { date: '2030-04-26', name: 'Vinerea Mare' },
  { date: '2030-04-29', name: 'A doua zi de Paste' },
  { date: '2030-06-17', name: 'A doua zi de Rusalii' },
];

export const MOVABLE_HOLIDAYS_LAST_YEAR = 2030;

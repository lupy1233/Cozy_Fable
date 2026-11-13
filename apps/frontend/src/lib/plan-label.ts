// E-admin-platform-58: planurile sunt date — numele afisat e numele din limba curenta,
// apoi cel din cealalta limba, apoi codul planului (SILVER/GOLD/PLATINUM nu au nume).
export function planDisplayName(
  plan: { code?: string | null; tier?: string | null; nameRo?: string | null; nameEn?: string | null },
  locale: string,
): string {
  const [own, other] = locale === 'en' ? [plan.nameEn, plan.nameRo] : [plan.nameRo, plan.nameEn];
  return own?.trim() || other?.trim() || plan.code || plan.tier || '';
}

// h2: eticheta citibila a planurilor istorice (seed-ul lor nu are nume, doar codul).
const KNOWN_PLAN_LABELS: Record<string, string> = { SILVER: 'Silver', GOLD: 'Gold', PLATINUM: 'Platinum' };

// Numele planului pentru propozitii („Abonamentul Gold a expirat…”): numele din baza de date,
// altfel eticheta codului cunoscut, altfel '' (apelantul foloseste textul fara nume).
export function planSentenceName(
  plan: { code?: string | null; nameRo?: string | null; nameEn?: string | null },
  locale: string,
): string {
  const [own, other] = locale === 'en' ? [plan.nameEn, plan.nameRo] : [plan.nameRo, plan.nameEn];
  return own?.trim() || other?.trim() || KNOWN_PLAN_LABELS[plan.code?.trim().toUpperCase() ?? ''] || '';
}

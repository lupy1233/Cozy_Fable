// E-admin-platform-58: planurile sunt date — numele afisat e numele din limba curenta,
// apoi cel din cealalta limba, apoi codul planului (SILVER/GOLD/PLATINUM nu au nume).
export function planDisplayName(
  plan: { code?: string | null; tier?: string | null; nameRo?: string | null; nameEn?: string | null },
  locale: string,
): string {
  const [own, other] = locale === 'en' ? [plan.nameEn, plan.nameRo] : [plan.nameRo, plan.nameEn];
  return own?.trim() || other?.trim() || plan.code || plan.tier || '';
}

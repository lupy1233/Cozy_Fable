'use client';

import { useLocale, useTranslations } from 'next-intl';
import { formatAmount } from '@/lib/money';

// Suma cu unitate localizata: "121,00 lei" (RO) / "121.00 RON" (EN)
export function useMoney() {
  const locale = useLocale();
  const t = useTranslations('Common');
  return (n: number) => t('money', { amount: formatAmount(n, locale) });
}

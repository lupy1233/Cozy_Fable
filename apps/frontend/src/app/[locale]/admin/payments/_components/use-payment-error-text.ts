'use client';

import { useTranslations } from 'next-intl';
import { ApiError } from '@/lib/api';

// Eroarea API mapata pe cod (AdminPayments.apiErrors.*), cu fallback pe INTERNAL_ERROR.
export function usePaymentErrorText() {
  const t = useTranslations('AdminPayments');
  return (err: unknown): string => {
    const code = err instanceof ApiError ? err.code : 'INTERNAL_ERROR';
    return t.has(`apiErrors.${code}`) ? t(`apiErrors.${code}`) : t('apiErrors.INTERNAL_ERROR');
  };
}

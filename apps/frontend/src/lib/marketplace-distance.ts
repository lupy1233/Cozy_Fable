import type { MarketplaceItemDto } from '@marketplace/shared';

type Translate = (key: string, values?: Record<string, string | number>) => string;

// E-client-9: distanta pre-claim vine din punctul APROXIMAT al cererii (grila ~2 km) —
// km intregi cu "≈" sau doar banda, dupa setarea din Admin (distanceKm null = BAND).
// `t` = useTranslations('Marketplace').
export function distanceLabel(item: Pick<MarketplaceItemDto, 'distanceKm' | 'distanceBand'>, t: Translate): string {
  if (item.distanceKm != null) return t('distanceApprox', { km: item.distanceKm });
  return t(`distanceBand.${item.distanceBand}`);
}

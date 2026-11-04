export const BUCHAREST_TZ = 'Europe/Bucharest';

// data calendaristica (fara ora) in Europe/Bucharest — invarianta 3.3; '' pentru valori invalide
export function formatBucharestDate(
  value: Date | string | null | undefined,
  locale: 'ro' | 'en' = 'ro',
): string {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(d.getTime())) return '';
  return d.toLocaleDateString(locale === 'ro' ? 'ro-RO' : 'en-GB', {
    timeZone: BUCHAREST_TZ,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

// coloane @db.Date serializate 'YYYY-MM-DD' — fara deplasare de fus
export function formatDateOnly(text: string | null | undefined, locale: 'ro' | 'en' = 'ro'): string {
  if (!text || !/^\d{4}-\d{2}-\d{2}$/.test(text)) return '';
  return formatBucharestDate(`${text}T12:00:00Z`, locale);
}

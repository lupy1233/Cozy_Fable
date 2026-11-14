import { createTranslator } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import ro from '../../../messages/ro.json';
import en from '../../../messages/en.json';

// helperul pur din clopotel; restul componentei nu e incarcat (hook-uri cu server)
vi.mock('@/hooks/use-auth', () => ({ useMe: () => ({ data: undefined }) }));
vi.mock('@/hooks/use-notifications', () => ({}));
vi.mock('@/hooks/use-socket', () => ({ useRealtimeSync: () => undefined }));
vi.mock('@/i18n/routing', () => ({ useRouter: () => ({ push: vi.fn() }) }));

const { executionStageTitle } = await import('./notification-bell');
// createTranslator si useTranslations au tipuri diferite pentru acelasi traducator
type BellT = Parameters<typeof executionStageTitle>[0];

// m3 (revizie e5): titlul notificarii execution.stage_updated numeste etapa si firma
describe('executionStageTitle', () => {
  const tRo = createTranslator({ locale: 'ro', messages: ro, namespace: 'Notifications' }) as unknown as BellT;
  const tEn = createTranslator({ locale: 'en', messages: en, namespace: 'Notifications' }) as unknown as BellT;

  it('cu firma: „<Firma> a bifat etapa: Producție”', () => {
    expect(executionStageTitle(tRo, { stage: 'PRODUCTION', companyName: 'Mobila Bună SRL' })).toBe(
      'Mobila Bună SRL a bifat etapa: Producție',
    );
  });

  it('fara firma: „Firma a bifat etapa: Montaj”', () => {
    expect(executionStageTitle(tRo, { stage: 'INSTALLATION' })).toBe('Firma a bifat etapa: Montaj');
  });

  it('EN', () => {
    expect(executionStageTitle(tEn, { stage: 'MEASUREMENTS', companyName: 'Acme' })).toBe(
      'Acme ticked the stage: Measurements',
    );
  });

  it('etapa lipsa sau necunoscuta → null (titlul de baza)', () => {
    expect(executionStageTitle(tRo, {})).toBeNull();
    expect(executionStageTitle(tRo, { stage: 'PAINTING' })).toBeNull();
    expect(executionStageTitle(tRo, null)).toBeNull();
  });
});

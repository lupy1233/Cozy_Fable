import { companyOnboardingSchema } from '@marketplace/shared';
import { describe, expect, it } from 'vitest';
import en from '@/messages/en.json';
import ro from '@/messages/ro.json';

// Formularul de inscriere a firmei (company/page.tsx) ia eticheta fiecarui camp din
// `Company.<camp>`. Verificarea in browser a etapei 11 a gasit „Company.lat” / „Company.lng”
// pe ecran: cheile fusesera scoase din mesaje, dar formularul le foloseste inca.
describe('formularul de inscriere a firmei', () => {
  it('fiecare camp al schemei are eticheta in RO si EN', () => {
    const missing: string[] = [];
    for (const field of Object.keys(companyOnboardingSchema.shape)) {
      for (const [locale, messages] of Object.entries({ ro, en })) {
        const label = (messages.Company as Record<string, unknown>)[field];
        if (typeof label !== 'string' || !label.trim()) missing.push(`${locale}:Company.${field}`);
      }
    }
    expect(missing).toEqual([]);
  });
});

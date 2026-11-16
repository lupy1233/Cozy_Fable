import { z } from 'zod';
import { storageScopeId, useConfiguratorStore } from '@/stores/configurator-store';

// m1 (etapa 12): drumul Sumar → login → inregistrare cu intoarcere la ciorna
export const DRAFT_RETURN_PATH = '/requests/new';

// E-mailul ales de vizitator la contact (Date generale), luat din memoria formularului din
// acest browser — niciodata din adresa paginii (nicio data personala in URL). Doar cand
// inregistrarea duce inapoi la ciorna si doar de pe canalul email, cu o adresa valida.
export function draftContactEmail(redirect: string | null): string | null {
  if (redirect !== DRAFT_RETURN_PATH || storageScopeId() !== 'new') return null;
  const contacts = useConfiguratorStore.getState().details.contactPreferences ?? [];
  for (const c of contacts) {
    if (c.channel !== 'EMAIL') continue;
    const value = c.value?.trim();
    if (value && z.string().email().safeParse(value).success) return value;
  }
  return null;
}

import type { QueryClient } from '@tanstack/react-query';
import { disconnectRealtime } from '@/hooks/use-socket';

// Curatenia datelor locale ale unui user (SEC2-12, E-client-3): la logout si la
// login cu alt cont nu ramane nimic din sesiunea anterioara in browser.
// Store-urile se importa dinamic ca use-auth sa nu traga bundle-urile lor in
// fiecare pagina. Accesul la localStorage e protejat (mod privat / storage blocat).

export const DRAFT_TOKEN_KEY = 'mm_draft_token';
const REQUEST_TOKEN_PREFIX = 'mm_req_token_';
// ultimul user logat in acest browser; schimbarea lui declanseaza curatenia
export const LOCAL_OWNER_KEY = 'mm_local_owner';
const CONFIGURATOR_KEY = 'mm_configurator_v1';

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeRemove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // storage indisponibil: nimic de sters
  }
}

// Cheile mm_req_token_<id> scrise de build-urile vechi: tokenul nu mai deschide
// nimic dupa publicare, deci sunt doar reziduu.
export function purgeLegacyRequestTokens(): void {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(REQUEST_TOKEN_PREFIX)) keys.push(key);
    }
    keys.forEach(safeRemove);
  } catch {
    // storage indisponibil
  }
}

// Exista in browser o cerere inceputa si nepublicata (camere sau detalii)?
// Citeste blobul persistat direct, fara importul static al store-ului.
export function hasUnpublishedLocalDraft(): boolean {
  const raw = safeGet(CONFIGURATOR_KEY);
  if (!raw) return false;
  try {
    const state = (JSON.parse(raw) as { state?: { roomInstances?: unknown[]; details?: Record<string, unknown> } })
      .state;
    const rooms = Array.isArray(state?.roomInstances) ? state.roomInstances.length : 0;
    const details = state?.details && typeof state.details === 'object' ? Object.keys(state.details).length : 0;
    return rooms > 0 || details > 0;
  } catch {
    return false;
  }
}

export async function clearUserLocalData(qc: QueryClient): Promise<void> {
  // partea sincrona intai: nimic din cache-ul userului anterior nu mai randeaza
  qc.clear();
  safeRemove(DRAFT_TOKEN_KEY);
  purgeLegacyRequestTokens();
  safeRemove(CONFIGURATOR_KEY);
  disconnectRealtime();

  const { useConfiguratorStore } = await import('@/stores/configurator-store');
  useConfiguratorStore.getState().reset();

  // scenele/piesele Studio raman (intrebare PO deschisa); doar pointerul la ciorna
  // din contul anterior dispare. Storage-ul Studio e async: set-ul inainte de
  // hidratare ar fi suprascris de hidratare.
  const { useStudioStore } = await import('@/stores/studio-store');
  if (!useStudioStore.persist.hasHydrated()) await useStudioStore.persist.rehydrate();
  useStudioStore.getState().setAccountDraft(null);
}

// La login: daca in browser a lucrat alt cont, datele lui se sterg inainte ca noul
// user sa vada ceva. Fara owner anterior (lucru anonim) datele raman: fill as guest,
// login to publish.
// Partea sincrona (qc.clear + chei) ruleaza inainte de return, deci inainte ca
// apelantul sa puna noul user in cache.
export function adoptLocalOwner(qc: QueryClient, userId: string): Promise<void> {
  const prev = safeGet(LOCAL_OWNER_KEY);
  try {
    localStorage.setItem(LOCAL_OWNER_KEY, userId);
  } catch {
    // storage indisponibil: curatenia la urmatorul login nu se poate face
  }
  return prev && prev !== userId ? clearUserLocalData(qc) : Promise.resolve();
}

export function forgetLocalOwner(): void {
  safeRemove(LOCAL_OWNER_KEY);
}

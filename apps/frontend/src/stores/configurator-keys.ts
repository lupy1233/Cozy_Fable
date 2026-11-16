// Cheile de memorie ale configuratorului si detectia editarilor abandonate (b8).
// Modul e pur (fara zustand), ca sa poata fi importat si din lib/ fara bundle-ul store-ului.

// ciorna cererii NOI: localStorage, supravietuieste inchiderii browserului
export const CONFIGURATOR_STORAGE_KEY = 'mm_configurator_v1';
// editarea unei cereri publicate: sessionStorage, o cheie per cerere editata,
// tinuta doar pe durata tabului si aruncata la iesirea fara salvare
export const CONFIGURATOR_EDIT_PREFIX = 'mm_configurator_edit_v1:';

export function editSessionKey(requestId: string): string {
  return `${CONFIGURATOR_EDIT_PREFIX}${requestId}`;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Pana la b8, editarea scria in aceeasi cheie ca cererea noua. Un snapshot de
// editare se recunoaste dupa camere: la editare localId = id-ul camerei salvate
// pe server (uuid), pe cand camerele adaugate in formular primesc "r_xxxxxxxx".
// Un astfel de snapshot e o editare abandonata, nu o ciorna de reluat.
export function isAbandonedEditSnapshot(state: unknown): boolean {
  if (!state || typeof state !== 'object') return false;
  const rooms = (state as { roomInstances?: unknown }).roomInstances;
  if (!Array.isArray(rooms)) return false;
  return rooms.some(
    (r) => !!r && typeof r === 'object' && typeof (r as { localId?: unknown }).localId === 'string' &&
      UUID.test((r as { localId: string }).localId),
  );
}

// Sterge toate editarile tinute in tab (ex. la deconectare). Best-effort.
export function clearEditSessions(): void {
  try {
    const keys: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key?.startsWith(CONFIGURATOR_EDIT_PREFIX)) keys.push(key);
    }
    keys.forEach((k) => sessionStorage.removeItem(k));
  } catch {
    // storage indisponibil
  }
}

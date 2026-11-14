import { api, ApiError } from '@/lib/api';

// d4 + M2 (revizuire etapa 7): la editarea unei cererii publicate, imaginile 3D urca pe cerere
// abia la "Salveaza". Regula: cererea are in orice moment cel mult O imagine 3D pe piesa — cea a
// configuratiei salvate. De aceea tinem minte, per cerere, ce fisiere 3D a atins editarea:
// - uploads: urcate in editare, inca nesalvate (o salvare reusita le scoate de aici);
// - replaced: imaginile salvate pe care editarea le-a inlocuit / le-a gasit vechi.
// La o salvare reusita se sterg toate cele nefolosite de cererea salvata; la abandon se sterg
// cele urcate; la urmatoarea intrare in editare (ex. tabul inchis) se sterg cele nefolosite.
// localStorage: supravietuieste inchiderii tabului, ca sa poata fi curatat data viitoare.

const PREFIX = 'mm_edit_snapshot_files_v1:';

interface EditSnapshotFiles {
  uploads: string[];
  replaced: string[];
}

const key = (requestId: string) => `${PREFIX}${requestId}`;
const unique = (ids: string[]) => [...new Set(ids.filter((id) => typeof id === 'string' && id.length > 0))];

export function readEditSnapshotFiles(requestId: string): EditSnapshotFiles {
  try {
    const raw = window.localStorage.getItem(key(requestId));
    const parsed = raw ? (JSON.parse(raw) as Partial<EditSnapshotFiles>) : {};
    return {
      uploads: unique(Array.isArray(parsed.uploads) ? parsed.uploads : []),
      replaced: unique(Array.isArray(parsed.replaced) ? parsed.replaced : []),
    };
  } catch {
    return { uploads: [], replaced: [] };
  }
}

function write(requestId: string, files: EditSnapshotFiles): void {
  try {
    if (files.uploads.length === 0 && files.replaced.length === 0) window.localStorage.removeItem(key(requestId));
    else window.localStorage.setItem(key(requestId), JSON.stringify({ uploads: unique(files.uploads), replaced: unique(files.replaced) }));
  } catch {
    // storage indisponibil: curatarea ramane doar pentru salvarea din pagina
  }
}

export function recordEditUpload(requestId: string, id: string): void {
  const files = readEditSnapshotFiles(requestId);
  write(requestId, { ...files, uploads: [...files.uploads, id] });
}

export function recordEditReplaced(requestId: string, ids: string[]): void {
  if (ids.length === 0) return;
  const files = readEditSnapshotFiles(requestId);
  write(requestId, { ...files, replaced: [...files.replaced, ...ids] });
}

// fisierele atinse de editare pe care cererea (salvata) nu le mai foloseste
export function editSnapshotIdsToRemove(requestId: string, referenced: ReadonlySet<string>): string[] {
  const files = readEditSnapshotFiles(requestId);
  return unique([...files.uploads, ...files.replaced]).filter((id) => !referenced.has(id));
}

// dupa o salvare reusita: lista se goleste; `leftovers` = fisiere nefolosite care n-au putut fi
// sterse acum (raman de sters la abandon / data viitoare)
export function resetEditSnapshotFiles(requestId: string, leftovers: string[] = []): void {
  write(requestId, { uploads: leftovers, replaced: [] });
}

// stergere directa (fara pagina montata); un fisier deja disparut (404) e sters; esecurile raman
function deleteFiles(requestId: string, ids: string[]): void {
  if (ids.length === 0) return;
  void Promise.all(ids.map((id) =>
    api<void>(`/requests/${requestId}/attachments/${id}`, { method: 'DELETE' }).then(
      () => null,
      (err: unknown) => (err instanceof ApiError && err.status === 404 ? null : id),
    ),
  )).then((failed) => {
    const left = failed.filter((id): id is string => id !== null);
    if (left.length === 0) return;
    const files = readEditSnapshotFiles(requestId);
    write(requestId, { ...files, uploads: [...files.uploads, ...left] });
  });
}

// editarea parasita fara salvare: imaginile urcate (nesalvate) se sterg; cele inlocuite raman
// ale cererii salvate
export function discardEditUploads(requestId: string): void {
  const { uploads } = readEditSnapshotFiles(requestId);
  write(requestId, { uploads: [], replaced: [] });
  deleteFiles(requestId, uploads);
}

// intrarea in editare construita din cererea salvata: ce a ramas de la o editare anterioara
// (tab inchis, raspuns pierdut) si nu e folosit de cererea salvata se sterge acum
export function cleanupEditSnapshotFiles(requestId: string, referenced: ReadonlySet<string>): void {
  const ids = editSnapshotIdsToRemove(requestId, referenced);
  write(requestId, { uploads: [], replaced: [] });
  deleteFiles(requestId, ids);
}

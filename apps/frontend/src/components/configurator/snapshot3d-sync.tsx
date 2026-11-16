'use client';

import type { AttachmentDto } from '@marketplace/shared';
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ApiError } from '@/lib/api';
import { useRemoveAttachmentFor, useUploadAttachmentFor, type AttachmentTarget } from '@/hooks/use-requests';
import { isInEditSession, useConfiguratorStore, type RoomInstance } from '@/stores/configurator-store';
import { dataUrlToFile, piece3dOf, snapshot3dIds, snapshot3dStatus } from '@/stores/snapshot3d';
import { recordEditReplaced, recordEditUpload } from '@/stores/edit-snapshot-files';

// d4 (PO d4-1): imaginea 3D a piesei urca imediat ce exista, ca fisier al ciornei, si sta in
// answers.snapshot3d (+ snapshot3dKey = configuratia pe care o arata) → rezista la
// reincarcare si pe alt dispozitiv. Fisierul inlocuit se sterge de pe ciorna. La editarea unei
// cereri publicate nimic nu urca inainte de "Salveaza" (fisierele cererii le vad firmele).

// urcarea porneste la atata timp dupa ultima captura (ecranul 3D face o captura la 800 ms
// dupa fiecare schimbare); iesirea de pe ecran urca pe loc
export const SNAPSHOT_UPLOAD_DELAY_MS = 2500;
// cat asteapta publicarea dupa urcarea imaginilor inainte sa plece fara ele
export const SNAPSHOT_PUBLISH_WAIT_MS = 20_000;
// cat poate dura desenarea ascunsa (cu incarcarea modulului 3D) pana o socotim esuata
export const HIDDEN_RENDER_TIMEOUT_MS = 15_000;
const RENDER_POLL_MS = 200;
// cat asteapta publicarea stergerile imaginilor inlocuite de pe ciorna
const FILE_REMOVAL_WAIT_MS = 10_000;

export interface Snapshot3dIo {
  upload: (file: File) => Promise<Pick<AttachmentDto, 'id'>>;
  remove: (id: string) => Promise<unknown>;
}

// o singura urcare pe camera o data; la nivel de modul, ca o urcare pornita la iesirea de pe
// ecranul 3D sa fie asteptata si de Sumar
const inflight = new Map<string, Promise<boolean>>();

// Urca captura din memorie a camerei, daca e a configuratiei de acum si camera nu are deja
// imaginea ei. true = camera are acum imaginea configuratiei de acum.
export function syncRoomSnapshot(localId: string, io: Snapshot3dIo): Promise<boolean> {
  const previous = inflight.get(localId) ?? Promise.resolve(true);
  const next = previous.catch(() => false).then(() => runSync(localId, io));
  inflight.set(localId, next);
  void next.finally(() => {
    if (inflight.get(localId) === next) inflight.delete(localId);
  });
  return next;
}

async function runSync(localId: string, io: Snapshot3dIo): Promise<boolean> {
  const state = useConfiguratorStore.getState();
  const room = state.roomInstances.find((r) => r.localId === localId);
  const piece = room ? piece3dOf(room) : null;
  if (!room || !piece) return false;
  if (snapshot3dStatus(room) === 'fresh') return true;
  const capture = state.snapshots3d[localId];
  if (!capture || capture.key !== piece.key) return false;
  const file = dataUrlToFile(capture.dataUrl, `configurare-3d-${room.roomType.toLowerCase()}.png`);
  if (!file) return false;
  let attachment: Pick<AttachmentDto, 'id'>;
  try {
    attachment = await io.upload(file);
  } catch {
    // fara imagine acum; Sumarul / publicarea mai incearca
    return false;
  }
  // intre timp configuratia s-a schimbat sau camera a fost scoasa: fisierul nou nu mai e bun
  const after = useConfiguratorStore.getState().roomInstances.find((r) => r.localId === localId);
  if (!after || piece3dOf(after)?.key !== capture.key) {
    void io.remove(attachment.id);
    return false;
  }
  const replaced = useConfiguratorStore.getState().setSnapshot3dFile(localId, attachment.id, capture.key) ?? [];
  for (const id of replaced) void io.remove(id);
  return true;
}

// Stergerea de pe ciorna: un fisier deja disparut (404) e sters; un esec il trece la
// "aruncate" (b6), care se sterg sigur inainte de publicare.
export function useDraftSnapshotIo(target: AttachmentTarget): Snapshot3dIo {
  const upload = useUploadAttachmentFor(target);
  const remove = useRemoveAttachmentFor(target);
  const uploadRef = useRef(upload.mutateAsync);
  uploadRef.current = upload.mutateAsync;
  const removeRef = useRef(remove.mutateAsync);
  removeRef.current = remove.mutateAsync;
  return useMemo(
    () => ({
      upload: (file: File) => uploadRef.current(file),
      remove: (id: string) => {
        const removal = removeRef.current(id).then(
          () => undefined,
          (err: unknown) => {
            if (!(err instanceof ApiError && err.status === 404)) useConfiguratorStore.getState().discardFiles([id]);
          },
        );
        // m1: publicarea asteapta stergerile in curs (altfel fisierul vechi poate pleca cu cererea)
        pendingRemovals.add(removal);
        void removal.finally(() => pendingRemovals.delete(removal));
        return removal;
      },
    }),
    [],
  );
}

// stergerile de pe ciorna aflate pe drum (imaginile inlocuite)
const pendingRemovals = new Set<Promise<unknown>>();

// Asteapta stergerile in curs, cel mult `ms`. Ce n-a raspuns la timp ramane pe drum; un esec
// ajunge oricum in discardedFiles, pe care publicarea il sterge (si il verifica) inainte.
export async function waitForSnapshotRemovals(ms: number): Promise<void> {
  if (pendingRemovals.size === 0) return;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      Promise.all([...pendingRemovals]),
      new Promise<void>((resolve) => { timer = setTimeout(resolve, ms); }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

// Pe ecranul 3D al cererii noi (montat langa controale): fiecare captura noua urca dupa
// SNAPSHOT_UPLOAD_DELAY_MS; la iesirea de pe ecran, pe loc.
export function Snapshot3dAutoUpload() {
  const token = useConfiguratorStore((s) => s.token);
  if (!token || isInEditSession()) return null;
  return <AutoUpload token={token} />;
}

function AutoUpload({ token }: { token: string }) {
  const io = useDraftSnapshotIo(useMemo<AttachmentTarget>(() => ({ kind: 'draft', token }), [token]));
  const captures = useConfiguratorStore((s) => s.snapshots3d);
  const pending = useRef(new Set<string>());
  const flush = useCallback(() => {
    for (const localId of pending.current) void syncRoomSnapshot(localId, io);
    pending.current.clear();
  }, [io]);
  const flushRef = useRef(flush);
  flushRef.current = flush;

  useEffect(() => {
    const ids = Object.keys(captures);
    if (ids.length === 0) return;
    for (const id of ids) pending.current.add(id);
    const timer = setTimeout(() => flushRef.current(), SNAPSHOT_UPLOAD_DELAY_MS);
    return () => clearTimeout(timer);
  }, [captures]);

  // iesirea de pe ecran: ce a ramas urca acum (captura de la iesire e deja in store)
  useEffect(() => () => flushRef.current(), []);
  return null;
}

// --- Sumar ---

// modulul 3D (three.js) se incarca doar cand chiar trebuie desenat ceva
const Snapshot3dRenderer = lazy(() => import('./piece3d/snapshot3d-renderer'));

// m3: verificat o singura data pe pagina, iar contextul de proba se inchide imediat
let webglSupport: boolean | null = null;
function hasWebGl(): boolean {
  if (webglSupport !== null) return webglSupport;
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
    webglSupport = Boolean(gl);
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
  } catch {
    webglSupport = false;
  }
  return webglSupport;
}

// ce arata cardul piesei din Sumar
export type ReviewSnapshot =
  | { status: 'ready'; src: string }
  | { status: 'working' }
  | { status: 'failed' };

// Desenarea ascunsa a unei piese, cu limita de timp; fara WebGL → esec pe loc.
// Montat cu cheia camera + amprenta: o configuratie noua = o desenare noua.
function HiddenSnapshot({ room, onDone }: { room: RoomInstance; onDone: (dataUrl: string | null) => void }) {
  const [piece] = useState(() => piece3dOf(room));
  // verificat dupa montare (nu exista pe server)
  const [webgl, setWebgl] = useState<boolean | null>(null);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  const doneRef = useRef(false);
  const finish = useCallback((dataUrl: string | null) => {
    if (doneRef.current) return;
    doneRef.current = true;
    onDoneRef.current(dataUrl);
  }, []);
  useEffect(() => {
    const ok = Boolean(piece) && hasWebGl();
    setWebgl(ok);
    if (!ok) {
      finish(null);
      return;
    }
    const timer = setTimeout(() => finish(null), HIDDEN_RENDER_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [piece, finish]);
  if (!webgl || !piece) return null;
  return (
    <Suspense fallback={null}>
      <Snapshot3dRenderer piece={piece.piece} config={piece.config} onDone={finish} />
    </Suspense>
  );
}

// Imaginile pieselor din Sumar (d4 pasii 2-4): imaginea configuratiei de acum (fisierul urcat
// sau captura din memorie); altfel scena se deseneaza ascuns, o piesa pe rand; esecul se
// spune in card, publicarea nu se blocheaza.
export function useReviewSnapshots({
  rooms,
  attachments,
  target,
  isEdit,
}: {
  rooms: RoomInstance[];
  attachments: AttachmentDto[];
  target: AttachmentTarget;
  isEdit: boolean;
}) {
  const captures = useConfiguratorStore((s) => s.snapshots3d);
  const setSnapshot3d = useConfiguratorStore((s) => s.setSnapshot3d);
  const draftIo = useDraftSnapshotIo(target);
  const upload = useUploadAttachmentFor(target);
  const uploadRef = useRef(upload.mutateAsync);
  uploadRef.current = upload.mutateAsync;
  // camerele (localId → amprenta) pentru care desenarea ascunsa a esuat
  const [failed, setFailed] = useState<Record<string, string>>({});
  const failedRef = useRef(failed);
  failedRef.current = failed;
  // m2: publicarea asteapta imaginile care inca se pregatesc
  const [waiting, setWaiting] = useState(false);

  const pieces = useMemo(
    () => rooms.flatMap((room) => {
      const piece = piece3dOf(room);
      return piece ? [{ room, key: piece.key, status: snapshot3dStatus(room) }] : [];
    }),
    [rooms],
  );

  // cererea noua: captura configuratiei de acum, inca neurcata, urca acum
  useEffect(() => {
    if (isEdit) return;
    for (const p of pieces) {
      if (p.status !== 'fresh' && captures[p.room.localId]?.key === p.key) void syncRoomSnapshot(p.room.localId, draftIo);
    }
  }, [captures, pieces, isEdit, draftIo]);

  const toRender = pieces.find((p) =>
    p.status !== 'fresh' && captures[p.room.localId]?.key !== p.key && failed[p.room.localId] !== p.key,
  );
  const renderLocalId = toRender?.room.localId;
  const renderKey = toRender?.key;
  const onRendered = useCallback((dataUrl: string | null) => {
    if (!renderLocalId || !renderKey) return;
    if (dataUrl) setSnapshot3d(renderLocalId, dataUrl);
    else setFailed((f) => ({ ...f, [renderLocalId]: renderKey }));
  }, [renderLocalId, renderKey, setSnapshot3d]);
  const renderer = toRender
    ? <HiddenSnapshot key={`${toRender.room.localId}:${toRender.key}`} room={toRender.room} onDone={onRendered} />
    : null;

  const byRoom = new Map<string, ReviewSnapshot>();
  for (const p of pieces) {
    const capture = captures[p.room.localId];
    const file = p.status === 'fresh'
      ? attachments.find((a) => snapshot3dIds(p.room).includes(a.id) && a.status === 'SAFE' && a.downloadUrl)
      : undefined;
    if (capture?.key === p.key) byRoom.set(p.room.localId, { status: 'ready', src: capture.dataUrl });
    else if (file?.downloadUrl) byRoom.set(p.room.localId, { status: 'ready', src: file.downloadUrl });
    else if (p.status === 'fresh') byRoom.set(p.room.localId, { status: 'working' });
    else if (failed[p.room.localId] === p.key) byRoom.set(p.room.localId, { status: 'failed' });
    else byRoom.set(p.room.localId, { status: 'working' });
  }

  // Inainte de publicare: imaginile asteptate urca (cererea noua: pe ciorna; editarea: abia
  // acum, pe cerere). Intoarce ce pleaca altfel: camerele fara imaginea configuratiei de acum
  // pleaca fara imagine, iar fisierele vechi se sterg (ciorna: inainte; editarea: dupa salvare).
  const prepareForPublish = useCallback(async (): Promise<{ stripRooms: Set<string>; removeIds: string[] }> => {
    const removeIds: string[] = [];
    const editId = isEdit && target.kind === 'request' ? target.id : null;
    // M2: in editare fiecare fisier urcat / inlocuit se noteaza (vezi edit-snapshot-files)
    const io: Snapshot3dIo = editId
      ? {
          upload: async (file) => {
            const attachment = await uploadRef.current(file);
            recordEditUpload(editId, attachment.id);
            return attachment;
          },
          remove: async (id) => {
            recordEditReplaced(editId, [id]);
            removeIds.push(id);
          },
        }
      : draftIo;

    // m2: piesele inca fara imagine (desenarea ascunsa in curs) se asteapta, cu limita; dupa
    // limita pleaca fara imagine, iar cardul spune asta
    const stillRendering = () => useConfiguratorStore.getState().roomInstances.filter((room) => {
      const piece = piece3dOf(room);
      if (!piece || snapshot3dStatus(room) === 'fresh') return false;
      return useConfiguratorStore.getState().snapshots3d[room.localId]?.key !== piece.key &&
        failedRef.current[room.localId] !== piece.key;
    });
    if (stillRendering().length > 0) {
      setWaiting(true);
      const deadline = Date.now() + HIDDEN_RENDER_TIMEOUT_MS;
      while (stillRendering().length > 0 && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, RENDER_POLL_MS));
      }
      const late = stillRendering();
      if (late.length > 0) {
        const marks = Object.fromEntries(late.flatMap((room) => {
          const piece = piece3dOf(room);
          return piece ? [[room.localId, piece.key]] : [];
        }));
        failedRef.current = { ...failedRef.current, ...marks };
        setFailed((f) => ({ ...f, ...marks }));
      }
    }

    const localIds = useConfiguratorStore.getState().roomInstances.filter((r) => piece3dOf(r)).map((r) => r.localId);
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<void>((resolve) => { timer = setTimeout(resolve, SNAPSHOT_PUBLISH_WAIT_MS); });
    try {
      await Promise.race([Promise.all(localIds.map((id) => syncRoomSnapshot(id, io))), timeout]);
    } finally {
      clearTimeout(timer);
      setWaiting(false);
    }
    // m1: ciorna — stergerile imaginilor inlocuite se termina inainte de publicare
    if (!editId) await waitForSnapshotRemovals(FILE_REMOVAL_WAIT_MS);
    const stripRooms = new Set<string>();
    for (const room of useConfiguratorStore.getState().roomInstances) {
      if (snapshot3dStatus(room) !== 'stale') continue;
      stripRooms.add(room.localId);
      removeIds.push(...snapshot3dIds(room));
      if (editId) recordEditReplaced(editId, snapshot3dIds(room));
    }
    return { stripRooms, removeIds: [...new Set(removeIds)] };
  }, [isEdit, target, draftIo]);

  return { byRoom, renderer, prepareForPublish, waiting };
}

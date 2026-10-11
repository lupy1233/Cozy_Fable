'use client';

import type { AnswerMap, AnswerValue, RequestStudioSceneData, RoomType, StudioDraftData } from '@marketplace/shared';
import {
  CURRENT_FLOW_VERSION,
  getFlow,
  INSPIRATION_NOTE_MAX,
  MAX_REQUEST_INSPIRATION_PHOTOS,
  pruneAnswers,
  REQUEST_STUDIO_SCENES_MAX,
  sortByRoomOrder,
} from '@marketplace/shared';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { roomIssue } from '@/components/configurator/room-screens';
import { prepareStudioTransfer, type StudioTransferResult } from './studio-transfer';

// Stare wizard configurator. Conform STATE_CONVENTIONS Exemplul 1:
// Zustand tine pasul curent + draftul local pre-submit + tokenul; RHF tine campurile
// pasului curent; TanStack se ocupa de mutatiile server (createDraft/patch/publish).
// Persistat in localStorage → refresh-ul reia exact acelasi pas/raspunsuri.

// 'start' (PO r9): primul pas al wizard-ului — alegerea modului de pornire
// pe cartonase, nu dialog peste pagina.
export type ConfiguratorPhase = 'start' | 'cart' | 'rooms' | 'details' | 'uploads' | 'review';

// Modul de pornire ales in dialogul "cum incepem?" (PO 2026-07-31):
// - OWN_PROJECT: are proiect tehnic → acelasi formular, fara pasii de dimensiuni/schite
// - STANDARD: stie ce vrea, fara proiect → formularul complet
// - DESIGN_HELP: nu stie ce vrea → alege doar camerele, publica cu Proiectare platita
export type StartMode = 'OWN_PROJECT' | 'STANDARD' | 'DESIGN_HELP';

export interface RoomInstance {
  sourceStudio?: { sceneId: string; placementId: string };
  localId: string;
  roomType: RoomType;
  // versiunea flow-ului cu care a fost creata camera; raspunsurile se valideaza
  // si se randeaza contra acestei versiuni pana la publish
  flowVersion: number;
  answers: AnswerMap;
  completed: boolean;
}

export interface ContactPreferenceValue {
  channel: 'EMAIL' | 'PHONE';
  value: string;
}

export interface DetailsValues {
  // fara titlu: e generat automat pe server din camere + oras
  description: string;
  budgetRange: string;
  // valoarea aleasa pe sliderul estimat din scor (F5, item 18); null = UNDISCLOSED
  budgetEstimateRon?: number | null;
  deadlineBucket: string;
  includesPaidDesign: boolean;
  hasOwnProject: boolean;
  addressText: string;
  county: string;
  city: string;
  // ISO2, implicit RO (F5, item 19)
  country?: string;
  contactPreferences: ContactPreferenceValue[];
}

// E-client-34: notita + camera (localId) pentru o poza de inspiratie aleasa; draft local pre-submit
export interface InspirationMeta {
  note?: string;
  roomLocalId?: string;
}

// Snapshot serializabil trimis la server (configuratorState) si rehidratat la resume.
export interface ConfiguratorSnapshot {
  phase: ConfiguratorPhase;
  // null = dialogul de pornire nu a fost inca raspuns (snapshot-uri vechi → null)
  startMode: StartMode | null;
  roomInstances: RoomInstance[];
  activeRoomIndex: number;
  activeStepIndex: number;
  details: Partial<DetailsValues>;
  // pozele din galerie alese ca inspiratie (F6, item 3)
  inspirationPhotoIds: string[];
  // E-client-34: notita + camera per poza (cheie = photoId); optional, snapshot-urile vechi raman valide
  inspirationMeta?: Record<string, InspirationMeta>;
  // camerele 3D trimise din Studio (feedback PO r3): calatoresc cu draftul in
  // configuratorState si se materializeaza pe cerere la publish (server)
  studioScenes?: RequestStudioSceneData[];
  updatedAt: number;
}

// Unitatea de afisare pentru inputurile de dimensiuni (valorile raman in metri
// in answers — conversia e pur prezentationala, in StepRenderer).
export type DimensionUnit = 'm' | 'cm' | 'mm';

interface ConfiguratorStore extends ConfiguratorSnapshot {
  transferStudio: (data: StudioDraftData) => StudioTransferResult;
  token: string | null;
  dimensionUnit: DimensionUnit;
  // PNG-urile scenei 3D per camera (localId → dataURL), capturate in timp ce
  // canvas-ul e montat si urcate ca attachment la publish (docs/10 R4).
  // DOAR in memorie: nu se persista in localStorage si nu intra in snapshotul
  // trimis serverului — ar umfla ambele peste orice cap rezonabil.
  snapshots3d: Record<string, string>;
  setSnapshot3d: (localId: string, dataUrl: string | null) => void;
  setDimensionUnit: (unit: DimensionUnit) => void;
  setToken: (token: string) => void;
  setPhase: (phase: ConfiguratorPhase) => void;
  setStartMode: (mode: StartMode | null) => void;
  addRoom: (roomType: RoomType) => void;
  // Studio 3D: adauga o camera-piesa cu raspunsuri precompletate (config3d);
  // restul pasilor (material, schita) raman de parcurs in wizard
  addRoomWithAnswers: (roomType: RoomType, answers: AnswerMap) => void;
  // Studio 3D: ataseaza camera (scena + piesele folosite) cererii in lucru;
  // aceeasi scena retrimisa se inlocuieste, nu se dubleaza
  attachStudioScene: (data: RequestStudioSceneData) => void;
  removeLastOfType: (roomType: RoomType) => void;
  removeRoom: (localId: string) => void;
  setActiveRoom: (index: number) => void;
  setStepIndex: (index: number) => void;
  setAnswer: (localId: string, stepId: string, value: AnswerValue) => void;
  copyRoomAnswers: (sourceLocalId: string, targetLocalId: string) => void;
  markRoomCompleted: (localId: string, completed: boolean) => void;
  // scoate un atasament sters din toti pasii upload ai camerelor (E-client-2)
  forgetAttachment: (id: string) => void;
  // pastreaza in pasii upload doar id-urile care mai exista pe draft/cerere;
  // intoarce cate referinte au fost scoase
  pruneAttachmentRefs: (existingIds: Set<string>) => number;
  // completed = validarea stricta de publicare (nu doar "a trecut prin ecrane")
  syncCompletion: (ownProject: boolean) => void;
  // deschide camera la un ecran anume (setActiveRoom reseteaza pasul la 0)
  focusRoomStep: (roomIndex: number, screenIndex: number) => void;
  setDetails: (patch: Partial<DetailsValues>) => void;
  setInspirationPhotos: (ids: string[]) => void;
  // E-client-34: adauga poze (ex. toata o colectie) pana la plafon; notita venita din colectie nu
  // suprascrie una existenta; camera se sugereaza doar cand exista EXACT una de acel tip
  addInspirationPhotos: (
    entries: { photoId: string; note?: string | null; roomType?: RoomType | null }[],
  ) => { added: number; skipped: number };
  setInspirationNote: (photoId: string, note: string) => void;
  setInspirationRoom: (photoId: string, roomLocalId: string | null) => void;
  loadSnapshot: (snapshot: ConfiguratorSnapshot) => void;
  snapshot: () => ConfiguratorSnapshot;
  reset: () => void;
}

function newLocalId(): string {
  return `r_${Math.random().toString(36).slice(2, 10)}`;
}

// Noptiera asezata in Studio = o singura piesa (studio-publication.ts pe server):
// pasul "count" e ascuns in wizard, deci valoarea se forteaza aici.
function lockStudioNightstand(room: RoomInstance): RoomInstance {
  if (!room.sourceStudio || room.roomType !== 'PIECE_NIGHTSTAND' || room.answers.count === 'ONE') return room;
  try {
    if (!getFlow(room.roomType, room.flowVersion).steps.some((s) => s.id === 'count')) return room;
  } catch {
    return room;
  }
  return { ...room, answers: { ...room.answers, count: 'ONE' } };
}

// Scoate din pasii upload id-urile respinse de `keep`; intoarce camerele noi si
// numarul de referinte scoase. Flow necunoscut → camera ramane neatinsa.
function filterUploadRefs(
  rooms: RoomInstance[],
  keep: (id: string) => boolean,
): { rooms: RoomInstance[]; removed: number } {
  let removed = 0;
  const next = rooms.map((room) => {
    let flow;
    try {
      flow = getFlow(room.roomType, room.flowVersion);
    } catch {
      return room;
    }
    let answers: AnswerMap | null = null;
    for (const step of flow.steps) {
      if (step.type !== 'upload') continue;
      const value = room.answers[step.id];
      if (!Array.isArray(value)) continue;
      const kept = value.filter((id) => typeof id === 'string' && keep(id));
      if (kept.length === value.length) continue;
      removed += value.length - kept.length;
      answers = { ...(answers ?? room.answers) };
      if (kept.length > 0) answers[step.id] = kept as string[];
      else delete answers[step.id];
    }
    return answers ? { ...room, answers: pruneAnswers(flow, answers) } : room;
  });
  return { rooms: removed > 0 ? next : rooms, removed };
}

// Normalizeaza instante provenite din snapshot-uri vechi (fara flowVersion):
// acele camere au fost create pe versiunea 1 a flow-urilor. Aplicata pe TOATE
// caile de intrare (migrate localStorage, resume de pe server, edit-mode),
// impune si ordinea canonica a intrebarilor (ROOM_ORDER, stabila per tip).
function normalizeInstances(rooms: RoomInstance[] | undefined): RoomInstance[] {
  return sortByRoomOrder(
    (rooms ?? []).map((r) => lockStudioNightstand({ ...r, flowVersion: r.flowVersion ?? 1 })),
  );
}

// Pastreaza doar meta pentru pozele alese; camera doar daca inca exista in cos; nota taiata la plafon.
function sanitizeInspirationMeta(
  meta: unknown,
  photoIds: string[],
  rooms: Pick<RoomInstance, 'localId'>[],
): Record<string, InspirationMeta> {
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return {};
  const ids = new Set(photoIds);
  const roomIds = new Set(rooms.map((r) => r.localId));
  const out: Record<string, InspirationMeta> = {};
  for (const [photoId, raw] of Object.entries(meta as Record<string, unknown>)) {
    if (!ids.has(photoId) || !raw || typeof raw !== 'object') continue;
    const { note, roomLocalId } = raw as { note?: unknown; roomLocalId?: unknown };
    const entry: InspirationMeta = {};
    if (typeof note === 'string' && note.length > 0) entry.note = note.slice(0, INSPIRATION_NOTE_MAX);
    if (typeof roomLocalId === 'string' && roomIds.has(roomLocalId)) entry.roomLocalId = roomLocalId;
    if (entry.note !== undefined || entry.roomLocalId !== undefined) out[photoId] = entry;
  }
  return out;
}

// Dupa reordonare, indexul camerei active trebuie remapat prin localId —
// altfel resume-ul mid-flow ar deschide alta camera decat cea in lucru.
function normalizeSnapshot(snapshot: Partial<ConfiguratorSnapshot>): Partial<ConfiguratorSnapshot> {
  const original = snapshot.roomInstances ?? [];
  const activeId = original[snapshot.activeRoomIndex ?? 0]?.localId;
  const roomInstances = normalizeInstances(original);
  const remapped = activeId ? roomInstances.findIndex((r) => r.localId === activeId) : -1;
  // snapshot-uri dinainte de pasul "Cum pornim?": progres fara mod ales →
  // STANDARD (comportamentul de atunci); fara progres si fara mod → pasul start
  const details = normalizeDetails(snapshot.details);
  const hasProgress =
    roomInstances.length > 0 ||
    Object.keys(details).length > 0 ||
    (snapshot.phase !== undefined && snapshot.phase !== 'cart' && snapshot.phase !== 'start');
  const startMode = snapshot.startMode ?? (hasProgress ? 'STANDARD' : null);
  const inspirationPhotoIds = Array.isArray(snapshot.inspirationPhotoIds) ? snapshot.inspirationPhotoIds : [];
  return {
    ...snapshot,
    startMode,
    phase: startMode == null ? 'start' : (snapshot.phase ?? 'start'),
    roomInstances,
    activeRoomIndex: remapped >= 0 ? remapped : 0,
    details,
    inspirationPhotoIds,
    inspirationMeta: sanitizeInspirationMeta(snapshot.inspirationMeta, inspirationPhotoIds, roomInstances),
  };
}

// Patch comun pentru mutatiile care schimba componenta cosului: pastreaza
// ordinea canonica si camera activa (identificata prin localId).
function sortedRoomsPatch(
  current: Pick<ConfiguratorSnapshot, 'roomInstances' | 'activeRoomIndex'>,
  nextRooms: RoomInstance[],
): Pick<ConfiguratorSnapshot, 'roomInstances' | 'activeRoomIndex'> {
  const activeId = current.roomInstances[current.activeRoomIndex]?.localId;
  const roomInstances = sortByRoomOrder(nextRooms);
  const idx = activeId ? roomInstances.findIndex((r) => r.localId === activeId) : -1;
  return { roomInstances, activeRoomIndex: idx >= 0 ? idx : 0 };
}

// Curata detaliile din snapshot-uri vechi: titlul si prioritatea contactelor au
// disparut; canalele libere se mapeaza pe EMAIL/PHONE; termenul-data e abandonat.
function normalizeDetails(details: Partial<DetailsValues> | undefined): Partial<DetailsValues> {
  const d = { ...(details ?? {}) } as Partial<DetailsValues> & {
    title?: string;
    desiredDeadline?: string;
  };
  delete d.title;
  delete d.desiredDeadline;
  if (d.contactPreferences) {
    d.contactPreferences = d.contactPreferences
      .filter((c) => typeof c?.value === 'string')
      .map((c) => ({
        channel: String(c.channel).toUpperCase().includes('MAIL') ? 'EMAIL' : 'PHONE',
        value: c.value,
      }));
  }
  return d;
}

const initialSnapshot: ConfiguratorSnapshot = {
  phase: 'start',
  startMode: null,
  roomInstances: [],
  activeRoomIndex: 0,
  activeStepIndex: 0,
  details: {},
  inspirationPhotoIds: [],
  inspirationMeta: {},
  updatedAt: Date.now(),
};

export const useConfiguratorStore = create<ConfiguratorStore>()(
  persist(
    (set, get) => ({
      token: null,
      // cm e unitatea naturala pentru mobilier; clientul poate comuta pe m/mm
      dimensionUnit: 'cm' as DimensionUnit,
      snapshots3d: {},
      ...initialSnapshot,

      setSnapshot3d: (localId, dataUrl) =>
        set((s) => {
          const next = { ...s.snapshots3d };
          if (dataUrl) next[localId] = dataUrl;
          else delete next[localId];
          return { snapshots3d: next };
        }),
      setDimensionUnit: (unit) => set({ dimensionUnit: unit }),
      setInspirationPhotos: (ids) =>
        set((s) => {
          const inspirationPhotoIds = [...new Set(ids)].slice(0, MAX_REQUEST_INSPIRATION_PHOTOS);
          return {
            inspirationPhotoIds,
            inspirationMeta: sanitizeInspirationMeta(s.inspirationMeta, inspirationPhotoIds, s.roomInstances),
            updatedAt: Date.now(),
          };
        }),
      addInspirationPhotos: (entries) => {
        const s = get();
        const ids = [...s.inspirationPhotoIds];
        const meta: Record<string, InspirationMeta> = { ...(s.inspirationMeta ?? {}) };
        let added = 0;
        let skipped = 0;
        for (const entry of entries) {
          const note = entry.note?.trim().slice(0, INSPIRATION_NOTE_MAX) || undefined;
          if (ids.includes(entry.photoId)) {
            // poza deja aleasa: completeaza notita doar daca draftul nu are una
            if (note && !meta[entry.photoId]?.note) meta[entry.photoId] = { ...meta[entry.photoId], note };
            continue;
          }
          if (ids.length >= MAX_REQUEST_INSPIRATION_PHOTOS) {
            skipped += 1;
            continue;
          }
          ids.push(entry.photoId);
          added += 1;
          const sameType = entry.roomType ? s.roomInstances.filter((r) => r.roomType === entry.roomType) : [];
          const next: InspirationMeta = {};
          if (note) next.note = note;
          if (sameType.length === 1) next.roomLocalId = sameType[0].localId;
          if (next.note !== undefined || next.roomLocalId !== undefined) meta[entry.photoId] = next;
        }
        if (added > 0 || JSON.stringify(meta) !== JSON.stringify(s.inspirationMeta ?? {})) {
          set({ inspirationPhotoIds: ids, inspirationMeta: meta, updatedAt: Date.now() });
        }
        return { added, skipped };
      },
      setInspirationNote: (photoId, note) =>
        set((s) => {
          if (!s.inspirationPhotoIds.includes(photoId)) return s;
          const { [photoId]: current, ...rest } = s.inspirationMeta ?? {};
          const text = note.slice(0, INSPIRATION_NOTE_MAX);
          const next: InspirationMeta = { ...current };
          if (text.length > 0) next.note = text;
          else delete next.note;
          const hasAny = next.note !== undefined || next.roomLocalId !== undefined;
          return { inspirationMeta: hasAny ? { ...rest, [photoId]: next } : rest, updatedAt: Date.now() };
        }),
      setInspirationRoom: (photoId, roomLocalId) =>
        set((s) => {
          if (!s.inspirationPhotoIds.includes(photoId)) return s;
          const { [photoId]: current, ...rest } = s.inspirationMeta ?? {};
          const next: InspirationMeta = { ...current };
          if (roomLocalId && s.roomInstances.some((r) => r.localId === roomLocalId)) next.roomLocalId = roomLocalId;
          else delete next.roomLocalId;
          const hasAny = next.note !== undefined || next.roomLocalId !== undefined;
          return { inspirationMeta: hasAny ? { ...rest, [photoId]: next } : rest, updatedAt: Date.now() };
        }),
      setToken: (token) => set({ token }),
      setPhase: (phase) => set({ phase, updatedAt: Date.now() }),
      setStartMode: (mode) => set({ startMode: mode, updatedAt: Date.now() }),

      // insertia pastreaza ordinea canonica ROOM_ORDER (nu ordinea adaugarii in cos)
      addRoom: (roomType) =>
        set((s) => ({
          ...sortedRoomsPatch(s, [
            ...s.roomInstances,
            {
              localId: newLocalId(),
              roomType,
              flowVersion: CURRENT_FLOW_VERSION[roomType],
              answers: {},
              completed: false,
            },
          ]),
          updatedAt: Date.now(),
        })),

      addRoomWithAnswers: (roomType, answers) =>
        set((s) => {
          const flowVersion = CURRENT_FLOW_VERSION[roomType];
          const flow = getFlow(roomType, flowVersion);
          return {
            ...sortedRoomsPatch(s, [
              ...s.roomInstances,
              {
                localId: newLocalId(),
                roomType,
                flowVersion,
                answers: pruneAnswers(flow, answers),
                completed: false,
              },
            ]),
            updatedAt: Date.now(),
          };
        }),

      transferStudio: (data) => {
        const s = get();
        const result = prepareStudioTransfer(data, s.roomInstances, s.studioScenes ?? [], newLocalId);
        if (result.ok) set({ ...sortedRoomsPatch(s, result.roomInstances), studioScenes: result.studioScenes, updatedAt: Date.now() });
        return result;
      },

      attachStudioScene: (data) =>
        set((s) => {
          const existing = (s.studioScenes ?? []).filter(
            (entry) => entry.scene.id !== data.scene.id,
          );
          return {
            studioScenes: existing.length >= REQUEST_STUDIO_SCENES_MAX ? s.studioScenes : [...existing, data],
            updatedAt: Date.now(),
          };
        }),

      removeLastOfType: (roomType) =>
        set((s) => {
          const idx = [...s.roomInstances].map((r) => r.roomType).lastIndexOf(roomType);
          if (idx < 0) return s;
          return {
            ...sortedRoomsPatch(s, s.roomInstances.filter((_, i) => i !== idx)),
            inspirationMeta: sanitizeInspirationMeta(
              s.inspirationMeta,
              s.inspirationPhotoIds,
              s.roomInstances.filter((_, i) => i !== idx),
            ),
            updatedAt: Date.now(),
          };
        }),

      removeRoom: (localId) =>
        set((s) => {
          const { [localId]: _removed, ...snapshots3d } = s.snapshots3d;
          return {
            ...sortedRoomsPatch(s, s.roomInstances.filter((r) => r.localId !== localId)),
            inspirationMeta: sanitizeInspirationMeta(
              s.inspirationMeta,
              s.inspirationPhotoIds,
              s.roomInstances.filter((r) => r.localId !== localId),
            ),
            snapshots3d,
            updatedAt: Date.now(),
          };
        }),

      setActiveRoom: (index) => set({ activeRoomIndex: index, activeStepIndex: 0 }),
      setStepIndex: (index) => set({ activeStepIndex: index }),

      // seteaza raspunsul si curata cascada de raspunsuri devenite invalide
      setAnswer: (localId, stepId, value) =>
        set((s) => {
          const roomInstances = s.roomInstances.map((r) => {
            if (r.localId !== localId) return r;
            const flow = getFlow(r.roomType, r.flowVersion);
            const next = pruneAnswers(flow, { ...r.answers, [stepId]: value });
            return { ...r, answers: next };
          });
          return { roomInstances, updatedAt: Date.now() };
        }),

      // copiaza raspunsurile dintr-o camera terminata in alta de acelasi tip
      // (explicit, la apasarea butonului — niciodata automat). Tinta ramane
      // ne-completa: utilizatorul revede raspunsurile inainte de a merge mai departe.
      copyRoomAnswers: (sourceLocalId, targetLocalId) =>
        set((s) => {
          const source = s.roomInstances.find((r) => r.localId === sourceLocalId);
          const target = s.roomInstances.find((r) => r.localId === targetLocalId);
          if (
            !source ||
            !target ||
            source.roomType !== target.roomType ||
            source.flowVersion !== target.flowVersion
          ) {
            return s;
          }
          const flow = getFlow(target.roomType, target.flowVersion);
          // clona adanca (answers contine obiecte/arrays imbricate)
          const cloned = JSON.parse(JSON.stringify(source.answers)) as AnswerMap;
          // schitele NU se copiaza: attachment id-urile apartin camerei sursa
          for (const step of flow.steps) {
            if (step.type === 'upload') delete cloned[step.id];
          }
          const roomInstances = s.roomInstances.map((r) =>
            r.localId === targetLocalId
              ? { ...r, answers: pruneAnswers(flow, cloned), completed: false }
              : r,
          );
          return { roomInstances, updatedAt: Date.now() };
        }),

      markRoomCompleted: (localId, completed) =>
        set((s) => ({
          roomInstances: s.roomInstances.map((r) =>
            r.localId === localId ? { ...r, completed } : r,
          ),
          updatedAt: Date.now(),
        })),

      forgetAttachment: (id) =>
        set((s) => {
          const { rooms, removed } = filterUploadRefs(s.roomInstances, (ref) => ref !== id);
          return removed > 0 ? { roomInstances: rooms, updatedAt: Date.now() } : s;
        }),

      pruneAttachmentRefs: (existingIds) => {
        const { rooms, removed } = filterUploadRefs(get().roomInstances, (ref) => existingIds.has(ref));
        if (removed > 0) set({ roomInstances: rooms, updatedAt: Date.now() });
        return removed;
      },

      syncCompletion: (ownProject) =>
        set((s) => {
          let changed = false;
          const roomInstances = s.roomInstances.map((r) => {
            const completed = roomIssue(r, { ownProject }) === null;
            if (completed === r.completed) return r;
            changed = true;
            return { ...r, completed };
          });
          return changed ? { roomInstances, updatedAt: Date.now() } : s;
        }),

      focusRoomStep: (roomIndex, screenIndex) =>
        set({ activeRoomIndex: roomIndex, activeStepIndex: Math.max(0, screenIndex) }),

      setDetails: (patch) =>
        set((s) => ({ details: { ...s.details, ...patch }, updatedAt: Date.now() })),

      loadSnapshot: (snapshot) => set({ ...snapshot, ...normalizeSnapshot(snapshot) }),

      snapshot: () => {
        const s = get();
        return {
          phase: s.phase,
          startMode: s.startMode,
          roomInstances: s.roomInstances,
          activeRoomIndex: s.activeRoomIndex,
          activeStepIndex: s.activeStepIndex,
          details: s.details,
          inspirationPhotoIds: s.inspirationPhotoIds,
          inspirationMeta: s.inspirationMeta ?? {},
          ...(s.studioScenes && s.studioScenes.length > 0
            ? { studioScenes: s.studioScenes }
            : {}),
          updatedAt: s.updatedAt,
        };
      },

      reset: () =>
        set({
          token: null,
          snapshots3d: {},
          ...initialSnapshot,
          studioScenes: undefined,
          updatedAt: Date.now(),
        }),
    }),
    {
      name: 'mm_configurator_v1',
      // v4 (2026-07-31): faza 'start' + startMode; snapshot-urile vechi cu progres
      // devin STANDARD, cele goale intra pe pasul de pornire
      version: 4,
      // snapshot-uri persistate inainte de versionarea flow-urilor → flowVersion 1;
      // detaliile vechi (titlu, prioritati contact, termen-data) sunt normalizate;
      // draft-urile in curs sunt resortate pe ordinea canonica (camera activa pastrata)
      migrate: (persisted) => {
        const state = persisted as Partial<ConfiguratorSnapshot>;
        return { ...state, ...normalizeSnapshot(state) };
      },
      // nu persista tokenul in acelasi blob cu datele — el sta separat (vezi wizard)
      partialize: (s) => ({
        phase: s.phase,
        startMode: s.startMode,
        roomInstances: s.roomInstances,
        activeRoomIndex: s.activeRoomIndex,
        activeStepIndex: s.activeStepIndex,
        details: s.details,
        inspirationPhotoIds: s.inspirationPhotoIds,
        inspirationMeta: s.inspirationMeta,
        studioScenes: s.studioScenes,
        updatedAt: s.updatedAt,
        dimensionUnit: s.dimensionUnit,
      }),
    },
  ),
);

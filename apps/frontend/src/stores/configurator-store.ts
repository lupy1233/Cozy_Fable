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
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';
import { roomIssue } from '@/components/configurator/room-screens';
import { CONFIGURATOR_STORAGE_KEY, editSessionKey, isAbandonedEditSnapshot } from './configurator-keys';
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
  // b8 (PO g0-8): "La camera asta am nevoie de ajutor" — camera sare intrebarile si
  // pleaca la firme doar cu tipul si fisierele ei; raspunsurile raman doar aici, in ciorna
  needsDesignHelp?: boolean;
}

export interface ContactPreferenceValue {
  channel: 'EMAIL' | 'PHONE';
  value: string;
}

export interface DetailsValues {
  // fara titlu: e generat automat pe server din camere + oras
  description: string;
  // treapta derivata din suma (doar intern, pentru punctaj) sau 'UNDISCLOSED'; lipsa = neales (b11)
  budgetRange: string;
  // suma aleasa pe glisor (F5, item 18); null = UNDISCLOSED / nealeasa
  budgetEstimateRon?: number | null;
  // b11 (PO 2026-11-13): clientul a ales el suma sau "Prefer sa nu spun". Ciornele de dinainte
  // (fara camp) aveau bugetul pus din oficiu de formular: la incarcare se goleste (alegerea se
  // cere din nou), afara de "Prefer sa nu spun", care era mereu o alegere
  budgetChosen?: boolean;
  deadlineBucket: string;
  // oglinda a modului (startMode === 'OWN_PROJECT'); o scriu doar setStartMode si
  // normalizarea. "Proiectare cu plata" nu mai sta aici: e derivata din camere (b8).
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
  // b6: fisierele (schite, poza 3D) ale camerelor scoase din cos. Nu mai sunt "fisiere
  // ale proiectului": pe ciorna se sterg imediat, la editare abia dupa salvare.
  discardedFiles?: string[];
  // m3: ciorna veche avea bifa "Include proiectare cu plata" → nota din cos (o singura data)
  legacyPaidDesignNote?: boolean;
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
  // Modul e singura sursa (b8): seteaza si hasOwnProject si bifele de ajutor ale
  // camerelor (DESIGN_HELP → toate bifate; OWN_PROJECT → niciuna; STANDARD venit
  // din DESIGN_HELP → niciuna, ca intrebarile sa revina). null = inapoi la pornire.
  setStartMode: (mode: StartMode | null) => void;
  // bifa "La camera asta am nevoie de ajutor"; ignorata in OWN_PROJECT. Toate
  // camerele bifate = modul DESIGN_HELP; una debifata in DESIGN_HELP = STANDARD.
  setRoomDesignHelp: (localId: string, value: boolean) => void;
  dismissLegacyPaidDesignNote: () => void;
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

// Modul urmeaza bifele camerelor (PO g0-8): toate bifate = "Am nevoie de ajutor";
// in "Am nevoie de ajutor", o camera debifata trece cererea pe "Stiu ce vreau".
// Cosul gol nu schimba modul. OWN_PROJECT / fara mod raman neatinse.
// O camera / piesa adusa din Studio 3D (are configuratia si apare in scena Studio a
// cererii) e deja configurata: nu poate fi bifata "am nevoie de ajutor" (serverul refuza
// cu validation.designHelpWithStudioPiece). O astfel de camera ramane mereu nebifata, deci
// o cerere care o contine nu poate fi in modul "Am nevoie de ajutor".
export function isStudioRoom(room: Pick<RoomInstance, 'sourceStudio'>): boolean {
  return Boolean(room.sourceStudio);
}

export function modeForRooms(mode: StartMode | null, rooms: Pick<RoomInstance, 'needsDesignHelp'>[]): StartMode | null {
  if (mode === null || mode === 'OWN_PROJECT' || rooms.length === 0) return mode;
  if (rooms.every((r) => r.needsDesignHelp === true)) return 'DESIGN_HELP';
  return mode === 'DESIGN_HELP' ? 'STANDARD' : mode;
}

// Camera are deja raspunsuri la intrebari (pentru avertismentul de la b8-3).
export function roomHasAnswers(room: Pick<RoomInstance, 'answers'>): boolean {
  return Object.keys(room.answers ?? {}).length > 0;
}

// b6: fisierele camerei = id-urile din pasii de incarcare ai fluxului ei (schite, poza 3D).
// Un raspuns e fisier DOAR daca pasul lui e de incarcare; flux negasit → niciun fisier
// (nu se sterge nimic, iar dialogul nu numara alegerile multiple drept fisiere).
// `hiddenOnly`: doar pasii ascunsi (poza 3D), care nu pleaca la firme pentru o camera bifata.
export function roomFileIds(
  room: Pick<RoomInstance, 'roomType' | 'flowVersion' | 'answers'>,
  options?: { hiddenOnly?: boolean },
): string[] {
  let steps;
  try {
    steps = getFlow(room.roomType, room.flowVersion).steps;
  } catch {
    return [];
  }
  const ids: string[] = [];
  for (const step of steps) {
    if (step.type !== 'upload' || (options?.hiddenOnly && !step.hidden)) continue;
    const value = room.answers?.[step.id];
    if (!Array.isArray(value)) continue;
    for (const id of value) if (typeof id === 'string' && !ids.includes(id)) ids.push(id);
  }
  return ids;
}

// M1: fisierele care nu pleaca la firme si nu sunt "fisiere ale proiectului": ale camerelor
// scoase (discardedFiles) si cele ascunse (poza 3D) ale camerelor bifate "am nevoie de ajutor".
export function excludedFileIds(
  rooms: Pick<RoomInstance, 'roomType' | 'flowVersion' | 'answers' | 'needsDesignHelp'>[],
  discardedFiles: string[] | undefined,
): Set<string> {
  const out = new Set(discardedFiles ?? []);
  for (const room of rooms) {
    if (room.needsDesignHelp) for (const id of roomFileIds(room, { hiddenOnly: true })) out.add(id);
  }
  return out;
}

export function roomAnswerCount(room: Pick<RoomInstance, 'roomType' | 'flowVersion' | 'answers'>): number {
  // pasii de incarcare au liste de id-uri; tot restul sunt raspunsuri
  let uploadSteps = new Set<string>();
  try {
    uploadSteps = new Set(getFlow(room.roomType, room.flowVersion).steps.filter((s) => s.type === 'upload').map((s) => s.id));
  } catch {
    // flux negasit: toate cheile conteaza drept raspunsuri
  }
  return Object.keys(room.answers ?? {}).filter((stepId) => !uploadSteps.has(stepId)).length;
}

// b6: camera pe care o scoate "−" / "×" la un tip: ultima fara raspunsuri; daca toate
// au raspunsuri, ultima de acel tip (dialogul o numeste).
export function pickRoomToRemove<R extends Pick<RoomInstance, 'roomType' | 'answers'>>(
  rooms: R[],
  roomType: RoomType,
): R | null {
  const ofType = rooms.filter((r) => r.roomType === roomType);
  if (ofType.length === 0) return null;
  const empty = ofType.filter((r) => !roomHasAnswers(r));
  return (empty.length > 0 ? empty[empty.length - 1] : ofType[ofType.length - 1]) ?? null;
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
  // b11: bugetul pus din oficiu se goleste; o ciorna ajunsa la Sumar se intoarce la Date generale
  const budgetCleared = budgetNeedsNewChoice(snapshot.details ?? {});
  const details = normalizeDetails(snapshot.details);
  const hasProgress =
    roomInstances.length > 0 ||
    Object.keys(details).length > 0 ||
    (snapshot.phase !== undefined && snapshot.phase !== 'cart' && snapshot.phase !== 'start');
  let startMode = snapshot.startMode ?? (hasProgress ? 'STANDARD' : null);
  // b8: bifa veche "Am deja un proiect" din cos (in modul STANDARD) devine modul
  if (startMode === 'STANDARD' && details.hasOwnProject === true) startMode = 'OWN_PROJECT';
  // snapshot-uri dinainte de bifa pe camera: modul hotaraste bifele
  let rooms = roomInstances;
  if (startMode === 'DESIGN_HELP') rooms = rooms.map((r) => (r.needsDesignHelp || isStudioRoom(r) ? r : { ...r, needsDesignHelp: true }));
  // OWN_PROJECT si camerele din Studio nu au bifa de ajutor
  rooms = rooms.map((r) => (r.needsDesignHelp && (startMode === 'OWN_PROJECT' || isStudioRoom(r)) ? { ...r, needsDesignHelp: false } : r));
  startMode = modeForRooms(startMode, rooms);
  if (startMode !== null) details.hasOwnProject = startMode === 'OWN_PROJECT';
  const inspirationPhotoIds = Array.isArray(snapshot.inspirationPhotoIds) ? snapshot.inspirationPhotoIds : [];
  return {
    ...snapshot,
    startMode,
    phase:
      startMode == null
        ? 'start'
        : budgetCleared && snapshot.phase === 'review'
          ? 'details'
          : (snapshot.phase ?? 'start'),
    roomInstances: rooms,
    activeRoomIndex: remapped >= 0 ? remapped : 0,
    details,
    inspirationPhotoIds,
    inspirationMeta: sanitizeInspirationMeta(snapshot.inspirationMeta, inspirationPhotoIds, roomInstances),
    discardedFiles: Array.isArray(snapshot.discardedFiles)
      ? snapshot.discardedFiles.filter((id): id is string => typeof id === 'string')
      : [],
    // m3: ciorna veche "Stiu ce vreau" cu bifa "Include proiectare cu plata": nota din cos
    legacyPaidDesignNote:
      snapshot.legacyPaidDesignNote === true ||
      ((snapshot.details as { includesPaidDesign?: unknown } | undefined)?.includesPaidDesign === true &&
        startMode === 'STANDARD' &&
        !rooms.some((r) => r.needsDesignHelp)),
  };
}

// Patch comun pentru mutatiile care schimba componenta cosului: pastreaza
// ordinea canonica si camera activa (identificata prin localId).
// Modul se resincronizeaza cu bifele camerelor (b8).
function sortedRoomsPatch(
  current: Pick<ConfiguratorSnapshot, 'roomInstances' | 'activeRoomIndex' | 'startMode'>,
  nextRooms: RoomInstance[],
): Pick<ConfiguratorSnapshot, 'roomInstances' | 'activeRoomIndex' | 'startMode'> {
  const activeId = current.roomInstances[current.activeRoomIndex]?.localId;
  const roomInstances = sortByRoomOrder(nextRooms);
  const idx = activeId ? roomInstances.findIndex((r) => r.localId === activeId) : -1;
  return { roomInstances, activeRoomIndex: idx >= 0 ? idx : 0, startMode: modeForRooms(current.startMode, roomInstances) };
}

// b11: o valoare de buget fara marcajul de alegere (ciorna / editare de dinainte) — treapta
// sau suma puse de formular. "Prefer sa nu spun" ramane: era mereu bifat de client.
function budgetNeedsNewChoice(d: Partial<DetailsValues>): boolean {
  const hasValue = (d.budgetRange !== undefined && d.budgetRange !== '') || typeof d.budgetEstimateRon === 'number';
  return hasValue && d.budgetRange !== 'UNDISCLOSED' && d.budgetChosen !== true;
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
  // b8: "Proiectare cu plata" e derivata din bifele camerelor, nu mai e camp de detalii
  delete (d as { includesPaidDesign?: unknown }).includesPaidDesign;
  // b11: bugetul pus din oficiu (minimul estimarii, "Sub 5.000") nu e o alegere a clientului
  if (budgetNeedsNewChoice(d)) {
    delete d.budgetRange;
    delete d.budgetEstimateRon;
    delete d.budgetChosen;
  }
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

// --- memoria ciornei: cerere noua vs editare (b8, pasul 1) ---
// Acelasi store serveste si cererea noua si editarea unei cereri publicate, dar
// fiecare isi are memoria ei: cererea noua in localStorage (CONFIGURATOR_STORAGE_KEY),
// editarea in sessionStorage, o cheie per cerere (editSessionKey). 'detached' = nicio
// scriere (folosit cat timp se schimba memoria, ca resetul sa nu atinga nimic).
// 'finished' = editare salvata, in asteptarea plecarii de pe pagina: nicio scriere.
type StorageScope = { kind: 'new' } | { kind: 'edit'; requestId: string } | { kind: 'detached' } | { kind: 'finished' };
let storageScope: StorageScope = { kind: 'new' };

// M2: "generatia" ciornei din store; creste la fiecare golire (reset: "Incepe una noua",
// deconectare, intrarea / iesirea din editare). Un pas care scrie amanat (Date generale)
// isi tine minte generatia de la montare si nu scrie daca s-a schimbat.
let draftGeneration = 0;
export function draftGenerationId(): number {
  return draftGeneration;
}

function scopedTarget(name: string): { store: Storage; key: string } | null {
  if (typeof window === 'undefined') return null;
  try {
    if (storageScope.kind === 'new') return { store: window.localStorage, key: name };
    if (storageScope.kind === 'edit') return { store: window.sessionStorage, key: editSessionKey(storageScope.requestId) };
  } catch {
    // storage blocat (mod privat)
  }
  return null;
}

const scopedStorage: StateStorage = {
  getItem: (name) => {
    try {
      const target = scopedTarget(name);
      return target ? target.store.getItem(target.key) : null;
    } catch {
      return null;
    }
  },
  setItem: (name, value) => {
    try {
      const target = scopedTarget(name);
      target?.store.setItem(target.key, value);
    } catch {
      // plin / blocat: ciorna ramane doar in memorie
    }
  },
  removeItem: (name) => {
    try {
      const target = scopedTarget(name);
      target?.store.removeItem(target.key);
    } catch {
      // nimic de sters
    }
  },
};

const initialSnapshot: ConfiguratorSnapshot = {
  phase: 'start',
  startMode: null,
  roomInstances: [],
  activeRoomIndex: 0,
  activeStepIndex: 0,
  details: {},
  inspirationPhotoIds: [],
  inspirationMeta: {},
  discardedFiles: [],
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
      setStartMode: (mode) =>
        set((s) => {
          if (mode === null) return { startMode: null, updatedAt: Date.now() };
          // camerele din Studio raman nebifate (sunt deja configurate)
          const help = (value: boolean) =>
            s.roomInstances.map((r) => {
              const next = value && !isStudioRoom(r);
              return (r.needsDesignHelp === true) === next ? r : { ...r, needsDesignHelp: next };
            });
          const roomInstances =
            mode === 'DESIGN_HELP'
              ? help(true)
              : mode === 'OWN_PROJECT' || s.startMode === 'DESIGN_HELP'
                ? help(false)
                : s.roomInstances;
          // "Am nevoie de ajutor" cu piese din Studio in cos = "Stiu ce vreau" (modeForRooms)
          const startMode = modeForRooms(mode, roomInstances) ?? mode;
          return {
            startMode,
            roomInstances,
            details: { ...s.details, hasOwnProject: startMode === 'OWN_PROJECT' },
            updatedAt: Date.now(),
          };
        }),

      setRoomDesignHelp: (localId, value) =>
        set((s) => {
          if (s.startMode === 'OWN_PROJECT') return s;
          const target = s.roomInstances.find((r) => r.localId === localId);
          if (!target || (target.needsDesignHelp === true) === value) return s;
          if (value && isStudioRoom(target)) return s;
          const roomInstances = s.roomInstances.map((r) => (r.localId === localId ? { ...r, needsDesignHelp: value } : r));
          return {
            roomInstances,
            startMode: modeForRooms(s.startMode, roomInstances),
            // m3: dupa prima camera bifata nota despre bifa veche nu mai e necesara
            ...(value ? { legacyPaidDesignNote: false } : {}),
            updatedAt: Date.now(),
          };
        }),

      dismissLegacyPaidDesignNote: () => set({ legacyPaidDesignNote: false, updatedAt: Date.now() }),

      // insertia pastreaza ordinea canonica ROOM_ORDER (nu ordinea adaugarii in cos);
      // in modul "Am nevoie de ajutor" camera noua porneste bifata (PO g0-8)
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
              ...(s.startMode === 'DESIGN_HELP' ? { needsDesignHelp: true } : {}),
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
                ...(s.startMode === 'DESIGN_HELP' ? { needsDesignHelp: true } : {}),
              },
            ]),
            updatedAt: Date.now(),
          };
        }),

      transferStudio: (data) => {
        const s = get();
        const result = prepareStudioTransfer(data, s.roomInstances, s.studioScenes ?? [], newLocalId);
        if (result.ok) {
          // camerele venite acum din Studio pornesc bifate in "Am nevoie de ajutor"
          const known = new Set(s.roomInstances.map((r) => r.localId));
          const rooms = s.startMode === 'DESIGN_HELP'
            ? result.roomInstances.map((r) => (known.has(r.localId) || isStudioRoom(r) ? r : { ...r, needsDesignHelp: true }))
            : result.roomInstances;
          set({ ...sortedRoomsPatch(s, rooms), studioScenes: result.studioScenes, updatedAt: Date.now() });
        }
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

      // b6: scoate intai o camera fara raspunsuri (vezi pickRoomToRemove)
      removeLastOfType: (roomType) => {
        const target = pickRoomToRemove(get().roomInstances, roomType);
        if (target) get().removeRoom(target.localId);
      },

      // scoate camera, poza ei 3D din memorie si muta fisierele ei la "aruncate" (b6),
      // ca sa nu mai apara drept fisiere ale proiectului
      removeRoom: (localId) =>
        set((s) => {
          const room = s.roomInstances.find((r) => r.localId === localId);
          if (!room) return s;
          const { [localId]: _removed, ...snapshots3d } = s.snapshots3d;
          const remaining = s.roomInstances.filter((r) => r.localId !== localId);
          const files = roomFileIds(room);
          const discarded = s.discardedFiles ?? [];
          return {
            ...sortedRoomsPatch(s, remaining),
            inspirationMeta: sanitizeInspirationMeta(s.inspirationMeta, s.inspirationPhotoIds, remaining),
            snapshots3d,
            discardedFiles: files.length > 0 ? [...discarded, ...files.filter((id) => !discarded.includes(id))] : discarded,
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
          ...((s.discardedFiles?.length ?? 0) > 0 ? { discardedFiles: s.discardedFiles } : {}),
          ...(s.legacyPaidDesignNote ? { legacyPaidDesignNote: true } : {}),
          updatedAt: s.updatedAt,
        };
      },

      reset: () => {
        // M2: o salvare amanata pornita inainte de golire nu mai scrie dupa ea
        draftGeneration += 1;
        set({
          token: null,
          snapshots3d: {},
          ...initialSnapshot,
          studioScenes: undefined,
          legacyPaidDesignNote: false,
          updatedAt: Date.now(),
        });
      },
    }),
    {
      name: CONFIGURATOR_STORAGE_KEY,
      storage: createJSONStorage(() => scopedStorage),
      // v4 (2026-07-31): faza 'start' + startMode; snapshot-urile vechi cu progres
      // devin STANDARD, cele goale intra pe pasul de pornire
      // v5 (b8, 2026-11-13): bifa de ajutor pe camera; editarile abandonate scrise
      // de build-urile vechi in cheia cererii noi sunt aruncate (nu mai apar ca "Continui?")
      // v6 (b11, 2026-11-13): bugetul pus din oficiu de formularul vechi se goleste (fara
      // budgetChosen) si se cere din nou; normalizeDetails o face pe toate caile de intrare
      version: 6,
      // snapshot-uri persistate inainte de versionarea flow-urilor → flowVersion 1;
      // detaliile vechi (titlu, prioritati contact, termen-data) sunt normalizate;
      // draft-urile in curs sunt resortate pe ordinea canonica (camera activa pastrata)
      migrate: (persisted) => {
        const state = persisted as Partial<ConfiguratorSnapshot> & { dimensionUnit?: DimensionUnit };
        if (isAbandonedEditSnapshot(state)) {
          const blank: typeof state = {
            ...initialSnapshot,
            updatedAt: Date.now(),
            ...(state.dimensionUnit ? { dimensionUnit: state.dimensionUnit } : {}),
          };
          return { ...blank, ...normalizeSnapshot(blank) };
        }
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
        discardedFiles: s.discardedFiles,
        legacyPaidDesignNote: s.legacyPaidDesignNote,
        updatedAt: s.updatedAt,
        dimensionUnit: s.dimensionUnit,
      }),
    },
  ),
);

// Reseteaza memoria din store fara sa scrie in vreun storage.
function resetDetached(): void {
  storageScope = { kind: 'detached' };
  useConfiguratorStore.getState().reset();
}

// Intrarea in editarea unei cereri publicate (b8): store-ul trece pe memoria
// editarii (sessionStorage, cheie per cerere); ciorna cererii noi din localStorage
// nu mai e atinsa. Intoarce true daca editarea a fost reluata din tab (reincarcare
// de pagina), false daca apelantul trebuie s-o construiasca din cerere.
export function enterEditSession(requestId: string): boolean {
  // aceeasi cerere redeschisa imediat (schimbarea limbii, dubla montare din dev):
  // aruncarea programata se anuleaza si editarea continua; alta cerere → aruncare acum
  holdEditSession(requestId);
  discardPendingEditSession();
  resetDetached();
  storageScope = { kind: 'edit', requestId };
  let raw: string | null = null;
  try {
    raw = window.sessionStorage.getItem(editSessionKey(requestId));
  } catch {
    raw = null;
  }
  if (!raw) return false;
  try {
    const state = (JSON.parse(raw) as { state?: ConfiguratorSnapshot }).state;
    if (!state || !Array.isArray(state.roomInstances)) return false;
    useConfiguratorStore.getState().loadSnapshot(state);
    return true;
  } catch {
    return false;
  }
}

// --- aruncarea amanata a editarii (schimbarea limbii, coordonator 2026-11-13) ---
// Schimbarea limbii demonteaza pagina si o monteaza din nou, in cealalta limba. De aceea
// iesirea din pagina nu sterge editarea pe loc: o pastreaza in sessionStorage cel mult
// EDIT_RESUME_WINDOW_MS. Daca in fereastra se redeschide ACEEASI cerere, editarea continua;
// altfel (timpul trece, alta editare, /requests/new, deconectarea) se arunca. Store-ul
// revine oricum imediat pe ciorna cererii noi, care nu e atinsa. Editarea sta doar in
// sessionStorage, deci hasUnpublishedLocalDraft / cardul de pe Panou nu o vad.
export const EDIT_RESUME_WINDOW_MS = 2000;
let pendingDiscard: { requestId: string; timer: ReturnType<typeof setTimeout> | null } | null = null;

function removeEditKey(requestId: string): void {
  try {
    window.sessionStorage.removeItem(editSessionKey(requestId));
  } catch {
    // storage indisponibil
  }
}

// Arunca acum editarea care asteapta (daca exista).
export function discardPendingEditSession(): void {
  if (!pendingDiscard) return;
  if (pendingDiscard.timer) clearTimeout(pendingDiscard.timer);
  removeEditKey(pendingDiscard.requestId);
  pendingDiscard = null;
}

// Pagina de editare a aceleiasi cereri s-a montat din nou: aruncarea programata se
// anuleaza (cererea poate sosi de pe server dupa fereastra — la schimbarea limbii
// cache-ul de date porneste gol). Intrarea propriu-zisa o face enterEditSession.
export function holdEditSession(requestId: string): void {
  if (pendingDiscard?.requestId !== requestId) return;
  if (pendingDiscard.timer) clearTimeout(pendingDiscard.timer);
  pendingDiscard = null;
}

// Iesirea din editare (salvata sau nu): store-ul revine pe ciorna cererii noi, citita din
// nou din localStorage. Implicit editarea se arunca pe loc; cu `keepForMs` (demontarea
// paginii) se arunca dupa fereastra de mai sus, daca nu e reluata. Dupa
// finishEditSession nu mai e nimic de pastrat. Fara efect in afara editarii.
export function leaveEditSession(options?: { keepForMs?: number }): void {
  if (storageScope.kind !== 'edit' && storageScope.kind !== 'finished') return;
  if (storageScope.kind === 'edit') {
    const requestId = storageScope.requestId;
    discardPendingEditSession();
    if (options?.keepForMs && options.keepForMs > 0) {
      const timer = setTimeout(() => {
        if (pendingDiscard?.requestId === requestId) {
          removeEditKey(requestId);
          pendingDiscard = null;
        }
      }, options.keepForMs);
      pendingDiscard = { requestId, timer };
    } else {
      removeEditKey(requestId);
    }
  }
  resetDetached();
  storageScope = { kind: 'new' };
  void useConfiguratorStore.persist.rehydrate();
}

// Dupa "Salveaza modificarile": editarea se sterge sigur (nu mai poate fi reluata), iar
// store-ul nu mai scrie nicaieri. Ecranul ramane neschimbat pana la plecare (b3);
// leaveEditSession de la demontare readuce apoi ciorna cererii noi.
export function finishEditSession(): void {
  if (storageScope.kind !== 'edit') return;
  const requestId = storageScope.requestId;
  holdEditSession(requestId);
  removeEditKey(requestId);
  storageScope = { kind: 'finished' };
}

// m2: golirea la deconectare / schimbarea contului. Store-ul se goleste fara sa scrie
// nicaieri (nici o editare goala in sessionStorage, nici o ciorna goala) si ramane pe
// memoria cererii noi; o editare in asteptare se arunca. Apelantul sterge cheile.
export function clearConfiguratorMemory(): void {
  discardPendingEditSession();
  resetDetached();
  storageScope = { kind: 'new' };
}

export function isInEditSession(): boolean {
  return storageScope.kind === 'edit';
}

// Memoria in care scrie acum store-ul ('new' | 'edit:<id>' | 'detached' | 'finished'). Un
// pas care salveaza la demontare (b2) verifica sa scrie tot in memoria in care a pornit.
export function storageScopeId(): string {
  return storageScope.kind === 'edit' ? `edit:${storageScope.requestId}` : storageScope.kind;
}

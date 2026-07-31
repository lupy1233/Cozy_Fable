'use client';

import type { AnswerMap, AnswerValue, RoomType } from '@marketplace/shared';
import { CURRENT_FLOW_VERSION, getFlow, pruneAnswers, sortByRoomOrder } from '@marketplace/shared';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Stare wizard configurator. Conform STATE_CONVENTIONS Exemplul 1:
// Zustand tine pasul curent + draftul local pre-submit + tokenul; RHF tine campurile
// pasului curent; TanStack se ocupa de mutatiile server (createDraft/patch/publish).
// Persistat in localStorage → refresh-ul reia exact acelasi pas/raspunsuri.

export type ConfiguratorPhase = 'cart' | 'rooms' | 'details' | 'uploads' | 'review';

// Modul de pornire ales in dialogul "cum incepem?" (PO 2026-07-31):
// - OWN_PROJECT: are proiect tehnic → acelasi formular, fara pasii de dimensiuni/schite
// - STANDARD: stie ce vrea, fara proiect → formularul complet
// - DESIGN_HELP: nu stie ce vrea → alege doar camerele, publica cu Proiectare platita
export type StartMode = 'OWN_PROJECT' | 'STANDARD' | 'DESIGN_HELP';

export interface RoomInstance {
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
  updatedAt: number;
}

// Unitatea de afisare pentru inputurile de dimensiuni (valorile raman in metri
// in answers — conversia e pur prezentationala, in StepRenderer).
export type DimensionUnit = 'm' | 'cm' | 'mm';

interface ConfiguratorStore extends ConfiguratorSnapshot {
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
  removeLastOfType: (roomType: RoomType) => void;
  removeRoom: (localId: string) => void;
  setActiveRoom: (index: number) => void;
  setStepIndex: (index: number) => void;
  setAnswer: (localId: string, stepId: string, value: AnswerValue) => void;
  copyRoomAnswers: (sourceLocalId: string, targetLocalId: string) => void;
  markRoomCompleted: (localId: string, completed: boolean) => void;
  setDetails: (patch: Partial<DetailsValues>) => void;
  setInspirationPhotos: (ids: string[]) => void;
  loadSnapshot: (snapshot: ConfiguratorSnapshot) => void;
  snapshot: () => ConfiguratorSnapshot;
  reset: () => void;
}

function newLocalId(): string {
  return `r_${Math.random().toString(36).slice(2, 10)}`;
}

// Normalizeaza instante provenite din snapshot-uri vechi (fara flowVersion):
// acele camere au fost create pe versiunea 1 a flow-urilor. Aplicata pe TOATE
// caile de intrare (migrate localStorage, resume de pe server, edit-mode),
// impune si ordinea canonica a intrebarilor (ROOM_ORDER, stabila per tip).
function normalizeInstances(rooms: RoomInstance[] | undefined): RoomInstance[] {
  return sortByRoomOrder((rooms ?? []).map((r) => ({ ...r, flowVersion: r.flowVersion ?? 1 })));
}

// Dupa reordonare, indexul camerei active trebuie remapat prin localId —
// altfel resume-ul mid-flow ar deschide alta camera decat cea in lucru.
function normalizeSnapshot(snapshot: Partial<ConfiguratorSnapshot>): Partial<ConfiguratorSnapshot> {
  const original = snapshot.roomInstances ?? [];
  const activeId = original[snapshot.activeRoomIndex ?? 0]?.localId;
  const roomInstances = normalizeInstances(original);
  const remapped = activeId ? roomInstances.findIndex((r) => r.localId === activeId) : -1;
  return {
    ...snapshot,
    startMode: snapshot.startMode ?? null,
    roomInstances,
    activeRoomIndex: remapped >= 0 ? remapped : 0,
    details: normalizeDetails(snapshot.details),
    inspirationPhotoIds: Array.isArray(snapshot.inspirationPhotoIds)
      ? snapshot.inspirationPhotoIds
      : [],
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
  phase: 'cart',
  startMode: null,
  roomInstances: [],
  activeRoomIndex: 0,
  activeStepIndex: 0,
  details: {},
  inspirationPhotoIds: [],
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
        set({ inspirationPhotoIds: [...new Set(ids)].slice(0, 10), updatedAt: Date.now() }),
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

      removeLastOfType: (roomType) =>
        set((s) => {
          const idx = [...s.roomInstances].map((r) => r.roomType).lastIndexOf(roomType);
          if (idx < 0) return s;
          return {
            ...sortedRoomsPatch(s, s.roomInstances.filter((_, i) => i !== idx)),
            updatedAt: Date.now(),
          };
        }),

      removeRoom: (localId) =>
        set((s) => {
          const { [localId]: _removed, ...snapshots3d } = s.snapshots3d;
          return {
            ...sortedRoomsPatch(s, s.roomInstances.filter((r) => r.localId !== localId)),
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
          updatedAt: s.updatedAt,
        };
      },

      reset: () => set({ token: null, snapshots3d: {}, ...initialSnapshot, updatedAt: Date.now() }),
    }),
    {
      name: 'mm_configurator_v1',
      // v3 (2026-07): ordinea canonica ROOM_ORDER + remap activeRoomIndex
      version: 3,
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
        updatedAt: s.updatedAt,
        dimensionUnit: s.dimensionUnit,
      }),
    },
  ),
);

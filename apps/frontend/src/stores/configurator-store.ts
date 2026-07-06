'use client';

import type { AnswerMap, AnswerValue, RoomType } from '@marketplace/shared';
import { CURRENT_FLOW_VERSION, getFlow, pruneAnswers } from '@marketplace/shared';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Stare wizard configurator. Conform STATE_CONVENTIONS Exemplul 1:
// Zustand tine pasul curent + draftul local pre-submit + tokenul; RHF tine campurile
// pasului curent; TanStack se ocupa de mutatiile server (createDraft/patch/publish).
// Persistat in localStorage → refresh-ul reia exact acelasi pas/raspunsuri.

export type ConfiguratorPhase = 'cart' | 'rooms' | 'details' | 'uploads' | 'review';

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
  deadlineBucket: string;
  includesPaidDesign: boolean;
  hasOwnProject: boolean;
  addressText: string;
  county: string;
  city: string;
  contactPreferences: ContactPreferenceValue[];
}

// Snapshot serializabil trimis la server (configuratorState) si rehidratat la resume.
export interface ConfiguratorSnapshot {
  phase: ConfiguratorPhase;
  roomInstances: RoomInstance[];
  activeRoomIndex: number;
  activeStepIndex: number;
  details: Partial<DetailsValues>;
  updatedAt: number;
}

interface ConfiguratorStore extends ConfiguratorSnapshot {
  token: string | null;
  setToken: (token: string) => void;
  setPhase: (phase: ConfiguratorPhase) => void;
  addRoom: (roomType: RoomType) => void;
  removeLastOfType: (roomType: RoomType) => void;
  removeRoom: (localId: string) => void;
  setActiveRoom: (index: number) => void;
  setStepIndex: (index: number) => void;
  setAnswer: (localId: string, stepId: string, value: AnswerValue) => void;
  copyRoomAnswers: (sourceLocalId: string, targetLocalId: string) => void;
  markRoomCompleted: (localId: string, completed: boolean) => void;
  setDetails: (patch: Partial<DetailsValues>) => void;
  loadSnapshot: (snapshot: ConfiguratorSnapshot) => void;
  snapshot: () => ConfiguratorSnapshot;
  reset: () => void;
}

function newLocalId(): string {
  return `r_${Math.random().toString(36).slice(2, 10)}`;
}

// Normalizeaza instante provenite din snapshot-uri vechi (fara flowVersion):
// acele camere au fost create pe versiunea 1 a flow-urilor.
function normalizeInstances(rooms: RoomInstance[] | undefined): RoomInstance[] {
  return (rooms ?? []).map((r) => ({ ...r, flowVersion: r.flowVersion ?? 1 }));
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
  roomInstances: [],
  activeRoomIndex: 0,
  activeStepIndex: 0,
  details: {},
  updatedAt: Date.now(),
};

export const useConfiguratorStore = create<ConfiguratorStore>()(
  persist(
    (set, get) => ({
      token: null,
      ...initialSnapshot,

      setToken: (token) => set({ token }),
      setPhase: (phase) => set({ phase, updatedAt: Date.now() }),

      addRoom: (roomType) =>
        set((s) => ({
          roomInstances: [
            ...s.roomInstances,
            {
              localId: newLocalId(),
              roomType,
              flowVersion: CURRENT_FLOW_VERSION[roomType],
              answers: {},
              completed: false,
            },
          ],
          updatedAt: Date.now(),
        })),

      removeLastOfType: (roomType) =>
        set((s) => {
          const idx = [...s.roomInstances].map((r) => r.roomType).lastIndexOf(roomType);
          if (idx < 0) return s;
          const roomInstances = s.roomInstances.filter((_, i) => i !== idx);
          return { roomInstances, updatedAt: Date.now() };
        }),

      removeRoom: (localId) =>
        set((s) => ({
          roomInstances: s.roomInstances.filter((r) => r.localId !== localId),
          updatedAt: Date.now(),
        })),

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

      loadSnapshot: (snapshot) =>
        set({
          ...snapshot,
          roomInstances: normalizeInstances(snapshot.roomInstances),
          details: normalizeDetails(snapshot.details),
        }),

      snapshot: () => {
        const s = get();
        return {
          phase: s.phase,
          roomInstances: s.roomInstances,
          activeRoomIndex: s.activeRoomIndex,
          activeStepIndex: s.activeStepIndex,
          details: s.details,
          updatedAt: s.updatedAt,
        };
      },

      reset: () => set({ token: null, ...initialSnapshot, updatedAt: Date.now() }),
    }),
    {
      name: 'mm_configurator_v1',
      version: 2,
      // snapshot-uri persistate inainte de versionarea flow-urilor → flowVersion 1;
      // detaliile vechi (titlu, prioritati contact, termen-data) sunt normalizate
      migrate: (persisted) => {
        const state = persisted as Partial<ConfiguratorSnapshot>;
        return {
          ...state,
          roomInstances: normalizeInstances(state.roomInstances),
          details: normalizeDetails(state.details),
        };
      },
      // nu persista tokenul in acelasi blob cu datele — el sta separat (vezi wizard)
      partialize: (s) => ({
        phase: s.phase,
        roomInstances: s.roomInstances,
        activeRoomIndex: s.activeRoomIndex,
        activeStepIndex: s.activeStepIndex,
        details: s.details,
        updatedAt: s.updatedAt,
      }),
    },
  ),
);

'use client';

import {
  draftGenerationId,
  NAV_GEN_KEY_PREFIX,
  storageScopeId,
  useConfiguratorStore,
  type ConfiguratorPhase,
  type ConfiguratorSnapshot,
} from './configurator-store';

// m1 (etapa 12): Back / Forward din browser in formularul de cerere.
// Adresa paginii NU se schimba (fara date personale si fara tokenul ciornei in URL): fiecare
// schimbare de faza sau de ecran adauga o intrare in istoric cu `history.pushState`, iar in
// `history.state` sta doar locul din formular (faza; la intrebari camera + ecranul). La
// `popstate` formularul sare la locul intrarii, cu raspunsurile pastrate (store-ul nu se
// atinge in afara locului). Sursa de adevar ramane store-ul: istoricul il urmeaza.
// - „Inapoi” din pagina spre locul intrarii de dinainte = `history.back()` (acelasi loc ca
//   Back-ul browserului, fara intrari duble); „Continua” spre locul intrarii urmatoare
//   (dupa un Back) = `history.forward()`; altfel o intrare noua.
// - Fiecare ciorna are o „generatie” (in sessionStorage, pe memoria ciornei: cererea noua
//   sau editarea unei cereri). „Incepe una noua”, deconectarea sau publicarea o schimba;
//   intrarile generatiei vechi se sar (in directia in care mergea omul), deci Back nu duce
//   intr-o ciorna care nu mai exista si nu se face bucla.
// - Prima intrare a paginii nu are „inainte” in formular: Back de acolo paraseste pagina.

export const NAV_STATE_KEY = 'cozyConfiguratorNav';
// m14: cheia sta in store, ca deconectarea (clearConfiguratorMemory) sa o poata sterge
const GEN_KEY_PREFIX = NAV_GEN_KEY_PREFIX;

export type NavPosition = { phase: ConfiguratorPhase; room?: string; step?: number };
// i = pozitia intrarii in istoricul tabului (stabila: push taie doar ce e dupa)
export type NavEntry = { g: string; i: number; pos: NavPosition; prev: NavPosition | null };

const PHASES: readonly ConfiguratorPhase[] = ['start', 'cart', 'rooms', 'uploads', 'details', 'review'];

const memoryGens = new Map<string, string>();

function randomGen(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  } catch {
    // fara crypto
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function readGen(scope: string): string {
  try {
    return window.sessionStorage.getItem(GEN_KEY_PREFIX + scope) ?? newGen(scope);
  } catch {
    // sessionStorage blocat: generatia traieste doar cat pagina
    return memoryGens.get(scope) ?? newGen(scope);
  }
}

function newGen(scope: string): string {
  const gen = randomGen();
  memoryGens.set(scope, gen);
  try {
    window.sessionStorage.setItem(GEN_KEY_PREFIX + scope, gen);
  } catch {
    // ramane in memorie
  }
  return gen;
}

// Dupa publicare / salvare: intrarile ramase in istoric nu mai duc in formular.
export function forgetConfiguratorHistory(scope: string = storageScopeId()): void {
  memoryGens.delete(scope);
  try {
    window.sessionStorage.removeItem(GEN_KEY_PREFIX + scope);
  } catch {
    // nimic de sters
  }
}

type PositionSource = Pick<ConfiguratorSnapshot, 'phase' | 'roomInstances' | 'activeRoomIndex' | 'activeStepIndex'>;

export function positionOf(s: PositionSource): NavPosition {
  if (s.phase !== 'rooms') return { phase: s.phase };
  return { phase: 'rooms', room: s.roomInstances[s.activeRoomIndex]?.localId, step: s.activeStepIndex };
}

export function samePosition(a: NavPosition | null | undefined, b: NavPosition | null | undefined): boolean {
  if (!a || !b) return false;
  if (a.phase !== b.phase) return false;
  if (a.phase !== 'rooms') return true;
  return a.room === b.room && (a.step ?? 0) === (b.step ?? 0);
}

function isPosition(v: unknown): v is NavPosition {
  return Boolean(v) && typeof v === 'object' && PHASES.includes((v as NavPosition).phase);
}

export function readNavEntry(state: unknown): NavEntry | null {
  if (!state || typeof state !== 'object') return null;
  const raw = (state as Record<string, unknown>)[NAV_STATE_KEY] as Partial<NavEntry> | undefined;
  if (!raw || typeof raw !== 'object') return null;
  if (typeof raw.g !== 'string' || typeof raw.i !== 'number' || !isPosition(raw.pos)) return null;
  return { g: raw.g, i: raw.i, pos: raw.pos, prev: isPosition(raw.prev) ? raw.prev : null };
}

// /ro/requests/new si /en/requests/new sunt aceeasi pagina de formular
function formPath(pathname: string): string {
  return pathname.replace(/^\/(ro|en)(?=\/|$)/, '') || '/';
}

type PositionPatch = Partial<Pick<ConfiguratorSnapshot, 'phase' | 'activeRoomIndex' | 'activeStepIndex'>> & {
  phase: ConfiguratorPhase;
};

// Locul unei intrari, adus la ce exista acum in ciorna (aceleasi plase de siguranta ca
// wizard-ul si runner-ul, ca ele sa nu mai corecteze dupa noi cu o intrare in plus):
// fara mod → pornirea; „Am nevoie de ajutor” → fara intrebari; camera scoasa sau bifata →
// prima camera cu intrebari, altfel cosul.
export function resolvePosition(pos: NavPosition, s: Pick<ConfiguratorSnapshot, 'startMode' | 'roomInstances'>): PositionPatch {
  if (s.startMode == null) return { phase: 'start' };
  let phase = pos.phase;
  if (phase === 'rooms' && s.startMode === 'DESIGN_HELP') phase = 'uploads';
  if (phase !== 'rooms') return { phase };
  const exact = s.roomInstances.findIndex((r) => r.localId === pos.room);
  if (exact >= 0 && !s.roomInstances[exact]!.needsDesignHelp) {
    return { phase, activeRoomIndex: exact, activeStepIndex: Math.max(0, pos.step ?? 0) };
  }
  const first = s.roomInstances.findIndex((r) => !r.needsDesignHelp);
  if (first < 0) return { phase: 'cart' };
  return { phase, activeRoomIndex: first, activeStepIndex: 0 };
}

type HistoryState = ReturnType<typeof useConfiguratorStore.getState>;

export type ConfiguratorHistoryOptions = {
  // m11 (revizuire): ecranul de pe care pleaca omul cu Forward trece validarea de la „Continua”?
  canLeaveForward?: (state: HistoryState) => boolean;
  // nu trece: istoricul ramane pe ecran, iar formularul face „Continua” (mesajele ecranului)
  onForwardBlocked?: () => void;
  // m12: cate ecrane vizibile are acum camera (un raspuns schimbat poate ascunde ecrane)
  screenCount?: (roomIndex: number, state: HistoryState) => number;
  // Back / Forward din browser a mutat formularul (ex. inchiderea dialogurilor deschise)
  onTraverse?: () => void;
};

// Porneste legatura formular ↔ istoric; intoarce oprirea. Se apeleaza dupa ce ciorna (sau
// editarea) e incarcata, deci locul din store e cel real.
export function startConfiguratorHistory(options: ConfiguratorHistoryOptions = {}): () => void {
  if (typeof window === 'undefined') return () => {};
  const scope = storageScopeId();
  if (scope !== 'new' && !scope.startsWith('edit:')) return () => {};
  const store = useConfiguratorStore;
  const path = formPath(window.location.pathname);
  let gen = readGen(scope);
  let seenDraftGen = draftGenerationId();
  let cur: NavEntry;
  // ultima intrare pe care locul din store era cel al intrarii (fara intrarile sarite)
  let anchor: NavEntry;
  // locul intrarii urmatoare, cand il stim (dupa un pas inapoi)
  let nextPos: NavPosition | null = null;
  // un history.go() pornit de noi, in asteptarea lui popstate: 'own' = „Inapoi” / „Continua”
  // din pagina sau intoarcerea dupa un Forward oprit (store-ul e deja la tinta); 'skip' = sarim
  // intrarile unei ciorne vechi sau ale unui ecran care nu mai exista
  let pending: 'own' | 'skip' | null = null;
  let pendingTimer: ReturnType<typeof setTimeout> | null = null;
  let scheduled = false;
  let stopped = false;

  const write = (mode: 'push' | 'replace', entry: NavEntry) => {
    // pastreaza ce mai tine Next.js in history.state (altfel Back ar reincarca pagina)
    const state = { ...((window.history.state as Record<string, unknown> | null) ?? {}), [NAV_STATE_KEY]: entry };
    if (mode === 'push') window.history.pushState(state, '');
    else window.history.replaceState(state, '');
    cur = entry;
    anchor = entry;
  };

  const go = (delta: number, kind: 'own' | 'skip') => {
    pending = kind;
    if (pendingTimer) clearTimeout(pendingTimer);
    // plasa: daca popstate nu vine (capatul istoricului, pagina blocata), intrarea pe care
    // suntem primeste locul din store — fara un al doilea go() (m13: niciodata doi pasi);
    // un popstate intarziat aplica apoi un loc egal cu cel din store, deci nu muta nimic
    pendingTimer = setTimeout(() => {
      pendingTimer = null;
      if (!pending || stopped) return;
      pending = null;
      const here = readNavEntry(window.history.state);
      if (here && here.g === gen) {
        nextPos = null;
        const pos = positionOf(store.getState());
        if (!samePosition(here.pos, pos)) write('replace', { ...here, pos });
        else cur = anchor = here;
        return;
      }
      schedule();
    }, 1000);
    window.history.go(delta);
  };

  // intrarea paginii: locul curent; Back de aici paraseste pagina (sau, dupa o
  // reincarcare, merge la ecranul de dinainte, care e tot al acestei ciorne)
  {
    const existing = readNavEntry(window.history.state);
    const pos = positionOf(store.getState());
    if (existing && existing.g === gen && samePosition(existing.pos, pos)) {
      cur = anchor = existing;
    } else {
      // aceeasi generatie, alt loc: ciorna s-a schimbat intre timp (publicata, golita) —
      // intrarile vechi nu mai duc in ea
      if (existing && existing.g === gen) gen = newGen(scope);
      write('replace', { g: gen, i: existing?.i ?? window.history.length - 1, pos, prev: null });
    }
  }

  const sync = () => {
    scheduled = false;
    if (stopped || pending) return;
    if (formPath(window.location.pathname) !== path || storageScopeId() !== scope) return;
    const pos = positionOf(store.getState());
    if (draftGenerationId() !== seenDraftGen) {
      // ciorna golita („Incepe una noua”, deconectare): generatie noua, fara drum inapoi in ea
      seenDraftGen = draftGenerationId();
      gen = newGen(scope);
      nextPos = null;
      write('replace', { g: gen, i: cur.i, pos, prev: null });
      return;
    }
    const here = readNavEntry(window.history.state);
    if (!here || here.g !== gen) {
      nextPos = null;
      write('replace', { g: gen, i: here?.i ?? cur.i, pos, prev: null });
      return;
    }
    cur = here;
    if (samePosition(pos, here.pos)) {
      anchor = here;
      return;
    }
    if (here.prev && samePosition(pos, here.prev)) return go(-1, 'own');
    if (nextPos && samePosition(pos, nextPos)) return go(1, 'own');
    nextPos = null;
    write('push', { g: gen, i: here.i + 1, pos, prev: here.pos });
  };

  function schedule() {
    if (scheduled || stopped) return;
    scheduled = true;
    // schimbarile din acelasi clic (ex. camera + faza) dau o singura intrare
    queueMicrotask(sync);
  }

  const onPopState = (event: PopStateEvent) => {
    if (stopped) return;
    const ours = pending === 'own';
    pending = null;
    if (pendingTimer) {
      clearTimeout(pendingTimer);
      pendingTimer = null;
    }
    // alta pagina (Next.js navigheaza): nu e treaba formularului
    if (formPath(window.location.pathname) !== path) return;
    const entry = readNavEntry(event.state);
    if (!entry) {
      schedule();
      return;
    }
    const from = cur;
    if (entry.g !== gen) {
      // intrare a unei ciorne care nu mai exista: o sarim, in aceeasi directie (fara
      // directie sigura — pozitii egale — intrarea devine a ciornei curente, fara salt)
      cur = entry;
      if (entry.i === from.i) {
        schedule();
        return;
      }
      go(entry.i < from.i ? -1 : 1, 'skip');
      return;
    }
    cur = entry;
    nextPos = entry.i === from.i - 1 ? from.pos : null;
    if (ours) {
      // „Inapoi” / „Continua” din pagina: store-ul e deja acolo (sau a mers mai departe)
      anchor = entry;
      schedule();
      return;
    }
    const state = store.getState();
    const patch = resolvePosition(entry.pos, state);
    const direction = entry.i > from.i ? 1 : entry.i < from.i ? -1 : 0;
    // m12: ecranul intrarii nu mai exista (un raspuns l-a ascuns) — intrarea se sare in
    // directia mersului, ca intrarile ciornelor vechi; fara directie, ultimul ecran al camerei
    if (patch.phase === 'rooms' && patch.activeRoomIndex !== undefined && options.screenCount) {
      const last = Math.max(0, options.screenCount(patch.activeRoomIndex, state) - 1);
      if ((patch.activeStepIndex ?? 0) > last) {
        if (direction !== 0) {
          go(direction, 'skip');
          return;
        }
        patch.activeStepIndex = last;
      }
    }
    // m11: Forward nu trece de un ecran care nu trece validarea de la „Continua” — istoricul
    // revine pe intrarea ecranului, iar formularul arata mesajele lui (ca la „Continua”)
    if (direction > 0 && options.canLeaveForward && !samePosition(positionOf(state), positionOf({ ...state, ...patch })) && !options.canLeaveForward(state)) {
      // inapoi pe intrarea pe care era omul (peste intrarile sarite intre timp)
      go(anchor.i - entry.i, 'own');
      options.onForwardBlocked?.();
      return;
    }
    const changed =
      patch.phase !== state.phase ||
      (patch.activeRoomIndex !== undefined && patch.activeRoomIndex !== state.activeRoomIndex) ||
      (patch.activeStepIndex !== undefined && patch.activeStepIndex !== state.activeStepIndex);
    if (changed) store.setState({ ...patch, updatedAt: Date.now() });
    const now = positionOf(store.getState());
    // locul corectat (ex. camera scoasa intre timp) se scrie pe intrare, fara intrare noua
    if (!samePosition(now, entry.pos)) write('replace', { ...entry, pos: now });
    else anchor = entry;
    options.onTraverse?.();
  };

  const unsubscribe = store.subscribe(schedule);
  window.addEventListener('popstate', onPopState);
  return () => {
    stopped = true;
    unsubscribe();
    window.removeEventListener('popstate', onPopState);
    if (pendingTimer) clearTimeout(pendingTimer);
  };
}

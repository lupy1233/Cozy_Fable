import { CURRENT_FLOW_VERSION, defaultPieceConfig } from '@marketplace/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  draftGenerationId,
  discardPendingEditSession,
  EDIT_RESUME_WINDOW_MS,
  enterEditSession,
  excludedFileIds,
  isStudioRoom,
  pickRoomToRemove,
  roomAnswerCount,
  roomFileIds,
  leaveEditSession,
  useConfiguratorStore,
  type ConfiguratorSnapshot,
  type RoomInstance,
} from './configurator-store';

const SKETCH_A = '0b6ad530-3c0f-4c39-8ab1-8a4f3f5d2b6e';
const SKETCH_B = '1c7be641-4d10-4d4a-9b50-9b5a4e6c3c7f';

function bedroom(localId: string, sketch: string[]): RoomInstance {
  return { localId, roomType: 'BEDROOM', flowVersion: 2, answers: { sketch }, completed: false };
}

function nightstand(count: 'ONE' | 'TWO', sourceStudio = true): RoomInstance {
  return {
    localId: `ns_${count}_${String(sourceStudio)}`,
    roomType: 'PIECE_NIGHTSTAND',
    flowVersion: CURRENT_FLOW_VERSION.PIECE_NIGHTSTAND,
    answers: { config3d: defaultPieceConfig('NIGHTSTAND'), count, material: 'PAL' },
    completed: false,
    ...(sourceStudio ? { sourceStudio: { sceneId: 'scene', placementId: `p_${count}` } } : {}),
  };
}

function load(rooms: RoomInstance[]) {
  useConfiguratorStore.getState().loadSnapshot({
    phase: 'review',
    startMode: 'STANDARD',
    roomInstances: rooms,
    activeRoomIndex: 0,
    activeStepIndex: 0,
    details: {},
    inspirationPhotoIds: [],
    updatedAt: Date.now(),
  } satisfies ConfiguratorSnapshot);
}

describe('configurator store — publish reliability (E-client-2)', () => {
  beforeEach(() => {
    localStorage.clear();
    useConfiguratorStore.getState().reset();
  });

  it('forgetAttachment removes the id from every room upload answer', () => {
    load([bedroom('a', [SKETCH_A, SKETCH_B]), bedroom('b', [SKETCH_A])]);
    useConfiguratorStore.getState().forgetAttachment(SKETCH_A);
    const rooms = useConfiguratorStore.getState().roomInstances;
    expect(rooms.find((r) => r.localId === 'a')?.answers.sketch).toEqual([SKETCH_B]);
    expect(rooms.find((r) => r.localId === 'b')?.answers.sketch).toBeUndefined();
  });

  it('pruneAttachmentRefs keeps only existing ids and reports what it removed', () => {
    load([bedroom('a', [SKETCH_A, SKETCH_B])]);
    const removed = useConfiguratorStore.getState().pruneAttachmentRefs(new Set([SKETCH_B]));
    expect(removed).toBe(1);
    expect(useConfiguratorStore.getState().roomInstances[0].answers.sketch).toEqual([SKETCH_B]);
    expect(useConfiguratorStore.getState().pruneAttachmentRefs(new Set([SKETCH_B]))).toBe(0);
  });

  it('normalize forces count ONE for a nightstand placed in the Studio only', () => {
    load([nightstand('TWO', true), nightstand('TWO', false)]);
    const rooms = useConfiguratorStore.getState().roomInstances;
    expect(rooms.find((r) => r.sourceStudio)?.answers.count).toBe('ONE');
    expect(rooms.find((r) => !r.sourceStudio)?.answers.count).toBe('TWO');
  });

  it('syncCompletion follows the strict publish validation', () => {
    load([{ ...bedroom('empty', []), answers: {}, completed: true }, nightstand('ONE')]);
    useConfiguratorStore.getState().syncCompletion(false);
    const rooms = useConfiguratorStore.getState().roomInstances;
    expect(rooms.find((r) => r.localId === 'empty')?.completed).toBe(false);
    expect(rooms.find((r) => r.roomType === 'PIECE_NIGHTSTAND')?.completed).toBe(true);
  });

  it('focusRoomStep opens a room at a given screen', () => {
    load([bedroom('a', []), nightstand('ONE')]);
    useConfiguratorStore.getState().focusRoomStep(1, 2);
    expect(useConfiguratorStore.getState().activeRoomIndex).toBe(1);
    expect(useConfiguratorStore.getState().activeStepIndex).toBe(2);
  });
});

// E-client-34: notita + camera pe pozele de inspiratie
describe('configurator store — inspiration meta (E-client-34)', () => {
  const ids = (n: number) => Array.from({ length: n }, (_, i) => `00000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`);
  const kitchen = (localId: string): RoomInstance => ({
    localId,
    roomType: 'KITCHEN',
    flowVersion: CURRENT_FLOW_VERSION.KITCHEN,
    answers: {},
    completed: false,
  });
  const living = (localId: string): RoomInstance => ({
    localId,
    roomType: 'LIVING',
    flowVersion: CURRENT_FLOW_VERSION.LIVING,
    answers: {},
    completed: false,
  });
  const store = () => useConfiguratorStore.getState();

  beforeEach(() => {
    localStorage.clear();
    store().reset();
  });

  it('caps at 10 photos and reports how many did not fit', () => {
    const all = ids(12);
    const res = store().addInspirationPhotos(all.map((photoId) => ({ photoId })));
    expect(res).toEqual({ added: 10, skipped: 2 });
    expect(store().inspirationPhotoIds).toEqual(all.slice(0, 10));
  });

  it('suggests a room only when exactly one of that type exists', () => {
    load([kitchen('k1'), living('l1'), living('l2')]);
    const [a, b] = ids(2);
    store().addInspirationPhotos([
      { photoId: a, roomType: 'KITCHEN', note: 'fronturi mate' },
      { photoId: b, roomType: 'LIVING', note: 'raft' },
    ]);
    expect(store().inspirationMeta?.[a]).toEqual({ note: 'fronturi mate', roomLocalId: 'k1' });
    expect(store().inspirationMeta?.[b]).toEqual({ note: 'raft' });
  });

  it('a collection note does not overwrite an existing draft note but fills an empty one', () => {
    const [a, b] = ids(2);
    store().addInspirationPhotos([{ photoId: a, note: 'a mea' }, { photoId: b }]);
    store().addInspirationPhotos([{ photoId: a, note: 'din colectie' }, { photoId: b, note: 'completata' }]);
    expect(store().inspirationMeta?.[a]?.note).toBe('a mea');
    expect(store().inspirationMeta?.[b]?.note).toBe('completata');
  });

  it('truncates notes to 200 characters', () => {
    const [a] = ids(1);
    store().addInspirationPhotos([{ photoId: a, note: 'x'.repeat(250) }]);
    expect(store().inspirationMeta?.[a]?.note).toHaveLength(200);
    store().setInspirationNote(a, 'y'.repeat(300));
    expect(store().inspirationMeta?.[a]?.note).toHaveLength(200);
  });

  it('setInspirationNote with an empty string and no room drops the entry', () => {
    const [a] = ids(1);
    store().addInspirationPhotos([{ photoId: a, note: 'ceva' }]);
    store().setInspirationNote(a, '');
    expect(store().inspirationMeta?.[a]).toBeUndefined();
  });

  it('setInspirationPhotos drops the meta of removed photos', () => {
    const [a, b] = ids(2);
    store().addInspirationPhotos([{ photoId: a, note: 'a' }, { photoId: b, note: 'b' }]);
    store().setInspirationPhotos([b]);
    expect(Object.keys(store().inspirationMeta ?? {})).toEqual([b]);
  });

  it('removing a room clears the link of the photos that pointed to it', () => {
    load([kitchen('k1'), living('l1')]);
    const [a] = ids(1);
    store().addInspirationPhotos([{ photoId: a, roomType: 'LIVING', note: 'x' }]);
    expect(store().inspirationMeta?.[a]?.roomLocalId).toBe('l1');
    store().removeRoom('l1');
    expect(store().inspirationMeta?.[a]).toEqual({ note: 'x' });
    store().setInspirationRoom(a, 'k1');
    expect(store().inspirationMeta?.[a]?.roomLocalId).toBe('k1');
    store().removeLastOfType('KITCHEN');
    expect(store().inspirationMeta?.[a]).toEqual({ note: 'x' });
  });

  it('loadSnapshot sanitises dirty meta (foreign keys, long notes, unknown rooms)', () => {
    const [a, b] = ids(2);
    store().loadSnapshot({
      phase: 'review',
      startMode: 'STANDARD',
      roomInstances: [kitchen('k1')],
      activeRoomIndex: 0,
      activeStepIndex: 0,
      details: {},
      inspirationPhotoIds: [a],
      inspirationMeta: {
        [a]: { note: 'z'.repeat(400), roomLocalId: 'gone' },
        [b]: { note: 'nu e aleasa' },
      },
      updatedAt: Date.now(),
    });
    const meta = store().inspirationMeta ?? {};
    expect(Object.keys(meta)).toEqual([a]);
    expect(meta[a]?.note).toHaveLength(200);
    expect(meta[a]?.roomLocalId).toBeUndefined();
  });

  it('an old snapshot without inspirationMeta loads as empty meta', () => {
    load([kitchen('k1')]);
    expect(store().inspirationMeta).toEqual({});
  });
});

// b8: modul e singura sursa; bifa de ajutor pe camera (PO g0-8 / b8-2 / b8-3)
describe('configurator store — start mode and per-room design help (b8)', () => {
  const store = () => useConfiguratorStore.getState();
  const flags = () => store().roomInstances.map((r) => r.needsDesignHelp === true);

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    store().reset();
  });

  it('"I need help" then "I have a project" leaves no design help and sets the own-project mirror', () => {
    store().setStartMode('DESIGN_HELP');
    store().addRoom('KITCHEN');
    store().addRoom('BEDROOM');
    expect(flags()).toEqual([true, true]);
    expect(store().details.hasOwnProject).toBe(false);
    store().setStartMode('OWN_PROJECT');
    expect(flags()).toEqual([false, false]);
    expect(store().details.hasOwnProject).toBe(true);
    // in "Am deja un proiect" bifa nu exista
    store().setRoomDesignHelp(store().roomInstances[0].localId, true);
    expect(flags()).toEqual([false, false]);
    store().setStartMode('STANDARD');
    expect(store().details.hasOwnProject).toBe(false);
  });

  it('flagging every room equals "I need help"; unflagging one goes back to "I know what I want"', () => {
    store().setStartMode('STANDARD');
    store().addRoom('KITCHEN');
    store().addRoom('BEDROOM');
    const [k, b] = store().roomInstances.map((r) => r.localId);
    store().setRoomDesignHelp(k, true);
    expect(store().startMode).toBe('STANDARD');
    store().setRoomDesignHelp(b, true);
    expect(store().startMode).toBe('DESIGN_HELP');
    // camerele adaugate in acest mod pornesc bifate
    store().addRoom('LIVING');
    expect(flags()).toEqual([true, true, true]);
    store().setRoomDesignHelp(k, false);
    expect(store().startMode).toBe('STANDARD');
  });

  it('keeps the answers of a flagged room in the draft and gives them back when unflagged', () => {
    store().setStartMode('STANDARD');
    store().addRoomWithAnswers('KITCHEN', { layout: 'L_SHAPE' });
    const id = store().roomInstances[0].localId;
    store().setRoomDesignHelp(id, true);
    expect(store().roomInstances[0].answers.layout).toBe('L_SHAPE');
    store().setRoomDesignHelp(id, false);
    expect(store().roomInstances[0].answers.layout).toBe('L_SHAPE');
  });

  it('migrates old snapshots: DESIGN_HELP flags every room, the old cart checkbox becomes the mode', () => {
    store().loadSnapshot({
      phase: 'cart', startMode: 'DESIGN_HELP', activeRoomIndex: 0, activeStepIndex: 0,
      roomInstances: [{ localId: 'a', roomType: 'BATHROOM', flowVersion: 1, answers: {}, completed: false }],
      details: { includesPaidDesign: true } as never, inspirationPhotoIds: [], updatedAt: Date.now(),
    });
    expect(flags()).toEqual([true]);
    expect('includesPaidDesign' in store().details).toBe(false);
    store().loadSnapshot({
      phase: 'cart', startMode: 'STANDARD', activeRoomIndex: 0, activeStepIndex: 0,
      roomInstances: [], details: { hasOwnProject: true }, inspirationPhotoIds: [], updatedAt: Date.now(),
    });
    expect(store().startMode).toBe('OWN_PROJECT');
  });
});

// b11 (PO 2026-11-13): bugetul pus din oficiu de formularul vechi nu e o alegere a clientului
describe('configurator store — budget choice migration (b11)', () => {
  const store = () => useConfiguratorStore.getState();
  const snap = (details: Record<string, unknown>, phase: ConfiguratorSnapshot['phase'] = 'details'): ConfiguratorSnapshot => ({
    phase, startMode: 'STANDARD', activeRoomIndex: 0, activeStepIndex: 0,
    roomInstances: [{ localId: 'r_k1', roomType: 'KITCHEN', flowVersion: 1, answers: {}, completed: true }],
    details: { city: 'Cluj', ...details } as never, inspirationPhotoIds: [], updatedAt: Date.now(),
  });

  beforeEach(() => {
    localStorage.clear();
    store().reset();
  });

  it('an old draft with the estimate minimum filled in loses it (the choice is asked again)', () => {
    store().loadSnapshot(snap({ budgetRange: 'OVER_15K', budgetEstimateRon: 25000 }));
    expect(store().details.budgetRange).toBeUndefined();
    expect(store().details.budgetEstimateRon).toBeUndefined();
    expect(store().details.city).toBe('Cluj');
  });

  it('the old "Sub 5.000" default in help mode is dropped too', () => {
    store().loadSnapshot(snap({ budgetRange: 'UNDER_5K' }));
    expect(store().details.budgetRange).toBeUndefined();
  });

  it('"Prefer sa nu spun" from an old draft stays (it was always ticked by the client)', () => {
    store().loadSnapshot(snap({ budgetRange: 'UNDISCLOSED', budgetEstimateRon: null }));
    expect(store().details.budgetRange).toBe('UNDISCLOSED');
  });

  it('an amount chosen on the new slider survives every reload', () => {
    store().loadSnapshot(snap({ budgetRange: 'FROM_5K_TO_15K', budgetEstimateRon: 12000, budgetChosen: true }));
    expect(store().details).toMatchObject({ budgetRange: 'FROM_5K_TO_15K', budgetEstimateRon: 12000, budgetChosen: true });
  });

  it('an old draft already on the summary goes back to the general details step', () => {
    store().loadSnapshot(snap({ budgetRange: 'OVER_15K', budgetEstimateRon: 25000 }, 'review'));
    expect(store().phase).toBe('details');
    store().loadSnapshot(snap({ budgetRange: 'OVER_15K', budgetEstimateRon: 25000, budgetChosen: true }, 'review'));
    expect(store().phase).toBe('review');
  });

  it('migrates a v5 draft from localStorage', async () => {
    localStorage.setItem('mm_configurator_v1', JSON.stringify({ version: 5, state: snap({ budgetRange: 'OVER_15K', budgetEstimateRon: 25000 }, 'review') }));
    await useConfiguratorStore.persist.rehydrate();
    expect(store().details.budgetEstimateRon).toBeUndefined();
    expect(store().phase).toBe('details');
  });
});

// b8, pasul 1: editarea are memoria ei; ciorna cererii noi ramane neatinsa
describe('configurator store — edit session memory (b8)', () => {
  const store = () => useConfiguratorStore.getState();
  const SERVER_ROOM = '5f0c1a2b-3c4d-4e5f-8a9b-0c1d2e3f4a5b';
  const editSnapshot: ConfiguratorSnapshot = {
    phase: 'cart', startMode: 'STANDARD', activeRoomIndex: 0, activeStepIndex: 0,
    roomInstances: [{ localId: SERVER_ROOM, roomType: 'BATHROOM', flowVersion: 1, answers: {}, completed: true }],
    details: { city: 'Iași' }, inspirationPhotoIds: [], updatedAt: Date.now(),
  };

  beforeEach(() => {
    leaveEditSession();
    localStorage.clear();
    sessionStorage.clear();
    store().reset();
  });

  it('an abandoned edit does not touch the new draft and is thrown away on leave', () => {
    store().setStartMode('STANDARD');
    store().addRoom('KITCHEN');
    const before = localStorage.getItem('mm_configurator_v1');
    expect(enterEditSession('req-1')).toBe(false);
    store().loadSnapshot(editSnapshot);
    store().setDetails({ city: 'Cluj' });
    expect(localStorage.getItem('mm_configurator_v1')).toBe(before);
    expect(sessionStorage.getItem('mm_configurator_edit_v1:req-1')).not.toBeNull();
    leaveEditSession();
    expect(sessionStorage.getItem('mm_configurator_edit_v1:req-1')).toBeNull();
    expect(store().roomInstances.map((r) => r.roomType)).toEqual(['KITCHEN']);
    expect(store().details.city).toBeUndefined();
  });

  it('a reload during the edit resumes it from the tab', () => {
    enterEditSession('req-2');
    store().loadSnapshot(editSnapshot);
    // reincarcare: memoria din pagina se pierde, cea din tab ramane
    expect(enterEditSession('req-2')).toBe(true);
    expect(store().roomInstances[0].localId).toBe(SERVER_ROOM);
    expect(store().details.city).toBe('Iași');
  });

  it('drops an abandoned edit that older builds wrote into the new-draft key', async () => {
    localStorage.setItem('mm_configurator_v1', JSON.stringify({ version: 4, state: editSnapshot }));
    await useConfiguratorStore.persist.rehydrate();
    expect(store().roomInstances).toEqual([]);
    expect(store().startMode).toBeNull();
    expect(store().phase).toBe('start');
  });

  it('keeps a genuine old new-request draft when migrating', async () => {
    localStorage.setItem('mm_configurator_v1', JSON.stringify({ version: 4, state: {
      ...editSnapshot, roomInstances: [{ localId: 'r_abc12345', roomType: 'BATHROOM', flowVersion: 1, answers: {}, completed: false }],
    } }));
    await useConfiguratorStore.persist.rehydrate();
    expect(store().roomInstances.map((r) => r.localId)).toEqual(['r_abc12345']);
  });
});

// b6: scoaterea camerelor din cos
describe('configurator store — removing rooms (b6)', () => {
  const s = () => useConfiguratorStore.getState();
  beforeEach(() => {
    localStorage.clear();
    s().reset();
  });

  it('with two bathrooms, "−" removes the one without answers first', () => {
    load([
      { localId: 'b1', roomType: 'BATHROOM', flowVersion: 1, answers: { layout: 'X' }, completed: false },
      { localId: 'b2', roomType: 'BATHROOM', flowVersion: 1, answers: {}, completed: false },
    ]);
    expect(pickRoomToRemove(s().roomInstances, 'BATHROOM')?.localId).toBe('b2');
    s().removeLastOfType('BATHROOM');
    expect(s().roomInstances.map((r) => r.localId)).toEqual(['b1']);
  });

  it('when every room of the type has answers, the last one is picked', () => {
    load([bedroom('a', [SKETCH_A]), bedroom('b', [SKETCH_B])]);
    expect(pickRoomToRemove(s().roomInstances, 'BEDROOM')?.localId).toBe('b');
    expect(pickRoomToRemove(s().roomInstances, 'KITCHEN')).toBeNull();
  });

  it('a removed room takes its 3D picture away and its files become discarded, not project files', () => {
    load([bedroom('a', [SKETCH_A]), bedroom('b', [SKETCH_B])]);
    s().setSnapshot3d('a', 'data:image/png;base64,AAA');
    s().removeRoom('a');
    expect(s().snapshots3d).toEqual({});
    expect(s().discardedFiles).toEqual([SKETCH_A]);
    expect(roomFileIds(s().roomInstances[0])).toEqual([SKETCH_B]);
    // persistat cu ciorna; resetul il goleste
    expect(s().snapshot().discardedFiles).toEqual([SKETCH_A]);
    s().reset();
    expect(s().discardedFiles).toEqual([]);
  });

  it('counts answers apart from files', () => {
    const room: RoomInstance = { localId: 'x', roomType: 'BEDROOM', flowVersion: 2, answers: { sketch: [SKETCH_A], wardrobe: 'YES' }, completed: false };
    expect(roomAnswerCount(room)).toBe(1);
    expect(roomFileIds(room)).toEqual([SKETCH_A]);
  });
});

// O piesa adusa din Studio 3D nu poate cere ajutor la proiectare (revizuire etapa 2)
describe('configurator store — Studio pieces and design help', () => {
  const s = () => useConfiguratorStore.getState();
  const studioPiece = (): RoomInstance => ({ ...nightstand('ONE'), localId: 'studio' });
  const kitchenRoom = (): RoomInstance => ({ localId: 'k', roomType: 'KITCHEN', flowVersion: CURRENT_FLOW_VERSION.KITCHEN, answers: {}, completed: false });
  beforeEach(() => {
    localStorage.clear();
    s().reset();
  });

  it('a Studio piece cannot be flagged, and "I need help" leaves it unflagged and shows "I know what I want"', () => {
    load([kitchenRoom(), studioPiece()]);
    s().setRoomDesignHelp('studio', true);
    expect(s().roomInstances.find((r) => r.localId === 'studio')?.needsDesignHelp).not.toBe(true);
    s().setStartMode('DESIGN_HELP');
    expect(s().roomInstances.find((r) => r.localId === 'k')?.needsDesignHelp).toBe(true);
    expect(s().roomInstances.find((r) => r.localId === 'studio')?.needsDesignHelp).not.toBe(true);
    expect(s().startMode).toBe('STANDARD');
  });

  it('only Studio pieces + "I need help" stays "I know what I want"; a flagged Studio piece from old data is unflagged', () => {
    load([{ ...studioPiece(), needsDesignHelp: true }]);
    expect(s().roomInstances[0].needsDesignHelp).toBe(false);
    s().setStartMode('DESIGN_HELP');
    expect(s().startMode).toBe('STANDARD');
    expect(isStudioRoom(s().roomInstances[0])).toBe(true);
  });
});

// review etapa 2: m6, m1 (fereastra), m3
describe('configurator store — review fixes (m6, m1, m3)', () => {
  const s = () => useConfiguratorStore.getState();
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    s().reset();
  });

  it('m6: with an unknown flow nothing is taken for a file', () => {
    const room = { localId: 'x', roomType: 'KITCHEN', flowVersion: 999, answers: { woods: ['OAK', 'WALNUT'] }, completed: false } as RoomInstance;
    expect(roomFileIds(room)).toEqual([]);
    expect(roomAnswerCount(room)).toBe(1);
  });

  it('M1: the hidden 3D picture of a flagged room is excluded, the visible sketch is not', () => {
    const desk: RoomInstance = { localId: 'd', roomType: 'PIECE_DESK', flowVersion: CURRENT_FLOW_VERSION.PIECE_DESK, answers: { snapshot3d: [SKETCH_A] }, completed: true };
    expect([...excludedFileIds([desk], [])]).toEqual([]);
    expect([...excludedFileIds([{ ...desk, needsDesignHelp: true }], [SKETCH_B])].sort()).toEqual([SKETCH_A, SKETCH_B].sort());
  });

  it('m1: a pending edit is thrown away on demand (request page), so "Edit" starts from the server', () => {
    enterEditSession('req-7');
    s().setDetails({ city: 'Iași' });
    leaveEditSession({ keepForMs: EDIT_RESUME_WINDOW_MS });
    expect(sessionStorage.getItem('mm_configurator_edit_v1:req-7')).not.toBeNull();
    discardPendingEditSession();
    expect(sessionStorage.getItem('mm_configurator_edit_v1:req-7')).toBeNull();
    expect(enterEditSession('req-7')).toBe(false);
    leaveEditSession();
  });

  it('M2: reset moves the draft generation forward', () => {
    const before = draftGenerationId();
    s().reset();
    expect(draftGenerationId()).toBe(before + 1);
  });

  it('m3: an old "I know what I want" draft with the old paid-design box keeps a one-time note', () => {
    s().loadSnapshot({
      phase: 'cart', startMode: 'STANDARD', activeRoomIndex: 0, activeStepIndex: 0, inspirationPhotoIds: [], updatedAt: 1,
      roomInstances: [{ localId: 'k', roomType: 'KITCHEN', flowVersion: 1, answers: {}, completed: false }],
      details: { includesPaidDesign: true } as never,
    });
    expect(s().legacyPaidDesignNote).toBe(true);
    expect('includesPaidDesign' in s().details).toBe(false);
    s().setRoomDesignHelp('k', true);
    expect(s().legacyPaidDesignNote).toBe(false);
  });
});

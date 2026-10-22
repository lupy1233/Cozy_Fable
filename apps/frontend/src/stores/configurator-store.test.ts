import { CURRENT_FLOW_VERSION, defaultPieceConfig } from '@marketplace/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { useConfiguratorStore, type ConfiguratorSnapshot, type RoomInstance } from './configurator-store';

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

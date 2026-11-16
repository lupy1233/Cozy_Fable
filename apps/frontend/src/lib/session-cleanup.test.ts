import { QueryClient } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const disconnect = vi.fn();
vi.mock('@/hooks/use-socket', () => ({ disconnectRealtime: () => disconnect() }));

import { enterEditSession, leaveEditSession, useConfiguratorStore } from '@/stores/configurator-store';
import { useStudioStore } from '@/stores/studio-store';
import {
  adoptLocalOwner,
  clearUserLocalData,
  DRAFT_TOKEN_KEY,
  forgetLocalOwner,
  hasUnpublishedLocalDraft,
  LOCAL_OWNER_KEY,
} from './session-cleanup';

const CONFIGURATOR_KEY = 'mm_configurator_v1';

function seed(): QueryClient {
  const qc = new QueryClient();
  qc.setQueryData(['requests', 'mine'], [{ id: 'r1', title: 'Bucătăria Anei' }]);
  qc.setQueryData(['auth', 'me'], { id: 'ana' });
  localStorage.setItem(DRAFT_TOKEN_KEY, 'tok');
  localStorage.setItem('mm_req_token_x', 'old');
  localStorage.setItem(
    CONFIGURATOR_KEY,
    JSON.stringify({ state: { roomInstances: [], details: { addressText: 'Str. Lalelor 1' } }, version: 4 }),
  );
  useConfiguratorStore.getState().setDetails({ addressText: 'Str. Lalelor 1' });
  useStudioStore.getState().setAccountDraft({ id: 'd1', name: 'Living Ana' });
  return qc;
}

beforeEach(() => {
  localStorage.clear();
  disconnect.mockClear();
});

describe('clearUserLocalData', () => {
  it('wipes the query cache, the draft keys, the configurator and the studio account draft', async () => {
    const qc = seed();
    await clearUserLocalData(qc);

    expect(qc.getQueryCache().getAll()).toHaveLength(0);
    expect(localStorage.getItem(DRAFT_TOKEN_KEY)).toBeNull();
    expect(localStorage.getItem('mm_req_token_x')).toBeNull();
    const persisted = JSON.parse(localStorage.getItem(CONFIGURATOR_KEY) ?? '{"state":{}}') as {
      state: { details?: object; roomInstances?: unknown[] };
    };
    expect(persisted.state.details ?? {}).toEqual({});
    expect(useConfiguratorStore.getState().details).toEqual({});
    expect(useConfiguratorStore.getState().roomInstances).toEqual([]);
    expect(useStudioStore.getState().accountDraft).toBeNull();
    expect(disconnect).toHaveBeenCalledTimes(1);
  });
});

describe('adoptLocalOwner', () => {
  it('keeps anonymous work when no owner was recorded', async () => {
    const qc = seed();
    await adoptLocalOwner(qc, 'ana');
    expect(localStorage.getItem(LOCAL_OWNER_KEY)).toBe('ana');
    expect(localStorage.getItem(DRAFT_TOKEN_KEY)).toBe('tok');
    expect(qc.getQueryData(['requests', 'mine'])).toBeDefined();
  });

  it('keeps data for the same user', async () => {
    localStorage.setItem(LOCAL_OWNER_KEY, 'ana');
    const qc = seed();
    await adoptLocalOwner(qc, 'ana');
    expect(localStorage.getItem(DRAFT_TOKEN_KEY)).toBe('tok');
    expect(useStudioStore.getState().accountDraft).toEqual({ id: 'd1', name: 'Living Ana' });
  });

  it('clears the previous user data when another account logs in', async () => {
    localStorage.setItem(LOCAL_OWNER_KEY, 'ana');
    const qc = seed();
    await adoptLocalOwner(qc, 'radu');
    expect(localStorage.getItem(LOCAL_OWNER_KEY)).toBe('radu');
    expect(localStorage.getItem(DRAFT_TOKEN_KEY)).toBeNull();
    expect(qc.getQueryCache().getAll()).toHaveLength(0);
    expect(useConfiguratorStore.getState().details).toEqual({});
    expect(useStudioStore.getState().accountDraft).toBeNull();
  });

  it('forgetLocalOwner removes the tag', () => {
    localStorage.setItem(LOCAL_OWNER_KEY, 'ana');
    forgetLocalOwner();
    expect(localStorage.getItem(LOCAL_OWNER_KEY)).toBeNull();
  });
});

describe('hasUnpublishedLocalDraft', () => {
  it('detects rooms or details and ignores empty or broken blobs', () => {
    expect(hasUnpublishedLocalDraft()).toBe(false);
    localStorage.setItem(CONFIGURATOR_KEY, JSON.stringify({ state: { roomInstances: [], details: {} } }));
    expect(hasUnpublishedLocalDraft()).toBe(false);
    localStorage.setItem(CONFIGURATOR_KEY, JSON.stringify({ state: { roomInstances: [{ localId: 'a' }], details: {} } }));
    expect(hasUnpublishedLocalDraft()).toBe(true);
    localStorage.setItem(CONFIGURATOR_KEY, JSON.stringify({ state: { roomInstances: [], details: { city: 'Cluj' } } }));
    expect(hasUnpublishedLocalDraft()).toBe(true);
    localStorage.setItem(CONFIGURATOR_KEY, '{not json');
    expect(hasUnpublishedLocalDraft()).toBe(false);
  });

  // b8: o editare a unei cereri publicate nu e o ciorna nepublicata
  const SERVER_ROOM_ID = '5f0c1a2b-3c4d-4e5f-8a9b-0c1d2e3f4a5b';
  it('ignores an abandoned edit written by older builds into the new-draft key', () => {
    localStorage.setItem(
      CONFIGURATOR_KEY,
      JSON.stringify({ state: { roomInstances: [{ localId: SERVER_ROOM_ID }], details: { city: 'Cluj' } }, version: 4 }),
    );
    expect(hasUnpublishedLocalDraft()).toBe(false);
  });

  it('ignores an edit in progress and still sees the real new draft next to it', () => {
    sessionStorage.clear();
    enterEditSession('req-1');
    useConfiguratorStore.getState().loadSnapshot({
      phase: 'cart',
      startMode: 'STANDARD',
      roomInstances: [{ localId: SERVER_ROOM_ID, roomType: 'BATHROOM', flowVersion: 1, answers: {}, completed: true }],
      activeRoomIndex: 0,
      activeStepIndex: 0,
      details: { city: 'Cluj' },
      inspirationPhotoIds: [],
      updatedAt: Date.now(),
    });
    // editarea sta in sessionStorage; cheia cererii noi ramane goala
    expect(hasUnpublishedLocalDraft()).toBe(false);
    leaveEditSession();
    useConfiguratorStore.getState().addRoom('KITCHEN');
    expect(hasUnpublishedLocalDraft()).toBe(true);
  });
});

// m2: deconectarea de pe pagina de editare nu lasa in tab o editare goala
describe('clearUserLocalData during an edit', () => {
  it('leaves nothing in sessionStorage; reopening the same request starts from the server', async () => {
    sessionStorage.clear();
    enterEditSession('req-x');
    useConfiguratorStore.getState().setDetails({ city: 'Cluj' });
    expect(sessionStorage.getItem('mm_configurator_edit_v1:req-x')).not.toBeNull();
    await clearUserLocalData(new QueryClient());
    expect(sessionStorage.getItem('mm_configurator_edit_v1:req-x')).toBeNull();
    // o scriere ulterioara a store-ului merge in memoria cererii noi, nu in editare
    useConfiguratorStore.getState().setPhase('cart');
    expect(sessionStorage.getItem('mm_configurator_edit_v1:req-x')).toBeNull();
    expect(enterEditSession('req-x')).toBe(false);
    leaveEditSession();
  });
});

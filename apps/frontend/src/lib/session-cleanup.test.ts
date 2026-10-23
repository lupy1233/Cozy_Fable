import { QueryClient } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const disconnect = vi.fn();
vi.mock('@/hooks/use-socket', () => ({ disconnectRealtime: () => disconnect() }));

import { useConfiguratorStore } from '@/stores/configurator-store';
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
});

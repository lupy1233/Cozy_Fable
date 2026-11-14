import { fireEvent, render, screen, within } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import en from '../../../messages/en.json';
import { MyDraftsList } from './my-drafts-list';

// d5 (PO d5-1): fila "Ciorne" — "Continua" redeschide ciorna (token nou de la server) si
// "Sterge" cere confirmare.
const state = vi.hoisted(() => ({
  cont: { mutate: vi.fn(), reset: vi.fn(), isPending: false, error: null as unknown },
  del: { mutate: vi.fn(), reset: vi.fn(), isPending: false, error: null as unknown },
  push: vi.fn(),
  reset: vi.fn(),
  toast: vi.fn(),
}));
vi.mock('@/i18n/routing', () => ({ useRouter: () => ({ push: state.push }) }));
vi.mock('@/hooks/use-requests', () => ({
  useContinueDraft: () => state.cont,
  useDeleteRequest: () => state.del,
}));
vi.mock('@/stores/configurator-store', () => ({ useConfiguratorStore: { getState: () => ({ reset: state.reset }) } }));
vi.mock('@/components/ui/toaster', () => ({ toast: { success: (msg: string) => state.toast(msg) } }));

const draft = {
  id: 'd1', title: '', city: 'Iași', roomTypes: ['KITCHEN', 'BATHROOM'] as const,
  createdAt: '2026-11-10T10:00:00Z', updatedAt: new Date(Date.now() - 3_600_000).toISOString(),
};
const view = (drafts = [draft]) =>
  render(
    <NextIntlClientProvider locale="en" messages={en}>
      <MyDraftsList drafts={drafts.map((d) => ({ ...d, roomTypes: [...d.roomTypes] }))} />
    </NextIntlClientProvider>,
  );

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  state.cont = { mutate: vi.fn(), reset: vi.fn(), isPending: false, error: null };
  state.del = { mutate: vi.fn(), reset: vi.fn(), isPending: false, error: null };
  state.push = vi.fn();
  state.reset = vi.fn();
  state.toast = vi.fn();
});

describe('MyDraftsList', () => {
  it('shows the rooms and city of each draft', () => {
    view();
    expect(screen.getByText(en.Requests.drafts.untitled)).toBeTruthy();
    expect(screen.getByText(en.Configurator.rooms.type.KITCHEN)).toBeTruthy();
    expect(screen.getByText(/Iași/)).toBeTruthy();
  });

  it('"Continue" gets a fresh token, stores it and opens the form on that draft', () => {
    view();
    fireEvent.click(screen.getByRole('button', { name: /^Continue draft: Kitchen, Bathroom · saved/ }));
    const [id, opts] = state.cont.mutate.mock.calls[0];
    expect(id).toBe('d1');
    opts.onSuccess({ id: 'd1', draftToken: 'tok-new' });
    expect(localStorage.getItem('mm_draft_token')).toBe('tok-new');
    expect(state.reset).toHaveBeenCalled();
    expect(state.push).toHaveBeenCalledWith('/requests/new');
  });

  it('"Delete" asks first, then deletes and confirms', () => {
    view();
    fireEvent.click(screen.getByRole('button', { name: /^Delete draft: Kitchen, Bathroom/ }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText(en.Requests.drafts.deleteBody)).toBeTruthy();
    expect(state.del.mutate).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole('button', { name: en.Requests.deleteDialog.confirm }));
    const [id, opts] = state.del.mutate.mock.calls[0];
    expect(id).toBe('d1');
    opts.onSuccess();
    expect(state.toast).toHaveBeenCalledWith(en.Requests.drafts.deleted);
  });

  // revizie m4: o cerere inceputa in acest browser nu se inlocuieste fara intrebare
  it('with a request in progress in this browser, "Continue" asks first (once), then opens without a second question', () => {
    localStorage.setItem('mm_configurator_v1', JSON.stringify({ state: { roomInstances: [{ localId: 'a', roomType: 'KITCHEN' }], details: {} } }));
    view();
    fireEvent.click(screen.getByRole('button', { name: /^Continue draft:/ }));
    expect(state.cont.mutate).not.toHaveBeenCalled();
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText(en.Requests.drafts.replaceLocalBody)).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: en.Requests.drafts.continueConfirm }));
    const [, opts] = state.cont.mutate.mock.calls[0];
    opts.onSuccess({ id: 'd1', draftToken: 'tok' });
    expect(sessionStorage.getItem('mm_draft_continue')).toBe('1');
    expect(state.push).toHaveBeenCalledWith('/requests/new');
  });

  it('two drafts → distinct accessible names', () => {
    view([draft, { ...draft, id: 'd2', roomTypes: ['OFFICE'] as unknown as typeof draft.roomTypes }]);
    const names = screen.getAllByRole('button', { name: /^Continue draft:/ }).map((b) => b.getAttribute('aria-label'));
    expect(new Set(names).size).toBe(2);
  });

  it('no drafts → empty message', () => {
    view([]);
    expect(screen.getByText(en.Requests.drafts.empty)).toBeTruthy();
  });
});
